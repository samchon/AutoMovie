import { TestValidator } from "@nestia/e2e";
import path from "node:path";

import {
  type IExperimentalSandboxTestIO,
  type IExperimentalSandboxTestSession,
  createExperimentalSandboxIO,
} from "../internal/createExperimentalSandboxIO";
import { loadSourceModule } from "../internal/loadSourceModule";

interface IPackResult {
  directory: string;
  generation: string;
  specifiers: Record<string, string>;
}

interface ILauncherDependencies {
  install(target: string): number | null;
  openSandbox(props: {
    create: boolean;
    overwrite?: boolean;
    root: string;
    target: string;
  }): IExperimentalSandboxTestSession;
  pack(target: string, assertCurrent: () => void): IPackResult;
  render(props: { language: string; name: string }): Record<string, string>;
}

const {
  EXPERIMENTAL_ROOT,
  experimentalFailureMessage,
  packExperimentalWorkspace,
  runExperimental,
} = loadSourceModule<{
  EXPERIMENTAL_ROOT: string;
  experimentalFailureMessage: (error: unknown) => string;
  packExperimentalWorkspace: (
    target: string,
    assertCurrent: () => void,
    pack: (
      target: string,
      dependencies: undefined,
      packages: undefined,
      assertCurrent: () => void,
    ) => IPackResult,
  ) => IPackResult;
  runExperimental: (
    args: readonly string[],
    dependencies: ILauncherDependencies | undefined,
    output: { write(message: string): unknown },
    error: { write(message: string): unknown },
  ) => number;
}>(path.resolve(__dirname, "../../../../build/experimental.ts"));
const { openExperimentalSandbox } = loadSourceModule<{
  openExperimentalSandbox: (
    props: {
      create: boolean;
      overwrite?: boolean;
      root: string;
      target: string;
    },
    io: IExperimentalSandboxTestIO,
  ) => IExperimentalSandboxTestSession;
}>(path.resolve(__dirname, "../../../../build/experimentalSandbox.ts"));
const { AUTO_MOVIE_CONTRACT_BASELINE_PATH } = loadSourceModule<{
  AUTO_MOVIE_CONTRACT_BASELINE_PATH: string;
}>(
  path.resolve(
    __dirname,
    "../../../../packages/template/src/productionMaintenance.ts",
  ),
);

/**
 * Creation and refresh use one physical approval through pack, write and install.
 *
 * Scenarios:
 * 1. Creation and forced creation render the selected language; refresh retains
 *    authored files and no-install rewrites only the manifest with existing pins.
 * 2. Missing manifest/baseline, language mismatch, and nonempty creation fail
 *    before packing, publication, and installation.
 * 3. Changes during pack or at the install message refuse all later mutations;
 *    nonzero and signalled installers remain failures with the correct recovery.
 * 4. The pack adapter receives the original currentness callback unchanged;
 *    help and non-Error failures preserve the command's ordinary reporting.
 */
