import {
  AutoMovieArkitChannel,
  AutoMovieExpressionPreset,
  IAutoMovieExpression,
} from "@automovie/interface";
import * as THREE from "three";

import { IAutoMovieModelObject } from "./buildModel";

/** VRM preset names the viewer resets and drives every expression frame. */
const AUTOMOVIE_EXPRESSION_PRESETS = [
  "neutral",
  "happy",
  "angry",
  "sad",
  "relaxed",
  "surprised",
  "aa",
  "ih",
  "ou",
  "ee",
  "oh",
  "blink",
  "blinkLeft",
  "blinkRight",
  "lookUp",
  "lookDown",
  "lookLeft",
  "lookRight",
] as const satisfies readonly AutoMovieExpressionPreset[];

/** ARKit channel names the viewer can address directly on morph dictionaries. */
const AUTOMOVIE_ARKIT_CHANNELS = [
  "eyeBlinkLeft",
  "eyeLookDownLeft",
  "eyeLookInLeft",
  "eyeLookOutLeft",
  "eyeLookUpLeft",
  "eyeSquintLeft",
  "eyeWideLeft",
  "eyeBlinkRight",
  "eyeLookDownRight",
  "eyeLookInRight",
  "eyeLookOutRight",
  "eyeLookUpRight",
  "eyeSquintRight",
  "eyeWideRight",
  "jawForward",
  "jawLeft",
  "jawRight",
  "jawOpen",
  "mouthClose",
  "mouthFunnel",
  "mouthPucker",
  "mouthLeft",
  "mouthRight",
  "mouthSmileLeft",
  "mouthSmileRight",
  "mouthFrownLeft",
  "mouthFrownRight",
  "mouthDimpleLeft",
  "mouthDimpleRight",
  "mouthStretchLeft",
  "mouthStretchRight",
  "mouthRollLower",
  "mouthRollUpper",
  "mouthShrugLower",
  "mouthShrugUpper",
  "mouthPressLeft",
  "mouthPressRight",
  "mouthLowerDownLeft",
  "mouthLowerDownRight",
  "mouthUpperUpLeft",
  "mouthUpperUpRight",
  "browDownLeft",
  "browDownRight",
  "browInnerUp",
  "browOuterUpLeft",
  "browOuterUpRight",
  "cheekPuff",
  "cheekSquintLeft",
  "cheekSquintRight",
  "noseSneerLeft",
  "noseSneerRight",
  "tongueOut",
] as const satisfies readonly AutoMovieArkitChannel[];

const EXPRESSION_RESET_NAMES: readonly string[] = [
  ...AUTOMOVIE_EXPRESSION_PRESETS,
  ...AUTOMOVIE_ARKIT_CHANNELS,
];

const PRESET_CHANNELS: Partial<
  Record<AutoMovieExpressionPreset, readonly [AutoMovieArkitChannel, number][]>
