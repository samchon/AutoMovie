import {
  IAutoMovieCompiledFormationLod,
  IAutoMovieFormationBounds,
  IAutoMovieFormationDesign,
  IAutoMovieFormationMotion,
  IAutoMovieFormationMotionState,
  IAutoMovieFormationSlot,
  IAutoMovieGait,
  IAutoMovieModel,
  IAutoMovieTransform,
  IAutoMovieVector3,
  IAutoMovieWorldSurface,
} from "@automovie/interface";

import { Quaternion } from "./math/Quaternion";
import { Vector3 } from "./math/Vector3";
import { seededValue } from "./math/random";
import { worldGroundHeight } from "./worldKit";

/**
 * The arrangement a unit is travelling toward, and how far along it is.
 *
 * Carried beside the sampled state rather than inside it, because `from` and
 * `to` are what an author writes and a re-form is a property of the cue rather
 * than of either end: a cue states one target arrangement, and both its ends
 * describe the same unit standing in different places. `progress` is the cue's
 * own eased progress, so a re-form bends on the curve its author declared and
 * not on a second one.
 *
 * @evidence requirements/formations/budgets-and-validation.md#formation-determinism Carries the target layout and eased progress needed to reproduce an interior reform sample.
 * @evidence specifications/performance-motion-and-staging/formation-motion-resolution-and-budgets.md#performance-formation-determinism-status-compatibility Makes reform state an explicit deterministic result instead of hidden sampler history.
 */
export interface IAutoMovieFormationReform {
  /**
   * The arrangement the unit is in when the cue ends.
   *
   * @evidence requirements/formations/budgets-and-validation.md#formation-motion-validation Exposes the target arrangement whose capacity, ground, and motion interior must be checked.
   * @evidence specifications/performance-motion-and-staging/formation-motion-resolution-and-budgets.md#performance-formation-geometry-layout-motion-validation Carries the reform layout into the temporal validation surface.
   */
  layout: IAutoMovieFormationDesign["layout"];
  /**
   * The arrangement the unit is travelling *from*, or null for its design's.
   *
   * A unit that has already re-formed is standing in the last cue's target, not
   * in the arrangement it was designed in, so a second cue has to blend out of
   * where the unit actually is. Without this the blend always started at the
   * design, and a two-step change — the manoeuvre `FORMATION_DESIGN` recommends
   * for a re-form whose members would otherwise cross — sent every member back
   * toward its designed place before setting off again. The #1825 campaign
   * followed that advice and reported that the intermediate cue did not retain
   * the previous arrangement.
   *
   * Null rather than a copy of the design's layout, because "no earlier
   * re-form" and "an earlier re-form that happened to end where the design
   * began" are different histories, and only the first one is a unit that has
   * never moved.
   *
   * @evidence requirements/formations/reform-and-group-motion.md#formation-reform-local-blend Carries the arrangement a chained re-form departs from so successive cues blend from the unit's real state.
   * @evidence specifications/performance-motion-and-staging/formation-motion-resolution-and-budgets.md#performance-formation-determinism-status-compatibility Makes the departure arrangement part of the deterministic sample rather than implied by the design record.
   */
  from: IAutoMovieFormationDesign["layout"] | null;
  /**
   * Eased fraction of the way there, 0 at the cue's start and 1 at its end.
   *
   * @evidence requirements/formations/budgets-and-validation.md#formation-motion-validation Identifies the exact interior state at which reform geometry is evaluated.
   * @evidence specifications/performance-motion-and-staging/formation-motion-resolution-and-budgets.md#performance-formation-geometry-layout-motion-validation Lets validation inspect cue interiors rather than endpoints alone.
   */
  progress: number;
}

/**
 * One sampled unit state, with the arrangement it is travelling toward.
 *
 * @evidence requirements/formations/budgets-and-validation.md#formation-determinism Represents a complete repeatable motion answer at one requested film time.
 * @evidence specifications/performance-motion-and-staging/formation-motion-resolution-and-budgets.md#performance-formation-determinism-status-compatibility Keeps translation, facing, spacing, and reform state independent of seek order.
 */
export interface IAutoMovieSampledFormationMotion extends IAutoMovieFormationMotionState {
  /**
   * The re-form under way, or null when the unit keeps its designed
   * arrangement. Null rather than an identity re-form, because "no target" and
   * "a target identical to the design" are different statements and only the
   * first is what a unit with no cue is doing.
   *
   * @evidence requirements/formations/budgets-and-validation.md#formation-determinism Preserves whether a deterministic sample is actively reforming instead of collapsing absence into an identity target.
   * @evidence specifications/performance-motion-and-staging/formation-motion-resolution-and-budgets.md#performance-formation-determinism-status-compatibility Makes the sampled arrangement state explicit for replay and compatibility checks.
   */
  reform: IAutoMovieFormationReform | null;
}

