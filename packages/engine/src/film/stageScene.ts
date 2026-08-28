import {
  IAutoMovieCameraClearanceEnvelope,
  IAutoMovieConstraintViolation,
  IAutoMovieLight,
  IAutoMovieMountBinding,
  IAutoMovieScene,
  IAutoMovieSceneNode,
  IAutoMovieScript,
  IAutoMovieStage,
  IAutoMovieStageLight,
  IAutoMovieVector3,
} from "@automovie/interface";

import { aimRotation } from "../kinematics/aimRotation";
import { Quaternion } from "../math/Quaternion";
import { Vector3 } from "../math/Vector3";
import {
  AUTO_MOVIE_LIGHT_TYPES,
  isAutoMovieLightType,
} from "../resolve/lightChannel";
import { withArticle } from "../text/article";
import { isRecord } from "../validation/artifactShape";
import { validateSceneEnvironment } from "../validation/validateSceneEnvironment";
import { validateSpace } from "../validation/validateSpace";
import { ViolationCollector } from "../validation/violation";
import { lookRotation } from "./cameraMove";

/** Cameras look down local −Z (glTF convention); lights shine down −Z too. */
const FORWARD: IAutoMovieVector3 = { x: 0, y: 0, z: -1 };

/** No turn: a point light radiates every way, so its orientation is arbitrary. */
const IDENTITY_ROTATION = { x: 0, y: 0, z: 0, w: 1 };

const isFiniteVector3 = (vector: IAutoMovieVector3): boolean =>
  [vector.x, vector.y, vector.z].every((coordinate) =>
    Number.isFinite(coordinate),
  );

/**
 * Validate one portable camera-clearance envelope before it reaches the
 * resolved scene. The implementation deliberately reads every nested value as
 * unknown: generated authoring code is an external boundary even when its
 * compile-time type claims the object is well formed.
 */
const validateCameraClearanceEnvelope = (
  value: unknown,
  path: string,
  out: ViolationCollector,
): void => {
  if (!isRecord(value)) {
    out.push("type", path, "camera clearance must be an object", value);
    return;
  }

  const validateSphere = (sphere: unknown, spherePath: string): void => {
    if (!isRecord(sphere)) {
      out.push(
        "type",
        spherePath,
        "camera clearance sphere must be an object",
        sphere,
      );
      return;
    }
    if (!isRecord(sphere.center))
      out.push(
        "type",
        `${spherePath}.center`,
        "camera clearance centre must be a vector object",
        sphere.center,
      );
    else if (
      ![sphere.center.x, sphere.center.y, sphere.center.z].every(
        (coordinate) =>
          typeof coordinate === "number" && Number.isFinite(coordinate),
      )
    )
      out.push(
        "range",
        `${spherePath}.center`,
        "camera clearance centre must be a finite vector",
        sphere.center,
      );
    if (
      typeof sphere.radius !== "number" ||
      !Number.isFinite(sphere.radius) ||
      sphere.radius <= 0
    )
      out.push(
        "range",
        `${spherePath}.radius`,
        "camera clearance radius must be finite and greater than zero",
        sphere.radius,
      );
  };

  validateSphere(value.body, `${path}.body`);
  if (!("parentRig" in value))
    out.push(
      "type",
      `${path}.parentRig`,
      "camera clearance must state a parent rig sphere or null",
      undefined,
    );
  else if (value.parentRig !== null)
    validateSphere(value.parentRig, `${path}.parentRig`);
};

/** Copy an accepted envelope so the resolved scene cannot alias author input. */
const lowerCameraClearanceEnvelope = (
  envelope: IAutoMovieCameraClearanceEnvelope,
): IAutoMovieCameraClearanceEnvelope => ({
  body: {
    center: { ...envelope.body.center },
    radius: envelope.body.radius,
  },
  parentRig:
    envelope.parentRig === null
      ? null
      : {
          center: { ...envelope.parentRig.center },
          radius: envelope.parentRig.radius,
        },
});

/** Validate the authored fixed-point depth precision boundary. */
const validateCameraDepthPrecision = (
  value: unknown,
  path: string,
  out: ViolationCollector,
): void => {
  if (!isRecord(value)) {
    out.push("type", path, "camera depth precision must be an object", value);
    return;
  }
  const bits = value.minimumDepthBits;
  if (
    typeof bits !== "number" ||
    !Number.isSafeInteger(bits) ||
    bits <= 0 ||
    !Number.isSafeInteger(2 ** bits - 1)
  )
    out.push(
      "range",
      `${path}.minimumDepthBits`,
      "minimum depth bits must produce an exact positive safe-integer code count",
      bits,
    );
  const maximumStep = value.maximumStepMeters;
  if (
    typeof maximumStep !== "number" ||
    !Number.isFinite(maximumStep) ||
    maximumStep <= 0
  )
    out.push(
      "range",
      `${path}.maximumStepMeters`,
      "maximum adjacent depth step must be finite and greater than zero metres",
      maximumStep,
    );
};

/**
 * Lower a set piece's optional size multiplier onto the node transform's scale:
 * omitted keeps the model's authored size, a bare number scales uniformly, a
 * vector scales per axis. One forged primitive can therefore stand in for a
 * whole set, a wall, a step, and a table top are the same box at three sizes
 * (#1173).
 */
const setPieceScale = (
  scale: number | IAutoMovieVector3 | undefined,
): IAutoMovieVector3 => {
  if (scale === undefined) return { x: 1, y: 1, z: 1 };
  if (typeof scale === "number") return { x: scale, y: scale, z: scale };
  return scale;
};

