import {
  AUTOMOVIE_SUBJECT_MEMBER_SAMPLE_LIMIT,
  describeAutoMovieSubject,
  describeAutoMovieSubjects,
} from "@automovie/engine";
import { IAutoMovieBuiltEnvironment } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { namedFacts, throwsError } from "../internal/predicates";
import {
  subjectInspectionArtifact,
  subjectInspectionIdentityTransform,
  subjectInspectionInstanceSet,
} from "../internal/subjectInspectionFixtures";

/**
 * Membership beyond the first page is still addressable.
 *
 * The sample limit exists for a real reason — one authored field of roof slate
 * is 2,392 members, and a query a reviewer calls in a loop must not hand back
 * 2,392 strings. What it lacked was any way past it: a summary reported
 * `omitted` and there was nothing to ask next, so descent through membership
 * stopped at the limit no matter how much was below it.
 *
 * That is survivable until one node owns nearly everything, which is what a
 * building is. Measured on the `#1954` campaign's medieval manor: 989 elements,
 * a flat hierarchy of one root with 988 direct children, so descending from the
 * building named 64 and reported 924 omitted. Nothing was lost — the subject
 * census is uncapped and still returned all 989 — but the tree had no way down.
 *
 * The page is a rank into the sorted whole rather than a cursor token, because
 * the order is already deterministic and code-unit stable, so the same rank
 * names the same member on any host and at any time for one revision.
 *
 * Scenarios:
 *
 * 1. Paging an element's children by the limit reaches every child exactly
 *    once, in order, with no gap and no repeat, and `total` never moves.
 * 2. A page at the end is empty rather than an error, and reports where it
 *    stopped, so a caller looping until it runs out terminates.
 * 3. A rank that names no page — negative, or fractional — is refused rather
 *    than rounded, because a caller paging by a computed value would otherwise
 *    be told it had read everything.
 * 4. A compact instance set pages too, and that path regenerates its ids from
 *    slot indices rather than slicing a list, so it is the one that could page
 *    a different order than it reports.
 * 5. The whole-inventory census is untouched: every summary it builds starts at
 *    the first member, and it still names every subject.
 */
