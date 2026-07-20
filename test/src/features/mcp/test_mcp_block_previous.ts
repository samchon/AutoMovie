import {
  IAutoMovieBeatEndActorState,
  IAutoMovieBeatEndState,
} from "@automovie/interface";
import { AutoMovieApplication } from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";

import {
  makeBlockingWrite,
  makeScriptWrite,
  makeStagingWrite,
} from "../internal/filmFixtures";
import { IDENTITY_TRANSFORM } from "../internal/fixtures";
import { hasViolation } from "../internal/predicates";

const app = new AutoMovieApplication();
const script = makeScriptWrite();
const staged = app.stage({ script, staging: makeStagingWrite() }).staged;
if (staged.success !== true) throw new Error("stage fixture must succeed");
const blocking = makeBlockingWrite();

const actor = (node: string): IAutoMovieBeatEndActorState => ({
  node,
  transform: IDENTITY_TRANSFORM,
  facing: { x: 0, y: 0, z: 1 },
  pose: null,
  motion: null,
  localTime: 2,
  gaitPhase: null,
  rootVelocity: null,
  footPlants: null,
  mount: null,
});

const previous = (
  actors: IAutoMovieBeatEndActorState[],
): IAutoMovieBeatEndState => ({ beat: "beat-0", shot: "shot:beat-0", actors });

/**
 * The `block` tool's `previous` seam (#1176): the prior beat's resolved
 * end-state threads through to the engine's existing `blockBeat` gate, so a
 * beat blocks as a CONTINUATION: carried actors must be staged nodes, and the
 * validated state surfaces on the success for the performance stage to seed
 * from. Malformed carries fail as violations, never a crash.
 *
 * Scenarios:
 *
 * 1. A valid previous (both knights carried) blocks successfully and surfaces
 *    verbatim as `blocked.previous`.
 * 2. Omitting previous blocks as before with `previous: null` (first beat).
 * 3. A carried actor the stage never placed, and a duplicated carried actor, each
 *    fail at `$input.previous.actors[i].node`: the engine gates, remapped to
 *    the tool path.
 * 4. Totality: a non-object previous, a non-array `actors`, a non-object actor
 *    entry, and a non-string node each fail as shape violations before the
 *    engine would dereference them.
 */
export const test_mcp_block_previous = (): void => {
  // 1. valid carry surfaces verbatim.
  const carried = previous([actor("knightA"), actor("knightB")]);
  const blocked = app.block({
    script,
    staged,
    blocking,
    previous: carried,
  }).blocked;
  TestValidator.equals("a valid carry blocks", blocked.success, true);
  if (blocked.success !== true) return;
  TestValidator.equals(
    "the carry surfaces verbatim",
    blocked.previous,
    carried,
  );

  // 2. omitted previous stays the first-beat null.
  const first = app.block({ script, staged, blocking }).blocked;
  TestValidator.predicate(
    "omitting previous blocks with previous null",
    first.success === true && first.previous === null,
  );

  // 3. engine gates, remapped to the tool path.
  const ghost = app.block({
    script,
    staged,
    blocking,
    previous: previous([actor("ghost")]),
  }).blocked;
  TestValidator.predicate(
    "an unstaged carried actor fails at the tool path",
    ghost.success === false &&
      hasViolation(ghost, "type", "$input.previous.actors[0].node") &&
      ghost.violations.some((v) =>
        v.expected.includes("not a staged scene node"),
      ),
  );
  const duplicated = app.block({
    script,
    staged,
    blocking,
    previous: previous([actor("knightA"), actor("knightA")]),
  }).blocked;
  TestValidator.predicate(
    "a duplicated carried actor fails at the tool path",
    duplicated.success === false &&
      hasViolation(duplicated, "type", "$input.previous.actors[1].node") &&
      duplicated.violations.some((v) => v.expected.includes("duplicated")),
  );

  // 4. shape totality before the engine dereferences.
  TestValidator.predicate(
    "a non-object previous is a shape violation",
    (() => {
      const result = app.block({
        script,
        staged,
        blocking,
        previous: 5 as never,
      }).blocked;
      return (
        result.success === false &&
        hasViolation(result, "type", "$input.previous")
      );
    })(),
  );
  TestValidator.predicate(
    "a non-array actors is a shape violation",
    (() => {
      const result = app.block({
        script,
        staged,
        blocking,
        previous: { beat: "b", shot: "s", actors: null } as never,
      }).blocked;
      return (
        result.success === false &&
        hasViolation(result, "type", "$input.previous.actors")
      );
    })(),
  );
  TestValidator.predicate(
    "a non-object actor entry is a shape violation",
    (() => {
      const result = app.block({
        script,
        staged,
        blocking,
        previous: { beat: "b", shot: "s", actors: [null] } as never,
      }).blocked;
      return (
        result.success === false &&
        hasViolation(result, "type", "$input.previous.actors[0]")
      );
    })(),
  );
  TestValidator.predicate(
    "a non-string node is a shape violation",
    (() => {
      const result = app.block({
        script,
        staged,
        blocking,
        previous: {
          beat: "b",
          shot: "s",
          actors: [{ ...actor("knightA"), node: 7 }],
        } as never,
      }).blocked;
      return (
        result.success === false &&
        hasViolation(result, "type", "$input.previous.actors[0].node")
      );
    })(),
  );
};
