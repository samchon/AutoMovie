import {
  builtEnvironmentUnclaimedElements,
  describeAutoMovieSubject,
  describeAutoMovieSubjects,
  validateBuiltEnvironment,
} from "@automovie/engine";
import type {
  IAutoMovieBuiltEnvironment,
  IAutoMovieSubjectArtifact,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { makeProp, primitivePart } from "../internal/fixtures";
import { namedFacts } from "../internal/predicates";
import {
  subjectInspectionArtifact,
  subjectInspectionIdentityTransform,
} from "../internal/subjectInspectionFixtures";

/**
 * A walk that knows no key reaches every element, and names none it cannot open.
 *
 * A transform-only group is an authored element with an identity, a kind, a
 * parent and a logical space, but the surface answered "does not exist" for it,
 * and that refusal did not stay inside the group. A space lists the elements it
 * claims, so a reviewer opening a room was handed ids that opened nothing: on
 * the scaffold's own `ExampleBuilding`, 6 of the 32 ids its spaces name refused,
 * both unit roots among them, and the elements underneath those roots appeared
 * at the top of the index as though they hung from nothing. Opening the group
 * closes both halves at once, and afterwards that building answers 30 of 30
 * elements from 2 index roots with no refusal.
 *
 * A group states its place the way the engine already states it, since
 * `builtEnvironmentPlacementBounds` answers `null` for a transform-only group
 * "because neither states a place a body occupies": no transform, no content
 * bounds, no materials, no prototype, and the structure a walk needs.
 *
 * Scenarios:
 *
 * 1. A group a space claims opens, and reports its kind, its owner, its space,
 *    and null for everything it does not stage.
 * 2. A group with no children reports an empty membership rather than refusing,
 *    and a root group reports no owner.
 * 3. Every id a space names opens, which is the defect stated from the side a
 *    reviewer meets it.
 * 4. A walk from the index reaches all seven elements, including the two the
 *    compiler draws nothing for.
 * 5. The enumeration carries the groups too, so a flat survey is not smaller
 *    than the building.
 */
export const test_inspection_subject_group_reach = (): void => {
  const record = environment();
  const artifact = residenceArtifact(record);

  TestValidator.equals(
    "the fixture is a legal building",
    validateBuiltEnvironment({ environment: record }).success,
    true,
  );

  const chair = describeAutoMovieSubject(
    artifact,
    "element:residence/great-hall-chair",
  );
  TestValidator.equals(
    "a group a space claims opens and states what it is",
    {
      kind: chair.kind,
      semanticKind: chair.semanticKind,
      owner: chair.owner,
      space: chair.space,
      prototype: chair.prototype,
      model: chair.model,
      transform: chair.transform,
      content: chair.bounds.content,
      materials: chair.materials.length,
      members: chair.members.items,
    },
    {
      kind: "element",
      semanticKind: "furniture",
      owner: "element:residence/residence-root",
      space: "space:residence/great-hall",
      prototype: null,
      model: null,
      transform: null,
      content: null,
      materials: 0,
      members: ["element:residence/great-hall-chair-seat"],
    },
  );

  const altar = describeAutoMovieSubject(
    artifact,
    "element:residence/chapel-altar",
  );
  const root = describeAutoMovieSubject(
    artifact,
    "element:residence/residence-root",
  );
  TestValidator.equals(
    "an empty group and a root group answer without refusing",
    {
      altarMembers: altar.members.total,
      altarOwner: altar.owner,
      rootOwner: root.owner,
      rootMembers: root.members.items,
    },
    {
      altarMembers: 0,
      altarOwner: "element:residence/residence-root",
      rootOwner: null,
      rootMembers: [
        "element:residence/chapel-altar",
        "element:residence/great-hall-chair",
        "element:residence/outer-wall",
      ],
    },
  );

  TestValidator.equals(
    "every id the great hall names opens",
    describeAutoMovieSubject(
      artifact,
      "space:residence/great-hall",
    ).members.items.filter((id) => opens(artifact, id) === false),
    [],
  );

  TestValidator.equals(
    "a walk from the index reaches every element and is refused nothing",
    walk(record, artifact),
    {
      refused: [],
      unreached: [],
    },
  );

  TestValidator.equals(
    "the enumeration is not smaller than the building",
    namedFacts([
      [
        "it carries the groups the compiler drew nothing for",
        () => {
          const ids = describeAutoMovieSubjects(artifact).map(
            (description) => description.id,
          );
          return (
            ids.includes("element:residence/residence-root") &&
            ids.includes("element:residence/chapel-altar")
          );
        },
      ],
      [
        "and still carries the elements it did draw",
        () =>
          describeAutoMovieSubjects(artifact)
            .map((description) => description.id)
            .includes("element:residence/outer-wall"),
      ],
      [
        "while an id no element answers for is still refused",
        () => opens(artifact, "element:residence/nowhere") === false,
      ],
    ]),
    {
      "it carries the groups the compiler drew nothing for": true,
      "and still carries the elements it did draw": true,
      "while an id no element answers for is still refused": true,
    },
  );
};

/** Whether this surface answers for one id at all. */
const opens = (artifact: IAutoMovieSubjectArtifact, id: string): boolean => {
  try {
    describeAutoMovieSubject(artifact, id);
    return true;
  } catch {
    return false;
  }
};

/**
 * Walk down from the index, opening only ids something already opened named.
 *
 * The index is the spaces no other space parents plus the elements nothing else
 * reaches, which is exactly what a reviewer sees before naming anything.
 */
const walk = (
  record: IAutoMovieBuiltEnvironment,
  artifact: IAutoMovieSubjectArtifact,
): { refused: string[]; unreached: string[] } => {
  const queue = [
    ...record.spaces
      .filter((space) => space.parent === null)
      .map((space) => `space:${record.id}/${space.id}`),
    ...builtEnvironmentUnclaimedElements(record).map(
      (node) => `element:${node}`,
    ),
  ];
  const seen = new Set<string>();
  const refused: string[] = [];
  while (queue.length !== 0) {
    const id = queue.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);
    if (opens(artifact, id) === false) {
      refused.push(id);
      continue;
    }
    for (const member of describeAutoMovieSubject(artifact, id).members.items)
      queue.push(member);
  }
  return {
    refused,
    unreached: record.elements
      .map((element) => `element:${record.id}/${element.id}`)
      .filter((id) => seen.has(id) === false),
  };
};