export const test_inspection_subject_member_paging = (): void => {
  const artifact = subjectInspectionArtifact({
    environment: crowdedEnvironment(),
    instanceSets: [
      subjectInspectionInstanceSet({
        id: "slate",
        model: "guard-rack-west-pole-0-model",
        count: SET_COUNT,
      }),
    ],
  });
  const root = `element:${ENVIRONMENT}/${ROOT}`;

  const pages: string[][] = [];
  for (
    let offset = 0;
    offset < CHILDREN;
    offset += AUTOMOVIE_SUBJECT_MEMBER_SAMPLE_LIMIT
  )
    pages.push(
      describeAutoMovieSubject(artifact, root, { memberOffset: offset }).members
        .items,
    );
  const walked = pages.flat();
  const first = describeAutoMovieSubject(artifact, root).members;

  TestValidator.equals(
    "paging a crowded parent reaches every child exactly once",
    namedFacts([
      [
        "the first page is bounded by the limit",
        () => first.items.length === AUTOMOVIE_SUBJECT_MEMBER_SAMPLE_LIMIT,
      ],
      [
        "and says so rather than pretending it is everything",
        () =>
          first.total === CHILDREN &&
          first.offset === 0 &&
          first.omitted === CHILDREN - AUTOMOVIE_SUBJECT_MEMBER_SAMPLE_LIMIT,
      ],
      ["the walk names every child", () => walked.length === CHILDREN],
      ["each exactly once", () => new Set(walked).size === CHILDREN],
      [
        "in the order the census sorts them",
        () => walked.every((id, index) => id === expectedChild(index)),
      ],
      [
        "and the total never moved under it",
        () =>
          [0, 64, 128].every(
            (offset) =>
              describeAutoMovieSubject(artifact, root, { memberOffset: offset })
                .members.total === CHILDREN,
          ),
      ],
    ]),
    {
      "the first page is bounded by the limit": true,
      "and says so rather than pretending it is everything": true,
      "the walk names every child": true,
      "each exactly once": true,
      "in the order the census sorts them": true,
      "and the total never moved under it": true,
    },
  );

  const past = describeAutoMovieSubject(artifact, root, {
    memberOffset: CHILDREN + AUTOMOVIE_SUBJECT_MEMBER_SAMPLE_LIMIT,
  }).members;
  TestValidator.equals(
    "a page past the end stops rather than failing",
    namedFacts([
      ["it names nothing", () => past.items.length === 0],
      // Clamped to the total rather than echoed, so a caller looping while
      // `offset + items.length < total` terminates instead of spinning on a
      // rank that will never be reached.
      ["it reports where it stopped", () => past.offset === CHILDREN],
      ["and still states the whole", () => past.total === CHILDREN],
    ]),
    {
      "it names nothing": true,
      "it reports where it stopped": true,
      "and still states the whole": true,
    },
  );

  TestValidator.equals(
    "a rank that names no page is refused",
    namedFacts([
      [
        "a negative rank",
        () =>
          throwsError(() =>
            describeAutoMovieSubject(artifact, root, { memberOffset: -1 }),
          ),
      ],
      [
        "a fractional rank",
        () =>
          throwsError(() =>
            describeAutoMovieSubject(artifact, root, { memberOffset: 1.5 }),
          ),
      ],
    ]),
    { "a negative rank": true, "a fractional rank": true },
  );

  const setId = "instance-set:slate";
  const setPages: string[][] = [];
  for (
    let offset = 0;
    offset < SET_COUNT;
    offset += AUTOMOVIE_SUBJECT_MEMBER_SAMPLE_LIMIT
  )
    setPages.push(
      describeAutoMovieSubject(artifact, setId, { memberOffset: offset })
        .members.items,
    );
  const instances = setPages.flat();
  TestValidator.equals(
    "a compact set pages the slots it names",
    namedFacts([
      ["the walk names every instance", () => instances.length === SET_COUNT],
      ["each exactly once", () => new Set(instances).size === SET_COUNT],
      [
        "the pages do not overlap",
        () =>
          setPages.every((page, index) =>
            page.every(
              (id) =>
                setPages.findIndex((other) => other.includes(id)) === index,
            ),
          ),
      ],
    ]),
    {
      "the walk names every instance": true,
      "each exactly once": true,
      "the pages do not overlap": true,
    },
  );

  const census = describeAutoMovieSubjects(artifact);
  TestValidator.equals(
    "the whole-inventory census is unchanged by any of this",
    namedFacts([
      [
        "every summary starts at the first member",
        () => census.every((entry) => entry.members.offset === 0),
      ],
      // The census being uncapped is why nothing was ever lost, only unreachable
      // by descent, and it is the property a paging change could quietly break.
      [
        "and it still names every child subject",
        () =>
          new Set(census.map((entry) => entry.id)).size >= CHILDREN &&
          Array.from({ length: CHILDREN }, (_, index) =>
            expectedChild(index),
          ).every((id) => census.some((entry) => entry.id === id)),
      ],
    ]),
    {
      "every summary starts at the first member": true,
      "and it still names every child subject": true,
    },
  );
};

/** Enough children that the sample limit is passed more than once. */
const CHILDREN = 150;

/** Enough instances that the regenerated page path is passed more than once. */
const SET_COUNT = 150;

const ENVIRONMENT = "castle";
const ROOT = "keep";

/** The child id at one rank, zero-padded so code-unit order is index order. */
const expectedChild = (index: number): string =>
  `element:${ENVIRONMENT}/${ROOT}-child-${String(index).padStart(3, "0")}`;

/**
 * One root owning every element, which is the shape a building actually has.
 *
 * Model-less on both sides on purpose: a transform-only group stages no scene
 * node, so this exercises the element hierarchy rather than the scene walk, and
 * the scene walk is not what truncated.
 */
const crowdedEnvironment = (): IAutoMovieBuiltEnvironment =>
  ({
    version: 1,
    id: ENVIRONMENT,
    units: "meter",
    buildings: [{ id: ENVIRONMENT, element: ROOT, space: "hall" }],
    models: [],
    modelReferences: [],
    elements: [
      {
        id: ROOT,
        kind: "building",
        parent: null,
        transform: subjectInspectionIdentityTransform(),
        model: null,
        space: "hall",
      },
      ...Array.from({ length: CHILDREN }, (_, index) => ({
        id: `${ROOT}-child-${String(index).padStart(3, "0")}`,
        kind: "wall-infill",
        parent: ROOT,
        transform: subjectInspectionIdentityTransform(),
        model: null,
        space: null,
      })),
    ],
    spaces: [{ id: "hall", kind: "room", parent: null, cells: [] }],
    boundaries: [],
    openings: [],
    connectors: [],
    surfaces: [],
    walkable: [],
  }) as unknown as IAutoMovieBuiltEnvironment;
