import assert from "node:assert/strict";
import test from "node:test";
import { REVIEW_ACCESS_KEY, tracksForView } from "./review-policy.mjs";

const tracks = [
  { id: "public.one" },
  { id: "review.one", visibility: "review-only" },
  { id: "public.two" },
];

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
