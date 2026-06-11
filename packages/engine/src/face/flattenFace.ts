import { AutoFilmFaceParameterName, IAutoFilmFace } from "@autofilm/interface";

/**
 * One present leaf of an {@link IAutoFilmFace}, projected onto its morph target:
 * the flat `parameter` name the template carries, the dotted `path` the
 * document spells it at (for violation messages), and the weight.
 */
export interface IAutoFilmFaceTrait {
  /** Morph-target name the trait drives. */
  parameter: AutoFilmFaceParameterName;

  /** Dotted document path of the leaf, e.g. `"jaw.chin.length"`. */
  path: string;

  /** The signed effective weight (shared value plus side override). */
  weight: number;
}

/** Traits with one morph target — symmetric features. */
const SINGLE: {
  parameter: AutoFilmFaceParameterName;
  path: string;
  read: (face: IAutoFilmFace) => number | undefined;
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
 * Traits with one morph target PER SIDE. The pair set's `both` member is the
 * symmetric base driving both targets; a `left`/`right` member adds to its
 * side. `sharedLeaf` names the base field — usually the same leaf inside
 * `both`, but `eyeSpacing` reads the PAIR-level `spacing` (distance between the
 * eyes lives on the set, the per-eye `offset` moves one eye). `base` + `R`/`L`
 * must both exist in {@link AutoFilmFaceParameterName}.
 */
interface ISidedSet {
  both?: { [leaf: string]: number | undefined };
  left?: { [leaf: string]: number | undefined };
  right?: { [leaf: string]: number | undefined };
  [pairLeaf: string]: unknown;
}
const PAIRED: {
  base: string;
  group: string;
  shared: (set: ISidedSet) => number | undefined;
  sharedPath: string;
  leaf: string;
  read: (face: IAutoFilmFace) => ISidedSet | undefined;
}[] = [
  {
    base: "eyeSize",
    group: "eyes",
    shared: (s) => s.both?.size,
    sharedPath: "both.size",
    leaf: "size",
    read: (f) => f.eyes as ISidedSet | undefined,
  },
  {
    base: "eyeWidth",
    group: "eyes",
    shared: (s) => s.both?.width,
    sharedPath: "both.width",
    leaf: "width",
    read: (f) => f.eyes as ISidedSet | undefined,
  },
  {
    base: "eyeSpacing",
    group: "eyes",
    shared: (s) => s.spacing as number | undefined,
    sharedPath: "spacing",
    leaf: "offset",
    read: (f) => f.eyes as ISidedSet | undefined,
  },
  {
    base: "eyeHeight",
    group: "eyes",
    shared: (s) => s.both?.height,
    sharedPath: "both.height",
    leaf: "height",
    read: (f) => f.eyes as ISidedSet | undefined,
  },
  {
    base: "eyeTilt",
    group: "eyes",
    shared: (s) => s.both?.tilt,
    sharedPath: "both.tilt",
    leaf: "tilt",
    read: (f) => f.eyes as ISidedSet | undefined,
  },
  {
    base: "browHeight",
    group: "brows",
    shared: (s) => s.both?.height,
    sharedPath: "both.height",
    leaf: "height",
    read: (f) => f.brows as ISidedSet | undefined,
  },
  {
    base: "cheekFullness",
    group: "cheeks",
    shared: (s) => s.both?.fullness,
    sharedPath: "both.fullness",
    leaf: "fullness",
    read: (f) => f.cheeks as ISidedSet | undefined,
  },
];

/**
 * Project an {@link IAutoFilmFace} onto its morph targets — the nested,
 * anatomy-shaped document flattened to `(parameter, weight)` pairs in
 * declaration order, omitted leaves and groups skipped.
 *
 * Paired features emit one trait per side whose weight is the symmetric base
 * (`both`, or the pair-level `spacing`) plus that side's override; the reported
 * `path` is the most specific contributor (`eyes.left.size` when an override is
 * present, `eyes.both.size` otherwise), so a violation always names a field the
 * document actually spells.
 *
 * Both engine consumers go through this single mapping, so validation paths and
 * morph application can never disagree about what a field means: `validateFace`
 * range-checks each trait at its document `path`, `morphFace` applies each
 * trait's `parameter` target.
 *
 * @author Samchon
 */
export const flattenFace = (face: IAutoFilmFace): IAutoFilmFaceTrait[] => {
  const out: IAutoFilmFaceTrait[] = [];
  for (const { parameter, path, read } of SINGLE) {
    const weight = read(face);
    if (weight !== undefined) out.push({ parameter, path, weight });
  }
  for (const { base, group, shared, sharedPath, leaf, read } of PAIRED) {
    const set = read(face);
    if (set === undefined) continue;
    const sharedWeight = shared(set);
    for (const [suffix, side] of [
      ["R", "right"],
      ["L", "left"],
    ] as const) {
      const override = set[side]?.[leaf];
      if (sharedWeight === undefined && override === undefined) continue;
      out.push({
        parameter: `${base}${suffix}` as AutoFilmFaceParameterName,
        path:
          override !== undefined
            ? `${group}.${side}.${leaf}`
            : `${group}.${sharedPath}`,
        weight: (sharedWeight ?? 0) + (override ?? 0),
      });
    }
  }
  return out;
};
