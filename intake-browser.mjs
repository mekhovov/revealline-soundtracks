import {
  bindPackageInvalidation,
  createPackageGeneration,
  createIntakePackage,
} from "./intake/package.mjs";

const form = document.querySelector("#browser-intake-form");
const files = document.querySelector("#intake-files");
const folder = document.querySelector("#intake-folder");
const status = document.querySelector("#intake-status");
const download = document.querySelector("#intake-download");
let preparedURL = null;
let activeGeneration = null;
const generation = createPackageGeneration();

const discardPrepared = ({ announce = false } = {}) => {
  if (preparedURL) {
    URL.revokeObjectURL(preparedURL);
    preparedURL = null;
  }
  download.hidden = true;
  download.removeAttribute("href");
  if (announce)
    status.textContent =
      "Inputs changed. Verify again to create a package with the current files and rights.";
};

bindPackageInvalidation(form, () => {
  generation.invalidate();
  discardPrepared({ announce: true });
});

const selectedFiles = () => {
  const picked = [...files.files];
  const nested = [...folder.files];
  if (picked.length && nested.length)
    throw new Error("Choose MP3 files or a folder, not both.");
  return nested.length ? nested : picked;
};

function probeDuration(file) {
  return new Promise((resolve, reject) => {
    const audio = document.createElement("audio");
    const url = URL.createObjectURL(file);
    const done = (result, error) => {
      audio.removeAttribute("src");
      audio.load();
      URL.revokeObjectURL(url);
      if (error) reject(error);
      else resolve(result);
    };
    audio.preload = "metadata";
    audio.onloadedmetadata = () => done(audio.duration);
    audio.onerror = () =>
      done(null, new Error(`The browser could not decode ${file.name}.`));
    audio.src = url;
  });
}

const value = (name) => form.elements.namedItem(name)?.value ?? "";

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const token = generation.begin();
  activeGeneration = token;
  discardPrepared();
  download.hidden = true;
  status.textContent =
    "Checking exact MP3 bytes, duration, rights and SHA-256 hashes…";
  form.querySelector("button").disabled = true;
  try {
    const metadata = {
      source: value("source"),
      license: value("license"),
      artist: value("artist"),
      styles: value("styles").split(","),
      collections: value("collections").split(","),
      batchId: value("batchId"),
      batchTitle: value("batchTitle"),
      description: value("description"),
      attribution: value("attribution"),
      rightsEvidence: value("rightsEvidence"),
      derivativeNotice: value("derivativeNotice"),
      confirmRights: form.elements.namedItem("confirmRights").checked,
    };
    const prepared = await createIntakePackage(selectedFiles(), metadata, {
      probe: probeDuration,
      isCurrent: () => generation.isCurrent(token),
    });
    if (!generation.isCurrent(token)) return;
    preparedURL = URL.createObjectURL(prepared.blob);
    const name =
      prepared.manifest.metadata.batchId || "revealline-soundtrack-intake";
    download.href = preparedURL;
    download.download = `${name}.rlintake`;
    download.hidden = false;
    status.textContent = `${prepared.manifest.tracks.length} MP3 file${prepared.manifest.tracks.length === 1 ? "" : "s"} verified. Download the intake package; it contains the exact audio and rights metadata.`;
    download.focus();
  } catch (error) {
    if (generation.isCurrent(token)) status.textContent = error.message;
  } finally {
    if (activeGeneration === token) {
      activeGeneration = null;
      form.querySelector("button").disabled = false;
    }
  }
});

window.addEventListener("pagehide", () => {
  discardPrepared();
});
