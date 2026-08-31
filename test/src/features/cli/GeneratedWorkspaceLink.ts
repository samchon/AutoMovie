import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { builtOutputIsStale } from "../internal/builtPackageFreshness";

const REPOSITORY_ROOT = path.resolve(__dirname, "../../../..");

/**
 * Workspace packages a generated consumer receives built rather than as source.
 *
 * A real user's generated project installs these from the registry, where
 * `publishConfig` swaps `main` and `exports` from `src` to `lib`. The fixtures
 * handed over the workspace root instead, whose in-repo `exports` names
 * `./src/index.ts`, so a generated child resolved the entire source tree of
 * every package it imported and type-checked it under the scaffold's own
 * compiler options.
 *
 * That is not a small overhead. One child importing nothing but
 * `@automovie/production`, under the scaffold's `moduleResolution: "bundler"`:
 *
 * | linked shape                        | cost   |
 * | ----------------------------------- | ------ |
 * | source root, peers source-linked    | 131 s  |
 * | production facade, peers as source  | 46 s   |
 * | every package a built facade        | 7.6 s  |
 *
 * The same import under `moduleResolution: "nodenext"` costs four seconds in
 * every one of those shapes, which is why the cost stayed invisible for so
 * long: it does not reproduce outside the resolution mode a generated project
 * actually uses, and a probe written the obvious way reports four seconds and
 * calls the question answered.
 *
 * So a facade is the faithful shape here, not a shortcut around one. It is what
 * a user installs, and these fixtures were the only consumers in existence
 * running anything else.
 *
 * `@automovie/template` is deliberately absent: a generated project reads its
 * scaffold assets out of that package's own directory, so it wants the
 * workspace root and not an emit.
 */
const BUILT_FACADE_PACKAGES: ReadonlySet<string> = new Set([
  "@automovie/archetypes",
  "@automovie/engine",
  "@automovie/evidence",
  "@automovie/ingest",
  "@automovie/interface",
  "@automovie/production",
  "@automovie/render",
  "@automovie/viewer",
]);

/** Where a workspace package's own directory is, resolved from its manifest. */
const workspacePackageRoot = (name: string, subject: string): string => {
  const resolver = createRequire(__filename);
  const manifest = resolver.resolve
    .paths(name)
    ?.map((base) => path.join(base, ...name.split("/"), "package.json"))
    .find((candidate) => fs.existsSync(candidate));
  if (manifest === undefined)
    throw new Error(`${subject} package root did not resolve: ${name}.`);
  return path.dirname(manifest);
};

/** Every package one workspace package declares it needs, workspace or not. */
const declaredDependencies = (packageRoot: string): string[] => {
  const manifest: unknown = JSON.parse(
    fs.readFileSync(path.join(packageRoot, "package.json"), "utf8"),
  );
  if (typeof manifest !== "object" || manifest === null) return [];
  const declared = manifest as {
    dependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
  };
  return [
    ...new Set([
      ...Object.keys(declared.dependencies ?? {}),
      ...Object.keys(declared.peerDependencies ?? {}),
    ]),
  ].sort((left, right) => left.localeCompare(right));
};

/**
 * Install one package a facade needs, without following its own tree.
 *
 * A symlinked package resolves its dependencies through its realpath, so the
 * repository answers for it and nothing has to be installed. A facade is a real
 * directory inside the fixture, so that walk ends at the fixture and every
 * dependency it declares has to be there: `@automovie/production`'s built
 * compiler requires `typescript-compiler`, and moving it into the fixture is
 * what took that away.
 *
 * One level is enough. What is linked here is a junction, so its own
 * dependencies resolve through the repository exactly as they did before.
 */
const linkDeclaredDependency = (props: {
  name: string;
  project: string;
}): void => {
  const target = path.join(
    props.project,
    "node_modules",
    ...props.name.split("/"),
  );
  if (fs.existsSync(target)) return;
  let packageRoot: string;
  try {
    packageRoot = workspacePackageRoot(props.name, "Generated consumer");
  } catch {
    // A dependency this repository does not install is not this linker's to
    // invent. The fixture will refuse when it reaches for it, naming the
    // package, which is a better failure than one invented here.
    return;
  }
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.symlinkSync(
    packageRoot,
    target,
    process.platform === "win32" ? "junction" : "dir",
  );
};

