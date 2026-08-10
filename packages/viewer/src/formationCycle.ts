import {
  IAutoMovieFormationCadenceSegment,
  autoMovieModelGaits,
  gaitMotion,
} from "@automovie/engine";
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
 * 30 ms per step at a walking cadence, and the shader mixes the two
 * neighbouring steps, so the sampling rate bounds interpolation error rather
 * than the visible frame rate.
 */
export const AUTOMOVIE_FORMATION_CYCLE_SAMPLES = 32;

/** Uniform cells shared by every material drawing one unit's cycles. */
export interface IAutoMovieFormationCycleUniforms {
  /** Baked part-matrix table of the take playing now. */
  automovieCycleTexture: { value: THREE.DataTexture };
  /** Columns in the table: samples across one cycle. */
  automovieCycleSamples: { value: number };
  /** Rows in the table: three per part. */
  automovieCycleRows: { value: number };
  /** Cycles the unit's own travel has turned over by the current time. */
  automovieCycleAdvance: { value: number };
  /** Cycles per meter of member radius the unit's turning has turned over. */
  automovieCycleTurn: { value: number };
}

/**
 * One gait of a figure's repertoire, baked into a rigid part-matrix table.
 *
 * A take carries the two numbers that decide how fast it is played as well as
 * the table that says what it looks like, because those numbers are properties
 * of the cycle itself: how far one turn of it carries a body, and how long one
 * turn of it lasts when nothing carries the body at all.
 */
export interface IAutoMovieFormationCycleTake {
  /** Name of the gait this take was baked from. */
  gait: string;
  /**
   * Ground meters one turn of this cycle carries a member.
   *
   * Measured from the bake rather than authored, so no field can drift out of
   * step with the motion it describes: the part that reaches lowest through the
   * cycle is the one that meets the ground, and the ground moves under it at
   * exactly the speed the body travels. Its horizontal path over one closed
   * cycle is twice the sweep it makes, and the fraction of the cycle it spends
   * in the lower half of its own rise is the fraction of the cycle it is
   * planted for, so the sweep divided by that fraction is what one whole cycle
   * carries the body.
   *
   * Zero when the cycle carries a body nowhere: an idle, a salute, a figure
   * with nothing to plant. Such a take is played on {@link periodSeconds}
   * instead, which is the only honest reading of a cycle no ground drives.
   */
  strideMeters: number;
  /** Seconds one turn takes when no ground drives it: the gait's own period. */
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
}

/**
 * One figure's repertoire, baked once and replayed by every member that wears
 * it.
 *
 * An anonymous member is not a scene node: it has no skeleton to pose and no
 * player to drive it, only a 64-byte instance matrix and a phase scalar. What
 * it can still do is carry tables that say where each of its rigid parts sits
 * at every point of a cycle, and let the vertex stage look the playing one up
 * at the position its unit's cues have reached. The tables are per LOD tier, so
 * ten members and a hundred thousand members cost the same bake.
 *
 * Members differ only in where they are in the cycle, never in the cycle
 * itself, which is exactly the shape a crowd has: one figure, many phases. What
 * they perform, and how fast, belongs to the unit and changes with its cues.
 */
