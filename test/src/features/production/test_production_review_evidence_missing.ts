import type {
  AutoMovieContentDigest,
  AutoMovieGuidePass,
  IAutoMovieDiagnostic,
  IAutoMovieRenderBundleManifest,
  IAutoMovieShotContract,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";
import path from "node:path";

import { loadSourceModule } from "../internal/loadSourceModule";
import { namedFacts } from "../internal/predicates";

/**
 * Load the diagnostic unit from source without making it public API.
 *
 * The test launcher already owns the TypeScript require hook, so resolving at
 * runtime keeps the package source outside this test package's `rootDir` and
 * avoids depending on a pre-existing `packages/production/lib` build.
 */
const unit = loadSourceModule<{
  consumedModelIds: (
    graph: {
      models: ReadonlyMap<string, { lod: Array<{ recipe: string }> }>;
      shots: ReadonlyMap<
        string,
        { participants: Array<{ kind: string; id: string }> }
      >;
      formations: ReadonlyMap<string, { modelRecipe: string }>;
    },
    compiled: ReadonlyMap<string, { models: Array<{ id: string }> }>,
  ) => string[];
  assetReviewEvidenceDiagnostics: (props: {
    consumed: readonly string[];
    rigged: (model: string) => boolean;
    scope: "design" | "source" | "review" | "final";
    fingerprint: (
      target: IAutoMovieRenderBundleManifest["target"],
    ) => AutoMovieContentDigest | null;
    captured: (
      target: IAutoMovieRenderBundleManifest["target"],
      fingerprint: AutoMovieContentDigest,
    ) => ReadonlyArray<{
      time: number;
      pass: AutoMovieGuidePass;
      semanticCoverage?: { unresolved: string[]; unaddressed: number };
    }>;
  }) => IAutoMovieDiagnostic[];
  reviewEvidenceDiagnostics: (props: {
    contracts: ReadonlyMap<string, IAutoMovieShotContract>;
    fps: number;
    scope: "design" | "source" | "review" | "final";
    fingerprint: (
      target: IAutoMovieRenderBundleManifest["target"],
    ) => AutoMovieContentDigest | null;
    captured: (
      target: IAutoMovieRenderBundleManifest["target"],
      fingerprint: AutoMovieContentDigest,
    ) => ReadonlyArray<{ time: number; pass: AutoMovieGuidePass }>;
  }) => IAutoMovieDiagnostic[];
}>(
  path.resolve(
    __dirname,
    "../../../../packages/production/src/production/reviewEvidenceDiagnostics.ts",
  ),
);
const {
  assetReviewEvidenceDiagnostics,
  consumedModelIds,
  reviewEvidenceDiagnostics,
} = unit;

/**
 * A design holding one staged model, one unstaged model, and one reached only
 * through a formation and a level-of-detail tier.
 */
const designGraph = {
  models: new Map([
    ["soloist", { lod: [{ recipe: "soloist-far" }] }],
    ["soloist-far", { lod: [] }],
    ["crowd-member", { lod: [] }],
    ["prop-nobody-stages", { lod: [] }],
    ["resolved-by-build", { lod: [] }],
  ]),
  shots: new Map([
    [
      "opening",
      {
        participants: [
          { kind: "actor", id: "soloist" },
          { kind: "formation", id: "chorus" },
        ],
      },
    ],
  ]),
  formations: new Map([["chorus", { modelRecipe: "crowd-member" }]]),
};

const FINGERPRINT =
  "sha256:1111111111111111111111111111111111111111111111111111111111111111" as AutoMovieContentDigest;

/** The review-frame subset and duration are the whole input this reads. */
const contracts = (
  frames: IAutoMovieShotContract["reviewFrames"],
): ReadonlyMap<string, IAutoMovieShotContract> =>
  new Map([
    [
      "opening",
      {
        durationSeconds: 6,
        reviewFrames: frames,
      } as unknown as IAutoMovieShotContract,
    ],
  ]);

const run = (props: {
  frames: IAutoMovieShotContract["reviewFrames"];
  fps?: number;
  scope?: "design" | "source" | "review" | "final";
  held?: ReadonlyArray<{
    time: number;
    pass: AutoMovieGuidePass;
    semanticCoverage?: { unresolved: string[]; unaddressed: number };
  }>;
  fingerprint?: AutoMovieContentDigest | null;
}): IAutoMovieDiagnostic[] =>
  reviewEvidenceDiagnostics({
    captured: () => props.held ?? [],
    contracts: contracts(props.frames),
    fingerprint: () =>
      props.fingerprint === undefined ? FINGERPRINT : props.fingerprint,
    fps: props.fps ?? 24,
    scope: props.scope ?? "review",
  });

const frame = (
  id: string,
  time: number,
  passes: AutoMovieGuidePass[],
): IAutoMovieShotContract["reviewFrames"][number] =>
  ({ id, passes, time }) as IAutoMovieShotContract["reviewFrames"][number];

const asset = (props: {
  consumed?: readonly string[];
  held?: boolean;
  heldPasses?: AutoMovieGuidePass[];
  rigged?: boolean;
  scope?: "design" | "source" | "review" | "final";
  fingerprint?: AutoMovieContentDigest | null;
}): IAutoMovieDiagnostic[] =>
  assetReviewEvidenceDiagnostics({
    captured: () =>
      (
        props.heldPasses ?? (props.held === true ? ["beauty", "outline"] : [])
      ).map((pass) => ({ pass, time: 0 })),
    consumed: props.consumed ?? ["soloist"],
    fingerprint: () =>
      props.fingerprint === undefined ? FINGERPRINT : props.fingerprint,
    rigged: () => props.rigged === true,
    scope: props.scope ?? "review",
  });

/**
 * A review is refused while the frames its own contract declares are absent at
 * the shot's current identity.
 *
 * A citation states what was verified and expires when its source moves, which
 * is a claim about prose and none at all about pixels. Nothing else asks
 * whether the declared frames were ever drawn, so without this an author who
 * captured nothing writes a fingerprint-valid review and every gate passes.
 *
 * Scenarios:
 *
 * 1. A declared frame-and-pass pair with no committed view is refused, and the
 *    message names the frame, its time, and its pass rather than counting.
 * 2. Every declared pair held means nothing is owed.
 * 3. Only `review` and `final` owe pixels; `design` and `source` are the stages
 *    where the frames do not exist yet by construction.
 * 4. A view held at a different pass does not discharge the pass that is owed,
 *    and a view held at a different time does not discharge the time.
 * 5. A shot the production cannot address yet reports nothing, because a target
 *    with no fingerprint has no identity to file evidence under.
 * 6. A contract declaring no review frame owes nothing here; that a shot must
 *    declare at least one is a separate design refusal.
 * 7. More owed views than a message should hold are named up to a bound and the
 *    remainder is counted, so the author is told which work is left.
 * 8. A staged model owes the whole turntable set rather than an authored one,
 *    and a rigged model owes its extreme-range pose on top of it.
 * 9. A model nothing stages owes nothing, because the gate is on what the film
 *    puts on screen and not on what the library holds.
 * 10. An asset view is discharged by its own pass and by no other, because the
 *    pass lives on the frame rather than on the target it was drawn for.
 */
export const test_production_review_evidence_missing = (): void => {
  const missing = run({ frames: [frame("wide", 1.5, ["beauty"])] });
  const complete = run({
    frames: [frame("wide", 1.5, ["beauty"])],
    held: [{ pass: "beauty", time: 1.5 }],
  });
  const wrongPass = run({
    frames: [frame("wide", 1.5, ["beauty"])],
    held: [{ pass: "depth", time: 1.5 }],
  });
  const wrongTime = run({
    frames: [frame("wide", 1.5, ["beauty"])],
    held: [{ pass: "beauty", time: 2 }],
  });
  const many = run({
    frames: Array.from({ length: 8 }, (_value, index) =>
      frame(`f${index}`, index, ["beauty"]),
    ),
  });
  TestValidator.equals(
    "a review is refused exactly while its declared evidence is absent",
    namedFacts([
      ["oneRefusal", () => missing.length === 1],
      ["code", () => missing[0]?.code === "review-evidence-missing"],
      ["blocking", () => missing[0]?.category === "error"],
      ["phase", () => missing[0]?.phase === "review"],
      ["target", () => missing[0]?.target === "shot:opening"],
      [
        "namesTheFrame",
        () => missing[0]?.message.includes('"wide" at 1.5s (beauty)') === true,
      ],
      [
        "namesTheIdentity",
        () => missing[0]?.message.includes(FINGERPRINT) === true,
      ],
      ["completeIsSilent", () => complete.length === 0],
      [
        "maskNeedsCompleteSemanticEvidence",
        () =>
          run({
            frames: [frame("identity", 1.5, ["mask"])],
            held: [{ pass: "mask", time: 1.5 }],
          }).length === 1,
      ],
      [
        "maskGapRemainsNamed",
        () => {
          const diagnostic = run({
            frames: [frame("identity", 1.5, ["mask"])],
            held: [
              {
                pass: "mask",
                time: 1.5,
                semanticCoverage: {
                  unresolved: ["node:missing"],
                  unaddressed: 2,
                },
              },
            ],
          })[0];
          return (
            diagnostic?.message.includes("node:missing") === true &&
            diagnostic.message.includes("2 unnamed meshes")
          );
        },
      ],
      [
        "completeMaskIsHeld",
        () =>
          run({
            frames: [frame("identity", 1.5, ["mask"])],
            held: [
              {
                pass: "mask",
                time: 1.5,
                semanticCoverage: { unresolved: [], unaddressed: 0 },
              },
            ],
          }).length === 0,
      ],
      ["passIsNotInterchangeable", () => wrongPass.length === 1],
      ["timeIsNotInterchangeable", () => wrongTime.length === 1],
      [
        "designOwesNothing",
        () =>
          run({ frames: [frame("wide", 1.5, ["beauty"])], scope: "design" })
            .length === 0,
      ],
      [
        "sourceOwesNothing",
        () =>
          run({ frames: [frame("wide", 1.5, ["beauty"])], scope: "source" })
            .length === 0,
      ],
      [
        "finalOwesPixels",
        () =>
          run({ frames: [frame("wide", 1.5, ["beauty"])], scope: "final" })
            .length === 1,
      ],
      [
        "unaddressableIsSilent",
        () =>
          run({
            fingerprint: null,
            frames: [frame("wide", 1.5, ["beauty"])],
          }).length === 0,
      ],
      ["noDeclaredFrameOwesNothing", () => run({ frames: [] }).length === 0],
      [
        "everyDeclaredPassIsOwed",
        () =>
          run({
            frames: [frame("wide", 1.5, ["beauty", "depth"])],
            held: [{ pass: "beauty", time: 1.5 }],
          })[0]?.message.includes('"wide" at 1.5s (depth)') === true,
      ],
      ["boundedList", () => many[0]?.message.includes("and 2 more") === true],
      // Capture records the time the oracle snapped to, not the time a
      // contract asked for, so the comparison is on the frame index. Compared
      // as seconds these two disagree and a frame that exists reads as owed.
      [
        "aDeclaredTimeResolvesOntoItsFrame",
        () =>
          run({
            frames: [frame("wide", 1.51, ["beauty"])],
            held: [{ pass: "beauty", time: 1.5 }],
          }).length === 0,
      ],
      [
        "aDifferentFrameStillDoesNotDischarge",
        () =>
          run({
            frames: [frame("wide", 1.51, ["beauty"])],
            held: [{ pass: "beauty", time: 1.4 }],
          }).length === 1,
      ],
      // The oracle clamps a request past the end onto the last real frame, so
      // a contract naming a time beyond its own duration is discharged by the
      // frame that was actually drawn.
      [
        "aTimePastTheEndClampsLikeCaptureDoes",
        () =>
          run({
            frames: [frame("tail", 99, ["beauty"])],
            held: [{ pass: "beauty", time: 6 }],
          }).length === 0,
      ],
      // An asset owes a fixed view set rather than an authored one, so the
      // refusal reads the same set the capture path draws from.
      ["assetOwesItsSet", () => asset({}).length === 1],
      ["assetTarget", () => asset({}).at(0)?.target === "asset:soloist"],
      [
        "assetNamesEveryView",
        () =>
          [
            "turntable-front",
            "turntable-right",
            "turntable-back",
            "left",
          ].every((view) => asset({}).at(0)?.message.includes(view) === true),
      ],
      [
        "aRigOwesItsExtremes",
        () =>
          asset({ rigged: true })
            .at(0)
            ?.message.includes("rig-rom-extremes") === true,
      ],
      [
        "anUnriggedModelDoesNot",
        () => asset({}).at(0)?.message.includes("rig-rom-extremes") === false,
      ],
      ["assetCompleteIsSilent", () => asset({ held: true }).length === 0],
      // The consumed set is what the film stages, closed under level of
      // detail, from both the contracts and the compiled shot sources. Reading
      // the materialized inventory instead would return every declared recipe
      // and make the gate a tax on the library.
      [
        "stagesAreConsumed",
        () =>
          consumedModelIds(designGraph, new Map()).join(",") ===
          "crowd-member,soloist,soloist-far",
      ],
      [
        "aBuildPathModelIsConsumed",
        () =>
          consumedModelIds(
            designGraph,
            new Map([["opening", { models: [{ id: "resolved-by-build" }] }]]),
          ).includes("resolved-by-build"),
      ],
      [
        "anUnstagedRecipeIsNotConsumed",
        () =>
          consumedModelIds(designGraph, new Map()).includes(
            "prop-nobody-stages",
          ) === false,
      ],
      // The pass lives on the frame rather than on the target, so a bundle
      // standing at the overhead angle proves nothing about which pass was
      // drawn there.
      [
        "anOutlineViewIsNotSatisfiedByBeauty",
        () =>
          asset({ heldPasses: ["beauty"] })
            .at(0)
            ?.message.includes('"top-outline" (outline)') === true,
      ],
      [
        "aBeautyViewIsNotSatisfiedByOutline",
        () =>
          asset({ heldPasses: ["outline"] })
            .at(0)
            ?.message.includes('"turntable-front" (beauty)') === true,
      ],
      [
        "anUnstagedModelOwesNothing",
        () => asset({ consumed: [] }).length === 0,
      ],
      [
        "anUnaddressableModelIsSilent",
        () => asset({ fingerprint: null }).length === 0,
      ],
      ["assetDesignOwesNothing", () => asset({ scope: "design" }).length === 0],
    ]),
    {
      oneRefusal: true,
      code: true,
      blocking: true,
      phase: true,
      target: true,
      namesTheFrame: true,
      namesTheIdentity: true,
      completeIsSilent: true,
      maskNeedsCompleteSemanticEvidence: true,
      maskGapRemainsNamed: true,
      completeMaskIsHeld: true,
      passIsNotInterchangeable: true,
      timeIsNotInterchangeable: true,
      designOwesNothing: true,
      sourceOwesNothing: true,
      finalOwesPixels: true,
      unaddressableIsSilent: true,
      noDeclaredFrameOwesNothing: true,
      everyDeclaredPassIsOwed: true,
      boundedList: true,
      aDeclaredTimeResolvesOntoItsFrame: true,
      aDifferentFrameStillDoesNotDischarge: true,
      aTimePastTheEndClampsLikeCaptureDoes: true,
      assetOwesItsSet: true,
      assetTarget: true,
      assetNamesEveryView: true,
      aRigOwesItsExtremes: true,
      anUnriggedModelDoesNot: true,
      assetCompleteIsSilent: true,
      stagesAreConsumed: true,
      aBuildPathModelIsConsumed: true,
      anUnstagedRecipeIsNotConsumed: true,
      anOutlineViewIsNotSatisfiedByBeauty: true,
      aBeautyViewIsNotSatisfiedByOutline: true,
      anUnstagedModelOwesNothing: true,
      anUnaddressableModelIsSilent: true,
      assetDesignOwesNothing: true,
    },
  );
};
