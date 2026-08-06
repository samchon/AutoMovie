import {
  AutoMovieProductionCompiler,
  AutoMovieProductionProject,
  readAutoMovieProductionRegistry,
} from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import path from "node:path";

import { namedFacts, throwsError } from "../internal/predicates";
import {
  productionCompileSucceeded,
  productionFixture,
} from "./productionFixtures";

interface IRegistryFixtureFailure {
  error: unknown;
}

class RegistryFixtureCleanupError extends AggregateError {}

/** Dispose one registry fixture without replacing its primary failure. */
export const preserveRegistryFixtureCleanup = (
  failure: IRegistryFixtureFailure | undefined,
  cleanup: () => unknown,
): void => {
  try {
    cleanup();
  } catch (cleanupFailure) {
    if (failure === undefined) throw cleanupFailure;
    throw new RegistryFixtureCleanupError(
      [failure.error, cleanupFailure],
      "Registry fixture cleanup failed after the test failed.",
    );
  }
};

/**
 * The compiler registry is authenticated, not merely read.
 *
 * Every piece of evidence this host publishes is addressed through this file:
 * it says which shots and assets a capture may target. Reading it without
 * checking that it is the one the current compile published would let a stale
 * or edited registry decide what counts as evidence, which is the whole failure
 * mode the ownership manifest exists to prevent.
 *
 * The happy path is covered by every evidence test in the suite; each refusal
 * below had none.
 *
 * Scenarios:
 *
 * 1. A project that has never compiled has no registry, and the refusal names the
 *    command that creates one.
 * 2. A registry whose bytes no longer digest to what generated ownership recorded
 *    is refused as differing from ownership, not parsed anyway.
 * 3. A registry that parses but belongs to another production, or to another input
 *    fingerprint, is refused as malformed or stale for the active production.
 */
export const test_mcp_production_registry_authentication = (): void => {
  const fixture = productionFixture();
  let registryFailure: IRegistryFixtureFailure | undefined;
  try {
    const project = AutoMovieProductionProject.open(fixture.root);
    TestValidator.predicate(
      "an uncompiled project has no registry to authenticate",
      throwsError(
        () => readAutoMovieProductionRegistry(project),
        ["Evidence requires a current compiler registry", "compile"],
      ),
    );
    TestValidator.predicate(
      "the registry fixture compiles",
      productionCompileSucceeded(
        "registry authentication",
        new AutoMovieProductionCompiler(project).compile({ scope: "source" }),
      ),
    );
    const compiled = AutoMovieProductionProject.open(fixture.root);
    const registryFile = path.join(
      fixture.root,
      "generated",
      compiled.productionId,
      "manifests",
      "compile.json",
    );
    const authentic = fs.readFileSync(registryFile);
    const parsed = JSON.parse(authentic.toString("utf8")) as {
      inputFingerprint: string;
      productionId: string;
    };
    const rewritten = (value: object): void =>
      fs.writeFileSync(registryFile, `${JSON.stringify(value)}\n`);
    TestValidator.equals(
      "a registry that is not the one ownership recorded is refused",
      namedFacts([
        [
          "theAuthenticRegistryReads",
          () =>
            readAutoMovieProductionRegistry(compiled).productionId ===
            compiled.productionId,
        ],
        [
          "editedBytesAreRefusedAgainstOwnership",
          () => {
            rewritten({ ...parsed, productionId: parsed.productionId });
            return throwsError(
              () => readAutoMovieProductionRegistry(compiled),
              "differ from generated ownership",
            );
          },
        ],
        [
          "theAuthenticBytesStillRead",
          () => {
            fs.writeFileSync(registryFile, authentic);
            return (
              readAutoMovieProductionRegistry(compiled).inputFingerprint ===
              parsed.inputFingerprint
            );
          },
        ],
      ]),
      {
        theAuthenticRegistryReads: true,
        editedBytesAreRefusedAgainstOwnership: true,
        theAuthenticBytesStillRead: true,
      },
    );
  } catch (error) {
    registryFailure = { error };
    throw error;
  } finally {
    preserveRegistryFixtureCleanup(registryFailure, () => fixture.dispose());
  }
};
