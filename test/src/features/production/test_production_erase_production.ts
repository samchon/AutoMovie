import {
  AutoMovieProductionCompiler,
  AutoMovieProductionProject,
} from "@automovie/production";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import path from "node:path";

import {
  createTestFileSystem,
  withTestFileSystem,
} from "../internal/testFileSystem";
import {
  productionCompileSucceeded,
  productionFixture,
} from "./productionFixtures";

const platformError = (code: string): Error =>
  Object.assign(new Error(code), { code });

const failure = (
  task: () => unknown,
): { message: string; causes: string[] } | null => {
  try {
    task();
    return null;
  } catch (error) {
    return {
      message: (error as Error).message,
      causes:
        error instanceof AggregateError
          ? error.errors.map((cause) => (cause as Error).message)
          : [],
    };
  }
};

/** Which production-owned roots are resident under the fixture. */
const roots = (owned: Record<string, string>): Record<string, boolean> =>
  Object.fromEntries(
    Object.entries(owned).map(([name, absolute]) => [
      name,
      fs.existsSync(absolute),
    ]),
  );

const quarantines = (root: string): string[] =>
  fs
    .readdirSync(path.join(root, "automovie"))
    .filter((entry) => entry.startsWith(".erase-"));

/**
 * Erasing a production is one audited, identity-fenced move of every owned
 * root into quarantine, or nothing at all.
 *
 * Scenarios:
 *
 * 1. A blank audit reason and a linked owned root are refused before any move.
 * 2. A refused move after the first root was quarantined puts that root back
 *    and leaves no quarantine; an identity that cannot be confirmed during that
 *    rollback stops it, and a refused rollback move is reported as incomplete.
 *    A registry write refused after the audit record landed rolls the moves
 *    back and removes that audit record too.
 * 3. A clean erase quarantines every owned root, records the audit reason,
 *    removes the production from the registry, and refuses further writes.
 */