> = {
  happy: [
    ["mouthSmileLeft", 1],
    ["mouthSmileRight", 1],
    ["cheekSquintLeft", 0.35],
    ["cheekSquintRight", 0.35],
  ],
  angry: [
    ["browDownLeft", 1],
    ["browDownRight", 1],
    ["eyeSquintLeft", 0.35],
    ["eyeSquintRight", 0.35],
  ],
  sad: [
    ["mouthFrownLeft", 0.75],
    ["mouthFrownRight", 0.75],
    ["browInnerUp", 0.45],
  ],
  relaxed: [
    ["eyeSquintLeft", 0.25],
    ["eyeSquintRight", 0.25],
    ["mouthSmileLeft", 0.2],
    ["mouthSmileRight", 0.2],
  ],
  surprised: [
    ["browInnerUp", 1],
    ["eyeWideLeft", 0.8],
    ["eyeWideRight", 0.8],
    ["jawOpen", 0.75],
  ],
  aa: [["jawOpen", 1]],
  ih: [
    ["jawOpen", 0.35],
    ["mouthSmileLeft", 0.45],
    ["mouthSmileRight", 0.45],
  ],
  ou: [
    ["mouthFunnel", 0.8],
    ["mouthPucker", 0.55],
  ],
  ee: [
    ["mouthSmileLeft", 0.75],
    ["mouthSmileRight", 0.75],
  ],
  oh: [
    ["jawOpen", 0.6],
    ["mouthFunnel", 0.75],
  ],
  blink: [
    ["eyeBlinkLeft", 1],
    ["eyeBlinkRight", 1],
  ],
  blinkLeft: [["eyeBlinkLeft", 1]],
  blinkRight: [["eyeBlinkRight", 1]],
  lookUp: [
    ["eyeLookUpLeft", 1],
    ["eyeLookUpRight", 1],
  ],
  lookDown: [
    ["eyeLookDownLeft", 1],
    ["eyeLookDownRight", 1],
  ],
  lookLeft: [
    ["eyeLookOutLeft", 1],
    ["eyeLookInRight", 1],
  ],
  lookRight: [
    ["eyeLookInLeft", 1],
    ["eyeLookOutRight", 1],
  ],
};

/**
 * Apply a sampled automovie expression to a viewer model.
 *
 * VRM-style expression targets receive preset and ARKit names directly.
 * Imported meshes with `morphTargetDictionary` receive exact or
 * case-insensitive matching names; generated primitive models simply no-op.
 *
 * @author Samchon
 */
export const applyExpression = (
  target: IAutoMovieModelObject,
  expression: IAutoMovieExpression | null,
): void => {
  const weights = expressionWeights(expression);
  applyMorphTargets(target.object, weights);
  for (const sink of target.expressionTargets ?? []) {
    for (const name of EXPRESSION_RESET_NAMES) sink.setExpressionValue(name, 0);
    for (const [name, weight] of weights) sink.setExpressionValue(name, weight);
  }
};

/** Convert a semantic expression into direct channel weights. */
const expressionWeights = (
  expression: IAutoMovieExpression | null,
): ReadonlyMap<string, number> => {
  const weights = new Map<string, number>();
  if (expression === null) return weights;

  const intensity = clamp01(expression.intensity);
  if (expression.preset !== "neutral") {
    setMax(weights, expression.preset, intensity);
    for (const [channel, factor] of PRESET_CHANNELS[expression.preset] ?? [])
      setMax(weights, channel, intensity * factor);
  }
  for (const blendshape of expression.blendshapes ?? [])
    weights.set(blendshape.channel, clamp01(blendshape.weight));
  return weights;
};

const applyMorphTargets = (
  root: THREE.Object3D,
  weights: ReadonlyMap<string, number>,
): void => {
  root.traverse((object) => {
    const mesh = object as THREE.Mesh & {
      morphTargetDictionary?: Record<string, number>;
      morphTargetInfluences?: number[];
    };
    if (
      mesh.isMesh !== true ||
      mesh.morphTargetDictionary === undefined ||
      mesh.morphTargetInfluences === undefined
    )
      return;

    const dictionary = mesh.morphTargetDictionary;
    const influences = mesh.morphTargetInfluences;
    const folded = new Map(
      Object.entries(dictionary).map(([name, index]) => [
        name.toLowerCase(),
        index,
      ]),
    );
    const setInfluence = (name: string, weight: number): void => {
      const index = dictionary[name] ?? folded.get(name.toLowerCase());
      if (index !== undefined && index < influences.length)
        influences[index] = weight;
    };

    for (const name of EXPRESSION_RESET_NAMES) setInfluence(name, 0);
    for (const [name, weight] of weights) setInfluence(name, weight);
  });
};

const setMax = (weights: Map<string, number>, name: string, weight: number) => {
  weights.set(name, Math.max(weights.get(name) ?? 0, clamp01(weight)));
};

const clamp01 = (value: number): number =>
  Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
