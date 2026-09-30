const LICENSES = new Map([
  ["https://creativecommons.org/publicdomain/zero/1.0/", ["CC0", "1.0"]],
  ["https://creativecommons.org/licenses/by/3.0/", ["CC-BY", "3.0"]],
  ["https://creativecommons.org/licenses/by/4.0/", ["CC-BY", "4.0"]],
  ["https://creativecommons.org/licenses/by-sa/3.0/", ["CC-BY-SA", "3.0"]],
  ["https://creativecommons.org/licenses/by-sa/4.0/", ["CC-BY-SA", "4.0"]],
]);

// An uploader assertion or an old catalogue label cannot supply a known licence.
export function hasPublishedLicense(track) {
  const identity = LICENSES.get(track?.licenseURL);
  return Boolean(
    identity && typeof track.license === "string" && track.license.trim() &&
    !/unknown|unlicensed|missing/i.test(track.license) &&
    track.rights?.licenseId === identity[0] &&
    track.rights?.licenseVersion === identity[1] &&
    track.rights?.licenseURL === track.licenseURL,
  );
}

export function projectCatalogue(catalogue, allowedHashes = null) {
  const tracks = catalogue.tracks.filter((track) => allowedHashes
    ? allowedHashes.has(track.audio?.sha256)
    : hasPublishedLicense(track));
  const removedArchives = new Set(catalogue.tracks.filter((track) => !tracks.includes(track))
    .map((track) => track.archiveId));
  const keptArchives = new Set(tracks.map((track) => track.archiveId));
  return {
    ...catalogue,
    ...(catalogue.sources ? { sources: catalogue.sources.filter((source) =>
      !removedArchives.has(source.id) || keptArchives.has(source.id)) } : {}),
    counts: {
      ...catalogue.counts,
      declaredTracks: tracks.length,
      uniqueRecordings: tracks.length,
      duplicateAliases: 0,
      audioBytes: tracks.reduce((sum, track) => sum + track.audio.bytes, 0),
    },
    tracks,
  };
}

export function publicVolumeTags(catalogue, volumes) {
  const allowed = new Set(catalogue.tracks.filter(hasPublishedLicense)
    .map((track) => track.audio.sha256));
  return new Set(volumes.volumes.filter((volume) =>
    volume.assets.length > 0 && volume.assets.every((asset) => allowed.has(asset.sha256)))
    .map((volume) => volume.releaseTag));
}
