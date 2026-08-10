import {
  IAutoMovieConstraintViolation,
  IAutoMovieModel,
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
 * `"generated"` unless the spec names the registration its imported bytes came
 * from ({@link gateImportedAppearance}), and `skeleton` must be `null`, a
 * riggable actor goes through `forgeCast`; a prop's moving parts are
 * articulation nodes, not bones. `validateModel` covers parts/materials/extents
 * plus the body (#595) and affordance (#604) semantics, remapped onto the
 * spec's path.
 *
 * The **articulation contract** (when present): joint node ids unique and
 * non-empty, parents resolving within the declared nodes (`null` = the prop's
 * root) without a cycle; each joint's optional `mesh` naming one part of this
 * prop's own model, and no part claimed by two joints; the binding targeting
 * the declared profile; every `boneMap` value naming a declared node; and every
 * semantic key the profile references ({@link profileSemanticKeys}) mapped,
 * reported **all at once**, where `bindProfile` itself would throw on the
 * first, so one correction round sees the whole list. A spec that passes these
 * gates binds without a throw; the door round-trip test drives the forged
 * artifact through `resolveFrame` to prove the declared limit clamps and the
 * declared driver drives.
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
  const modelRef = spec.modelRef ?? null;
  if (modelRef === null) {
    if (spec.model.origin !== "generated")
      out.push(
        "type",
        "$input.model.origin",
        `a forged prop's origin must be "generated", but was "${spec.model.origin}"`,
        spec.model.origin,
      );
  } else gateImportedAppearance(spec.model, modelRef, out);
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

  if (spec.articulation !== null)
    gateArticulation(spec.articulation, spec.model, out);

  if (out.items.length > 0) return { success: false, violations: out.items };
  return { success: true, prop: spec };
};

/** A compiler-sealed digest: `sha256:` and 64 lowercase hexadecimal digits. */
const SEALED_DIGEST = /^sha256:[0-9a-f]{64}$/;

/**
 * The escape hatch to an external asset, opened exactly as far as the record
 * can be checked.
 *
 * A prop that names a registration is drawing somebody else's bytes, and the
 * one thing that must not travel with them is meaning: the appearance is
 * imported, while the volume the engine measures, the body it weighs, the
 * affordances it rests things on and the articulation it drives all stay
 * authored on this spec. So this gate never asks whether the mesh is a chair.
 * It asks whether the reference is a reference at all, whether the media is the
 * kind a prop can be, and whether the sealed closure is internally coherent,
 * which is every question about imported bytes that can be settled without the
 * bytes.
 *
 * The media test is `gltf-static-v1`, the same profile general instancing
 * accepts, because the other two profiles are rigged humans: a skinned or VRM
 * appearance is a performer, and a performer is `forgeCast`'s subject, not a
 * thing that can be stacked on a table. `forgeProp` already refuses a prop
 * carrying a skeleton for that reason; an imported humanoid whose skeleton
 * lives in the file rather than the record would otherwise walk straight past
 * it.
 *
 * What is deliberately NOT judged here is whether the reference resolves and
 * whether each digest matches bytes on disk. The engine holds neither the
 * production's model registry nor its files, so it would have to guess, and the
 * compiler answers both where the registry and the files actually are.
 */
const gateImportedAppearance = (
  model: IAutoMovieModel,
  modelRef: string,
  out: ViolationCollector,
): void => {
  const path = "$input.model";
  if (modelRef.trim().length === 0)
    out.push(
      "type",
      "$input.modelRef",
      "a prop's model reference must name a compiler-owned model registration; an empty reference classifies nothing",
      modelRef,
    );
  if (model.origin !== "imported")
    out.push(
      "type",
      `${path}.origin`,
      `a prop citing modelRef "${modelRef}" draws imported bytes, so its origin must be "imported", but was "${model.origin}"`,
      model.origin,
    );
  if (model.asset === null)
    out.push(
      "type",
      `${path}.asset`,
      "an imported prop must name the binary payload its appearance is drawn from",
      model.asset,
    );

  const imported = model.imported;
  if (imported === undefined) {
    out.push(
      "type",
      `${path}.imported`,
      `modelRef "${modelRef}" carries no compiler-sealed ingest closure, so the appearance references no bytes at all`,
      imported,
    );
    return;
  }

  const ledger = new Map<string, string>();
  imported.assets.forEach((entry, index) => {
    const ap = `${path}.imported.assets[${index}]`;
    const known = ledger.has(entry.path);
    if (entry.path.trim().length === 0)
      out.push(
        "type",
        `${ap}.path`,
        "a sealed asset path must be a non-empty project-relative path",
        entry.path,
      );
    else if (known)
      out.push(
        "type",
        `${ap}.path`,
        `sealed asset path "${entry.path}" is declared twice; one path carries one digest`,
        entry.path,
      );
    // The first entry wins, so a path sealed twice is reported once above
    // rather than turning every later reader of it into a second complaint.
    if (!known) ledger.set(entry.path, entry.digest);
    if (!SEALED_DIGEST.test(entry.digest))
      out.push(
        "type",
        `${ap}.digest`,
        `a sealed digest must be "sha256:" followed by 64 lowercase hexadecimal digits, but was "${entry.digest}"`,
        entry.digest,
      );
  });

  if (imported.profile !== "gltf-static-v1")
    out.push(
      "type",
      `${path}.imported.profile`,
      `a prop's imported appearance must be rigid "gltf-static-v1" geometry, but was "${imported.profile}": a humanoid appearance is a performer and goes through forgeCast`,
      imported.profile,
    );
  if (imported.humanoidBones.length > 0)
    out.push(
      "type",
      `${path}.imported.humanoidBones`,
      `a rigid prop's appearance maps no humanoid bones, but ${imported.humanoidBones.length} were sealed`,
      imported.humanoidBones.length,
    );

  const levels = new Set<string>();
  imported.lod.forEach((entry, index) => {
    const lp = `${path}.imported.lod[${index}]`;
    if (levels.has(entry.level))
      out.push(
        "type",
        `${lp}.level`,
        `LOD level "${entry.level}" is declared twice; one level is one set of bytes`,
        entry.level,
      );
    levels.add(entry.level);
    if (entry.profile !== imported.profile)
      out.push(
        "type",
        `${lp}.profile`,
        `LOD "${entry.level}" was ingested as "${entry.profile}" while the appearance is "${imported.profile}"; every level of one appearance shares its profile`,
        entry.profile,
      );
    if (entry.humanoidBones.length > 0)
      out.push(
        "type",
        `${lp}.humanoidBones`,
        `a rigid prop's LOD "${entry.level}" maps no humanoid bones, but ${entry.humanoidBones.length} were sealed`,
        entry.humanoidBones.length,
      );
    const wellFormed = SEALED_DIGEST.test(entry.digest);
    if (!wellFormed)
      out.push(
        "type",
        `${lp}.digest`,
        `a sealed digest must be "sha256:" followed by 64 lowercase hexadecimal digits, but was "${entry.digest}"`,
        entry.digest,
      );
    const sealed = ledger.get(entry.asset);
    if (sealed === undefined)
      out.push(
        "type",
        `${lp}.asset`,
        `LOD "${entry.level}" binds "${entry.asset}", which the sealed byte ledger does not cover`,
        entry.asset,
      );
    // A malformed digest is already reported, and comparing it against the
    // ledger would answer for that same fault a second time under another name.
    else if (wellFormed && sealed !== entry.digest)
      out.push(
        "type",
        `${lp}.digest`,
        `LOD "${entry.level}" reads "${entry.asset}" at ${entry.digest} while the sealed ledger carries ${sealed} for that path; one path is one set of bytes`,
        entry.digest,
      );
  });

  const hero = imported.lod.find((entry) => entry.level === "hero");
  if (hero === undefined)
    out.push(
      "type",
      `${path}.imported.lod`,
      "an imported appearance needs a hero LOD: the level the prop's own asset binds",
      imported.lod.map((entry) => entry.level),
    );
  else if (model.asset !== null && hero.asset !== model.asset)
    out.push(
      "type",
      `${path}.imported.lod`,
      `the hero LOD binds "${hero.asset}" while the prop draws "${model.asset}"; one appearance is one set of bytes`,
      hero.asset,
    );
};

/**
 * Gate the prop's declared joints, and what each of them carries.
 *
 * The model is here for the `mesh` payload. An articulation node is an
 * {@link IAutoMovieNode}, so it can name the piece of the prop that rides it,
 * and that reference is the whole of how a declared joint becomes a part that
 * visibly moves: without it a hinge turns an empty frame while the leaf stands
 * still, which is a shot that validates clean and shows nothing. The reference
 * resolves inside this prop's own model, because a prop's moving part is a part
 * of the prop; two joints may not claim the same part, since a part rides one
 * frame.
 */
const gateArticulation = (
  articulation: NonNullable<IAutoMoviePropSpec["articulation"]>,
  model: IAutoMovieModel,
  out: ViolationCollector,
): void => {
  const path = "$input.articulation";
  const parts = new Set(model.parts.map((part) => part.id));
  const claimed = new Map<string, number>();
  articulation.nodes.forEach((node, i) => {
    if (node.mesh === null) return;
    const np = `${path}.nodes[${i}].mesh`;
    if (!parts.has(node.mesh)) {
      out.push(
        "type",
        np,
        `articulation node "${node.id}" drives mesh "${node.mesh}", which is not a part of this prop's model`,
        node.mesh,
      );
      return;
    }
    const first = claimed.get(node.mesh);
    if (first !== undefined)
      out.push(
        "type",
        np,
        `part "${node.mesh}" is already driven by ${path}.nodes[${first}]; a part rides one joint`,
        node.mesh,
      );
    else claimed.set(node.mesh, i);
  });
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
