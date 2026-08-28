import { renderScaffold, writeFiles } from "@automovie/template";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";

import { namedFacts, throwsError } from "../internal/predicates";
import { preserveCliRootFixtureCleanup } from "./CliRootFixtureCleanup";

interface IRuntimePackageSnapshot {
  assets: Array<{ digest: `sha256:${string}`; path: string }>;
  closure: Array<{ digest: `sha256:${string}`; path: string }>;
  contentFingerprint: `sha256:${string}`;
  entryDigest: `sha256:${string}`;
  fingerprint: `sha256:${string}`;
  package: string;
  root: string;
  version: string;
}

interface IRuntimePackageSnapshotModule {
  assertRuntimePackageSnapshotCurrent(snapshot: IRuntimePackageSnapshot): void;
  bindRuntimePackageSnapshotGeneration(snapshot: IRuntimePackageSnapshot): void;
  snapshotRuntimePackage(props: {
    assets?: readonly (
      | { kind: "file"; relative: string }
      | { kind: "tree"; relative: string }
    )[];
    entry: string;
    entries?: readonly string[];
    moduleClosure?: boolean;
    packageName: string;
  }): IRuntimePackageSnapshot;
}

interface IPackageCase {
  entry: string;
  expected: readonly RegExp[];
  mutate: RegExp;
  name: string;
}

const packageRoot = (name: string): string => {
  const manifest = createRequire(__filename)
    .resolve.paths(name)
    ?.map((base) => path.join(base, ...name.split("/"), "package.json"))
    .find((candidate) => fs.existsSync(candidate));
  if (manifest === undefined)
    throw new Error(`Sound runtime package root did not resolve: ${name}.`);
  return fs.realpathSync(path.dirname(manifest));
};

const linkWorkspacePackage = (project: string, name: string): void => {
  const target = path.join(project, "node_modules", ...name.split("/"));
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.symlinkSync(
    packageRoot(name),
    target,
    process.platform === "win32" ? "junction" : "dir",
  );
};

const copyPackage = (
  root: string,
  name: string,
  generation: string,
): string => {
  const target = path.join(
    root,
    "package-copies",
    name.replaceAll("/", "-"),
    generation,
  );
  fs.cpSync(packageRoot(name), target, {
    dereference: true,
    recursive: true,
  });
  return fs.realpathSync(target);
};

const closurePath = (
  snapshot: IRuntimePackageSnapshot,
  pattern: RegExp,
): string => {
  const matches = snapshot.closure.filter((entry) => pattern.test(entry.path));
  if (matches.length !== 1)
    throw new Error(
      `Expected one ${snapshot.package} closure member matching ${pattern}, got ${matches.length}.`,
    );
  return matches[0]!.path;
};

const replaceBytes = (file: string): void => {
  const bytes = fs.readFileSync(file);
  fs.writeFileSync(file, Buffer.concat([bytes, Buffer.from("\n// changed\n")]));
};

const writePackage = (props: {
  files: Readonly<Record<string, string | Uint8Array>>;
  name: string;
  root: string;
  version?: unknown;
}): string => {
  fs.mkdirSync(props.root, { recursive: true });
  fs.writeFileSync(
    path.join(props.root, "package.json"),
    `${JSON.stringify({ name: props.name, version: props.version ?? "1.0.0" })}\n`,
    "utf8",
  );
  for (const [relative, bytes] of Object.entries(props.files)) {
    const file = path.join(props.root, ...relative.split("/"));
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, bytes);
  }
  return fs.realpathSync(props.root);
};

/**
 * A generated project seals the real sound and codec executable population.
 *
 * The fixture copies actual installed package trees before changing their real
 * transitive modules. It never substitutes a package-name-only test double.
 *
 * Scenarios:
 *
 * 1. Actual pngjs siblings, mp4box ESM chunks, libopus generated WASM module,
 *    bundled H.264, Kokoro, Transformers, Sharp capability wall, and ONNX native
 *    files all participate in the generated consumer's canonical identity.
 * 2. Equal name/version/entry bytes with a changed real pngjs parser, mp4box
 *    chunk, or libopus generated module produce distinct closure identities.
 * 3. Post-snapshot mutation, same-path resident-generation replacement,
 *    byte-identical successor, ABA, and a linked package root are refused.
 * 4. The generated implementation remains byte-identical to scaffold source.
 */
