import {
  AutoMovieHumanoidBone,
  IAutoMovieActionCall,
  IAutoMovieClip,
  IAutoMovieConstraintViolation,
  IAutoMovieInteractionEvent,
  IAutoMovieMotion,
  IAutoMovieScene,
  IAutoMovieSkeleton,
  IAutoMovieTransform,
} from "@automovie/interface";

import { HUMANOID_JOINT_AXES } from "../kinematics/humanoidJointAxes";
import { IAutoMovieRestFrame } from "../rom/restFrame";
import { ViolationCollector } from "../validation/violation";
import { compileAttach } from "./compileAttach";
import { bakedTransformAt, followClipOf } from "./followClip";
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
 *
 * Couplings CHAIN (#1140): a parent that is itself a coupled child this shot (a
 * knight mounted on a horse, carrying a lance) is baked FIRST, and its riders
 * compose onto its baked follow frame per sample instead of its staged
 * placement — through any depth, the same `followClipOf` read the beat-end uses
 * (#989 latest coupling). A coupling CYCLE has no world composition (nobody
 * stands on the ground), so it violates instead of baking frozen couplings
 * silently.
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
  const out = new ViolationCollector();
  const claimed = new Set(
    props.attachments.flatMap((job) => childrenOf(job.action)),
  );
  const mounts = props.mounts.filter((mount) => !claimed.has(mount.node));

  // The shot's coupling graph: coupled child → the parent(s) it rides. An
  // explicit attachTo overrides the child's mount (filtered above), so a
  // claimed child's mount edge is not in the graph.
  const parentsOf = new Map<string, Set<string>>();
  const addEdge = (child: string, parent: string): void => {
    const set = parentsOf.get(child) ?? new Set<string>();
    set.add(parent);
    parentsOf.set(child, set);
  };
  for (const job of props.attachments)
    for (const child of childrenOf(job.action))
      addEdge(child, job.action.parent);
  for (const mount of mounts) addEdge(mount.node, mount.binding.parent);

  // Cycle gate + bake order (#1140): walk each child up its parent edges. A
  // cycle is reported whole (the all-at-once style forgeProp's articulation
  // gate uses) and its members are never baked; the post-order visits every
  // coupled parent before its riders — exactly the order that lets a child
  // sample its parent's already-baked follow clip.
  const order: string[] = [];
  const visited = new Set<string>();
  const cyclic = new Set<string>();
  const visit = (node: string, stack: readonly string[]): void => {
    if (visited.has(node)) return;
    const at = stack.indexOf(node);
    if (at >= 0) {
      const cycle = stack.slice(at);
      for (const member of cycle) cyclic.add(member);
      out.push(
        "type",
        "$input",
        `object couplings form a cycle (${[...cycle, node].join(" → ")}); a coupling chain must end on a parent that rides nothing`,
        cycle,
      );
      return;
    }
    // `node` is always a graph key: the top-level loop iterates the keys and
    // the recursion is gated on `parentsOf.has(parent)`. A cycle return leaves
    // the frame's node unmarked, so the post-order add is unconditional.
    for (const parent of parentsOf.get(node)!)
      if (parentsOf.has(parent)) visit(parent, [...stack, node]);
    visited.add(node);
    order.push(node);
  };
  for (const child of parentsOf.keys()) visit(child, []);

  // Bake parents-first. A parent with no baked follow of its own stands on
  // its staged placement (parentPathOf yields undefined — the static path).
  const bakedByNode = new Map<string, IAutoMovieClip[]>();
  const parentPathOf = (
    parent: string,
  ): ((t: number) => IAutoMovieTransform) | undefined => {
    const clip = followClipOf(bakedByNode.get(parent) ?? [], parent);
    return clip === null
      ? undefined
      : (t: number): IAutoMovieTransform => bakedTransformAt(clip, parent, t);
  };
  const jobsByChild = new Map<string, IAttachJob[]>();
  for (const job of props.attachments)
    for (const child of childrenOf(job.action)) {
      const list = jobsByChild.get(child) ?? [];
      list.push(job);
      jobsByChild.set(child, list);
    }
  const mountByChild = new Map(mounts.map((mount) => [mount.node, mount]));

  const clips: IAutoMovieClip[] = [];
  const events: IAutoMovieInteractionEvent[] = [];
  const keep = (child: string, clip: IAutoMovieClip): void => {
    const list = bakedByNode.get(child) ?? [];
    list.push(clip);
    bakedByNode.set(child, list);
    clips.push(clip);
  };
  for (const child of order) {
    if (cyclic.has(child)) continue; // unresolvable — the violation stands
    const jobs = jobsByChild.get(child);
    if (jobs !== undefined)
      bakeAttachFollows(child, jobs, context, parentPathOf, keep, events);
    else
      bakeMountFollow(
        mountByChild.get(child)!,
        context,
        parentPathOf,
        keep,
        out,
      );
  }
  return { clips, events, violations: out.items };
};