/**
 * Inputs to the deterministic automatic formation LOD selector.
 *
 * @evidence requirements/asset-authoring/representations-bounds-and-lod.md#asset-lod-transition-stability Carries the ordered tiers, image contribution, previous choice, and deadband that prevent formation LOD flicker.
 * @evidence requirements/formations/resolution-culling-and-evidence.md#formation-resolution-policy-selection Exposes the compiled tiers and explicit selection operands instead of letting rendering choose an undeclared representation.
 * @evidence specifications/asset-and-representation/bounds-proxies-and-lod.md#asset-spec-lod-transition-invariants Defines the complete input boundary for stable representation transitions.
 * @evidence specifications/performance-motion-and-staging/formation-motion-resolution-and-budgets.md#performance-formation-bounds-framing-culling-failures Carries the distance, projected contribution, prior tier, and hysteresis used for an inspectable formation-resolution decision.
 */
export interface IAutoMovieFormationLodInput {
  /**
   * Ordered compiled anonymous representations.
   *
   * @evidence requirements/asset-authoring/representations-bounds-and-lod.md#asset-lod-transition-stability Supplies the fixed near-to-far candidates between which the formation may transition.
   * @evidence specifications/asset-and-representation/bounds-proxies-and-lod.md#asset-spec-lod-transition-invariants Keeps transition choice within compiled compatible representations.
   */
  lod: readonly IAutoMovieCompiledFormationLod[];
  /**
   * Camera-to-chunk-centroid distance in meters.
   *
   * @evidence requirements/asset-authoring/representations-bounds-and-lod.md#asset-lod-transition-stability Provides the spatial contribution used on both sides of an LOD boundary.
   * @evidence specifications/asset-and-representation/bounds-proxies-and-lod.md#asset-spec-lod-transition-invariants Makes distance an explicit transition operand instead of renderer-local state.
   */
  distance: number;
  /**
   * Projected representative-member diameter in physical pixels.
   *
   * @evidence requirements/asset-authoring/representations-bounds-and-lod.md#asset-lod-transition-stability Stabilizes formation detail by accounting for actual screen contribution as well as distance.
   * @evidence specifications/asset-and-representation/bounds-proxies-and-lod.md#asset-spec-lod-transition-invariants Exposes the image-space operand that participates in the transition metric.
   */
  projectedPixels: number;
  /**
   * Tier retained from the previous frame, or null on first selection.
   *
   * @evidence requirements/asset-authoring/representations-bounds-and-lod.md#asset-lod-transition-stability Carries temporal state needed to retain a tier inside the boundary deadband.
   * @evidence specifications/asset-and-representation/bounds-proxies-and-lod.md#asset-spec-lod-transition-invariants Prevents adjacent frames from making independent threshold decisions.
   */
  previous: IAutoMovieCompiledFormationLod["tier"] | null;
  /**
   * Fractional boundary deadband; 0.1 by default.
   *
   * @evidence requirements/asset-authoring/representations-bounds-and-lod.md#asset-lod-transition-stability States the hysteresis width that suppresses repeated LOD flipping near a threshold.
   * @evidence specifications/asset-and-representation/bounds-proxies-and-lod.md#asset-spec-lod-transition-invariants Makes transition stability a declared parameter rather than a hidden renderer constant.
   */
  hysteresis?: number;
}

/**
 * One automatic LOD decision with its combined selection metric.
 *
 * @evidence requirements/asset-authoring/representations-bounds-and-lod.md#asset-lod-transition-stability Reports both the retained or selected tier and the metric that crossed its hysteresis boundary.
 * @evidence specifications/asset-and-representation/bounds-proxies-and-lod.md#asset-spec-lod-transition-invariants Makes an automatic transition inspectable instead of returning an unexplained representation.
 */
export interface IAutoMovieFormationLodSelection {
  /**
   * Selected compiled tier.
   *
   * @evidence requirements/asset-authoring/representations-bounds-and-lod.md#asset-lod-transition-stability Identifies the representation retained or entered after hysteresis is applied.
   * @evidence specifications/asset-and-representation/bounds-proxies-and-lod.md#asset-spec-lod-transition-invariants Exposes the concrete transition outcome consumed by the renderer.
   */
  lod: IAutoMovieCompiledFormationLod;
  /**
   * Distance enlarged as projected contribution shrinks.
   *
   * @evidence requirements/asset-authoring/representations-bounds-and-lod.md#asset-lod-transition-stability Records the combined distance and pixel-contribution metric used at transition boundaries.
   * @evidence specifications/asset-and-representation/bounds-proxies-and-lod.md#asset-spec-lod-transition-invariants Makes the basis of the selected tier available for stability review.
   */
  effectiveDistance: number;
}

