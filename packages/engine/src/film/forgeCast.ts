import {
  IAutoMovieConstraintViolation,
  IAutoMovieForgeApplication,
  IAutoMovieModel,
  IAutoMovieScriptApplication,
  IAutoMovieSkeleton,
} from "@automovie/interface";

import { validateModel } from "../validation/validateModel";
import { ViolationCollector } from "../validation/violation";

/**
 * A forged cast: every stand-in rig validated and keyed by the cast node it
 * embodies, ready for the staged scene's `modelRef ?? node` join.
 *
 * @author Samchon
 */
export type IAutoMovieForgedCast =
  | IAutoMovieForgedCast.ISuccess
  | IAutoMovieForgedCast.IFailure;
export namespace IAutoMovieForgedCast {
  /** Every stand-in exists, joins its cast member, and passed validation. */
  export interface ISuccess {
    /** Discriminator. */
    success: true;

    /** Validated stand-ins, keyed by cast node id. */
    models: Record<string, IAutoMovieModel>;
  }

  /** The forge contradicted the script or a rig failed validation. */
  export interface IFailure {
    /** Discriminator. */
    success: false;

    /** Every violation found, for the correction round. */
    violations: IAutoMovieConstraintViolation[];
  }
}

/**
 * The FORGE consumer — accept the stand-in rigs the forge stage built for the
 * script's `modelRef: null` cast members, and gate them on both contracts:
 *
 * The **casting contract**: exactly one entry per stand-in cast member (a
 * missing rig is an actor with no body; a rig for an imported-`modelRef` member
 * or for a stranger contradicts the script), and each entry's model `id` must
 * equal its cast `node` — that id is the join the staged scene's `modelRef ??
 * node` fallback resolves against.
 *
 * The **rig contract**: `validateModel` covers parts/materials/extents (its
 * violations are remapped onto the entry's path); on top of it a performer
 * needs a skeleton whose graph actually hangs together — every parent named
 * exists, no bone is declared twice, exactly one root, and every bone is
 * reachable from that root (a two-bone cycle floating off the hierarchy would
 * satisfy all the local checks and still be unposable).
 */
export const forgeCast = (
  script: IAutoMovieScriptApplication.IWrite,
  forge: IAutoMovieForgeApplication.IWrite,
): IAutoMovieForgedCast => {
  const out = new ViolationCollector();
  const cast = new Map(script.cast.map((c) => [c.node, c]));

  const seen = new Set<string>();
  forge.entries.forEach((entry, i) => {
    const ep = `$input.entries[${i}]`;
    const member = cast.get(entry.node);
    if (member === undefined) {
      out.push(
        "type",
        `${ep}.node`,
        `entry must name a script cast node, but "${entry.node}" is not in the cast`,
        entry.node,
      );
      return;
    }
    if (member.modelRef !== null)
      out.push(
        "type",
        `${ep}.node`,
        `cast node "${entry.node}" already has modelRef "${member.modelRef}" (an imported asset) and must not be forged`,
        entry.node,
      );
    if (seen.has(entry.node))
      out.push(
        "type",
        `${ep}.node`,
        `cast node "${entry.node}" is forged more than once`,
        entry.node,
      );
    seen.add(entry.node);

    if (entry.model.id !== entry.node)
      out.push(
        "type",
        `${ep}.model.id`,
        `model id must equal the cast node "${entry.node}" (the staged scene joins on it), but was "${entry.model.id}"`,
        entry.model.id,
      );
    if (entry.model.origin !== "generated")
      out.push(
        "type",
        `${ep}.model.origin`,
        `a forged stand-in's origin must be "generated", but was "${entry.model.origin}"`,
        entry.model.origin,
      );

    if (entry.model.skeleton === null)
      out.push(
        "type",
        `${ep}.model.skeleton`,
        "a stand-in performer needs a skeleton — a boneless model cannot be posed",
        entry.model.skeleton,
      );
    else
      validateSkeletonGraph(entry.model.skeleton, `${ep}.model.skeleton`, out);

    const validated = validateModel({ model: entry.model });
    if (validated.success === false)
      for (const violation of validated.violations)
        out.items.push({
          ...violation,
          path: violation.path.replace("$input", `${ep}.model`),
        });
  });

  script.cast.forEach((member, i) => {
    if (member.modelRef === null && !seen.has(member.node))
      out.push(
        "type",
        "$input.entries",
        `cast node "${member.node}" (cast[${i}]) has no modelRef and must be forged`,
        member.node,
      );
  });

  if (out.items.length > 0) return { success: false, violations: out.items };

  const models: Record<string, IAutoMovieModel> = {};
  for (const entry of forge.entries) models[entry.node] = entry.model;
  return { success: true, models };
};

/**
 * Structural integrity of a skeleton as a graph: unique bone names, resolvable
 * parents, exactly one root, and full reachability from that root. Local field
 * validity (rest transforms, constraints) is the pose/ROM validators' concern.
 */
const validateSkeletonGraph = (
  skeleton: IAutoMovieSkeleton,
  path: string,
  out: ViolationCollector,
): void => {
  const names = new Set<string>();
  const roots: string[] = [];
  skeleton.bones.forEach((bone, i) => {
    if (names.has(bone.bone))
      out.push(
        "type",
        `${path}.bones[${i}].bone`,
        `bone "${bone.bone}" is declared more than once`,
        bone.bone,
      );
    names.add(bone.bone);
    if (bone.parent === null) roots.push(bone.bone);
  });
  skeleton.bones.forEach((bone, i) => {
    if (bone.parent !== null && !names.has(bone.parent))
      out.push(
        "type",
        `${path}.bones[${i}].parent`,
        `parent "${bone.parent}" is not a bone of this skeleton`,
        bone.parent,
      );
  });
  if (roots.length !== 1) {
    out.push(
      "type",
      `${path}.bones`,
      `a skeleton needs exactly one root bone (parent: null), but found ${roots.length}`,
      roots,
    );
    return; // reachability is meaningless without a single root
  }

  const children = new Map<string, string[]>();
  for (const bone of skeleton.bones) {
    if (bone.parent === null) continue;
    const list = children.get(bone.parent) ?? [];
    list.push(bone.bone);
    children.set(bone.parent, list);
  }
  const reached = new Set<string>();
  const queue = [roots[0]!];
  while (queue.length > 0) {
    const name = queue.pop()!;
    if (reached.has(name)) continue;
    reached.add(name);
    queue.push(...(children.get(name) ?? []));
  }
  skeleton.bones.forEach((bone, i) => {
    if (!reached.has(bone.bone))
      out.push(
        "type",
        `${path}.bones[${i}]`,
        `bone "${bone.bone}" is not reachable from the root "${roots[0]}" (a detached cycle cannot be posed)`,
        bone.bone,
      );
  });
};
