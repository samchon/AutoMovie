import {
  AutoMovieProductionProject,
  AutoMovieProject,
} from "@automovie/production";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { loadSourceModule } from "../internal/loadSourceModule";
import { throwsError } from "../internal/predicates";
import { productionFixture } from "./productionFixtures";

interface RevisionModule {
  decodeAutoMovieProjectRevision(
    value: unknown,
  ): { state: "current"; revision: number } | { state: "invalid" };
  advanceAutoMovieProjectRevision(
    revision: number,
  ): { state: "next"; revision: number } | { state: "invalid" | "exhausted" };
}

const filesOf = (root: string): Array<[string, string]> => {
  const output: Array<[string, string]> = [];
  const visit = (directory: string): void => {
    for (const entry of fs
      .readdirSync(directory, { withFileTypes: true })
      .sort((left, right) => left.name.localeCompare(right.name))) {
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(target);
      else if (entry.isFile())
        output.push([
          path.relative(root, target).replaceAll("\\", "/"),
          fs.readFileSync(target).toString("base64"),
        ]);
    }
  };
  visit(root);
  return output;
};

/**
 * Project revisions remain exactly representable through every read and write.
 *
 * Scenarios:
 *
 * 1. A missing record maps to zero, ordinary boundaries decode, and malformed,
 *    negative, fractional, non-finite, and unsafe values refuse.
 * 2. Zero and `MAX_SAFE_INTEGER - 1` advance exactly, while exhaustion and an
 *    invalid current value have distinct outcomes.
 * 3. The resident store rejects malformed persisted revisions and refuses an
 *    exhausted mutation before changing an asset, manifest, lock, or revision.
 * 4. The production store likewise refuses an exhausted deliverable commit
 *    before changing any project bytes.
 * 5. Erase-audit naming consumes the same guarded successor and therefore
 *    cannot publish an audit or erase its target at exhaustion.
 */
export const test_production_project_revision = (): void => {
  const revisionModule = loadSourceModule<RevisionModule>(
    path.resolve(
      __dirname,
      "../../../../packages/production/src/project/projectRevision.ts",
    ),
  );
  TestValidator.equals(
    "project revision decoded domain",
    [
      undefined,
      { revision: 0 },
      { revision: Number.MAX_SAFE_INTEGER },
      null,
      {},
      { revision: -1 },
      { revision: 0.5 },
      { revision: Number.NaN },
      { revision: Number.POSITIVE_INFINITY },
      { revision: Number.MAX_SAFE_INTEGER + 1 },
      { revision: "1" },
    ].map((value) => revisionModule.decodeAutoMovieProjectRevision(value)),
    [
      { state: "current", revision: 0 },
      { state: "current", revision: 0 },
      { state: "current", revision: Number.MAX_SAFE_INTEGER },
      { state: "invalid" },
      { state: "invalid" },
      { state: "invalid" },
      { state: "invalid" },
      { state: "invalid" },
      { state: "invalid" },
      { state: "invalid" },
      { state: "invalid" },
    ],
  );
  TestValidator.equals(
    "project revision advance boundary",
    [
      0,
      Number.MAX_SAFE_INTEGER - 1,
      Number.MAX_SAFE_INTEGER,
      -1,
      0.5,
      Number.MAX_SAFE_INTEGER + 1,
    ].map(revisionModule.advanceAutoMovieProjectRevision),
    [
      { state: "next", revision: 1 },
      { state: "next", revision: Number.MAX_SAFE_INTEGER },
      { state: "exhausted" },
      { state: "invalid" },
      { state: "invalid" },
      { state: "invalid" },
    ],
  );

  const root = fs.mkdtempSync(path.join(os.tmpdir(), "automovie-revision-"));
  try {
    for (const [index, revision] of [
      -1,
      0.5,
      Number.MAX_SAFE_INTEGER + 1,
    ].entries()) {
      const invalidRoot = path.join(root, `invalid-${index}`);
      AutoMovieProject.open(invalidRoot);
      fs.writeFileSync(
        path.join(invalidRoot, "revision.json"),
        `${JSON.stringify({ revision })}\n`,
      );
      TestValidator.predicate(
        `resident invalid revision ${index} refuses on reopen`,
        throwsError(
          () => AutoMovieProject.open(invalidRoot),
          ["revision.json", "non-negative safe-integer"],
        ),
      );
    }

    const residentRoot = path.join(root, "resident-exhausted");
    AutoMovieProject.open(residentRoot);
    fs.writeFileSync(
      path.join(residentRoot, "revision.json"),
      `${JSON.stringify({ revision: Number.MAX_SAFE_INTEGER })}\n`,
    );
    const resident = AutoMovieProject.open(residentRoot);
    const residentBefore = filesOf(residentRoot);
    TestValidator.predicate(
      "resident exhausted revision refuses before mutation",
      throwsError(
        () =>
          resident.registerAsset("assets/overflow.bin", new Uint8Array([1])),
        ["revision is exhausted", "no project bytes were written"],
      ),
    );
    TestValidator.equals(
      "resident exhaustion leaves every project byte unchanged",
      filesOf(residentRoot),
      residentBefore,
    );

    const productionRoot = path.join(root, "production-exhausted");
    fs.mkdirSync(productionRoot);
    AutoMovieProductionProject.open(productionRoot, "p");
    const productionRevision = path.join(
      productionRoot,
      "automovie",
      "productions",
      "p",
      "revision.json",
    );
    fs.writeFileSync(
      productionRevision,
      `${JSON.stringify({ revision: Number.MAX_SAFE_INTEGER })}\n`,
    );
    const production = AutoMovieProductionProject.open(productionRoot, "p");
    const productionBefore = filesOf(productionRoot);
    TestValidator.predicate(
      "production exhausted revision refuses before deliverable mutation",
      throwsError(
        () =>
          production.commitProductionDeliverableFiles(
            "delivery",
            new Map([["clip.bin", new Uint8Array([1])]]),
          ),
        ["revision is exhausted", "No production bytes were written"],
      ),
    );
    TestValidator.equals(
      "production exhaustion leaves every project byte unchanged",
      filesOf(productionRoot),
      productionBefore,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }

  const fixture = productionFixture();
  try {
    const project = AutoMovieProductionProject.open(
      fixture.root,
      "fixture-film",
    );
    const revisionFile = path.join(
      fixture.root,
      "automovie",
      "productions",
      "fixture-film",
      "revision.json",
    );
    fs.writeFileSync(
      revisionFile,
      `${JSON.stringify({ revision: Number.MAX_SAFE_INTEGER })}\n`,
    );
    const acceptance = project.graph().acceptance.keys().next().value as
      | string
      | undefined;
    if (acceptance === undefined)
      throw new Error("Revision fixture requires one acceptance design.");
    const before = filesOf(fixture.root);
    TestValidator.predicate(
      "erase audit refuses an exhausted successor before mutation",
      throwsError(
        () =>
          project.eraseDesignArtifact({ kind: "acceptance", id: acceptance }),
        ["revision is exhausted", "No production bytes were written"],
      ),
    );
    TestValidator.equals(
      "erase exhaustion leaves the design and audit tree unchanged",
      filesOf(fixture.root),
      before,
    );
  } finally {
    fixture.dispose();
  }
};
