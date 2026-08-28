import type { IAutoMovieCaptureRuntimeIdentity } from "@automovie/interface";
import { renderScaffold, writeFiles } from "@automovie/template";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";

import { throwsError } from "../internal/predicates";
import { preserveCliRootFixtureCleanup } from "./CliRootFixtureCleanup";

interface IClosureSnapshot {
  identity: IAutoMovieCaptureRuntimeIdentity["runtimeClosure"];
  assertCurrent(): void;
}

interface IClosureModule {
  snapshotProductionCaptureRuntimeClosure(props: {
    browserSupport:
      | {
          source: "package-owned" | "configured-executable";
          root: string;
        }
      | { source: "system-channel" };
    packageEntries: readonly { entry: string; package: string }[];
  }): IClosureSnapshot;
}

const PACKAGES = [
  "@automovie/engine",
  "@automovie/viewer",
  "playwright",
  "playwright-core",
  "three",
  "vite",
] as const;

const linkWorkspacePackage = (project: string, name: string): void => {
  const manifest = createRequire(__filename)
    .resolve.paths(name)
    ?.map((base) => path.join(base, ...name.split("/"), "package.json"))
    .find((candidate) => fs.existsSync(candidate));
  if (manifest === undefined)
    throw new Error(`Capture runtime package root did not resolve: ${name}.`);
  const target = path.join(project, "node_modules", ...name.split("/"));
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.symlinkSync(
    path.dirname(manifest),
    target,
    process.platform === "win32" ? "junction" : "dir",
  );
};

const writeRuntimeGraph = (
  root: string,
  viewerBytes: string,
): Array<{ entry: string; package: string }> =>
  PACKAGES.map((name, index) => {
    const packageRoot = path.join(root, ...name.split("/"));
    fs.mkdirSync(path.join(packageRoot, "dist"), { recursive: true });
    fs.writeFileSync(
      path.join(packageRoot, "package.json"),
      `${JSON.stringify({
        name,
        version: "1.0.0",
        main: "index.js",
      })}\n`,
      "utf8",
    );
    const entry = path.join(packageRoot, "index.js");
    fs.writeFileSync(
      entry,
      name === "@automovie/viewer"
        ? viewerBytes
        : `module.exports = ${JSON.stringify(index)};\n`,
      "utf8",
    );
    fs.writeFileSync(
      path.join(packageRoot, "dist", "runtime.js"),
      `export const runtime = ${JSON.stringify(name)};\n`,
      "utf8",
    );
    return { entry, package: name };
  });

const writeBrowserSupport = (root: string): string => {
  fs.mkdirSync(path.join(root, "swiftshader"), { recursive: true });
  fs.writeFileSync(path.join(root, "chrome.exe"), Buffer.alloc(64, 3));
  fs.writeFileSync(
    path.join(root, "swiftshader", "vk_swiftshader.dll"),
    Buffer.alloc(64, 5),
  );
  return root;
};

const withDistinctNamespaceDevice = <Output>(
  file: string,
  operation: () => Output,
): Output => {
  const original = fs.lstatSync;
  const target = path.resolve(file);
  const patched = ((...args: unknown[]) => {
    const status = Reflect.apply(original, fs, args) as fs.BigIntStats;
    if (path.resolve(String(args[0])) !== target) return status;
    return new Proxy(status, {
      get: (subject, property, receiver) =>
        property === "dev"
          ? subject.dev + 1n
          : Reflect.get(subject, property, receiver),
    });
  }) as typeof fs.lstatSync;
  Object.defineProperty(fs, "lstatSync", { value: patched });
  try {
    return operation();
  } finally {
    Object.defineProperty(fs, "lstatSync", { value: original });
  }
};

/**
 * A generated project seals installed capture bytes rather than package labels.
 *
 * The test loads the scaffold-rendered implementation and gives it physical
 * same-version package trees. The expected results come from deliberately
 * different bytes and physical replacements, not from snapshots of the code's
 * own output.
 *
 * Scenarios:
 *
 * 1. Two complete Vite/viewer/engine/three/Playwright package populations with
 *    equal names and versions but different viewer bytes receive distinct
 *    closure identities.
 * 2. Package-owned Chromium includes its executable and SwiftShader support
 *    tree, while a system channel remains explicitly unsealed.
 * 3. A support-file mutation after inventory, a byte-identical package-file
 *    successor, and an in-place change-then-restore are all refused as a new
 *    physical generation.
 * 4. A linked browser-support root is refused instead of being mislabeled as
 *    the physical tree that the generated project sealed.
 * 5. A platform may expose distinct namespace and descriptor device domains;
 *    each observation remains stable and the physical snapshot is accepted.
 */
