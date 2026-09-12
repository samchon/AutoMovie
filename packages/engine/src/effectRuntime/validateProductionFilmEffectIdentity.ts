import { AutoMovieFilmEffectRuntimeError } from "./AutoMovieFilmEffectRuntimeError";
import { IAutoMovieFilmEffectCurrentIdentity } from "./IAutoMovieFilmEffectCurrentIdentity";

/**
 * Refuse a current film-effect identity that cannot address a runtime.
 *
 * The production and film ids must be non-blank and both builder identities
 * must be exact lowercase SHA-256 content digests. The writer checks this
 * before it stamps a runtime and the sampler before it compares one, so a
 * malformed identity is refused as input rather than read as a stale match.
 *
 * @evidence requirements/effects-and-simulation/clock-seek-and-determinism.md#effects-cache-identity Admits only complete production, film, compile and edit identities as the key a persisted stream is matched against.
 * @evidence specifications/simulation-effects-and-sound/clocks-ordering-seek-and-checkpoints.md#checkpoint-cache-identity-and-validity Refuses a malformed identity key before any runtime is written or reused under it.
 */
export const validateProductionFilmEffectIdentity = (
  identity: IAutoMovieFilmEffectCurrentIdentity,
): void => {
  if (
    identity.production.trim().length === 0 ||
    identity.film.trim().length === 0
  )
    throw new AutoMovieFilmEffectRuntimeError(
      "film-effect-input-invalid",
      "Film effect production and film identities must be non-blank.",
    );
  if (
    validDigest(identity.compileFingerprint) === false ||
    validDigest(identity.editFingerprint) === false
  )
    throw new AutoMovieFilmEffectRuntimeError(
      "film-effect-input-invalid",
      "Film effect compile and edit identities must be SHA-256 content digests.",
    );
};

const validDigest = (value: string): boolean =>
  /^sha256:[0-9a-f]{64}$/.test(value);
