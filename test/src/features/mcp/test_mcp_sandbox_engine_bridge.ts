import {
  buildAutoMovieWall,
  extrudeAutoMovieProfile,
  mergeAutoMovieSpaces,
} from "@automovie/engine";
import {
  AUTOMOVIE_SANDBOX_BRIDGED_ENGINE_EXPORTS,
  AUTOMOVIE_SANDBOX_ENGINE_SURFACE,
  callAutoMovieSandboxEngine,
} from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";

import { namedFacts } from "../internal/predicates";

const answer = (name: string, args: unknown[]): unknown =>
  JSON.parse(callAutoMovieSandboxEngine(name, JSON.stringify(args)));

/** The value a successful crossing carried, which is what a caller receives. */
const carried = (name: string, args: unknown[]): unknown =>
  (answer(name, args) as { ok: boolean; value: unknown }).value;

/**
 * The deterministic sandbox answers a kernel call with the engine's own answer.
 *
 * The sandbox used to reimplement every engine name a shot source may import,
 * and a byte-parity gate compared the copies at the end of a ten-minute
 * compile. Four copies had already drifted: a reciprocal multiply written as
 * two divisions, an angle conversion folded into one constant, and the same
 * division twice more. This is the boundary that replaced them, so what it has
 * to prove is that nothing is reimplemented on either side of it and that a
 * refusal survives the crossing as a refusal rather than as a hole.
 *
 * Scenarios:
 *
 * 1. A bridged call answers byte for byte what calling the engine directly
 *    answers, which is the whole claim: one implementation, two callers.
 * 2. A kernel taking several arguments receives them in order, so the boundary is
 *    not quietly passing one object where two arguments were written.
 * 3. A refusal the engine raises crosses as its own message rather than as an
 *    exception object, because an `Error` from this realm handed to sandbox
 *    code is a live reference to this realm.
 * 4. A name nothing bridges is refused by name instead of answering `undefined`,
 *    which a caller would read as a kernel that returned nothing.
 * 5. Malformed argument text is refused rather than parsed into a call, so a
 *    corrupted crossing cannot reach a kernel with arguments nobody wrote.
 * 6. Every bridged name is on the importable surface, and the names the surface
 *    lists that nothing bridges are exactly the four the sandbox stands in for.
 *    Either side drifting is what made a stand-in unreachable before.
 */
export const test_mcp_sandbox_engine_bridge = (): void => {
  const profile = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
  ];
  TestValidator.equals(
    "a bridged kernel answers byte for byte what the engine answers",
    carried("extrudeAutoMovieProfile", [{ profile, depth: 0.4 }]),
    JSON.parse(
      JSON.stringify(extrudeAutoMovieProfile({ profile, depth: 0.4 })),
    ),
  );

  TestValidator.equals(
    "arguments cross in the order they were written",
    carried("mergeAutoMovieSpaces", ["merged", []]),
    JSON.parse(JSON.stringify(mergeAutoMovieSpaces("merged", []))),
  );

  const refusal = answer("extrudeAutoMovieProfile", [
    {
      profile: [
        { x: 0, y: 0 },
        { x: 2, y: 0 },
        { x: 1, y: 0.2 },
        { x: 2, y: 1 },
        { x: 0, y: 1 },
      ],
      depth: 0.4,
    },
  ]) as { ok: boolean; message?: string };
  TestValidator.equals(
    "a refusal crosses as its own message",
    namedFacts([
      ["refused", () => refusal.ok === false],
      [
        "engineWording",
        () => (refusal.message ?? "").includes("profile must be convex"),
      ],
    ]),
    { refused: true, engineWording: true },
  );

  const unknown = answer("worldSurfaceHeight", [null, null]) as {
    ok: boolean;
    message?: string;
  };
  TestValidator.equals(
    "a name nothing bridges is refused by name",
    namedFacts([
      ["refused", () => unknown.ok === false],
      [
        "named",
        () =>
          (unknown.message ?? "").includes('forwarded "worldSurfaceHeight"'),
      ],
    ]),
    { refused: true, named: true },
  );

  const malformed = JSON.parse(
    callAutoMovieSandboxEngine("mergeAutoMovieSpaces", "{not json"),
  ) as { ok: boolean };
  TestValidator.equals(
    "argument text that is not JSON never reaches a kernel",
    malformed.ok,
    false,
  );

  const surface = new Set(AUTOMOVIE_SANDBOX_ENGINE_SURFACE);
  TestValidator.equals(
    "what is bridged and what is stood in for together cover the surface exactly",
    namedFacts([
      [
        "bridgedAreImportable",
        () =>
          AUTOMOVIE_SANDBOX_BRIDGED_ENGINE_EXPORTS.every((name) =>
            surface.has(name),
          ),
      ],
      [
        "standIns",
        () =>
          [...surface]
            .filter(
              (name) =>
                AUTOMOVIE_SANDBOX_BRIDGED_ENGINE_EXPORTS.includes(name) ===
                false,
            )
            .sort((left, right) => (left < right ? -1 : 1))
            .join(",") ===
          "AutoMovieSubject,AutoMovieSubjectGroup,defineShot,worldSurfaceHeight",
      ],
    ]),
    { bridgedAreImportable: true, standIns: true },
  );

  TestValidator.equals(
    "a kernel that reads a props object still reads it whole",
    carried("buildAutoMovieWall", [
      { width: 4, height: 3, depth: 0.2, openings: [] },
    ]),
    JSON.parse(
      JSON.stringify(
        buildAutoMovieWall({ width: 4, height: 3, depth: 0.2, openings: [] }),
      ),
    ),
  );
};