export const test_workspace_experimental_sandbox_launcher = (): void => {
  const target = path.join(EXPERIMENTAL_ROOT, "sample");
  const manifest = path.join(target, "package.json");
  const original = JSON.stringify({
    dependencies: { "@automovie/engine": "file:./.tarballs-old/engine.tgz" },
    scripts: { authored: "keep" },
  });
  const baseline = JSON.stringify({
    files: [],
    language: "english",
    protocol: "automovie.contract-baseline.v1",
    version: "0.1.0",
  });
  const packed = {
    directory: path.join(target, ".tarballs-new"),
    generation: "new",
    specifiers: { engine: "file:./.tarballs-new/engine.tgz" },
  };
  const run = (options: {
    args: string[];
    authored?: boolean;
    baseline?: string | null;
    fault?:
      | "pack-target"
      | "pack-manifest"
      | "before-install-target"
      | "before-install-manifest"
      | "after-install"
      | "pack-primitive";
    manifest?: boolean;
    status?: number | null;
  }) => {
    const memory = createExperimentalSandboxIO(target);
    if (options.manifest) memory.putFile(manifest, original);
    if (options.baseline !== undefined && options.baseline !== null) {
      memory.putFile(
        path.join(target, AUTO_MOVIE_CONTRACT_BASELINE_PATH),
        options.baseline,
      );
      memory.putDirectory(
        path.dirname(path.join(target, AUTO_MOVIE_CONTRACT_BASELINE_PATH)),
      );
    }
    if (options.authored)
      memory.putFile(path.join(target, "authored.txt"), "authored");
    const events: string[] = [];
    const output: string[] = [];
    const error: string[] = [];
    const dependencies: ILauncherDependencies = {
      install: () => {
        events.push("install");
        if (options.fault === "after-install") memory.putDirectory(target);
        return options.status === undefined ? 0 : options.status;
      },
      openSandbox: (props) => openExperimentalSandbox(props, memory.io),
      pack: (destination, assertCurrent) => {
        events.push("pack");
        TestValidator.equals(
          "pack uses the approved sandbox",
          destination,
          target,
        );
        if (options.fault === "pack-target") memory.putDirectory(target);
        if (options.fault === "pack-manifest")
          memory.putFile(manifest, "competitor");
        if (options.fault === "pack-primitive") throw "pack refused";
        assertCurrent();
        return packed;
      },
      render: (props) => {
        events.push(`render:${props.language}`);
        return { "package.json": original, "authored.txt": "rendered" };
      },
    };
    const code = runExperimental(
      options.args,
      dependencies,
      {
        write: (message) => {
          output.push(message);
          if (message.startsWith("Installing")) {
            if (options.fault === "before-install-target")
              memory.putDirectory(target);
            if (options.fault === "before-install-manifest")
              memory.putFile(manifest, original);
          }
        },
      },
      { write: (message) => error.push(message) },
    );
    return { code, error, events, memory, output };
  };

  const created = run({
    args: ["sample", "--language", "korean", "--no-install"],
  });
  TestValidator.equals(
    "creation renders selected language only",
    [created.code, created.events],
    [0, ["render:korean"]],
  );
  const forced = run({
    args: ["sample", "--language", "english", "--force"],
    authored: true,
    manifest: true,
  });
  TestValidator.equals(
    "force preserves pack and install semantics",
    [forced.code, forced.events],
    [0, ["render:english", "pack", "install"]],
  );
  TestValidator.equals(
    "force explicitly replaces scaffold-owned content",
    forced.memory.files
      .get(path.join(target, "authored.txt"))!
      .bytes.toString(),
    "rendered",
  );

  for (const install of [false, true]) {
    const refreshed = run({
      args: ["sample", "--refresh", ...(install ? [] : ["--no-install"])],
      authored: true,
      baseline,
      manifest: true,
    });
    TestValidator.equals(
      "refresh does not render",
      [refreshed.code, refreshed.events],
      [0, install ? ["pack", "install"] : []],
    );
    TestValidator.equals(
      "refresh preserves authored content",
      refreshed.memory.files
        .get(path.join(target, "authored.txt"))!
        .bytes.toString(),
      "authored",
    );
    const result = JSON.parse(
      refreshed.memory.files.get(manifest)!.bytes.toString(),
    ) as {
      dependencies: Record<string, string>;
      scripts: Record<string, string>;
    };
    TestValidator.equals(
      "refresh pins match actual packing",
      result.dependencies["@automovie/engine"],
      install ? packed.specifiers.engine : "file:./.tarballs-old/engine.tgz",
    );
    TestValidator.equals(
      "authored manifest fields survive",
      result.scripts.authored,
      "keep",
    );
    TestValidator.predicate(
      "no-install reporting discloses no pack",
      install ||
        refreshed.output.some((message) =>
          message.includes("--no-install packed nothing"),
        ),
    );
  }
  for (const input of [
    {
      args: ["sample", "--refresh"],
      baseline,
      manifest: false,
      diagnostic: "no package.json",
    },
    {
      args: ["sample", "--refresh"],
      baseline: null,
      manifest: true,
      diagnostic: "no frozen contract baseline",
    },
    {
      args: ["sample", "--refresh", "--language", "korean"],
      baseline,
      manifest: true,
      diagnostic: "cannot change",
    },
    {
      args: ["sample", "--language", "english"],
      baseline,
      manifest: true,
      diagnostic: "not empty",
    },
  ]) {
    const refused = run(input);
    TestValidator.equals("invalid preflight refuses", refused.code, 1);
    TestValidator.predicate(
      "diagnostic preserves cause",
      refused.error.join("").includes(input.diagnostic),
    );
    TestValidator.equals(
      "invalid preflight has no effects",
      refused.events.filter((event) => event === "pack" || event === "install"),
      [],
    );
    TestValidator.equals(
      "invalid preflight writes no files",
      refused.memory.events.some((event) => event.startsWith("write:")),
      false,
    );
  }
  for (const fault of [
    "pack-target",
    "pack-manifest",
    "before-install-target",
    "before-install-manifest",
    "after-install",
    "pack-primitive",
  ] as const) {
    const refused = run({
      args: ["sample", "--refresh"],
      baseline,
      manifest: true,
      fault,
    });
    TestValidator.equals(`${fault} is refused`, refused.code, 1);
    TestValidator.equals(
      "install starts only before the post-install fault",
      refused.events.includes("install"),
      fault === "after-install",
    );
    if (fault.startsWith("pack-"))
      TestValidator.equals(
        "pack refusal writes nothing",
        refused.memory.events.some((event) => event.startsWith("write:")),
        false,
      );
    if (fault === "pack-primitive")
      TestValidator.equals("non-Error cause is reported", refused.error, [
        "pack refused\n",
      ]);
  }
  for (const refresh of [false, true])
    for (const status of [7, null]) {
      const failed = run({
        args: refresh
          ? ["sample", "--refresh"]
          : ["sample", "--language", "english", "--force"],
        baseline,
        manifest: true,
        status,
      });
      TestValidator.equals(
        "failed installer cannot report success",
        failed.code,
        1,
      );
      TestValidator.predicate(
        "failure retains mode-specific recovery",
        failed.error.join("").includes(refresh ? "--refresh" : "--force"),
      );
    }
  const help: string[] = [];
  TestValidator.equals(
    "help needs no sandbox effects",
    runExperimental(
      [],
      undefined,
      { write: (message) => help.push(message) },
      { write: () => undefined },
    ),
    0,
  );
  TestValidator.predicate(
    "help contains usage",
    help.join("").includes("Usage:"),
  );
  let calls = 0;
  const current = (): void => {
    calls++;
  };
  TestValidator.equals(
    "pack wrapper returns its actual generation",
    packExperimentalWorkspace(
      target,
      current,
      (destination, dependencies, packages, assertCurrent) => {
        TestValidator.equals(
          "pack wrapper retains target and defaults",
          [destination, dependencies, packages],
          [target, undefined, undefined],
        );
        TestValidator.predicate(
          "pack wrapper retains original callback",
          current === assertCurrent,
        );
        assertCurrent();
        return packed;
      },
    ),
    packed,
  );
  TestValidator.equals("pack callback executed once", calls, 1);
  TestValidator.equals(
    "packing and cleanup causes remain visible",
    experimentalFailureMessage(
      new AggregateError(
        [
          new Error("pack failed"),
          new AggregateError(["target changed"], "cleanup refused"),
        ],
        "operation failed",
      ),
    ),
    "operation failed\npack failed\ncleanup refused\ntarget changed",
  );
};
