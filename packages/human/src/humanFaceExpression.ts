import type { IAutoMovieHumanFaceExpression } from "./IAutoMovieHumanFaceDocument";

/**
 * Authoring ranges for independent performance channels. These are supported
 * kinematic controls, not medical population limits or detector probabilities.
 *
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-expression Gives the editor explicit neutral, side and unit semantics for performance.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-expression Separates closure, gaze, perioral movement and mandibular angle.
 */
export const humanFaceExpressionDefinitions = [
  {
    id: "blink",
    label: "Eyelid closure",
    unit: "fraction",
    minimum: 0,
    maximum: 1,
    step: 0.01,
    neutral: 0,
    paired: true,
  },
  {
    id: "browRaise",
    label: "Brow elevation",
    unit: "mm",
    minimum: -6,
    maximum: 8,
    step: 0.1,
    neutral: 0,
    paired: true,
  },
  {
    id: "smile",
    label: "Mouth-corner elevation",
    unit: "mm",
    minimum: -5,
    maximum: 8,
    step: 0.1,
    neutral: 0,
    paired: true,
  },
  {
    id: "jawOpen",
    label: "Mandibular opening",
    unit: "degrees",
    minimum: 0,
    maximum: 25,
    step: 0.5,
    neutral: 0,
    paired: false,
  },
  {
    id: "lipPart",
    label: "Lip separation",
    unit: "mm",
    minimum: 0,
    maximum: 30,
    step: 0.1,
    neutral: 0,
    paired: false,
  },
  {
    id: "pucker",
    label: "Lip protrusion",
    unit: "mm",
    minimum: 0,
    maximum: 4,
    step: 0.1,
    neutral: 0,
    paired: false,
  },
  {
    id: "gazePitch",
    label: "Upward gaze",
    unit: "degrees",
    minimum: -20,
    maximum: 20,
    step: 0.5,
    neutral: 0,
    paired: true,
  },
  {
    id: "gazeYaw",
    label: "Leftward gaze",
    unit: "degrees",
    minimum: -25,
    maximum: 25,
    step: 0.5,
    neutral: 0,
    paired: true,
  },
] as const;

/**
 * Expand omitted performance channels to explicit neutral values and refuse
 * inactive spellings or values outside the supported envelope. Paired channels
 * remain independent; omission on one side never copies the opposite side.
 *
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-expression Keeps expression independent from identity and resolves explicit side defaults.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-expression Admits finite performance before anatomical geometry is allocated.
 */
export function resolveHumanFaceExpression(
  input: IAutoMovieHumanFaceExpression = {},
): Required<{
  [K in keyof IAutoMovieHumanFaceExpression]: IAutoMovieHumanFaceExpression[K] extends
    | number
    | undefined
    ? number
    : { right: number; left: number };
}> {
  const output = {} as ReturnType<typeof resolveHumanFaceExpression>;
  for (const key of Object.keys(input))
    if (
      !humanFaceExpressionDefinitions.some(
        (definition) => definition.id === key,
      )
    )
      throw new Error(`Unknown face expression: ${key}.`);
  for (const definition of humanFaceExpressionDefinitions) {
    const value = input[definition.id];
    const admit = (number: number): number => {
      if (
        !Number.isFinite(number) ||
        number < definition.minimum ||
        number > definition.maximum
      )
        throw new Error(
          `${definition.id} must be finite in [${definition.minimum},${definition.maximum}] ${definition.unit}.`,
        );
      return number;
    };
    if (definition.paired) {
      if (
        value !== undefined &&
        (value === null ||
          typeof value !== "object" ||
          Array.isArray(value) ||
          Object.keys(value).some((key) => key !== "right" && key !== "left"))
      )
        throw new Error(
          `${definition.id} must use explicit anatomical right/left channels.`,
        );
      const pair = value as { right?: number; left?: number } | undefined;
      output[definition.id] = {
        right: admit(pair?.right === undefined ? 0 : pair.right),
        left: admit(pair?.left === undefined ? 0 : pair.left),
      };
    } else {
      if (value !== undefined && typeof value !== "number")
        throw new Error(
          `${definition.id} must be a scalar performance channel.`,
        );
      output[definition.id] = admit(value ?? 0);
    }
  }
  return output;
}
