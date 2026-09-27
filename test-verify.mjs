import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildManifest, verifyArchive } from "./verify.mjs";

test("canonical archive preserves migrated identities and release-backed audio", async () => {
  const result = await verifyArchive();
  assert.ok(result.tracks >= 1);
  assert.ok(result.audioBytes >= 3_884_999);
  const catalogue = JSON.parse(await readFile("catalogue.json", "utf8"));
  const track = catalogue.tracks.find(({ id }) => id === "wekont.runner2088");
  assert.ok(track);
  assert.equal(track.id, "wekont.runner2088");
  assert.equal(track.listeningApproval, "not-reviewed");
  assert.equal(track.gameCatalogueAdmission, false);
  assert.equal(track.default, false);
  assert.equal(track.recordingModeEligible, false);
  assert.equal(
    track.audio.sha256,
    "9924c6163116b0db94cc0c1878542d2576aac02051dd25f6ebb3b9767869cef9",
  );
  assert.match(track.audio.path, /github\.com\/mekhovov\/revealline-soundtracks\/releases\/download/);
  const trench = catalogue.tracks.find(({ id }) => id === "trench-orderly.soundtrack.2");
  assert.deepEqual(trench.collections, ["TRENCH ORDERLY", "ФПВ"]);
  assert.equal(trench.licenseURL, null);
  assert.equal(trench.rights.licenseId, "UNKNOWN");
});

test("deployment manifest is reproduced from the explicit public files", async () => {
  const expected = await buildManifest();
  const committed = JSON.parse(
    await readFile("deployment-manifest.json", "utf8"),
  );
  assert.deepEqual(committed, expected);
});