/**
 * Regenerate one exact source-designed formation slot in constant memory.
 *
 * The compiler and ordinary measurement scripts share this pure derivation so a
 * slot queried from loaded project state is exactly the slot materialized into
 * the compiled formation. No filesystem or project state is consulted.
 *
 * @evidence requirements/formations/heroes-variation-and-state.md#formation-deterministic-population Regenerates stable anonymous identities, promoted heroes, positions, facing, and motion phase from formation identity, seed, and slot.
 * @evidence requirements/formations/layouts-and-slots.md#formation-slot-identity Derives the anonymous node key from formation identity and the logical slot instead of enumeration order.
 * @evidence requirements/formations/heroes-variation-and-state.md#formation-stable-background-identity Recreates a background member with the same slot-derived node and seeded motion phase across repeated materialization.
 * @evidence requirements/actors/populations-and-doubles.md#actor-prototype-variation Reuses the declared model recipe while deriving each member's motion phase from the stable formation seed and slot.
 * @evidence requirements/formations/scope-and-identity.md#formation-authoring-mode-selection Materializes one reviewable member from the compact prototype, layout, hero-override, and slot contract on demand.
 * @evidence requirements/production-design/subject-breakdown-and-asset-plan.md#production-design-subject-prototype-instance Keeps the shared model recipe distinct from the slot-derived member identity and the optional named hero actor.
 * @evidence requirements/production-design/subject-breakdown-and-asset-plan.md#production-design-hero-background Distinguishes a seeded anonymous background member from a hero override occupying the same logical slot.
 * @evidence requirements/asset-authoring/identity-and-instances.md#asset-prototype-instance Reuses one declared model recipe while assigning each logical slot its own stable node, transform, motion phase, and optional hero identity.
 * @evidence requirements/asset-authoring/identity-and-instances.md#asset-compression-individuality Regenerates a compact member by stable slot without erasing its independently addressable node identity or hero exception.
 * @evidence requirements/asset-authoring/patterns-and-procedural-composition.md#asset-pattern-local-stability Derives identity and seeded variation from the formation id and logical slot so an unrelated population change does not renumber an existing member.
 * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-layout-slot-assignment Keeps logical slot identity explicit in the compact placement result.
 * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-hero-variation-group-state Applies hero override and deterministic background variation without per-member stored nodes.
 * @evidence specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-population-double-variation Combines one shared prototype with a stable member identity, seeded phase, and optional named-actor promotion.
 * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-compact-representation-compatibility Regenerates the same compact member record without storing or independently re-deriving anonymous nodes.
 * @evidence specifications/narrative-and-intent/locations-subjects-and-assets.md#narrative-intent-subject-prototype-role Materializes the prototype, stable slot occurrence, seeded background variation, and optional hero identity as separate fields.
 * @evidence specifications/asset-and-representation/alternatives-instances-and-groups.md#asset-spec-prototype-instance Keeps the shared model recipe separate from the slot-owned identity, placement, seeded phase, and hero override.
 * @evidence specifications/asset-and-representation/alternatives-instances-and-groups.md#asset-spec-group-individuality Keeps each regenerated group member independently addressable by its slot-derived node and optional actor identity.
 * @evidence specifications/asset-and-representation/alternatives-instances-and-groups.md#asset-spec-deterministic-instance-generation Derives the same member identity and seeded variation from the stable formation and slot inputs without storing expanded nodes.
 */
export const formationSlot = (
  formation: IAutoMovieFormationDesign & IAutoMovieFormationGrounding,
  slot: number,
): IAutoMovieFormationSlot => {
  const actor =
    formation.heroOverrides.find((hero) => hero.slot === slot)?.actor ?? null;
  return {
    slot,
    node:
      actor ??
      `formation:${formation.id}:slot:${String(slot).padStart(6, "0")}`,
    actor,
    modelRecipe: formation.modelRecipe,
    position: formationSlotPosition(formation, slot),
    facingDeg: formation.facingDeg,
    motionPhase: seededValue(formation.seed, slot, 0x70686173),
  };
};

/**
 * The terrain a formation's members are placed on.
 *
 * Carried on the record rather than passed beside it, because a member's height
 * is part of where that member stands: a consumer that could ask for a position
 * without the ground would be a consumer that places a crowd flat, which is the
 * defect this exists to remove. The compiled formation snapshots exactly these
 * surfaces, so the compiler, the gate, the viewer and an offline measurement
 * script all place from one record and cannot answer differently.
 *
 * @evidence requirements/formations/budgets-and-validation.md#formation-layout-validation Retains the authoritative ground snapshot used to check every slot's placement and bounds.
 * @evidence specifications/performance-motion-and-staging/formation-motion-resolution-and-budgets.md#performance-formation-geometry-layout-motion-validation Gives compiler, renderer, and validation one shared terrain input for formation layout.
 */
export interface IAutoMovieFormationGrounding {
  /**
   * World terrain under this formation, or absent when it stands on none.
   *
   * A snapshot of the production world's surfaces, kept beside the formation
   * the way a compiled instance set keeps the route it follows. Absent or empty
   * means no terrain was declared under the unit, and every member then stands
   * at the anchor's own height, which is what a formation did before ground was
   * sampled at all.
   *
   * @evidence requirements/formations/budgets-and-validation.md#formation-layout-validation Supplies the exact surfaces against which slot ground placement is evaluated.
   * @evidence specifications/performance-motion-and-staging/formation-motion-resolution-and-budgets.md#performance-formation-geometry-layout-motion-validation Distinguishes a declared terrain snapshot from the intentional no-terrain placement case.
   */
  readonly ground?: readonly IAutoMovieWorldSurface[];
}

/**
 * What a formation needs to say where one of its slots stands.
 *
 * @evidence requirements/formations/layouts-and-slots.md#formation-local-frame Collects identity, layout, anchor, facing, seed, and ground needed to derive a slot from the unit-local frame.
 * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-layout-slot-assignment Defines the compact placement input shared by every slot derivation.
 */
