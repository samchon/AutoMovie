import {
  AutoMovieHumanoidBone,
  IAutoMovieActionCall,
  IAutoMovieClip,
  IAutoMovieConstraintViolation,
  IAutoMovieInteractionEvent,
  IAutoMovieMotion,
  IAutoMovieScene,
  IAutoMovieSkeleton,
} from "@automovie/interface";

import { HUMANOID_JOINT_AXES } from "../kinematics/humanoidJointAxes";
import { IAutoMovieRestFrame } from "../rom/restFrame";
import { ViolationCollector } from "../validation/violation";
import { compileAttach } from "./compileAttach";
import { handoffEvents } from "./handoffEvents";
import { IAutoMovieStagedSet } from "./stageScene";

/** One validated `attachTo` job: the coupling and its source action index. */
export interface IAttachJob {
  action: IAutoMovieActionCall & { verb: "attachTo" };
  index: number;
}

/** The per-node lookups a follow bake needs from the compiled shot. */
interface ICoupleContext {
  scene: IAutoMovieScene;
  motions: Record<string, IAutoMovieMotion>;
  skeleton: (node: string) => IAutoMovieSkeleton | null;
  restFrames?: (
    node: string,
  ) => Partial<Record<AutoMovieHumanoidBone, IAutoMovieRestFrame>> | undefined;
  duration: number;
}

const childrenOf = (action: IAutoMovieActionCall): string[] =>
  typeof action.actor === "string" ? [action.actor] : action.actor;

/**
 * Bake the object couplings a shot carries — the per-beat `attachTo` handoffs
 * and the persistent staged `mounts` (#674) — into follow clips once the
 * parents' poses have compiled. Lives in its own module because it is the hot
 * region {@link performShot} kept growing.
 *
 * `attachTo` (already validated in the action scan) rides the child on the
 * parent's bone in scene space and emits the grab/attach/detach/release
 * {@link handoffEvents}. Each staged `mount` descends through the SAME baker,
 * spanning the whole shot, so a rider rides every beat without re-issuing
 * `attachTo`; an explicit `attachTo` for the same child this beat overrides its
 * mount, and a mount emits no handoff events (standing scene state, not a
 * per-shot pickup). A mount's parent rig and bone are validated here — staging
 * placed the parent but had no skeletons — and returned as violations.
 */
export const coupleObjects = (props: {
  attachments: readonly IAttachJob[];
  mounts: readonly IAutoMovieStagedSet.IMount[];
  scene: IAutoMovieScene;
  motions: Record<string, IAutoMovieMotion>;
  skeleton: (node: string) => IAutoMovieSkeleton | null;
  restFrames?: (
    node: string,
  ) => Partial<Record<AutoMovieHumanoidBone, IAutoMovieRestFrame>> | undefined;
  duration: number;
}): {
  clips: IAutoMovieClip[];
  events: IAutoMovieInteractionEvent[];
  violations: IAutoMovieConstraintViolation[];
} => {
  const context: ICoupleContext = {
    scene: props.scene,
    motions: props.motions,
    skeleton: props.skeleton,
    restFrames: props.restFrames,
    duration: props.duration,
  };
  const attached = bakeAttachFollows(props.attachments, context);
  const claimed = new Set(
    props.attachments.flatMap((job) => childrenOf(job.action)),
  );
  const mounted = bakeMountFollows(props.mounts, claimed, context);
  return {
    clips: [...attached.clips, ...mounted.clips],
    events: attached.events,
    violations: mounted.violations,
  };
};

