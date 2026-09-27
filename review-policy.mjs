export const REVIEW_ACCESS_KEY = "base-game-holdback-20260927";

export const isReviewOnly = (track) => track?.visibility === "review-only";

export function tracksForView(tracks, reviewKey = "") {
  const showReview = reviewKey === REVIEW_ACCESS_KEY;
  return tracks.filter((track) =>
    showReview ? isReviewOnly(track) : !isReviewOnly(track),
  );
}
