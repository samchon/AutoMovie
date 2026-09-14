import type { IAutoMovieLibraryAuthoringSnapshot } from "./libraryAuthoringSnapshot";

/**
 * Project one library authoring snapshot onto the facts every checkout shares.
 *
 * A snapshot is acquired inside one physical checkout, so it records where that
 * checkout is as well as what it builds. The builder root and the
 * declaration's absolute `location` are the first kind. The snapshot digest
 * covers them so the publication guard refuses evidence read from another root
 * or a root replaced during the attempt, and they say nothing about the result.
 * Package identity, production kind, the selected configuration, the binding
 * manifest, the design branch and owner populations with their source
 * bindings, the graph-selected owner edges, and every selected source member's
 * normalized digest are the second kind. Each is project-relative or
 * checkout-independent by construction, and a library result depends on all of
 * them.
 *
 * The projection therefore drops exactly the two location facts and the digest
 * that covers them, and keeps every other field, including one the snapshot
 * gains later. Keeping a field that turns out to name the checkout costs a
 * recompile after a move; dropping one that turns out to matter would let a
 * changed input keep an old result current.
 *
 * @evidence requirements/agent-authoring/source-owned-loop.md#agent-source-result-link Keeps every selected owner, binding, configuration and normalized source digest a library result traces back to, and nothing that names the checkout.
 * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-input Removes the builder root and the absolute declaration location so no machine path enters the library derivation input.
 * @author Samchon
 */
export const portableAutoMovieLibraryAuthoringSnapshot = (
  snapshot: IAutoMovieLibraryAuthoringSnapshot,
): Omit<
  IAutoMovieLibraryAuthoringSnapshot,
  "configuration" | "digest" | "root"
> & {
  configuration: Omit<
    IAutoMovieLibraryAuthoringSnapshot["configuration"],
    "location"
  >;
} => {
  const { root, digest, configuration, ...semantic } = snapshot;
  const { location, ...portableConfiguration } = configuration;
  return { ...semantic, configuration: portableConfiguration };
};