/** Rebuild one workspace package whose emit no longer answers for its source. */
const rebuildWorkspacePackage = (name: string): void => {
  const command =
    process.platform === "win32"
      ? {
          arguments: ["/d", "/s", "/c", `pnpm --filter ${name} build`],
          executable: process.env.ComSpec ?? "cmd.exe",
        }
      : { arguments: ["--filter", name, "build"], executable: "pnpm" };
  const result = spawnSync(command.executable, command.arguments, {
    cwd: REPOSITORY_ROOT,
    encoding: "utf8",
    env: { ...process.env, FORCE_COLOR: "0" },
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.error !== undefined) throw result.error;
  if (result.status !== 0 || result.signal !== null)
    throw new Error(
      [
        `Building the generated consumer's ${name} facade exited ${result.status ?? `by ${result.signal}`}.`,
        result.stdout,
        result.stderr,
      ].join("\n"),
    );
};

/**
 * The manifest a registry install leaves, written beside the copied build.
 *
 * Only the fields a consumer resolves through. Copying the workspace manifest
 * instead would carry its `src` exports straight back in, which is the whole
 * defect this shape exists to remove.
 */
const publishedManifest = (name: string): string =>
  `${JSON.stringify(
    {
      name,
      version: "0.1.0",
      main: "./lib/index.js",
      types: "./lib/index.d.ts",
      exports: {
        ".": {
          types: "./lib/index.d.ts",
          default: "./lib/index.js",
        },
        "./package.json": "./package.json",
      },
    },
    null,
    2,
  )}\n`;

/**
 * Install one workspace package into a generated project's `node_modules`.
 *
 * Nine fixtures each carried their own copy of this, and seven of the nine
 * differed. Exactly one had grown the built-facade path, for exactly one
 * package, so eight fixtures handed over source roots no real consumer ever
 * sees and the ninth did it for every package but `@automovie/evidence`.
 *
 * A package outside the facade set is symlinked, which is what a workspace
 * consumer resolves to anyway.
 */
export const linkGeneratedWorkspacePackage = (props: {
  name: string;
  project: string;
  /** Named in the failure when the package root will not resolve. */
  subject?: string;
}): void => {
  const packageRoot = workspacePackageRoot(
    props.name,
    props.subject ?? "Generated consumer",
  );
  const target = path.join(
    props.project,
    "node_modules",
    ...props.name.split("/"),
  );
  if (fs.existsSync(target)) return;
  fs.mkdirSync(path.dirname(target), { recursive: true });
  // What a registry install would bring with it. A fixture naming packages by
  // hand gets the closure right only by accident: `@automovie/production`
  // depends on `@automovie/ingest`, no fixture had ever listed it, and while
  // the source root was linked nobody had to -- resolution walked out of the
  // symlink into the repository and found it there. Handing over the published
  // shape removes that escape hatch, and the bundle closure test named the one
  // package the lists had missed. So the closure is installed rather than
  // enumerated, which is also what makes the next such dependency arrive
  // without a fixture edit.
  for (const dependency of declaredDependencies(packageRoot))
    if (dependency.startsWith("@automovie/"))
      linkGeneratedWorkspacePackage({
        name: dependency,
        project: props.project,
        subject: props.subject,
      });
    else if (BUILT_FACADE_PACKAGES.has(props.name))
      linkDeclaredDependency({ name: dependency, project: props.project });
  if (BUILT_FACADE_PACKAGES.has(props.name) === false) {
    fs.symlinkSync(
      packageRoot,
      target,
      process.platform === "win32" ? "junction" : "dir",
    );
    return;
  }
  const build = path.join(packageRoot, "lib");
  if (builtOutputIsStale({ output: path.join(build, "index.js"), packageRoot }))
    rebuildWorkspacePackage(props.name);
  if (fs.existsSync(path.join(build, "index.d.ts")) === false)
    throw new Error(
      `The canonical ${props.name} build omitted its public declarations.`,
    );
  fs.mkdirSync(target, { recursive: true });
  fs.cpSync(build, path.join(target, "lib"), { recursive: true });
  fs.writeFileSync(
    path.join(target, "package.json"),
    publishedManifest(props.name),
    "utf8",
  );
};
