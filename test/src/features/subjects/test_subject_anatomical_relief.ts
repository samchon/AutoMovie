import { TestValidator } from "@nestia/e2e";

import {
  type IPortraitReliefRegion,
  createPortraitReliefLayer,
} from "../../subjects/portraitRelief";
import { nclose, throwsError } from "../internal/predicates";

/**
 * Named tissue supports remain attached to the current skin and cross the
 * millimetre-to-metre boundary once, with owned settings and explicit refusal.
 *
 * Scenarios:
 * 1. A hand-defined anchor, offset, radius and displacement produce the expected
 *    metric field; moving the host moves only its centre. Caller edits stay out.
 * 2. Empty and zero supports emit no fields. Invalid identities, dimensions,
 *    missing/invalid host points and centre overflow refuse before deformation.
 */
export const test_subject_anatomical_relief = (): void => {
  const region: IPortraitReliefRegion = {
    name: "support",
    anchor: 0,
    offset: [10, -20, 30],
    radius: [4, 5, 6],
    displacement: [1, -2, 3],
  };
  const layer = createPortraitReliefLayer("tissue", [region]);
  region.offset[0] = 99;
  const host = { positions: [[100, 200, 300]], indices: [], normals: [] };
  const field = layer.fields(host)[0];
  TestValidator.predicate(
    "metric field oracle",
    nclose(field.center.x, 0.11) &&
      nclose(field.center.y, 0.18) &&
      nclose(field.center.z, 0.33) &&
      nclose(field.radius.x, 0.004) &&
      nclose(field.radius.y, 0.005) &&
      nclose(field.radius.z, 0.006) &&
      nclose(field.displacement.x, 0.001) &&
      nclose(field.displacement.y, -0.002) &&
      nclose(field.displacement.z, 0.003),
  );
  const moved = layer.fields({ ...host, positions: [[130, 180, 305]] })[0];
  TestValidator.predicate(
    "current skin controls attachment",
    nclose(moved.center.x - field.center.x, 0.03) &&
      nclose(moved.center.y - field.center.y, -0.02) &&
      nclose(moved.center.z - field.center.z, 0.005),
  );
  TestValidator.equals(
    "empty layer",
    createPortraitReliefLayer("empty", []).fields(host),
    [],
  );
  TestValidator.equals(
    "neutral region",
    createPortraitReliefLayer("neutral", [
      { ...region, displacement: [0, 0, 0] },
    ]).fields(host),
    [],
  );
  for (const invalid of [
    { ...region, name: " " },
    { ...region, anchor: -1 },
    { ...region, anchor: 0.5 },
    { ...region, offset: [0, 0] as unknown as [number, number, number] },
    { ...region, offset: [NaN, 0, 0] as [number, number, number] },
    { ...region, radius: [0, 1, 1] as [number, number, number] },
    { ...region, radius: [-1, 1, 1] as [number, number, number] },
    { ...region, displacement: [0, Infinity, 0] as [number, number, number] },
  ])
    TestValidator.predicate(
      "invalid region refuses",
      throwsError(
        () => createPortraitReliefLayer("tissue", [invalid]),
        "named bindings",
      ),
    );
  TestValidator.predicate(
    "empty layer identity refuses",
    throwsError(() => createPortraitReliefLayer(" ", []), "named bindings"),
  );
  TestValidator.predicate(
    "duplicate region identity refuses",
    throwsError(
      () => createPortraitReliefLayer("tissue", [region, region]),
      "named bindings",
    ),
  );
  for (const positions of [[], [[0, 0]], [[0, NaN, 0]]])
    TestValidator.predicate(
      "invalid attachment refuses",
      throwsError(
        () => layer.fields({ ...host, positions }),
        "skin attachment",
      ),
    );
  const overflowing = createPortraitReliefLayer("overflow", [
    { ...region, offset: [Number.MAX_VALUE, 0, 0] },
  ]);
  TestValidator.predicate(
    "unrepresentable centre refuses",
    throwsError(
      () =>
        overflowing.fields({ ...host, positions: [[Number.MAX_VALUE, 0, 0]] }),
      "representable",
    ),
  );
};
