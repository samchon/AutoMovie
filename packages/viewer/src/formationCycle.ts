import { gaitMotion } from "@automovie/engine";
import { IAutoMovieGait, IAutoMovieModel } from "@automovie/interface";
import * as THREE from "three";

import { applyPose } from "./applyPose";
import { IAutoMovieModelObject } from "./buildModel";

/**
 * Even samples baked across one anonymous cycle.
 *
 * The bake is a table of rigid part matrices, not of vertices, so its size
 * follows the part count rather than the mesh: doubling the samples of a
 * thirteen-bone figure costs tens of kilobytes once per LOD tier and nothing
 * per member. Thirty-two steps put a full cycle inside a frame budget of about
 * 30 ms per step at the widest compiled period, and the shader mixes the two
 * neighbouring steps, so the sampling rate bounds interpolation error rather
 * than the visible frame rate.
 */
export const AUTOMOVIE_FORMATION_CYCLE_SAMPLES = 32;

/** Uniform cells shared by every material drawing one baked cycle. */
export interface IAutoMovieFormationCycleUniforms {
  /** Baked part-matrix table. */
  automovieCycleTexture: { value: THREE.DataTexture };
  /** Columns in the table: samples across one cycle. */
  automovieCycleSamples: { value: number };
  /** Rows in the table: three per part. */
  automovieCycleRows: { value: number };
  /** Seconds one cycle takes. */
  automovieCyclePeriod: { value: number };
  /** Current shot-local time, the one cell an update writes. */
  automovieCycleTime: { value: number };
}

/**
 * One figure's cycle, baked once and replayed by every member that wears it.
 *
 * An anonymous member is not a scene node: it has no skeleton to pose and no
 * player to drive it, only a 64-byte instance matrix and a phase scalar. What
 * it can still do is carry a table that says where each of its rigid parts sits
 * at every point of one cycle, and let the vertex stage look that table up at
 * `phase + time`. The table is per LOD tier, so ten members and a hundred
 * thousand members cost the same bake.
 *
 * Members differ only in where they are in the cycle, never in the cycle
 * itself, which is exactly the shape a crowd has: one figure, many phases.
 */
export interface IAutoMovieFormationCycle {
  /** Name of the gait the cycle was baked from. */
  gait: string;
  /** Even samples across one cycle; sample `samples` wraps to sample zero. */
  samples: number;
  /** Rigid part names in the order the `automoviePart` attribute indexes them. */
  names: readonly string[];
  /** Seconds one cycle takes, from the compiled formation phase contract. */
  periodSeconds: number;
  /**
   * Part matrices exactly as the texture stores them.
   *
   * `((part * 3 + row) * samples + sample) * 4 + column` reads one element of
   * the rest-to-posed matrix of `part` at `sample`. The bottom row is implied
   * rather than stored: a rigid part never shears the homogeneous coordinate.
   */
  matrices: Float32Array;
  /** GPU-side view of {@link matrices}. */
  texture: THREE.DataTexture;
  /** Uniform cells shared by every material drawing this cycle. */
  uniforms: IAutoMovieFormationCycleUniforms;
}

/**
 * Rigid parts of a built runtime model, in the one order instancing indexes.
 *
 * The merged instance geometry stamps each vertex with its part index and the
 * cycle bake writes one matrix row per part, so the two have to walk the model
 * the same way or every member wears another member's arm. They walk it here.
 */
export const instancedModelParts = (root: THREE.Object3D): THREE.Mesh[] => {
  const parts: THREE.Mesh[] = [];
  root.traverse((object) => {
    if ((object as THREE.Mesh).isMesh === true)
      parts.push(object as THREE.Mesh);
  });
  return parts;
};

/**
 * The cycle a runtime model performs, or null when it performs none.
 *
 * A gait is declarative profile data ({@link IAutoMovieGait}): per-limb phase,
 * duty and amplitude, the same rows the engine synthesises a named performer's
 * locomotion from. Taking the first declared gait of the first profile that
 * declares one keeps the choice in the recipe, where an author already orders
 * them, instead of in a viewer that would have to guess what a crowd is doing.
 *
 * A model with no skeleton, or with no profile that locomotes, has no cycle at
 * all and keeps standing exactly as it did before.
 */
export const formationCycleGait = (
  model: IAutoMovieModel,
): IAutoMovieGait | null => {
  for (const profile of model.profiles ?? [])
    for (const gait of profile.gaits ?? []) return gait;
  return null;
};

