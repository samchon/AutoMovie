/**
 * Production builder protocol embedded in generated manifests.
 *
 * Bumped whenever the shape of a generated artifact changes, so an older
 * generated tree is recognised as older rather than silently misread as
 * current. This revision added a per-member cue channel, a ground sample per
 * member, and a story clock; each of those is a field a v7 reader would not
 * find where it expects one. It also dropped `phase.periodSeconds` from a
 * compiled formation, because a cycle's period is now measured from the baked
 * motion rather than written down beside it -- so a v7 reader would look for
 * that one where it is no longer written.
 *
 * Version 10 adds the exact graph-selected source owner to compiled shot
 * artifacts, so a version 9 reader cannot assume source path and digest alone
 * identify the authored target that was admitted.
 *
 * @author Samchon
 */
export const AUTOMOVIE_PRODUCTION_BUILD_PROTOCOL = "automovie.builder.v10";

/**
 * Compiler package version used in generated identity.
 *
 * @author Samchon
 */
export const AUTOMOVIE_PRODUCTION_BUILD_VERSION =
  // A static specifier rather than a path built at run time. Both resolve to
  // this package's own manifest from `src/production` and from the emitted
  // `lib/production`, so the two shapes agree -- but only the static one
  // survives bundling, and a generated project bundles this package. Built
  // from `__dirname`, the specifier resolved against the bundle's own
  // directory instead: the generated project's `package.json` sits exactly
  // where the walk lands, so the identity took the consumer's version and
  // reported no error at all. Rollup refuses the dynamic form outright, which
  // is how a silently wrong version finally became a failure.
  (
    require("../../package.json") as {
      version: string;
    }
  ).version;
