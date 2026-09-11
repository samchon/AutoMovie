import { AutoMovieContentDigest } from "@automovie/interface";

/**
 * Current identities required when sampling a persisted film effect.
 *
 * A consumer establishes these four values from the compile manifest and the
 * timeline it holds, never from the runtime array itself, so a stale artifact
 * cannot vouch for its own currentness.
 *
 * @evidence requirements/effects-and-simulation/clock-seek-and-determinism.md#effects-cache-identity Names the production, film, compile, and edit identities a persisted stream must match before it is reused.
 * @evidence specifications/simulation-effects-and-sound/clocks-ordering-seek-and-checkpoints.md#checkpoint-cache-identity-and-validity Carries the production and edit key fields whose mismatch is a cache miss rather than a stale success.
 * @author Samchon
 */
export interface IAutoMovieFilmEffectCurrentIdentity {
  /** Current production identity. */
  production: string;
  /** Current film identity. */
  film: string;
  /** Current aggregate builder input. */
  compileFingerprint: AutoMovieContentDigest;
  /** Current normalized edit identity. */
  editFingerprint: AutoMovieContentDigest;
}
