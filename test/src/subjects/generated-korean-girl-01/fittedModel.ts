import { mergeAutoMovieMeshes } from "@automovie/engine";
import type { IAutoMovieModel } from "@automovie/interface";

import {
  anatomicalStudyShape,
  buildAnatomicalStudy,
} from "../reference-anatomy/model";
import {
  portraitEyeSockets,
  portraitMouthShape,
  portraitMouthSocket,
} from "./configuration";
import { referenceControlNet } from "./controlNet";
import { buildPortraitEyebrow, portraitEyebrowProfile } from "./eyebrows";
import { buildPortraitHairProxy } from "./hairProxy";
import { buildPortraitMouth } from "./mouth";
import fit from "./surfaceFit.json";

/**
 * Reconstruct the target on one fitted anatomical skin. The CC0 surface and its
 * endpoint/expression basis retain separate provenance; the fitted residual
 * preserves that surface's Z and maps its observed landmarks into the supplied
 * photograph's projection. This remains an unfinished likeness experiment.
 *
 * The native surface owns ears, lids and nasal/oral interiors. Optical centres
 * follow its fit while globes remain rigid. Teeth use fitted oral landmarks;
 * coarse brows query the resulting skin, and coarse hair supplies context only.
 */
export function buildFittedReferencePortrait(
  subdivisionRounds = 1,
): IAutoMovieModel {
  const model = buildAnatomicalStudy(
    { ...anatomicalStudyShape, subdivisionRounds },
    fit,
  );
  const landmarks = referenceControlNet.positions.map((p, id) => {
    const fitted = (fit.landmarks as Record<string, number[]>)[String(id)];
    return [...(fitted ?? p)];
  });
  const skin = mergeAutoMovieMeshes(
    model.parts
      .filter((p) => p.id.startsWith("anatomical-"))
      .map((p) => {
        if (p.geometry.type !== "mesh")
          throw new Error("Anatomical skin must contain resident meshes.");
        return p.geometry.mesh;
      }),
  );
  const positions = Array.from({ length: skin.positions.length / 3 }, (_v, i) =>
    skin.positions.slice(i * 3, i * 3 + 3).map((v) => v * 1000),
  );
  const offset = positions.length;
  positions.push(...landmarks);
  const host = {
    positions,
    indices: skin.indices!,
    groups: new Array(skin.indices!.length / 3).fill(0),
  };
  for (const eye of portraitEyeSockets)
    model.parts.push(
      ...buildPortraitEyebrow(
        host,
        {
          side: eye.name,
          upper: eye.browTop.map((id) => id + offset),
          lower: eye.browBottom.map((id) => id + offset),
        },
        100,
        { ...portraitEyebrowProfile, radius: 0.06, radiusStep: 0.01 },
      ),
    );
  model.parts.push(
    ...buildPortraitMouth(
      landmarks,
      portraitMouthSocket,
      portraitMouthShape,
    ).filter((p) => p.id.startsWith("tooth-")),
    ...buildPortraitHairProxy(positions.slice(0, offset)),
  );
  model.id = "generated-korean-girl-01";
  model.name = "Anatomical reference reconstruction; likeness under review";
  return model;
}
