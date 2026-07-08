import {
  IAutoMovieAssembleApplication,
  IAutoMovieShot,
} from "@automovie/interface";
import { AutoMovieApplication } from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";

import { hasViolation } from "../internal/predicates";

const app = new AutoMovieApplication();
const shot: IAutoMovieShot = {
  id: "shot:beat-1",
  name: null,
  scene: "scene-duel",
  camera: "cam-main",
  cameraMotion: null,
  performances: [],
  objectMotions: [],
  duration: 3,
};
const assemble: IAutoMovieAssembleApplication.IWrite = {
  type: "write",
  sequence: { id: "seq-duel", name: "the duel" },
  fps: 24,
  entries: [{ shot: shot.id, trim: null, transition: null }],
  pacing: "hold the charge.",
  continuity: "single shot.",
};

/**
 * MCP `cut` is a tool boundary, so malformed direct payload shapes fail as cut
 * violations before the engine cut consumer iterates or dereferences them.
 */
export const test_mcp_cut_tool = (): void => {
  const cut = app.cut({ assemble, shots: [shot] }).cut;
  TestValidator.equals("valid cut succeeds", cut.success, true);

  const malformedShots = app.cut({
    assemble,
    shots: null as unknown as IAutoMovieShot[],
  }).cut;
  TestValidator.predicate(
    "malformed shots return violations",
    malformedShots.success === false &&
      hasViolation(malformedShots, "type", "$shots"),
  );

  const malformedShotEntry = app.cut({
    assemble,
    shots: [null as unknown as IAutoMovieShot],
  }).cut;
  TestValidator.predicate(
    "malformed shot entry returns violations",
    malformedShotEntry.success === false &&
      hasViolation(malformedShotEntry, "type", "$shots[0]"),
  );

  const malformedSequence = app.cut({
    assemble: {
      ...assemble,
      sequence:
        null as unknown as IAutoMovieAssembleApplication.IWrite["sequence"],
    },
    shots: [shot],
  }).cut;
  TestValidator.predicate(
    "malformed sequence returns violations",
    malformedSequence.success === false &&
      hasViolation(malformedSequence, "type", "$input.sequence"),
  );

  const malformedEntries = app.cut({
    assemble: {
      ...assemble,
      entries:
        null as unknown as IAutoMovieAssembleApplication.IWrite["entries"],
    },
    shots: [shot],
  }).cut;
  TestValidator.predicate(
    "malformed entries return violations",
    malformedEntries.success === false &&
      hasViolation(malformedEntries, "type", "$input.entries"),
  );

  const malformedEntry = app.cut({
    assemble: {
      ...assemble,
      entries: [
        null as unknown as IAutoMovieAssembleApplication.IWrite["entries"][number],
      ],
    },
    shots: [shot],
  }).cut;
  TestValidator.predicate(
    "malformed entry returns violations",
    malformedEntry.success === false &&
      hasViolation(malformedEntry, "type", "$input.entries[0]"),
  );

  const malformedTrim = app.cut({
    assemble: {
      ...assemble,
      entries: [
        {
          ...assemble.entries[0]!,
          trim: undefined as unknown as IAutoMovieAssembleApplication.IWrite["entries"][number]["trim"],
        },
      ],
    },
    shots: [shot],
  }).cut;
  TestValidator.predicate(
    "malformed trim returns violations",
    malformedTrim.success === false &&
      hasViolation(malformedTrim, "type", "$input.entries[0].trim"),
  );

  const malformedTransition = app.cut({
    assemble: {
      ...assemble,
      entries: [
        {
          ...assemble.entries[0]!,
          transition:
            undefined as unknown as IAutoMovieAssembleApplication.IWrite["entries"][number]["transition"],
        },
      ],
    },
    shots: [shot],
  }).cut;
  TestValidator.predicate(
    "malformed transition returns violations",
    malformedTransition.success === false &&
      hasViolation(malformedTransition, "type", "$input.entries[0].transition"),
  );
};
