import {
  IMoticaChannelLimit,
  IMoticaClip,
  IMoticaDriver,
  IMoticaNode,
  IMoticaTransform,
} from "@motica/interface";

import { IMoticaClampViolation, applyChannelLimit } from "./applyChannelLimit";
import { channelKey } from "./channel";
import { composeScene } from "./composeScene";
import { resolveDrivers } from "./resolveDrivers";
import { IMoticaSampledChannel, sampleClip } from "./sampleClip";

/** Everything needed to resolve one instant of a scene. */
export interface IMoticaResolveInput {
  /** The scene graph: nodes with parent-local rest transforms. */
  nodes: IMoticaNode[];

  /** The clip animating the scene this frame, or `null` for the rest pose. */
  clip: IMoticaClip | null;

  /** Channel limits to clamp sampled values against (generalized ROM). */
  limits: IMoticaChannelLimit[];

  /**
   * Drivers computing channels from other channels. Channel-space drivers
   * (`copy`, `driven`) are resolved this frame; world-space/stateful ones are
   * returned in {@link IMoticaResolveOutput.deferredDrivers}. Omit for none.
   */
  drivers?: IMoticaDriver[];

  /** The instant to resolve, in clip-local seconds. */
  seconds: number;
}

/** A clamp that fired this frame, tagged with the channel it constrained. */
export interface IMoticaResolveViolation extends IMoticaClampViolation {
  /** The {@link channelKey} of the channel that was clamped. */
  channel: string;
}

/** The resolved frame: world matrices, morph weights, and any clamps fired. */
export interface IMoticaResolveOutput {
  /** Node id → world matrix (`number[16]`, column-major). */
  world: Map<string, number[]>;

  /** Node id → morph-target weights, for nodes whose `weights` channel animated. */
  weights: Map<string, number[]>;

  /** Every constraint breach that was clamped, in channel/component order. */
  violations: IMoticaResolveViolation[];

  /**
   * World-space / stateful drivers (`parent`/`aim`/`ik`/`spring`) this pass did
   * not resolve — surfaced (not dropped) for the world-space driver pass.
   */
  deferredDrivers: IMoticaDriver[];
}

/**
 * Resolve one frame of a scene: SAMPLE the clip, DRIVE the channel-space
 * drivers, CONSTRAIN the values to their channel limits, then COMPOSE the node
 * hierarchy into world matrices.
 *
 * This is the engine's per-frame entry point and the deterministic core of
 * motica: given the same scene, clip, limits, drivers, and time it always
 * yields the same matrices — the property that makes the renderer a
 * reproducible diffusion alternative. World-space/stateful drivers
 * (`parent`/`aim`/`ik`/`spring`) are not applied here; they are surfaced in
 * `deferredDrivers` for the world-space pass that runs after an initial
 * compose.
 *
 * @author Samchon
 */
export const resolveFrame = (
  input: IMoticaResolveInput,
): IMoticaResolveOutput => {
  const sampled: Map<string, IMoticaSampledChannel> =
    input.clip === null ? new Map() : sampleClip(input.clip, input.seconds);

  // DRIVE: resolve channel-space drivers into the sampled map; collect the
  // world-space ones the next pass owns.
  const nodesById = new Map(input.nodes.map((n) => [n.id, n]));
  const deferredDrivers =
    input.drivers !== undefined
      ? resolveDrivers(input.drivers, sampled, nodesById)
      : [];

  // CONSTRAIN: clamp each sampled channel that carries a limit, in place.
  const violations: IMoticaResolveViolation[] = [];
  for (const limit of input.limits) {
    const key = channelKey(limit.channel);
    const hit = sampled.get(key);
    if (hit === undefined) continue;
    const outcome = applyChannelLimit(hit.value, limit);
    hit.value = outcome.value;
    for (const v of outcome.violations) violations.push({ ...v, channel: key });
  }

  // Fold node-targeting samples into per-node transform overrides + weights.
  const overrides = new Map<string, IMoticaTransform>();
  const weights = new Map<string, number[]>();
  for (const node of input.nodes) {
    const t = sampled.get(`node:${node.id}:translation`);
    const r = sampled.get(`node:${node.id}:rotation`);
    const s = sampled.get(`node:${node.id}:scale`);
    if (t !== undefined || r !== undefined || s !== undefined)
      overrides.set(node.id, {
        translation: t ? toVec3(t.value) : node.transform.translation,
        rotation: r ? toQuat(r.value) : node.transform.rotation,
        scale: s ? toVec3(s.value) : node.transform.scale,
      });
    const w = sampled.get(`node:${node.id}:weights`);
    if (w !== undefined) weights.set(node.id, w.value);
  }

  return {
    world: composeScene(input.nodes, overrides),
    weights,
    violations,
    deferredDrivers,
  };
};

const toVec3 = (a: number[]) => ({ x: a[0]!, y: a[1]!, z: a[2]! });
const toQuat = (a: number[]) => ({ x: a[0]!, y: a[1]!, z: a[2]!, w: a[3]! });
