import assert from "node:assert/strict";
import test from "node:test";
import { REVIEW_ACCESS_KEY, tracksForView } from "./review-policy.mjs";

const license = {
  license: "CC0 1.0 Universal",
  licenseURL: "https://creativecommons.org/publicdomain/zero/1.0/",
  rights: { licenseId: "CC0", licenseVersion: "1.0", licenseURL: "https://creativecommons.org/publicdomain/zero/1.0/" },
};
const tracks = [
  { id: "public.one" },
  { id: "review.one", visibility: "review-only" },
  { id: "public.two" },
].map((track) => ({ ...license, ...track }));

test("public catalogue views exclude held recordings", () => {
  assert.deepEqual(tracksForView(tracks).map(({ id }) => id), [
    "public.one",
    "public.two",
  ]);
  assert.deepEqual(tracksForView(tracks, "wrong-key").map(({ id }) => id), [
    "public.one",
    "public.two",
  ]);
});

test("the exact unlisted review key exposes only held recordings", () => {
  assert.deepEqual(
    tracksForView(tracks, REVIEW_ACCESS_KEY).map(({ id }) => id),
    ["review.one"],
  );
});
