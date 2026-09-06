import type {
  IAutoMovieDiagnostic,
  IAutoMovieScreenplayIndex,
  IAutoMovieShotContract,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";
import path from "node:path";

import { loadSourceModule } from "../internal/loadSourceModule";
import { nclose } from "../internal/predicates";

const { parseScreenplayTimingOccurrences } = loadSourceModule<{
  parseScreenplayTimingOccurrences: (
    body: string,
  ) => Array<{ text: string; seconds: number; selector: string | null }>;
}>(
  path.resolve(
    __dirname,
    "../../../../packages/production/src/production/screenplayProseDiagnostics.ts",
  ),
);
const { screenplayTimingDiagnostics } = loadSourceModule<{
  screenplayTimingDiagnostics: (props: {
    contracts: ReadonlyMap<string, IAutoMovieShotContract>;
    read: (relative: string) => string | null;
    scope: "design" | "source" | "review" | "final";
    screenplay: IAutoMovieScreenplayIndex;
  }) => IAutoMovieDiagnostic[];
}>(
  path.resolve(
    __dirname,
    "../../../../packages/production/src/production/screenplayTimingDiagnostics.ts",
  ),
);

/** Only the declared timing owner fields participate in this diagnostic. */
const timingContract = (id: string): IAutoMovieShotContract =>
  ({
    id,
    evidence: [{ scene: "SCN-A", claims: [] }],
    durationSeconds: 6,
    events: [{ id: "event_a", window: { from: 1, to: 2 }, predicates: [] }],
    reviewFrames: [{ id: "frame_a", time: 3, passes: ["beauty"] }],
  }) as IAutoMovieShotContract;

/**
 * Preserve the exact timing owner while normalizing prose emphasis.
 *
 * Scenarios:
 * 1. All four field selectors retain underscore identities with every supported
 *    emphasis marker; invalid and unfinished directives remain invalid.
 * 2. Exact shot, event, and review owners pass without an alias being present.
 * 3. An equal-valued alias cannot replace a missing owner or hide a mismatch.
 * 4. Missing owners warn during authoring and refuse during review and final;
 *    another scene's owner and an invalid selector never borrow authority.
 */
export const test_production_screenplay_timing_identity = (): void => {
  const cases = [
    { selector: "shot:shot_a/duration", seconds: 6 },
    { selector: "shot:shot_a/event:event_a/from", seconds: 1 },
    { selector: "shot:shot_a/event:event_a/to", seconds: 2 },
    { selector: "shot:shot_a/review:frame_a", seconds: 3 },
  ];
  for (const { selector, seconds } of cases)
    for (const marker of ["", "*", "**", "_", "__", "`"])
      TestValidator.equals(
        `emphasis ${marker} preserves ${selector}`,
        parseScreenplayTimingOccurrences(
          `${marker}${seconds} seconds${marker} {@timing ${selector}}`,
        ),
        [{ text: String(seconds), seconds, selector }],
      );
  const fraction = parseScreenplayTimingOccurrences(
    "**half second** {@timing shot:shot_a/dur_ation}",
  );
  TestValidator.equals(
    "fraction keeps malformed owner",
    fraction.map((entry) => entry.selector),
    ["shot:shot_a/dur_ation"],
  );
  TestValidator.predicate(
    "word fraction remains normalized",
    nclose(fraction[0]!.seconds, 0.5),
  );
  TestValidator.equals(
    "malformed and unfinished directives cannot become valid by normalization",
    parseScreenplayTimingOccurrences(
      "6 seconds {@tim_ing shot:shot_a/duration}\n" +
        "6 seconds {@timing shot:shot_a/duration\n" +
        "6 seconds",
    ).map((entry) => entry.selector),
    [null, null, null],
  );

  const screenplay = {
    screenplay: {
      path: "docs/scene.md",
      scenes: [{ id: "SCN-A", status: "active", disposition: null }],
    },
  } as IAutoMovieScreenplayIndex;
  const run = (
    selector: string,
    seconds: number,
    contracts: ReadonlyMap<string, IAutoMovieShotContract>,
    scope: "design" | "source" | "review" | "final",
  ) =>
    screenplayTimingDiagnostics({
      contracts,
      read: () =>
        `## SCN-A - Action\n**${seconds} seconds** {@timing ${selector}}`,
      scope,
      screenplay,
    });

  for (const { selector, seconds } of cases) {
    const owner = timingContract("shot_a");
    TestValidator.equals(
      `exact owner of ${selector}`,
      run(selector, seconds, new Map([[owner.id, owner]]), "review"),
      [],
    );
    const decoy = timingContract("shota");
    const conflicting = timingContract("shot_a");
    conflicting.durationSeconds += 1;
    conflicting.events[0]!.window.from += 1;
    conflicting.events[0]!.window.to += 1;
    conflicting.reviewFrames[0]!.time += 1;
    conflicting.events.push({ ...owner.events[0]!, id: "eventa" });
    conflicting.reviewFrames.push({ ...owner.reviewFrames[0]!, id: "framea" });
    TestValidator.equals(
      `equal-valued aliases cannot hide ${selector} mismatch`,
      run(
        selector,
        seconds,
        new Map([
          [conflicting.id, conflicting],
          [decoy.id, decoy],
        ]),
        "review",
      ).map((entry) => entry.code),
      ["screenplay-timing-value-mismatch"],
    );
    const missingField = timingContract("shot_a");
    missingField.events[0]!.id = "eventa";
    missingField.reviewFrames[0]!.id = "framea";
    const missing = new Map([[decoy.id, decoy]]);
    if (selector !== "shot:shot_a/duration")
      missing.set(missingField.id, missingField);
    for (const scope of ["design", "source", "review", "final"] as const)
      TestValidator.equals(
        `missing ${selector} at ${scope}`,
        run(selector, seconds, missing, scope).map((entry) => ({
          code: entry.code,
          category: entry.category,
        })),
        [
          {
            code: "screenplay-timing-owner-absent",
            category:
              scope === "design" || scope === "source" ? "warning" : "error",
          },
        ],
      );
  }
  const otherScene = timingContract("shot_a");
  otherScene.evidence = [{ scene: "SCN-B", claims: [] }];
  TestValidator.equals(
    "same identity in another scene has no authority",
    run(
      "shot:shot_a/duration",
      6,
      new Map([[otherScene.id, otherScene]]),
      "review",
    ).map((entry) => entry.code),
    ["screenplay-timing-owner-absent"],
  );
  TestValidator.equals(
    "malformed field is not normalized into duration",
    run("shot:shot_a/dur_ation", 6, new Map(), "review").map(
      (entry) => entry.code,
    ),
    ["screenplay-timing-reference-invalid"],
  );
};
