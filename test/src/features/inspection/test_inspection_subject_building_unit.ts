import {
  builtEnvironmentElementBounds,
  describeAutoMovieSubject,
  describeAutoMovieSubjects,
  diffAutoMovieSubjects,
} from "@automovie/engine";
import type {
  IAutoMovieBuiltEnvironment,
  IAutoMovieSubjectArtifact,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { namedFacts } from "../internal/predicates";
import {
  subjectInspectionArtifact,
  subjectInspectionIdentityTransform,
  subjectInspectionModel,
} from "../internal/subjectInspectionFixtures";

/** One two-vertex model, so every expected box is read off its own numbers. */
const MODEL = subjectInspectionModel({
  id: "unit-model",
  min: { x: -1, y: 0, z: -1 },
  max: { x: 1, y: 2, z: 1 },
});

/**
 * A whole building unit is a subject a reviewer can open.
 *
 * The scene walk knows nodes and the space tree knows rooms, so between them
 * the one thing nobody could address was the building. That is not a gap in a
 * survey, it is the address the derived observation population already uses:
 * every exterior requirement is written against `building:<environment>/<unit>`,
 * and an id nothing resolves is a review target nobody can open.
 *
 * A unit's extent is measured over the elements it owns rather than over the
 * rooms it contains, because the record states that ownership is total while a
 * space claims no envelope at all. Every box here is read off a model whose
 * mesh is exactly its own two corners and a population whose layout law states
 * its own slot positions, so the expected numbers are arithmetic rather than a
 * reading of what the code produced. The record is an inspection input rather
 * than a validated design: the two-vertex model carries no material colour, and
 * what legality means for a building is settled by its own validator's tests.
 *
 * Scenarios:
 *
 * 1. The enumeration carries one subject per declared building unit.
 * 2. A unit opens by its own id and reports the structural role, the two roots
 *    a walk of it starts from, and null for everything it stages itself.
 * 3. Its content box is the union over every element descending from its root,
 *    including one two storeys up, and matches those elements' own boxes.
 * 4. A unit whose only content is a compact population measures that population,
 *    because the rooms under it already answer for the sets placed in them.
 * 5. A unit that stages nothing reports a null content box rather than an empty
 *    or infinite one.
 * 6. An id no declared unit answers for is still refused.
 * 7. Reassigning a unit's space root reshapes that unit and nothing else, so a
 *    building takes part in a structural diff as its own subject.
 */
export const test_inspection_subject_building_unit = (): void => {
  const record = environment();
  const artifact = compiled(record);
  const tower = describeAutoMovieSubject(artifact, "building:estate/tower");
  const garden = describeAutoMovieSubject(artifact, "building:estate/garden");
  const shed = describeAutoMovieSubject(artifact, "building:estate/shed");

  TestValidator.equals(
    "every declared unit is one enumerated subject",
    describeAutoMovieSubjects(artifact)
      .filter((subject) => subject.kind === "building")
      .map((subject) => subject.id),
    ["building:estate/garden", "building:estate/shed", "building:estate/tower"],
  );

  TestValidator.equals(
    "a unit opens as itself and names the two roots a walk starts from",
    {
      kind: tower.kind,
      semanticKind: tower.semanticKind,
      name: tower.name,
      owner: tower.owner,
      placement: tower.placement,
      space: tower.space,
      model: tower.model,
      prototype: tower.prototype,
      transform: tower.transform,
      declared: tower.bounds.declared,
      coordinateSpace: tower.bounds.coordinateSpace,
      materials: tower.materials.length,
      members: tower.members.items,
      total: tower.members.total,
    },
    {
      kind: "building",
      semanticKind: "building",
      name: "tower",
      owner: null,
      placement: "building:estate/tower",
      space: null,
      model: null,
      prototype: null,
      transform: null,
      declared: null,
      coordinateSpace: "world",
      materials: 0,
      members: ["element:estate/tower-root", "space:estate/great-hall"],
      total: 2,
    },
  );

  TestValidator.equals(
    "its extent is the union over the elements it owns, not over its rooms",
    namedFacts([
      [
        "the base element fills the model's own two corners",
        () =>
          JSON.stringify(
            builtEnvironmentElementBounds(record, "tower-base"),
          ) ===
          JSON.stringify({
            min: { x: -1, y: 0, z: -1 },
            max: { x: 1, y: 2, z: 1 },
          }),
      ],
      [
        "the cap element is that box lifted four metres",
        () =>
          JSON.stringify(builtEnvironmentElementBounds(record, "tower-cap")) ===
          JSON.stringify({
            min: { x: -1, y: 4, z: -1 },
            max: { x: 1, y: 6, z: 1 },
          }),
      ],
      [
        "and the unit is exactly the two of them together",
        () =>
          JSON.stringify(tower.bounds.content) ===
          JSON.stringify({
            min: { x: -1, y: 0, z: -1 },
            max: { x: 1, y: 6, z: 1 },
          }),
      ],
      [
        "a unit whose only content is a repeated population still measures it",
        () =>
          JSON.stringify(garden.bounds.content) ===
          JSON.stringify({
            min: { x: 9, y: 0, z: 10 },
            max: { x: 11, y: 0, z: 12 },
          }),
      ],
      [
        "and a unit that stages nothing at all measures nothing",
        () => shed.bounds.content === null && shed.kind === "building",
      ],
      [
        "and an undeclared unit id is still refused",
        () => {
          try {
            describeAutoMovieSubject(artifact, "building:estate/nowhere");
            return false;
          } catch {
            return true;
          }
        },
      ],
    ]),
    {
      "the base element fills the model's own two corners": true,
      "the cap element is that box lifted four metres": true,
      "and the unit is exactly the two of them together": true,
      "a unit whose only content is a repeated population still measures it": true,
      "and a unit that stages nothing at all measures nothing": true,
      "and an undeclared unit id is still refused": true,
    },
  );

  const reassigned = environment();
  reassigned.buildings = reassigned.buildings.map((building) =>
    building.id === "shed" ? { ...building, space: "garden" } : building,
  );
  const diff = diffAutoMovieSubjects(artifact, compiled(reassigned));
  TestValidator.equals(
    "a unit whose roots move is reshaped, and the rooms under it are not",
    {
      reshaped: diff.reshaped.map((change) => change.id),
      moved: diff.moved.map((change) => change.id),
      added: diff.added.length,
      removed: diff.removed.length,
    },
    {
      reshaped: ["building:estate/shed"],
      moved: [],
      added: 0,
      removed: 0,
    },
  );
};

/**
 * One estate of three units, one per way a unit can be measured.
 *
 * `tower` stages elements two levels down, `garden` stages nothing but holds a
 * compact population in its room, and `shed` stages nothing at all.
 */
const environment = (): IAutoMovieBuiltEnvironment => ({
  version: 1,
  id: "estate",
  units: "meter",
  buildings: [
    { id: "tower", element: "tower-root", space: "great-hall" },
    { id: "garden", element: "garden-root", space: "garden" },
    { id: "shed", element: "shed-root", space: "shed" },
  ],
  models: [MODEL],
  modelReferences: [],
  elements: [
    {
      id: "tower-root",
      kind: "building",
      parent: null,
      transform: subjectInspectionIdentityTransform(),
      model: null,
      space: "great-hall",
    },
    {
      id: "tower-base",
      kind: "wall",
      parent: "tower-root",
      transform: subjectInspectionIdentityTransform(),
      model: MODEL.id,
      space: "great-hall",
    },
    {
      id: "tower-frame",
      kind: "structure",
      parent: "tower-root",
      transform: subjectInspectionIdentityTransform(),
      model: null,
      space: null,
    },
    {
      id: "tower-cap",
      kind: "roof",
      parent: "tower-frame",
      transform: {
        translation: { x: 0, y: 4, z: 0 },
        rotation: { x: 0, y: 0, z: 0, w: 1 },
        scale: { x: 1, y: 1, z: 1 },
      },
      model: MODEL.id,
      space: null,
    },
    {
      id: "garden-root",
      kind: "building",
      parent: null,
      transform: subjectInspectionIdentityTransform(),
      model: null,
      space: "garden",
    },
    {
      id: "shed-root",
      kind: "building",
      parent: null,
      transform: subjectInspectionIdentityTransform(),
      model: null,
      space: "shed",
    },
  ],
  spaces: [
    { id: "great-hall", kind: "room", parent: null, cells: [] },
    { id: "garden", kind: "room", parent: null, cells: [] },
    { id: "shed", kind: "room", parent: null, cells: [] },
  ],
  // Four slots of a two-by-two grid at two-metre centres about (10, 0, 10):
  // a column sits at `(column - (columns - 1) / 2) * spacing.x` across and a
  // row at `row * spacing.z` along, so the field spans x 9..11 and z 10..12.
  populations: [
    {
      space: "garden",
      prototypeBounds: {
        min: { x: 0, y: 0, z: 0 },
        max: { x: 0, y: 0, z: 0 },
      },
      set: {
        id: "hedge",
        modelRecipe: "unit-model",
        anchor: { x: 10, y: 0, z: 10 },
        facingDeg: 0,
        seed: 11,
        count: 4,
        layout: { kind: "grid", rows: 2, columns: 2, spacing: { x: 2, z: 2 } },
        variation: {
          scale: { min: 1, max: 1 },
          palette: ["#808080"],
          traits: [],
        },
      },
    },
  ],
  boundaries: [],
  openings: [],
  connectors: [],
  surfaces: [],
  walkable: [],
});

/** The compiled artifact staging exactly the elements that carry a model. */
const compiled = (
  record: IAutoMovieBuiltEnvironment,
): IAutoMovieSubjectArtifact =>
  subjectInspectionArtifact({
    models: [MODEL],
    environment: record,
    nodes: record.elements
      .filter((element) => element.model !== null)
      .map((element) => ({
        id: `${record.id}/${element.id}`,
        model: element.model!,
        transform: subjectInspectionIdentityTransform(),
        motion: null,
        pose: null,
      })),
  });