/**
 * Bake one runtime model's cycle into a rigid part-matrix table.
 *
 * `built` must already be at rest with its world matrices current, because the
 * merged instance geometry was baked from exactly those rest matrices: what is
 * stored per sample is `posed * rest⁻¹`, the transform that carries a
 * rest-space vertex to where the cycle puts it. The object is left at the last
 * sampled pose; callers extract geometry before baking, never after.
 *
 * The pose comes from {@link gaitMotion}, whose keyframe `i` of `samples` sits
 * exactly at cycle position `i / samples`, and is applied through the same
 * {@link applyPose} a named performer goes through, so an anonymous member and a
 * promoted one at the same phase strike the same attitude.
 */
export const bakeFormationCycle = (input: {
  /** Runtime model the parts belong to. */
  model: IAutoMovieModel;
  /** Built model, at rest, with world matrices current. */
  built: IAutoMovieModelObject;
  /** Rigid parts from {@link instancedModelParts}. */
  parts: readonly THREE.Mesh[];
  /** Positive seconds one cycle takes. */
  periodSeconds: number;
  /** Even samples across the cycle. */
  samples?: number;
}): IAutoMovieFormationCycle | null => {
  const skeleton = input.model.skeleton;
  const gait = formationCycleGait(input.model);
  if (skeleton === null || gait === null) return null;
  if (
    Number.isFinite(input.periodSeconds) === false ||
    input.periodSeconds <= 0
  )
    throw new RangeError(
      `Runtime model "${input.model.id}" cannot animate on a cycle period of ${input.periodSeconds} seconds.`,
    );
  const samples = input.samples ?? AUTOMOVIE_FORMATION_CYCLE_SAMPLES;
  const rest = input.parts.map((part) => part.matrixWorld.clone().invert());
  const clip = gaitMotion(
    `${input.model.id}:${gait.name}`,
    skeleton.id,
    gait,
    samples,
  );
  const matrices = new Float32Array(input.parts.length * 3 * samples * 4);
  const posed = new THREE.Matrix4();
  for (let sample = 0; sample < samples; ++sample) {
    applyPose(input.built, clip.keyframes[sample]!.pose, skeleton);
    input.built.object.updateMatrixWorld(true);
    input.parts.forEach((part, index) => {
      const elements = posed.multiplyMatrices(
        part.matrixWorld,
        rest[index]!,
      ).elements;
      for (let row = 0; row < 3; ++row)
        for (let column = 0; column < 4; ++column)
          matrices[((index * 3 + row) * samples + sample) * 4 + column] =
            elements[column * 4 + row]!;
    });
  }
  const texture = new THREE.DataTexture(
    matrices,
    samples,
    input.parts.length * 3,
    THREE.RGBAFormat,
    THREE.FloatType,
  );
  // Nearest sampling on purpose: linear filtering of 32-bit float textures is
  // an optional extension, and the two-step blend the shader performs itself is
  // the same arithmetic with none of the capability risk.
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.generateMipmaps = false;
  texture.colorSpace = THREE.NoColorSpace;
  texture.needsUpdate = true;
  return {
    gait: gait.name,
    samples,
    names: input.parts.map((part) => part.name),
    periodSeconds: input.periodSeconds,
    matrices,
    texture,
    uniforms: {
      automovieCycleTexture: { value: texture },
      automovieCycleSamples: { value: samples },
      automovieCycleRows: { value: input.parts.length * 3 },
      automovieCyclePeriod: { value: input.periodSeconds },
      automovieCycleTime: { value: 0 },
    },
  };
};

/**
 * Where one member stands in its cycle, in `[0, 1)`.
 *
 * Phase is the slot's compiled `motionPhase`, derived from the formation seed
 * and the slot index, so the member that leads the stride leads it on every
 * machine and in every run. Time is shot-local clip time. No clock is read, and
 * nothing accumulates between frames: the same time always resolves to the same
 * point of the cycle, which is what makes a re-render byte-identical.
 */
export const formationCyclePosition = (
  cycle: Pick<IAutoMovieFormationCycle, "periodSeconds">,
  phase: number,
  time: number,
): number => {
  const raw = time / cycle.periodSeconds + phase;
  return raw - Math.floor(raw);
};

/**
 * The rest-to-posed matrix of one part at one cycle position.
 *
 * This is the arithmetic the vertex stage runs, kept here in one readable
 * place: the two neighbouring samples are read and mixed, and the last sample
 * mixes back into the first so the cycle closes. Measurement scripts, tests,
 * and reviewers get the exact number a frame drew instead of a screenshot.
 */
