import {
  IAutoMovieConstraintViolation,
  IAutoMovieNode,
  IAutoMoviePropSpec,
} from "@automovie/interface";

import { profileSemanticKeys } from "../resolve/bindProfile";
import { validateModel } from "../validation/validateModel";
import { ViolationCollector } from "../validation/violation";

/**
 * A forged prop: the spec gated on both contracts, ready for staging to place
 * and, when articulated, for `resolveFrame` to constrain and drive through
 * `bindProfile`.
 *
 * @author Samchon
 */
export type IAutoMovieForgedProp =
  | IAutoMovieForgedProp.ISuccess
  | IAutoMovieForgedProp.IFailure;
export namespace IAutoMovieForgedProp {
  /** The prop passed the model and articulation contracts. */
  export interface ISuccess {
    /** Discriminator. */
    success: true;

    /** The accepted spec, echoed for the staging join. */
    prop: IAutoMoviePropSpec;
  }

  /** The spec broke a contract; every violation listed for the correction round. */
  export interface IFailure {
    /** Discriminator. */
    success: false;

    /** Every violation found, for the correction round. */
    violations: IAutoMovieConstraintViolation[];
  }
}

/**
 * The FORGE consumer's object side, accept a prop an agent authored as data
 * (crude primitive proxy, rich meaning: body, affordances, self-declared
 * articulation, D011) and gate it on both contracts. `forgeCast` forges the
 * performers; this forges the things they hold, open, and stack.
 *
 * The **model contract**: the prop's `model.id` must equal `node` (the staged
 * scene joins on it, exactly as a forged cast member does), `origin` must be
 * `"generated"`, and `skeleton` must be `null`, a riggable actor goes through
 * `forgeCast`; a prop's moving parts are articulation nodes, not bones.
 * `validateModel` covers parts/materials/extents plus the body (#595) and
 * affordance (#604) semantics, remapped onto the spec's path.
 *
 * The **articulation contract** (when present): joint node ids unique and
 * non-empty, parents resolving within the declared nodes (`null` = the prop's
 * root) without a cycle; the binding targeting the declared profile; every
 * `boneMap` value naming a declared node; and every semantic key the profile
 * references ({@link profileSemanticKeys}) mapped, reported **all at once**,
 * where `bindProfile` itself would throw on the first, so one correction round
 * sees the whole list. A spec that passes these gates binds without a throw;
 * the door round-trip test drives the forged artifact through `resolveFrame` to
 * prove the declared limit clamps and the declared driver drives.
 */
export const forgeProp = (spec: IAutoMoviePropSpec): IAutoMovieForgedProp => {
  const out = new ViolationCollector();

  if (spec.node.trim().length === 0)
    out.push(
      "type",
      "$input.node",
      "prop node must be a non-empty scene node id",
      spec.node,
    );
  if (spec.model.id !== spec.node)
    out.push(
      "type",
      "$input.model.id",
      `model id must equal the prop node "${spec.node}" (the staged scene joins on it), but was "${spec.model.id}"`,
      spec.model.id,
    );
  if (spec.model.origin !== "generated")
    out.push(
      "type",
      "$input.model.origin",
      `a forged prop's origin must be "generated", but was "${spec.model.origin}"`,
      spec.model.origin,
    );
  if (spec.model.skeleton !== null)
    out.push(
      "type",
      "$input.model.skeleton",
      "a prop must be skeleton-less, riggable actors go through forgeCast; moving parts are articulation nodes",
      spec.model.skeleton.id,
    );

  const validated = validateModel({ model: spec.model });
  if (validated.success === false)
    for (const violation of validated.violations)
      out.items.push({
        ...violation,
        path: violation.path.replace("$input", "$input.model"),
      });

  if (spec.articulation !== null) gateArticulation(spec.articulation, out);

  if (out.items.length > 0) return { success: false, violations: out.items };
  return { success: true, prop: spec };
};

const gateArticulation = (
  articulation: NonNullable<IAutoMoviePropSpec["articulation"]>,
  out: ViolationCollector,
): void => {
  const path = "$input.articulation";
  if (articulation.nodes.length === 0)
    out.push(
      "type",
      `${path}.nodes`,
      "an articulation needs at least one joint node",
      articulation.nodes,
    );

  const byId = new Map<string, { node: IAutoMovieNode; index: number }>();
  articulation.nodes.forEach((node, i) => {
    const np = `${path}.nodes[${i}]`;
    if (node.id.trim().length === 0)
      out.push(
        "type",
        `${np}.id`,
        "articulation node id must be non-empty",
        node.id,
      );
    const existing = byId.get(node.id);
    if (existing !== undefined) {
      out.push(
        "type",
        `${np}.id`,
        `articulation node id "${node.id}" is duplicated; first declared at ${path}.nodes[${existing.index}].id`,
        node.id,
      );
      return;
    }
    byId.set(node.id, { node, index: i });
  });

  articulation.nodes.forEach((node, i) => {
    if (node.parent !== null && !byId.has(node.parent))
      out.push(
        "type",
        `${path}.nodes[${i}].parent`,
        `parent "${node.parent}" is not a declared articulation node`,
        node.parent,
      );
  });
  for (const [id, entry] of byId) {
    const trail = new Set<string>([id]);
    let parent = entry.node.parent;
    while (parent !== null) {
      if (trail.has(parent)) {
        out.push(
          "type",
          `${path}.nodes[${entry.index}].parent`,
          `articulation parent chain of "${id}" is cyclic at "${parent}"`,
          parent,
        );
        break;
      }
      trail.add(parent);
      parent = byId.get(parent)?.node.parent ?? null;
    }
  }

  const { profile, binding } = articulation;
  if (binding.profile !== profile.id)
    out.push(
      "type",
      `${path}.binding.profile`,
      `binding targets profile "${binding.profile}" but the declared profile is "${profile.id}"`,
      binding.profile,
    );

  for (const [key, mapped] of Object.entries(binding.boneMap)) {
    const bp = `${path}.binding.boneMap["${key}"]`;
    if (mapped.trim().length === 0) {
      out.push("type", bp, `boneMap maps "${key}" to an empty node id`, mapped);
      continue;
    }
    if (!byId.has(mapped))
      out.push(
        "type",
        bp,
        `boneMap maps "${key}" to "${mapped}", which is not a declared articulation node`,
        mapped,
      );
  }

  for (const key of profileSemanticKeys(profile))
    if (binding.boneMap[key] === undefined)
      out.push(
        "type",
        `${path}.binding.boneMap`,
        `profile "${profile.id}" references "${key}" but the binding does not map it`,
        key,
      );
};
