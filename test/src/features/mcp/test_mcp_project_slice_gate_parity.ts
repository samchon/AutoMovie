import { IAutoMovieScene, IAutoMovieShot } from "@automovie/interface";
import { AutoMovieApplication, AutoMovieProject } from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { hasViolation, throwsError } from "../internal/predicates";

const app = new AutoMovieApplication();

/** Write a crafted slice file into an already-opened project. */
const writeSlice = (root: string, rel: string, value: unknown): void =>
  fs.writeFileSync(
    path.join(root, ...rel.split("/")),
    `${JSON.stringify(value, null, 2)}\n`,
  );

/** Run `task` against a fresh empty project directory. */
const inProject = (task: (root: string) => void): void => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "automovie-gate-parity-"));
  try {
    AutoMovieProject.open(root);
    task(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
};

/** A structurally complete object-motion clip: no violations of its own. */
const clip = (id: string): unknown => ({
  id,
  name: null,
  duration: 2,
  loop: false,
  tracks: [
    {
      channel: { kind: "node", node: "prop", path: "translation" },
      times: [0, 1],
      values: [0, 0, 0, 1, 0, 0],
      interpolation: "linear",
    },
  ],
});

/** A shot slice whose only questionable property is its object-motion ids. */
const shotWith = (clipIds: [string, string]): unknown => ({
  id: "shot:b1",
  name: null,
  scene: "sc",
  camera: "cam",
  cameraMotion: null,
  performances: [],
  objectMotions: clipIds.map(clip),
  duration: 2,
});

/** The channel a light clip must NOT address: the transform clips' form. */
const NODE_LIGHT_TRACK: unknown = {
  kind: "node",
  node: "prop",
  path: "translation",
};

/** The channel a light clip must address. */
const LIGHT_POINTER_TRACK: unknown = {
  kind: "pointer",
  pointer: "/lights/candleGlow/intensity",
  valueType: "scalar",
};

/** A shot slice whose only questionable property is its light clip's channel. */
const shotLit = (channel: unknown): unknown => ({
  id: "shot:b1",
  name: null,
  scene: "sc",
  camera: "cam",
  cameraMotion: null,
  performances: [],
  objectMotions: [],
  lightMotions: [
    {
      id: "candleOut",
      name: null,
      duration: 2,
      loop: false,
      tracks: [
        {
          channel,
          times: [0, 1],
          values:
            channel === NODE_LIGHT_TRACK ? [0, 0, 0, 1, 0, 0] : [1.4, 0.04],
          interpolation: "step",
        },
      ],
    },
  ],
  duration: 2,
});

/** A script slice whose only questionable property is its beat ids. */
const scriptWith = (beatIds: [string, string]): unknown => ({
  logline: "two beats one letter apart",
  theme: "identity",
  cast: [],
  beats: beatIds.map((id, i) => ({
    id,
    name: `beat ${i + 1}`,
    summary: `the ${i === 0 ? "first" : "second"} beat`,
    durationHint: 1,
  })),
});

const scene: IAutoMovieScene = {
  id: "sc",
  name: null,
  nodes: [],
  cameras: [
    {
      id: "cam",
      transform: {
        translation: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0, w: 1 },
        scale: { x: 1, y: 1, z: 1 },
      },
      fovY: 45,
      near: 0.1,
      far: 100,
    },
  ],
  lights: [],
};

/**
 * A stored slice must be refused by exactly the rules that would refuse the
 * same artifact on submit. The resident store's read gate exists for files this
 * server did not write, or wrote under an older version, so a rule the submit
 * gate applies and the read gate does not is a hole with no compensating check
 * behind it: the artifact loads clean and fails later, somewhere with no path
 * to report.
 *
 * Two rules had drifted that way. Object-motion clip ids must be unique, which
 * the engine works to satisfy (`performShot` suffixes a repeated projectile
 * flight's `trajectory:<node>` clip so the shot stays committable), and beat
 * ids must not collide case-insensitively, because they become this store's own
 * slice filenames. Both are now one definition applied by both gates (#1326,
 * #1327).
 *
 * Each rule's submit half is pinned elsewhere already:
 * `test_mcp_script_beat_case_collision` for the beat ids, and
 * `test_mcp_artifact_validator_edges` for the clip ids. What was missing is the
 * read half of both, and a single place that states the AGREEMENT rather than
 * each side separately. The clip rule's submit assertion is repeated here for
 * that reason: its existing pin sits inside a large edge-case aggregate where
 * the parity claim is not what the case is about, so pruning it would retire
 * the guard silently.
 *
 * Scenarios:
 *
 * 1. A stored shot whose two object motions share one clip id is refused on read
 *    at the second clip's id path.
 * 2. Negative twin: the same shot with distinct clip ids loads, carrying both
 *    clips.
 * 3. Parity: `validateShot` refuses that same duplicate-id shot, so the two gates
 *    agree rather than one of them merely being strict.
 * 4. A stored script whose beats are "Beat" and "beat" is refused on read at the
 *    second beat's id, naming both ids.
 * 5. Negative twin: beats one character apart load, both of them.
 * 6. The light-time axis (#1348) is read under the same discipline: a stored shot
 *    whose `lightMotions` track addresses a node channel is refused on read,
 *    and `validateShot` refuses the same artifact. No scene travels with a
 *    slice, so WHICH lights are staged is the one rule that defers; the pointer
 *    grammar is not, which is why the read half can be stated at all.
 * 7. Negative twin: the same shot with a light pointer loads, carrying its clip.
 */