export const sampleFormationCycleMatrix = (
  cycle: IAutoMovieFormationCycle,
  part: number,
  position: number,
): THREE.Matrix4 => {
  if (
    Number.isSafeInteger(part) === false ||
    part < 0 ||
    part >= cycle.names.length
  )
    throw new RangeError(
      `Formation cycle part ${part} is outside 0..${cycle.names.length - 1}.`,
    );
  const wrapped = position - Math.floor(position);
  const scaled = wrapped * cycle.samples;
  const first = Math.floor(scaled);
  const blend = scaled - first;
  const second = (first + 1) % cycle.samples;
  const read = (sample: number, row: number, column: number): number =>
    cycle.matrices[((part * 3 + row) * cycle.samples + sample) * 4 + column]!;
  const mix = (row: number, column: number): number =>
    read(first, row, column) * (1 - blend) + read(second, row, column) * blend;
  return new THREE.Matrix4().set(
    mix(0, 0),
    mix(0, 1),
    mix(0, 2),
    mix(0, 3),
    mix(1, 0),
    mix(1, 1),
    mix(1, 2),
    mix(1, 3),
    mix(2, 0),
    mix(2, 1),
    mix(2, 2),
    mix(2, 3),
    0,
    0,
    0,
    1,
  );
};

/** The cycle an instanced mesh performs, or null when it performs none. */
export const formationCycleOf = (
  object: THREE.Object3D,
): IAutoMovieFormationCycle | null =>
  (object.userData.automovieFormationCycle as
    | IAutoMovieFormationCycle
    | undefined) ?? null;

/**
 * Teach one material to place its vertices at each member's own cycle phase.
 *
 * Injection rather than a bespoke material, because a formation is drawn by
 * more than one material over a shot's life: the lit beauty material, and the
 * depth, normal, mask and outline overrides a guide pass swaps in. A pass that
 * kept the rest pose while beauty marched would make a review frame describe a
 * film that does not exist, so every one of them goes through here.
 *
 * The transform is applied in model space, before three's own instancing step
 * consumes `transformed`, so the member is posed and then placed rather than
 * the other way round. Normals are rotated by the same matrix, which keeps the
 * shading and the silhouette shells honest about the moving surface.
 */
export const applyFormationCycleMaterial = (
  material: THREE.Material,
  cycle: IAutoMovieFormationCycle,
): void => {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, cycle.uniforms);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>\n${CYCLE_PARS}`)
      .replace(
        "#include <beginnormal_vertex>",
        `#include <beginnormal_vertex>\n${CYCLE_NORMAL}`,
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>\n${CYCLE_POSITION}`,
      );
  };
  // Without a distinct cache key three would hand this material the program it
  // already compiled for the same material class without the injection, and
  // the crowd would freeze for reasons invisible in the source.
  material.customProgramCacheKey = () => CYCLE_PROGRAM_KEY;
  material.needsUpdate = true;
};

const CYCLE_PROGRAM_KEY = "automovie-formation-cycle";

const CYCLE_PARS = `
uniform sampler2D automovieCycleTexture;
uniform float automovieCycleSamples;
uniform float automovieCycleRows;
uniform float automovieCyclePeriod;
uniform float automovieCycleTime;
attribute float automoviePhase;
attribute float automoviePart;

mat4 automovieCycleSampleAt(const in float column, const in float part) {
  float u = (column + 0.5) / automovieCycleSamples;
  float row = part * 3.0;
  vec4 a = texture2D(automovieCycleTexture, vec2(u, (row + 0.5) / automovieCycleRows));
  vec4 b = texture2D(automovieCycleTexture, vec2(u, (row + 1.5) / automovieCycleRows));
  vec4 c = texture2D(automovieCycleTexture, vec2(u, (row + 2.5) / automovieCycleRows));
  return mat4(
    a.x, b.x, c.x, 0.0,
    a.y, b.y, c.y, 0.0,
    a.z, b.z, c.z, 0.0,
    a.w, b.w, c.w, 1.0
  );
}

mat4 automovieCycleMatrix() {
  float scaled =
    fract(automovieCycleTime / automovieCyclePeriod + automoviePhase) *
    automovieCycleSamples;
  float first = floor(scaled);
  float blend = scaled - first;
  return automovieCycleSampleAt(first, automoviePart) * (1.0 - blend) +
    automovieCycleSampleAt(mod(first + 1.0, automovieCycleSamples), automoviePart) *
      blend;
}
`;

const CYCLE_NORMAL = `
objectNormal = mat3(automovieCycleMatrix()) * objectNormal;
`;

const CYCLE_POSITION = `
transformed = (automovieCycleMatrix() * vec4(transformed, 1.0)).xyz;
`;