export interface IAutoMovieFormationCycle {
  /** Even samples across one cycle; sample `samples` wraps to sample zero. */
  samples: number;
  /** Rigid part names in the order the `automoviePart` attribute indexes them. */
  names: readonly string[];
  /** Every gait this figure declares, by name. */
  takes: ReadonlyMap<string, IAutoMovieFormationCycleTake>;
  /** Take performed where a cue calls for no gait this figure declares. */
  fallback: IAutoMovieFormationCycleTake;
  /** Take the last written frame selected. */
  active: IAutoMovieFormationCycleTake;
  /** Uniform cells shared by every material drawing this figure. */
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
 * The cycle a runtime model performs by default, or null when it performs none.
 *
 * A gait is declarative profile data ({@link IAutoMovieGait}): per-limb phase,
 * duty and amplitude, the same rows the engine synthesises a named performer's
 * locomotion from. The first declared one is what a unit performs until a cue
 * calls for another.
 *
 * A model with no skeleton, or with no profile that locomotes, has no cycle at
 * all and keeps standing exactly as it did before.
 */
export const formationCycleGait = (
  model: IAutoMovieModel,
): IAutoMovieGait | null => autoMovieModelGaits(model)[0] ?? null;

/**
 * Bake one runtime model's whole repertoire into rigid part-matrix tables.
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
  /** Even samples across the cycle. */
  samples?: number;
}): IAutoMovieFormationCycle | null => {
  const skeleton = input.model.skeleton;
  const gaits = autoMovieModelGaits(input.model);
  if (skeleton === null || gaits.length === 0) return null;
  const samples = input.samples ?? AUTOMOVIE_FORMATION_CYCLE_SAMPLES;
  const rest = input.parts.map((part) => part.matrixWorld.clone().invert());
  // The point of a part that can meet the ground: the bottom of its own box,
  // in its own space, so the bake follows the surface a foot stands on rather
  // than the pivot it swings about.
  const soles = input.parts.map((part) => {
    part.geometry.computeBoundingBox();
    const box = part.geometry.boundingBox!;
    return new THREE.Vector3(
      (box.min.x + box.max.x) / 2,
      box.min.y,
      (box.min.z + box.max.z) / 2,
    );
  });
  const takes = gaits.map((gait) => {
    const clip = gaitMotion(
      `${input.model.id}:${gait.name}`,
      skeleton.id,
      gait,
      samples,
    );
    const matrices = new Float32Array(input.parts.length * 3 * samples * 4);
    const tracks = input.parts.map(() => [] as THREE.Vector3[]);
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
        tracks[index]!.push(
          soles[index]!.clone().applyMatrix4(part.matrixWorld),
        );
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
    // an optional extension, and the two-step blend the shader performs itself
    // is the same arithmetic with none of the capability risk.
    texture.minFilter = THREE.NearestFilter;
    texture.magFilter = THREE.NearestFilter;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.generateMipmaps = false;
    texture.colorSpace = THREE.NoColorSpace;
    texture.needsUpdate = true;
    return {
      gait: gait.name,
      strideMeters: formationCycleStride(tracks),
      periodSeconds: gait.period,
      matrices,
      texture,
    };
  });
  const fallback = takes[0]!;
  return {
    samples,
    names: input.parts.map((part) => part.name),
    takes: new Map(takes.map((take) => [take.gait, take] as const)),
    fallback,
    active: fallback,
    uniforms: {
      automovieCycleTexture: { value: fallback.texture },
      automovieCycleSamples: { value: samples },
      automovieCycleRows: { value: input.parts.length * 3 },
      automovieCycleAdvance: { value: 0 },
      automovieCycleTurn: { value: 0 },
    },
  };
};

/**
 * Ground meters one baked cycle carries a body, measured from the bake itself.
 *
 * The part that reaches lowest through the cycle is the one that meets the
 * ground: a foot, a hoof, a paw, whatever the figure happens to stand on. While
 * that part is planted the ground runs backwards under it at exactly the speed
 * the body runs forwards, so the sweep it makes is the ground the body covers
 * over the part of the cycle it is planted for, and the whole cycle covers that
 * sweep divided by that fraction.
 *
 * Both quantities come out of the track rather than out of a declaration. The
 * closed horizontal path is twice the sweep, since the part returns to where it
 * started. The planted fraction is how much of the cycle the part spends in the
 * lower half of its own rise, which is a statement about a figure standing on
 * the ground rather than about any rig's axis convention or joint sign.
 *
 * A track that never moves horizontally returns zero, and a figure with no
 * parts returns zero: nothing is carried anywhere, and the caller plays such a
 * cycle on its own declared period.
 */
export const formationCycleStride = (
  tracks: ReadonlyArray<readonly THREE.Vector3[]>,
): number => {
  let planted: readonly THREE.Vector3[] | null = null;
  let lowest = Number.POSITIVE_INFINITY;
  for (const track of tracks) {
    const bottom = Math.min(...track.map((point) => point.y));
    if (bottom >= lowest) continue;
    lowest = bottom;
    planted = track;
  }
  if (planted === null) return 0;
  const path = planted.reduce((sum, point, index) => {
    const next = planted![(index + 1) % planted!.length]!;
    return sum + Math.hypot(next.x - point.x, next.z - point.z);
  }, 0);
  if (path === 0) return 0;
  const heights = planted.map((point) => point.y);
  const middle = (Math.min(...heights) + Math.max(...heights)) / 2;
  const grounded =
    heights.filter((height) => height <= middle).length / heights.length;
  return path / 2 / grounded;
};

