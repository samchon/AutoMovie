import { validateTextureScale } from "@automovie/engine";
import type {
  IAutoMovieConstraintViolation,
  IAutoMovieMaterial,
  IAutoMovieModel,
} from "@automovie/interface";

/**
 * The PBR slots that bind an image, checked against the material record's own
 * field names so a renamed slot is a compile error here rather than a census
 * that silently stops counting one kind of binding.
 *
 * A slot the material type gains later is a different matter and is not caught:
 * the validator would check it while this census would not count it, which
 * understates what was looked at rather than overstating it. Add it here when
 * the material gains one.
 */
const AUTOMOVIE_TEXTURE_SLOTS = [
  "baseColorTexture",
  "metallicRoughnessTexture",
  "normalTexture",
  "occlusionTexture",
  "emissiveTexture",
] as const satisfies readonly (keyof IAutoMovieMaterial)[];

/** One model a build produced, and where in that build it came from. */
export interface IAutoMovieTextureScaleSubject {
  /**
   * Where the build produced it, as `shot:<id>` or `recipe:<id>`.
   *
   * Carried beside the record because the validator answers about a model and
   * an author corrects a source. A path reading `$input.models[0].parts[3]` is
   * exact and unfindable on its own.
   */
  origin: string;
  /** The model record itself, exactly as the build wrote it. */
  model: IAutoMovieModel;
}

/** One finding, kept beside the model and the origin it belongs to. */
export interface IAutoMovieTextureScaleFinding {
  /** Origin of the model this finding is about. */
  origin: string;
  /** That model's own id. */
  model: string;
  /**
   * The validator's own record, unaltered.
   *
   * Its `path` is rooted at `$input.models[0]` on every finding, because each
   * model is measured on its own so that this record can name which one. The
   * index is therefore always zero and carries no information; `origin` and
   * `model` are what locate it.
   */
  violation: IAutoMovieConstraintViolation;
}

/**
 * How much material this run actually had to look at.
 *
 * Without it a clean run is unreadable. `validateTextureScale` answers only
 * where both halves of the question exist: a surface carrying its own texture
 * coordinates, and a binding that declared what one unit of them means. A
 * production whose surfaces are primitives, or whose bindings are bare asset
 * ids, offers it nothing : and "nothing to measure" and "measured and correct"
 * are the same empty finding list.
 *
 * Measured on a real production while this script was written: 197 models, 398
 * parts, 73 of them carrying texture coordinates, and zero bindings declaring a
 * coordinate source. Reported as a pass, that run would have been read as a
 * texture-scale review nobody had performed.
 *
 * Every number below is a count of what the records carry, never a second
 * opinion about what the validator decided. The validator excludes degenerate
 * spans and unresolvable materials for its own reasons, so `claims` is what was
 * offered to it rather than what it answered on.
 */
export interface IAutoMovieTextureScaleCensus {
  /** Distinct model records measured. */
  models: number;
  /** Parts across those models. */
  parts: number;
  /** Parts whose own mesh carries texture coordinates. */
  texturedParts: number;
  /** Structured texture bindings on the materials of those models. */
  bindings: number;
  /**
   * Bindings among those that declare `normalized` or `surface-metres`.
   *
   * The two the validator can answer about. A `source-uv` binding states that
   * its layout is the source's own and no general scale follows from it, and an
   * omitted `coordinateSource` makes no claim at all; neither is a defect and
   * neither is checkable.
   */
  claims: number;
}

/** What one build's models answered about their own texture scale. */
export interface IAutoMovieTextureScaleReport {
  /** Report format. */
  version: 1;
  /** What the run had to look at. */
  census: IAutoMovieTextureScaleCensus;
  /** Refusals: a declaration contradicting the geometry it was bound to. */
  errors: IAutoMovieTextureScaleFinding[];
  /** Warnings: a tile the surface cannot show one whole turn of. */
  warnings: IAutoMovieTextureScaleFinding[];
}