/** A light placement's kind, defaulting to the sun-like parallel source. */
const lightTypeOf = (
  light: IAutoMovieStageLight,
): IAutoMovieLight["type"] | null => {
  const type = (light as unknown as { type?: unknown }).type;
  if (type === undefined) return "directional";
  return isAutoMovieLightType(type) ? type : null;
};

/** A spot's cone half-angle when the placement leaves it to the engine. */
const DEFAULT_CONE_ANGLE = 45;

/**
 * The rectangular panel's extent as a placement may carry it.
 *
 * Read through one accessor rather than off the placement type for the same
 * reason {@link lightTypeOf} reads `type` that way: the gate must be able to
 * doubt a value an author supplied, and a field asserted before it is checked
 * is a field that stopped being checked. Both axes are `unknown` here and
 * become numbers only once {@link validateLightExtent} has said so.
 */
interface IAutoMovieStageLightExtent {
  /** Declared panel width, unchecked. */
  width?: unknown;
  /** Declared panel height, unchecked. */
  height?: unknown;
}

/** A placement's declared panel extent, before any of it is believed. */
const lightExtentOf = (
  light: IAutoMovieStageLight,
): IAutoMovieStageLightExtent => light as IAutoMovieStageLightExtent;

/**
 * The staging light contract, per kind (#1341).
 *
 * `stage` used to accept `{node, role, direction, intensity}` and lower every
 * entry to a white directional light, so a candle, a sunset, a neon sign, and a
 * window shaft were all the same frame, and an author who wanted a warm lamp
 * had to hand-patch `scene.lights` after `stage` and lose the referential
 * integrity `stage` exists to give. The placement now spans every kind
 * {@link IAutoMovieLight} models, which makes each kind's parameter set exact
 * rather than advisory:
 *
 * - An aimed light (`directional`, `spot`, `area`) needs a finite non-zero
 *   `direction` and a `point` light must not carry one, since it radiates every
 *   way;
 * - A positioned light (`point`, `spot`, `area`) needs a finite `position` and a
 *   `directional` light must not carry one, since it is infinitely distant;
 * - `range` belongs to the two punctual falloff kinds, `coneAngle` to `spot`
 *   alone, and `width`/`height` to `area` alone.
 *
 * A parameter that cannot act is refused rather than ignored: silently dropping
 * a `coneAngle` on a point light is the same false green the campaign is
 * closing elsewhere. Colors are range-checked here too, because `stage` is the
 * only rung between the model and the scene.
 */
const validateLightPlacementShape = (
  light: IAutoMovieStageLight,
  path: string,
  out: ViolationCollector,
): void => {
  const type = lightTypeOf(light);
  if (type === null) {
    out.push(
      "type",
      `${path}.type`,
      `light type must be one of ${[...AUTO_MOVIE_LIGHT_TYPES].join(", ")}`,
      (light as unknown as { type?: unknown }).type,
    );
    return;
  }
  const aimed = type !== "point";
  const positioned = type !== "directional";
  // Distance falloff is narrower than "has a position": an area panel stands
  // somewhere and still takes no range, because its falloff follows from the
  // panel's own extent.
  const falloff = type === "point" || type === "spot";

  if (light.direction === undefined) {
    if (aimed)
      out.push(
        "type",
        `${path}.direction`,
        `${withArticle(type)} light is aimed and needs a direction`,
        light.direction,
      );
  } else if (!aimed)
    out.push(
      "type",
      `${path}.direction`,
      `a point light radiates in every direction and takes no direction`,
      light.direction,
    );
  else if (
    !isFiniteVector3(light.direction) ||
    Vector3.length(light.direction) === 0
  )
    out.push(
      "range",
      `${path}.direction`,
      `direction must be a finite non-zero vector`,
      light.direction,
    );

  if (light.position === undefined) {
    if (positioned)
      out.push(
        "type",
        `${path}.position`,
        `${withArticle(type)} light stands somewhere in the world and needs a position`,
        light.position,
      );
  } else if (!positioned)
    out.push(
      "type",
      `${path}.position`,
      `a directional light is infinitely distant and takes no position`,
      light.position,
    );
  else if (!isFiniteVector3(light.position))
    out.push(
      "range",
      `${path}.position`,
      `position must be a finite vector`,
      light.position,
    );

  if (light.range !== undefined) {
    if (!falloff)
      out.push(
        "type",
        `${path}.range`,
        `${withArticle(type)} light has no distance falloff and takes no range`,
        light.range,
      );
    else if (!Number.isFinite(light.range) || light.range < 0)
      out.push(
        "range",
        `${path}.range`,
        `light range must be a finite number >= 0 (0 = infinite), but was ${light.range}`,
        light.range,
      );
  }

  if (light.coneAngle !== undefined) {
    if (type !== "spot")
      out.push(
        "type",
        `${path}.coneAngle`,
        `only a spot light has a cone; ${withArticle(type)} light takes no coneAngle`,
        light.coneAngle,
      );
    else if (
      !Number.isFinite(light.coneAngle) ||
      light.coneAngle <= 0 ||
      light.coneAngle > 90
    )
      out.push(
        "range",
        `${path}.coneAngle`,
        `spot coneAngle must be a finite number within (0, 90], but was ${light.coneAngle}`,
        light.coneAngle,
      );
  }

  validateLightExtent(light, type, path, out);
  if (light.color !== undefined) validateLightColor(light.color, path, out);
  validateLightShadow(light, type, path, out);
};

