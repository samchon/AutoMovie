import { IAutoMovieConstraintViolation } from "@automovie/interface";

import {
  pushViolation,
  validateArrayArtifact,
  validateObjectArtifact,
} from "./primitives";

/**
 * Structural floor for an {@link IAutoMovieSpace} arriving over MCP (#1173) —
 * the JSON shape the engine's `validateSpace` dereferences without checking,
 * because inside the engine the value is already typed.
 *
 * Both space entry points share it: the `stage` tool's `staging.space` and a
 * committed scene's `scene.space`. A space is the only staging payload with a
 * nested array of objects each holding a further array of vectors, so a
 * malformed one would otherwise reach `surface.polygon.forEach` or
 * `surface.rampTo.x` as a throw instead of a field-located violation.
 *
 * Types only — emptiness, uniqueness, convexity, ramp axes, and walkable
 * resolution stay with the engine's `validateSpace`, so every space rule has
 * exactly one owner and staging cannot disagree with a committed scene. Returns
 * whether the shape is safe to hand to that validator.
 *
 * @author Samchon
 */
export const validateSpaceShape = (
  space: unknown,
  path: string,
  violations: IAutoMovieConstraintViolation[],
): boolean => {
  const before = violations.length;
  if (!validateObjectArtifact(space, path, "space", violations)) return false;
  requireStringField(space.id, `${path}.id`, "space id", violations);
  if (
    validateArrayArtifact(
      space.surfaces,
      `${path}.surfaces`,
      "space surfaces",
      violations,
    )
  )
    space.surfaces.forEach((surface, index) => {
      validateSurfaceShape(surface, `${path}.surfaces[${index}]`, violations);
    });
  if (
    validateArrayArtifact(
      space.walkable,
      `${path}.walkable`,
      "space walkable ids",
      violations,
    )
  )
    space.walkable.forEach((id, index) => {
      requireStringField(
        id,
        `${path}.walkable[${index}]`,
        "walkable surface id",
        violations,
      );
    });
  return violations.length === before;
};

const validateSurfaceShape = (
  surface: unknown,
  path: string,
  violations: IAutoMovieConstraintViolation[],
): void => {
  if (!validateObjectArtifact(surface, path, "space surface", violations))
    return;
  requireStringField(surface.id, `${path}.id`, "surface id", violations);
  requireStringField(surface.kind, `${path}.kind`, "surface kind", violations);
  if (
    validateArrayArtifact(
      surface.polygon,
      `${path}.polygon`,
      "surface footprint",
      violations,
    )
  )
    surface.polygon.forEach((point, index) => {
      validateObjectArtifact(
        point,
        `${path}.polygon[${index}]`,
        "footprint point",
        violations,
      );
    });
  validateObjectArtifact(
    surface.anchor,
    `${path}.anchor`,
    "surface anchor",
    violations,
  );
  // `rampTo` is `IAutoMovieVector3 | null`, and the height query branches on
  // `!== null` before reading `.x` — an omitted field would read as a ramp and
  // throw, so absence is a violation rather than a silent flat patch.
  if (surface.rampTo !== null)
    validateObjectArtifact(
      surface.rampTo,
      `${path}.rampTo`,
      "surface ramp anchor (null when flat)",
      violations,
    );
};

const requireStringField = (
  value: unknown,
  path: string,
  label: string,
  violations: IAutoMovieConstraintViolation[],
): void => {
  if (typeof value === "string") return;
  pushViolation(violations, "type", path, `${label} must be a string`, value);
};