export const test_cli_scaffold_sound_runtime_package_closure = (): void => {
  const root = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), "automovie-sound-closure-")),
  );
  let failure: { error: unknown } | undefined;
  try {
    const project = path.join(root, "generated");
    writeFiles(project, renderScaffold({ name: "sound-closure" }));
    linkWorkspacePackage(project, "@automovie/production");
    const source = path.resolve(
      __dirname,
      "../../../../packages/template/scaffold/scripts/runtimePackageSnapshot.ts",
    );
    const generated = path.join(
      project,
      "scripts",
      "runtimePackageSnapshot.ts",
    );
    const runtime = createRequire(__filename)(
      generated,
    ) as IRuntimePackageSnapshotModule;
    TestValidator.equals(
      "generated runtime closure implementation is byte-identical",
      fs.readFileSync(generated).equals(fs.readFileSync(source)),
      true,
    );

    const packageCases: readonly IPackageCase[] = [
      {
        name: "pngjs",
        entry: "lib/png.js",
        expected: [
          /^lib\/png\.js$/u,
          /^lib\/parser-async\.js$/u,
          /^lib\/packer-async\.js$/u,
          /^lib\/png-sync\.js$/u,
        ],
        mutate: /^lib\/parser-async\.js$/u,
      },
      {
        name: "mp4box",
        entry: "dist/mp4box.all.mjs",
        expected: [
          /^dist\/mp4box\.all\.mjs$/u,
          /^dist\/rolldown-runtime-[^.]+\.mjs$/u,
          /^dist\/styp-[^.]+\.mjs$/u,
        ],
        mutate: /^dist\/styp-[^.]+\.mjs$/u,
      },
      {
        name: "libopus-wasm",
        entry: "dist/index.js",
        expected: [
          /^dist\/index\.js$/u,
          /^dist\/generated\/libopus\.generated\.mjs$/u,
        ],
        mutate: /^dist\/generated\/libopus\.generated\.mjs$/u,
      },
    ];
    const closureFacts: Record<string, boolean> = {};
    for (const packageCase of packageCases) {
      const firstRoot = copyPackage(root, packageCase.name, "first");
      const secondRoot = copyPackage(root, packageCase.name, "second");
      const first = runtime.snapshotRuntimePackage({
        entry: path.join(firstRoot, ...packageCase.entry.split("/")),
        moduleClosure: true,
        packageName: packageCase.name,
      });
      const changedRelative = closurePath(first, packageCase.mutate);
      replaceBytes(path.join(secondRoot, ...changedRelative.split("/")));
      const second = runtime.snapshotRuntimePackage({
        entry: path.join(secondRoot, ...packageCase.entry.split("/")),
        moduleClosure: true,
        packageName: packageCase.name,
      });
      closureFacts[`${packageCase.name} exact members`] =
        packageCase.expected.every((pattern) =>
          first.closure.some((entry) => pattern.test(entry.path)),
        );
      closureFacts[`${packageCase.name} entry unchanged`] =
        first.entryDigest === second.entryDigest;
      closureFacts[`${packageCase.name} closure changed`] =
        first.contentFingerprint !== second.contentFingerprint;

      replaceBytes(path.join(firstRoot, ...changedRelative.split("/")));
      closureFacts[`${packageCase.name} later mutation refused`] = throwsError(
        () => runtime.assertRuntimePackageSnapshotCurrent(first),
        "changed physical identity",
      );
    }
    TestValidator.equals(
      "real transitive sound modules determine closure identity",
      closureFacts,
      Object.fromEntries(Object.keys(closureFacts).map((key) => [key, true])),
    );

    const actualCases = [
      ["h264-mp4-encoder", "embuild/dist/h264-mp4-encoder.node.js"],
      ["kokoro-js", "dist/kokoro.js"],
      ["@huggingface/transformers", "dist/transformers.node.mjs"],
      ["sharp", "index.cjs"],
    ] as const;
    const actual = actualCases.map(([name, entry]) =>
      runtime.snapshotRuntimePackage({
        entry: path.join(packageRoot(name), ...entry.split("/")),
        moduleClosure: true,
        packageName: name,
      }),
    );
    const onnxRoot = packageRoot("onnxruntime-node");
    const nativeRelative = [
      "bin",
      "napi-v3",
      process.platform,
      process.arch,
    ].join("/");
    const onnx = runtime.snapshotRuntimePackage({
      assets: [{ kind: "tree", relative: nativeRelative }],
      entry: path.join(onnxRoot, "dist", "index.js"),
      moduleClosure: true,
      packageName: "onnxruntime-node",
    });
    TestValidator.equals(
      "bundled and native package populations are sealed",
      {
        packages: actual.map((snapshot) => snapshot.package),
        closuresNonEmpty: actual.every(
          (snapshot) => snapshot.closure.length > 1,
        ),
        onnxNativeFiles: onnx.assets.length > 0,
        onnxNativePaths: onnx.assets.every((asset) =>
          asset.path.startsWith(`${nativeRelative}/`),
        ),
      },
      {
        packages: actualCases.map(([name]) => name),
        closuresNonEmpty: true,
        onnxNativeFiles: true,
        onnxNativePaths: true,
      },
    );

    const residentRoot = copyPackage(root, "pngjs", "resident");
    const residentEntry = path.join(residentRoot, "lib", "png.js");
    const residentA = runtime.snapshotRuntimePackage({
      entry: residentEntry,
      moduleClosure: true,
      packageName: "pngjs",
    });
    runtime.bindRuntimePackageSnapshotGeneration(residentA);
    replaceBytes(path.join(residentRoot, "lib", "parser-async.js"));
    const residentB = runtime.snapshotRuntimePackage({
      entry: residentEntry,
      moduleClosure: true,
      packageName: "pngjs",
    });

    const successorRoot = copyPackage(root, "pngjs", "successor");
    const successorEntry = path.join(successorRoot, "lib", "png.js");
    const successor = runtime.snapshotRuntimePackage({
      entry: successorEntry,
      moduleClosure: true,
      packageName: "pngjs",
    });
    const successorTarget = path.join(successorRoot, "lib", "parser-async.js");
    const successorBytes = fs.readFileSync(successorTarget);
    fs.renameSync(successorTarget, `${successorTarget}.old`);
    fs.writeFileSync(successorTarget, successorBytes);

    const abaRoot = copyPackage(root, "pngjs", "aba");
    const aba = runtime.snapshotRuntimePackage({
      entry: path.join(abaRoot, "lib", "png.js"),
      moduleClosure: true,
      packageName: "pngjs",
    });
    const abaTarget = path.join(abaRoot, "lib", "parser-async.js");
    const abaBytes = fs.readFileSync(abaTarget);
    fs.writeFileSync(abaTarget, Buffer.alloc(abaBytes.length, 7));
    fs.writeFileSync(abaTarget, abaBytes);

    const linkedRoot = path.join(root, "linked-pngjs");
    fs.symlinkSync(
      packageRoot("pngjs"),
      linkedRoot,
      process.platform === "win32" ? "junction" : "dir",
    );
    TestValidator.equals(
      "resident and physical-generation drift is refused",
      namedFacts([
        [
          "resident generation mismatch",
          () =>
            throwsError(
              () => runtime.bindRuntimePackageSnapshotGeneration(residentB),
              "resident module generation",
            ),
        ],
        [
          "byte-identical successor",
          () =>
            throwsError(
              () => runtime.assertRuntimePackageSnapshotCurrent(successor),
              "changed physical identity",
            ),
        ],
        [
          "ABA",
          () =>
            throwsError(
              () => runtime.assertRuntimePackageSnapshotCurrent(aba),
              "changed physical identity",
            ),
        ],
        [
          "linked root",
          () =>
            throwsError(
              () =>
                runtime.snapshotRuntimePackage({
                  entry: path.join(linkedRoot, "lib", "png.js"),
                  moduleClosure: true,
                  packageName: "pngjs",
                }),
              "is not physical",
            ),
        ],
      ]),
      {
        "resident generation mismatch": true,
        "byte-identical successor": true,
        ABA: true,
        "linked root": true,
      },
    );

    const syntaxRoot = writePackage({
      root: path.join(root, "syntax-package"),
      name: "closure-syntax",
      files: {
        "index.js": [
          "// require('./comment.js')",
          "/* import('./block-comment.js') */",
          "/** @typedef {import('./jsdoc.js').Ghost} Ghost */",
          "const prose = \"require('./string.js')\";",
          "const template = `require('./template.js')`;",
          "const escaped = ['line\\n', 'return\\r', 'tab\\t'];",
          "require('./required.cjs');",
          "import('./dynamic.mjs');",
          "export * from './exported.js';",
          "import './side.js';",
          "new URL('./runtime.wasm', import.meta.url);",
          "require(variable); import(variable); new URL(variable, import.meta.url);",
        ].join("\n"),
        "required.cjs": "require('./cycle.cjs');\n",
        "cycle.cjs": "require('./required.cjs');\n",
        "dynamic.mjs": "export const dynamic = true;\n",
        "exported.js": "export const exported = true;\n",
        "side.js": "export const side = true;\n",
        "runtime.wasm": new Uint8Array([0, 97, 115, 109]),
        "extra.bin": "extra",
        "asset.bin": "asset",
        "assets/root.bin": "root",
        "assets/nested/member.bin": "member",
      },
    });
    const syntax = runtime.snapshotRuntimePackage({
      assets: [
        { kind: "file", relative: "asset.bin" },
        { kind: "tree", relative: "assets" },
      ],
      entries: [path.join(syntaxRoot, "extra.bin")],
      entry: path.join(syntaxRoot, "index.js"),
      moduleClosure: true,
      packageName: "closure-syntax",
    });
    TestValidator.equals(
      "literal syntax edges and selected assets are complete without comment edges",
      {
        closure: syntax.closure.map((entry) => entry.path),
        assets: syntax.assets.map((asset) => asset.path),
      },
      {
        closure: [
          "asset.bin",
          "assets/nested/member.bin",
          "assets/root.bin",
          "cycle.cjs",
          "dynamic.mjs",
          "exported.js",
          "extra.bin",
          "index.js",
          "package.json",
          "required.cjs",
          "runtime.wasm",
          "side.js",
        ],
        assets: ["asset.bin", "assets/nested/member.bin", "assets/root.bin"],
      },
    );

    const outside = path.join(root, "outside.js");
    fs.writeFileSync(outside, "module.exports = true;\n", "utf8");
    const escapeRoot = writePackage({
      root: path.join(root, "escape-package"),
      name: "escape-package",
      files: { "index.js": "require('../outside.js');\n" },
    });
    const invalidVersionRoot = writePackage({
      root: path.join(root, "invalid-version"),
      name: "invalid-version",
      version: "",
      files: { "index.js": "module.exports = true;\n" },
    });
    const linkedAssetRoot = writePackage({
      root: path.join(root, "linked-asset"),
      name: "linked-asset",
      files: { "index.js": "module.exports = true;\n" },
    });
    fs.symlinkSync(
      packageRoot("pngjs"),
      path.join(linkedAssetRoot, "linked-tree"),
      process.platform === "win32" ? "junction" : "dir",
    );
    const noManifest = path.join(root, "no-manifest.js");
    fs.writeFileSync(noManifest, "module.exports = true;\n", "utf8");
    TestValidator.equals(
      "invalid package facts and unobserved snapshots are refused",
      namedFacts([
        [
          "blank package name",
          () =>
            throwsError(
              () =>
                runtime.snapshotRuntimePackage({
                  entry: path.join(syntaxRoot, "index.js"),
                  packageName: "",
                }),
              "name is invalid",
            ),
        ],
        [
          "padded package name",
          () =>
            throwsError(
              () =>
                runtime.snapshotRuntimePackage({
                  entry: path.join(syntaxRoot, "index.js"),
                  packageName: " closure-syntax",
                }),
              "name is invalid",
            ),
        ],
        [
          "foreign snapshot",
          () =>
            throwsError(
              () =>
                runtime.assertRuntimePackageSnapshotCurrent(
                  structuredClone(syntax),
                ),
              "no resident observation",
            ),
        ],
        [
          "module escape",
          () =>
            throwsError(
              () =>
                runtime.snapshotRuntimePackage({
                  entry: path.join(escapeRoot, "index.js"),
                  moduleClosure: true,
                  packageName: "escape-package",
                }),
              "escapes its package root",
            ),
        ],
        [
          "entry escape",
          () =>
            throwsError(
              () =>
                runtime.snapshotRuntimePackage({
                  entries: [outside],
                  entry: path.join(syntaxRoot, "index.js"),
                  packageName: "closure-syntax",
                }),
              "escapes its root",
            ),
        ],
        [
          "invalid version",
          () =>
            throwsError(
              () =>
                runtime.snapshotRuntimePackage({
                  entry: path.join(invalidVersionRoot, "index.js"),
                  packageName: "invalid-version",
                }),
              "no valid version",
            ),
        ],
        [
          "missing manifest",
          () =>
            throwsError(
              () =>
                runtime.snapshotRuntimePackage({
                  entry: noManifest,
                  packageName: "never-present",
                }),
              "no matching package.json ancestor",
            ),
        ],
        ...["", ".", "..", "a\\b", "a\0b"].map(
          (relative) =>
            [
              `invalid asset ${JSON.stringify(relative)}`,
              () =>
                throwsError(
                  () =>
                    runtime.snapshotRuntimePackage({
                      assets: [{ kind: "file", relative }],
                      entry: path.join(syntaxRoot, "index.js"),
                      packageName: "closure-syntax",
                    }),
                  "asset path",
                ),
            ] as const,
        ),
        [
          "linked asset tree",
          () =>
            throwsError(
              () =>
                runtime.snapshotRuntimePackage({
                  assets: [{ kind: "tree", relative: "linked-tree" }],
                  entry: path.join(linkedAssetRoot, "index.js"),
                  packageName: "linked-asset",
                }),
              "not physical",
            ),
        ],
      ]),
      Object.fromEntries(
        [
          "blank package name",
          "padded package name",
          "foreign snapshot",
          "module escape",
          "entry escape",
          "invalid version",
          "missing manifest",
          ...["", ".", "..", "a\\b", "a\0b"].map(
            (relative) => `invalid asset ${JSON.stringify(relative)}`,
          ),
          "linked asset tree",
        ].map((key) => [key, true]),
      ),
    );
  } catch (error) {
    failure = { error };
    throw error;
  } finally {
    preserveCliRootFixtureCleanup(
      failure,
      () => fs.rmSync(root, { force: true, recursive: true }),
      "sound runtime package closure fixture",
    );
  }
};