/**
 * The panel's extent: required exactly on an `area` light, refused elsewhere.
 *
 * Both axes are checked, not just the first missing one, so an author who typed
 * neither is told both rather than being walked through the same placement one
 * recompile at a time.
 */
const validateLightExtent = (
  light: IAutoMovieStageLight,
  type: IAutoMovieLight["type"],
  path: string,
  out: ViolationCollector,
): void => {
  const extent = lightExtentOf(light);
  for (const axis of ["width", "height"] as const) {
    const value = extent[axis];
    if (value === undefined) {
      if (type === "area")
        out.push(
          "type",
          `${path}.${axis}`,
          `an area light is a rectangular panel and needs a ${axis}`,
          value,
        );
    } else if (type !== "area")
      out.push(
        "type",
        `${path}.${axis}`,
        `only an area light has extent; a ${type} light takes no ${axis}`,
        value,
      );
    else if (typeof value !== "number" || !Number.isFinite(value) || value <= 0)
      out.push(
        "range",
        `${path}.${axis}`,
        `area ${axis} must be a finite number greater than zero, but was ${String(value)}`,
        value,
      );
  }
};

const validateLightShadow = (
  light: IAutoMovieStageLight,
  type: IAutoMovieLight["type"],
  path: string,
  out: ViolationCollector,
): void => {
  if (light.castShadow !== undefined && typeof light.castShadow !== "boolean")
    out.push(
      "type",
      `${path}.castShadow`,
      "castShadow must be boolean",
      light.castShadow,
    );
  // A rectangular area source is integrated analytically, so `three.js` renders
  // no shadow map for it. Accepting the flag would stage a light that says it
  // occludes and never does, which is exactly the false green this campaign is
  // closing; the correction is a spot or directional key beside the panel. The
  // refusal replaces the shadow-settings demand rather than joining it: asking
  // an author to tune a map that will never be rendered is worse advice than
  // none.
  else if (light.castShadow === true && type === "area") {
    out.push(
      "type",
      `${path}.castShadow`,
      "an area light is analytically integrated and casts no shadow map; use a punctual key light for occlusion",
      light.castShadow,
    );
    return;
  }
  if (light.shadow === undefined) {
    if (light.castShadow === true)
      out.push(
        "type",
        `${path}.shadow`,
        "a shadow-casting light requires deterministic shadow settings",
        light.shadow,
      );
    return;
  }
  if (light.castShadow !== true)
    out.push(
      "type",
      `${path}.shadow`,
      "shadow settings require castShadow to be true",
      light.shadow,
    );
  if (!isRecord(light.shadow)) {
    out.push(
      "type",
      `${path}.shadow`,
      "shadow must be a JSON object",
      light.shadow,
    );
    return;
  }
  const shadow = light.shadow;
  if (!Number.isSafeInteger(shadow.mapSize) || (shadow.mapSize as number) <= 0)
    out.push(
      "range",
      `${path}.shadow.mapSize`,
      "shadow mapSize must be a positive safe integer",
      shadow.mapSize,
    );
  for (const key of ["bias", "normalBias"] as const)
    if (typeof shadow[key] !== "number" || !Number.isFinite(shadow[key]))
      out.push(
        "range",
        `${path}.shadow.${key}`,
        `shadow ${key} must be finite`,
        shadow[key],
      );
  if (
    typeof shadow.near !== "number" ||
    !Number.isFinite(shadow.near) ||
    shadow.near <= 0
  )
    out.push(
      "range",
      `${path}.shadow.near`,
      "shadow near must be finite and greater than zero",
      shadow.near,
    );
  if (
    typeof shadow.far !== "number" ||
    !Number.isFinite(shadow.far) ||
    typeof shadow.near !== "number" ||
    shadow.far <= shadow.near
  )
    out.push(
      "range",
      `${path}.shadow.far`,
      "shadow far must be finite and greater than near",
      shadow.far,
    );
};

/**
 * A staged light's color, checked to the same rule the scene artifact validator
 * applies downstream.
 *
 * Both halves matter. The object check keeps this validator TOTAL: `stage` is
 * reachable in-process with an untyped payload (the transport's structural gate
 * is not the engine's), and a `null` color would otherwise dereference into a
 * TypeError instead of a located violation. The alpha check keeps the two rungs
 * agreeing: `validateColorArtifact` range-checks a non-null `a`, so leaving it
 * to `commitScene` would let a bad alpha compose a scene here and be refused
 * one stage later, which is the wrong-stage failure this cycle closes
 * elsewhere.
 */
const validateLightColor = (
  color: unknown,
  path: string,
  out: ViolationCollector,
): void => {
  if (!isRecord(color)) {
    out.push(
      "type",
      `${path}.color`,
      "light color must be a JSON object",
      color,
    );
    return;
  }
  for (const key of ["r", "g", "b"] as const)
    unitComponent(
      color[key],
      `${path}.color.${key}`,
      `light color ${key}`,
      out,
    );
  // `a` is nullable by contract: a light slot is opacity-irrelevant, so `null`
  // is the documented value there, distinct from an out-of-range number.
  if (color.a !== null)
    unitComponent(color.a, `${path}.color.a`, "light color a", out);
};

/**
 * The staged atmosphere, held to the rule the scene gate applies downstream, so
 * a fog `stage` composes can never be one `commitScene` refuses.
 *
 * Two facts and no more, because {@link IAutoMovieFog} carries two: an
 * extinction coefficient that must be finite and non-negative (a negative one
 * would AMPLIFY a distant subject, and a non-finite one erases every pixel),
 * and a color whose components are unit-ranged like every other color the
 * engine accepts. Density has no upper bound on purpose: `1 /m` is a wall of
 * cloud, which is a look, not a mistake.
 *
 * Total over an untyped payload for the same reason {@link validateLightColor}
 * is: `stage` is reachable in-process without the transport's structural gate,
 * and a `null` fog must become a located violation rather than a `TypeError`
 * two rungs later.
 */
