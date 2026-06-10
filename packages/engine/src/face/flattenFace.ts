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

  /** The signed weight as written in the document. */
  weight: number;
}

/**
 * The one place the anatomy-shaped document meets the flat morph-target
 * vocabulary: every leaf trait, its document path, and how to read it.
 */
const TRAITS: {
  parameter: AutoFilmFaceParameterName;
  path: string;
  read: (face: IAutoFilmFace) => number | undefined;
}[] = [
  { parameter: "faceWidth", path: "width", read: (f) => f.width },
  { parameter: "faceLength", path: "length", read: (f) => f.length },
  {
    parameter: "cheekFullness",
    path: "cheeks.fullness",
    read: (f) => f.cheeks?.fullness,
  },
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
  { parameter: "eyeSize", path: "eyes.size", read: (f) => f.eyes?.size },
  { parameter: "eyeWidth", path: "eyes.width", read: (f) => f.eyes?.width },
  {
    parameter: "eyeSpacing",
    path: "eyes.spacing",
    read: (f) => f.eyes?.spacing,
  },
  { parameter: "eyeHeight", path: "eyes.height", read: (f) => f.eyes?.height },
  { parameter: "eyeTilt", path: "eyes.tilt", read: (f) => f.eyes?.tilt },
  {
    parameter: "browHeight",
    path: "brows.height",
    read: (f) => f.brows?.height,
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
 * Project an {@link IAutoFilmFace} onto its morph targets — the nested,
 * anatomy-shaped document flattened to `(parameter, weight)` pairs in
 * declaration order, omitted leaves and groups skipped.
 *
 * Both engine consumers go through this single mapping, so validation paths and
 * morph application can never disagree about what a field means: `validateFace`
 * range-checks each trait at its document `path`, `morphFace` applies each
 * trait's `parameter` target.
 *
 * @author Samchon
 */
export const flattenFace = (face: IAutoFilmFace): IAutoFilmFaceTrait[] =>
  TRAITS.flatMap(({ parameter, path, read }) => {
    const weight = read(face);
    return weight === undefined ? [] : [{ parameter, path, weight }];
  });
