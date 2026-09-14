import type {
  IAutoMovieHumanFaceControls,
  IAutoMovieHumanFaceRecipe,
} from "./IAutoMovieHumanFaceDocument";
import { portraitNeckShape } from "./components/cranium";
import { resolvePortraitCraniumShape } from "./components/craniumShape";
import { portraitEarShape } from "./components/ears";
import { resolvePortraitFacialFrameShape } from "./components/facialFrame";

/**
 * Intermediate trait inventory shared by admission and the numerical editor.
 * Ranges are authoring envelopes, not measurements of a population's anatomy.
 *
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-controls-replacement Gives intermediate face controls stable identifiers, units, defaults and signed effects.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-controls Shares the finite control ranges between input admission and editing.
 */
export const humanFaceControlDefinitions = [
  {
    id: "faceWidth",
    region: "frame",
    label: "Facial width",
    unit: "ratio offset",
    minimum: -0.2,
    maximum: 0.2,
    step: 0.01,
    neutral: 0,
    effect:
      "Positive widens the shared facial foundation; negative narrows it.",
  },
  {
    id: "faceLength",
    region: "frame",
    label: "Facial length",
    unit: "ratio offset",
    minimum: -0.2,
    maximum: 0.2,
    step: 0.01,
    neutral: 0,
    effect:
      "Positive lengthens the face about the nasion; negative shortens it.",
  },
  {
    id: "eyeWidth",
    region: "eyes",
    label: "Aperture width",
    unit: "ratio offset",
    minimum: -0.4,
    maximum: 0.4,
    step: 0.01,
    neutral: 0,
    effect: "Positive widens the identity aperture; negative narrows it.",
  },
  {
    id: "eyeHeight",
    region: "eyes",
    label: "Aperture height",
    unit: "ratio offset",
    minimum: -0.4,
    maximum: 0.4,
    step: 0.01,
    neutral: 0,
    effect:
      "Positive increases identity opening; negative reduces it. This is not blink.",
  },
  {
    id: "eyeTilt",
    region: "eyes",
    label: "Outer canthus lift",
    unit: "mm",
    minimum: -4,
    maximum: 4,
    step: 0.1,
    neutral: 0,
    effect: "Positive raises the outer corner; negative lowers it.",
  },
  {
    id: "noseWidth",
    region: "nose",
    label: "Nasal width",
    unit: "ratio offset",
    minimum: -0.4,
    maximum: 0.4,
    step: 0.01,
    neutral: 0,
    effect:
      "Positive widens the nasal exterior and bound cavities; negative narrows them.",
  },
  {
    id: "noseProjection",
    region: "nose",
    label: "Tip projection",
    unit: "mm",
    minimum: -8,
    maximum: 8,
    step: 0.1,
    neutral: 0,
    effect: "Positive advances the nasal tip; negative recesses it.",
  },
  {
    id: "mouthWidth",
    region: "mouth",
    label: "Oral width",
    unit: "ratio offset",
    minimum: -0.4,
    maximum: 0.4,
    step: 0.01,
    neutral: 0,
    effect: "Positive widens the oral boundary; negative narrows it.",
  },
  {
    id: "upperLipProjection",
    region: "mouth",
    label: "Upper lip projection",
    unit: "mm",
    minimum: -3,
    maximum: 3,
    step: 0.05,
    neutral: 0,
    effect: "Positive advances upper vermilion; negative recesses it.",
  },
  {
    id: "lowerLipProjection",
    region: "mouth",
    label: "Lower lip projection",
    unit: "mm",
    minimum: -3,
    maximum: 3,
    step: 0.05,
    neutral: 0,
    effect: "Positive advances lower vermilion; negative recesses it.",
  },
  {
    id: "cheekProjection",
    region: "cheeks",
    label: "Cheek projection",
    unit: "mm",
    minimum: -5,
    maximum: 5,
    step: 0.1,
    neutral: 0,
    effect: "Positive fills malar and medial support; negative recesses it.",
  },
  {
    id: "craniumWidth",
    region: "cranium",
    label: "Cranial width",
    unit: "ratio offset",
    minimum: -0.3,
    maximum: 0.3,
    step: 0.01,
    neutral: 0,
    effect: "Positive widens cranial sections; negative narrows them.",
  },
  {
    id: "craniumHeight",
    region: "cranium",
    label: "Crown height",
    unit: "mm",
    minimum: -20,
    maximum: 20,
    step: 0.5,
    neutral: 0,
    effect:
      "Positive raises the superior cranial envelope; negative lowers it.",
  },
  {
    id: "earHeight",
    region: "ears",
    label: "Pinna height",
    unit: "ratio offset",
    minimum: -0.3,
    maximum: 0.3,
    step: 0.01,
    neutral: 0,
    effect: "Positive elongates the pinna vertically; negative shortens it.",
  },
  {
    id: "neckWidth",
    region: "neck",
    label: "Cervical width",
    unit: "ratio offset",
    minimum: -0.3,
    maximum: 0.3,
    step: 0.01,
    neutral: 0,
    effect: "Positive widens cervical sections; negative narrows them.",
  },
] as const satisfies readonly {
  id: keyof IAutoMovieHumanFaceControls;
  region: string;
  label: string;
  unit: string;
  minimum: number;
  maximum: number;
  step: number;
  neutral: number;
  effect: string;
}[];

