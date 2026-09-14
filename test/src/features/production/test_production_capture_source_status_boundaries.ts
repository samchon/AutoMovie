import type {
  AutoMovieContentDigest,
  AutoMovieProductionFrameCapture,
  IAutoMovieBuildProjectOutput,
  IAutoMovieCaptureFrame,
  IAutoMovieCaptureRuntimeIdentity,
  IAutoMovieGeneratedManifest,
  IAutoMovieRenderBundleManifest,
} from "@automovie/interface";
import type {
  AutoMovieProductionContext,
  AutoMovieProductionOracleService,
  IAutoMovieProductionServices,
} from "@automovie/production";
import { TestValidator } from "@nestia/e2e";
import { createHash } from "node:crypto";
import path from "node:path";

import { loadSourceModule } from "../internal/loadSourceModule";
import {
  SCREENPLAY_DOCUMENT,
  createSourceStatusWorld,
  fingerprintOf,
  productionModule,
  textDigest,
} from "./sourceStatusFixtures";

const { captureAutoMovieProductionFrame } = loadSourceModule<{
  captureAutoMovieProductionFrame(
    context: AutoMovieProductionContext,
    props: IAutoMovieCaptureFrame.IProps,
  ): Promise<IAutoMovieCaptureFrame>;
}>(productionModule("captureProductionFrame.ts"));
const { AutoMovieProductionOracleService: OracleService } = loadSourceModule<{
  AutoMovieProductionOracleService: new (
    project: object,
    capture: AutoMovieProductionFrameCapture,
    buildStatus: () => IAutoMovieBuildProjectOutput,
  ) => AutoMovieProductionOracleService;
}>(productionModule("AutoMovieProductionOracleService.ts"));
const { AutoMovieProductionInputRaceError } = loadSourceModule<{
  AutoMovieProductionInputRaceError: new (message: string) => Error;
}>(productionModule("AutoMovieProductionProject.ts"));
const { residentPngJs } = loadSourceModule<{
  residentPngJs(): {
    PNG: {
      new (options: { width: number; height: number }): { data: Buffer };
      sync: { write(png: { data: Buffer }): Buffer };
    };
  };
}>(productionModule("residentCodecs.ts"));
const { canonicalizeAutoMovieJson } = loadSourceModule<{
  canonicalizeAutoMovieJson(value: unknown): string;
}>(productionModule("contentIdentity.ts"));

const ROOT = path.join(path.parse(process.cwd()).root, "workspace", "harbor");
const EDITED = "export const opening = defineShot({ beats: 9 });\n";

const REQUEST: IAutoMovieCaptureFrame.IProps = {
  target: {
    kind: "shot",
    productionId: "harbor",
    id: "opening",
    time: 0.5,
    pass: "beauty",
  },
};

const bytesDigest = (bytes: Uint8Array): AutoMovieContentDigest =>
  `sha256:${createHash("sha256").update(bytes).digest("hex")}`;

/** A complete, canonical package-owned Chromium capture identity. */
const runtimeIdentityOf = (): IAutoMovieCaptureRuntimeIdentity => {
  const packages = [
    "@automovie/engine",
    "@automovie/viewer",
    "playwright",
    "playwright-core",
    "three",
    "vite",
  ].map((name) => ({
    package: name,
    version: "1.0.0",
    contentDigest: textDigest(`installed ${name}`),
    files: 4,
    bytes: 4096,
  }));
  const browserSupport = {
    status: "content-sealed" as const,
    source: "package-owned" as const,
    contentDigest: textDigest("chromium support files"),
    files: 2,
    bytes: 2048,
  };
  const protocolVersion = "automovie.capture-runtime-closure.v1" as const;
  return {
    protocolVersion: "automovie.capture-runtime.v2",
    playwright: { package: "playwright", version: "1.0.0" },
    runtimeClosure: {
      protocolVersion,
      contentDigest: textDigest(
        canonicalizeAutoMovieJson({
          protocolVersion,
          packages,
          browserSupport,
        }),
      ),
      packages,
      browserSupport,
    },
    browser: {
      product: "chromium",
      version: "126.0.0.0",
      revision: "1124",
      source: "package-owned",
      executableDigest: textDigest("chromium executable"),
    },
    platform: { os: "linux", arch: "x64" },
    mode: { headless: "chromium", deviceScaleFactor: 1 },
    graphics: {
      requestedBackend: "swiftshader",
      api: "webgl2",
      vendor: "Google Inc.",
      renderer: "ANGLE (SwiftShader)",
    },
  };
};

/** A 4x4 checkerboard PNG, so the frame has visible pixel variance. */
const pngOf = (): Buffer => {
  const { PNG } = residentPngJs();
  const png = new PNG({ width: 4, height: 4 });
  for (let offset = 0; offset < png.data.length; offset += 4) {
    const lit = (offset / 4) % 2 === 0;
    png.data[offset] = lit ? 220 : 20;
    png.data[offset + 1] = lit ? 180 : 40;
    png.data[offset + 2] = lit ? 90 : 60;
    png.data[offset + 3] = 255;
  }
  return PNG.sync.write(png);
};

