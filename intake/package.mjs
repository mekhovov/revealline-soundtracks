const encoder = new TextEncoder();
const decoder = new TextDecoder();
const MAGIC = encoder.encode("RLSINTAKE/1\n");
const MAX_TRACKS = 20;
const MAX_TRACK_BYTES = 24 * 1024 * 1024;
const MAX_BATCH_BYTES = 64 * 1024 * 1024;
const LICENSES = new Set([
  "cc0",
  "cc-by-3.0",
  "cc-by-4.0",
  "cc-by-sa-3.0",
  "cc-by-sa-4.0",
  "unknown",
]);

const demand = (value, message) => {
  if (!value) throw new Error(message);
};
const safeURL = (value) => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
};
const hex = (bytes) =>
  [...new Uint8Array(bytes)]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
const signature = (bytes) =>
  decoder.decode(bytes.subarray(0, 3)) === "ID3" ||
  (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0);
const cleanText = (value, maximum) => {
  const text = String(value ?? "").trim();
  demand(text.length <= maximum, `Text exceeds ${maximum} characters.`);
  return text;
};
const slug = (value, maximum = 48) =>
  String(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maximum)
    .replace(/-+$/g, "") || "soundtrack";
const safeFileName = (value) => {
  const name = cleanText(value, 255);
  demand(
    name && name !== "." && name !== "..",
    "Packaged MP3 filename is missing.",
  );
  demand(!/[\\/\0]/.test(name), `Packaged MP3 filename is unsafe: ${name}`);
  demand(/\.mp3$/i.test(name), `Only MP3 files are accepted: ${name}`);
  return name;
};

export function validateIntakeMetadata(input) {
  const metadata = {
    source: cleanText(input.source, 2048),
    license: cleanText(input.license, 32),
    artist: cleanText(input.artist, 160),
    styles: [
      ...new Set(
        (input.styles ?? [])
          .map((value) => cleanText(value, 64))
          .filter(Boolean),
      ),
    ],
    collections: [
      ...new Set(
        (input.collections ?? [])
          .map((value) => cleanText(value, 160))
          .filter(Boolean),
      ),
    ],
    batchId: cleanText(input.batchId, 64),
    batchTitle: cleanText(input.batchTitle, 160),
    description: cleanText(input.description, 1000),
    attribution: cleanText(input.attribution, 1000),
    rightsEvidence: cleanText(input.rightsEvidence, 2048),
    derivativeNotice: cleanText(input.derivativeNotice, 1000),
    confirmRights: input.confirmRights === true,
  };
  if (!metadata.rightsEvidence) metadata.rightsEvidence = metadata.source;
  demand(
    metadata.confirmRights,
    "Confirm the exact public redistribution and web-game rights.",
  );
  demand(safeURL(metadata.source), "Enter a secure exact creator/source URL.");
  demand(
    LICENSES.has(metadata.license),
    "Choose a supported licence or uploader-confirmed unknown rights.",
  );
  demand(metadata.artist, "Enter the artist or creator name.");
  demand(metadata.styles.length, "Enter at least one reviewed music style.");
  demand(metadata.styles.length <= 16, "Use at most 16 reviewed music styles.");
  demand(metadata.collections.length <= 16, "Use at most 16 collections.");
  demand(
    safeURL(metadata.rightsEvidence),
    "Enter a secure rights-evidence URL.",
  );
  if (metadata.license.startsWith("cc-by-sa"))
    demand(
      metadata.derivativeNotice,
      "ShareAlike intake requires a derivative notice.",
    );
  if (metadata.batchId)
    demand(
      /^[a-z0-9][a-z0-9-]{0,63}$/.test(metadata.batchId),
      "Batch ID must use lowercase letters, digits and hyphens.",
    );
  return metadata;
}

export function bindPackageInvalidation(form, discard) {
  form.addEventListener("input", discard);
  form.addEventListener("change", discard);
  return () => {
    form.removeEventListener("input", discard);
    form.removeEventListener("change", discard);
  };
}

export function createPackageGeneration() {
  let revision = 0;
  return {
    begin() {
      revision += 1;
      return revision;
    },
    invalidate() {
      revision += 1;
    },
    isCurrent(candidate) {
      return candidate === revision;
    },
  };
}

