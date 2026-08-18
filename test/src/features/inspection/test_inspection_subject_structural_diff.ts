import {
  AUTOMOVIE_SUBJECT_DIFF_DEFAULT_TOLERANCE,
  diffAutoMovieSubjects,
} from "@automovie/engine";
import { IAutoMovieModel } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { throwsError } from "../internal/predicates";
import {
  subjectInspectionArtifact,
  subjectInspectionIdentityTransform,
  subjectInspectionModel,
} from "../internal/subjectInspectionFixtures";

/**
 * Structural diff classifies stable subjects without conflating placement and
 * reusable geometry.
 *
 * Scenarios:
 *
 * 1. Models and their parts added or removed are exclusive additions and
 *    removals, while their scene elements follow the same stable-id rule.
 * 2. A translated element is moved and its reshaped prototype and prototype
 *    part are each reported once; an untouched model, part, and element are
 *    summarized as unchanged.
 * 3. One compact set changed in both anchor and layout appears in both moved
 *    and reshaped categories.
 * 4. Invalid negative and non-finite tolerances are rejected.
 */
export const test_inspection_subject_structural_diff = (): void => {
  const chairBefore = box("chair", 1);
  const chairAfter = box("chair", 2);
  const stable = box("stable", 1);
  const removed = box("removed", 1);
  const added = box("added", 1);
  const before = subjectInspectionArtifact({
    revision: "revision-before",
    models: [chairBefore, stable, removed],
    nodes: [node("chair", 0), node("stable", 0), node("removed", 0)],
    environment: null,
  });
  const after = subjectInspectionArtifact({
    revision: "revision-after",
    models: [chairAfter, stable, added],
    nodes: [node("chair", 3), node("stable", 0), node("added", 0)],
    environment: null,
  });
  const diff = diffAutoMovieSubjects(before, after);
  TestValidator.equals(
    "addition removal movement reshape and unchanged subjects are categorized independently",
    {
      version: diff.version,
      revisions: [diff.fromRevision, diff.toRevision],
      tolerance: diff.tolerance,
      added: diff.added.map((change) => change.id),
      addedNulls: diff.added.every(
        (change) => change.before === null && change.after !== null,
      ),
      removed: diff.removed.map((change) => change.id),
      removedNulls: diff.removed.every(
        (change) => change.before !== null && change.after === null,
      ),
      moved: diff.moved.map((change) => change.id),
      reshaped: diff.reshaped.map((change) => change.id),
      unchanged: diff.unchanged,
    },
    {
      version: 1,
      revisions: ["revision-before", "revision-after"],
      tolerance: 1e-6,
      added: ["element:added", "prototype-part:added/body", "prototype:added"],
      addedNulls: true,
      removed: [
        "element:removed",
        "prototype-part:removed/body",
        "prototype:removed",
      ],
      removedNulls: true,
      moved: ["element:chair"],
      reshaped: ["prototype-part:chair/body", "prototype:chair"],
      unchanged: {
        total: 3,
        offset: 0,
        items: [
          "element:stable",
          "prototype-part:stable/body",
          "prototype:stable",
        ],
        omitted: 0,
      },
    },
  );

  const setBefore = compactSet("both", 0, 1);
  const setAfter = compactSet("both", 2, 2);
  const both = diffAutoMovieSubjects(
    subjectInspectionArtifact({
      models: [stable],
      nodes: [],
      instanceSets: [setBefore],
      environment: null,
    }),
    subjectInspectionArtifact({
      models: [stable],
      nodes: [],
      instanceSets: [setAfter],
      environment: null,
    }),
  );
  TestValidator.equals(
    "a set with placement and population-law edits belongs to both categories",
    {
      moved: both.moved.map((change) => change.id),
      reshaped: both.reshaped.map((change) => change.id),
    },
    {
      moved: ["instance-set:both"],
      reshaped: ["instance-set:both"],
    },
  );

  const addedSet = diffAutoMovieSubjects(
    subjectInspectionArtifact({
      models: [stable],
      nodes: [],
      environment: null,
    }),
    subjectInspectionArtifact({
      models: [stable],
      nodes: [],
      instanceSets: [setBefore],
      environment: null,
    }),
  );
  TestValidator.equals(
    "an added compact set has no cross-revision prototype selection count",
    addedSet.added.find((change) => change.id === "instance-set:both")?.fanout,
    {
      elements: 0,
      instances: 0,
      instanceSets: { total: 0, offset: 0, items: [], omitted: 0 },
      prototypeChanges: 0,
    },
  );

  TestValidator.equals(
    "invalid tolerances are refused",
    {
      negative: throwsError(
        () => diffAutoMovieSubjects(before, after, -1),
        "finite and non-negative",
      ),
      infinite: throwsError(
        () => diffAutoMovieSubjects(before, after, Number.POSITIVE_INFINITY),
        "finite and non-negative",
      ),
      default: AUTOMOVIE_SUBJECT_DIFF_DEFAULT_TOLERANCE,
    },
    { negative: true, infinite: true, default: 1e-6 },
  );
};

const box = (id: string, height: number): IAutoMovieModel =>
  subjectInspectionModel({
    id,
    min: { x: -0.5, y: 0, z: -0.5 },
    max: { x: 0.5, y: height, z: 0.5 },
  });

const node = (id: string, x: number) => ({
  id,
  model: id,
  transform: {
    ...subjectInspectionIdentityTransform(),
    translation: { x, y: 0, z: 0 },
  },
  motion: null,
  pose: null,
});

const compactSet = (id: string, x: number, spacing: number) =>
  ({
    version: 1,
    id,
    count: 2,
    modelRecipe: "stable",
    layout: {
      kind: "grid",
      rows: 1,
      columns: 2,
      spacing: { x: spacing, z: 1 },
    },
    route: null,
    anchor: { x, y: 0, z: 0 },
    facingDeg: 0,
    seed: 1,
    variation: {
      scale: { min: 1, max: 1 },
      palette: ["#ffffff"],
      traits: [],
    },
    bounds: {
      min: { x: x - spacing / 2, y: 0, z: 0 },
      max: { x: x + spacing / 2, y: 0, z: 0 },
    },
    centroid: { x, y: 0, z: 0 },
    projectionRadius: 1,
    chunks: [],
    lod: [
      {
        tier: "near",
        maxDistance: null,
        recipe: "stable",
        recipeDigest: `sha256:${"4".repeat(64)}`,
        model: "stable",
      },
    ],
    digest: `sha256:${"5".repeat(64)}`,
  }) as never;
