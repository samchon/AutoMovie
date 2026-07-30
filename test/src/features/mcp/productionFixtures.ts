import {
  renderScaffold,
  scaffoldAssetDirectory,
  writeFiles,
} from "@automovie/cli";
import {
  IAutoMovieAcceptanceScenario,
  IAutoMovieAssetManifest,
  IAutoMovieCaptureRuntimeIdentity,
  IAutoMovieFormationDesign,
  IAutoMovieModelRecipe,
  IAutoMovieProductionDesign,
  IAutoMovieShotContract,
  IAutoMovieWorldDesign,
} from "@automovie/interface";
import { canonicalAutoMovieCaptureRuntimeIdentity } from "@automovie/mcp";
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
  const assetManifest = JSON.parse(
    files[".automovie/assets.json"]!,
  ) as IAutoMovieAssetManifest;
  for (const asset of assetManifest.assets)
    for (const use of asset.uses) use.production = "fixture-library";
  files[".automovie/assets.json"] =
    `${JSON.stringify(assetManifest, null, 2)}\n`;
  for (const file of [
    ".automovie/design/acceptance/answer-beauty.json",
    ".automovie/design/acceptance/answer-pose.json",
    ".automovie/design/acceptance/opening-effect-mask.json",
    ".automovie/design/formations/army.json",
    ".automovie/design/models/army-far.json",
    ".automovie/design/models/army-hero.json",
    ".automovie/design/models/army-near.json",
    ".automovie/design/shots/answer.json",
  ])
    delete files[file];
  files[".automovie/design/shots/opening.json"] =
    `${JSON.stringify(shotContract(), null, 2)}\n`;
  files[".automovie/design/world.json"] =
    `${JSON.stringify(fixtureWorldDesign(), null, 2)}\n`;
  const openingBeauty = JSON.parse(
    files[".automovie/design/acceptance/opening-beauty.json"]!,
  ) as IAutoMovieAcceptanceScenario;
  if (openingBeauty.criterion.kind === "frame")
    openingBeauty.criterion.expectation =
      "The full sentinel and raised signal arm remain readable.";
  files[".automovie/design/acceptance/opening-beauty.json"] =
    `${JSON.stringify(openingBeauty, null, 2)}\n`;
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
    `import type { IAutoMovieFilmSource } from "@automovie/interface";

export const film = {
  build(context) {
    return {
      id: context.production.id,
      omissions: [],
      tracks: {
        video: [{
          shot: "opening",
          sourceIn: { frame: 0 },
          sourceOut: { seconds: 6 },
          start: { frame: 0 },
          handles: { head: { frame: 0 }, tail: { frame: 0 } },
          transitionIn: { kind: "cut" },
          transitionOut: { kind: "cut" },
        }],
        audio: [],
        captions: [],
        effects: [],
      },
    };
  },
} satisfies IAutoMovieFilmSource;
`;
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

/**
 * Starter world restricted to the slice `productionFixture` writes.
 *
 * The disposable root drops the effect recipes and zones so the services under
 * test read a small deterministic graph. A test that rewrites the world and
 * means to put it back has to restore this slice: installing the full starter
 * world instead changes the design, and every render bundle bound to the old
 * one stops matching for good.
 */
export const fixtureWorldDesign = (): IAutoMovieWorldDesign => ({
  ...worldDesign(),
  effectRecipes: [],
  effectZones: [],
});

/**
 * Starter shot contract restricted to its named actor.
 *
 * `productionFixture` renders the one-actor slice of the starter: the army
 * formation, its LOD recipes and its effect-mask acceptance stay out so the
 * production services under test have a small deterministic graph. The
 * in-memory contract has to describe that same slice, or every consumer that
 * pairs it with a fixture project resolves a formation the project does not
 * own. Tests that want the shipped instanced army drive the scaffold directly.
 */
export const shotContract = (): IAutoMovieShotContract => {
  const contract = scaffoldJson<IAutoMovieShotContract>(
    ".automovie/design/shots/opening.json",
  );
  return {
    ...contract,
    participants: contract.participants.filter(
      (participant) => participant.kind !== "formation",
    ),
  };
};

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
    spacing: { lateral: 0.8, depth: 0.9 },
  },
): IAutoMovieFormationDesign => ({
  id: "line",
  modelRecipe: "sentinel",
  count: 6,
  layout,
  anchor: { x: 0, y: 0, z: 0 },
  facingDeg: 0,
  seed: 7,
  capabilities: ["hold", "advance"],
  heroOverrides: [{ slot: 0, actor: "captain" }],
});

/** Stable structured capture-runtime identity for production test fixtures. */
export const testCaptureRuntimeIdentity = (
  browserVersion = "148.0.7778.96",
): IAutoMovieCaptureRuntimeIdentity => ({
  protocolVersion: "automovie.capture-runtime.v1",
  playwright: {
    package: "playwright",
    version: "1.60.0",
  },
  browser: {
    product: "chromium",
    version: browserVersion,
    revision: "1223",
    source: "package-owned",
    executableDigest: `sha256:${"1".repeat(64)}` as `sha256:${string}`,
  },
  platform: {
    os: "test",
    arch: "test",
  },
  mode: {
    headless: "chromium",
    deviceScaleFactor: 1,
  },
  graphics: {
    requestedBackend: "angle:swiftshader",
    api: "webgl2",
    vendor: "AutoMovie Test Vendor",
    renderer: "AutoMovie Test Renderer",
  },
});

/** Canonical manifest encoding of the stable capture fixture identity. */
export const testRendererIdentity = (
  browserVersion = "148.0.7778.96",
): string =>
  canonicalAutoMovieCaptureRuntimeIdentity(
    testCaptureRuntimeIdentity(browserVersion),
  );
