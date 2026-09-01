import type { IAutoMovieProductionEvidence } from "@automovie/evidence";
import { renderAutoMovieProductionRouter } from "@automovie/template";
import assert from "node:assert/strict";

/**
 * The generated router says only what the selected production actually owns.
 *
 * Scenarios:
 *
 * 1. A model library lists its exact owner units, manifest-derived source
 *    population, shared routes, and local contract items without a film ladder.
 * 2. Film and brief routers state only their own refinement path.
 * 3. An unselected project reports no active route, while empty and pre-source
 *    owner populations remain explicit rather than disappearing.
 */
export const test_template_production_router = (): void => {
  const base = {
    root: "/production",
    packageName: "exact-production",
    description: "One exact production.",
    configuration: {} as IAutoMovieProductionEvidence["configuration"],
    designBranches: [],
    contracts: [],
  } satisfies Omit<IAutoMovieProductionEvidence, "designOwners" | "manifest">;

  const library = renderAutoMovieProductionRouter({
    ...base,
    manifest: {
      kind: "library",
      populationScope: { mode: "complete-production" },
      branches: [
        { name: "settings", stage: "review" },
        { name: "models", stage: "review" },
        { name: "modelSources", stage: "draft" },
      ],
      bindings: [
        {
          branch: "models",
          stage: "review",
          enforced: true,
          claim: "models answer their principles",
          relationship: "checklist",
          host: {
            type: "markdown",
            root: "docs",
            files: ["models/**/*.md"],
            symbols: ["h2"],
          },
          target: {
            type: "contract",
            family: "principles",
            domain: "design",
            path: "principles/design/models.md",
            anchors: ["model-information-structure"],
          },
        },
        {
          branch: "settings",
          stage: "review",
          enforced: true,
          claim: "settings answer their principles",
          relationship: "checklist",
          host: {
            type: "markdown",
            root: "docs",
            files: ["settings/**/*.md"],
            symbols: ["h2"],
          },
          target: {
            type: "contract",
            family: "principles",
            domain: "core",
            path: "principles/core/settings.md",
            anchors: ["information-structure"],
          },
        },
        {
          branch: "models",
          stage: "review",
          enforced: true,
          claim: "model units cover their principles",
          relationship: "distributed-coverage",
          host: {
            type: "markdown",
            root: "docs",
            files: ["models/**/*.md"],
            symbols: ["h2"],
          },
          target: {
            type: "contract",
            family: "principles",
            domain: "design",
            path: "principles/design/models.md",
            anchors: ["model-information-structure"],
          },
        },
        {
          branch: "modelSources",
          stage: "draft",
          enforced: false,
          claim: "model sources realize model owners",
          relationship: "lineage",
          host: {
            type: "typescript",
            root: ".",
            files: ["src/models/**/*.ts"],
            symbols: ["type"],
          },
          target: {
            type: "population",
            root: "docs",
            files: ["models/**/*.md"],
            symbols: ["file"],
          },
        },
        {
          branch: "settings",
          stage: "review",
          enforced: true,
          claim: "settings `foundation` fallback",
          relationship: "foundation",
          host: {
            type: "markdown",
            root: "docs",
            files: [],
            symbols: [],
          },
          target: {
            type: "contract",
            family: "principles",
            domain: "core",
            path: "principles/core/common.md",
            anchors: [],
          },
        },
      ],
    },
    designOwners: [
      {
        branch: "models",
        path: "docs/models/chair.md",
        title: "Chair",
        units: [{ anchor: "frame", title: "Frame", digest: "a".repeat(64) }],
        sourceBinding: {
          branch: "modelSources",
          stage: "draft",
          enforced: false,
          root: ".",
          files: ["src/models/**/*.ts"],
          symbols: ["type"],
          paths: ["src/models/chair.ts"],
        },
      },
      {
        branch: "models",
        path: "docs/models/pending.md",
        title: "Pending",
        units: [],
        sourceBinding: null,
      },
    ],
    contracts: [
      {
        path: "docs/contracts/profile (one).md",
        title: "Profile [contract]",
        items: [
          {
            anchor: "profile:v2",
            title: "Profile [v2]",
            digest: "b".repeat(64),
          },
        ],
      },
      {
        path: "docs/contracts/index.md",
        title: "Contract audit",
        items: [],
      },
    ],
  });
  assert.match(library, /This is a library/u);
  assert.match(
    library,
    /Active branches: `settings` \(`review`\), `models` \(`review`\), `modelSources` \(`draft`\)\./u,
  );
  assert.match(library, /`models` \[Chair\]\(docs\/models\/chair\.md\)/u);
  assert.match(
    library,
    /source branch `modelSources` selects 1 current source file/u,
  );
  assert.match(library, /source authorship has not started/u);
  assert.equal(
    library.match(
      /contract `principles\/design\/models\.md#model-information-structure`/gu,
    )?.length,
    2,
  );
  assert.match(
    library,
    /Branch `models` \(`review`, enforced\) uses `checklist`: markdown host root `docs`, files `models\/\*\*\/\*\.md`, symbols `h2` -> contract `principles\/design\/models\.md#model-information-structure`; claim `models answer their principles`\./u,
  );
  assert.match(
    library,
    /Branch `models` \(`review`, enforced\) uses `distributed-coverage`:[^\n]+contract `principles\/design\/models\.md#model-information-structure`/u,
  );
  assert.match(
    library,
    /Branch `modelSources` \(`draft`, not yet enforced\) uses `lineage`: typescript host root `\.`, files `src\/models\/\*\*\/\*\.ts`, symbols `type` -> population root `docs`, files `models\/\*\*\/\*\.md`, symbols `file`/u,
  );
  assert.match(
    library,
    /uses `foundation`: markdown host root `docs`, files \(none\), symbols \(none\) -> contract `principles\/core\/common\.md`; claim `settings %60foundation%60 fallback`/u,
  );
  assert.match(
    library,
    /\[Profile \\\[v2\\\]\]\(docs\/contracts\/profile%20%28one%29\.md#profile%3Av2\)/u,
  );
  assert.match(library, /has no H2 contract item/u);
  assert.doesNotMatch(library, /settings -> treatments/u);
  for (const skill of [
    "evidence-graph",
    "production-lifecycle",
    "review-verification",
    "source-authoring",
  ])
    assert.match(library, new RegExp(`skills/${skill}/SKILL\\.md`, "u"));
  assert.match(library, /Reusable contracts live in this project's own/u);
  assert.doesNotMatch(
    library,
    /node_modules|arrive through `@automovie\/template`/u,
  );

  const film = renderAutoMovieProductionRouter({
    ...base,
    manifest: {
      kind: "film",
      populationScope: { mode: "complete-production" },
      branches: [],
      bindings: [],
    },
    designOwners: [],
  });
  assert.match(
    film,
    /settings -> treatments -> scripts -> screenplays -> shots -> filmSources/u,
  );
  assert.doesNotMatch(film, /settings -> briefs/u);
  assert.match(film, /No active design owner is present/u);
  assert.match(film, /owns no local contract document/u);

  const brief = renderAutoMovieProductionRouter({
    ...base,
    manifest: {
      kind: "brief",
      populationScope: { mode: "complete-production" },
      branches: [],
      bindings: [],
    },
    designOwners: [],
  });
  assert.match(brief, /settings -> briefs -> shots -> filmSources/u);
  assert.doesNotMatch(brief, /settings -> treatments/u);

  const unselected = renderAutoMovieProductionRouter({
    ...base,
    description: "",
    manifest: {
      kind: null,
      populationScope: { mode: "complete-production" },
      branches: [],
      bindings: [],
    },
    designOwners: [],
  });
  assert.match(unselected, /No production kind is selected/u);
  assert.match(unselected, /No authored branch is active yet/u);
  assert.match(unselected, /No shared contract route is active/u);
  assert.match(unselected, /Select a production kind before beginning/u);
};
