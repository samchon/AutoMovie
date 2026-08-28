import { renderScaffold, writeFiles } from "@automovie/template";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import * as ts from "typescript-compiler";

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
    packageExports?: boolean;
    packageName: string;
  }): IRuntimePackageSnapshot;
}

interface IRenderSoundModule {
  createProductionRenderEncoderRuntime(props: {
    createMp4File: () => unknown;
    h264Module: unknown;
    preserveCleanup: () => void;
    productionEncoderIdentity: () => unknown;
  }): unknown;
  encodeProductionSoundRaster(raster: {
    height: number;
    rgba: Uint8Array;
    width: number;
  }): Uint8Array;
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

const copyWorkspacePackage = (project: string, name: string): string => {
  const target = path.join(project, "node_modules", ...name.split("/"));
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.cpSync(packageRoot(name), target, { dereference: true, recursive: true });
  return fs.realpathSync(target);
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

const alteredPhysicalVersion = (status: fs.BigIntStats): fs.BigIntStats =>
  new Proxy(status, {
    get: (subject, property, receiver) =>
      property === "ctimeNs"
        ? subject.ctimeNs + 1n
        : Reflect.get(subject, property, receiver),
  });

const withAlteredLstatVersion = <Output>(props: {
  alter: (observation: number) => boolean;
  operation: () => Output;
  target: string;
}): Output => {
  const original = fs.lstatSync;
  const target = path.resolve(props.target);
  let observations = 0;
  const patched = ((...args: unknown[]) => {
    const status = Reflect.apply(original, fs, args) as fs.BigIntStats;
    if (path.resolve(String(args[0])) !== target) return status;
    observations++;
    if (props.alter(observations) === false) return status;
    return alteredPhysicalVersion(status);
  }) as typeof fs.lstatSync;
  Object.defineProperty(fs, "lstatSync", { value: patched });
  try {
    return props.operation();
  } finally {
    Object.defineProperty(fs, "lstatSync", { value: original });
  }
};

const withPhysicalDirectoryStatus = <Output>(props: {
  lstat: fs.BigIntStats;
  operation: () => Output;
  stat: fs.BigIntStats;
  target: string;
}): Output => {
  const originalLstat = fs.lstatSync;
  const originalStat = fs.statSync;
  const target = path.resolve(props.target);
  const patch = (
    original: typeof fs.lstatSync | typeof fs.statSync,
    replacement: fs.BigIntStats,
  ) =>
    ((...args: unknown[]) =>
      path.resolve(String(args[0])) === target
        ? replacement
        : Reflect.apply(original, fs, args)) as typeof fs.lstatSync;
  Object.defineProperty(fs, "lstatSync", {
    value: patch(originalLstat, props.lstat),
  });
  Object.defineProperty(fs, "statSync", {
    value: patch(originalStat, props.stat),
  });
  try {
    return props.operation();
  } finally {
    Object.defineProperty(fs, "lstatSync", { value: originalLstat });
    Object.defineProperty(fs, "statSync", { value: originalStat });
  }
};

const withChangedSecondDescriptorRead = <Output>(props: {
  operation: () => Output;
  target: string;
}): Output => {
  const originalOpen = fs.openSync;
  const originalRead = fs.readFileSync;
  const target = path.resolve(props.target);
  const descriptors = new Set<number>();
  let reads = 0;
  const patchedOpen = ((...args: unknown[]) => {
    const descriptor = Reflect.apply(originalOpen, fs, args) as number;
    if (path.resolve(String(args[0])) === target) descriptors.add(descriptor);
    return descriptor;
  }) as typeof fs.openSync;
  const patchedRead = ((...args: unknown[]) => {
    const bytes = Reflect.apply(originalRead, fs, args) as Buffer;
    if (typeof args[0] !== "number" || descriptors.has(args[0]) === false)
      return bytes;
    reads++;
    return reads === 2 ? Buffer.concat([bytes, Buffer.from("changed")]) : bytes;
  }) as typeof fs.readFileSync;
  Object.defineProperty(fs, "openSync", { value: patchedOpen });
  Object.defineProperty(fs, "readFileSync", { value: patchedRead });
  try {
    return props.operation();
  } finally {
    Object.defineProperty(fs, "openSync", { value: originalOpen });
    Object.defineProperty(fs, "readFileSync", { value: originalRead });
  }
};

const writePackage = (props: {
  exports?: unknown;
  files: Readonly<Record<string, string | Uint8Array>>;
  name: string;
  root: string;
  version?: unknown;
}): string => {
  fs.mkdirSync(props.root, { recursive: true });
  fs.writeFileSync(
    path.join(props.root, "package.json"),
    `${JSON.stringify({
      name: props.name,
      version: props.version ?? "1.0.0",
      ...(props.exports === undefined ? {} : { exports: props.exports }),
    })}\n`,
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
 *    bundled H.264, Kokoro, Transformers, phonemizer, ONNX common/native, and
 *    the Sharp capability wall participate in the generated identity.
 * 2. Equal name/version/entry bytes with a changed real pngjs parser, mp4box
 *    chunk, or libopus generated module produce distinct closure identities.
 * 3. Post-snapshot mutation, same-path resident-generation replacement,
 *    byte-identical successor, ABA, and a linked package root are refused.
 * 4. The generated implementation remains byte-identical to scaffold source.
 */
export const test_cli_scaffold_sound_runtime_package_closure =
  async (): Promise<void> => {
    const root = fs.realpathSync(
      fs.mkdtempSync(path.join(os.tmpdir(), "automovie-sound-closure-")),
    );
    let failure: { error: unknown } | undefined;
    try {
      const project = path.join(root, "generated");
      writeFiles(project, renderScaffold({ name: "sound-closure" }));
      linkWorkspacePackage(project, "@automovie/engine");
      linkWorkspacePackage(project, "@automovie/production");
      const residentPngRoot = copyWorkspacePackage(project, "pngjs");
      const residentMp4Root = copyWorkspacePackage(project, "mp4box");
      const source = path.resolve(
        __dirname,
        "../../../../packages/template/scaffold/scripts/runtimePackageSnapshot.ts",
      );
      const generated = path.join(
        project,
        "scripts",
        "runtimePackageSnapshot.ts",
      );
      const generatedRuntime = createRequire(__filename)(
        generated,
      ) as IRuntimePackageSnapshotModule;
      const instrumented = path.join(
        project,
        "scripts",
        "runtimePackageSnapshot.instrumented.mjs",
      );
      const productionShim = path.join(
        project,
        "scripts",
        "productionShim.mjs",
      );
      const transpiled = ts.transpileModule(fs.readFileSync(source, "utf8"), {
        fileName: source,
        compilerOptions: {
          inlineSources: true,
          module: ts.ModuleKind.ESNext,
          sourceMap: true,
          target: ts.ScriptTarget.ES2022,
        },
      });
      const sourceMap = JSON.parse(transpiled.sourceMapText!) as {
        file: string;
        sources: string[];
      };
      sourceMap.file = path.basename(instrumented);
      sourceMap.sources = [source];
      fs.writeFileSync(
        productionShim,
        [
          'import production from "@automovie/production";',
          "export const { digestAutoMovieBytes, readAutoMovieProductionOwnedFile } = production;",
          "",
        ].join("\n"),
        "utf8",
      );
      fs.writeFileSync(
        instrumented,
        transpiled.outputText
          .replace('"@automovie/production"', '"./productionShim.mjs"')
          .replace(
            /^\/\/# sourceMappingURL=.*$/mu,
            `//# sourceMappingURL=${path.basename(instrumented)}.map`,
          ),
        "utf8",
      );
      fs.writeFileSync(
        `${instrumented}.map`,
        JSON.stringify(sourceMap),
        "utf8",
      );
      const runtime = (await import(
        pathToFileURL(instrumented).href
      )) as IRuntimePackageSnapshotModule;
      TestValidator.equals(
        "generated runtime closure implementation is byte-identical",
        fs.readFileSync(generated).equals(fs.readFileSync(source)),
        true,
      );
      const generatedSoundPath = path.join(
        project,
        "scripts",
        "renderSoundRuntime.ts",
      );
      const generatedRequire = createRequire(generatedSoundPath);
      const pngEntry = generatedRequire.resolve("pngjs");
      const mp4Entry = generatedRequire.resolve("mp4box");
      const sound = generatedRequire(generatedSoundPath) as IRenderSoundModule;
      TestValidator.equals(
        "generated sound module does not load codecs before identity capture",
        {
          png: require.cache[pngEntry],
          mp4: require.cache[mp4Entry],
        },
        { png: undefined, mp4: undefined },
      );
      sound.encodeProductionSoundRaster({
        height: 1,
        rgba: new Uint8Array([0, 0, 0, 0]),
        width: 1,
      });
      sound.createProductionRenderEncoderRuntime({
        createMp4File: () => ({}),
        h264Module: {},
        preserveCleanup: () => undefined,
        productionEncoderIdentity: () => ({}),
      });
      TestValidator.equals(
        "generated sound codecs load only after their generation is bound",
        {
          png: require.cache[pngEntry] !== undefined,
          mp4: require.cache[mp4Entry] !== undefined,
        },
        { png: true, mp4: true },
      );
      replaceBytes(path.join(residentPngRoot, "lib", "parser-async.js"));
      const mp4Snapshot = generatedRuntime.snapshotRuntimePackage({
        entry: mp4Entry,
        moduleClosure: true,
        packageName: "mp4box",
      });
      replaceBytes(
        path.join(
          residentMp4Root,
          ...closurePath(mp4Snapshot, /^dist\/styp-[^.]+\.cjs$/u).split("/"),
        ),
      );
      TestValidator.equals(
        "resident codec generations refuse transitive replacement",
        namedFacts([
          [
            "pngjs",
            () =>
              throwsError(
                () =>
                  sound.encodeProductionSoundRaster({
                    height: 1,
                    rgba: new Uint8Array([0, 0, 0, 0]),
                    width: 1,
                  }),
                "changed physical identity",
              ),
          ],
          [
            "mp4box",
            () =>
              throwsError(
                () =>
                  sound.createProductionRenderEncoderRuntime({
                    createMp4File: () => ({}),
                    h264Module: {},
                    preserveCleanup: () => undefined,
                    productionEncoderIdentity: () => ({}),
                  }),
                "changed physical identity",
              ),
          ],
        ]),
        { pngjs: true, mp4box: true },
      );
      const generatedFirstRoot = copyPackage(
        root,
        "libopus-wasm",
        "generated-first",
      );
      const generatedSecondRoot = copyPackage(
        root,
        "libopus-wasm",
        "generated-second",
      );
      const generatedFirst = generatedRuntime.snapshotRuntimePackage({
        entry: path.join(generatedFirstRoot, "dist", "index.js"),
        moduleClosure: true,
        packageName: "libopus-wasm",
      });
      const generatedMember = closurePath(
        generatedFirst,
        /^dist\/generated\/libopus\.generated\.mjs$/u,
      );
      replaceBytes(
        path.join(generatedSecondRoot, ...generatedMember.split("/")),
      );
      const generatedSecond = generatedRuntime.snapshotRuntimePackage({
        entry: path.join(generatedSecondRoot, "dist", "index.js"),
        moduleClosure: true,
        packageName: "libopus-wasm",
      });
      TestValidator.equals(
        "generated consumer rejects a changed real transitive codec module",
        {
          entryUnchanged:
            generatedFirst.entryDigest === generatedSecond.entryDigest,
          closureChanged:
            generatedFirst.contentFingerprint !==
            generatedSecond.contentFingerprint,
        },
        { entryUnchanged: true, closureChanged: true },
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
        closureFacts[`${packageCase.name} later mutation refused`] =
          throwsError(
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
      const kokoroRoot = packageRoot("kokoro-js");
      const phonemizerEntry = createRequire(
        path.join(kokoroRoot, "dist", "kokoro.js"),
      ).resolve("phonemizer");
      const phonemizer = runtime.snapshotRuntimePackage({
        entry: phonemizerEntry,
        moduleClosure: true,
        packageExports: true,
        packageName: "phonemizer",
      });
      const transformersRoot = packageRoot("@huggingface/transformers");
      const onnxCommonEntry = createRequire(
        path.join(transformersRoot, "dist", "transformers.node.mjs"),
      ).resolve("onnxruntime-common");
      const onnxCommon = runtime.snapshotRuntimePackage({
        entry: onnxCommonEntry,
        moduleClosure: true,
        packageExports: true,
        packageName: "onnxruntime-common",
      });
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
          phonemizerExports: phonemizer.closure
            .map((entry) => entry.path)
            .filter((entry) => /^dist\/phonemizer\.(?:cjs|js)$/u.test(entry)),
          onnxCommonExports: onnxCommon.closure
            .map((entry) => entry.path)
            .filter((entry) => /^dist\/(?:cjs|esm)\/index\.js$/u.test(entry)),
          onnxNativeFiles: onnx.assets.length > 0,
          onnxNativePaths: onnx.assets.every((asset) =>
            asset.path.startsWith(`${nativeRelative}/`),
          ),
        },
        {
          packages: actualCases.map(([name]) => name),
          closuresNonEmpty: true,
          phonemizerExports: ["dist/phonemizer.cjs", "dist/phonemizer.js"],
          onnxCommonExports: ["dist/cjs/index.js", "dist/esm/index.js"],
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
      const successorTarget = path.join(
        successorRoot,
        "lib",
        "parser-async.js",
      );
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
        exports: {
          ".": {
            types: "./types/index.d.ts",
            import: [null, "./export-entry.mjs"],
            require: "./export-require.cjs",
          },
          "./reverse": ["./z.js", "./a.js"],
          "./asset": "./asset.bin",
        },
        files: {
          "a.js": "export const a = true;\n",
          "index.js": [
            "// require('./comment.js')",
            "/* import('./block-comment.js') */",
            "/** @typedef {import('./jsdoc.js').Ghost} Ghost */",
            "const prose = \"require('./string.js')\";",
            "const template = `require('./template.js')`;",
            "const escaped = ['line\\n', 'return\\r', 'tab\\t'];",
            "require('./required.cjs');",
            "object.require('./property.cjs'); object.import('./property.mjs');",
            "require(`./templated.cjs`); import(`./templated.mjs`);",
            "import('./dynamic.mjs');",
            "export * from './exported.js';",
            "import './side.js';",
            "new URL('./runtime.wasm', import.meta.url);",
            "new URL(`./templated.wasm`, import.meta.url);",
            "require(`./$" + "{variable}.cjs`);",
            "require(variable); import(variable); new URL(variable, import.meta.url);",
          ].join("\n"),
          "required.cjs": "require('./cycle.cjs');\n",
          "cycle.cjs": "require('./required.cjs');\n",
          "dynamic.mjs": "export const dynamic = true;\n",
          "export-entry.mjs": "import './export-leaf.js';\n",
          "export-leaf.js": "export const leaf = true;\n",
          "export-require.cjs":
            "module.exports = require('./export-leaf.js');\n",
          "exported.js": "export const exported = true;\n",
          "side.js": "export const side = true;\n",
          "runtime.wasm": new Uint8Array([0, 97, 115, 109]),
          "templated.cjs": "module.exports = true;\n",
          "templated.mjs": "export const template = true;\n",
          "templated.wasm": new Uint8Array([0, 97, 115, 109, 1]),
          "unterminated.js": "/* unfinished module comment",
          "z.js": "export const z = true;\n",
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
        entries: [
          path.join(syntaxRoot, "extra.bin"),
          path.join(syntaxRoot, "unterminated.js"),
        ],
        entry: path.join(syntaxRoot, "index.js"),
        moduleClosure: true,
        packageExports: true,
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
            "a.js",
            "asset.bin",
            "assets/nested/member.bin",
            "assets/root.bin",
            "cycle.cjs",
            "dynamic.mjs",
            "export-entry.mjs",
            "export-leaf.js",
            "export-require.cjs",
            "exported.js",
            "extra.bin",
            "index.js",
            "package.json",
            "required.cjs",
            "runtime.wasm",
            "side.js",
            "templated.cjs",
            "templated.mjs",
            "templated.wasm",
            "unterminated.js",
            "z.js",
          ],
          assets: ["asset.bin", "assets/nested/member.bin", "assets/root.bin"],
        },
      );
      const addedTreeMember = path.join(syntaxRoot, "assets", "added.bin");
      fs.writeFileSync(addedTreeMember, "added", "utf8");
      TestValidator.equals(
        "selected tree inventory rejects a later member",
        throwsError(
          () => runtime.assertRuntimePackageSnapshotCurrent(syntax),
          "changed physical identity",
        ),
        true,
      );
      fs.rmSync(addedTreeMember);

      const raceRoot = writePackage({
        root: path.join(root, "race-package"),
        name: "race-package",
        files: {
          "index.js": "module.exports = true;\n",
          "assets/file.bin": "tree race",
          "direct.bin": "read race",
        },
      });
      TestValidator.equals(
        "in-flight package generation changes are refused",
        namedFacts([
          [
            "tree member after inventory",
            () =>
              throwsError(
                () =>
                  withAlteredLstatVersion({
                    target: path.join(raceRoot, "assets", "file.bin"),
                    alter: (observation) => observation >= 2,
                    operation: () =>
                      runtime.snapshotRuntimePackage({
                        assets: [{ kind: "tree", relative: "assets" }],
                        entry: path.join(raceRoot, "index.js"),
                        packageName: "race-package",
                      }),
                  }),
                "changed after inventory",
              ),
          ],
          [
            "file while read",
            () =>
              throwsError(
                () =>
                  withAlteredLstatVersion({
                    target: path.join(raceRoot, "direct.bin"),
                    alter: (observation) => observation === 5,
                    operation: () =>
                      runtime.snapshotRuntimePackage({
                        assets: [{ kind: "file", relative: "direct.bin" }],
                        entry: path.join(raceRoot, "index.js"),
                        packageName: "race-package",
                      }),
                  }),
                "changed while its bytes were read",
              ),
          ],
        ]),
        { "tree member after inventory": true, "file while read": true },
      );
      TestValidator.equals(
        "two observations of one selected asset must agree",
        throwsError(
          () =>
            withChangedSecondDescriptorRead({
              target: path.join(raceRoot, "direct.bin"),
              operation: () =>
                runtime.snapshotRuntimePackage({
                  assets: [
                    { kind: "file", relative: "direct.bin" },
                    { kind: "file", relative: "direct.bin" },
                  ],
                  entry: path.join(raceRoot, "index.js"),
                  packageName: "race-package",
                }),
            }),
          "is inconsistent",
        ),
        true,
      );

      const exactTreeRoot = writePackage({
        root: path.join(root, "exact-tree-package"),
        name: "exact-tree-package",
        files: {
          "index.js": "module.exports = true;\n",
          "assets/original.bin": "original",
        },
      });
      const exactTree = runtime.snapshotRuntimePackage({
        assets: [{ kind: "tree", relative: "assets" }],
        entry: path.join(exactTreeRoot, "index.js"),
        packageName: "exact-tree-package",
      });
      const exactTreeDirectory = path.join(exactTreeRoot, "assets");
      const exactTreeLstat = fs.lstatSync(exactTreeDirectory, { bigint: true });
      const exactTreeStat = fs.statSync(exactTreeDirectory, { bigint: true });
      fs.writeFileSync(path.join(exactTreeDirectory, "added.bin"), "added");
      TestValidator.equals(
        "tree membership changes even when directory metadata is held constant",
        throwsError(
          () =>
            withPhysicalDirectoryStatus({
              target: exactTreeDirectory,
              lstat: exactTreeLstat,
              stat: exactTreeStat,
              operation: () =>
                runtime.assertRuntimePackageSnapshotCurrent(exactTree),
            }),
          "changed exact inventory",
        ),
        true,
      );

      const linkedMemberRoot = writePackage({
        root: path.join(root, "linked-member-package"),
        name: "linked-member-package",
        files: {
          "index.js": "module.exports = true;\n",
          "assets/owned.bin": "owned",
        },
      });
      fs.symlinkSync(
        packageRoot("pngjs"),
        path.join(linkedMemberRoot, "assets", "linked"),
        process.platform === "win32" ? "junction" : "dir",
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
      const manifestDirectoryRoot = path.join(root, "manifest-directory");
      fs.mkdirSync(path.join(manifestDirectoryRoot, "package.json"), {
        recursive: true,
      });
      fs.writeFileSync(
        path.join(manifestDirectoryRoot, "index.js"),
        "module.exports = true;\n",
        "utf8",
      );
      const directoryRaceRoot = writePackage({
        root: path.join(root, "directory-race"),
        name: "directory-race",
        files: { "index.js": "module.exports = true;\n" },
      });
      const directoryRaceLstat = fs.lstatSync(directoryRaceRoot, {
        bigint: true,
      });
      const directoryRaceStat = fs.statSync(directoryRaceRoot, {
        bigint: true,
      });
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
            "directory entry",
            () =>
              throwsError(
                () =>
                  runtime.snapshotRuntimePackage({
                    entries: [path.join(syntaxRoot, "assets")],
                    entry: path.join(syntaxRoot, "index.js"),
                    packageName: "closure-syntax",
                  }),
                "is not physical",
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
          [
            "manifest directory",
            () =>
              throwsError(
                () =>
                  runtime.snapshotRuntimePackage({
                    entry: path.join(manifestDirectoryRoot, "index.js"),
                    packageName: "manifest-directory",
                  }),
                "is not physical",
              ),
          ],
          [
            "directory resolution race",
            () =>
              throwsError(
                () =>
                  withPhysicalDirectoryStatus({
                    target: directoryRaceRoot,
                    lstat: directoryRaceLstat,
                    stat: alteredPhysicalVersion(directoryRaceStat),
                    operation: () =>
                      runtime.snapshotRuntimePackage({
                        entry: path.join(directoryRaceRoot, "index.js"),
                        packageName: "directory-race",
                      }),
                  }),
                "changed while resolved",
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
          [
            "linked asset member",
            () =>
              throwsError(
                () =>
                  runtime.snapshotRuntimePackage({
                    assets: [{ kind: "tree", relative: "assets" }],
                    entry: path.join(linkedMemberRoot, "index.js"),
                    packageName: "linked-member-package",
                  }),
                "is linked",
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
            "directory entry",
            "invalid version",
            "missing manifest",
            "manifest directory",
            "directory resolution race",
            ...["", ".", "..", "a\\b", "a\0b"].map(
              (relative) => `invalid asset ${JSON.stringify(relative)}`,
            ),
            "linked asset tree",
            "linked asset member",
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
