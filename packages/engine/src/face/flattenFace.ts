import {
  AutoMovieFaceParameterName,
  IAutoMovieFace,
} from "@automovie/interface";

/**
 * One present leaf of an {@link IAutoMovieFace}, projected onto its morph
 * target: the flat `parameter` name the template carries, the dotted `path` the
 * document spells it at (for violation messages), and the weight.
 *
 * @evidence requirements/asset-authoring/rig-and-state.md#asset-deformable-surface Projects an authored face description onto the named morph controls that deform its base surface.
 * @evidence specifications/asset-and-representation/rig-deformation-and-state.md#asset-spec-skin-morph-facts Carries each selected morph control together with its source path and bounded weight.
 * @author Samchon
 */
export interface IAutoMovieFaceTrait {
  /**
   * Morph-target name the trait drives.
   *
   * @evidence requirements/asset-authoring/rig-and-state.md#asset-deformable-surface Identifies the morph control used to deform the face surface.
   * @evidence specifications/asset-and-representation/rig-deformation-and-state.md#asset-spec-skin-morph-facts Preserves the name of the morph fact applied to the base geometry.
   */
  parameter: AutoMovieFaceParameterName;

  /**
   * Dotted document path of the leaf, e.g. `"jaw.chin.length"`.
   *
   * @evidence requirements/asset-authoring/rig-and-state.md#asset-deformable-surface Relates a selected face field to the control that deforms the surface.
   * @evidence specifications/asset-and-representation/rig-deformation-and-state.md#asset-spec-skin-morph-facts Retains the authored source path for the emitted morph fact.
   */
  path: string;

  /**
   * The signed effective weight on this side.
   *
   * @evidence requirements/asset-authoring/rig-and-state.md#asset-deformable-surface Supplies the bounded control value used by the selected surface deformation.
   * @evidence specifications/asset-and-representation/rig-deformation-and-state.md#asset-spec-skin-morph-facts Represents the effective weight applied to the named morph difference.
   */
  weight: number;
}

/** Traits with one morph target: symmetric features. */
const SINGLE: {
  parameter: AutoMovieFaceParameterName;
  path: string;
  read: (face: IAutoMovieFace) => number | undefined;
}[] = [
  { parameter: "faceWidth", path: "width", read: (f) => f.width },
  { parameter: "faceLength", path: "length", read: (f) => f.length },
  { parameter: "jawWidth", path: "jaw.width", read: (f) => f.jaw?.width },
  {
    parameter: "chinLength",
    path: "jaw.chin.length",
    read: (f) => f.jaw?.chin?.length,
  },
  {
    parameter: "chinProtrusion",
    path: "jaw.chin.protrusion",
    read: (f) => f.jaw?.chin?.protrusion,
  },
  { parameter: "noseLength", path: "nose.length", read: (f) => f.nose?.length },
  { parameter: "noseWidth", path: "nose.width", read: (f) => f.nose?.width },
  {
    parameter: "noseProjection",
    path: "nose.projection",
    read: (f) => f.nose?.projection,
  },
  { parameter: "mouthWidth", path: "mouth.width", read: (f) => f.mouth?.width },
  {
    parameter: "mouthHeight",
    path: "mouth.height",
    read: (f) => f.mouth?.height,
  },
  {
    parameter: "lipFullness",
    path: "mouth.lips.fullness",
    read: (f) => f.mouth?.lips?.fullness,
  },
];

/**
 * Traits with one morph target per side. **Side rule** (mirrors the interface
 * docs): when only one of `left`/`right` is defined on the pair set, that lone
 * side is the SOURCE for both targets: a single side is the symmetric
 * shorthand; when both are defined, each side drives only its own target.
 * `base` + `R`/`L` must both exist in {@link AutoMovieFaceParameterName}.
 */
interface ISidedSet {
  left?: { [leaf: string]: number | undefined };
  right?: { [leaf: string]: number | undefined };
  [pairLeaf: string]: unknown;
}
const PAIRED: {
  base: string;
  group: string;
  leaf: string;
  read: (face: IAutoMovieFace) => ISidedSet | undefined;
}[] = [
  {
    base: "eyeSize",
    group: "eyes",
    leaf: "size",
    read: (f) => f.eyes as ISidedSet | undefined,
  },
  {
    base: "eyeWidth",
    group: "eyes",
    leaf: "width",
    read: (f) => f.eyes as ISidedSet | undefined,
  },
  {
    base: "eyeSpacing",
    group: "eyes",
    leaf: "offset",
    read: (f) => f.eyes as ISidedSet | undefined,
  },
  {
    base: "eyeHeight",
    group: "eyes",
    leaf: "height",
    read: (f) => f.eyes as ISidedSet | undefined,
  },
  {
    base: "eyeTilt",
    group: "eyes",
    leaf: "tilt",
    read: (f) => f.eyes as ISidedSet | undefined,
  },
  {
    base: "browHeight",
    group: "brows",
    leaf: "height",
    read: (f) => f.brows as ISidedSet | undefined,
  },
  {
    base: "cheekFullness",
    group: "cheeks",
    leaf: "fullness",
    read: (f) => f.cheeks as ISidedSet | undefined,
  },
];

/**
 * Project an {@link IAutoMovieFace} onto its morph targets: the nested,
 * anatomy-shaped document flattened to `(parameter, weight)` pairs in
 * declaration order, omitted leaves and groups skipped.
 *
 * Paired features follow the side rule: a lone `left`/`right` sources BOTH side
 * targets (the symmetric shorthand), two defined sides each source their own.
 * The eye pair's `spacing` scalar adds onto each side's `offset` for the
 * spacing targets. The reported `path` names the field the document actually
 * spells (the mirrored source when only one side exists), so a violation is
 * always actionable.
 *
 * Both engine consumers go through this single mapping, so validation paths and
 * morph application can never disagree about what a field means: `validateFace`
 * range-checks each trait at its document `path`, `morphFace` applies each
 * trait's `parameter` target.
 *
 * @evidence requirements/asset-authoring/rig-and-state.md#asset-deformable-surface Converts the anatomy-shaped face input into the named controls that deform the base surface.
 * @evidence specifications/asset-and-representation/rig-deformation-and-state.md#asset-spec-skin-morph-facts Emits deterministic morph names and weights while retaining each authored source path.
 * @author Samchon
 */
export const flattenFace = (face: IAutoMovieFace): IAutoMovieFaceTrait[] => {
  const out: IAutoMovieFaceTrait[] = [];
  for (const { parameter, path, read } of SINGLE) {
    const weight = read(face);
    if (weight !== undefined) out.push({ parameter, path, weight });
  }
  for (const { base, group, leaf, read } of PAIRED) {
    const set = read(face);
    if (set === undefined) continue;
    const pairScalar =
      base === "eyeSpacing" ? (set.spacing as number | undefined) : undefined;
    for (const [suffix, side, other] of [
      ["R", "right", "left"],
      ["L", "left", "right"],
    ] as const) {
      // the side rule: a lone side sources both targets
      const srcSide = set[side] !== undefined ? side : other;
      const value = set[srcSide]?.[leaf];
      if (value === undefined && pairScalar === undefined) continue;
      out.push({
        parameter: `${base}${suffix}` as AutoMovieFaceParameterName,
        path:
          value !== undefined
            ? `${group}.${srcSide}.${leaf}`
            : `${group}.spacing`,
        weight: (value ?? 0) + (pairScalar ?? 0),
      });
    }
  }
  return out;
};
