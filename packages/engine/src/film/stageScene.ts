import {
  IAutoMovieConstraintViolation,
  IAutoMovieLight,
  IAutoMovieMountBinding,
  IAutoMovieScene,
  IAutoMovieSceneNode,
  IAutoMovieScriptApplication,
  IAutoMovieStagingApplication,
  IAutoMovieVector3,
} from "@automovie/interface";

import { aimRotation } from "../kinematics/aimRotation";
import { Quaternion } from "../math/Quaternion";
import { Vector3 } from "../math/Vector3";
import {
  AUTO_MOVIE_LIGHT_TYPES,
  isAutoMovieLightType,
} from "../resolve/lightChannel";
import { isRecord } from "../validation/artifactShape";
import { validateSpace } from "../validation/validateSpace";
import { ViolationCollector } from "../validation/violation";
import { lookRotation } from "./cameraMove";

/**
 * Camera frustum bounds the staging schema does not ask the model for, the LLM
 * decides placement and field of view, the engine owns the clip planes.
 */
const CAMERA_NEAR = 0.1;
const CAMERA_FAR = 1000;

/** Cameras look down local −Z (glTF convention); lights shine down −Z too. */
const FORWARD: IAutoMovieVector3 = { x: 0, y: 0, z: -1 };

/** No turn: a point light radiates every way, so its orientation is arbitrary. */
const IDENTITY_ROTATION = { x: 0, y: 0, z: 0, w: 1 };

const isFiniteVector3 = (vector: IAutoMovieVector3): boolean =>
  [vector.x, vector.y, vector.z].every((coordinate) =>
    Number.isFinite(coordinate),
  );

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
  light: IAutoMovieStagingApplication.ILightPlacement,
): IAutoMovieLight["type"] | null => {
  const type = (light as unknown as { type?: unknown }).type;
  if (type === undefined) return "directional";
  return isAutoMovieLightType(type) ? type : null;
};

/** A spot's cone half-angle when the placement leaves it to the engine. */
const DEFAULT_CONE_ANGLE = 45;

/**
 * The staging light contract, per kind (#1341).
 *
 * `stage` used to accept `{node, role, direction, intensity}` and lower every
 * entry to a white directional light, so a candle, a sunset, a neon sign, and a
 * window shaft were all the same frame, and an author who wanted a warm lamp
 * had to hand-patch `scene.lights` after `stage` and lose the referential
 * integrity `stage` exists to give. The placement now spans the same three
 * kinds {@link IAutoMovieLight} already models, which makes each kind's
 * parameter set exact rather than advisory:
 *
 * - An aimed light (`directional`, `spot`) needs a finite non-zero `direction`
 *   and a `point` light must not carry one, since it radiates every way;
 * - A positioned light (`point`, `spot`) needs a finite `position` and a
 *   `directional` light must not carry one, since it is infinitely distant;
 * - `range` belongs to the falloff kinds and `coneAngle` to `spot` alone.
 *
 * A parameter that cannot act is refused rather than ignored: silently dropping
 * a `coneAngle` on a point light is the same false green the campaign is
 * closing elsewhere. Colors are range-checked here too, because `stage` is the
 * only rung between the model and the scene.
 */
const validateLightPlacementShape = (
  light: IAutoMovieStagingApplication.ILightPlacement,
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
  const aimed = type === "directional" || type === "spot";
  const positioned = type === "point" || type === "spot";

  if (light.direction === undefined) {
    if (aimed)
      out.push(
        "type",
        `${path}.direction`,
        `a ${type} light is aimed and needs a direction`,
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
        `a ${type} light falls off with distance and needs a position`,
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
    if (!positioned)
      out.push(
        "type",
        `${path}.range`,
        `a directional light has no distance falloff and takes no range`,
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
        `only a spot light has a cone; a ${type} light takes no coneAngle`,
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

  if (light.color !== undefined) validateLightColor(light.color, path, out);
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
const lowerLightPlacement = (
  light: IAutoMovieStagingApplication.ILightPlacement,
): IAutoMovieLight => {
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
  };
  if (type === "point") return { ...base, type, range: light.range ?? 0 };
  if (type === "spot")
    return {
      ...base,
      type,
      range: light.range ?? 0,
      coneAngle: light.coneAngle ?? DEFAULT_CONE_ANGLE,
    };
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
 * @author Samchon
 */
export type IAutoMovieStagedSet =
  | IAutoMovieStagedSet.ISuccess
  | IAutoMovieStagedSet.IFailure;
export namespace IAutoMovieStagedSet {
  /** Staging was coherent; the set is ready for blocking/performance. */
  export interface ISuccess {
    /** Discriminator. */
    success: true;

    /** The composed scene (actors at rest, cameras aimed, lights rigged). */
    scene: IAutoMovieScene;

    /** Validated persistent couplings, one per mounted rider. */
    mounts: IMount[];
  }

  /** Staging contradicted the script or itself; nothing was composed. */
  export interface IFailure {
    /** Discriminator. */
    success: false;

    /** Every contradiction found, for the correction round. */
    violations: IAutoMovieConstraintViolation[];
  }

  /**
   * One rider→parent-bone coupling. `performShot` bakes it into the rider's
   * per-frame follow clip (#674); the host plays that clip, it does not resolve
   * the coupling itself.
   */
  export interface IMount {
    /** The mounted (riding) scene node. */
    node: string;

    /** The coupling it rides. */
    binding: IAutoMovieMountBinding;
  }
}

/**
 * The STAGING consumer, fold the script's cast and the staging stage's
 * placements into the {@link IAutoMovieScene} every later stage performs into.
 * This is the first rung of the film pipeline (the workflow spine): LLM stage
 * payloads in, a validated engine artifact or a violation list out.
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
 * scene light its `type` names (directional, point, or spot), aimed by
 * `direction` and placed at `position`, in its authored color.
 *
 * The environment is two halves of one thing (#1173): `set` pieces are the
 * visible geometry the guide passes draw, and the optional `space` is the
 * ground's meaning, standable surfaces and walkability, copied onto the
 * composed scene after {@link validateSpace} accepts it. Omitting `space`
 * composes `space: null`, the scalar ground plane the engine assumed before.
 */
export const stageScene = (
  script: IAutoMovieScriptApplication.IWrite,
  staging: IAutoMovieStagingApplication.IWrite,
): IAutoMovieStagedSet => {
  const out = new ViolationCollector();
  const cast = new Map<
    string,
    {
      member: IAutoMovieScriptApplication.IWrite["cast"][number];
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

  staging.cameras.forEach((camera, i) => {
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
          rotation: Quaternion.fromAxisAngle(
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
      near: CAMERA_NEAR,
      far: CAMERA_FAR,
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
    },
    mounts,
  };
};
