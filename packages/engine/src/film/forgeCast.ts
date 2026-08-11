import {
  IAutoMovieConstraintViolation,
  IAutoMovieForgePlan,
  IAutoMovieModel,
  IAutoMovieScript,
} from "@automovie/interface";

import { validateModel } from "../validation/validateModel";
import { ViolationCollector } from "../validation/violation";

/**
 * A forged cast: every stand-in rig validated and keyed by the cast node it
 * embodies, ready for the staged scene's `modelRef ?? node` join.
 *
 * @evidence requirements/asset-authoring/validation.md#asset-rig-validation Separates a fully validated node-keyed stand-in set from addressed forge failure before staging can consume any rig.
 * @evidence specifications/asset-and-representation/fidelity-and-validation.md#asset-spec-validation-motion-transitions IAutoMovieForgedCast realizes rig validation for motion transitions: A forged cast: every stand-in rig validated and keyed by the cast node it embodies, ready for the staged scene's `modelRef ?? node` join.
 *
 * @author Samchon
 */
export type IAutoMovieForgedCast =
  | IAutoMovieForgedCast.ISuccess
  | IAutoMovieForgedCast.IFailure;
export namespace IAutoMovieForgedCast {
  /**
   * Every stand-in exists, joins its cast member, and passed validation.
   *
   * @evidence requirements/asset-authoring/validation.md#asset-rig-validation Admits the cast only after every requested stand-in exists, joins its script node, and passes the model rig gate.
   * @evidence specifications/asset-and-representation/fidelity-and-validation.md#asset-spec-validation-motion-transitions IAutoMovieForgedCast.ISuccess realizes rig validation for motion transitions: Every stand-in exists, joins its cast member, and passed validation.
   */
  export interface ISuccess {
    /**
     * Discriminator.
     *
     * @evidence requirements/asset-authoring/validation.md#asset-rig-validation The true discriminator admits a completely validated stand-in cast to staging.
     * @evidence specifications/asset-and-representation/fidelity-and-validation.md#asset-spec-validation-motion-transitions IAutoMovieForgedCast.ISuccess.success marks every stand-in rig as validated for staging and motion.
     */
    success: true;

    /**
     * Validated stand-ins, keyed by cast node id.
     *
     * @evidence requirements/asset-authoring/validation.md#asset-rig-validation Carries only validated models keyed by the cast node identity that staging uses for its model join.
     * @evidence specifications/asset-and-representation/fidelity-and-validation.md#asset-spec-validation-motion-transitions IAutoMovieForgedCast.ISuccess.models realizes rig validation for motion transitions: Validated stand-ins, keyed by cast node id.
     */
    models: Record<string, IAutoMovieModel>;
  }

  /**
   * The forge contradicted the script or a rig failed validation.
   *
   * @evidence requirements/asset-authoring/validation.md#asset-rig-validation Withholds the entire stand-in set when a script join is absent or any forged model violates its rig contract.
   * @evidence specifications/asset-and-representation/fidelity-and-validation.md#asset-spec-validation-motion-transitions IAutoMovieForgedCast.IFailure realizes rig validation for motion transitions: The forge contradicted the script or a rig failed validation.
   */
  export interface IFailure {
    /**
     * Discriminator.
     *
     * @evidence requirements/asset-authoring/validation.md#asset-rig-validation The false discriminator withholds invalid stand-in rigs from staging and motion.
     * @evidence specifications/asset-and-representation/fidelity-and-validation.md#asset-spec-validation-motion-transitions IAutoMovieForgedCast.IFailure.success withholds a cast containing missing or invalid rigs.
     */
    success: false;

    /**
     * Every violation found, for the correction round.
     *
     * @evidence requirements/asset-authoring/validation.md#asset-rig-validation Returns each missing cast join and rig-contract failure at the responsible stand-in path.
     * @evidence specifications/asset-and-representation/fidelity-and-validation.md#asset-spec-validation-motion-transitions IAutoMovieForgedCast.IFailure.violations realizes rig validation for motion transitions: Every violation found, for the correction round.
     */
    violations: IAutoMovieConstraintViolation[];
  }
}

/**
 * The FORGE consumer: accept the stand-in rigs the forge stage built for the
 * script's `modelRef: null` cast members, and gate them on both contracts:
 *
 * The **casting contract**: exactly one entry per stand-in cast member (a
 * missing rig is an actor with no body; a rig for an imported-`modelRef` member
 * or for a stranger contradicts the script), and each entry's model `id` must
 * equal its cast `node`. That id is the join the staged scene's `modelRef ??
 * node` fallback resolves against.
 *
 * The **rig contract**: `validateModel` covers parts/materials/extents and the
 * skeleton graph (its violations are remapped onto the entry's path). Forge
 * adds only the performer-specific rule that generated stand-ins must have a
 * skeleton at all; boneless models are props, not castable actors.
 *
 * @evidence requirements/asset-authoring/validation.md#asset-rig-validation forgeCast admits generated performers only after their cast joins, model structure, skeleton, and motion-bearing rig contract all validate.
 * @evidence requirements/story/dramatic-characters-goals-and-relations.md#story-character-actor-binding Requires each forged performer model id to equal one authored cast-node binding, rejects strangers, duplicates, and imported-model members, and refuses a missing stand-in.
 * @evidence specifications/asset-and-representation/fidelity-and-validation.md#asset-spec-validation-motion-transitions forgeCast realizes rig validation for motion transitions: The FORGE consumer: accept the stand-in rigs the forge stage built for the script's `modelRef: null` cast members, and gate them on both contracts: The **casting contract**: exactly one entry per stand-in cast member (a missing rig is an actor with no body; a rig for an imported-`modelRef` member or for a stranger contradicts the script), and each entry's model `id` must equal its cast `node`. That id is the join the staged scene's `modelRef ?? node` fallback resolves against. The **rig contract**: `validateModel` covers parts/materials/extents and the skeleton graph (its violations are remapped onto the entry's path). Forge adds only the performer-specific rule that generated stand-ins must have a skeleton at all; boneless models are props, not castable actors.
 * @evidence specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-story-performance-state Preserves one explicit story-cast-node to forged actor-representation binding and reports missing or conflicting bindings instead of choosing a substitute.
 */
export const forgeCast = (
  script: IAutoMovieScript,
  forge: IAutoMovieForgePlan,
): IAutoMovieForgedCast => {
  const out = new ViolationCollector();
  const cast = new Map<
    string,
    {
      member: IAutoMovieScript["cast"][number];
      index: number;
    }
  >();
  script.cast.forEach((member, index) => {
    const existing = cast.get(member.node);
    if (existing !== undefined) {
      out.push(
        "type",
        `$script.cast[${index}].node`,
        `script cast node "${member.node}" is duplicated; first declared at $script.cast[${existing.index}].node`,
        member.node,
      );
      return;
    }
    cast.set(member.node, { member, index });
  });

  const seen = new Set<string>();
  forge.entries.forEach((entry, i) => {
    const ep = `$input.entries[${i}]`;
    const found = cast.get(entry.node);
    if (found === undefined) {
      out.push(
        "type",
        `${ep}.node`,
        `entry must name a script cast node, but "${entry.node}" is not in the cast`,
        entry.node,
      );
      return;
    }
    const { member } = found;
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
        "a stand-in performer needs a skeleton: a boneless model cannot be posed",
        entry.model.skeleton,
      );

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