const validateFogPlacement = (
  fog: unknown,
  path: string,
  out: ViolationCollector,
): void => {
  if (!isRecord(fog)) {
    out.push("type", path, "fog must be a JSON object", fog);
    return;
  }
  if (
    typeof fog.density !== "number" ||
    !Number.isFinite(fog.density) ||
    fog.density < 0
  )
    out.push(
      "range",
      `${path}.density`,
      `fog density must be a finite number >= 0, but was ${String(fog.density)}`,
      fog.density,
    );
  if (!isRecord(fog.color)) {
    out.push(
      "type",
      `${path}.color`,
      "fog color must be a JSON object",
      fog.color,
    );
    return;
  }
  for (const key of ["r", "g", "b"] as const)
    unitComponent(
      fog.color[key],
      `${path}.color.${key}`,
      `fog color ${key}`,
      out,
    );
};

/**
 * One color component in `[0, 1]`, reported in
 * {@link ViolationCollector.range}'s own words.
 *
 * The collector's helper takes a `number`, and a component read off an untyped
 * payload is `unknown`. Casting it to `number` to satisfy that signature would
 * assert exactly the thing the check exists to doubt, so the comparison narrows
 * with `typeof` instead and the message is kept identical to the collector's,
 * so the two rungs read the same to an author.
 */
const unitComponent = (
  value: unknown,
  path: string,
  label: string,
  out: ViolationCollector,
): void => {
  if (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 1
  )
    return;
  out.push(
    "range",
    path,
    `${label} must be a finite number within [0, 1], but was ${String(value)}`,
    value,
  );
};

/**
 * Lower one accepted placement into the scene light it describes.
 *
 * An aimed light keeps the shortest-arc rotation that puts its local −Z on
 * `direction`; a positioned light keeps that same aim (a spot needs it, a point
 * is rotation-indifferent and takes identity) and translates to `position`.
 * Omitted color is neutral white with `a: null`, the light-slot convention
 * {@link IAutoMovieColor} documents.
 */
const lowerLightPlacement = (light: IAutoMovieStageLight): IAutoMovieLight => {
  const type = lightTypeOf(light)!;
  const base = {
    id: light.node,
    transform: {
      translation: light.position ?? { x: 0, y: 0, z: 0 },
      rotation:
        light.direction === undefined
          ? IDENTITY_ROTATION
          : aimRotation(FORWARD, light.direction),
      scale: { x: 1, y: 1, z: 1 },
    },
    color: light.color ?? { r: 1, g: 1, b: 1, a: null, hex: null },
    intensity: light.intensity,
    ...(light.castShadow === undefined ? {} : { castShadow: light.castShadow }),
    ...(light.shadow === undefined ? {} : { shadow: light.shadow }),
  };
  if (type === "point") return { ...base, type, range: light.range ?? 0 };
  if (type === "spot")
    return {
      ...base,
      type,
      range: light.range ?? 0,
      coneAngle: light.coneAngle ?? DEFAULT_CONE_ANGLE,
    };
  // A panel has no defaultable extent: an unstated width is not "some usual
  // softbox", it is an author who has not decided how big the window is, so the
  // placement gate refuses it and lowering reads what was decided.
  if (type === "area") {
    const extent = lightExtentOf(light);
    return {
      ...base,
      type,
      width: extent.width as number,
      height: extent.height as number,
    };
  }
  return { ...base, type };
};

/**
 * A staged film set: the composed {@link IAutoMovieScene} plus the persistent
 * mount couplings staging declared. Mounts stay alongside rather than inside
 * the scene because a scene node is a flat world placement, the per-frame world
 * transform of a mounted rider comes from `resolveAttachment` against the
 * parent's posed skeleton, not from the scene graph.
 *
 * `performShot` consumes these: every performed shot auto-descends each mount
 * into the rider's follow clip through `compileAttach` (#674), so the rider
 * rides for the whole film without re-issuing `attachTo`, the engine owns the
 * composition, the host stays a pure player.
 *
 * @evidence requirements/staging/budgets-safety-and-validation.md#staging-deterministic-replay Carries the resolved scene or addressed validation result produced from the script and staging plan.
 * @evidence specifications/performance-motion-and-staging/staging-events-coverage-and-validation.md#performance-staging-deterministic-replay-failure-result IAutoMovieStagedSet preserves deterministic success and failure outcomes for the same authored staging inputs.
 * @author Samchon
 */
export type IAutoMovieStagedSet =
  | IAutoMovieStagedSet.ISuccess
  | IAutoMovieStagedSet.IFailure;
export namespace IAutoMovieStagedSet {
  /**
   * Staging was coherent; the set is ready for blocking/performance.
   *
   * @evidence requirements/staging/budgets-safety-and-validation.md#staging-deterministic-replay The success branch carries one coherent resolved set for the blocking pass.
   * @evidence specifications/performance-motion-and-staging/staging-events-coverage-and-validation.md#performance-staging-deterministic-replay-failure-result IAutoMovieStagedSet.ISuccess makes the deterministic resolved-scene outcome explicit.
   */
  export interface ISuccess {
    /**
     * Discriminator.
     *
     * @evidence requirements/staging/budgets-safety-and-validation.md#staging-deterministic-replay The success discriminator separates a resolved staged set from an addressed failure result.
     * @evidence specifications/performance-motion-and-staging/staging-events-coverage-and-validation.md#performance-staging-deterministic-replay-failure-result IAutoMovieStagedSet.ISuccess.success fixes the status of the deterministic staging outcome.
     */
    success: true;