/** Cycles one unit has turned over, and the take it is performing now. */
export interface IAutoMovieFormationCadence {
  /** Take playing at the sampled time. */
  take: IAutoMovieFormationCycleTake;
  /** Cycles every member has turned over by the unit's own travel. */
  advance: number;
  /** Cycles per meter of member radius turned over by the unit's turning. */
  turn: number;
}

/**
 * Fold one unit's cue segments into the cycles its members have turned over.
 *
 * The two accumulators are what a member needs and all it needs: everyone in a
 * unit covers the unit's travel, while a turn carries a member over ground
 * proportional to its own distance from the pivot, so the outer file of a
 * wheeling unit steps as many times as the ground under it requires and the
 * inner file steps fewer. A member composes them from its own radius.
 *
 * Segments are folded rather than sampled because stride belongs to the take:
 * where a unit walks one cue and runs the next, the second cue's ground is
 * counted in the second cue's strides. That is also what keeps a change of
 * action from jumping the cycle, since everything already turned over stays
 * turned over.
 *
 * A take that carries a body nowhere is played on its own period instead, which
 * is the difference between a crowd standing at ease and a crowd frozen.
 */
export const formationCycleCadence = (
  cycle: IAutoMovieFormationCycle,
  segments: readonly IAutoMovieFormationCadenceSegment[],
): IAutoMovieFormationCadence => {
  let take = cycle.fallback;
  let advance = 0;
  let turn = 0;
  for (const segment of segments) {
    take =
      (segment.gait === null ? undefined : cycle.takes.get(segment.gait)) ??
      cycle.fallback;
    if (take.strideMeters > 0) {
      advance += segment.distance / take.strideMeters;
      turn += segment.turn / take.strideMeters;
    } else advance += segment.seconds / take.periodSeconds;
  }
  return { take, advance, turn };
};

/**
 * Write one unit's current cadence into the cells its materials read.
 *
 * The whole per-frame cost of an animated crowd: two floats and a texture
 * handle, once per tier. Nothing is written per member, and nothing carries
 * over from the previous frame, so the same time always draws the same frame.
 */
export const applyFormationCycleCadence = (
  cycle: IAutoMovieFormationCycle,
  segments: readonly IAutoMovieFormationCadenceSegment[],
): IAutoMovieFormationCadence => {
  const cadence = formationCycleCadence(cycle, segments);
  cycle.active = cadence.take;
  cycle.uniforms.automovieCycleTexture.value = cadence.take.texture;
  cycle.uniforms.automovieCycleAdvance.value = cadence.advance;
  cycle.uniforms.automovieCycleTurn.value = cadence.turn;
  return cadence;
};

/**
 * Where one member stands in its cycle, in `[0, 1)`.
 *
 * Phase is the slot's compiled `motionPhase`, derived from the formation seed
 * and the slot index, so the member that leads the stride leads it on every
 * machine and in every run. What is added to it is the ground its unit has
 * covered, expressed in cycles. No clock is read, and nothing accumulates
 * between frames: the same cues at the same time always resolve to the same
 * point of the cycle, which is what makes a re-render byte-identical.
 */
export const formationCyclePosition = (
  cadence: Pick<IAutoMovieFormationCadence, "advance" | "turn">,
  phase: number,
  /** The member's distance from its unit's origin, in meters. */
  radius = 0,
): number => {
  const raw = phase + cadence.advance + radius * cadence.turn;
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
  take: IAutoMovieFormationCycleTake = cycle.active,
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
    take.matrices[((part * 3 + row) * cycle.samples + sample) * 4 + column]!;
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
 * Teach one material to place its vertices at each member's own cycle position.
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

// A member's own radius comes out of the instance matrix it already carries,
// which is stated relative to the unit's origin: the pivot a turning cue turns
// the unit about. So the ground a turn covers is per member without a byte of
// per-member storage. A material drawn outside an instanced batch has no
// member to be, and stands at the pivot.
const CYCLE_PARS = `
uniform sampler2D automovieCycleTexture;
uniform float automovieCycleSamples;
uniform float automovieCycleRows;
uniform float automovieCycleAdvance;
uniform float automovieCycleTurn;
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

float automovieCycleRadius() {
  #ifdef USE_INSTANCING
    return length(instanceMatrix[3].xz);
  #else
    return 0.0;
  #endif
}

mat4 automovieCycleMatrix() {
  float scaled =
    fract(
      automoviePhase +
      automovieCycleAdvance +
      automovieCycleRadius() * automovieCycleTurn
    ) * automovieCycleSamples;
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