export async function createIntakePackage(
  files,
  input,
  { probe = async () => null, isCurrent = () => true } = {},
) {
  const metadata = validateIntakeMetadata(input);
  const selected = [...(files ?? [])].sort((a, b) =>
    (a.webkitRelativePath || a.name).localeCompare(
      b.webkitRelativePath || b.name,
    ),
  );
  demand(selected.length, "Choose one or more MP3 files or a folder.");
  demand(
    selected.length <= MAX_TRACKS,
    "One package is limited to 20 MP3 files.",
  );
  demand(
    selected.reduce((total, file) => total + file.size, 0) <= MAX_BATCH_BYTES,
    "One package is limited to 64 MiB of audio.",
  );

  const payloads = [];
  const tracks = [];
  let offset = 0;
  for (const file of selected) {
    demand(isCurrent(), "Inputs changed while the package was prepared.");
    demand(
      /\.mp3$/i.test(file.name),
      `Only MP3 files are accepted: ${file.name}`,
    );
    demand(
      file.size > 0 && file.size < MAX_TRACK_BYTES,
      `MP3 size is invalid: ${file.name}`,
    );
    const bytes = new Uint8Array(await file.arrayBuffer());
    demand(isCurrent(), "Inputs changed while the package was prepared.");
    demand(
      signature(bytes),
      `File does not begin with an MP3 signature: ${file.name}`,
    );
    const sha256 = hex(await globalThis.crypto.subtle.digest("SHA-256", bytes));
    demand(isCurrent(), "Inputs changed while the package was prepared.");
    const durationSeconds = Number(await probe(file));
    demand(isCurrent(), "Inputs changed while the package was prepared.");
    demand(
      Number.isFinite(durationSeconds) && durationSeconds > 0,
      `The browser could not read MP3 duration: ${file.name}`,
    );
    tracks.push({
      fileName: safeFileName(file.name),
      bytes: bytes.length,
      sha256,
      durationSeconds,
      offset,
    });
    payloads.push(bytes);
    offset += bytes.length;
  }
  if (!metadata.batchTitle)
    metadata.batchTitle =
      tracks.length === 1
        ? tracks[0].fileName.replace(/\.mp3$/i, "")
        : (() => {
            const suffix = ` — ${tracks.length} tracks`;
            return `${metadata.artist.slice(0, 160 - suffix.length).trimEnd()}${suffix}`;
          })();
  if (!metadata.batchId)
    metadata.batchId = `${slug(metadata.batchTitle)}-${tracks[0].sha256.slice(0, 8)}`;
  validateIntakeMetadata(metadata);
  demand(isCurrent(), "Inputs changed while the package was prepared.");
  const manifest = {
    format: "revealline-soundtrack-intake-package.v1",
    createdAt: new Date().toISOString(),
    metadata,
    tracks,
    audioBytes: offset,
  };
  const manifestBytes = encoder.encode(
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
  const length = new Uint8Array(4);
  new DataView(length.buffer).setUint32(0, manifestBytes.length);
  return {
    blob: new Blob([MAGIC, length, manifestBytes, ...payloads], {
      type: "application/vnd.revealline.soundtrack-intake",
    }),
    manifest,
  };
}

export async function readIntakePackage(source) {
  demand(
    Number(source?.size) > 0 &&
      Number(source.size) <= MAX_BATCH_BYTES + 1024 * 1024,
    "Intake package size is invalid.",
  );
  const bytes = new Uint8Array(await source.arrayBuffer());
  demand(bytes.length > MAGIC.length + 4, "Intake package is truncated.");
  demand(
    MAGIC.every((value, index) => bytes[index] === value),
    "Intake package signature differs.",
  );
  const manifestLength = new DataView(
    bytes.buffer,
    bytes.byteOffset + MAGIC.length,
    4,
  ).getUint32(0);
  const manifestStart = MAGIC.length + 4;
  const payloadStart = manifestStart + manifestLength;
  demand(payloadStart <= bytes.length, "Intake package manifest is truncated.");
  const manifest = JSON.parse(
    decoder.decode(bytes.subarray(manifestStart, payloadStart)),
  );
  demand(
    manifest.format === "revealline-soundtrack-intake-package.v1" &&
      Array.isArray(manifest.tracks),
    "Unsupported intake package.",
  );
  const metadata = validateIntakeMetadata(manifest.metadata ?? {});
  demand(
    manifest.tracks.length > 0 && manifest.tracks.length <= MAX_TRACKS,
    "Intake package track count is invalid.",
  );
  const tracks = [];
  let total = 0;
  for (const track of manifest.tracks) {
    const fileName = safeFileName(track.fileName);
    demand(
      Number.isInteger(track.offset) &&
        Number.isInteger(track.bytes) &&
        track.bytes > 0 &&
        track.bytes < MAX_TRACK_BYTES &&
        track.offset === total,
      "Intake package audio offsets differ.",
    );
    demand(
      /^[a-f0-9]{64}$/.test(track.sha256) &&
        Number.isFinite(track.durationSeconds) &&
        track.durationSeconds > 0,
      `Intake package track metadata differs: ${fileName}`,
    );
    const start = payloadStart + track.offset;
    const end = start + track.bytes;
    demand(
      end <= bytes.length,
      `Intake package audio is truncated: ${track.fileName}`,
    );
    const audio = bytes.slice(start, end);
    demand(
      signature(audio),
      `Packaged file is not MP3 audio: ${track.fileName}`,
    );
    demand(
      hex(await globalThis.crypto.subtle.digest("SHA-256", audio)) ===
        track.sha256,
      `Packaged hash differs: ${fileName}`,
    );
    tracks.push({ ...track, fileName, audio });
    total += track.bytes;
  }
  demand(
    payloadStart + total === bytes.length,
    "Intake package has undeclared trailing bytes.",
  );
  demand(
    total === manifest.audioBytes && total <= MAX_BATCH_BYTES,
    "Intake package byte total differs.",
  );
  return { manifest: { ...manifest, metadata }, tracks };
}
