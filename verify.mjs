import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { copyFile, lstat, mkdir, readFile, rm, statfs, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyExternalDeliveryMetadata } from './intake/external-url.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const HASH = /^[a-f0-9]{64}$/;
const AUDIO_URL = /^https:\/\/github\.com\/mekhovov\/revealline-soundtracks\/releases\/download\/(audio-[a-z0-9-]+)\/([a-f0-9]{64})\.mp3$/;
const PAGES_AUDIO = /^objects\/([a-f0-9]{64})\.mp3$/;
const LICENSES = new Map([
  ['https://creativecommons.org/publicdomain/zero/1.0/', { id: 'CC0', version: '1.0', shareAlike: false }],
  ['https://creativecommons.org/licenses/by/3.0/', { id: 'CC-BY', version: '3.0', shareAlike: false }],
  ['https://creativecommons.org/licenses/by/4.0/', { id: 'CC-BY', version: '4.0', shareAlike: false }],
  ['https://creativecommons.org/licenses/by-sa/3.0/', { id: 'CC-BY-SA', version: '3.0', shareAlike: true }],
  ['https://creativecommons.org/licenses/by-sa/4.0/', { id: 'CC-BY-SA', version: '4.0', shareAlike: true }],
]);
const CORRECTED_UNKNOWN_RIGHTS = new Set([
  'trench-orderly.soundtrack', 'trench-orderly.drones-hunter',
  'trench-orderly.vampire', 'trench-orderly.soundtrack.2',
  'trench-orderly.soundtrack.3', 'trench-orderly.soundtrack.4',
  'trench-orderly.soundtrack.5',
]);
const TRENCH_ORDERLY_SOURCE = 'https://www.youtube.com/@TRENCH_ORDERLY';
const LEGACY_IDENTITY_FIELDS = [
  'title', 'artist', 'durationSeconds', 'tags', 'source', 'fileName', 'archiveId',
  'collection', 'status', 'listeningApproval', 'gameCatalogueAdmission', 'contentId',
  'recordingModeEligible', 'default', 'aliases',
];
const ROOT_STATIC_FILES = [
  '.nojekyll', 'CREDITS.md', 'README.md', 'UPLOAD_GUIDE.md', 'audio-volumes.json',
  'batches.json', 'catalogue.json', 'external-deliveries.json', 'filter-url.mjs', 'index.html',
  'intake-browser.mjs', 'intake/external-url.mjs', 'intake/package.mjs',
  'inventory.json', 'legacy/README.md', 'legacy/archive-01/CREDITS.md',
  'legacy/archive-01/README.md', 'legacy/archive-01/catalogue.json',
  'legacy/archive-01/deployment-manifest.json',
  'legacy/archive-01/inventory.json', 'legacy/archive-01/preview-catalogue.json',
  'legacy/archive-01/release/CREDITS.md', 'legacy/archive-01/release/SHA256SUMS',
  'legacy/archive-01/release/assets.json',
  'legacy/archive-01/release/preview-catalogue.json',
  'legacy/archive-01/release/public-albums.json',
  'legacy/archive-02/CREDITS.md', 'legacy/archive-02/README.md',
  'legacy/archive-02/UPLOAD_GUIDE.md', 'legacy/archive-02/batches.json',
  'legacy/archive-02/catalogue.json', 'legacy/archive-02/deployment-manifest.json',
  'playback-policy.mjs', 'player.mjs', 'review-policy.mjs', 'style.css', 'upload-guide/index.html',
  'playback-recovery.mjs',
];
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const demand = (value, message) => { if (!value) throw new Error(message); };
const safeHTTPS = (value) => {
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password; }
  catch { return false; }
};
async function ordinaryFile(base, relative) {
  const absolute = path.join(base, relative), stat = await lstat(absolute);
  demand(stat.isFile() && !stat.isSymbolicLink(), `Public file is not ordinary: ${relative}`);
  return { absolute, bytes: stat.size };
}
async function exactFile(base, entry) {
  const file = await ordinaryFile(base, entry.path), bytes = await readFile(file.absolute);
  demand(file.bytes === entry.bytes, `Byte count differs: ${entry.path}`);
  demand(digest(bytes) === entry.sha256, `SHA-256 differs: ${entry.path}`);
}
function verifyRights(track) {
  demand(safeHTTPS(track.source) && safeHTTPS(track.rights?.rightsEvidenceURL), `Rights evidence differs: ${track.id}`);
  demand(track.credit === track.rights?.attribution, `Attribution differs: ${track.id}`);
  if (track.licenseURL === null) {
    demand(track.license === 'Unknown — uploader-confirmed rights' && track.rights?.licenseId === 'UNKNOWN' && track.rights?.licenseVersion === null && track.rights?.licenseURL === null && track.rights?.permissionBasis === 'uploader-confirmed-public-redistribution-and-web-playback' && track.rights?.shareAlike?.required === null && track.recordingModeEligible === false, `Unknown-rights policy differs: ${track.id}`);
    return;
  }
  const licence = LICENSES.get(track.licenseURL);
  demand(licence && track.rights?.licenseURL === track.licenseURL, `Rights identity differs: ${track.id}`);
  demand(track.rights?.licenseId === licence.id && track.rights?.licenseVersion === licence.version && track.rights?.shareAlike?.required === licence.shareAlike, `Rights policy differs: ${track.id}`);
}
async function verifyLegacyUnion(catalogue, base) {
  const sources = [
    JSON.parse(await readFile(path.join(base, 'legacy/archive-01/catalogue.json'), 'utf8')),
    JSON.parse(await readFile(path.join(base, 'legacy/archive-02/catalogue.json'), 'utf8')),
  ];
  demand(sources.every(({ tracks }) => Array.isArray(tracks)) && sources[0].tracks.length === 163 && sources[1].tracks.length === 31, 'Legacy catalogue evidence differs.');
  const canonical = new Map(catalogue.tracks.map((track) => [track.id, track]));
  const mappedIds = new Set(), hashes = new Set(); let tracks = 0, audioBytes = 0;
  for (const source of sources) {
    for (const legacy of source.tracks) {
      let id = legacy.id;
      if (mappedIds.has(id)) id = `${id}.${legacy.audio.sha256.slice(0, 8)}`;
      demand(!mappedIds.has(id), `Legacy migration identity collides: ${id}`); mappedIds.add(id);
      const migrated = canonical.get(id);
      demand(migrated, `Legacy recording is missing from canonical catalogue: ${id}`);
      for (const field of LEGACY_IDENTITY_FIELDS) {
        if (field === 'source' && CORRECTED_UNKNOWN_RIGHTS.has(id)) {
          demand(migrated.source === TRENCH_ORDERLY_SOURCE, `Corrected creator source differs: ${id}`);
        } else demand(JSON.stringify(migrated[field]) === JSON.stringify(legacy[field]), `Legacy recording metadata differs: ${id}.${field}`);
      }
      demand(migrated.audio?.bytes === legacy.audio?.bytes && migrated.audio?.sha256 === legacy.audio?.sha256, `Legacy recording bytes differ: ${id}`);
      if (CORRECTED_UNKNOWN_RIGHTS.has(id)) {
        demand(legacy.license === 'CC0 1.0 Universal' && migrated.license === 'Unknown — uploader-confirmed rights' && migrated.licenseURL === null && migrated.credit === migrated.rights?.attribution, `Legacy rights correction differs: ${id}`);
      } else demand(migrated.license === legacy.license && migrated.licenseURL === legacy.licenseURL && migrated.credit === legacy.credit, `Legacy recording rights differ: ${id}`);
      demand(!hashes.has(legacy.audio.sha256), `Legacy audio hash collides: ${id}`);
      hashes.add(legacy.audio.sha256); audioBytes += legacy.audio.bytes; tracks += 1;
    }
  }
  demand(tracks === 194 && mappedIds.size === 194, 'Legacy union size differs.');
  demand(hashes.size === 194 && audioBytes <= catalogue.counts?.audioBytes, 'Legacy audio preservation differs.');
  return { tracks, audioBytes };
}
export async function buildManifest(base = root) {
  const files = [];
  const inventory = JSON.parse(await readFile(path.join(base, 'inventory.json'), 'utf8'));
  const catalogue = JSON.parse(await readFile(path.join(base, 'catalogue.json'), 'utf8'));
  const pagesAudio = catalogue.tracks
    .map((track) => track.audio?.path)
    .filter((relative) => PAGES_AUDIO.test(relative));
  const publicFiles = [
    ...new Set([
      ...ROOT_STATIC_FILES,
      ...inventory.files.map(({ path: relative }) => relative),
      ...pagesAudio,
    ]),
  ];
  for (const relative of publicFiles) {
    const file = await ordinaryFile(base, relative), bytes = await readFile(file.absolute);
    files.push({ path: relative, bytes: file.bytes, sha256: digest(bytes) });
  }
  return { format: 'revealline-soundtrack-catalogue-deployment.v2', archiveId: 'revealline-soundtracks', files: files.sort((a,b)=>a.path.localeCompare(b.path)) };
}
export async function verifyArchive(base = root) {
  const catalogueBytes = await readFile(path.join(base, 'catalogue.json'));
  demand(catalogueBytes.length <= 1024 * 1024, 'Catalogue exceeds its byte limit.');
  const catalogue = JSON.parse(catalogueBytes);
  demand(catalogue.format === 'revealline-public-soundtrack-catalogue.v1', 'Catalogue format differs.');
  demand(catalogue.archive?.id === 'revealline-soundtracks' && catalogue.archive?.baseURL === 'https://mekhovov.github.io/revealline-soundtracks/', 'Archive identity differs.');
  demand(Array.isArray(catalogue.tracks) && catalogue.tracks.length <= 512, 'Catalogue track limit exceeded.');
  const volumes = JSON.parse(await readFile(path.join(base, 'audio-volumes.json'), 'utf8'));
  demand(volumes.format === 'revealline-soundtrack-audio-volumes.v1' && Array.isArray(volumes.volumes), 'Audio volumes differ.');
  const volumeAssets = new Map();
  for (const volume of volumes.volumes) {
    demand(/^audio-[a-z0-9-]+$/.test(volume.releaseTag) && Array.isArray(volume.assets) && volume.assets.length <= 1000, 'Audio volume identity differs.');
    for (const asset of volume.assets) {
      demand(HASH.test(asset.sha256) && Number.isSafeInteger(asset.bytes) && asset.bytes > 0, 'Audio volume asset differs.');
      demand(!volumeAssets.has(asset.sha256), 'Audio volume hashes must be unique.');
      volumeAssets.set(asset.sha256, { bytes: asset.bytes, tag: volume.releaseTag });
    }
  }
  const externalInventory = JSON.parse(await readFile(path.join(base, 'external-deliveries.json'), 'utf8'));
  demand(externalInventory.format === 'revealline-external-audio-deliveries.v1' && Array.isArray(externalInventory.recordings), 'External delivery inventory differs.');
  const externalById = new Map();
  for (const entry of externalInventory.recordings) {
    demand(typeof entry.id === 'string' && !externalById.has(entry.id) && typeof entry.host === 'string' && entry.host === new URL(entry.url).host && Number.isSafeInteger(entry.bytes) && entry.bytes > 0 && HASH.test(entry.sha256), 'External delivery inventory entry differs.');
    externalById.set(entry.id, entry);
  }
  demand(
    externalInventory.recordings
      .map((entry) => entry.id)
      .every((id, index, ids) => index === 0 || ids[index - 1].localeCompare(id) < 0),
    'External delivery inventory order differs.',
  );
  const ids = new Set(), hashes = new Set(); let audioBytes = 0;
  for (const track of catalogue.tracks) {
    demand(typeof track.id === 'string' && track.id && !ids.has(track.id), 'Track identity differs.'); ids.add(track.id);
    demand(typeof track.title === 'string' && track.title.trim() === track.title && track.title.length > 0, `Track title differs: ${track.id}`);
    demand(typeof track.artist === 'string' && track.artist.trim() === track.artist && track.artist.length > 0, `Track artist differs: ${track.id}`);
    demand(Array.isArray(track.tags) && track.tags.length > 0 && track.tags.length <= 32 && track.tags.every((tag) => typeof tag === 'string' && tag.trim() === tag && tag.length > 0), `Track tags differ: ${track.id}`);
    demand(Array.isArray(track.collections) && track.collections.length > 0 && track.collections.length <= 16 && new Set(track.collections).size === track.collections.length, `Collections differ: ${track.id}`);
    demand(track.visibility === undefined || track.visibility === 'review-only', `Visibility differs: ${track.id}`);
    const reviewCollections = ['Base Game Review', 'Heavy Metal Review', 'Soundtrack Review'];
    if (track.visibility === 'review-only') {
      demand(
        track.collections.some((name) => reviewCollections.includes(name)) &&
          !track.collections.includes('Base Game Playlist'),
        `Review collection differs: ${track.id}`,
      );
    } else
      demand(
        !track.collections.some((name) => reviewCollections.includes(name)),
        `Public review boundary differs: ${track.id}`,
      );
    demand(track.gameCatalogueAdmission === false && track.default !== true, `Admission boundary differs: ${track.id}`);
    verifyRights(track);
    const match = AUDIO_URL.exec(track.audio?.path ?? ''),
      pages = PAGES_AUDIO.exec(track.audio?.path ?? ''),
      asset = volumeAssets.get(track.audio?.sha256);
    if (track.audio?.delivery?.type === 'external-url') {
      const url = verifyExternalDeliveryMetadata(track.audio), entry = externalById.get(track.id);
      demand(entry && entry.url === url.href && entry.host === url.host && entry.bytes === track.audio.bytes && entry.sha256 === track.audio.sha256 && entry.verifiedAt === track.audio.delivery.verifiedAt && !asset, `External audio identity differs: ${track.id}`);
    } else if (pages) {
      demand(
        pages[1] === track.audio.sha256 && asset?.bytes === track.audio.bytes,
        `Pages audio identity differs: ${track.id}`,
      );
      await exactFile(base, {
        path: track.audio.path,
        bytes: track.audio.bytes,
        sha256: track.audio.sha256,
      });
    } else
      demand(
        match &&
          match[2] === track.audio.sha256 &&
          asset?.tag === match[1] &&
          asset?.bytes === track.audio.bytes,
        `Audio identity differs: ${track.id}`,
      );
    demand(!hashes.has(track.audio.sha256), `Audio hash collides: ${track.id}`);
    hashes.add(track.audio.sha256); audioBytes += track.audio.bytes;
  }
  demand(hashes.size === volumeAssets.size + externalById.size && externalById.size === catalogue.tracks.filter((track) => track.audio?.delivery?.type === 'external-url').length, 'Audio delivery inventories and catalogue differ.');
  const inventory = JSON.parse(await readFile(path.join(base, 'inventory.json'), 'utf8'));
  demand(
    inventory.format === 'revealline-soundtrack-archive.v1' &&
      inventory.id === 'licensed-preview-01' &&
      Array.isArray(inventory.files) &&
      inventory.files.length === 70,
    'Legacy compatibility inventory differs.',
  );
  const compatibilityHashes = new Set();
  for (const file of inventory.files) {
    demand(
      HASH.test(file.sha256) &&
        file.path === `objects/${file.sha256}.mp3` &&
        Number.isSafeInteger(file.bytes) &&
        file.bytes > 0 &&
        !compatibilityHashes.has(file.sha256) &&
        hashes.has(file.sha256),
      'Legacy compatibility object differs.',
    );
    compatibilityHashes.add(file.sha256);
    await exactFile(base, file);
  }
  const legacyRelease = JSON.parse(
    await readFile(path.join(base, 'legacy/archive-01/release/assets.json'), 'utf8'),
  );
  demand(
    legacyRelease.sourceRepository ===
      'https://github.com/mekhovov/revealline-soundtracks-01' &&
      legacyRelease.sourceTag === 'preview-playlists-2026-09-21' &&
      legacyRelease.immutableSource === true &&
      Array.isArray(legacyRelease.assets) &&
      legacyRelease.assets.length === 19 &&
      legacyRelease.assets.filter(({ name }) => name.endsWith('.rlsound')).length === 15,
    'Legacy release inventory differs.',
  );
  const legacyReleaseNames = new Set();
  for (const asset of legacyRelease.assets) {
    demand(
      typeof asset.name === 'string' &&
        asset.name.length > 0 &&
        !legacyReleaseNames.has(asset.name) &&
        Number.isSafeInteger(asset.size) &&
        asset.size > 0 &&
        /^sha256:[a-f0-9]{64}$/.test(asset.digest) &&
        asset.url ===
          `https://github.com/mekhovov/revealline-soundtracks-01/releases/download/preview-playlists-2026-09-21/${asset.name}`,
      'Legacy release asset evidence differs.',
    );
    legacyReleaseNames.add(asset.name);
  }
  const legacyUnion = await verifyLegacyUnion(catalogue, base);
  demand(catalogue.counts?.declaredTracks === catalogue.tracks.length && catalogue.counts?.uniqueRecordings === catalogue.tracks.length && catalogue.counts?.duplicateAliases === 0 && catalogue.counts?.audioBytes === audioBytes, 'Catalogue counts differ.');
  const expected = await buildManifest(base), manifest = JSON.parse(await readFile(path.join(base, 'deployment-manifest.json'), 'utf8'));
  demand(JSON.stringify(manifest) === JSON.stringify(expected), 'Deployment manifest is stale.');
  for (const entry of manifest.files) await exactFile(base, entry);
  return { tracks: catalogue.tracks.length, compatibilityTracks: compatibilityHashes.size, legacyUnionTracks: legacyUnion.tracks, legacyUnionBytes: legacyUnion.audioBytes, audioBytes, publicBytes: manifest.files.reduce((sum,file)=>sum+file.bytes,0), manifest };
}
export async function stageArchive(destination, base = root) {
  const verified = await verifyArchive(base), target = path.resolve(destination);
  demand(target !== path.resolve(base), 'Staging destination must differ from the repository.');
  const disk = await statfs(path.dirname(target));
  demand(disk.bavail * disk.bsize >= 1024 ** 3 + verified.publicBytes, 'Staging must leave at least 1 GiB free.');
  await rm(target, { recursive: true, force: true }); await mkdir(target, { recursive: true });
  for (const entry of verified.manifest.files) { const output = path.join(target, entry.path); await mkdir(path.dirname(output), { recursive: true }); await copyFile(path.join(base, entry.path), output, constants.COPYFILE_EXCL); }
  await copyFile(path.join(base, 'deployment-manifest.json'), path.join(target, 'deployment-manifest.json'));
  return verifyArchive(target);
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args[0] === '--write-manifest' && args.length === 1) await writeFile(path.join(root, 'deployment-manifest.json'), `${JSON.stringify(await buildManifest(), null, 2)}\n`);
  else if (args[0] === '--stage' && args[1] && args.length === 2) console.log(JSON.stringify(await stageArchive(args[1]), null, 2));
  else if (args.length === 0) console.log(JSON.stringify(await verifyArchive(), null, 2));
  else throw new Error('Usage: node verify.mjs [--write-manifest|--stage DIRECTORY]');
}