export type IAutoMovieFormationPlacement = Pick<
  IAutoMovieFormationDesign,
  "id" | "count" | "layout" | "anchor" | "facingDeg" | "seed"
> &
  IAutoMovieFormationGrounding;

/**
 * Where one slot of a formation stands at rest, in world space.
 *
 * The position half of {@link formationSlot}, taken on its own because a
 * consumer that only asks where a member is should not have to hold the hero
 * overrides and model recipe that name it. The compiled formation carries
 * exactly this much, so the compiler can ask about a member without reaching
 * back for the design record beside it.
 *
 * A second implementation of this arithmetic is how a gate and a renderer come
 * to disagree about where a unit is standing, so there is one.
 *
 * Height comes from {@link formationGroundRelief}: the ground under the member,
 * not the ground under the group. A crowd on a rise stands on the rise.
 *
 * @evidence requirements/formations/layouts-and-slots.md#formation-local-frame Derives the slot in unit-local coordinates before applying formation facing, anchor, and world terrain relief.
 * @evidence requirements/formations/reform-and-group-motion.md#formation-reform-local-blend Interpolates source and target slot points in formation-local axes before applying heading and terrain.
 * @evidence requirements/formations/reform-and-group-motion.md#formation-reform-slot-assignment Resolves both layouts with the same stable slot number throughout the reform.
 * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-layout-slot-assignment Implements compact line, column, wedge, arc, and scatter slot placement without expanded member nodes.
 * @evidence specifications/performance-motion-and-staging/formation-motion-resolution-and-budgets.md#performance-formation-member-exception-command-event Produces the bounded local reform state for the assigned member before world-frame composition.
 */
export const formationSlotPosition = (
  formation: IAutoMovieFormationPlacement,
  slot: number,
  reform: IAutoMovieFormationReform | null = null,
): IAutoMovieVector3 => {
  if (
    Number.isSafeInteger(slot) === false ||
    slot < 0 ||
    slot >= formation.count
  )
    throw new RangeError(
      `Formation "${formation.id}" slot ${slot} is outside 0..${formation.count - 1}.`,
    );
  // Blended in the unit's OWN frame, before its heading and its terrain are
  // applied. A member re-forming travels to its new place inside the unit; if
  // the two world points were blended instead, a unit that is also turning
  // would fold its heading into the arrangement and members would swing along
  // arcs their layout never describes.
  const point =
    reform === null
      ? localFormationPoint(formation, slot)
      : (() => {
          // Out of where the unit is standing, which is the last cue's target
          // once one has finished, and only the design's arrangement when none
          // has. A blend that always started at the design would walk a
          // re-formed unit back to its designed places before setting off.
          const departure = localFormationPoint(
            formation,
            slot,
            reform.from ?? formation.layout,
          );
          const target = localFormationPoint(formation, slot, reform.layout);
          return {
            x: lerp(departure.x, target.x, reform.progress),
            z: lerp(departure.z, target.z, reform.progress),
          };
        })();
  const radians = (formation.facingDeg * Math.PI) / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  const x = formation.anchor.x + point.x * cosine + point.z * sine;
  const z = formation.anchor.z - point.x * sine + point.z * cosine;
  return {
    x,
    y: formation.anchor.y + formationGroundRelief(formation, { x, z }),
    z,
  };
};

/**
 * How far the terrain under one point rises above the terrain under the anchor.
 *
 * Relief rather than absolute ground, so `anchor.y` keeps meaning what it
 * always meant: the height the unit was staged at. A unit standing on its
 * ground has an anchor on that ground, and every member then lands on the
 * ground under itself; a unit deliberately staged a metre above its terrain
 * keeps that metre all the way up the hill instead of being snapped down at
 * placement time. It also makes level terrain exactly the old answer, so a
 * production on a flat floor compiles to the frames it compiled to before.
 *
 * Zero when the formation declares no terrain, when the point is over none, and
 * when the anchor itself is over none: relief is measured from the anchor's own
 * ground, and without that datum there is no rise to state. Those are the three
 * ways a unit keeps the single height it used to have, and each is a fact about
 * what was authored rather than a fallback that guesses.
 *
 * @evidence requirements/formations/budgets-and-validation.md#formation-layout-validation Computes the member-to-anchor terrain residual used to validate grounded slot placement and bounds.
 * @evidence specifications/performance-motion-and-staging/formation-motion-resolution-and-budgets.md#performance-formation-geometry-layout-motion-validation Gives all formation consumers the same ground result, including explicit zero when the terrain datum is absent.
 * @evidence specifications/performance-motion-and-staging/formation-motion-resolution-and-budgets.md#performance-formation-layout-ground-validation Supplies the resolved terrain offset that layout validation compares with the member's grounded slot in the same placement snapshot.
 */
export const formationGroundRelief = (
  formation: IAutoMovieFormationGrounding & {
    anchor: IAutoMovieVector3;
  },
  point: { x: number; z: number },
): number => {
  const surfaces = formation.ground;
  if (surfaces === undefined || surfaces.length === 0) return 0;
  const here = worldGroundHeight(surfaces, point);
  if (here === null) return 0;
  const datum = formationGroundDatum(formation, surfaces);
  return datum === null ? 0 : here - datum;
};