/**
 * Apply intermediate offsets to a copied recipe before detailed overrides.
 * Unknown or out-of-envelope controls refuse rather than becoming inactive
 * sliders. Part builders subsequently validate the combined detailed result.
 *
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-controls-replacement Applies independent intermediate traits while preserving the original recipe.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-controls Enforces finite ranges and a fixed trait interpretation before detail replacement.
 */
export function applyHumanFaceControls(
  basis: IAutoMovieHumanFaceRecipe,
  chinY: number,
  controls: IAutoMovieHumanFaceControls = {},
): IAutoMovieHumanFaceRecipe {
  const recipe = structuredClone(basis);
  for (const [key, value] of Object.entries(controls)) {
    const definition = humanFaceControlDefinitions.find(
      (entry) => entry.id === key,
    );
    if (
      definition === undefined ||
      (value !== undefined &&
        (!Number.isFinite(value) ||
          value < definition.minimum ||
          value > definition.maximum))
    )
      throw new Error(`Invalid intermediate face control: ${key}.`);
  }
  recipe.eye.widthScale *= 1 + (controls.eyeWidth ?? 0);
  if (controls.faceWidth !== undefined || controls.faceLength !== undefined) {
    recipe.frame = resolvePortraitFacialFrameShape(recipe.frame);
    recipe.frame.widthScale! *= 1 + (controls.faceWidth ?? 0);
    recipe.frame.lengthScale! *= 1 + (controls.faceLength ?? 0);
  }
  recipe.eye.openingScale *= 1 + (controls.eyeHeight ?? 0);
  recipe.eye.outerCornerLift += controls.eyeTilt ?? 0;
  recipe.nose.widthScale *= 1 + (controls.noseWidth ?? 0);
  recipe.nose.tipProjection += controls.noseProjection ?? 0;
  recipe.mouth.widthScale *= 1 + (controls.mouthWidth ?? 0);
  recipe.mouth.upperLipProjection += controls.upperLipProjection ?? 0;
  recipe.mouth.lowerLipProjection += controls.lowerLipProjection ?? 0;
  if (
    controls.cheekProjection !== undefined &&
    controls.cheekProjection !== 0
  ) {
    if (recipe.cheek === undefined)
      throw new Error("Cheek projection requires a cheek profile.");
    recipe.cheek.malar.projection += controls.cheekProjection;
    recipe.cheek.medial.projection += controls.cheekProjection;
  }
  if (
    controls.craniumWidth !== undefined ||
    controls.craniumHeight !== undefined
  ) {
    const shape = resolvePortraitCraniumShape(chinY, recipe.cranium);
    recipe.cranium = {
      ...shape,
      stations: shape.stations.map((station) => ({
        ...station,
        width: station.width * (1 + (controls.craniumWidth ?? 0)),
        crown: station.crown + (controls.craniumHeight ?? 0),
      })),
    };
  }
  if (controls.earHeight !== undefined) {
    recipe.ear = structuredClone(recipe.ear ?? portraitEarShape);
    recipe.ear.heightScale *= 1 + controls.earHeight;
  }
  if (controls.neckWidth !== undefined) {
    recipe.neck = structuredClone(recipe.neck ?? portraitNeckShape);
    for (const section of [
      recipe.neck.upper,
      recipe.neck.lower,
      recipe.neck.crop,
    ])
      section.width *= 1 + controls.neckWidth;
  }
  return recipe;
}
