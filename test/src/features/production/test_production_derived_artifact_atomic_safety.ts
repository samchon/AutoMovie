import {
  AutoMovieDerivedArtifactGenerationError,
  generateAutoMovieDerivedArtifact,
} from "@automovie/production";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { withDerivedArtifactFixture } from "../internal/derivedArtifactFixtures";

const generationCode = (task: () => unknown): string | null => {
  try {
    task();
    return null;
  } catch (error) {
    return error instanceof AutoMovieDerivedArtifactGenerationError
      ? error.code
      : `unexpected:${error instanceof Error ? error.message : String(error)}`;
  }
};

const generate = (
  fixture: Parameters<Parameters<typeof withDerivedArtifactFixture>[0]>[0],
  bytes: Uint8Array = new Uint8Array([1]),
): unknown =>
  generateAutoMovieDerivedArtifact({
    root: fixture.root,
    generator: fixture.generator,
    inputs: [fixture.input],
    output: fixture.output,
    encoding: "base64",
    generate: () => bytes,
  });

const changedStatus = (status: fs.BigIntStats): fs.BigIntStats =>
  new Proxy(status, {
    get: (target, property) =>
      property === "ino"
        ? target.ino + 1n
        : Reflect.get(target, property, target),
  });

const replaceFsFunction = <Name extends "lstatSync" | "statSync">(
  name: Name,
  value: (typeof fs)[Name],
): (() => void) => {
  const descriptor = Object.getOwnPropertyDescriptor(fs, name)!;
  Object.defineProperty(fs, name, { ...descriptor, value });
  return () => Object.defineProperty(fs, name, descriptor);
};