/**
 * One production, one retained source status and the real capture path over
 * an in-memory project store.
 *
 * The store keeps the generated manifest and registry of the world's current
 * compile, commits a render bundle the way the project commit lock does, by
 * confirming the capture's inputs before and after applying it and advancing
 * the revision, and serves the committed manifest back. Hooks place an edit at
 * the moment the host draws, between applying the bundle and the post-apply
 * check, and just before the receipt is reopened.
 */
const harnessOf = () => {
  const world = createSourceStatusWorld();
  const hooks = {
    draw: (): void => undefined,
    applied: (): void => undefined,
    reopen: (): void => undefined,
  };
  const bundles = new Map<string, IAutoMovieRenderBundleManifest>();
  let committed = false;
  const renderRoot = path.join(ROOT, "renders", "harbor");
  const registryBytes = (): Buffer =>
    Buffer.from(
      JSON.stringify({
        version: 2,
        builder: "unit",
        productionId: "harbor",
        inputFingerprint: fingerprintOf(world.state.compiled),
        assets: [],
        shots: [{ id: "opening", path: "shots/opening.json" }],
        film: null,
      }),
      "utf8",
    );
  const project = {
    root: ROOT,
    productionId: "harbor",
    generatedManifest: (): IAutoMovieGeneratedManifest => ({
      version: 1,
      builder: { packageVersion: "0.1.0", protocolVersion: "unit" },
      inputFingerprint: fingerprintOf(world.state.compiled),
      files: [
        {
          path: "manifests/compile.json",
          owner: "builder",
          digest: bytesDigest(registryBytes()),
          sourceTargets: ["registry"],
        },
        {
          path: "shots/opening.json",
          owner: "builder",
          digest: textDigest(world.state.generated),
          sourceTargets: ["shot:opening"],
        },
      ],
    }),
    readGeneratedFile: (file: string): Uint8Array =>
      file === "manifests/compile.json"
        ? registryBytes()
        : Buffer.from(world.state.generated, "utf8"),
    trackedStatePath: (file: string): string =>
      path.join(ROOT, "automovie", "productions", "harbor", file),
    graph: () => ({
      production: { frameFormat: { width: 4, height: 4, fps: 24 } },
      models: new Map(),
      world: null,
      formations: new Map(),
      shots: new Map([["opening", { durationSeconds: 2 }]]),
      acceptance: new Map(),
    }),
    contentInputs: () => [
      {
        path: "viewer/main.ts",
        source: false,
        render: true,
        bytes: Buffer.from("export {};\n", "utf8"),
      },
    ],
    renderRoot: (): string => renderRoot,
    verifiedRenderManifest: (
      manifestPath: string,
    ): IAutoMovieRenderBundleManifest | null => {
      const found = bundles.get(path.resolve(manifestPath));
      if (found === undefined) return null;
      if (committed) {
        committed = false;
        hooks.reopen();
      }
      return structuredClone(found);
    },
    commitRenderBundle: (
      relativeBundle: string,
      _files: ReadonlyMap<string, Uint8Array>,
      manifest: IAutoMovieRenderBundleManifest,
      inputCurrent?: () => boolean,
    ): number => {
      if (inputCurrent?.() === false)
        throw new AutoMovieProductionInputRaceError(
          "Production inputs changed before the guarded commit began.",
        );
      hooks.applied();
      if (inputCurrent?.() === false)
        throw new AutoMovieProductionInputRaceError(
          "Production inputs changed while the guarded commit was being applied.",
        );
      bundles.set(
        path.resolve(renderRoot, ...relativeBundle.split("/"), "manifest.json"),
        structuredClone(manifest),
      );
      committed = true;
      world.state.revision += 1;
      return world.state.revision;
    },
  };
  const draw: AutoMovieProductionFrameCapture = (input) => {
    hooks.draw();
    return Promise.resolve({
      bytes: pngOf(),
      dialogueRuntimeIdentity: null,
      runtimeIdentity: runtimeIdentityOf(),
      width: input.width ?? 4,
      height: input.height ?? 4,
      observation: {
        status: "not-run",
        reason: "the unit capture draws no render observation",
      },
      semanticMask: {
        status: "not-run",
        reason: "the unit capture draws no semantic mask",
      },
    });
  };
  const buildStatus = world.status();
  const services = {
    project,
    buildStatus,
    oracle: new OracleService(project, draw, buildStatus),
  } as unknown as IAutoMovieProductionServices;
  const context = {
    forProduction: () => services,
  } as unknown as AutoMovieProductionContext;
  const capture = async () => {
    const runs = world.counts.evaluations;
    const reads = world.counts.acquisitions;
    const result = await captureAutoMovieProductionFrame(context, REQUEST);
    return {
      captured: result.captured,
      codes: result.diagnostics.map((diagnostic) => diagnostic.code),
      runs: world.counts.evaluations - runs,
      reads: world.counts.acquisitions - reads,
    };
  };
  return { world, hooks, bundles, capture };
};

