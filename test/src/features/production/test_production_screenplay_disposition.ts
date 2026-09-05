import type {
  IAutoMovieDiagnostic,
  IAutoMovieScreenplayIndex,
  IAutoMovieScreenplayScene,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";
import path from "node:path";

import { loadSourceModule } from "../internal/loadSourceModule";
import { namedFacts } from "../internal/predicates";

const units = loadSourceModule<{
  screenplayDispositionDiagnostics: (props: {
    screenplay: IAutoMovieScreenplayIndex | null;
    scope: "design" | "source" | "review" | "final";
    prose: ReadonlySet<string>;
    realized: ReadonlySet<string>;
    observed: ReadonlySet<string>;
    edited: ReadonlySet<string>;
  }) => IAutoMovieDiagnostic[];
  screenplaySceneIncludedAtPhase: (
    scene: IAutoMovieScreenplayScene,
    phase: "screenplay" | "production" | "edit",
  ) => boolean;
}>(
  path.resolve(
    __dirname,
    "../../../../packages/production/src/production/screenplayDispositionDiagnostics.ts",
  ),
);

const scene = (
  patch?: Partial<IAutoMovieScreenplayScene>,
): IAutoMovieScreenplayScene => ({
  id: "SCN-1",
  title: "Scene",
  status: "active",
  covers: [],
  location: "LOC-1",
  storyTime: "unknown",
  participants: [],
  disposition: null,
  ...patch,
});

const index = (value: IAutoMovieScreenplayScene): IAutoMovieScreenplayIndex =>
  ({
    version: 2,
    production: "disposition",
    treatment: { path: "treatment.md", sequences: [] },
    screenplay: { path: "screenplay.md", lock: null, scenes: [value] },
    catalog: { characters: [], factions: [], locations: [] },
    continuity: [],
  }) as IAutoMovieScreenplayIndex;

const run = (props: {
  scene: IAutoMovieScreenplayScene;
  scope?: "design" | "source" | "review" | "final";
  prose?: boolean;
  realized?: boolean;
  observed?: boolean;
  edited?: boolean;
}): IAutoMovieDiagnostic[] =>
  units.screenplayDispositionDiagnostics({
    screenplay: index(props.scene),
    scope: props.scope ?? "final",
    prose: new Set(props.prose === false ? [] : ["SCN-1"]),
    realized: new Set(props.realized === false ? [] : ["SCN-1"]),
    observed: new Set(props.observed === false ? [] : ["SCN-1"]),
    edited: new Set(props.edited === false ? [] : ["SCN-1"]),
  });

/**
 * Pin the one disposition state model shared by screenplay, production and edit.
 *
 * Scenarios:
 * 1. Active and tombstone records select the correct phase denominators.
 * 2. Every phase-local disposition rejects a claim in that same phase.
 * 3. Blank reasons and double omission states fail immediately.
 * 4. Source, review and final scopes require realization, observation and edit respectively;
 *    only the source scope softens a missing realization to a warning.
 * 5. A tombstone with no downstream claim in any phase is clean, and a claim in
 *    the last phase alone still names the tombstone.
 */
export const test_production_screenplay_disposition = (): void => {
  const active = scene();
  const productionExempt = scene({
    disposition: { phase: "production", reason: "Archive only." },
  });
  const blank = run({
    scene: scene({
      disposition: { phase: "production", reason: " \t" },
    }),
    realized: false,
  });
  const tombstone = run({
    scene: scene({
      status: "OMITTED",
      disposition: { phase: "edit", reason: "Duplicate state." },
    }),
  });
  const phaseConflict = (phase: "screenplay" | "production" | "edit") =>
    run({
      scene: scene({ disposition: { phase, reason: "Phase exemption." } }),
    }).some(
      (diagnostic) => diagnostic.code === "screenplay-disposition-realized",
    );

  TestValidator.equals(
    "screenplay disposition is phase-local and fail-closed",
    namedFacts([
      [
        "nullIndexIsEmpty",
        () =>
          units.screenplayDispositionDiagnostics({
            screenplay: null,
            scope: "final",
            prose: new Set(),
            realized: new Set(),
            observed: new Set(),
            edited: new Set(),
          }).length === 0,
      ],
      [
        "activeBelongsToEveryPhase",
        () =>
          units.screenplaySceneIncludedAtPhase(active, "screenplay") &&
          units.screenplaySceneIncludedAtPhase(active, "production") &&
          units.screenplaySceneIncludedAtPhase(active, "edit"),
      ],
      [
        "dispositionExcludesOnlyItsPhase",
        () =>
          units.screenplaySceneIncludedAtPhase(
            productionExempt,
            "screenplay",
          ) &&
          units.screenplaySceneIncludedAtPhase(
            productionExempt,
            "production",
          ) === false &&
          units.screenplaySceneIncludedAtPhase(productionExempt, "edit"),
      ],
      ["screenplayClaimConflict", () => phaseConflict("screenplay")],
      ["productionClaimConflict", () => phaseConflict("production")],
      ["editClaimConflict", () => phaseConflict("edit")],
      [
        "blankReasonIsNamed",
        () =>
          blank.some(
            (diagnostic) =>
              diagnostic.code === "screenplay-disposition-reason-blank",
          ),
      ],
      [
        "tombstoneDoubleStateIsInvalid",
        () =>
          tombstone.some(
            (diagnostic) =>
              diagnostic.code === "screenplay-disposition-invalid",
          ),
      ],
      [
        "tombstoneDownstreamClaimIsInvalid",
        () =>
          tombstone.some(
            (diagnostic) => diagnostic.code === "screenplay-tombstone-realized",
          ),
      ],
      [
        "sourceUnrealizedWarns",
        () => {
          const diagnostic = run({
            scene: active,
            scope: "source",
            realized: false,
          }).find((entry) => entry.code === "screenplay-scene-unrealized");
          return diagnostic?.category === "warning";
        },
      ],
      [
        "reviewRequiresObservation",
        () =>
          run({ scene: active, scope: "review", observed: false }).some(
            (diagnostic) => diagnostic.code === "screenplay-scene-unobserved",
          ),
      ],
      [
        "finalRequiresEdit",
        () =>
          run({ scene: active, scope: "final", edited: false }).some(
            (diagnostic) => diagnostic.code === "screenplay-scene-unedited",
          ),
      ],
      ["completeFinalStatePasses", () => run({ scene: active }).length === 0],
      [
        "finalUnrealizedErrors",
        () =>
          run({ scene: active, realized: false }).find(
            (entry) => entry.code === "screenplay-scene-unrealized",
          )?.category === "error",
      ],
      [
        "tombstoneWithoutAnyClaimIsClean",
        () =>
          run({
            scene: scene({ status: "OMITTED" }),
            prose: false,
            realized: false,
            observed: false,
            edited: false,
          }).length === 0,
      ],
      [
        "tombstoneLateClaimIsStillInvalid",
        () =>
          run({
            scene: scene({ status: "OMITTED" }),
            prose: false,
            realized: false,
            observed: false,
          }).some(
            (diagnostic) => diagnostic.code === "screenplay-tombstone-realized",
          ),
      ],
    ]),
    {
      nullIndexIsEmpty: true,
      activeBelongsToEveryPhase: true,
      dispositionExcludesOnlyItsPhase: true,
      screenplayClaimConflict: true,
      productionClaimConflict: true,
      editClaimConflict: true,
      blankReasonIsNamed: true,
      tombstoneDoubleStateIsInvalid: true,
      tombstoneDownstreamClaimIsInvalid: true,
      sourceUnrealizedWarns: true,
      reviewRequiresObservation: true,
      finalRequiresEdit: true,
      completeFinalStatePasses: true,
      finalUnrealizedErrors: true,
      tombstoneWithoutAnyClaimIsClean: true,
      tombstoneLateClaimIsStillInvalid: true,
    },
  );
};
