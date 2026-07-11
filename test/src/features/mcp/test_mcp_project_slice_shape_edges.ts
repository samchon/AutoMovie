import { AutoMovieProject } from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { throwsError } from "../internal/predicates";

/** Write a crafted (deliberately malformed) slice file into an open project. */
const writeSlice = (root: string, rel: string, value: unknown): void =>
  fs.writeFileSync(
    path.join(root, ...rel.split("/")),
    `${JSON.stringify(value, null, 2)}\n`,
  );

/** A structurally valid beat-end actor — no violations of its own. */
const validActor = (node: string, motion: string | null): unknown => ({
  node,
  transform: {
    translation: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0, w: 1 },
    scale: { x: 1, y: 1, z: 1 },
  },
  facing: { x: 0, y: 0, z: 1 },
  pose: null,
  motion,
  localTime: 0,
  gaitPhase: null,
  rootVelocity: null,
  footPlants: null,
  mount: null,
});

/** A clean intent root, used where the tree itself must pass shape validation. */
const cleanIntent = (): unknown => ({
  id: "root",
  kind: "intent",
  parent: null,
  temporal: null,
  interactsWith: [],
  payload: { logline: "A duel at dawn.", theme: "resolve" },
});

/** A clean beat node hanging off the intent root. */
const cleanBeatNode = (): unknown => ({
  id: "beat-node",
  kind: "beat",
  parent: "root",
  temporal: null,
  interactsWith: [],
  payload: {
    beat: "b1",
    direction: "The duelists test distance.",
    dialogue: [],
    caption: null,
  },
});

/**
 * A tree exercising every branch of the intent-tree node/payload validators in
 * one read: a non-object node, an unknown-kind node with a bad interaction
 * target, a non-object payload, and one node per payload kind (act, scene ×2 to
 * split the interiorExterior / description branches, group, beat) each carrying
 * a field defect, plus a beat whose dialogue mixes a non-object line, an
 * anchored malformed line, and a clean null-anchor line.
 */
const bigTree = (): unknown[] => {
  const base = { parent: null, temporal: null, interactsWith: [] };
  return [
    5, // non-object tree node
    {
      id: "n1",
      kind: "bogus", // unknown kind
      parent: null,
      temporal: null,
      interactsWith: [""], // empty interaction target
      payload: {},
    },
    { id: "n2", kind: "act", ...base, payload: 5 }, // non-object payload
    { id: "n3", kind: "act", ...base, payload: { purpose: "" } },
    {
      id: "n4",
      kind: "scene",
      ...base,
      payload: {
        interiorExterior: "BAD",
        location: "",
        timeOfDay: "",
        description: "", // non-null → validated
      },
    },
    {
      id: "n5",
      kind: "scene",
      ...base,
      payload: {
        interiorExterior: "INT", // legal branch
        location: "loc",
        timeOfDay: "day",
        description: null, // null → skipped
      },
    },
    { id: "n6", kind: "group", ...base, payload: { rationale: "" } },
    {
      id: "n7",
      kind: "beat",
      ...base,
      payload: {
        beat: "bx",
        direction: "d",
        dialogue: [
          5, // non-object dialogue line
          { speaker: "", text: "", anchor: -1 }, // anchored, malformed
          { speaker: "s", text: "t", anchor: null }, // null anchor → skipped
        ],
        caption: "", // non-null → validated
      },
    },
  ];
};

interface ISliceCase {
  title: string;
  rel: string;
  value: unknown;
  fragments: string[];
  read?: (root: string) => unknown;
}

const openManifest = (root: string): unknown => AutoMovieProject.open(root);
const readSlate = (root: string): unknown =>
  AutoMovieProject.open(root).writableSlate();

/**
 * The resident store validates every slice at the read boundary, mirroring the
 * commit-time validators (#614): a parseable-but-malformed file becomes a
 * controlled project-repair error naming the field to fix, never a leaked
 * TypeError. Each case below is the malformed twin of a shape the store
 * otherwise accepts, driving one specific validator branch — the manifest shape
 * guard, the script cast/beat/tree passes, the intent-tree payload switch, the
 * notes tier guard, the shot/beat-end field checks, the non-object scene, and
 * the keyed-filename decode + key-mismatch reporting.
 *
 * Scenarios:
 *
 * 1. A non-object manifest and a wrong `version` each report the manifest shape
 *    repair error on open.
 * 2. A script with non-record cast/beat entries, empty beats, and a non-array
 *    `beats` beside a clean tree each report their located violation (the
 *    uniqueBy maps, the "at least one beat" push, and the tree/beats short
 *    circuit).
 * 3. A script tree exercising every node and payload-kind branch reports the tree
 *    repair error.
 * 4. A notes list with a non-object entry and an unknown tier reports the tier
 *    guard.
 * 5. A shot with a non-object cameraMotion, mixed performances, and a non-numeric
 *    duration reports the cameraMotion guard.
 * 6. A beat-end whose shot does not equal `shot:<beat>`, carrying a non-object
 *    actor beside valid actors, reports the shot-mismatch guard.
 * 7. A non-object scene slice reports the scene repair error (the resident model
 *    scan tolerates the non-record).
 * 8. A `%`-only keyed filename reports the URI-decode failure; a keyed slice
 *    missing its id reports "none", and one with a mismatched id reports that
 *    id.
 */
