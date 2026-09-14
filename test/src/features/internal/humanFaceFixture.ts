import {
  type IAutoMovieHumanFaceDocument,
  portraitEarShape,
} from "@automovie/human";

import {
  portraitEyeShape,
  portraitEyeSockets,
  portraitMouthShape,
  portraitMouthSocket,
  portraitNoseShape,
  portraitNoseSocket,
} from "../../subjects/generated-korean-girl-01/configuration";
import { referenceControlNet } from "../../subjects/generated-korean-girl-01/controlNet";

/** A typed in-memory document for state and interpretation scenarios, without a renderer. */
export const humanFaceFixture = (
  id = "unit-face",
): IAutoMovieHumanFaceDocument => ({
  version: "human-face/1",
  id,
  name: id,
  basis: {
    id: "unit-observed-basis",
    topology: "mediapipe-478/1",
    host: structuredClone({
      positions: referenceControlNet.positions,
      indices: referenceControlNet.indices,
      viewRay: referenceControlNet.viewRay,
    }),
    bindings: structuredClone({
      eyes: { right: portraitEyeSockets[0], left: portraitEyeSockets[1] },
      nose: portraitNoseSocket,
      mouth: portraitMouthSocket,
    }),
    recipe: structuredClone({
      eye: portraitEyeShape,
      nose: portraitNoseShape,
      mouth: portraitMouthShape,
    }),
    expression: {},
  },
});

/** Smallest sampled complete face for assembly scenarios; detailed geometry has its own unit cases. */
export const coarseHumanFaceFixture = (
  id: string,
): IAutoMovieHumanFaceDocument => {
  const document = humanFaceFixture(id);
  document.basis.recipe.eye = {
    ...document.basis.recipe.eye,
    browFibres: 0,
    upperLashes: 1,
    sampling: { eyeColumns: 4, eyeRows: 2, irisColumns: 6, irisRows: 2 },
  };
  delete document.basis.recipe.eye.lowerLidProfile;
  delete document.basis.recipe.eye.aegyoSal;
  delete document.basis.recipe.eye.skinAttachment;
  document.basis.recipe.mouth.crowns = [];
  document.basis.recipe.ear = {
    ...portraitEarShape,
    sampling: { columns: 12, frontRows: 8, backRows: 6 },
  };
  document.basis.expression = { lipPart: 10 };
  return document;
};