/**
 * The anchor's own ground height, found once per formation record.
 *
 * Every member measures its relief against this one number, and a formation of
 * a hundred thousand members would otherwise ask the same question of the same
 * polygons a hundred thousand times. Keyed by the record itself, exactly as the
 * compiler keys the members it judges a unit by, so nothing outlives the
 * placement that asked.
 */
const formationGroundDatum = (
  formation: IAutoMovieFormationGrounding & { anchor: IAutoMovieVector3 },
  surfaces: readonly IAutoMovieWorldSurface[],
): number | null => {
  const remembered = formationGroundDatumCache.get(formation);
  if (remembered !== undefined) return remembered.height;
  const height = worldGroundHeight(surfaces, formation.anchor);
  formationGroundDatumCache.set(formation, { height });
  return height;
};

// Boxed, so a formation whose anchor is over nothing is remembered as such
// rather than looked up again on every one of its members.
const formationGroundDatumCache = new WeakMap<
  object,
  { height: number | null }
>();

/**
 * Select automatic formation LOD from distance and projected contribution.
 *
 * Twenty-four projected pixels are neutral. A prior tier retains a 10% boundary
 * deadband so camera jitter cannot thrash instance buffers.
 *
 * @evidence requirements/asset-authoring/representations-bounds-and-lod.md#asset-lod-transition-stability Selects formation tiers from distance and projected size while retaining the previous tier inside an explicit hysteresis band.
 * @evidence requirements/formations/resolution-culling-and-evidence.md#formation-resolution-transition Retains the prior compiled tier inside the declared deadband before crossing to the distance-and-projection-selected tier.
 * @evidence requirements/production-design/visual-delivery-and-fidelity-tiers.md#production-design-tier-transition Changes only to a declared compiled tier after the distance-and-projection threshold clears the previous tier's hysteresis band.
 * @evidence requirements/asset-authoring/representations-bounds-and-lod.md#asset-representation-selection Selects only among caller-declared formation tiers using distance, projected contribution, prior tier, and explicit hysteresis.
 * @evidence specifications/asset-and-representation/bounds-proxies-and-lod.md#asset-spec-lod-transition-invariants Implements a stable automatic representation transition with an inspectable effective-distance result.
 * @evidence specifications/performance-motion-and-staging/formation-motion-resolution-and-budgets.md#performance-formation-bounds-framing-culling-failures Returns the chosen tier and its effective-distance basis while suppressing threshold flicker.
 * @evidence specifications/narrative-and-intent/fidelity-references-and-provenance.md#narrative-intent-fidelity-tier-transition Implements the compiled-tier selection and hysteresis subset of a representation transition without treating the automatic choice as fidelity approval.
 * @evidence specifications/asset-and-representation/bounds-proxies-and-lod.md#asset-spec-lod-selection-policy Applies the declared ordered thresholds and projected-size correction while retaining the previous tier inside the hysteresis band.
 * @evidence specifications/asset-and-representation/alternatives-instances-and-groups.md#asset-spec-alternative-selection-output Returns the selected compiled tier together with the effective-distance and projected-size basis used by this automatic formation subset.
 */
export const selectFormationLod = (
  input: IAutoMovieFormationLodInput,
): IAutoMovieFormationLodSelection => {
  if (input.lod.length === 0)
    throw new Error("A compiled formation requires at least one LOD tier.");
  const projectedPixels = Math.max(1, input.projectedPixels);
  const effectiveDistance = input.distance * (24 / projectedPixels);
  const matchedIndex = input.lod.findIndex(
    (lod) => lod.maxDistance === null || effectiveDistance <= lod.maxDistance,
  );
  const desiredIndex = matchedIndex < 0 ? input.lod.length - 1 : matchedIndex;
  const previousIndex = input.lod.findIndex(
    (lod) => lod.tier === input.previous,
  );
  if (previousIndex < 0 || previousIndex === desiredIndex)
    return { lod: input.lod[desiredIndex]!, effectiveDistance };
  const hysteresis = input.hysteresis ?? 0.1;
  if (desiredIndex > previousIndex) {
    const boundary = input.lod[previousIndex]!.maxDistance!;
    if (effectiveDistance <= boundary * (1 + hysteresis))
      return { lod: input.lod[previousIndex]!, effectiveDistance };
  } else {
    const boundary = input.lod[desiredIndex]!.maxDistance!;
    if (effectiveDistance >= boundary * (1 - hysteresis))
      return { lod: input.lod[previousIndex]!, effectiveDistance };
  }
  return { lod: input.lod[desiredIndex]!, effectiveDistance };
};

/**
 * Sample one formation's compact source-authored cue sequence.
 *
 * @evidence requirements/formations/budgets-and-validation.md#formation-determinism Resolves the same translation, facing, spacing, and retained reform state for any direct seek to the same time.
 * @evidence specifications/performance-motion-and-staging/formation-motion-resolution-and-budgets.md#performance-formation-determinism-status-compatibility Orders overlapping cue candidates stably and reconstructs state without a playback cursor.
 */
