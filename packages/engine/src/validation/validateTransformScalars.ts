import { IAutoMovieTransform } from "@automovie/interface";

import { ViolationCollector } from "./violation";

/** Validate finite TRS components and strictly-positive scale. */
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
