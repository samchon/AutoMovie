import { AutoMovieCanonicalJsonErrorCategory } from "./AutoMovieCanonicalJsonErrorCategory";

/**
 * A typed refusal that never emits partial canonical text or identity.
 *
 * It extends `TypeError` because every refusal is a value outside the accepted
 * domain, and it carries a closed category so callers branch on the violated
 * rule instead of parsing a message.
 *
 * @evidence requirements/rendering/frame-identity-and-content-addressing.md#rendering-digest-refusal Refuses a canonicalization failure as a typed error before any fingerprint exists.
 * @evidence specifications/editorial-render-and-delivery/render-budget-identity-and-recovery.md#spec-render-frame-identity Rejects the identity input whose canonical representation cannot be fixed rather than hashing a partial form.
 */
export class AutoMovieCanonicalJsonError extends TypeError {
  /** Stable machine-readable diagnostic code. */
  public readonly code = "automovie-canonical-json-invalid" as const;

  public constructor(
    /** Stable refusal category independent of engine error wording. */
    public readonly category: AutoMovieCanonicalJsonErrorCategory,
    detail: string,
  ) {
    super(`AutoMovie canonical JSON refused ${category}: ${detail}`);
    this.name = "AutoMovieCanonicalJsonError";
  }
}