export const test_production_erase_production = (): void => {
  const fixture = productionFixture();
  try {
    const opened = AutoMovieProductionProject.open(fixture.root);
    const compiled = new AutoMovieProductionCompiler(opened).compile({
      scope: "source",
    });
    if (productionCompileSucceeded("erase fixture", compiled) === false)
      throw new Error("The erase fixture did not compile.");
    const generated = opened.generatedRoot();
    const owned = {
      design: path.join(fixture.root, "automovie", "design", "fixture-film"),
      generated,
      state: path.join(
        fixture.root,
        "automovie",
        "productions",
        "fixture-film",
      ),
    };
    const generatedSuffix = generated.slice(
      generated.lastIndexOf(path.sep, generated.lastIndexOf(path.sep) - 1),
    );
    const before = roots(owned);

    // 1. Refusals before any move.
    const blank = failure(() =>
      AutoMovieProductionProject.open(fixture.root).eraseProduction("  "),
    );
    // Every owned root is proven physical when the erase begins, so a link can
    // only appear between that proof and the move: the generated root reports
    // itself as a link once the design root has been quarantined.
    let designQuarantined = false;
    const linkedRoot = createTestFileSystem({
      renameSync: ((...args: unknown[]) => {
        if (String(args[0]) === owned.design) designQuarantined = true;
        return Reflect.apply(fs.renameSync, fs, args);
      }) as typeof fs.renameSync,
      lstatSync: ((...args: unknown[]) => {
        const stats = Reflect.apply(fs.lstatSync, fs, args) as fs.Stats;
        return designQuarantined && String(args[0]) === generated
          ? Object.assign(Object.create(stats), { isSymbolicLink: () => true })
          : stats;
      }) as typeof fs.lstatSync,
    });
    const linked = failure(() =>
      withTestFileSystem(linkedRoot.fileSystem, () =>
        AutoMovieProductionProject.open(fixture.root).eraseProduction(
          "linked root",
        ),
      ),
    );
    const afterRefusals = {
      roots: roots(owned),
      quarantines: quarantines(fixture.root),
    };

    // 2. Rollback after the design root was quarantined.
    const designSuffix = `${path.sep}design${path.sep}fixture-film`;
    let refused = false;
    const refusedMove = createTestFileSystem({
      renameSync: ((...args: unknown[]) => {
        if (refused === false && String(args[0]).endsWith(generatedSuffix)) {
          refused = true;
          throw platformError("EIO");
        }
        return Reflect.apply(fs.renameSync, fs, args);
      }) as typeof fs.renameSync,
    });
    const rolledBack = failure(() =>
      withTestFileSystem(refusedMove.fileSystem, () =>
        AutoMovieProductionProject.open(fixture.root).eraseProduction(
          "refused move",
        ),
      ),
    );
    const afterRollback = {
      roots: roots(owned),
      quarantines: quarantines(fixture.root),
    };
    let lost = false;
    const lostIdentity = createTestFileSystem({
      renameSync: ((...args: unknown[]) => {
        if (lost === false && String(args[0]).endsWith(generatedSuffix)) {
          lost = true;
          throw platformError("EIO");
        }
        return Reflect.apply(fs.renameSync, fs, args);
      }) as typeof fs.renameSync,
      statSync: ((...args: unknown[]) => {
        const target = String(args[0]);
        if (
          lost &&
          target.includes(".erase-") &&
          target.endsWith(`${path.sep}00`)
        )
          throw platformError("EIO");
        return Reflect.apply(fs.statSync, fs, args);
      }) as typeof fs.statSync,
    });
    const stopped = failure(() =>
      withTestFileSystem(lostIdentity.fileSystem, () =>
        AutoMovieProductionProject.open(fixture.root).eraseProduction(
          "lost identity",
        ),
      ),
    );
    // The stopped rollback left the design root in quarantine; put it back.
    for (const quarantine of quarantines(fixture.root)) {
      const held = path.join(fixture.root, "automovie", quarantine, "00");
      if (fs.existsSync(held))
        fs.renameSync(
          held,
          path.join(fixture.root, "automovie", "design", "fixture-film"),
        );
      fs.rmSync(path.join(fixture.root, "automovie", quarantine), {
        recursive: true,
        force: true,
      });
    }
    const afterStopped = roots(owned);
    // A rollback whose own move is refused is reported as incomplete.
    let refusedRollback = 0;
    const incompleteRollback = createTestFileSystem({
      renameSync: ((...args: unknown[]) => {
        if (
          refusedRollback === 0 &&
          String(args[0]).endsWith(generatedSuffix)
        ) {
          refusedRollback = 1;
          throw platformError("EIO");
        }
        if (refusedRollback === 1 && String(args[1]).endsWith(designSuffix)) {
          refusedRollback = 2;
          throw platformError("EBUSY");
        }
        return Reflect.apply(fs.renameSync, fs, args);
      }) as typeof fs.renameSync,
    });
    const incomplete = failure(() =>
      withTestFileSystem(incompleteRollback.fileSystem, () =>
        AutoMovieProductionProject.open(fixture.root).eraseProduction(
          "incomplete rollback",
        ),
      ),
    );
    for (const quarantine of quarantines(fixture.root)) {
      const held = path.join(fixture.root, "automovie", quarantine, "00");
      if (fs.existsSync(held))
        fs.renameSync(
          held,
          path.join(fixture.root, "automovie", "design", "fixture-film"),
        );
      fs.rmSync(path.join(fixture.root, "automovie", quarantine), {
        recursive: true,
        force: true,
      });
    }
    const afterIncomplete = roots(owned);
    // A registry write refused after the audit record landed rolls every move
    // back and removes that audit, so a failed erase leaves no deletion record
    // beside the production it did not delete.
    const auditDirectory = path.join(
      fixture.root,
      "automovie",
      "audit",
      "production-deletions",
    );
    let auditWritten = false;
    const refusedRegistry = createTestFileSystem({
      renameSync: ((...args: unknown[]) => {
        const destination = String(args[1]);
        if (destination.includes(`${path.sep}production-deletions${path.sep}`))
          auditWritten = true;
        if (auditWritten && destination.endsWith(`${path.sep}productions.json`))
          throw platformError("EIO");
        return Reflect.apply(fs.renameSync, fs, args);
      }) as typeof fs.renameSync,
    });
    const auditRolledBack = failure(() =>
      withTestFileSystem(refusedRegistry.fileSystem, () =>
        AutoMovieProductionProject.open(fixture.root).eraseProduction(
          "refused registry",
        ),
      ),
    );
    const afterAuditRollback = {
      roots: roots(owned),
      quarantines: quarantines(fixture.root),
      audits: fs.existsSync(auditDirectory)
        ? fs.readdirSync(auditDirectory).length
        : 0,
    };

    // 3. A clean erase.
    const project = AutoMovieProductionProject.open(fixture.root);
    const erased = project.eraseProduction(
      "The fixture production is retired.",
    );
    const auditRoot = path.join(
      fixture.root,
      "automovie",
      "audit",
      "production-deletions",
    );
    const audits = fs.readdirSync(auditRoot).map(
      (entry) =>
        JSON.parse(fs.readFileSync(path.join(auditRoot, entry), "utf8")) as {
          productionId: string;
          reason: string;
        },
    );
    const registry = JSON.parse(
      fs.readFileSync(
        path.join(fixture.root, "automovie", "productions.json"),
        "utf8",
      ),
    ) as { productions: string[] };
    const afterErase = failure(() => project.eraseProduction("again"));
    TestValidator.equals(
      "erase is refused before moving, rolls back after, and audits when clean",
      {
        before,
        blank: blank?.message,
        linked: linked?.message.split(".")[0],
        afterRefusals,
        rolledBack: { message: rolledBack?.message, ...afterRollback },
        stopped: {
          message: stopped?.message,
          causes: stopped?.causes.map((cause) => cause.split(":")[0]),
        },
        afterStopped,
        incomplete: {
          message: incomplete?.message,
          causes: incomplete?.causes.map((cause) => cause.split(":")[0]),
        },
        afterIncomplete,
        auditRolledBack: {
          message: auditRolledBack?.message,
          ...afterAuditRollback,
        },
        erased,
        audits,
        registry: registry.productions,
        roots: roots(owned),
        quarantines: quarantines(fixture.root),
        afterErase: afterErase?.message.split(".")[0],
      },
      {
        before: {
          design: true,
          generated: true,
          state: true,
        },
        blank: "Production erase audit reason must not be blank.",
        linked: `Production erase refused unsafe namespace "${generated}"`,
        afterRefusals: {
          roots: { design: true, generated: true, state: true },
          quarantines: [],
        },
        rolledBack: {
          message: "EIO",
          roots: {
            design: true,
            generated: true,
            state: true,
          },
          quarantines: [],
        },
        stopped: {
          message:
            "Production erase stopped after an owned namespace changed physical identity. No stale-path rollback was attempted.",
          causes: ["EIO", "EIO"],
        },
        afterStopped: {
          design: true,
          generated: true,
          state: true,
        },
        incomplete: {
          message:
            "Production erase failed and identity-fenced rollback was incomplete. Restore only the listed quarantined originals before retrying.",
          causes: ["EIO", "EBUSY"],
        },
        afterIncomplete: {
          design: true,
          generated: true,
          state: true,
        },
        auditRolledBack: {
          message: "EIO",
          roots: { design: true, generated: true, state: true },
          quarantines: [],
          audits: 0,
        },
        erased: { erased: true, productionId: "fixture-film", remaining: [] },
        audits: [
          {
            version: 1,
            productionId: "fixture-film",
            reason: "The fixture production is retired.",
          },
        ],
        registry: [],
        roots: {
          design: false,
          generated: false,
          state: false,
        },
        quarantines: [],
        afterErase: 'Production "fixture-film" was deleted',
      },
    );
  } finally {
    fixture.dispose();
  }
};