export const sampleFormationMotion = (
  motions: readonly IAutoMovieFormationMotion[],
  formation: string,
  time: number,
): IAutoMovieSampledFormationMotion => {
  const cues = motions
    .filter((cue) => cue.formation === formation)
    .sort(
      (left, right) =>
        left.start - right.start ||
        (left.id < right.id ? -1 : left.id > right.id ? 1 : 0),
    );
  const identity: IAutoMovieSampledFormationMotion = {
    translation: { x: 0, y: 0, z: 0 },
    facingOffsetDeg: 0,
    spacingScale: { lateral: 1, depth: 1 },
    reform: null,
  };
  if (cues.length === 0 || time < cues[0]!.start) return identity;
  // The arrangement the unit is standing in before the next cue moves it: the
  // target of the last cue that finished, held at one, so a unit that
  // re-formed stays re-formed instead of snapping back the moment its cue ends.
  let retained: IAutoMovieSampledFormationMotion = {
    ...cues[0]!.from,
    reform: null,
  };
  for (const cue of cues) {
    if (time < cue.start) return retained;
    if (time < cue.end) {
      const progress = easingProgress(
        cue.easing,
        Math.max(0, Math.min(1, (time - cue.start) / (cue.end - cue.start))),
      );
      return {
        translation: {
          x: lerp(cue.from.translation.x, cue.to.translation.x, progress),
          y: lerp(cue.from.translation.y, cue.to.translation.y, progress),
          z: lerp(cue.from.translation.z, cue.to.translation.z, progress),
        },
        facingOffsetDeg: lerp(
          cue.from.facingOffsetDeg,
          cue.to.facingOffsetDeg,
          progress,
        ),
        spacingScale: {
          lateral: lerp(
            cue.from.spacingScale.lateral,
            cue.to.spacingScale.lateral,
            progress,
          ),
          depth: lerp(
            cue.from.spacingScale.depth,
            cue.to.spacingScale.depth,
            progress,
          ),
        },
        reform:
          cue.layout === undefined
            ? retained.reform
            : {
                layout: cue.layout,
                from: retained.reform?.layout ?? null,
                progress,
              },
      };
    }
    retained = {
      ...cue.to,
      reform:
        cue.layout === undefined
          ? retained.reform
          : {
              layout: cue.layout,
              from: retained.reform?.layout ?? null,
              progress: 1,
            },
    };
  }
  return retained;
};

/**
 * Apply a sampled formation state to one designed world-space point.
 *
 * @evidence requirements/formations/budgets-and-validation.md#formation-determinism Applies spacing in the unit frame, then facing and translation, so repeated motion samples produce the same member position.
 * @evidence specifications/performance-motion-and-staging/formation-motion-resolution-and-budgets.md#performance-formation-determinism-status-compatibility Provides the shared point transform used by oracle, compiler, and renderer formation paths.
 */
export const transformFormationPoint = (
  point: IAutoMovieVector3,
  anchor: IAutoMovieVector3,
  motion: IAutoMovieFormationMotionState,
  baseFacingDeg = 0,
): IAutoMovieVector3 => {
  const baseRadians = (baseFacingDeg * Math.PI) / 180;
  const baseCosine = Math.cos(baseRadians);
  const baseSine = Math.sin(baseRadians);
  const deltaX = point.x - anchor.x;
  const deltaZ = point.z - anchor.z;
  const localX =
    (deltaX * baseCosine - deltaZ * baseSine) * motion.spacingScale.lateral;
  const localZ =
    (deltaX * baseSine + deltaZ * baseCosine) * motion.spacingScale.depth;
  const radians = ((baseFacingDeg + motion.facingOffsetDeg) * Math.PI) / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return {
    x: anchor.x + motion.translation.x + localX * cosine + localZ * sine,
    y: point.y + motion.translation.y,
    z: anchor.z + motion.translation.z - localX * sine + localZ * cosine,
  };
};

/**
 * Where a formation's box sits once a cue has moved and rescaled it.
 *
 * The eight corners go through {@link transformFormationPoint} and are re-bound,
 * because a facing offset rotates the box and an axis-aligned answer has to be
 * measured after the rotation rather than around it.
 *
 * This lives beside the point transform it composes rather than beside either
 * caller. Two consumers ask where a unit is: the oracle reports it and the
 * compiler refuses a unit standing off the ground its shot staged, and a
 * private copy in one of them is how the two come to disagree.
 *
 * @evidence requirements/formations/budgets-and-validation.md#formation-motion-validation Recomputes conservative world bounds from every transformed corner for the current cue state.
 * @evidence requirements/asset-authoring/representations-bounds-and-lod.md#asset-declared-measured-bounds Keeps the declared local box separate from the measured world-axis box derived after the cue transform and facing rotation.
 * @evidence specifications/performance-motion-and-staging/formation-motion-resolution-and-budgets.md#performance-formation-geometry-layout-motion-validation Supplies the same motion-aware bounds to framing reports and ground validation.
 * @evidence specifications/asset-and-representation/bounds-proxies-and-lod.md#asset-spec-bounds-inputs Derives the current world-space bound from the declared formation box, anchor, cue state, and facing without overwriting the input bound.
 */