/** Bake the per-beat `attachTo` follows and their handoff events. */
const bakeAttachFollows = (
  attachments: readonly IAttachJob[],
  context: ICoupleContext,
): { clips: IAutoMovieClip[]; events: IAutoMovieInteractionEvent[] } => {
  const clips: IAutoMovieClip[] = [];
  const events: IAutoMovieInteractionEvent[] = [];
  // A handoff (the same child attached to two parents over disjoint spans)
  // would bake two clips with one `attach:<child>` id — an uncommittable shot
  // and an ambiguous beat-end follow (#989). Process attachments in START
  // order and suffix repeats (`attach:<child>:2`, ...), so the FIRST
  // occurrence keeps the stable id and the HIGHEST suffix is always the
  // latest coupling — the one `resolveBeatEnd` should follow.
  const occurrences = new Map<string, number>();
  const ordered = [...attachments].sort(
    (a, b) => a.action.start - b.action.start,
  );
  for (const job of ordered) {
    const parentNode = context.scene.nodes.find(
      (n) => n.id === job.action.parent,
    )!;
    const parentRig = context.skeleton(job.action.parent)!;
    const end =
      job.action.duration === "auto"
        ? context.duration
        : Math.min(job.action.start + job.action.duration, context.duration);
    for (const child of childrenOf(job.action)) {
      events.push(
        ...handoffEvents(
          child,
          job.action.parent,
          job.action.start,
          end,
          job.index,
        ),
      );
      const count = (occurrences.get(child) ?? 0) + 1;
      occurrences.set(child, count);
      const baked = compileAttach({
        child,
        bone: job.action.bone,
        parentTransform: parentNode.transform,
        parentSkeleton: parentRig,
        parentMotion: context.motions[job.action.parent],
        start: job.action.start,
        duration: end - job.action.start,
        shotDuration: context.duration,
        jointAxes: HUMANOID_JOINT_AXES,
        restFrames: context.restFrames?.(job.action.parent),
      });
      clips.push(
        count === 1 ? baked : { ...baked, id: `${baked.id}:${count}` },
      );
    }
  }
  return { clips, events };
};

/**
 * Bake the persistent staged mounts (#674): each rider not already claimed by
 * an `attachTo` this beat descends through {@link compileAttach}, spanning the
 * whole shot. The parent rig and saddle bone are validated here.
 */
const bakeMountFollows = (
  mounts: readonly IAutoMovieStagedSet.IMount[],
  claimed: ReadonlySet<string>,
  context: ICoupleContext,
): { clips: IAutoMovieClip[]; violations: IAutoMovieConstraintViolation[] } => {
  const clips: IAutoMovieClip[] = [];
  const out = new ViolationCollector();
  for (const mount of mounts) {
    if (claimed.has(mount.node)) continue;
    // Staging validated the parent is a placed actor, so it is always a scene
    // node (the `!` below); the rig and bone are the mount's own preconditions.
    const parentRig = context.skeleton(mount.binding.parent);
    if (parentRig === null) {
      out.push(
        "type",
        "$staged.mounts",
        mountRiggedMessage(mount.node, mount.binding.parent),
        mount.binding.parent,
      );
      continue;
    }
    if (!parentRig.bones.some((b) => b.bone === mount.binding.bone)) {
      out.push(
        "type",
        "$staged.mounts",
        mountBoneMessage(mount.binding.bone, mount.binding.parent),
        mount.binding.bone,
      );
      continue;
    }
    const parentNode = context.scene.nodes.find(
      (n) => n.id === mount.binding.parent,
    )!;
    clips.push(
      compileAttach({
        child: mount.node,
        bone: mount.binding.bone,
        parentTransform: parentNode.transform,
        parentSkeleton: parentRig,
        parentMotion: context.motions[mount.binding.parent],
        start: 0,
        duration: context.duration,
        shotDuration: context.duration,
        jointAxes: HUMANOID_JOINT_AXES,
        restFrames: context.restFrames?.(mount.binding.parent),
      }),
    );
  }
  return { clips, violations: out.items };
};

const mountRiggedMessage = (rider: string, parent: string): string =>
  `mount rider "${rider}" rides "${parent}", which must be a rigged node to carry a saddle bone`;

const mountBoneMessage = (bone: string, parent: string): string =>
  `mount bone "${bone}" is not on ${parent}'s skeleton`;
