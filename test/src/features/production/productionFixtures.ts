import {
  IAutoMovieAcceptanceScenario,
  IAutoMovieAssetManifest,
  IAutoMovieCaptureRuntimeIdentity,
  IAutoMovieFormationDesign,
  IAutoMovieModelRecipe,
  IAutoMovieProductionDesign,
  IAutoMovieScreenplayIndex,
  IAutoMovieShotContract,
  IAutoMovieWorldDesign,
} from "@automovie/interface";
import {
  AUTOMOVIE_CAPTURE_RUNTIME_IDENTITY_PROTOCOL,
  AutoMovieProductionCompiler,
  AutoMovieProductionProject,
  canonicalAutoMovieCaptureRuntimeIdentity,
  canonicalizeAutoMovieJson,
  digestAutoMovieBytes,
} from "@automovie/production";
import { writeFiles } from "@automovie/template";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  completedFilmJson,
  renderCompletedFilmFixture,
} from "../internal/completedFilmFixture";

/** Preserve one compile attempt's diagnostics when a positive assertion fails. */
export const productionCompileSucceeded = (
  context: string,
  output: ReturnType<AutoMovieProductionCompiler["compile"]>,
): boolean => {
  if (output.success === false)
    console.error(
      `${context} compile diagnostics:\n${JSON.stringify(output.diagnostics, null, 2)}`,
    );
  return output.success;
};

class ProductionFixtureConstructionCleanupError extends AggregateError {}

/** Remove a partial fixture root without replacing its construction failure. */
export const throwProductionFixtureConstructionFailure = (
  failure: unknown,
  cleanup: () => unknown,
): never => {
  try {
    cleanup();
  } catch (cleanupFailure) {
    throw new ProductionFixtureConstructionCleanupError(
      [failure, cleanupFailure],
      "Production fixture construction and partial-root cleanup failed.",
    );
  }
  throw failure as Error;
};

