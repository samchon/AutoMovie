import {
  renderScaffold,
  scaffoldAssetDirectory,
  writeFiles,
} from "@automovie/cli";
import {
  IAutoMovieAcceptanceScenario,
  IAutoMovieFormationDesign,
  IAutoMovieModelRecipe,
  IAutoMovieProductionDesign,
  IAutoMovieShotContract,
  IAutoMovieWorldDesign,
} from "@automovie/interface";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/** Render the published starter shape into a disposable production root. */
export const productionFixture = (): {
  root: string;
  dispose: () => void;
} => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "automovie-production-"));
  const files = renderScaffold({ name: "fixture-film" });
  for (const file of [
    ".automovie/design/acceptance/answer-beauty.json",
    ".automovie/design/acceptance/answer-pose.json",
    ".automovie/design/shots/answer.json",
  ])
    delete files[file];
  files[".automovie/design/production.json"] = `${JSON.stringify(
    oneShotProduction(
      JSON.parse(
        files[".automovie/design/production.json"]!,
      ) as IAutoMovieProductionDesign,
    ),
    null,
    2,
  )}\n`;
  files["src/film.ts"] =
    '/** Stable ordered shot ids in finished-film order. */\nexport const film = ["opening"] as const;\n';
  writeFiles(root, files);
  return {
    root,
    dispose: () => fs.rmSync(root, { force: true, recursive: true }),
  };
};

const scaffoldJson = <T>(relative: string): T =>
  JSON.parse(
    fs.readFileSync(path.resolve(scaffoldAssetDirectory(), relative), "utf8"),
  ) as T;

/** Starter production design with optional shallow overrides. */
export const productionDesign = (
  overrides: Partial<IAutoMovieProductionDesign> = {},
): IAutoMovieProductionDesign => ({
  ...oneShotProduction(
    scaffoldJson<IAutoMovieProductionDesign>(
      ".automovie/design/production.json",
    ),
  ),
  id: "fixture-film",
  title: "fixture-film",
  ...overrides,
});

const oneShotProduction = (
  production: IAutoMovieProductionDesign,
): IAutoMovieProductionDesign => ({
  ...production,
  logline: "A primitive sentinel raises a signal in one deterministic fixture.",
  targetRuntimeSeconds: 6,
  frameFormat: {
    ...production.frameFormat,
    width: 16,
    height: 16,
  },
  deliverables: production.deliverables.map((deliverable) => ({
    ...deliverable,
    required: false,
  })),
});

/** Starter primitive model recipe. */
export const modelRecipe = (): IAutoMovieModelRecipe =>
  scaffoldJson(".automovie/design/models/sentinel.json");

/** Starter world design. */
export const worldDesign = (): IAutoMovieWorldDesign =>
  scaffoldJson(".automovie/design/world.json");

/** Starter shot contract. */
export const shotContract = (): IAutoMovieShotContract =>
  scaffoldJson(".automovie/design/shots/opening.json");

/** Starter acceptance scenarios. */
export const acceptanceScenarios = (): IAutoMovieAcceptanceScenario[] => [
  scaffoldJson(".automovie/design/acceptance/opening-beauty.json"),
  scaffoldJson(".automovie/design/acceptance/opening-pose.json"),
];

/** Compact valid formation covering formation-dependent services. */
export const formationDesign = (
  layout: IAutoMovieFormationDesign["layout"] = {
    kind: "line",
    ranks: 2,
    files: 3,
  },
): IAutoMovieFormationDesign => ({
  id: "line",
  modelRecipe: "sentinel",
  count: 6,
  layout,
  spacing: { lateral: 0.8, depth: 0.9 },
  anchor: { x: 0, y: 0, z: 0 },
  facingDeg: 0,
  seed: 7,
  capabilities: ["hold", "advance"],
  heroOverrides: [{ slot: 0, actor: "captain" }],
});
