import { IAutoMovieConstraintViolation } from "@automovie/interface";

import {
  pushViolation,
  validateArrayArtifact,
  validateObjectArtifact,
} from "./primitives";

/**
 * Structural floor for an {@link IAutoMovieSpace} arriving over MCP (#1173), the
 * JSON shape the engine's `validateSpace` dereferences without checking,
 * because inside the engine the value is already typed.
 *
 * Both space entry points share it: the `stage` tool's `staging.space` and a
 * committed scene's `scene.space`. A space is the only staging payload with a
 * nested array of objects each holding a further array of vectors — and, since
 * a footprint may be holed, a further array of those — so a malformed one would
 * otherwise reach `surface.polygon.forEach`, `surface.holes.map` or
 * `surface.height.samples.forEach` as a throw instead of a field-located
 * violation.
 *
 * Types only. Emptiness, uniqueness, whether a ring encloses area or crosses
 * itself, whether a hole lies inside its own plate, which ground statement a
 * surface is allowed, ramp axes, height-rule ranges, and walkable resolution
 * stay with the engine's `validateSpace`, so every space rule has exactly one
 * owner and staging cannot disagree with a committed scene. Returns whether the
 * shape is safe to hand to that validator.
 *
 * @evidence requirements/diagnostics/identity-path-and-context.md#diagnostics-path-and-scope Locates every malformed space field at the caller-provided input path.
 * @evidence specifications/validation-and-diagnostics/diagnostic-identity-location-and-severity.md#validation-diagnostic-path-scope Preserves structural space locations before delegating semantic validation to the engine.
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
  // The one place the payload nests three deep: holes are rings of points, and
  // the engine maps over both levels, so a hole list that is not a list of
  // lists reaches `.map` as a throw instead of a located violation.
  if (
    surface.holes !== undefined &&
    validateArrayArtifact(
      surface.holes,
      `${path}.holes`,
      "footprint holes",
      violations,
    )
  )
    surface.holes.forEach((hole, index) => {
      const hp = `${path}.holes[${index}]`;
      if (!validateArrayArtifact(hole, hp, "footprint hole", violations))
        return;
      hole.forEach((point, at) => {
        validateObjectArtifact(point, `${hp}[${at}]`, "hole point", violations);
      });
    });
  // A surface states its ground exactly one way, and WHICH way is the engine's
  // rule to enforce: absence is a located `validateSpace` violation rather than
  // a shape refusal, because a payload that omits both is well-formed JSON
  // saying something wrong, not malformed JSON. Only presence is shaped here.
  if (surface.anchor !== undefined)
    validateObjectArtifact(
      surface.anchor,
      `${path}.anchor`,
      "surface anchor",
      violations,
    );
  if (surface.rampTo !== null && surface.rampTo !== undefined)
    validateObjectArtifact(
      surface.rampTo,
      `${path}.rampTo`,
      "surface ramp anchor (null when flat)",
      violations,
    );
  if (
    surface.height !== undefined &&
    validateObjectArtifact(
      surface.height,
      `${path}.height`,
      "surface height rule",
      violations,
    ) &&
    surface.height.kind === "heightfield"
  )
    // The one array inside a height rule. Every other field is a scalar the
    // engine range-checks, but `samples` is walked, so a non-array would reach
    // `.forEach` as a throw.
    validateArrayArtifact(
      surface.height.samples,
      `${path}.height.samples`,
      "heightfield samples",
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
