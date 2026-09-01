import path from "node:path";
import { pathToFileURL } from "node:url";
import { tsImport } from "tsx/esm/api";

const ROOT = path.resolve(__dirname, "..", "..", "..", "..");

export interface IPackWorkspaceDependencies {
  readonly remove: (directory: string) => void;
  readonly makeDirectory: (directory: string) => void;
  readonly pack: (
    directory: string,
    destination: string,
  ) => { readonly status: number | null; readonly stdout: string };
  readonly exists: (file: string) => boolean;
  readonly read: (file: string) => Buffer;
  readonly rename: (source: string, target: string) => void;
  readonly write: (message: string) => unknown;
}

export interface IWorkspacePackage {
  readonly key: string;
  readonly directory: string;
  readonly name: string;
}

export interface ITgzModule {
  readonly PACKAGES: readonly IWorkspacePackage[];
  readonly buildTgz: (
    root?: string,
    pack?: (target: string) => Record<string, string>,
    write?: (message: string) => unknown,
  ) => string;
  readonly buildTgzCli: (entry: boolean, run: () => unknown) => void;
  readonly isProcessEntry: (entry: string | undefined, file: string) => boolean;
  readonly packWorkspace: (
    target: string,
    dependencies?: IPackWorkspaceDependencies,
  ) => Record<string, string>;
  readonly packWorkspaceDependencies: IPackWorkspaceDependencies;
  readonly shellArgument: (value: string, shell: boolean) => string;
}

export interface IExperimentalDependencies {
  readonly pack: (target: string) => Record<string, string>;
  readonly install: (target: string) => number | null;
}

export interface IExperimentalWriter {
  write(message: string): unknown;
}

export interface IExperimentalModule {
  readonly EXPERIMENTAL_ROOT: string;
  readonly experimentalDependencies: IExperimentalDependencies;
  readonly runExperimentalInstall: (
    target: string,
    launch?: (
      command: string,
      argv: readonly string[],
      options: { cwd: string; shell: boolean; stdio: "inherit" },
    ) => { status: number | null },
  ) => number | null;
  readonly experimentalInstallRequest: (
    target: string,
    platform?: string,
  ) => {
    argv: readonly string[];
    command: string;
    options: { cwd: string; shell: boolean; stdio: "inherit" };
  };
  readonly runExperimental: (
    args: readonly string[],
    dependencies?: IExperimentalDependencies,
    output?: IExperimentalWriter,
    errorOutput?: IExperimentalWriter,
  ) => number;
  readonly runExperimentalCli: (
    entry: boolean,
    args: readonly string[],
    setExitCode: (code: number) => void,
  ) => void;
  readonly sandboxManifest: (
    rendered: string,
    specifiers: Readonly<Record<string, string>>,
  ) => string;
  readonly sandboxTarget: (name: string) => string;
  readonly setExperimentalExitCode: (code: number) => void;
}

/**
 * Load one of the repository's two root build tools at run time.
 *
 * The suite's `tsconfig.json` roots at `test/src`, so a static import of
 * `build/*.ts` is `TS6059`: the build tools are not a workspace package, so
 * nothing resolves them through `node_modules` the way `@automovie/engine` is
 * resolved. Loading them through `tsx` is the same route
 * `test_cli_capture_cleanup` already takes to reach a scaffold script, and it
 * runs the real module in this process rather than a copy of it, which is what
 * keeps the behaviour under test the behaviour the command executes.
 *
 * The exported shape is mirrored here rather than imported, so it can drift. A
 * renamed or removed export arrives as `undefined` and fails the first scenario
 * that reaches for it, which is loud enough: the alternative is a second surface
 * declaration that has to be kept in step with this one.
 *
 * `requireSourceModule` is the wrong door for these. Measured against
 * `packages/template/build`: requiring `syncVersions.ts` returned
 * `templateVersions.ts`'s exports and never ran syncVersions' body, and
 * requiring `templateVersions.ts` returned the generated
 * `packages/template/src/templateVersions.ts` instead. Both answered with a
 * module, neither with the one named. The guard catches exactly that, which is
 * why it exists, but a caught refusal is not a loaded module: this route is.
 */
export const loadRepositoryModule = async <T>(relative: string): Promise<T> =>
  (await tsImport(pathToFileURL(path.join(ROOT, relative)).href, {
    parentURL: pathToFileURL(__filename).href,
    tsconfig: false,
  })) as T;

export const loadBuildModule = async <T>(file: string): Promise<T> =>
  loadRepositoryModule<T>(path.join("build", file));