/** Render the repository-only completed film into a disposable project root. */
export const productionFixture = (): {
  root: string;
  dispose: () => void;
} => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "automovie-production-"));
  try {
    const files = renderCompletedFilmFixture("fixture-film");
    const openingContract = shotContract();
    const assetManifest = JSON.parse(
      files["automovie/assets.json"]!,
    ) as IAutoMovieAssetManifest;
    for (const asset of assetManifest.assets)
      for (const use of asset.uses) use.production = "fixture-library";
    files["automovie/assets.json"] =
      `${JSON.stringify(assetManifest, null, 2)}\n`;
    for (const file of [
      "automovie/design/fixture-film/acceptance/answer-beauty.json",
      "automovie/design/fixture-film/acceptance/answer-gate-mask.json",
      "automovie/design/fixture-film/acceptance/answer-held-cue.json",
      "automovie/design/fixture-film/acceptance/opening-effect-mask.json",
      "automovie/design/shared/formations/chorus.json",
      "automovie/design/shared/models/chorus-far.json",
      "automovie/design/shared/models/chorus-hero.json",
      "automovie/design/shared/models/chorus-near.json",
      "automovie/design/fixture-film/shots/answer.json",
    ])
      delete files[file];
    // Dropping the answering shot leaves its scene without a realization, so
    // the screenplay index must say the omission is deliberate. That is what a
    // production-phase disposition is for, and recording it keeps this a
    // one-shot fixture rather than an incomplete film.
    const screenplay = JSON.parse(
      files["automovie/design/fixture-film/screenplay/index.json"]!,
    ) as IAutoMovieScreenplayIndex;
    for (const scene of screenplay.screenplay.scenes)
      if (scene.id === "SCN-002")
        scene.disposition = {
          phase: "production",
          reason:
            "The one-shot fixture keeps only the opening shot, so this scene is intentionally unrealized here.",
        };
    files["automovie/design/fixture-film/screenplay/index.json"] =
      `${JSON.stringify(screenplay, null, 2)}\n`;
    files["automovie/design/fixture-film/shots/opening.json"] =
      `${JSON.stringify(openingContract, null, 2)}\n`;
    files["src/shots/opening.ts"] = replaceScaffoldRegistrationContract({
      source: files["src/shots/opening.ts"]!,
      exportName: "opening",
      contract: definedShotContract(openingContract),
    });
    files["automovie/design/shared/world.json"] =
      `${JSON.stringify(fixtureWorldDesign(), null, 2)}\n`;
    const openingBeauty = JSON.parse(
      files["automovie/design/fixture-film/acceptance/opening-beauty.json"]!,
    ) as IAutoMovieAcceptanceScenario;
    if (openingBeauty.criterion.kind === "frame")
      openingBeauty.criterion.expectation =
        "The full performer and raised cue arm remain readable.";
    files["automovie/design/fixture-film/acceptance/opening-beauty.json"] =
      `${JSON.stringify(openingBeauty, null, 2)}\n`;
    files["automovie/design/fixture-film/production.json"] = `${JSON.stringify(
      oneShotProduction(
        JSON.parse(
          files["automovie/design/fixture-film/production.json"]!,
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
  } catch (error) {
    return throwProductionFixtureConstructionFailure(error, () =>
      fs.rmSync(root, { force: true, recursive: true }),
    );
  }
};

/**
 * Rewrite fixture source by anchor, refusing to return it unchanged.
 *
 * A case that arranges its own subject must fail when the arrangement fails.
 * `String.replace` answers a missing anchor by handing the input back, so the
 * case stays green and quietly starts asserting something else: the probe this
 * helper exists for stopped being injected the moment the shot moved its rig
 * lookup into a subject, and nothing went red.
 */
export const rewriteSource = (
  source: string,
  from: string,
  to: string,
): string => {
  const next = source.replace(from, to);
  if (next === source)
    throw new Error(
      `Fixture source no longer contains ${JSON.stringify(from)}.`,
    );
  return next;
};

const definedShotContract = (
  contract: IAutoMovieShotContract,
): Omit<IAutoMovieShotContract, "id" | "source"> => {
  const { id: _id, source: _source, ...registration } = contract;
  return registration;
};

const SCAFFOLD_REGISTRATION_BOUNDARIES = {
  opening: {
    registration: "OPENING_CONTRACT",
    nextDeclaration: "const ANSWER_CONTRACT: IAutoMovieDefinedShotContract = ",
  },
  answer: {
    registration: "ANSWER_CONTRACT",
    nextDeclaration: "const buildCue = (",
  },
} as const;

/**
 * Keep a sliced fixture's source-owned registration equal to its design.
 *
 * Exact markers make scaffold drift fail while constructing the fixture,
 * instead of silently turning every downstream source compile into a mismatch.
 */
const replaceScaffoldRegistrationContract = (props: {
  source: string;
  exportName: keyof typeof SCAFFOLD_REGISTRATION_BOUNDARIES;
  contract: Omit<IAutoMovieShotContract, "id" | "source">;
}): string => {
  const boundary = SCAFFOLD_REGISTRATION_BOUNDARIES[props.exportName];
  const startMarker = `const ${boundary.registration}: IAutoMovieDefinedShotContract = `;
  const endMarker = `\n};\n\n${boundary.nextDeclaration}`;
  const start = props.source.indexOf(startMarker);
  const end =
    start === -1
      ? -1
      : props.source.indexOf(endMarker, start + startMarker.length);
  if (
    start === -1 ||
    end === -1 ||
    props.source.indexOf(startMarker, start + startMarker.length) !== -1 ||
    props.source.indexOf(endMarker, end + endMarker.length) !== -1
  )
    throw new Error(
      `Scaffold source must contain exactly one ${boundary.registration} registration followed immediately by ${boundary.nextDeclaration}.`,
    );
  return [
    props.source.slice(0, start + startMarker.length),
    JSON.stringify(props.contract, null, 2),
    props.source.slice(end + 2),
  ].join("");
};

/**
 * Mutate one fixture contract and its source registration as one test action.
 *
 * Custom source modules remain test-owned; the shared completed-film module
 * supports its two published exports and rejects any unexpected binding.
 */
export const setProductionFixtureShotContract = (
  project: AutoMovieProductionProject,
  contract: IAutoMovieShotContract,
): ReturnType<AutoMovieProductionProject["setShotContract"]> => {
  const result = project.setShotContract(contract);
  if (
    result.accepted === false ||
    contract.source.module !== "src/shots/opening.ts"
  )
    return result;
  if (
    contract.source.export !== "opening" &&
    contract.source.export !== "answer"
  )
    throw new Error(
      `Completed-film fixture source has no supported "${contract.source.export}" registration.`,
    );
  const sourcePath = path.join(project.root, contract.source.module);
  fs.writeFileSync(
    sourcePath,
    replaceScaffoldRegistrationContract({
      source: fs.readFileSync(sourcePath, "utf8"),
      exportName: contract.source.export,
      contract: definedShotContract(contract),
    }),
  );
  // The one-shot fixture exempts the scene it does not shoot. Restoring that
  // shot restores the work the exemption denies, and a ledger asserting both
  // absence and realization contradicts itself, so the exemption goes with it.
  if (contract.source.export === "answer")
    liftFixtureSceneDisposition(project.root, "SCN-002");
  return result;
};

/** Reactivate a fixture scene whose shot has been restored. */
export const liftFixtureSceneDisposition = (
  root: string,
  sceneId: string,
): void => {
  const file = [
    path.join(root, "automovie/design/fixture-film/screenplay/index.json"),
    path.join(root, "automovie/design/screenplay/index.json"),
  ].find((candidate) => fs.existsSync(candidate));
  if (file === undefined) return;
  const index = JSON.parse(
    fs.readFileSync(file, "utf8"),
  ) as IAutoMovieScreenplayIndex;
  for (const scene of index.screenplay.scenes)
    if (scene.id === sceneId) scene.disposition = null;
  fs.writeFileSync(
    file,
    `${JSON.stringify(index, null, 2)}
