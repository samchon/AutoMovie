import {
  validateDesignLineage,
  validateDesignLineageBinding,
} from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import {
  refusesLineage as refuses,
  renovationLineage,
} from "../internal/lineageFixtures";
import { hasViolation, namedFacts } from "../internal/predicates";

/**
 * Pin every way a lineage's identity, revision, phase, and lifecycle graphs can
 * stop being able to answer their own questions.
 *
 * The rule these refusals defend is that lineage annotates identities it does
 * not own. That makes a dangling reference invisible from inside the record, so
 * the validator has to be the thing that notices, and the binding check has to
 * exist separately because self-consistency cannot see a renamed wall.
 *
 * Lifecycle coverage is total for the same reason a building unit's ownership
 * is: any default for a subject with no lifecycle asserts something the author
 * did not, either that the thing predates the work or that it survives it.
 *
 * Scenarios:
 *
 * 1. The coherent fixture validates, so every refusal below is one property away
 *    from a clean record rather than away from noise.
 * 2. A blank identity or a wrong schema version is refused.
 * 3. Subject identities must be unique, non-blank, graph-labelled, and carry
 *    either a well-formed digest or none at all.
 * 4. A lineage with no revision, a dangling revision parent, a malformed revision
 *    digest, a revision cycle, and a dangling head are all refused.
 * 5. A phase requiring nothing that exists, requiring the same phase twice, or
 *    requiring itself around a cycle is refused.
 * 6. A lifecycle about an unknown subject, a second lifecycle for one subject, a
 *    dangling introducing or removing phase, and a subject with no lifecycle at
 *    all are refused.
 * 7. A subject removed in a phase that does not follow the one that installed it
 *    is refused, including the incomparable-branch case where neither phase
 *    precedes the other.
 * 8. Binding accepts a lineage whose subjects all resolve, refuses one that names
 *    an identity nothing published, refuses a derived artifact squatting on a
 *    published identity, and does not complain about published identities the
 *    lineage simply does not track.
 */