/**
 * A real frame capture reuses its unchanged source answer at every boundary.
 *
 * The capture path asks the read-only source gate before it draws, after the
 * pixels return, before and after the render bundle is applied under the commit
 * lock, and when it reopens the receipt, and the commit advances the revision in
 * between. With a retained source status, an unchanged project must execute no
 * authored source across those five boundaries while every boundary still reads
 * the project, and an edit at any boundary must refuse exactly there.
 *
 * Scenarios:
 *
 * 1. A first capture runs the gate once and a second capture of the same frame
 *    runs it zero times across five boundaries that each read the project once,
 *    through the revision its own commit advanced.
 * 2. A source edit while the host draws refuses the capture as changed input,
 *    runs the gate once and commits nothing.
 * 3. A source edit between applying the bundle and the post-apply check refuses
 *    the capture as changed input and leaves the committed bundle as it was.
 * 4. Generated bytes edited before the receipt reopens, and an invalid source
 *    before it reopens, each run the gate once and refuse the receipt.
 * 5. A screenplay document edited before the receipt reopens runs the gate once
 *    and keeps the capture, because the frame's identity did not move.
 * 6. An answer that read the revision into what it judged runs once more at the
 *    reopen after its own commit, and still captures.
 */
export const test_production_capture_source_status_boundaries =
  async (): Promise<void> => {
    const unchanged = harnessOf();
    const first = await unchanged.capture();
    const second = await unchanged.capture();
    TestValidator.equals(
      "an unchanged capture executes no authored source at its five boundaries",
      {
        first: { captured: first.captured, runs: first.runs },
        second,
      },
      {
        first: { captured: true, runs: 1 },
        second: { captured: true, codes: [], runs: 0, reads: 5 },
      },
    );

    const drawing = harnessOf();
    await drawing.capture();
    const committedBefore = drawing.bundles.size;
    drawing.hooks.draw = () => {
      drawing.world.state.source = EDITED;
    };
    const duringDraw = await drawing.capture();
    TestValidator.equals(
      "a source edit while drawing refuses as changed input",
      {
        captured: duringDraw.captured,
        codes: duringDraw.codes,
        runs: duringDraw.runs,
        committed: drawing.bundles.size,
      },
      {
        captured: false,
        codes: ["capture-input-changed"],
        runs: 1,
        committed: committedBefore,
      },
    );

    const applying = harnessOf();
    await applying.capture();
    const bundleBefore = canonicalizeAutoMovieJson([...applying.bundles]);
    applying.hooks.applied = () => {
      applying.world.state.source = EDITED;
    };
    const duringApply = await applying.capture();
    TestValidator.equals(
      "a source edit after applying the bundle refuses before it is kept",
      {
        captured: duringApply.captured,
        codes: duringApply.codes,
        runs: duringApply.runs,
        bundleKept:
          canonicalizeAutoMovieJson([...applying.bundles]) === bundleBefore,
      },
      {
        captured: false,
        codes: ["capture-input-changed"],
        runs: 1,
        bundleKept: true,
      },
    );

    const beforeReopen = async (
      edit: (world: ReturnType<typeof createSourceStatusWorld>) => void,
    ) => {
      const harness = harnessOf();
      await harness.capture();
      harness.hooks.reopen = () => edit(harness.world);
      const result = await harness.capture();
      return {
        captured: result.captured,
        codes: result.codes,
        runs: result.runs,
      };
    };
    TestValidator.equals(
      "an edit before the receipt reopens is judged by one fresh run",
      {
        generated: await beforeReopen((world) => {
          world.state.generated = "hand-edited compiled shot";
        }),
        invalid: await beforeReopen((world) => {
          world.state.source = EDITED;
          world.state.valid = false;
        }),
        document: await beforeReopen((world) => {
          world.state.documents.set(SCREENPLAY_DOCUMENT, "EXT. PIER - DAWN");
        }),
      },
      {
        generated: {
          captured: false,
          codes: ["capture-receipt-invalid"],
          runs: 1,
        },
        invalid: {
          captured: false,
          codes: ["capture-receipt-invalid"],
          runs: 1,
        },
        document: { captured: true, codes: [], runs: 1 },
      },
    );

    const bound = harnessOf();
    bound.world.state.revisionBound = true;
    const boundFirst = await bound.capture();
    const boundSecond = await bound.capture();
    TestValidator.equals(
      "a revision-bound answer runs again only at the reopen after its commit",
      [boundFirst, boundSecond].map((result) => ({
        captured: result.captured,
        runs: result.runs,
      })),
      [
        { captured: true, runs: 2 },
        { captured: true, runs: 1 },
      ],
    );
  };
