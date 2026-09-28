import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildManifest, verifyArchive } from "./verify.mjs";

test("canonical archive preserves migrated identities and release-backed audio", async () => {
  const result = await verifyArchive();
  assert.ok(result.tracks >= 1);
  assert.equal(result.compatibilityTracks, 70);
  assert.equal(result.legacyUnionTracks, 194);
  assert.equal(result.legacyUnionBytes, 1_032_879_700);
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
  assert.match(
    track.audio.path,
    /github\.com\/mekhovov\/revealline-soundtracks\/releases\/download/,
  );
  const trench = catalogue.tracks.find(
    ({ id }) => id === "trench-orderly.soundtrack.2",
  );
  assert.deepEqual(trench.collections, ["TRENCH ORDERLY", "ФПВ"]);
  assert.equal(trench.source, "https://www.youtube.com/@TRENCH_ORDERLY");
  assert.equal(
    trench.rights.rightsEvidenceURL,
    "https://www.youtube.com/@TRENCH_ORDERLY",
  );
  assert.equal(trench.licenseURL, null);
  assert.equal(trench.rights.licenseId, "UNKNOWN");
  assert.equal(
    trench.audio.path,
    `objects/${trench.audio.sha256}.mp3`,
  );
  const duplicate = catalogue.tracks.find(
    ({ id }) => id === "peachtea.last-stand-lets-go.ee3bed8e",
  );
  assert.equal(
    duplicate.audio.sha256,
    "ee3bed8e7c91ab050ccd32bd469646153ffb6ead81d2d19f945c8384eb9cb99e",
  );
  for (const recording of catalogue.tracks) {
    assert.ok(recording.title.trim(), `${recording.id} has a title`);
    assert.ok(recording.artist.trim(), `${recording.id} has an artist`);
    assert.ok(recording.collections.length, `${recording.id} has a collection`);
    assert.ok(recording.tags.length, `${recording.id} has searchable tags`);
  }
});

test("legacy archive compatibility objects remain exact canonical catalogue members", async () => {
  const inventory = JSON.parse(await readFile("inventory.json", "utf8"));
  const catalogue = JSON.parse(await readFile("catalogue.json", "utf8"));
  const canonicalHashes = new Set(
    catalogue.tracks.map(({ audio }) => audio.sha256),
  );
  assert.equal(inventory.id, "licensed-preview-01");
  assert.equal(inventory.files.length, 70);
  for (const file of inventory.files) {
    assert.equal(file.path, `objects/${file.sha256}.mp3`);
    assert.ok(canonicalHashes.has(file.sha256));
  }
  const baseGame = catalogue.tracks.filter(({ collections }) =>
    collections.includes("Base Game Playlist"),
  );
  const review = catalogue.tracks.filter(
    ({ visibility }) => visibility === "review-only",
  );
  const baseGameReview = review.filter(({ collections }) =>
    collections.includes("Base Game Review"),
  );
  const soundtrackReview = review.filter(({ collections }) =>
    collections.includes("Soundtrack Review"),
  );
  const preservedFoundation = [...baseGame, ...baseGameReview];
  assert.equal(baseGame.length, 33);
  assert.equal(baseGameReview.length, 37);
  assert.equal(soundtrackReview.length, 21);
  assert.equal(review.length, 58);
  assert.equal(
    baseGameReview.filter(({ collections }) =>
      collections.includes("Heavy Metal Review"),
    ).length,
    6,
  );
  assert.deepEqual(
    new Set(soundtrackReview.map(({ id }) => id)),
    new Set([
      "vitalezzz.curse-of-the-moon",
      "vitalezzz.realm-of-torment",
      "vitalezzz.shadows-awaken-within",
      "vitalezzz.unholy-surge",
      "ragnar-random.street-punks-fighting-to-save-the-princess",
      "ragnar-random.rock-city-ransom",
      "ragnar-random.nario-versus-zonik",
      "ragnar-random.welcome-to-warp-zone",
      "ragnar-random.here-a-captive-heart-busted",
      "ragnar-random.the-story-so-far-fm",
      "ragnar-random.savage-circuitboard",
      "davidkbd.desolation",
      "dos88.crash-landing",
      "dos88.race-to-mars",
      "dos88.automata-v2",
      "dos88.city-stomper",
      "escp.twilight-city",
      "alexander-nakarada.trial-of-thorns",
      "alexander-nakarada.riffs-two",
      "alexandr-zhelanov.soul-ripper",
      "zane-little-music.achilles",
    ]),
  );
  assert.equal(
    catalogue.tracks.some(({ collections }) =>
      collections.some((name) => name.startsWith("Foundation")),
    ),
    false,
  );
  assert.deepEqual(
    new Set(preservedFoundation.map(({ audio }) => audio.sha256)),
    new Set(inventory.files.map(({ sha256 }) => sha256)),
  );
});

test("archive player exposes metadata filters and keeps direct downloads hidden", async () => {
  const player = await readFile("player.mjs", "utf8");
  assert.match(player, /facet\(track\.artist, searchFor/);
  assert.match(player, /facet\(name, showOnlyCollection/);
  assert.match(player, /facet\(tag, style \? showOnlyStyle : searchFor/);
  assert.match(player, /download\.hidden = true/);
  assert.doesNotMatch(player, /Try Next or download its MP3/);
  assert.match(player, /FOUNDATION_COLLECTION = "Base Game Playlist"/);
  assert.match(player, /tracksForView\(catalogue\.tracks, requestedReview\)/);
  const page = await readFile("index.html", "utf8");
  assert.match(page, /id="play-foundation"/);
  assert.match(page, /Play Base Game Playlist/);
  assert.match(page, /id="review-notice"/);
});

test("deployment manifest is reproduced from the explicit public files", async () => {
  const expected = await buildManifest();
  const committed = JSON.parse(
    await readFile("deployment-manifest.json", "utf8"),
  );
  assert.deepEqual(committed, expected);
});
