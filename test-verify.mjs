import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { tracksForView } from "./review-policy.mjs";
import { hasPublishedLicense } from "./licensing-policy.mjs";
import {
  buildManifest,
  releaseAssetBytes,
  verifyArchive,
  verifyApprovedInventory,
  verifyRunner2088Inventory,
  verifyMetalNextInventory,
} from "./verify.mjs";

test("canonical archive preserves migrated identities and release-backed audio", async () => {
  const result = await verifyArchive();
  assert.ok(result.tracks >= 1);
  assert.equal(result.compatibilityTracks, 70);
  assert.equal(result.legacyUnionTracks, 187);
  assert.equal(result.legacyUnionBytes, 1_013_415_138);
  assert.ok(result.audioBytes >= 3_884_999);
  const catalogue = JSON.parse(await readFile("catalogue.json", "utf8"));
  const track = catalogue.tracks.find(({ id }) => id === "wekont.runner2088");
  assert.ok(track);
  assert.equal(track.id, "wekont.runner2088");
  assert.equal(track.listeningApproval, "owner-approved-2026-09-29");
  assert.equal(track.gameCatalogueAdmission, false);
  assert.equal(track.default, false);
  assert.equal(track.recordingModeEligible, false);
  assert.deepEqual(track.collections, [
    "Synthwave & Electro — approved",
    "Synthwave & Electro — owner-approved directions",
    "runner2088 retrowave audition",
  ]);
  assert.deepEqual(track.tags, [
    "synth90s",
    "synthwave",
    "retrowave",
    "outrun",
    "electronic",
    "racing",
    "gameplay",
    "high energy",
    "owner-approved",
  ]);
  const bogart = catalogue.tracks.find(
    ({ id }) => id === "bogart-vgm.retroracing-nightlife",
  );
  assert.deepEqual(bogart.collections, [
    "Synthwave & Electro — approved",
    "Synthwave & Electro — owner-approved directions",
    "synth-approved-directions-audition-20260925",
  ]);
  assert.ok(bogart.tags.includes("synthwave"));
  assert.ok(bogart.tags.includes("racing"));
  assert.equal(bogart.listeningApproval, "owner-approved-2026-09-29");
  assert.equal(bogart.gameCatalogueAdmission, false);
  const metalDirections = [
    "davidkbd.agony-space-deep",
    "davidkbd.god-of-darkness",
    "davidkbd.suffocation",
    "yannz.pixel-damnation",
    "yannz.revenges-waiting",
  ].map((id) => catalogue.tracks.find((recording) => recording.id === id));
  assert.ok(metalDirections.every(Boolean));
  for (const recording of metalDirections) {
    assert.ok(
      recording.collections.includes("Metal — owner-approved directions"),
    );
    assert.ok(recording.collections.includes("Metal — approved"));
    assert.ok(recording.tags.includes("owner-approved direction"));
    assert.ok(recording.tags.includes("owner-approved"));
    assert.ok(!recording.tags.includes("listening pending"));
    assert.equal(recording.listeningApproval, "owner-approved-2026-09-29");
    assert.equal(recording.gameCatalogueAdmission, false);
    assert.notEqual(recording.default, true);
  }
  assert.ok(
    metalDirections
      .find(({ id }) => id === "yannz.pixel-damnation")
      .tags.includes("rhythmic metal"),
  );
  const shchedryk = catalogue.tracks.find(
    ({ id }) => id === "alexander-nakarada.carol-of-the-bells-metal-version",
  );
  assert.deepEqual(shchedryk.collections, [
    "Ukrainian — approved",
    "Ukrainian — owner-approved benchmark",
    "ukrainian-shchedryk-20260924",
  ]);
  assert.ok(shchedryk.tags.includes("Shchedryk adaptation"));
  assert.ok(shchedryk.tags.includes("owner-approved benchmark"));
  assert.ok(shchedryk.tags.includes("owner-approved"));
  assert.ok(!shchedryk.tags.includes("listening pending"));
  assert.equal(shchedryk.listeningApproval, "owner-approved-2026-09-29");
  assert.equal(shchedryk.gameCatalogueAdmission, false);
  assert.notEqual(shchedryk.default, true);
  const ukrainianCulturalReview = [
    "ukrainian-air-force-band.oi-u-luzi-chervona-kalyna",
    "zoretsvit-kalyna.a-v-kryvoho-tantsia",
    "kate-orange.oi-khodyt-son",
  ].map((id) => catalogue.tracks.find((recording) => recording.id === id));
  assert.ok(ukrainianCulturalReview.every(Boolean));
  for (const recording of ukrainianCulturalReview) {
    assert.ok(
      recording.collections.includes("Ukrainian — cultural review queue"),
    );
    assert.ok(recording.collections.includes("Ukrainian — approved"));
    assert.ok(recording.tags.includes("owner-approved"));
    assert.equal(recording.listeningApproval, "owner-approved-2026-09-29");
    assert.equal(recording.gameCatalogueAdmission, false);
    assert.notEqual(recording.default, true);
  }
  assert.equal(
    track.audio.sha256,
    "9924c6163116b0db94cc0c1878542d2576aac02051dd25f6ebb3b9767869cef9",
  );
  assert.equal(track.audio.path, `objects/${track.audio.sha256}.mp3`);
  const trench = catalogue.tracks.find(
    ({ id }) => id === "trench-orderly.soundtrack.2",
  );
  assert.equal(trench, undefined, "Transferred recordings must not remain in the main catalogue");
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
  assert.equal(soundtrackReview.length, 28);
  assert.equal(review.length, 65);
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
      "davidkbd.the-slicing-strain",
      "hatmix.lost-in-the-snow-wave",
      "glitchart-technodono-tricksntraps-davidkbd.hit-the-womp-mix",
      "davidkbd.time-warp",
      "foxsynergy.metallic-mistress",
      "esiltir.calamity",
      "wekont.runner2088-game-mix",
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

test("every public release-backed recording is materialized in the Pages payload", async () => {
  const catalogue = JSON.parse(await readFile("catalogue.json", "utf8"));
  const manifest = await buildManifest();
  const files = new Map(manifest.files.map((entry) => [entry.path, entry]));
  const publicTracks = catalogue.tracks.filter(hasPublishedLicense).filter(
    ({ visibility, audio }) =>
      visibility !== "review-only" && audio.delivery?.type !== "external-url",
  );

  assert.ok(publicTracks.length >= 123);
  for (const track of publicTracks) {
    assert.equal(track.audio.path, `objects/${track.audio.sha256}.mp3`);
    assert.deepEqual(files.get(track.audio.path), {
      path: track.audio.path,
      bytes: track.audio.bytes,
      sha256: track.audio.sha256,
    });
  }
  assert.ok(
    manifest.files.reduce((sum, file) => sum + file.bytes, 0) <=
      950 * 1024 * 1024,
  );
});

test("published release assets are resolved through the read-only GitHub API", async () => {
  const sha256 = "e".repeat(64);
  const bytes = Uint8Array.from([1, 2, 3]);
  const requests = [];
  const result = await releaseAssetBytes(
    "audio-test",
    sha256,
    async (url, options) => {
      requests.push({ url, options });
      if (requests.length === 1) {
        return new Response(
          JSON.stringify({
            assets: [
              {
                name: `${sha256}.mp3`,
                url: "https://api.github.com/repos/example/assets/1",
              },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      return new Response(bytes, { status: 200 });
    },
    "test-token",
  );

  assert.deepEqual(result, bytes);
  assert.equal(requests.length, 2);
  assert.match(requests[0].url, /releases\/tags\/audio-test$/);
  assert.equal(requests[0].options.headers.Authorization, "Bearer test-token");
  assert.equal(requests[1].options.headers.Accept, "application/octet-stream");
});

test("approved synth and metal inventory binds only the seven selected exact recordings", async () => {
  const inventory = JSON.parse(
    await readFile("admissions/approved-synth-metal-20260930.json", "utf8"),
  );
  const catalogue = JSON.parse(await readFile("catalogue.json", "utf8"));
  verifyApprovedInventory(inventory, catalogue);
  assert.equal(inventory.files.length, 7);
  for (const file of inventory.files) {
    const track = catalogue.tracks.find(
      ({ audio }) => audio.sha256 === file.sha256,
    );
    assert.ok(track);
    assert.notEqual(track.visibility, "review-only");
    assert.equal(track.listeningApproval, "owner-approved-2026-09-29");
    assert.equal(track.gameCatalogueAdmission, false);
    assert.notEqual(track.default, true);
    assert.equal(track.rights.licenseId, "CC-BY");
    assert.equal(track.recordingModeEligible, false);
  }
});

test("approved inventory rejects altered, repeated and unrelated recording identities", async () => {
  const original = JSON.parse(
    await readFile("admissions/approved-synth-metal-20260930.json", "utf8"),
  );
  const catalogue = JSON.parse(await readFile("catalogue.json", "utf8"));
  for (const mutate of [
    (value) => {
      value.files[0].bytes += 1;
    },
    (value) => {
      value.files[0].sha256 = "f".repeat(64);
    },
    (value) => {
      value.files[0].path = "../objects/song.mp3";
    },
    (value) => {
      value.files[0] = value.files[1];
    },
    (value) => {
      value.files.pop();
    },
    (value) => {
      value.files[0] = catalogue.tracks.find(
        ({ id }) => id === "davidkbd.desolation",
      ).audio;
    },
  ]) {
    const inventory = structuredClone(original);
    mutate(inventory);
    assert.throws(
      () => verifyApprovedInventory(inventory, catalogue),
      /Approved soundtrack inventory/,
    );
  }
  const alteredCatalogue = structuredClone(catalogue);
  alteredCatalogue.tracks.find(({ id }) => id === "wekont.runner2088").audio.sha256 =
    "f".repeat(64);
  assert.throws(
    () => verifyApprovedInventory(original, alteredCatalogue),
    /recording identity differs/,
  );
});

test("runner2088 derivative remains a separate review-only recording with exact technical evidence", async () => {
  const catalogue = JSON.parse(await readFile("catalogue.json", "utf8"));
  const track = catalogue.tracks.find(({ id }) => id === "wekont.runner2088-game-mix");
  const original = catalogue.tracks.find(({ id }) => id === "wekont.runner2088");
  const inventory = JSON.parse(await readFile("admissions/runner2088-game-mix-20260930.json", "utf8"));
  verifyRunner2088Inventory(inventory, catalogue);
  assert.equal(track.title, "runner2088 (Game mix)");
  assert.equal(track.visibility, "review-only");
  assert.equal(track.listeningApproval, "not-reviewed");
  assert.equal(track.gameCatalogueAdmission, false);
  assert.equal(track.recordingModeEligible, false);
  assert.equal(track.default, false);
  assert.equal(track.contentId, "unknown");
  assert.ok(!tracksForView(catalogue.tracks).includes(track));
  assert.ok(tracksForView(catalogue.tracks).includes(original));
  const batches = JSON.parse(await readFile("batches.json", "utf8"));
  assert.equal(
    batches.collections.find(({ id }) => id === "Soundtrack Review").tracks,
    catalogue.tracks.filter(({ collections }) => collections.includes("Soundtrack Review")).length,
  );
  assert.equal(track.source, original.source);
  assert.equal(track.licenseURL, original.licenseURL);
  assert.ok(track.rights.derivativeChangeNotice.includes(original.audio.sha256));
  assert.ok(track.credit.includes("-1.6 dB"));
  const [source, derivative] = JSON.parse(await readFile("intake/runner2088-game-mix-20260930/measurements.json", "utf8"));
  assert.equal(source.sha256, original.audio.sha256);
  assert.equal(derivative.sha256, track.audio.sha256);
  assert.equal(derivative.bytes, track.audio.bytes);
  assert.equal(source.decodedFrames, derivative.decodedFrames);
  assert.equal(derivative.fullFileDecoded, true);
  assert.ok(Number(derivative.measurement.input_i) >= -17);
  assert.ok(Number(derivative.measurement.input_i) <= -15);
  assert.ok(Number(derivative.measurement.input_tp) <= -1);
});

test("next metal inventory publishes the six pinned recordings without admission or approval", async () => {
  const bytes = await readFile("admissions/metal-next-20260930.json");
  const inventory = JSON.parse(bytes);
  const catalogue = JSON.parse(await readFile("catalogue.json", "utf8"));
  const before = structuredClone(catalogue);
  verifyMetalNextInventory(inventory, catalogue);
  assert.equal(bytes.length, 1383);
  assert.equal(
    createHash("sha256").update(bytes).digest("hex"),
    "9e92ce2757f17568ff9753be21f07268314490153520273eb2034ef06534c560",
  );
  const tracks = inventory.files.map((file) => catalogue.tracks.find(
    ({ audio }) => audio.sha256 === file.sha256,
  ));
  assert.deepEqual(tracks.map(({ id }) => id), [
    "davidkbd.solar-storm", "davidkbd.galactic-battle",
    "davidkbd.orbital-assault", "davidkbd.mutilations-melody",
    "davidkbd.bone-grinders-ballad", "davidkbd.city-limits-crash",
  ]);
  for (const track of tracks) {
    assert.notEqual(track.visibility, "review-only");
    assert.equal(track.listeningApproval, "not-reviewed");
    assert.equal(track.gameCatalogueAdmission, false);
    assert.equal(track.default, false);
    assert.equal(track.recordingModeEligible, false);
  }
  assert.deepEqual(catalogue, before);
  const manifest = await buildManifest();
  assert.deepEqual(
    manifest.files.find(({ path }) => path === "admissions/metal-next-20260930.json"),
    {
      path: "admissions/metal-next-20260930.json", bytes: 1383,
      sha256: "9e92ce2757f17568ff9753be21f07268314490153520273eb2034ef06534c560",
    },
  );
});

test("next metal inventory rejects identity, membership and review-only substitutions", async () => {
  const original = JSON.parse(await readFile("admissions/metal-next-20260930.json", "utf8"));
  const catalogue = JSON.parse(await readFile("catalogue.json", "utf8"));
  const hidden = catalogue.tracks.find(({ id }) => id === "davidkbd.the-slicing-strain");
  assert.equal(hidden.visibility, "review-only");
  for (const mutate of [
    (value) => { value.format = "other-format"; },
    (value) => { value.id = "other-batch"; },
    (value) => { value.files.pop(); },
    (value) => { value.files.push(value.files[0]); },
    (value) => { value.files[0] = value.files[1]; },
    (value) => { value.files[0] = hidden.audio; },
    (value) => { value.files[0].bytes += 1; },
    (value) => { value.files[0].sha256 = "f".repeat(64); },
    (value) => { value.files[0].path = "../objects/song.mp3"; },
  ]) {
    const inventory = structuredClone(original);
    mutate(inventory);
    assert.throws(() => verifyMetalNextInventory(inventory, catalogue), /Next metal inventory/);
  }
  for (const file of original.files) {
    for (const mutate of [
      (track) => { track.id = "substituted-recording"; },
      (track) => { track.audio.sha256 = "f".repeat(64); },
      (track) => { track.audio.bytes += 1; },
      (track) => { track.audio.path = "objects/other.mp3"; },
      (track) => { track.visibility = "review-only"; },
    ]) {
      const altered = structuredClone(catalogue);
      mutate(altered.tracks.find(({ audio }) => audio.sha256 === file.sha256));
      assert.throws(() => verifyMetalNextInventory(original, altered), /recording identity or public visibility differs/);
    }
  }
  const duplicate = structuredClone(catalogue);
  duplicate.tracks.push(duplicate.tracks.find(({ id }) => id === "davidkbd.solar-storm"));
  assert.throws(() => verifyMetalNextInventory(original, duplicate), /recording identity or public visibility differs/);
});

test("runner2088 derivative inventory rejects original substitution and changed identity", async () => {
  const catalogue = JSON.parse(await readFile("catalogue.json", "utf8"));
  const original = JSON.parse(await readFile("admissions/runner2088-game-mix-20260930.json", "utf8"));
  for (const mutate of [
    (value) => { value.files[0].bytes += 1; },
    (value) => { value.files[0].sha256 = "f".repeat(64); },
    (value) => { value.files[0].path = "../objects/song.mp3"; },
    (value) => { value.files.push(value.files[0]); },
    (value) => { value.files = []; },
    (value) => { value.files[0] = catalogue.tracks.find(({ id }) => id === "wekont.runner2088").audio; },
  ]) {
    const inventory = structuredClone(original);
    mutate(inventory);
    assert.throws(() => verifyRunner2088Inventory(inventory, catalogue), /derivative inventory differs/);
  }
  const alteredCatalogue = structuredClone(catalogue);
  alteredCatalogue.tracks.find(({ id }) => id === "wekont.runner2088-game-mix").audio.sha256 = "f".repeat(64);
  assert.throws(() => verifyRunner2088Inventory(original, alteredCatalogue), /recording identity differs/);
});


test("draft or missing release fails with intake guidance before any asset download", async () => {
  const requests = [];
  await assert.rejects(() => releaseAssetBytes("audio-draft", "e".repeat(64), async (url) => {
    requests.push(url);
    return new Response("Not Found", { status: 404 });
  }, "read-only-token"), /Publish its verified audio prerelease.*draft assets are not readable by PR CI/);
  assert.equal(requests.length, 1);
});