`,
  );
};

/** Completed regression-film design with optional shallow overrides. */
export const productionDesign = (
  overrides: Partial<IAutoMovieProductionDesign> = {},
): IAutoMovieProductionDesign => ({
  ...oneShotProduction(
    completedFilmJson<IAutoMovieProductionDesign>(
      "automovie/design/{{name}}/production.json",
    ),
  ),
  id: "fixture-film",
  title: "fixture-film",
  ...overrides,
});

/**
 * Author a second production's screenplay ledger beside the fixture's own.
 *
 * Scene numbers are production-scoped, so a second production's shots cannot
 * join to the first one's ledger and the compiler refuses shot contracts whose
 * upstream slot is absent. The registry fixture keeps one shot, exactly as the
 * main fixture does, so only the scene it does not shoot is exempted: an
 * exemption over a scene a shot actually realizes asserts both absence and
 * realized work.
 */
export const writeProductionScreenplay = (props: {
  root: string;
  productionId: string;
}): void => {
  // Render under this production's own name so the index carries its actual
  // production id. Both disposable productions intentionally reuse the same
  // completed-film authored documents already present at the index's
  // `docs/treatments` and
  // `docs/screenplays` paths; this helper adds only the second tracked index.
  const rendered = renderCompletedFilmFixture(props.productionId);
  const index = JSON.parse(
    rendered[`automovie/design/${props.productionId}/screenplay/index.json`]!,
  ) as IAutoMovieScreenplayIndex;
  const files: Record<string, string> = {
    [`automovie/design/${props.productionId}/screenplay/index.json`]: `${JSON.stringify(
      {
        ...index,
        screenplay: {
          ...index.screenplay,
          scenes: index.screenplay.scenes.map((scene) => ({
            ...scene,
            disposition:
              scene.id === "SCN-002"
                ? {
                    phase: "production" as const,
                    reason:
                      "This fixture keeps only the opening shot, so this scene is intentionally unrealized here.",
                  }
                : null,
          })),
        },
      },
      null,
      2,
    )}