/**
 * Bake one child's per-beat `attachTo` follows and their handoff events. A
 * handoff (the same child attached to two parents over disjoint spans) would
 * bake two clips with one `attach:<child>` id — an uncommittable shot and an
 * ambiguous beat-end follow (#989). Process the child's attachments in START
 * order and suffix repeats (`attach:<child>:2`, ...), so the FIRST occurrence
 * keeps the stable id and the HIGHEST suffix is always the latest coupling —
 * the one `resolveBeatEnd` should follow.
 */
const bakeAttachFollows = (
  child: string,
  jobs: readonly IAttachJob[],
  context: ICoupleContext,
  parentPathOf: (
    parent: string,
  ) => ((t: number) => IAutoMovieTransform) | undefined,
  keep: (child: string, clip: IAutoMovieClip) => void,
  events: IAutoMovieInteractionEvent[],
): void => {
  const ordered = [...jobs].sort((a, b) => a.action.start - b.action.start);
  ordered.forEach((job, occurrence) => {
    const parentNode = context.scene.nodes.find(
      (n) => n.id === job.action.parent,
    )!;
    const parentRig = context.skeleton(job.action.parent)!;
    const end =
      job.action.duration === "auto"
        ? context.duration
        : Math.min(job.action.start + job.action.duration, context.duration);
    events.push(
      ...handoffEvents(
        child,
        job.action.parent,
        job.action.start,
        end,
        job.index,
      ),
    );
    const baked = compileAttach({
      child,
      bone: job.action.bone,
      parentTransform: parentNode.transform,
      parentTransformAt: parentPathOf(job.action.parent),
      parentSkeleton: parentRig,
      parentMotion: context.motions[job.action.parent],
      start: job.action.start,
      duration: end - job.action.start,
      shotDuration: context.duration,
      jointAxes: HUMANOID_JOINT_AXES,
      restFrames: context.restFrames?.(job.action.parent),
    });
    keep(
      child,
      occurrence === 0
        ? baked
        : { ...baked, id: `${baked.id}:${occurrence + 1}` },
    );
  });
};

/**
 * Bake one persistent staged mount (#674): the rider descends through
 * {@link compileAttach}, spanning the whole shot. The parent rig and saddle bone
 * are validated here.
 */
const bakeMountFollow = (
  mount: IAutoMovieStagedSet.IMount,
  context: ICoupleContext,
  parentPathOf: (
    parent: string,
  ) => ((t: number) => IAutoMovieTransform) | undefined,
  keep: (child: string, clip: IAutoMovieClip) => void,
  out: ViolationCollector,
): void => {
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
    return;
  }
  if (!parentRig.bones.some((b) => b.bone === mount.binding.bone)) {
    out.push(
      "type",
      "$staged.mounts",
      mountBoneMessage(mount.binding.bone, mount.binding.parent),
      mount.binding.bone,
    );
    return;
  }
  const parentNode = context.scene.nodes.find(
    (n) => n.id === mount.binding.parent,
  )!;
  keep(
    mount.node,
    compileAttach({
      child: mount.node,
      bone: mount.binding.bone,
      parentTransform: parentNode.transform,
      parentTransformAt: parentPathOf(mount.binding.parent),
      parentSkeleton: parentRig,
      parentMotion: context.motions[mount.binding.parent],
      start: 0,
      duration: context.duration,
      shotDuration: context.duration,
      jointAxes: HUMANOID_JOINT_AXES,
      restFrames: context.restFrames?.(mount.binding.parent),
    }),
  );
};

const mountRiggedMessage = (rider: string, parent: string): string =>
  `mount rider "${rider}" rides "${parent}", which must be a rigged node to carry a saddle bone`;

const mountBoneMessage = (bone: string, parent: string): string =>
  `mount bone "${bone}" is not on ${parent}'s skeleton`;
