import type { IAutoMovieLibraryObservationPose } from "@automovie/interface";

/** Parse the pose used by one observation, or null when none was supplied. */
export const readAutoMovieObservationPose = (
  value: string | undefined,
): IAutoMovieLibraryObservationPose | null => {
  if (value === undefined) return null;
  const shape =
    "--pose must be one JSON object stating position, direction, target and space.";
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error(shape);
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed))
    throw new Error(shape);
  const record = parsed as Record<string, unknown>;
  const vector = (name: string): { x: number; y: number; z: number } => {
    const candidate = record[name];
    if (
      typeof candidate !== "object" ||
      candidate === null ||
      Array.isArray(candidate)
    )
      throw new Error(`--pose ${name} must be one { x, y, z } object.`);
    const axes = candidate as Record<string, unknown>;
    const read = (axis: "x" | "y" | "z"): number => {
      const component = axes[axis];
      if (typeof component !== "number" || Number.isFinite(component) === false)
        throw new Error(`--pose ${name}.${axis} must be one finite number.`);
      return component;
    };
    return { x: read("x"), y: read("y"), z: read("z") };
  };
  const space = record.space;
  if (
    space !== null &&
    (typeof space !== "string" || space.trim() !== space || space === "")
  )
    throw new Error("--pose space must be one nonblank space name or null.");
  return {
    position: vector("position"),
    direction: vector("direction"),
    target: vector("target"),
    space,
  };
};

/** Parse the finite numeric measurements reported by one observation. */
export const readAutoMovieObservationMeasurements = (
  value: string | undefined,
): Record<string, number> => {
  if (value === undefined) return {};
  const shape = "--measurements must be one JSON object of named numbers.";
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error(shape);
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed))
    throw new Error(shape);
  const entries: Array<readonly [string, number]> = [];
  for (const [name, reading] of Object.entries(parsed)) {
    if (name.trim() !== name || name === "")
      throw new Error(
        "--measurements keys must be nonblank names without surrounding whitespace.",
      );
    if (typeof reading !== "number" || Number.isFinite(reading) === false)
      throw new Error(`--measurements ${name} must be one finite number.`);
    entries.push([name, reading]);
  }
  return Object.fromEntries(entries);
};