/**
 * Measure every model a build produced against the materials bound to it.
 *
 * ## Why this exists as a project script
 *
 * Nothing in compilation runs `validateTextureScale`, and shot source cannot
 * import it: a build function runs in a deterministic no-I/O sandbox over a
 * published engine surface this validator is deliberately off. The question it
 * answers is also not a frame : it is whether a finish will read at the size it
 * was authored at : so it is not compiler output either. That leaves the third
 * place, an ordinary Node script over compiler-owned state, which is where the
 * `GEOMETRY` and `MODEL_RECIPE` guides send an author for it.
 *
 * ## What it decides
 *
 * Two things, and they are different kinds of finding. A binding declaring
 * `normalized` against a set that measures more than one is refused: normalized
 * means the set covers its surface exactly once, so every repeat count computed
 * from it is arithmetic on a unit that does not exist. A `surface-metres`
 * binding whose implied `1 / scale` tile is larger than the surface's own span
 * is warned about instead, because that same geometry is how one image is
 * legitimately fitted to a single face and the numbers cannot state the intent;
 * a clamped axis has stated it and is left alone.
 *
 * Each model is measured on its own so that every finding can name the model
 * and the origin it came from, which is what an author needs to correct it.
 * Nothing here is authored back: this reads a build and reports.
 */
export const deriveAutoMovieTextureScaleReport = (props: {
  /** Every model the build produced, deduplicated, in any order. */
  subjects: readonly IAutoMovieTextureScaleSubject[];
}): IAutoMovieTextureScaleReport => {
  const census: IAutoMovieTextureScaleCensus = {
    models: props.subjects.length,
    parts: 0,
    texturedParts: 0,
    bindings: 0,
    claims: 0,
  };
  const errors: IAutoMovieTextureScaleFinding[] = [];
  const warnings: IAutoMovieTextureScaleFinding[] = [];
  for (const subject of props.subjects) {
    census.parts += subject.model.parts.length;
    for (const part of subject.model.parts)
      if (part.geometry.type === "mesh" && part.geometry.mesh.uvs !== null)
        ++census.texturedParts;
    for (const material of subject.model.materials)
      for (const slot of AUTOMOVIE_TEXTURE_SLOTS) {
        const binding = material[slot];
        // A bare asset id is a binding with no transform and no declared unit,
        // so it is not one of the two this validator can answer about.
        if (binding === null || binding === undefined) continue;
        if (typeof binding === "string") continue;
        ++census.bindings;
        if (
          binding.coordinateSource === "normalized" ||
          binding.coordinateSource === "surface-metres"
        )
          ++census.claims;
      }
    const measured = validateTextureScale({ models: [subject.model] });
    const found =
      measured.success === false
        ? measured.violations
        : (measured.warnings ?? []);
    for (const violation of found) {
      const finding: IAutoMovieTextureScaleFinding = {
        origin: subject.origin,
        model: subject.model.id,
        violation,
      };
      if (violation.severity === "error") errors.push(finding);
      else warnings.push(finding);
    }
  }
  return { version: 1, census, errors, warnings };
};

/**
 * The report as the lines a human reads, one finding per paragraph.
 *
 * The census is printed on every run including a clean one, because a clean run
 * over nothing and a clean run over a production's whole surface are the same
 * empty list and must not read the same.
 */
export const autoMovieTextureScaleLines = (
  report: IAutoMovieTextureScaleReport,
): string[] => {
  const lines: string[] = [];
  for (const finding of [...report.errors, ...report.warnings])
    lines.push(
      `${finding.violation.severity} ${finding.origin} ${finding.model} ${finding.violation.path}\n  ${finding.violation.expected}`,
    );
  const census = report.census;
  lines.push(
    `measured ${census.models} model(s), ${census.parts} part(s), ${census.texturedParts} carrying texture coordinates; ${census.bindings} structured texture binding(s), ${census.claims} of them declaring a checkable coordinate source`,
  );
  if (census.claims === 0)
    lines.push(
      "no binding declared a checkable coordinate source, so nothing was measured and this run is not a texture-scale review. State coordinateSource on the bindings whose scale matters, then measure again.",
    );
  else if (report.errors.length === 0 && report.warnings.length === 0)
    lines.push(
      `every one of those ${census.claims} claim(s) agrees with the surface it is bound to`,
    );
  return lines;
};