export const transformFormationBounds = (
  bounds: IAutoMovieFormationBounds,
  anchor: IAutoMovieVector3,
  motion: IAutoMovieFormationMotionState,
  baseFacingDeg = 0,
): IAutoMovieFormationBounds => {
  const corners = [bounds.min.x, bounds.max.x].flatMap((x) =>
    [bounds.min.y, bounds.max.y].flatMap((y) =>
      [bounds.min.z, bounds.max.z].map((z) =>
        transformFormationPoint({ x, y, z }, anchor, motion, baseFacingDeg),
      ),
    ),
  );
  return {
    min: {
      x: Math.min(...corners.map((point) => point.x)),
      y: Math.min(...corners.map((point) => point.y)),
      z: Math.min(...corners.map((point) => point.z)),
    },
    max: {
      x: Math.max(...corners.map((point) => point.x)),
      y: Math.max(...corners.map((point) => point.y)),
      z: Math.max(...corners.map((point) => point.z)),
    },
  };
};

/**
 * Compose a promoted hero's source-authored node transform with formation
 * placement and motion.
 *
 * Translation keeps authored node/object-motion displacement relative to the
 * compiler-owned hero slot. Rotation applies the current formation facing
 * before the authored rotation relative to that slot, while scale remains
 * source-owned.
 *
 * @evidence requirements/formations/heroes-variation-and-state.md#formation-hero-overrides Preserves a promoted actor's authored translation, rotation, and scale while inheriting formation placement and motion.
 * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-hero-variation-group-state Implements the named-hero exception without returning the actor to the anonymous instance batch.
 */
export const composeFormationHeroTransform = (
  base: IAutoMovieTransform,
  source: IAutoMovieTransform,
  anchor: IAutoMovieVector3,
  motion: IAutoMovieFormationMotionState,
  baseFacingDeg = 0,
): IAutoMovieTransform => ({
  translation: Vector3.add(
    transformFormationPoint(base.translation, anchor, motion, baseFacingDeg),
    Vector3.subtract(source.translation, base.translation),
  ),
  rotation: Quaternion.multiply(
    Quaternion.fromAxisAngle(
      { x: 0, y: 1, z: 0 },
      baseFacingDeg + motion.facingOffsetDeg,
    ),
    Quaternion.multiply(Quaternion.inverse(base.rotation), source.rotation),
  ),
  scale: { ...source.scale },
});

/**
 * Offset one slot by its dressing tolerance, deterministically.
 *
 * Formed layouts place members on exact geometry, which reads as one figure
 * repeated on a grid rather than as troops holding a line. `dressing` states
 * how far a member may stand off its slot, and the deviation is drawn from the
 * formation seed and the slot index, the same machinery `scatter` placement and
 * `motionPhase` already use. Nothing is stored per member: the same design
 * regenerates the same crowd on every machine and every run.
 *
 * A layout without `dressing`, or with both tolerances at zero, returns the
 * exact point, so an existing production compiles unchanged.
 */
const dressedFormationPoint = (
  formation: IAutoMovieFormationPlacement,
  slot: number,
  point: { x: number; z: number },
): { x: number; z: number } => {
  const dressing =
    "dressing" in formation.layout ? formation.layout.dressing : undefined;
  if (dressing === undefined) return point;
  const deviation = (salt: number, bound: number): number =>
    bound === 0 ? 0 : (seededValue(formation.seed, slot, salt) * 2 - 1) * bound;
  return {
    x: point.x + deviation(0x64726573, dressing.lateral),
    z: point.z + deviation(0x73646570, dressing.depth),
  };
};

/**
 * Where one member of a closed hollow perimeter stands, in unit-local meters.
 *
 * The ring is walked from the front-left corner: along the front, down the
 * right side, back along the rear, and up the left, with the corners belonging
 * to the lateral sides so no member is placed twice. A ring therefore seats
 * `2 * files + 2 * ranks - 4` members rather than their sum. Members that
 * outlast the outer ring continue into the next one inward, which is two
 * shorter on every side and one spacing further in on both axes.
 *
 * The ring a slot belongs to is found by walking outward-in rather than by
 * inverting the cumulative capacity, which would need a square root at a
 * boundary where its rounding decides which ring a member stands in. Thickness
 * is a small number by construction, and the loop cannot outrun it.
 *
 * The local frame is the one every formed layout uses: `x` centered on the
 * unit's own axis, `z` growing from the front rank rearward.
 */
const perimeterSlotPoint = (
  layout: Extract<IAutoMovieFormationDesign["layout"], { kind: "perimeter" }>,
  slot: number,
): { x: number; z: number } => {
  let index = slot;
  let ring = 0;
  for (; ring < layout.thickness - 1; ++ring) {
    const capacity =
      2 * (layout.files - 2 * ring) + 2 * (layout.ranks - 2 * ring) - 4;
    if (index < capacity) break;
    index -= capacity;
  }
  const files = layout.files - 2 * ring;
  const ranks = layout.ranks - 2 * ring;
  const half = (files - 1) / 2;
  const side = ranks - 2;
  if (index < files)
    return {
      x: (index - half) * layout.spacing.lateral,
      z: ring * layout.spacing.depth,
    };
  if (index < files + side)
    return {
      x: half * layout.spacing.lateral,
      z: (ring + index - files + 1) * layout.spacing.depth,
    };
  if (index < 2 * files + side)
    return {
      x: (2 * files + side - 1 - index - half) * layout.spacing.lateral,
      z: (ring + ranks - 1) * layout.spacing.depth,
    };
  return {
    x: -half * layout.spacing.lateral,
    z: (ring + 2 * files + 2 * side - index) * layout.spacing.depth,
  };
};

