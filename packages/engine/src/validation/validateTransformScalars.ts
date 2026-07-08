import { IAutoMovieTransform } from "@automovie/interface";

import { ViolationCollector } from "./violation";

const UNIT_QUATERNION_EPSILON = 1e-6;

/** Validate finite TRS components, unit rotation, and strictly-positive scale. */
export const validateTransformScalars = (props: {
  transform: IAutoMovieTransform;
  path: string;
  label: string;
  collector: ViolationCollector;
}): void => {
  const { transform, path, label, collector } = props;
  const finiteFields: ReadonlyArray<readonly [string, number]> = [
    [`${path}.translation.x`, transform.translation.x],
    [`${path}.translation.y`, transform.translation.y],
    [`${path}.translation.z`, transform.translation.z],
    [`${path}.rotation.x`, transform.rotation.x],
    [`${path}.rotation.y`, transform.rotation.y],
    [`${path}.rotation.z`, transform.rotation.z],
    [`${path}.rotation.w`, transform.rotation.w],
    [`${path}.scale.x`, transform.scale.x],
    [`${path}.scale.y`, transform.scale.y],
    [`${path}.scale.z`, transform.scale.z],
  ];
  for (const [fieldPath, value] of finiteFields)
    if (!Number.isFinite(value))
      collector.push(
        "range",
        fieldPath,
        `${label} component must be finite, but was ${value}`,
        value,
      );

  const rotationLength = Math.hypot(
    transform.rotation.x,
    transform.rotation.y,
    transform.rotation.z,
    transform.rotation.w,
  );
  if (
    Number.isFinite(rotationLength) &&
    Math.abs(rotationLength - 1) > UNIT_QUATERNION_EPSILON
  )
    collector.push(
      "range",
      `${path}.rotation`,
      `${label} rotation must be a unit quaternion (length 1), but length was ${rotationLength}`,
      transform.rotation,
    );

  const scaleFields: ReadonlyArray<readonly [string, number]> = [
    [`${path}.scale.x`, transform.scale.x],
    [`${path}.scale.y`, transform.scale.y],
    [`${path}.scale.z`, transform.scale.z],
  ];
  for (const [fieldPath, value] of scaleFields)
    if (value <= 0)
      collector.push(
        "range",
        fieldPath,
        `${label} scale component must be > 0, but was ${value}`,
        value,
      );
};
