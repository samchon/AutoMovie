import type { AutoMovieContentDigest } from "@automovie/interface";

import {
  AUTOMOVIE_BUILD_FINGERPRINT_PROTOCOL,
  IAutoMovieFingerprintField,
  canonicalAutoMovieJsonBytes,
  fingerprintAutoMovieFields,
} from "./contentIdentity";
import {
  AUTOMOVIE_LIBRARY_AUTHORING_SNAPSHOT_PROTOCOL,
  IAutoMovieLibraryAuthoringSnapshot,
} from "./libraryAuthoringSnapshot";
import { portableAutoMovieLibraryAuthoringSnapshot } from "./portableAutoMovieLibraryAuthoringSnapshot";
import {
  AUTOMOVIE_PRODUCTION_BUILD_PROTOCOL,
  AUTOMOVIE_PRODUCTION_BUILD_VERSION,
} from "./productionBuildProtocol";

/**
 * The builder input identity of one library attempt.
 *
 * Four things enter it, each under its own domain-separated field. The compile
 * protocol and builder version come first. The production namespace follows,
 * because every library build context and the published index carry it, so
 * the same source compiled under another namespace is a different result. The
 * portable projection of the authoring snapshot comes next, so the same work
 * opened from another checkout is the same result. The content inventory and
 * verified derivation closure come last, and they are where an imported helper
 * outside the selected owner population, an adopted asset, and derived bytes
 * enter.
 *
 * The resident snapshot digest is deliberately absent. The publication guard
 * compares that digest on its own, so moving a project neither stales its
 * results nor weakens the refusal of a foreign or replaced root.
 *
 * This identity replaced one that hashed the resident digest and omitted the
 * namespace. No generated artifact changed shape, so the builder protocol did
 * not move. A manifest, index, or receipt recorded under the earlier identity
 * cannot equal this one, and it reopens as stale until the library is compiled
 * again.
 *
 * @evidence requirements/agent-authoring/source-owned-loop.md#agent-source-result-link Binds a library result to its namespace, graph-selected authoring closure and input bytes.
 * @evidence requirements/evidence-and-provenance/completeness-freshness-and-refusal.md#evidence-dependency-based-current-status Changes whenever the namespace, a source, an owner, the configuration, an asset or a derived input changes, and never for a checkout location.
 * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-input Admits the namespace, selected configuration, normalized source and adopted bytes, and no machine path.
 * @evidence specifications/evidence-and-provenance/completeness-freshness-and-refusal.md#evp-dependency-based-freshness Supplies the source and dependency closure key a stored library publication is compared against.
 * @author Samchon
 */
export const libraryBuildInputFingerprint = (props: {
  /** Production namespace the library is compiled and published under. */
  production: string;
  /** Authoring closure acquired for the attempt. */
  snapshot: IAutoMovieLibraryAuthoringSnapshot;
  /** Content inventory and derivation closure fields in their read order. */
  derivedFields: readonly IAutoMovieFingerprintField[];
}): AutoMovieContentDigest =>
  fingerprintAutoMovieFields([
    {
      role: "protocol",
      kind: "library-compile-input",
      payload: Buffer.from(
        `${AUTOMOVIE_BUILD_FINGERPRINT_PROTOCOL}\0${AUTOMOVIE_PRODUCTION_BUILD_PROTOCOL}\0${AUTOMOVIE_PRODUCTION_BUILD_VERSION}`,
        "utf8",
      ),
    },
    {
      role: "production",
      kind: "namespace",
      payload: Buffer.from(props.production, "utf8"),
    },
    {
      role: "library:authoring",
      kind: AUTOMOVIE_LIBRARY_AUTHORING_SNAPSHOT_PROTOCOL,
      payload: canonicalAutoMovieJsonBytes(
        portableAutoMovieLibraryAuthoringSnapshot(props.snapshot),
      ),
    },
    ...props.derivedFields,
  ]);