const localFormationPoint = (
  formation: IAutoMovieFormationPlacement,
  slot: number,
  layout: IAutoMovieFormationDesign["layout"] = formation.layout,
): { x: number; z: number } => {
  if (layout.kind === "perimeter")
    return dressedFormationPoint(
      formation,
      slot,
      perimeterSlotPoint(layout, slot),
    );
  if (layout.kind === "line" || layout.kind === "column") {
    const rank =
      layout.kind === "line"
        ? Math.floor(slot / layout.files)
        : slot % layout.ranks;
    const file =
      layout.kind === "line"
        ? slot % layout.files
        : Math.floor(slot / layout.ranks);
    return dressedFormationPoint(formation, slot, {
      x: (file - (layout.files - 1) / 2) * layout.spacing.lateral,
      z: rank * layout.spacing.depth,
    });
  }
  if (layout.kind === "wedge") {
    const row = Math.floor(Math.sqrt(slot));
    const column = slot - row * row - row;
    return dressedFormationPoint(formation, slot, {
      x: column * layout.spacing.lateral,
      z: row * layout.spacing.depth,
    });
  }
  if (layout.kind === "arc") {
    const ratio = formation.count === 1 ? 0.5 : slot / (formation.count - 1);
    const degrees = (ratio - 0.5) * layout.arcDegrees;
    const radians = (degrees * Math.PI) / 180;
    return dressedFormationPoint(formation, slot, {
      x: Math.sin(radians) * layout.radius,
      z: Math.cos(radians) * layout.radius,
    });
  }
  const radius =
    Math.sqrt(seededValue(formation.seed, layout.seed, slot, 0)) *
    layout.radius;
  const angle = seededValue(formation.seed, layout.seed, slot, 1) * Math.PI * 2;
  return {
    x: Math.cos(angle) * radius,
    z: Math.sin(angle) * radius,
  };
};

/**
 * Interpolate one scalar the one way every automovie cue interpolates.
 *
 * @evidence requirements/formations/budgets-and-validation.md#formation-determinism Gives translation, spacing, facing, and reform channels one identical linear interpolation rule.
 * @evidence specifications/performance-motion-and-staging/formation-motion-resolution-and-budgets.md#performance-formation-determinism-status-compatibility Prevents channel-specific arithmetic from producing divergent formation samples.
 */
export const lerp = (from: number, to: number, progress: number): number =>
  from * (1 - progress) + to * progress;

/**
 * Shape one cue's linear progress by its declared curve.
 *
 * Exported because the per-member channel beside the unit-level one authors the
 * same `easing` names and must bend them identically. Two spellings of one
 * curve is how a member and the unit it stands in come to disagree about where
 * they are halfway through the same second.
 *
 * @evidence requirements/formations/budgets-and-validation.md#formation-determinism Evaluates every declared formation easing curve as a pure function of normalized progress.
 * @evidence specifications/performance-motion-and-staging/formation-motion-resolution-and-budgets.md#performance-formation-determinism-status-compatibility Shares one curve implementation between unit motion and per-member channels.
 */
export const easingProgress = (
  easing: IAutoMovieFormationMotion["easing"],
  progress: number,
): number => {
  switch (easing) {
    case "linear":
      return progress;
    case "easeIn":
      return progress * progress;
    case "easeOut":
      return 1 - (1 - progress) * (1 - progress);
    case "easeInOut":
      return progress < 0.5
        ? 2 * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 2) / 2;
    case "step":
      // `sampleFormationMotion` applies a cue's exact `to` state before
      // interpolation once time reaches `end`, so interpolation only observes
      // progress below one.
      return 0;
  }
};

/**
 * The gaits one runtime model can perform, in the order its recipe declares
 * them.
 *
 * The first profile that declares any owns the repertoire, which keeps the
 * choice in the recipe, where an author already orders them, instead of in
 * whichever consumer asked first. It lives here rather than beside the bake
 * because two consumers need the same answer for opposite reasons: the viewer
 * bakes a table per declared gait, and the compiler refuses a cue calling for a
 * gait that is not among them. Two spellings of "what can this figure do" is
 * how a production compiles clean and then fails to draw.
 *
 * @evidence requirements/formations/budgets-and-validation.md#formation-motion-validation Exposes the recipe-ordered gait repertoire used to reject unsupported formation motion cues.
 * @evidence specifications/performance-motion-and-staging/formation-motion-resolution-and-budgets.md#performance-formation-geometry-layout-motion-validation Gives validation and runtime baking the same model capability list.
 */
export const autoMovieModelGaits = (
  model: Pick<IAutoMovieModel, "profiles">,
): readonly IAutoMovieGait[] => {
  for (const profile of model.profiles ?? []) {
    const gaits = profile.gaits ?? [];
    if (gaits.length !== 0) return gaits;
  }
  return [];
};