`,
  };
  // `writeFiles` refuses a populated root, and this always writes into a
  // fixture that already exists.
  for (const [file, content] of Object.entries(files)) {
    const target = path.join(props.root, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  }
};

const oneShotProduction = (
  production: IAutoMovieProductionDesign,
): IAutoMovieProductionDesign => ({
  ...production,
  logline: "A primitive performer raises a cue in one deterministic fixture.",
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

/** Completed-film primitive model recipe. */
export const modelRecipe = (): IAutoMovieModelRecipe =>
  completedFilmJson("automovie/design/shared/models/soloist.json");

/** Completed-film world design. */
export const worldDesign = (): IAutoMovieWorldDesign =>
  completedFilmJson("automovie/design/shared/world.json");

/**
 * Completed-film world restricted to the slice `productionFixture` writes.
 *
 * The disposable root drops the effect recipes and zones so the services under
 * test read a small deterministic graph. A test that rewrites the world and
 * means to put it back has to restore this slice: installing the full fixture
 * world instead changes the design, and every render bundle bound to the old
 * one stops matching for good.
 */
export const fixtureWorldDesign = (): IAutoMovieWorldDesign => ({
  ...worldDesign(),
  effectRecipes: [],
  effectZones: [],
});

/**
 * Completed-film shot contract restricted to its named actor.
 *
 * `productionFixture` renders the one-actor slice of the completed fixture: the
 * instanced formation, its LOD recipes and its effect-mask acceptance stay out,
 * so the production services under test have a small deterministic graph. The
 * in-memory contract has to describe that same slice, or every consumer that
 * pairs it with a fixture project resolves a formation the project does not
 * own. Tests that want the completed instanced group drive the repository-only
 * fixture directly.
 */
export const shotContract = (): IAutoMovieShotContract => {
  const contract = completedFilmJson<IAutoMovieShotContract>(
    "automovie/design/{{name}}/shots/opening.json",
  );
  return {
    ...contract,
    participants: contract.participants.filter(
      (participant) => participant.kind !== "formation",
    ),
    camera: {
      ...contract.camera,
      requiredSubjects: contract.camera.requiredSubjects.filter(
        (subject) => subject !== "chorus",
      ),
    },
  };
};

/** Completed-film acceptance scenarios. */
export const acceptanceScenarios = (): IAutoMovieAcceptanceScenario[] => [
  completedFilmJson("automovie/design/{{name}}/acceptance/opening-beauty.json"),
  completedFilmJson("automovie/design/{{name}}/acceptance/opening-pose.json"),
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
  modelRecipe: "soloist",
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
): IAutoMovieCaptureRuntimeIdentity => {
  const packages = [
    "@automovie/engine",
    "@automovie/viewer",
    "playwright",
    "playwright-core",
    "three",
    "vite",
  ].map((name, index) => ({
    package: name,
    version: "1.0.0",
    contentDigest:
      `sha256:${String(index + 2).repeat(64)}` as `sha256:${string}`,
    files: 1,
    bytes: 1,
  }));
  const browserSupport = {
    status: "content-sealed" as const,
    source: "package-owned" as const,
    contentDigest: `sha256:${"8".repeat(64)}` as `sha256:${string}`,
    files: 1,
    bytes: 1,
  };
  const closureBasis = {
    protocolVersion: "automovie.capture-runtime-closure.v1" as const,
    packages,
    browserSupport,
  };
  return {
    protocolVersion: AUTOMOVIE_CAPTURE_RUNTIME_IDENTITY_PROTOCOL,
    playwright: {
      package: "playwright",
      version: "1.60.0",
    },
    runtimeClosure: {
      ...closureBasis,
      contentDigest: digestAutoMovieBytes(
        Buffer.from(canonicalizeAutoMovieJson(closureBasis), "utf8"),
      ),
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
  };
};

/** Canonical manifest encoding of the stable capture fixture identity. */
export const testRendererIdentity = (
  browserVersion = "148.0.7778.96",
): string =>
  canonicalAutoMovieCaptureRuntimeIdentity(
    testCaptureRuntimeIdentity(browserVersion),
  );