export const test_architecture_design_lineage_structure_refusals = (): void => {
  const published = [
    ...renovationLineage().subjects.map((subject) => subject.id),
    "wall-east",
  ];

  TestValidator.equals(
    "identity, revision, phase, and lifecycle refusals",
    namedFacts([
      [
        "the coherent renovation lineage validates",
        () => validateDesignLineage({ lineage: renovationLineage() }).success,
      ],
      [
        "a blank lineage id is refused",
        () =>
          refuses((draft) => {
            draft.id = "  ";
          }, "$input.id"),
      ],
      [
        "an unknown schema version is refused",
        () =>
          refuses((draft) => {
            (draft as { version: number }).version = 2;
          }, "$input.version"),
      ],
      [
        "a blank subject id is refused",
        () =>
          refuses((draft) => {
            draft.subjects[0]!.id = "";
          }, "$input.subjects[0].id"),
      ],
      [
        "a duplicated subject id is refused",
        () =>
          refuses((draft) => {
            draft.subjects.push({
              id: "wall-north",
              graph: "element",
              digest: null,
            });
          }, "$input.subjects[11].id"),
      ],
      [
        "a subject with no graph label is refused",
        () =>
          refuses((draft) => {
            draft.subjects[0]!.graph = " ";
          }, "$input.subjects[0].graph"),
      ],
      [
        "a malformed subject digest is refused",
        () =>
          refuses((draft) => {
            draft.subjects[10]!.digest = "sha256:not-hex";
          }, "$input.subjects[10].digest"),
      ],
      [
        "a lineage recording no revision at all is refused",
        () =>
          refuses(
            (draft) => {
              draft.revisions = [];
            },
            "$input.revisions",
            "range",
          ),
      ],
      [
        "a dangling revision parent is refused",
        () =>
          refuses((draft) => {
            draft.revisions[0]!.parent = "r0";
          }, "$input.revisions[0].parent"),
      ],
      [
        "a malformed revision digest is refused",
        () =>
          refuses((draft) => {
            draft.revisions[1]!.digest = "sha256:2B2B";
          }, "$input.revisions[1].digest"),
      ],
      [
        "a revision that supersedes its own successor is refused",
        () =>
          refuses((draft) => {
            draft.revisions[0]!.parent = "r2";
          }, "$input.revisions[0].parent"),
      ],
      [
        "a head naming no recorded revision is refused",
        () =>
          refuses((draft) => {
            draft.head = "r9";
          }, "$input.head"),
      ],
      [
        "a phase with no label is refused",
        () =>
          refuses((draft) => {
            draft.phases[0]!.label = "";
          }, "$input.phases[0].label"),
      ],
      [
        "a prerequisite naming no phase is refused",
        () =>
          refuses((draft) => {
            draft.phases[3]!.requires = ["ghost"];
          }, "$input.phases[3].requires[0]"),
      ],
      [
        "the same prerequisite twice is refused",
        () =>
          refuses((draft) => {
            draft.phases[3]!.requires = ["strip", "strip"];
          }, "$input.phases[3].requires[1]"),
      ],
      [
        "a construction plan that requires itself around a cycle is refused",
        () =>
          refuses((draft) => {
            draft.phases[0]!.requires = ["finishes"];
          }, "$input.phases"),
      ],
      [
        "a lifecycle about an unknown subject is refused",
        () =>
          refuses((draft) => {
            draft.lifecycles[0]!.subject = "wall-east";
          }, "$input.lifecycles[0].subject"),
      ],
      [
        "a second lifecycle for one subject is refused",
        () =>
          refuses((draft) => {
            draft.lifecycles.push({
              subject: "wall-north",
              introducedIn: null,
              removedIn: "strip",
            });
          }, "$input.lifecycles[11].subject"),
      ],
      [
        "a dangling introducing phase is refused",
        () =>
          refuses((draft) => {
            draft.lifecycles[3]!.introducedIn = "ghost";
          }, "$input.lifecycles[3].introducedIn"),
      ],
      [
        "a dangling removing phase is refused",
        () =>
          refuses((draft) => {
            draft.lifecycles[3]!.removedIn = "ghost";
          }, "$input.lifecycles[3].removedIn"),
      ],
      [
        "a subject with no lifecycle at all is refused",
        () =>
          refuses((draft) => {
            draft.lifecycles = draft.lifecycles.filter(
              (lifecycle) => lifecycle.subject !== "wall-west",
            );
          }, "$input.subjects[2].id"),
      ],
      [
        "removing a subject in the very phase that installs it is refused",
        () =>
          refuses((draft) => {
            draft.lifecycles[3]!.removedIn = "shore";
          }, "$input.lifecycles[3].removedIn"),
      ],
      [
        "removing a subject on a branch that never follows its installation is refused",
        () =>
          refuses((draft) => {
            draft.lifecycles[3]!.removedIn = "strip";
          }, "$input.lifecycles[3].removedIn"),
      ],
      [
        "a prerequisite chain that dead-ends still reports the ordering defect",
        () =>
          refuses((draft) => {
            draft.phases[3]!.requires = ["ghost"];
          }, "$input.lifecycles[3].removedIn"),
      ],
    ]),
    {
      "the coherent renovation lineage validates": true,
      "a blank lineage id is refused": true,
      "an unknown schema version is refused": true,
      "a blank subject id is refused": true,
      "a duplicated subject id is refused": true,
      "a subject with no graph label is refused": true,
      "a malformed subject digest is refused": true,
      "a lineage recording no revision at all is refused": true,
      "a dangling revision parent is refused": true,
      "a malformed revision digest is refused": true,
      "a revision that supersedes its own successor is refused": true,
      "a head naming no recorded revision is refused": true,
      "a phase with no label is refused": true,
      "a prerequisite naming no phase is refused": true,
      "the same prerequisite twice is refused": true,
      "a construction plan that requires itself around a cycle is refused": true,
      "a lifecycle about an unknown subject is refused": true,
      "a second lifecycle for one subject is refused": true,
      "a dangling introducing phase is refused": true,
      "a dangling removing phase is refused": true,
      "a subject with no lifecycle at all is refused": true,
      "removing a subject in the very phase that installs it is refused": true,
      "removing a subject on a branch that never follows its installation is refused": true,
      "a prerequisite chain that dead-ends still reports the ordering defect": true,
    },
  );

  TestValidator.equals(
    "binding checks the host graphs the lineage cannot see from inside",
    namedFacts([
      [
        "a lineage whose subjects all resolve binds cleanly",
        () =>
          validateDesignLineageBinding({
            lineage: renovationLineage(),
            known: published,
          }).success,
      ],
      [
        "a published identity the lineage does not track is not a defect",
        () =>
          published.includes("wall-east") &&
          renovationLineage().subjects.every(
            (subject) => subject.id !== "wall-east",
          ),
      ],
      [
        "a subject resolving to nothing published is refused",
        () =>
          hasViolation(
            validateDesignLineageBinding({
              lineage: renovationLineage(),
              known: published.filter((id) => id !== "opening-door"),
            }),
            "type",
            "$input.subjects[5].id",
          ),
      ],
      [
        "a derived artifact squatting on a published identity is refused",
        () =>
          hasViolation(
            validateDesignLineageBinding({
              lineage: renovationLineage(),
              known: [...published, "render-lobby"],
            }),
            "type",
            "$input.derived[6].id",
          ),
      ],
    ]),
    {
      "a lineage whose subjects all resolve binds cleanly": true,
      "a published identity the lineage does not track is not a defect": true,
      "a subject resolving to nothing published is refused": true,
      "a derived artifact squatting on a published identity is refused": true,
    },
  );
};