    /**
     * The composed scene (actors at rest, cameras aimed, lights rigged).
     *
     * @evidence requirements/staging/budgets-safety-and-validation.md#staging-deterministic-replay Carries the resolved scene produced from the declared staging plan without hidden mutation.
     * @evidence specifications/performance-motion-and-staging/staging-events-coverage-and-validation.md#performance-staging-deterministic-replay-failure-result IAutoMovieStagedSet.ISuccess.scene exposes the replayable scene state consumed by blocking.
     */
    scene: IAutoMovieScene;

    /**
     * Validated persistent couplings, one per mounted rider.
     *
     * @evidence requirements/staging/budgets-safety-and-validation.md#staging-deterministic-replay Carries the validated mount bindings produced alongside the resolved scene.
     * @evidence specifications/performance-motion-and-staging/staging-events-coverage-and-validation.md#performance-staging-deterministic-replay-failure-result IAutoMovieStagedSet.ISuccess.mounts keeps coupling inputs stable across replay and beat-end handoff.
     */
    mounts: IMount[];
  }

  /**
   * Staging contradicted the script or itself; nothing was composed.
   *
   * @evidence requirements/staging/budgets-safety-and-validation.md#staging-deterministic-replay Carries deterministic validation failure when the plan cannot form a coherent set.
   * @evidence specifications/performance-motion-and-staging/staging-events-coverage-and-validation.md#performance-staging-deterministic-replay-failure-result IAutoMovieStagedSet.IFailure preserves the non-playable staging result rather than fabricating a scene.
   */
  export interface IFailure {
    /**
     * Discriminator.
     *
     * @evidence requirements/staging/budgets-safety-and-validation.md#staging-deterministic-replay The failure discriminator prevents an invalid staging result from masquerading as a resolved set.
     * @evidence specifications/performance-motion-and-staging/staging-events-coverage-and-validation.md#performance-staging-deterministic-replay-failure-result IAutoMovieStagedSet.IFailure.success prevents a failed set from entering blocking.
     */
    success: false;

    /**
     * Every contradiction found, for the correction round.
     *
     * @evidence requirements/staging/budgets-safety-and-validation.md#staging-deterministic-replay Carries every addressed staging contradiction produced by the deterministic validation pass.
     * @evidence specifications/performance-motion-and-staging/staging-events-coverage-and-validation.md#performance-staging-deterministic-replay-failure-result IAutoMovieStagedSet.IFailure.violations supplies the correction data instead of a partial resolved scene.
     */
    violations: IAutoMovieConstraintViolation[];
  }

  /**
   * One rider→parent-bone coupling. `performShot` bakes it into the rider's
   * per-frame follow clip (#674); the host plays that clip, it does not resolve
   * the coupling itself.
   *
   * @evidence requirements/motion/object-motion-and-interaction.md#motion-coupled-objects IAutoMovieStagedSet.IMount preserves declared attachment handoff: One rider→parent-bone coupling. `performShot` bakes it into the rider's per-frame follow clip (#674); the host plays that clip, it does not resolve the coupling itself.
   * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-interaction-attachment-object-handoff IAutoMovieStagedSet.IMount realizes declared attachment and object handoff: One rider→parent-bone coupling. `performShot` bakes it into the rider's per-frame follow clip (#674); the host plays that clip, it does not resolve the coupling itself.
   */
  export interface IMount {
    /**
     * The mounted (riding) scene node.
     *
     * @evidence requirements/motion/object-motion-and-interaction.md#motion-coupled-objects IAutoMovieStagedSet.IMount.node preserves declared attachment handoff: The mounted (riding) scene node.
     * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-interaction-attachment-object-handoff IAutoMovieStagedSet.IMount.node realizes declared attachment and object handoff: The mounted (riding) scene node.
     */
    node: string;

    /**
     * The coupling it rides.
     *
     * @evidence requirements/motion/object-motion-and-interaction.md#motion-coupled-objects IAutoMovieStagedSet.IMount.binding preserves declared attachment handoff: The coupling it rides.
     * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-interaction-attachment-object-handoff IAutoMovieStagedSet.IMount.binding realizes declared attachment and object handoff: The coupling it rides.
     */
    binding: IAutoMovieMountBinding;
  }
}