export const test_cli_scaffold_capture_runtime_closure = (): void => {
  const root = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), "automovie-capture-closure-")),
  );
  let failure: { error: unknown } | undefined;
  try {
    const project = path.join(root, "generated");
    writeFiles(project, renderScaffold({ name: "capture-closure" }));
    for (const name of ["@automovie/interface", "@automovie/production"])
      linkWorkspacePackage(project, name);
    const generatedModule = path.join(
      project,
      "scripts",
      "captureRuntimeClosure.ts",
    );
    if (fs.existsSync(generatedModule) === false)
      throw new Error(
        "The generated project omitted scripts/captureRuntimeClosure.ts.",
      );
    const closure = createRequire(__filename)(
      generatedModule,
    ) as IClosureModule;

    const packagesA = writeRuntimeGraph(
      path.join(root, "packages-a"),
      "export const viewer = 'A';\n",
    );
    const packagesB = writeRuntimeGraph(
      path.join(root, "packages-b"),
      "export const viewer = 'B';\n",
    );
    const browserA = writeBrowserSupport(path.join(root, "chromium-a"));
    const browserB = writeBrowserSupport(path.join(root, "chromium-b"));
    const first = withDistinctNamespaceDevice(
      path.join(browserA, "chrome.exe"),
      () =>
        closure.snapshotProductionCaptureRuntimeClosure({
          packageEntries: packagesA,
          browserSupport: { source: "package-owned", root: browserA },
        }),
    );
    const second = closure.snapshotProductionCaptureRuntimeClosure({
      packageEntries: packagesB,
      browserSupport: { source: "package-owned", root: browserB },
    });
    const system = closure.snapshotProductionCaptureRuntimeClosure({
      packageEntries: packagesB,
      browserSupport: { source: "system-channel" },
    });
    TestValidator.equals(
      "same-version installed implementations and browser boundaries own exact identities",
      {
        distinctPackageBytes:
          first.identity.contentDigest !== second.identity.contentDigest,
        requiredPackages: second.identity.packages.map(
          (entry) => entry.package,
        ),
        packageOwned: second.identity.browserSupport.status,
        packageOwnedFiles:
          second.identity.browserSupport.status === "content-sealed"
            ? second.identity.browserSupport.files
            : 0,
        system: system.identity.browserSupport,
      },
      {
        distinctPackageBytes: true,
        requiredPackages: [...PACKAGES].sort((left, right) =>
          left < right ? -1 : left > right ? 1 : 0,
        ),
        packageOwned: "content-sealed",
        packageOwnedFiles: 2,
        system: {
          status: "system-channel-unsealed",
          source: "system-channel",
        },
      },
    );

    fs.writeFileSync(
      path.join(browserA, "swiftshader", "vk_swiftshader.dll"),
      Buffer.alloc(64, 9),
    );
    const supportMutation = throwsError(
      first.assertCurrent,
      "changed physical generation",
    );

    const viewerB = packagesB.find(
      (entry) => entry.package === "@automovie/viewer",
    )!.entry;
    const viewerBytes = fs.readFileSync(viewerB);
    fs.renameSync(viewerB, `${viewerB}.previous`);
    fs.writeFileSync(viewerB, viewerBytes);
    const successor = throwsError(
      second.assertCurrent,
      "changed physical identity",
    );

    const packagesC = writeRuntimeGraph(
      path.join(root, "packages-c"),
      "export const viewer = 'C';\n",
    );
    const third = closure.snapshotProductionCaptureRuntimeClosure({
      packageEntries: packagesC,
      browserSupport: {
        source: "configured-executable",
        root: writeBrowserSupport(path.join(root, "configured-browser")),
      },
    });
    const viewerC = packagesC.find(
      (entry) => entry.package === "@automovie/viewer",
    )!.entry;
    const original = fs.readFileSync(viewerC);
    fs.writeFileSync(viewerC, Buffer.alloc(original.length, 7));
    fs.writeFileSync(viewerC, original);
    const aba = throwsError(third.assertCurrent, "changed physical identity");

    const linkedBrowser = path.join(root, "linked-browser");
    fs.symlinkSync(
      browserB,
      linkedBrowser,
      process.platform === "win32" ? "junction" : "dir",
    );
    const linked = throwsError(
      () =>
        closure.snapshotProductionCaptureRuntimeClosure({
          packageEntries: packagesC,
          browserSupport: {
            source: "package-owned",
            root: linkedBrowser,
          },
        }),
      "is not physical",
    );
    TestValidator.equals(
      "mutations, successors, ABA drift, and linked roots are refused",
      { supportMutation, successor, aba, linked },
      { supportMutation: true, successor: true, aba: true, linked: true },
    );
  } catch (error) {
    failure = { error };
    throw error;
  } finally {
    preserveCliRootFixtureCleanup(
      failure,
      () => fs.rmSync(root, { recursive: true, force: true }),
      "capture runtime closure fixture",
    );
  }
};
