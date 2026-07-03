import { cutSequence } from "@autofilm/engine";
import { IAutoFilmShot } from "@autofilm/interface";
import { TestValidator } from "@nestia/e2e";

import { hasViolation } from "../internal/predicates";

const SHOT: IAutoFilmShot = {
  id: "shot:beat-1",
  name: null,
  scene: "scene-duel",
  camera: "cam-main",
  cameraMotion: null,
  performances: [],
  objectMotions: [],
  duration: 3,
};

/**
 * Pins every entry-level gate of the ASSEMBLE consumer from one incoherent cut,
 * so the correction round reads the whole damage report at once.
 *
 * Scenarios (one entry each, against a single 3-second shot):
 *
 * 1. A transition on the first entry → `type` (nothing to transition from).
 * 2. An entry referencing the never-performed `shot:ghost` → `type`.
 * 3. A trim of duration 0 → `range` on its `trim.duration`.
 * 4. A trim `[2, 4]` poking 1 s past the 3-second shot → `range` on `trim` with
 *    overshoot 1.
 * 5. A 0-second transition → `range` on its `transition.duration`.
 * 6. A 2-second fade over a 1-second played span → `range` with overshoot 1.
 */
export const test_film_cut_sequence_invalid_entries = (): void => {
  const cut = cutSequence(
    {
      type: "write",
      sequence: { id: "seq-bad", name: "the mess" },
      fps: 24,
      entries: [
        {
          shot: "shot:beat-1",
          trim: null,
          transition: { kind: "crossDissolve", duration: 0.5 },
        },
        { shot: "shot:ghost", trim: null, transition: null },
        {
          shot: "shot:beat-1",
          trim: { start: 0, duration: 0 },
          transition: null,
        },
        {
          shot: "shot:beat-1",
          trim: { start: 2, duration: 2 },
          transition: null,
        },
        {
          shot: "shot:beat-1",
          trim: { start: 0, duration: 1 },
          transition: { kind: "fade", duration: 0 },
        },
        {
          shot: "shot:beat-1",
          trim: { start: 0, duration: 1 },
          transition: { kind: "fade", duration: 2 },
        },
      ],
      pacing: "n/a",
      continuity: "n/a",
    },
    [SHOT],
  );
  TestValidator.equals("fails", cut.success, false);
  if (cut.success !== false) return;
  TestValidator.predicate(
    "first-entry transition rejected",
    hasViolation(cut, "type", "$input.entries[0].transition"),
  );
  TestValidator.predicate(
    "unbuilt shot rejected",
    hasViolation(cut, "type", "$input.entries[1].shot"),
  );
  TestValidator.predicate(
    "zero trim rejected",
    hasViolation(cut, "range", "$input.entries[2].trim.duration"),
  );
  TestValidator.predicate(
    "out-of-shot trim rejected with overshoot",
    cut.violations.some(
      (v) =>
        v.kind === "range" &&
        v.path === "$input.entries[3].trim" &&
        v.overshoot === 1,
    ),
  );
  TestValidator.predicate(
    "zero transition rejected",
    hasViolation(cut, "range", "$input.entries[4].transition.duration"),
  );
  TestValidator.predicate(
    "overlong transition rejected with overshoot",
    cut.violations.some(
      (v) =>
        v.kind === "range" &&
        v.path === "$input.entries[5].transition.duration" &&
        v.overshoot === 1,
    ),
  );
};