/**
 * The STAGING consumer, fold the script's cast and the staging stage's
 * placements into the {@link IAutoMovieScene} every later stage performs into.
 * This is the first rung of the film pipeline: coding-agent stage payloads in,
 * a validated engine artifact or a violation list out.
 *
 * Referential integrity is the whole check: every placement must name a cast
 * member, every cast member must be placed (an unplaced character can never
 * appear on screen), ids must not collide, and a camera aimed at a node or a
 * mount riding a parent must point at something that exists. A camera's target
 * may be any staged placement, another camera included, the same table the
 * performance stage resolves its positional targets against (#1294). Geometry
 * is converted, not judged, whether 0.7 m is striking range is the reviewer's
 * business, not a constraint.
 *
 * Conversions: `facingDeg` (about +Y, 0 = facing +Z) becomes the node's
 * rotation; a set piece's optional `scale` becomes the node transform's scale
 * (one primitive at many sizes); a camera's `lookAt` resolves to a point and
 * the shortest-arc rotation aims its −Z there; a light placement lowers to the
 * scene light its `type` names (directional, point, spot, or area), aimed by
 * `direction` and placed at `position`, in its authored color.
 *
 * The environment is two halves of one thing (#1173): `set` pieces are the
 * visible geometry the guide passes draw, and the optional `space` is the
 * ground's meaning, standable surfaces and walkability, copied onto the
 * composed scene after {@link validateSpace} accepts it. Omitting `space`
 * composes `space: null`, the scalar ground plane the engine assumed before.
 *
 * A set may also declare its `fog`, the scene's atmosphere and the depth cue an
 * exterior otherwise has no way to state: it is range-checked here and lowered
 * verbatim. Omitting it composes a scene with no `fog` at all, which renders
 * exactly as every staged scene did before atmospheres existed.
 *
 * @evidence requirements/staging/budgets-safety-and-validation.md#staging-deterministic-replay Resolves the screenplay's sets, performers, cameras, lights, and mounts or returns every deterministic contradiction.
 * @evidence requirements/staging/budgets-safety-and-validation.md#staging-spatial-validation Checks finite placement geometry and exact cast, node, camera-target, and mount-parent relations before composing the scene.
 * @evidence requirements/staging/scope-and-source-of-truth.md#staging-resolved-scene-state Lowers accepted rest transforms, camera aims, typed lights, ground, and environment into one explicit initial scene state.
 * @evidence requirements/staging/subjects-and-object-staging.md#staging-rest-active-placement Emits actors and set pieces at their authored rest transforms with no active motion or pose, while retaining declared mount bindings beside the scene.
 * @evidence requirements/staging/subjects-and-object-staging.md#staging-placement-refusal Refuses missing cast or target identities, duplicate scene ids, dangling mounts, and non-finite placement transforms instead of inventing replacements.
 * @evidence requirements/lighting/sources-and-photometry.md#lighting-source-distribution Lowers the supported directional, point, spot, and rectangular-area subset with its kind-specific direction, position, range, cone, extent, and authored color.
 * @evidence requirements/lighting/sources-and-photometry.md#lighting-source-refusal Rejects invalid intensity, missing or zero direction, forbidden position or range, invalid cone, and missing or non-positive panel extent before lowering a source.
 * @evidence requirements/lighting/color-exposure-and-display-boundary.md#lighting-color-refusal Rejects a staged light color when its linear components are non-finite or outside the unit interval.
 * @evidence requirements/lighting/shadows-reflections-and-transmission.md#lighting-shadow-identity Validates the staged source's cast flag, map size, bias, normal bias, and near/far interval, and refuses an unsupported area-light shadow map.
 * @evidence specifications/performance-motion-and-staging/staging-events-coverage-and-validation.md#performance-staging-deterministic-replay-failure-result stageScene produces the same resolved scene or addressed failure for the same script and staging inputs.
 * @evidence specifications/performance-motion-and-staging/staging-space-state-and-choreography.md#performance-staging-mark-surface-zone-membership Composes accepted rest placements into a resolved scene state without fabricating missing identities or transforms.
 * @evidence specifications/performance-motion-and-staging/staging-space-state-and-choreography.md#performance-staging-interaction-choreography-role Separates static rest-node placement from persistent mount bindings and refuses unresolved, duplicate, or non-finite placement relations.
 * @evidence specifications/camera-light-and-visibility/light-source-photometry-and-environment.md#clv-source-distribution-color Carries only the engine's supported source kinds, orientation, falloff, cone, panel extent, and linear color into scene light state.
 * @evidence specifications/camera-light-and-visibility/light-source-photometry-and-environment.md#clv-source-sampling-refusal Validates the static staged sample's intensity, direction, range, cone, and extent and rejects unsupported field combinations before scene creation.
 * @evidence specifications/camera-light-and-visibility/light-transport-color-and-budget.md#clv-color-comparison-refusal Enforces the finite unit-range numeric domain of authored linear light components without claiming a display conversion.
 * @evidence specifications/camera-light-and-visibility/light-transport-color-and-budget.md#clv-shadow-state-sampling Carries one fixed source's validated cast flag and explicit shadow-map sampling settings into the scene light.
 */