export const test_mcp_project_slice_gate_parity = (): void => {
  // 1. duplicate object-motion clip ids are refused on read.
  inProject((root) => {
    writeSlice(root, "shots/b1.json", shotWith(["obj:a", "obj:a"]));
    TestValidator.predicate(
      "a stored shot repeating an object-motion clip id is refused",
      throwsError(
        () => AutoMovieProject.open(root).writableSlate(),
        [
          "semantically invalid",
          "$input.objectMotions[1].id",
          "object motion clip id",
          "must be unique",
        ],
      ),
    );
  });

  // 2. negative twin: distinct ids read clean, one property away.
  inProject((root) => {
    writeSlice(root, "shots/b1.json", shotWith(["obj:a", "obj:b"]));
    const slate = AutoMovieProject.open(root).writableSlate();
    TestValidator.equals(
      "distinct object-motion clip ids load",
      slate.shots.map((shot) => shot.objectMotions.map((motion) => motion.id)),
      [["obj:a", "obj:b"]],
    );
  });

  // 3. parity: the submit gate refuses the same artifact.
  TestValidator.predicate(
    "validateShot refuses the same duplicate clip ids",
    hasViolation(
      app.validateShot({
        shot: shotWith(["obj:a", "obj:a"]) as IAutoMovieShot,
        scene,
      }).validation,
      "type",
      "$input.shot.objectMotions[1].id",
    ),
  );

  // 4. case-colliding beat ids are refused on read.
  inProject((root) => {
    writeSlice(root, "script.json", scriptWith(["Beat", "beat"]));
    TestValidator.predicate(
      "a stored script with case-colliding beat ids is refused",
      throwsError(
        () => AutoMovieProject.open(root).writableSlate(),
        [
          "semantically invalid",
          "$input.beats[1].id",
          '"Beat"',
          '"beat"',
          "collides case-insensitively",
        ],
      ),
    );
  });

  // 5. negative twin: genuinely distinct beat ids read clean.
  inProject((root) => {
    writeSlice(root, "script.json", scriptWith(["beat-a", "beat-b"]));
    const slate = AutoMovieProject.open(root).writableSlate();
    TestValidator.equals(
      "distinct beat ids load",
      slate.script?.beats.map((beat) => beat.id),
      ["beat-a", "beat-b"],
    );
  });

  // 6. the light-time axis reads under the same gate it submits under.
  inProject((root) => {
    writeSlice(root, "shots/b1.json", shotLit(NODE_LIGHT_TRACK));
    TestValidator.predicate(
      "a stored light clip addressing a node channel is refused on read",
      throwsError(
        () => AutoMovieProject.open(root).writableSlate(),
        [
          "semantically invalid",
          "$input.lightMotions[0].tracks[0].channel.kind",
          'must be "pointer"',
        ],
      ),
    );
  });
  TestValidator.predicate(
    "validateShot refuses the same stored artifact",
    hasViolation(
      app.validateShot({
        shot: shotLit(NODE_LIGHT_TRACK) as IAutoMovieShot,
        scene,
      }).validation,
      "type",
      "$input.shot.lightMotions[0].tracks[0].channel.kind",
    ),
  );

  // 7. negative twin: a light pointer reads clean, one property away.
  inProject((root) => {
    writeSlice(root, "shots/b1.json", shotLit(LIGHT_POINTER_TRACK));
    const slate = AutoMovieProject.open(root).writableSlate();
    TestValidator.equals(
      "a light pointer clip loads",
      slate.shots.map((shot) => (shot.lightMotions ?? []).map((c) => c.id)),
      [["candleOut"]],
    );
  });
};
