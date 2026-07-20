import { validateScriptTree } from "@automovie/engine";
import { IAutoMovieBeat, IAutoMovieScriptNode } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

export const treeBeats = (): IAutoMovieBeat[] => [
  {
    id: "beat-1",
    name: "the loose",
    summary: "A looses the arrow",
    durationHint: 3,
  },
  { id: "beat-2", name: "the hit", summary: "B is struck", durationHint: 2 },
];

/** A full five-kind refinement tree over {@link treeBeats}. */
export const createScriptTree = (): IAutoMovieScriptNode[] => [
  {
    id: "root",
    kind: "intent",
    parent: null,
    temporal: null,
    interactsWith: [],
    payload: { logline: "A hunter becomes the hunted.", theme: "reversal" },
  },
  {
    id: "act1",
    kind: "act",
    parent: "root",
    temporal: null,
    interactsWith: [],
    payload: { purpose: "the hunt turns" },
  },
  {
    id: "scene1",
    kind: "scene",
    parent: "act1",
    temporal: null,
    interactsWith: [],
    payload: {
      interiorExterior: "EXT",
      location: "forest clearing",
      timeOfDay: "dawn",
      description: null,
    },
  },
  {
    id: "grp",
    kind: "group",
    parent: "scene1",
    temporal: null,
    interactsWith: [],
    payload: { rationale: "the exchange of arrows" },
  },
  {
    id: "b1",
    kind: "beat",
    parent: "grp",
    temporal: null,
    interactsWith: ["b2"],
    payload: {
      beat: "beat-1",
      direction: "A twists back in the saddle and looses.",
      dialogue: [
        { speaker: "A", text: "Now!", anchor: 0.5 },
        { speaker: "B", text: "…", anchor: null },
      ],
      caption: "low sun, long shadows, the arrow leaves frame right",
    },
  },
  {
    id: "b2",
    kind: "beat",
    parent: "grp",
    temporal: "b1",
    interactsWith: ["b1"],
    payload: {
      beat: "beat-2",
      direction: "B takes the arrow and falls.",
      dialogue: [],
      caption: null,
    },
  },
];

/**
 * The screenplay refinement tree: a well-formed five-kind tree (one
 * intent root refined through act, scene, and group down to beat nodes that
 * join the flat beats 1:1, with dialogue anchors, a temporal chain, and a
 * mutual interaction edge) validates clean.
 *
 * Scenarios:
 *
 * 1. The full tree over both beats validates with zero violations.
 * 2. Anchored and floating (null-anchor) dialogue lines both pass: the anchor
 *    rule only bounds non-null values.
 * 3. A minimal one-node tree (intent root alone) over zero beats validates: the
 *    smallest legal refinement is the intent itself.
 */
export const test_validation_script_tree = (): void => {
  const full = validateScriptTree({
    tree: createScriptTree(),
    beats: treeBeats(),
  });
  TestValidator.equals("full five-kind tree validates", full.success, true);

  const minimal = validateScriptTree({
    tree: [
      {
        id: "root",
        kind: "intent",
        parent: null,
        temporal: null,
        interactsWith: [],
        payload: { logline: "x", theme: "y" },
      },
    ],
    beats: [],
  });
  TestValidator.equals("intent-only tree validates", minimal.success, true);
};
