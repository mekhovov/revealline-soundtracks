import assert from "node:assert/strict";
import { readFile, mkdtemp, mkdir, copyFile, writeFile, rm } from "node:fs/promises";
import { createHash } from "node:crypto";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { hasPublishedLicense, projectCatalogue, publicVolumeTags } from "./licensing-policy.mjs";
import { tracksForView, REVIEW_ACCESS_KEY } from "./review-policy.mjs";
import { buildManifest, publicDocuments } from "./verify.mjs";

const readJSON = async (name) => JSON.parse(await readFile(name, "utf8"));
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");

test("missing, unknown and inconsistent licences cannot enter either player view", async () => {
  const catalogue = await readJSON("catalogue.json");
  const known = catalogue.tracks.find(hasPublishedLicense);
  assert.equal(hasPublishedLicense(known), true);
  for (const mutation of [
    { license: undefined }, { license: "" }, { license: "Unknown" },
    { licenseURL: undefined }, { licenseURL: null }, { licenseURL: "https://example.com/unknown" },
    { rights: undefined }, { rights: { ...known.rights, licenseId: "UNKNOWN" } },
    { rights: { ...known.rights, licenseVersion: "9" } },
    { rights: { ...known.rights, licenseURL: null } },
  ]) {
    const candidate = { ...known, ...mutation };
    assert.equal(hasPublishedLicense(candidate), false);
    assert.deepEqual(tracksForView([candidate]), []);
    assert.deepEqual(tracksForView([{ ...candidate, visibility: "review-only" }], REVIEW_ACCESS_KEY), []);
  }
});

test("public projection removes quarantined identities and keeps licensed review intact", async () => {
  const source = await readJSON("catalogue.json");
  const before = structuredClone(source);
  const projected = projectCatalogue(source);
  const excluded = source.tracks.filter((track) => !hasPublishedLicense(track));
  assert.ok(source.tracks.length >= 261);
  assert.ok(excluded.length >= 73);
  assert.ok(excluded.reduce((sum, track) => sum + track.audio.bytes, 0) >= 207941311);
  assert.equal(projected.tracks.length, source.tracks.length - excluded.length);
  assert.equal(tracksForView(source.tracks).length, projected.tracks.length - 65);
  assert.equal(tracksForView(source.tracks, REVIEW_ACCESS_KEY).length, 65);
  assert.deepEqual(projectCatalogue(projected), projected);
  assert.deepEqual(source, before);
  const future = structuredClone(excluded[0]);
  future.id = "future.unknown-intake";
  future.audio.sha256 = "e".repeat(64);
  assert.deepEqual(projectCatalogue({ ...source, tracks: [...source.tracks, future] }), projected);
  const publicIds = new Set(projected.tracks.map((track) => track.id));
  for (const track of excluded) {
    assert.ok(!publicIds.has(track.id));
    assert.ok(!tracksForView(source.tracks, REVIEW_ACCESS_KEY).some(({ id }) => id === track.id));
  }
});

test("Pages JSON, legacy labels and manifests cannot re-expose quarantined audio", async () => {
  const source = await readJSON("catalogue.json");
  const excluded = source.tracks.filter((track) => !hasPublishedLicense(track));
  const excludedIds = new Set(excluded.map((track) => track.id));
  const excludedHashes = new Set(excluded.map((track) => track.audio.sha256));
  const documents = await publicDocuments();
  const manifest = await buildManifest();
  assert.ok(!manifest.files.some(({ path }) => path === "legacy/archive-02/deployment-manifest.json"));
  for (const file of manifest.files) {
    assert.ok(!excludedHashes.has(file.sha256), file.path);
    if (!/\.(json|md)$/.test(file.path)) continue;
    const bytes = documents.get(file.path) ?? await readFile(file.path);
    const text = bytes.toString();
    for (const sha256 of excludedHashes) assert.ok(!text.includes(sha256), `${file.path}: ${sha256}`);
  }
  const legacySource = await readJSON("legacy/archive-02/catalogue.json");
  const obsoleteCC0 = legacySource.tracks.filter((track) => excludedHashes.has(track.audio.sha256));
  assert.equal(obsoleteCC0.length, 7);
  assert.ok(obsoleteCC0.every((track) => track.license === "CC0 1.0 Universal"));
  const legacyPublic = JSON.parse(documents.get("legacy/archive-02/catalogue.json"));
  assert.equal(legacyPublic.tracks.length, 24);
  assert.ok(legacyPublic.tracks.every((track) => !excludedIds.has(track.id)));
  const legacyBatches = JSON.parse(documents.get("legacy/archive-02/batches.json"));
  assert.ok(!legacyBatches.batches.some((entry) => entry.id === "trench-orderly-20260927"));
  assert.equal(legacyBatches.batches.reduce((sum, entry) => sum + entry.tracks, 0), legacyPublic.tracks.length);
  for (const file of manifest.files) {
    const bytes = documents.get(file.path);
    if (bytes) assert.deepEqual({ bytes: bytes.length, sha256: hash(bytes) },
      { bytes: file.bytes, sha256: file.sha256 });
  }
});

test("all 70 legacy installer identities and pinned documents stay byte-identical", async () => {
  const documents = await publicDocuments();
  const manifest = await buildManifest();
  const files = new Map(manifest.files.map((file) => [file.path, file]));
  const inventory = await readJSON("inventory.json");
  const catalogue = projectCatalogue(await readJSON("catalogue.json"));
  const hashes = new Set(catalogue.tracks.map((track) => track.audio.sha256));
  assert.equal(inventory.files.length, 70);
  for (const file of inventory.files) {
    assert.ok(hashes.has(file.sha256));
    assert.deepEqual(files.get(file.path), file);
  }
  for (const name of [
    "inventory.json", "legacy/archive-01/inventory.json",
    "legacy/archive-01/preview-catalogue.json",
    "legacy/archive-01/release/preview-catalogue.json",
    "legacy/archive-01/release/public-albums.json",
    "legacy/archive-01/release/assets.json",
    "admissions/approved-synth-metal-20260930.json",
    "admissions/metal-next-20260930.json",
  ]) {
    const bytes = await readFile(name);
    assert.ok(!documents.has(name), `${name} must not be transformed`);
    assert.deepEqual(files.get(name), { path: name, bytes: bytes.length, sha256: hash(bytes) });
  }
});

test("projected metadata rebuilds the exact deployment manifest without source-only records", async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "soundtrack-projection-test-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const documents = await publicDocuments();
  const expected = await buildManifest();
  for (const file of expected.files) {
    if (file.path.endsWith(".mp3")) continue;
    const destination = path.join(directory, file.path);
    await mkdir(path.dirname(destination), { recursive: true });
    if (documents.has(file.path)) await writeFile(destination, documents.get(file.path));
    else await copyFile(file.path, destination);
  }
  // Historical manifest is source-only, so publicDocuments must not require it.
  assert.deepEqual(await buildManifest(directory), expected);
});

test("merge publication skips unknown-only and mixed audio volumes without deleting them", async () => {
  const catalogue = await readJSON("catalogue.json");
  const known = catalogue.tracks.find(hasPublishedLicense);
  const unknown = catalogue.tracks.find((track) => !hasPublishedLicense(track));
  const volume = (releaseTag, tracks) => ({ releaseTag, assets: tracks.map(({ audio }) => audio) });
  const volumes = { volumes: [volume("known", [known]), volume("unknown", [unknown]), volume("mixed", [known, unknown])] };
  const before = structuredClone(volumes);
  assert.deepEqual([...publicVolumeTags(catalogue, volumes)], ["known"]);
  assert.deepEqual(volumes, before);
});