export const test_mcp_project_slice_shape_edges = (): void => {
  const cases: ISliceCase[] = [
    // 1. manifest shape guards (open itself throws)
    {
      title: "a non-object manifest reports the shape repair error",
      rel: "automovie.json",
      value: [],
      fragments: ["semantically invalid", "manifest must be a JSON object"],
      read: openManifest,
    },
    {
      title: "a wrong manifest version reports the shape repair error",
      rel: "automovie.json",
      value: { version: 2, assets: [] },
      fragments: ["semantically invalid", "manifest version must be 1"],
      read: openManifest,
    },
    // 2. script cast/beat passes
    {
      title: "a non-object script slice reports the script repair error",
      rel: "script.json",
      value: [],
      fragments: ["semantically invalid", "script must be a JSON object"],
    },
    {
      title: "malformed cast and beat entries report located violations",
      rel: "script.json",
      value: {
        logline: "L",
        theme: "T",
        cast: [5, { node: "c", character: "", modelRef: 5 }],
        beats: [5, { id: "b", name: "", summary: "", durationHint: -1 }],
      },
      fragments: ["semantically invalid", "$input"],
    },
    {
      title: "an empty beats array reports the at-least-one-beat rule",
      rel: "script.json",
      value: { logline: "L", theme: "T", cast: [], beats: [] },
      fragments: ["semantically invalid", "$input.beats", "at least one beat"],
    },
    {
      title:
        "a non-array beats beside a clean tree reports the beats violation",
      rel: "script.json",
      value: {
        logline: "L",
        theme: "T",
        cast: [],
        beats: "nope",
        tree: [cleanIntent(), cleanBeatNode()],
      },
      fragments: ["semantically invalid", "$input.beats"],
    },
    // 3. full intent-tree payload switch
    {
      title: "a tree spanning every payload-kind branch reports the tree error",
      rel: "script.json",
      value: {
        logline: "L",
        theme: "T",
        cast: [],
        beats: [{ id: "b1", name: "n", summary: "s", durationHint: 1 }],
        tree: bigTree(),
      },
      fragments: ["semantically invalid", "$input.tree"],
    },
    // 4. notes tier guard
    {
      title: "a malformed notes list reports the tier guard",
      rel: "notes.json",
      value: [5, { beat: "b1", tier: "bogus", issue: "", suggestion: "" }],
      fragments: ["semantically invalid", "tier"],
    },
    // 5. shot field checks
    {
      title: "a malformed shot slice reports the cameraMotion guard",
      rel: "shots/b1.json",
      value: {
        id: "shot:b1",
        name: null,
        scene: "sc",
        camera: "cam",
        cameraMotion: 5,
        performances: [5, { node: "p", startOffset: 0, motion: "m" }],
        objectMotions: [],
        duration: "x",
      },
      fragments: ["semantically invalid", "cameraMotion"],
    },
    // 6. beat-end shot-mismatch guard
    {
      title: "a beat-end whose shot is not shot:<beat> reports the mismatch",
      rel: "beatEnds/b1.json",
      value: {
        beat: "b1",
        shot: "wrong",
        actors: [5, validActor("a1", null), validActor("a2", "m")],
      },
      fragments: ["semantically invalid", "$input.shot", "shot:b1"],
    },
    // 7. non-object scene slice
    {
      title: "a non-object scene slice reports the scene repair error",
      rel: "scene.json",
      value: [],
      fragments: ["semantically invalid", "$input"],
    },
    // 8. keyed-filename decode + key-mismatch reporting
    {
      title: "a percent-only keyed filename reports the URI-decode failure",
      rel: "shots/%.json",
      value: {},
      fragments: ["keyed-slice mismatch", "URI-encoded key"],
    },
    {
      title: "a keyed slice missing its id reports none",
      rel: "shots/b1.json",
      value: {},
      fragments: ["keyed-slice mismatch", "shot id", "shot:b1", "none"],
    },
    {
      title: "a keyed slice with a mismatched id reports that id",
      rel: "shots/b1.json",
      value: { id: "shot:wrong" },
      fragments: ["keyed-slice mismatch", "shot:wrong"],
    },
  ];

  for (const entry of cases) {
    const root = fs.mkdtempSync(
      path.join(os.tmpdir(), "automovie-slice-edge-"),
    );
    try {
      AutoMovieProject.open(root);
      writeSlice(root, entry.rel, entry.value);
      const read = entry.read ?? readSlate;
      TestValidator.predicate(
        entry.title,
        throwsError(() => read(root), entry.fragments),
      );
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  }
};