export const stageScene = (
  script: IAutoMovieScript,
  staging: IAutoMovieStage,
): IAutoMovieStagedSet => {
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
  const placed = new Map(staging.actors.map((a) => [a.node, a]));
  // What a camera may aim at: any placed point, an actor, a set piece (an
  // establishing frame on a doorway is as legitimate as one on a duellist), or
  // another camera. The camera entry is what makes this rung agree with the
  // rest: `performShot` resolves a positional target against every staged
  // placement, cameras included (#1294), so a subject the performance stage
  // accepts must be a subject staging can aim at. A camera naming itself is
  // still refused, by the zero-length look-vector check below.
  //
  // Cameras are laid down FIRST, the same precedence `scenePlacements` uses, so
  // an (illegal) id repeated between a camera and an actor still resolves to the
  // actor and the two tables cannot disagree about a malformed scene.
  const placedPoints = new Map<string, IAutoMovieVector3>([
    ...staging.cameras.map((camera) => [camera.node, camera.position] as const),
    ...staging.actors.map((a) => [a.node, a.position] as const),
    ...(staging.set ?? []).map(
      (piece) => [piece.node, piece.position] as const,
    ),
  ]);

  const validateNonEmptyId = (
    id: string,
    path: string,
    label: string,
  ): void => {
    if (id.trim().length === 0)
      out.push("type", path, `${label} must be a non-empty id`, id);
  };

  validateNonEmptyId(staging.scene.id, `$input.scene.id`, "scene id");

  script.cast.forEach((member, i) => {
    if (member.modelRef !== null)
      validateNonEmptyId(
        member.modelRef,
        `$script.cast[${i}].modelRef`,
        "cast model reference",
      );
    if (!placed.has(member.node))
      out.push(
        "type",
        `$input.actors`,
        `cast node "${member.node}" (cast[${i}]) must be placed by staging`,
        member.node,
      );
  });

  const ids = new Set<string>();
  const claim = (id: string, path: string, label: string): void => {
    validateNonEmptyId(id, path, label);
    if (ids.has(id))
      out.push("type", path, `id "${id}" must be unique in the scene`, id);
    ids.add(id);
  };

  staging.actors.forEach((placement, i) => {
    claim(placement.node, `$input.actors[${i}].node`, "actor node id");
    if (!cast.has(placement.node))
      out.push(
        "type",
        `$input.actors[${i}].node`,
        `placement must name a script cast node, but "${placement.node}" is not in the cast`,
        placement.node,
      );
    if (!isFiniteVector3(placement.position))
      out.push(
        "range",
        `$input.actors[${i}].position`,
        "actor position must be a finite vector",
        placement.position,
      );
    if (!Number.isFinite(placement.facingDeg))
      out.push(
        "range",
        `$input.actors[${i}].facingDeg`,
        `actor facingDeg must be finite, but was ${placement.facingDeg}`,
        placement.facingDeg,
      );
    if (placement.attach !== undefined) {
      if (placement.attach.parent === placement.node)
        out.push(
          "type",
          `$input.actors[${i}].attach.parent`,
          `a node cannot ride itself`,
          placement.attach.parent,
        );
      else if (!placed.has(placement.attach.parent))
        out.push(
          "type",
          `$input.actors[${i}].attach.parent`,
          `mount parent "${placement.attach.parent}" must be a placed actor`,
          placement.attach.parent,
        );
    }
  });

  (staging.set ?? []).forEach((piece, i) => {
    claim(piece.node, `$input.set[${i}].node`, "set node id");
    validateNonEmptyId(piece.model, `$input.set[${i}].model`, "set model id");
    if (!isFiniteVector3(piece.position))
      out.push(
        "range",
        `$input.set[${i}].position`,
        "set position must be a finite vector",
        piece.position,
      );
    if (piece.facingDeg !== undefined && !Number.isFinite(piece.facingDeg))
      out.push(
        "range",
        `$input.set[${i}].facingDeg`,
        `set facingDeg must be finite when present, but was ${piece.facingDeg}`,
        piece.facingDeg,
      );
    if (piece.facingDeg !== undefined && piece.rotation !== undefined)
      out.push(
        "type",
        `$input.set[${i}].rotation`,
        "set rotation and facingDeg are mutually exclusive",
        piece.rotation,
      );
    if (piece.rotation !== undefined) {
      const length = Math.hypot(
        piece.rotation.x,
        piece.rotation.y,
        piece.rotation.z,
        piece.rotation.w,
      );
      if (
        ![
          piece.rotation.x,
          piece.rotation.y,
          piece.rotation.z,
          piece.rotation.w,
        ].every(Number.isFinite) ||
        Math.abs(length - 1) > 1e-6
      )
        out.push(
          "range",
          `$input.set[${i}].rotation`,
          `set rotation must be a finite unit quaternion, but length was ${length}`,
          piece.rotation,
        );
    }
    if (piece.scale !== undefined) {
      const scale = setPieceScale(piece.scale);
      // Zero collapses the piece to nothing (a set piece that draws no pixels
      // is a staging mistake, not a style); a negative axis mirrors it, which
      // flips the winding the normal and outline passes read.
      if (
        ![scale.x, scale.y, scale.z].every(
          (axis) => Number.isFinite(axis) && axis > 0,
        )
      )
        out.push(
          "range",
          `$input.set[${i}].scale`,
          "set scale must be finite and greater than zero on every axis",
          piece.scale,
        );
    }
  });

  // The space is the ground's meaning, gated by the shared surface validator so
  // staging and a hand-authored scene can never disagree about what a
  // well-formed space is (#1173). Its own `$input` paths are re-rooted under
  // `$input.space` so the correction round points at the submitted field.
  if (staging.space !== undefined) {
    const validated = validateSpace({ space: staging.space });
    if (validated.success === false)
      for (const item of validated.violations)
        out.items.push({
          ...item,
          path: item.path.replace("$input", "$input.space"),
        });
  }

  // The atmosphere, gated at the field the author submitted. Unlike the space
  // it needs no shared validator: fog is two scalars-and-a-color with no
  // referential integrity to check, so the rule lives beside the other
  // placement rules rather than in a module of its own.
  if (staging.fog !== undefined)
    validateFogPlacement(staging.fog, "$input.fog", out);
  if (staging.environment !== undefined) {
    const validated = validateSceneEnvironment({
      environment: staging.environment,
    });
    if (validated.success === false)
      for (const item of validated.violations)
        out.items.push({
          ...item,
          path: item.path.replace("$input", "$input.environment"),
        });
  }

  staging.cameras.forEach((camera, i) => {
    const path = `$input.cameras[${i}]`;
    claim(camera.node, `$input.cameras[${i}].node`, "camera node id");
    const positionFinite = isFiniteVector3(camera.position);
    if (!positionFinite)
      out.push(
        "range",
        `$input.cameras[${i}].position`,
        "camera position must be a finite vector",
        camera.position,
      );
    if (!(camera.fovDeg > 0 && camera.fovDeg < 180))
      out.push(
        "range",
        `$input.cameras[${i}].fovDeg`,
        `vertical field of view must be within (0, 180)°, but was ${camera.fovDeg}`,
        camera.fovDeg,
      );
    if (!Number.isFinite(camera.near) || camera.near <= 0)
      out.push(
        "range",
        `${path}.near`,
        "camera near distance must be finite and greater than zero metres",
        camera.near,
      );
    if (!Number.isFinite(camera.far) || camera.far <= camera.near)
      out.push(
        "range",
        `${path}.far`,
        "camera far distance must be finite and greater than near",
        camera.far,
      );
    validateCameraDepthPrecision(
      camera.depthPrecision,
      `${path}.depthPrecision`,
      out,
    );
    if (camera.lookAt.kind === "node" && !placedPoints.has(camera.lookAt.node))
      out.push(
        "type",
        `$input.cameras[${i}].lookAt.node`,
        `camera target "${camera.lookAt.node}" must be a placed actor, set piece, or camera`,
        camera.lookAt.node,
      );
    if (camera.lookAt.kind === "point" && !isFiniteVector3(camera.lookAt.point))
      out.push(
        "range",
        `$input.cameras[${i}].lookAt.point`,
        "camera point target must be a finite vector",
        camera.lookAt.point,
      );
    const target =
      camera.lookAt.kind === "node"
        ? placedPoints.get(camera.lookAt.node)
        : camera.lookAt.point;
    if (
      target !== undefined &&
      positionFinite &&
      isFiniteVector3(target) &&
      Vector3.length(Vector3.subtract(target, camera.position)) < 1e-9
    )
      out.push(
        "range",
        `$input.cameras[${i}].lookAt`,
        "camera lookAt must not equal the camera position",
        camera.lookAt,
      );
    if (camera.clearance !== undefined)
      validateCameraClearanceEnvelope(
        camera.clearance,
        `${path}.clearance`,
        out,
      );
  });

  staging.lights.forEach((light, i) => {
    const path = `$input.lights[${i}]`;
    claim(light.node, `${path}.node`, "light node id");
    if (!Number.isFinite(light.intensity) || light.intensity < 0)
      out.push(
        "range",
        `${path}.intensity`,
        `intensity must be a finite number >= 0, but was ${light.intensity}`,
        light.intensity,
      );
    validateLightPlacementShape(light, path, out);
  });

  if (out.items.length > 0) return { success: false, violations: out.items };

  const nodes: IAutoMovieSceneNode[] = [
    ...staging.actors.map(
      (placement): IAutoMovieSceneNode => ({
        id: placement.node,
        model: cast.get(placement.node)!.member.modelRef ?? placement.node,
        transform: {
          translation: placement.position,
          rotation: Quaternion.fromAxisAngle(
            { x: 0, y: 1, z: 0 },
            placement.facingDeg,
          ),
          scale: { x: 1, y: 1, z: 1 },
        },
        motion: null,
        pose: null,
      }),
    ),
    // Set pieces are scenery: static nodes realising skeleton-less models
    // (#1173), so the guide passes describe a world, not a void.
    ...(staging.set ?? []).map(
      (piece): IAutoMovieSceneNode => ({
        id: piece.node,
        model: piece.model,
        transform: {
          translation: piece.position,
          rotation:
            piece.rotation ??
            Quaternion.fromAxisAngle(
              { x: 0, y: 1, z: 0 },
              piece.facingDeg ?? 0,
            ),
          scale: setPieceScale(piece.scale),
        },
        motion: null,
        pose: null,
      }),
    ),
  ];

  const cameras = staging.cameras.map((camera) => {
    const target: IAutoMovieVector3 =
      camera.lookAt.kind === "node"
        ? placedPoints.get(camera.lookAt.node)!
        : camera.lookAt.point;
    return {
      id: camera.node,
      transform: {
        translation: camera.position,
        rotation: lookRotation(Vector3.subtract(target, camera.position)),
        scale: { x: 1, y: 1, z: 1 },
      },
      fovY: camera.fovDeg,
      near: camera.near,
      far: camera.far,
      depthPrecision: { ...camera.depthPrecision },
      ...(camera.clearance === undefined
        ? {}
        : { clearance: lowerCameraClearanceEnvelope(camera.clearance) }),
    };
  });

  const lights: IAutoMovieLight[] = staging.lights.map(lowerLightPlacement);

  const mounts: IAutoMovieStagedSet.IMount[] = staging.actors
    .filter((placement) => placement.attach !== undefined)
    .map((placement) => ({ node: placement.node, binding: placement.attach! }));

  return {
    success: true,
    scene: {
      id: staging.scene.id,
      name: staging.scene.name,
      nodes,
      cameras,
      lights,
      // Emitted explicitly (not omitted) so a staged scene always states
      // whether it has a ground: `null` is "no space, fall back to the scalar
      // plane", which is a decision, not an absent field.
      space: staging.space ?? null,
      // Fog goes the other way and is OMITTED when unstaged, deliberately.
      // A ground is something every set has, so stating `null` says "this one
      // is the scalar plane"; an atmosphere is something most sets simply do
      // not have, and writing `fog: null` onto every staged scene ever composed
      // would change the bytes, and therefore the content digest, of every
      // production that never mentioned fog. Absent already means none.
      ...(staging.fog === undefined ? {} : { fog: staging.fog }),
      ...(staging.environment === undefined
        ? {}
        : { environment: staging.environment }),
    },
    mounts,
  };
};
