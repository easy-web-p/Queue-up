/**
 * ============================================================================
 * ⭐ RATING ARITHMETIC
 * ============================================================================
 *
 * The product page's rating card read 4.8, with a "98% ของผู้ทานแนะนำร้านนี้"
 * badge and four sub-scores — รสชาติ 4.9, ความสะอาด 4.9, ความรวดเร็ว 4.7,
 * ความคุ้มค่า 4.8 — written into the markup. Every dish in the canteen showed
 * the same numbers, including dishes with no reviews at all.
 *
 * A review document carries one `rating`. One average and one distribution is
 * all there is to show, and this is where they are computed — in a module with
 * no imports, so the suite calls it rather than reading the JSX and hoping.
 */

export interface RatedReview {
  rating?: unknown;
}

/** Only a 1–5 score counts. A malformed row is not a zero-star review. */
function scoresOf(reviews: RatedReview[] | null | undefined): number[] {
  return (reviews || [])
    .map((r) => Number(r?.rating))
    .filter((n) => Number.isFinite(n) && n >= 1 && n <= 5);
}

/**
 * The mean of the ratings actually left, or 0 when there are none.
 *
 * 0 rather than a default: the card is hidden at zero, which is the honest
 * rendering of "nobody has rated this yet".
 */
export function averageRating(reviews: RatedReview[] | null | undefined): number {
  const scores = scoresOf(reviews);
  if (scores.length === 0) return 0;
  return scores.reduce((sum, n) => sum + n, 0) / scores.length;
}

/** How many reviews left each star, keyed 1–5. Absent keys mean none. */
export function ratingDistribution(
  reviews: RatedReview[] | null | undefined
): Record<number, number> {
  const counts: Record<number, number> = {};
  for (const score of scoresOf(reviews)) {
    const star = Math.round(score);
    counts[star] = (counts[star] || 0) + 1;
  }
  return counts;
}

/** How many of them counted, so the card can say "จากรีวิวจริง N รายการ". */
export function ratedCount(reviews: RatedReview[] | null | undefined): number {
  return scoresOf(reviews).length;
}
