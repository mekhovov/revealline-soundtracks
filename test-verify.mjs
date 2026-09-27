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
  for (const recording of catalogue.tracks) {
    assert.ok(recording.title.trim(), `${recording.id} has a title`);
    assert.ok(recording.artist.trim(), `${recording.id} has an artist`);
    assert.ok(recording.collections.length, `${recording.id} has a collection`);
    assert.ok(recording.tags.length, `${recording.id} has searchable tags`);
  }
});

test("archive player exposes metadata filters and keeps direct downloads hidden", async () => {
  const player = await readFile("player.mjs", "utf8");
  assert.match(player, /facet\(track\.artist, searchFor/);
  assert.match(player, /facet\(name, showOnlyCollection/);
  assert.match(player, /facet\(tag, style \? showOnlyStyle : searchFor/);
  assert.match(player, /download\.hidden = true/);
  assert.doesNotMatch(player, /Try Next or download its MP3/);
});

test("deployment manifest is reproduced from the explicit public files", async () => {
  const expected = await buildManifest();
  const committed = JSON.parse(
    await readFile("deployment-manifest.json", "utf8"),
  );
  assert.deepEqual(committed, expected);
});
