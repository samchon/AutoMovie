import type { IAutoMovieFilmTimeline } from "@automovie/interface";

/**
 * Stable identity of one current timeline occurrence.
 * @evidence requirements/repaint/sequence-continuity-and-publication.md#repaint-mixed-delivery Keeps repeated shot labels occurrence-addressed.
 * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-repaint-failure-publication Gives config, conform, manifest, and reopen one join key.
 */
export const productionVisualDeliveryOccurrence = (
  segment: IAutoMovieFilmTimeline["segments"][number],
  index: number,
): string =>
  `occurrence:${index}:${segment.startFrame}-${segment.endFrame}:${segment.shot}`;
