import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { preparePublicVolume } from "./intake/add-music.mjs";

const tracks = [Buffer.from("exact MP3 A"), Buffer.from("exact MP3 B")].map(
  (bytes) => ({
    bytes,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  }),
);
const batch = { batchId: "test", title: "Test", tracks };
const asset = (track) => ({
  name: `${track.sha256}.mp3`,
  size: track.bytes.length,
  state: "uploaded",
  digest: `sha256:${track.sha256}`,
});
const complete = (extra = {}) => ({
  tagName: "audio-test",
  isDraft: true,
  isPrerelease: false,
  assets: tracks.map(asset),
  ...extra,
});

function github(
  initial = null,
  { corruptUpload = false, failList = false } = {},
) {
  let release = initial && structuredClone(initial);
  const operations = [],
    uploadPaths = [];
  return {
    operations,
    uploadPaths,
    release: () => release,
    async runCommand(command, args, options) {
      assert.equal(command, "gh");
      assert.deepEqual(args.slice(-2), [
        "--repo",
        "mekhovov/revealline-soundtracks",
      ]);
      assert.equal(options.capture, true);
      assert.ok(!args.includes("--clobber"));
      const operation = args[1];
      operations.push(operation);
      if (operation === "list") {
        if (failList) throw new Error("GitHub authentication failed");
        return JSON.stringify(release ? [{ tagName: release.tagName }] : []);
      }
      if (operation === "create") {
        assert.equal(release, null);
        assert.ok(args.includes("--draft"));
        release = complete({ assets: [] });
      } else if (operation === "view") return JSON.stringify(release);
      else if (operation === "upload") {
        assert.ok(release.isDraft);
        for (const file of args.slice(3, -2)) {
          uploadPaths.push(file);
          const bytes = await readFile(file);
          const sha256 = createHash("sha256").update(bytes).digest("hex");
          assert.equal(path.basename(file), `${sha256}.mp3`);
          release.assets.push({
            name: `${sha256}.mp3`,
            size: bytes.length,
            state: "uploaded",
            digest: `sha256:${corruptUpload ? "0".repeat(64) : sha256}`,
          });
        }
      } else if (operation === "edit") {
        assert.deepEqual(args.slice(3, -2), [
          "--draft=false",
          "--prerelease=true",
          "--latest=false",
        ]);
        assert.equal(release.assets.length, tracks.length);
        release.isDraft = false;
        release.isPrerelease = true;
      } else throw new Error(`Unexpected operation: ${operation}`);
      return "";
    },
  };
}

test("intake publishes a fully verified prerelease before returning for PR creation", async () => {
  const gh = github();
  await preparePublicVolume(batch, gh);
  assert.deepEqual(gh.operations, [
    "list",
    "create",
    "view",
    "upload",
    "view",
    "edit",
    "view",
  ]);
  assert.equal(gh.release().isDraft, false);
  assert.equal(gh.release().isPrerelease, true);
  for (const file of gh.uploadPaths)
    await assert.rejects(readFile(file), { code: "ENOENT" });
});

test("a partial draft uploads only missing exact members", async () => {
  const gh = github(complete({ assets: [asset(tracks[0])] }));
  await preparePublicVolume(batch, gh);
  assert.equal(gh.uploadPaths.length, 1);
  assert.equal(path.basename(gh.uploadPaths[0]), `${tracks[1].sha256}.mp3`);
  assert.equal(gh.release().isDraft, false);
});

test("existing matching public prerelease or final release is reused without mutation", async () => {
  for (const isPrerelease of [true, false]) {
    const gh = github(complete({ isDraft: false, isPrerelease }));
    await preparePublicVolume(batch, gh);
    assert.deepEqual(gh.operations, ["list", "view"]);
    assert.equal(gh.release().isPrerelease, isPrerelease);
  }
});

test("mismatched, extra, duplicate or incomplete public assets cannot be overwritten", async () => {
  for (const bad of [
    complete({
      assets: [
        asset(tracks[0]),
        { ...asset(tracks[1]), digest: `sha256:${"0".repeat(64)}` },
      ],
    }),
    complete({
      assets: [
        ...tracks.map(asset),
        { ...asset(tracks[0]), name: "extra.mp3" },
      ],
    }),
    complete({ assets: [asset(tracks[0]), asset(tracks[0])] }),
    complete({ assets: [asset(tracks[0])], isDraft: false }),
  ]) {
    const gh = github(bad);
    await assert.rejects(preparePublicVolume(batch, gh));
    assert.deepEqual(gh.operations, ["list", "view"]);
  }
});

test("local or uploaded hash mismatch never publishes", async () => {
  const gh = github();
  await assert.rejects(
    preparePublicVolume(
      { ...batch, tracks: [{ ...tracks[0], sha256: "0".repeat(64) }] },
      gh,
    ),
    /Local audio hash differs/,
  );
  assert.deepEqual(gh.operations, []);
  const corrupt = github(null, { corruptUpload: true });
  await assert.rejects(preparePublicVolume(batch, corrupt));
  assert.ok(!corrupt.operations.includes("edit"));
  for (const file of corrupt.uploadPaths)
    await assert.rejects(readFile(file), { code: "ENOENT" });
});

test("authentication and network failures do not become release creation attempts", async () => {
  const gh = github(null, { failList: true });
  await assert.rejects(preparePublicVolume(batch, gh), /authentication failed/);
  assert.deepEqual(gh.operations, ["list"]);
});

test("PR staging retains read-only permissions and no privileged pull_request_target trigger", async () => {
  const workflow = await readFile(".github/workflows/pages.yml", "utf8");
  assert.match(workflow, /\npermissions:\n  contents: read\n/);
  assert.doesNotMatch(workflow, /pull_request_target/);
  const verification = workflow.split("\n  verify:")[1].split("\n  deploy:")[0];
  assert.doesNotMatch(verification, /contents: write/);
});

test("invalid batch identity and duplicate recordings fail before release creation", async () => {
  for (const invalid of [
    { ...batch, batchId: "../bad" },
    { ...batch, tracks: [tracks[0], tracks[0]] },
    { ...batch, tracks: [] },
  ]) {
    const gh = github();
    await assert.rejects(preparePublicVolume(invalid, gh));
    assert.deepEqual(gh.operations, []);
  }
});
