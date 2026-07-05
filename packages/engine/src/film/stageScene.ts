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
import { ViolationCollector } from "../validation/violation";
import { lookRotation } from "./cameraMove";

/**
 * Camera frustum bounds the staging schema does not ask the model for — the LLM
 * decides placement and field of view, the engine owns the clip planes.
 */
const CAMERA_NEAR = 0.1;
const CAMERA_FAR = 1000;

/** Cameras look down local −Z (glTF convention); lights shine down −Z too. */
const FORWARD: IAutoMovieVector3 = { x: 0, y: 0, z: -1 };

const isFiniteVector3 = (vector: IAutoMovieVector3): boolean =>
  [vector.x, vector.y, vector.z].every((coordinate) =>
    Number.isFinite(coordinate),
  );

/**
 * A staged film set: the composed {@link IAutoMovieScene} plus the persistent
 * mount couplings staging declared. Mounts stay alongside rather than inside
 * the scene because a scene node is a flat world placement — the per-frame
 * world transform of a mounted rider comes from `resolveAttachment` against the
 * parent's posed skeleton, not from the scene graph.
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

  /** One rider→parent-bone coupling, resolved per frame by the host. */
  export interface IMount {
    /** The mounted (riding) scene node. */
    node: string;

    /** The coupling it rides. */
    binding: IAutoMovieMountBinding;
  }
}

/**
 * The STAGING consumer — fold the script's cast and the staging stage's
 * placements into the {@link IAutoMovieScene} every later stage performs into.
 * This is the first rung of the film pipeline (the workflow spine): LLM stage
 * payloads in, a validated engine artifact or a violation list out.
 *
 * Referential integrity is the whole check: every placement must name a cast
 * member, every cast member must be placed (an unplaced character can never
 * appear on screen), ids must not collide, and a camera aimed at a node or a
 * mount riding a parent must point at something that exists. Geometry is
 * converted, not judged — whether 0.7 m is striking range is the reviewer's
 * business, not a constraint.
 *
 * Conversions: `facingDeg` (about +Y, 0 = facing +Z) becomes the node's
 * rotation; a camera's `lookAt` resolves to a point and the shortest-arc
 * rotation aims its −Z there; every light is realised as directional, because
 * the staging schema gives lights a direction and no position.
 */
export const stageScene = (
  script: IAutoMovieScriptApplication.IWrite,
  staging: IAutoMovieStagingApplication.IWrite,
): IAutoMovieStagedSet => {
  const out = new ViolationCollector();
  const cast = new Map(script.cast.map((c) => [c.node, c]));
  const placed = new Map(staging.actors.map((a) => [a.node, a]));

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
    if (camera.lookAt.kind === "node" && !placed.has(camera.lookAt.node))
      out.push(
        "type",
        `$input.cameras[${i}].lookAt.node`,
        `camera target "${camera.lookAt.node}" must be a placed actor`,
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
        ? placed.get(camera.lookAt.node)?.position
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
    claim(light.node, `$input.lights[${i}].node`, "light node id");
    if (!Number.isFinite(light.intensity) || light.intensity < 0)
      out.push(
        "range",
        `$input.lights[${i}].intensity`,
        `intensity must be a finite number >= 0, but was ${light.intensity}`,
        light.intensity,
      );
    const direction = [light.direction.x, light.direction.y, light.direction.z];
    if (
      direction.some((component) => !Number.isFinite(component)) ||
      Vector3.length(light.direction) === 0
    )
      out.push(
        "range",
        `$input.lights[${i}].direction`,
        `direction must be a finite non-zero vector`,
        light.direction,
      );
  });

  if (out.items.length > 0) return { success: false, violations: out.items };

  const nodes: IAutoMovieSceneNode[] = staging.actors.map((placement) => ({
    id: placement.node,
    model: cast.get(placement.node)!.modelRef ?? placement.node,
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
  }));

  const cameras = staging.cameras.map((camera) => {
    const target: IAutoMovieVector3 =
      camera.lookAt.kind === "node"
        ? placed.get(camera.lookAt.node)!.position
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

  const lights: IAutoMovieLight[] = staging.lights.map((light) => ({
    id: light.node,
    type: "directional",
    transform: {
      translation: { x: 0, y: 0, z: 0 },
      rotation: aimRotation(FORWARD, light.direction),
      scale: { x: 1, y: 1, z: 1 },
    },
    color: { r: 1, g: 1, b: 1, a: null, hex: null },
    intensity: light.intensity,
  }));

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
    },
    mounts,
  };
};
