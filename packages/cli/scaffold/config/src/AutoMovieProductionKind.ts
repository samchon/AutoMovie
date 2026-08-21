/**
 * Which authoring topology this production uses.
 *
 * A film owns the full narrative ladder, a brief owns one bounded audiovisual
 * intent without that ladder, and a library delivers model or motion source
 * without authored shots.
 */
export type AutoMovieProductionKind = "film" | "brief" | "library";
