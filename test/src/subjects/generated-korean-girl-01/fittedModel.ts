import { mergeAutoMovieMeshes } from "@automovie/engine";
import type { IAutoMovieModel } from "@automovie/interface";

import { portraitPart, portraitPoint } from "../geometry";
import { assertPortraitFitBasis } from "../portraitFitBasis";
import {
  anatomicalStudyShape,
  buildAnatomicalStudy,
} from "../reference-anatomy/model";
import {
  portraitDentalPlacement,
  portraitDentalRow,
  portraitDentalSocket,
  portraitEyeSockets,
  portraitHairShape,
} from "./configuration";
import { referenceControlNet } from "./controlNet";
import { attachPortraitDentalRow, buildPortraitDentalRow } from "./dentalRow";
import { buildPortraitEyebrow, portraitEyebrowProfile } from "./eyebrows";
import { buildPortraitHairProxy } from "./hairProxy";
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
  // The continuous fitted field can be evaluated at another tessellation, but
  // it remains defined against the exact captured source sampling and current
  // construction/target. Rebuild that basis for admission; a stale residual
  // must not silently survive an upstream geometry or observation change.
  const sourceBasis = buildAnatomicalStudy({
    ...anatomicalStudyShape,
    subdivisionRounds: fit.basis.sourceSubdivisionRounds,
  });
  const encoder = new TextEncoder();
  assertPortraitFitBasis(
    fit.basis,
    encoder.encode(JSON.stringify(sourceBasis)),
    encoder.encode(JSON.stringify(referenceControlNet)),
  );
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
  const oralPoint = (id: number) =>
    portraitPoint(landmarks[id][0], landmarks[id][1], landmarks[id][2]);
  model.parts.push(
    portraitPart(
      "tooth-upper-arch",
      attachPortraitDentalRow(buildPortraitDentalRow(portraitDentalRow), {
        rightCorner: oralPoint(portraitDentalSocket.rightCorner),
        leftCorner: oralPoint(portraitDentalSocket.leftCorner),
        upperLipMiddle: oralPoint(portraitDentalSocket.upperLipMiddle),
        up: portraitPoint(0, 1, 0),
        ...portraitDentalPlacement,
      }),
      "teeth",
    ),
    ...buildPortraitHairProxy(
      positions.slice(0, offset),
      undefined,
      [],
      portraitHairShape,
    ),
  );
  model.id = "generated-korean-girl-01";
  model.name = "Anatomical reference reconstruction; likeness under review";
  return model;
}
