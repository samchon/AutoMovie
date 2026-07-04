import {
  AutoMovieHeadParameterName,
  IAutoMovieHead,
} from "@automovie/interface";

/**
 * Per-group field → morph-name map: how each anatomy-grouped
 * {@link IAutoMovieHead} leaf projects onto its flat
 * {@link AutoMovieHeadParameterName}. The grouping is for the LLM's benefit; the
 * forge consumes the flat names.
 */
const MAP: Record<string, Record<string, AutoMovieHeadParameterName>> = {
  shape: {
    width: "faceWidth",
    length: "faceLength",
    oval: "faceOval",
    round: "headRound",
    foreheadSlope: "foreheadSlope",
    foreheadHeight: "foreheadHeight",
    foreheadBulge: "foreheadBulge",
    templeWidth: "templeWidth",
    occiputDepth: "occiputDepth",
  },
  brow: { height: "browHeight", angle: "browAngle" },
  eyes: {
    size: "eyeSize",
    openness: "eyeHeight",
    spacing: "eyeSpacing",
    tilt: "eyeAngle",
    depth: "eyeDepth",
    epicanthus: "epicanthus",
    fold: "eyeFold",
  },
  nose: {
    width: "noseWidth",
    length: "noseLength",
    projection: "noseProject",
    hump: "noseHump",
    tipAngle: "nosePoint",
    nostrilWidth: "nostrilWidth",
    baseHeight: "noseBaseH",
    bridge: "noseBridge",
  },
  mouth: {
    width: "mouthWidth",
    lipFullness: "lipFull",
    upperLipHeight: "upperLipH",
    lowerLipHeight: "lowerLipH",
    cupidsBow: "cupidsBow",
    philtrum: "philtrum",
    height: "mouthHeight",
    smile: "mouthSmile",
  },
  cheek: { fullness: "cheekFull", bones: "cheekBones" },
  jaw: {
    width: "jawWidth",
    drop: "jawDrop",
    chinLength: "chinLength",
    chinWidth: "chinWidth",
    chinProjection: "chinProject",
  },
};

/**
 * Project an anatomy-grouped {@link IAutoMovieHead} document onto the flat morph
 * weights {@link AutoMovieHeadParameterName} the forge `morphHead` applies.
 *
 * Omitted groups and fields are skipped (they stay neutral), so the result
 * carries only the traits the document set. The map covers every leaf exactly
 * once; no field is invented and none is dropped.
 *
 * @author Samchon
 */
export const flattenHead = (
  doc: IAutoMovieHead,
): Partial<Record<AutoMovieHeadParameterName, number>> => {
  const out: Partial<Record<AutoMovieHeadParameterName, number>> = {};
  for (const group of Object.keys(MAP)) {
    const fields = (doc as Record<string, Record<string, number> | undefined>)[
      group
    ];
    if (fields === undefined) continue;
    const names = MAP[group]!;
    for (const field of Object.keys(names)) {
      const value = fields[field];
      if (value !== undefined) out[names[field]!] = value;
    }
  }
  return out;
};