/** Atomic publication rechecks every physical path and namespace race. */
export const test_production_derived_artifact_atomic_safety = (): void => {
  withDerivedArtifactFixture((fixture) => {
    const props = {
      root: fixture.root,
      generator: fixture.generator,
      inputs: [fixture.input],
      output: fixture.output,
      encoding: "base64" as const,
      generate: () => {
        props.output = "../escaped.bin";
        return new Uint8Array([1]);
      },
    };
    TestValidator.equals(
      "a callback cannot mutate its output path past validation",
      generationCode(() => generateAutoMovieDerivedArtifact(props)),
      "publication-failed",
    );
  });

  withDerivedArtifactFixture((fixture) => {
    const originalResolve = path.resolve;
    path.resolve = ((...segments: string[]): string =>
      segments.length > 1 && segments.at(-1) === "result.bin"
        ? originalResolve(fixture.root, "..", "escaped.bin")
        : originalResolve(...segments)) as typeof path.resolve;
    try {
      TestValidator.equals(
        "resolved output cannot escape the physical root",
        generationCode(() => generate(fixture)),
        "publication-failed",
      );
    } finally {
      path.resolve = originalResolve;
    }
  });

  withDerivedArtifactFixture((fixture) => {
    const output = path.join(fixture.root, ...fixture.output.split("/"));
    fs.mkdirSync(output, { recursive: true });
    TestValidator.equals(
      "resident output directory cannot masquerade as a file",
      generationCode(() => generate(fixture)),
      "publication-failed",
    );
  });

  withDerivedArtifactFixture((fixture) => {
    const generator = path.join(fixture.root, ...fixture.generator.split("/"));
    const originalRealpath = fs.realpathSync;
    fs.realpathSync = ((target: fs.PathLike): string =>
      String(target) === generator
        ? path.join(path.dirname(fixture.root), "outside-generator.ts")
        : originalRealpath(target)) as typeof fs.realpathSync;
    try {
      TestValidator.equals(
        "a generator resolving outside the root refuses",
        generationCode(() => generate(fixture)),
        "path-unsafe",
      );
    } finally {
      fs.realpathSync = originalRealpath;
    }
  });

  withDerivedArtifactFixture((fixture) => {
    const automovie = path.join(fixture.root, "automovie");
    fs.mkdirSync(automovie);
    const originalResolve = path.resolve;
    path.resolve = ((...segments: string[]): string =>
      segments.length === 1 && segments[0] === automovie
        ? originalResolve(fixture.root, "..", "outside-automovie")
        : originalResolve(...segments)) as typeof path.resolve;
    try {
      TestValidator.equals(
        "owned directory resolution cannot escape",
        generationCode(() => generate(fixture)),
        "publication-failed",
      );
    } finally {
      path.resolve = originalResolve;
    }
  });

  withDerivedArtifactFixture((fixture) => {
    const automovie = path.join(fixture.root, "automovie");
    fs.mkdirSync(automovie);
    const originalRealpath = fs.realpathSync;
    fs.realpathSync = ((target: fs.PathLike): string =>
      String(target) === automovie
        ? path.join(path.dirname(fixture.root), "outside-automovie")
        : originalRealpath(target)) as typeof fs.realpathSync;
    try {
      TestValidator.equals(
        "owned directory physical resolution cannot escape",
        generationCode(() => generate(fixture)),
        "publication-failed",
      );
    } finally {
      fs.realpathSync = originalRealpath;
    }
  });

  withDerivedArtifactFixture((fixture) => {
    const scripts = path.join(fixture.root, "scripts");
    const originalResolve = path.resolve;
    path.resolve = ((...segments: string[]): string =>
      segments.length === 1 && segments[0] === scripts
        ? originalResolve(fixture.root, "..", "outside-scripts")
        : originalResolve(...segments)) as typeof path.resolve;
    try {
      TestValidator.equals(
        "read ancestry resolution cannot escape",
        generationCode(() => generate(fixture)),
        "path-unsafe",
      );
    } finally {
      path.resolve = originalResolve;
    }
  });

  withDerivedArtifactFixture((fixture) => {
    const scripts = path.join(fixture.root, "scripts");
    const originalRealpath = fs.realpathSync;
    fs.realpathSync = ((target: fs.PathLike): string =>
      String(target) === scripts
        ? path.join(path.dirname(fixture.root), "outside-scripts")
        : originalRealpath(target)) as typeof fs.realpathSync;
    try {
      TestValidator.equals(
        "read ancestry physical resolution cannot escape",
        generationCode(() => generate(fixture)),
        "path-unsafe",
      );
    } finally {
      fs.realpathSync = originalRealpath;
    }
  });

  withDerivedArtifactFixture((fixture) => {
    const scripts = path.join(fixture.root, "scripts");
    const originalLstat = fs.lstatSync;
    const restoreLstat = replaceFsFunction("lstatSync", ((
      target: fs.PathLike,
      options?: unknown,
    ): fs.Stats => {
      if (String(target) === scripts) {
        const error = new Error(
          "injected missing ancestry",
        ) as NodeJS.ErrnoException;
        error.code = "ENOENT";
        throw error;
      }
      return originalLstat(target, options as never);
    }) as typeof fs.lstatSync);
    try {
      TestValidator.equals(
        "vanished read ancestry refuses",
        generationCode(() => generate(fixture)),
        "path-unsafe",
      );
    } finally {
      restoreLstat();
    }
  });

  withDerivedArtifactFixture((fixture) => {
    const generator = path.join(fixture.root, ...fixture.generator.split("/"));
    const originalLstat = fs.lstatSync;
    const restoreLstat = replaceFsFunction("lstatSync", ((
      target: fs.PathLike,
      options?: unknown,
    ): fs.Stats => {
      if (String(target) === generator) {
        const error = new Error(
          "injected access failure",
        ) as NodeJS.ErrnoException;
        error.code = "EACCES";
        throw error;
      }
      return originalLstat(target, options as never);
    }) as typeof fs.lstatSync);
    try {
      TestValidator.equals(
        "non-missing lstat failure propagates as publication failure",
        generationCode(() => generate(fixture)),
        "publication-failed",
      );
    } finally {
      restoreLstat();
    }
  });

  withDerivedArtifactFixture((fixture) => {
    const external = fs.mkdtempSync(
      path.join(os.tmpdir(), "automovie-derived-output-parent-"),
    );
    const automovie = path.join(fixture.root, "automovie");
    const derived = path.join(automovie, "derived");
    fs.mkdirSync(automovie);
    try {
      fs.symlinkSync(external, derived, "junction");
      TestValidator.equals(
        "linked output ancestry refuses publication",
        generationCode(() => generate(fixture)),
        "publication-failed",
      );
    } finally {
      fs.rmSync(derived, { recursive: true, force: true });
      fs.rmSync(external, { recursive: true, force: true });
    }
  });

  withDerivedArtifactFixture((fixture) => {
    const output = path.join(fixture.root, ...fixture.output.split("/"));
    fs.mkdirSync(output, { recursive: true });
    const originalLstat = fs.lstatSync;
    let outputReads = 0;
    const restoreLstat = replaceFsFunction("lstatSync", ((
      target: fs.PathLike,
      options?: unknown,
    ): fs.Stats => {
      if (String(target) === output && ++outputReads === 1) {
        const error = new Error(
          "injected absent leaf",
        ) as NodeJS.ErrnoException;
        error.code = "ENOENT";
        throw error;
      }
      return originalLstat(target, options as never);
    }) as typeof fs.lstatSync);
    try {
      TestValidator.equals(
        "output replacement before leaf assertion refuses",
        generationCode(() => generate(fixture)),
        "publication-failed",
      );
    } finally {
      restoreLstat();
    }
  });

  withDerivedArtifactFixture((fixture) => {
    generate(fixture, new Uint8Array([1]));
    const output = path.join(fixture.root, ...fixture.output.split("/"));
    const originalRealpath = fs.realpathSync;
    let outputReads = 0;
    fs.realpathSync = ((target: fs.PathLike): string =>
      String(target) === output && ++outputReads === 2
        ? path.join(path.dirname(fixture.root), "outside-output.bin")
        : originalRealpath(target)) as typeof fs.realpathSync;
    try {
      TestValidator.equals(
        "output replacement before atomic write refuses",
        generationCode(() => generate(fixture, new Uint8Array([2]))),
        "publication-failed",
      );
    } finally {
      fs.realpathSync = originalRealpath;
    }
  });

  withDerivedArtifactFixture((fixture) => {
    const originalStat = fs.statSync;
    let rootReads = 0;
    const restoreStat = replaceFsFunction("statSync", ((
      target: fs.PathLike,
      options?: unknown,
    ): fs.Stats => {
      const status = originalStat(target, options as never);
      if (
        String(target) === fixture.root &&
        options !== undefined &&
        ++rootReads === 3
      )
        return changedStatus(
          status as unknown as fs.BigIntStats,
        ) as unknown as fs.Stats;
      return status;
    }) as typeof fs.statSync);
    try {
      TestValidator.equals(
        "root identity change before rename refuses",
        generationCode(() => generate(fixture)),
        "publication-failed",
      );
    } finally {
      restoreStat();
    }
  });

  withDerivedArtifactFixture((fixture) => {
    const derived = path.join(fixture.root, "automovie", "derived");
    const originalStat = fs.statSync;
    let derivedReads = 0;
    const restoreStat = replaceFsFunction("statSync", ((
      target: fs.PathLike,
      options?: unknown,
    ): fs.Stats => {
      const status = originalStat(target, options as never);
      if (
        String(target) === derived &&
        options !== undefined &&
        ++derivedReads === 3
      )
        return changedStatus(
          status as unknown as fs.BigIntStats,
        ) as unknown as fs.Stats;
      return status;
    }) as typeof fs.statSync);
    try {
      TestValidator.equals(
        "output ancestry change after rename refuses manifest publication",
        generationCode(() => generate(fixture)),
        "publication-failed",
      );
      TestValidator.predicate(
        "manifest-last leaves the renamed output visibly stale, not current",
        fs.existsSync(
          path.join(fixture.root, "automovie", "derived-artifacts.json"),
        ) === false,
      );
    } finally {
      restoreStat();
    }
  });

  withDerivedArtifactFixture((fixture) => {
    const originalLstat = fs.lstatSync;
    let rootReads = 0;
    const restoreLstat = replaceFsFunction("lstatSync", ((
      target: fs.PathLike,
      options?: unknown,
    ): fs.Stats => {
      const status = originalLstat(target, options as never);
      if (String(target) !== fixture.root || ++rootReads !== 2) return status;
      return new Proxy(status, {
        get: (resident, property) =>
          property === "isSymbolicLink"
            ? (): boolean => true
            : Reflect.get(resident, property, resident),
      });
    }) as typeof fs.lstatSync);
    try {
      TestValidator.equals(
        "root replacement before identity capture refuses",
        generationCode(() => generate(fixture)),
        "publication-failed",
      );
    } finally {
      restoreLstat();
    }
  });
};
