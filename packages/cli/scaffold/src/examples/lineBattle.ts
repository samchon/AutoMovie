import {
  type IAutoMovieFirearmEvent,
  resolveFirearmVolley,
} from "@automovie/engine";
import type {
  IAutoMovieInstanceSetDesign,
  IAutoMovieModel,
  IAutoMovieProfile,
} from "@automovie/interface";

/**
 * Evidence-backed musket capability data for an agent-owned line-fire drill.
 *
 * The source observations and target-geometry caveats live in
 * `docs/historical-notes.md#starter-line-battle-values`; projects should
 * replace the scenario-level misfire rate when their weather, weapon, or supply
 * changes.
 */
export const lineInfantryProfile = (): IAutoMovieProfile => ({
  id: "line-infantry",
  name: "Line infantry musket drill",
  controls: [],
  drivers: [],
  limits: [],
  traits: [
    {
      kind: "shooter",
      weapons: [
        {
          kind: "firearm",
          id: "india-pattern-musket",
          reloadSeconds: 20,
          effectiveRange: 300,
          accuracy: [
            { distance: 0, probability: 0.58 },
            { distance: 100, probability: 0.0722 },
            { distance: 200, probability: 0.025 },
            { distance: 300, probability: 0 },
          ],
          misfireProbability: 0.05,
          muzzleVelocity: 305,
        },
      ],
    },
  ],
});

/** Resolve one reproducible 500-member volley into inspectable event data. */
export const lineVolley = (
  model: Pick<IAutoMovieModel, "id" | "profiles">,
  seed: number,
  distance: number,
): IAutoMovieFirearmEvent[] =>
  resolveFirearmVolley({
    model,
    profile: "line-infantry",
    weapon: "india-pattern-musket",
    seed,
    shooters: Array.from({ length: 500 }, (_, slot) => ({
      id: `ranker-${String(slot).padStart(3, "0")}`,
      distance,
    })),
  });

/** Non-formation civilians with reproducible scale, palette, and pace traits. */
export const civilianCrowd = (
  modelRecipe: string,
): IAutoMovieInstanceSetDesign => ({
  id: "civilian-crowd",
  modelRecipe,
  count: 100,
  layout: { kind: "scatter", radius: 14 },
  anchor: { x: 0, y: 0, z: 0 },
  facingDeg: 0,
  seed: 1_421,
  variation: {
    scale: { min: 0.92, max: 1.08 },
    palette: ["#805d45", "#a77b5b", "#5f7088"],
    traits: [{ name: "pace", min: 0.8, max: 1.2 }],
  },
});

/** Non-formation forest with 1,000 reproducibly varied tree proxies. */
export const treeScatter = (
  modelRecipe: string,
): IAutoMovieInstanceSetDesign => ({
  id: "tree-scatter",
  modelRecipe,
  count: 1_000,
  layout: { kind: "scatter", radius: 75 },
  anchor: { x: 0, y: 0, z: 0 },
  facingDeg: 0,
  seed: 1_435,
  variation: {
    scale: { min: 0.7, max: 1.35 },
    palette: ["#345b32", "#4f7138", "#6b7c3b"],
    traits: [{ name: "windPhase", min: 0, max: 1 }],
  },
});