const models = [
  {
    ...makeProp([
      primitivePart("cube-box", {
        type: "box",
        width: 1,
        height: 1,
        depth: 1,
      }),
    ]),
    id: "cube-model",
  },
];

/** The compiled artifact staging exactly the elements that carry a model. */
const residenceArtifact = (
  record: IAutoMovieBuiltEnvironment,
): IAutoMovieSubjectArtifact =>
  subjectInspectionArtifact({
    models,
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

/**
 * One residence carrying every shape the walk has to survive.
 *
 * `residence-root` is a group a space claims, `chapel-altar` a group with
 * nothing under it, `great-hall-chair` a group whose only child is drawn, and
 * `garden-wall-root` a root no space claims at all.
 */
const environment = (): IAutoMovieBuiltEnvironment => ({
  version: 1,
  id: "residence",
  units: "meter",
  buildings: [
    { id: "residence", element: "residence-root", space: "great-hall" },
    { id: "garden", element: "garden-wall-root", space: "garden" },
  ],
  models,
  modelReferences: [],
  elements: [
    {
      id: "residence-root",
      kind: "building",
      parent: null,
      transform: subjectInspectionIdentityTransform(),
      model: null,
      space: "great-hall",
    },
    {
      id: "great-hall-chair",
      kind: "furniture",
      parent: "residence-root",
      transform: subjectInspectionIdentityTransform(),
      model: null,
      space: "great-hall",
    },
    {
      id: "great-hall-chair-seat",
      kind: "furniture",
      parent: "great-hall-chair",
      transform: subjectInspectionIdentityTransform(),
      model: "cube-model",
      space: null,
    },
    {
      id: "chapel-altar",
      kind: "furniture",
      parent: "residence-root",
      transform: subjectInspectionIdentityTransform(),
      model: null,
      space: "great-hall",
    },
    {
      id: "outer-wall",
      kind: "wall",
      parent: "residence-root",
      transform: subjectInspectionIdentityTransform(),
      model: "cube-model",
      space: null,
    },
    {
      id: "garden-wall-root",
      kind: "building",
      parent: null,
      transform: subjectInspectionIdentityTransform(),
      model: null,
      space: null,
    },
    {
      id: "garden-wall",
      kind: "wall",
      parent: "garden-wall-root",
      transform: subjectInspectionIdentityTransform(),
      model: "cube-model",
      space: null,
    },
  ],
  spaces: [
    { id: "great-hall", kind: "room", parent: null, cells: [] },
    { id: "garden", kind: "room", parent: null, cells: [] },
  ],
  boundaries: [],
  openings: [],
  connectors: [],
  surfaces: [],
  walkable: [],
});
