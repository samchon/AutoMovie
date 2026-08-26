import type { IAutoMovieDesignTarget } from "@automovie/interface";
import { AutoMovieProductionProject, compareCodeUnits } from "@automovie/production";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import path from "node:path";

import { namedFacts } from "../internal/predicates";
import { formationDesign, productionFixture } from "../production/productionFixtures";

/**
 * A design record no source derives is nameable, and only the emitter can ask.
 *
 * The production evidence graph watches authored Markdown and TypeScript, but
 * a legacy fixture id can survive in `automovie/design/**`: derived JSON has no
 * JSDoc evidence owner. This case owns that design tree, which is the part the
 * source graph cannot inspect directly.
 *
 * The half of that tree which is internally consistent is worse than uncaught.
 * Measured in a real sandbox replacement, restoring `models/{soloist,chorus-*}`
 * and `formations/chorus` into a finished production left `compile` at
 * `success: true` with zero diagnostics while it built those records into that
 * production's `generated` output. Nothing about them is wrong. They reference
 * only each other, so no dangling-citation refusal can reach them, and no
 * diagnostic can say the only true thing about them, which is that they are
 * somebody else's film.
 *
 * "Does any source own this record" is answerable exactly once, in the emitter
 * that derives the records, and nowhere downstream. This pins the two project
 * APIs that make the answer expressible there, plus the wiring that stops a
 * later record from escaping the question.
 *
 * Scenarios:
 *
 * 1. The inventory reports exactly the six fields the emitter turns into
 *    targets, so a seventh added later cannot leave a whole kind of record
 *    resident and invisible.
 * 2. The project enumerates every resident design record across all six design
 *    kinds, so "resident minus derived" is computable rather than guessed.
 * 3. Every enumerated record maps to a project-relative `automovie/design`
 *    file that exists, so a refusal names something the author can open.
 * 4. No enumerated record resolves to the screenplay index's own file, so the
 *    one record the emitter deliberately leaves alone can never be accused.
 * 5. Deleting a record removes it from the inventory, so the remedy the
 *    refusal names actually shrinks the residue.
 * 6. The scaffold's emitter registers each record inside `emit` rather than in
 *    a list beside the calls, reads the resident set from the project, and
 *    refuses by naming each record's own path.
 */
export const test_cli_scaffold_design_residue = (): void => {
  const fixture = productionFixture();
  try {
    const project = AutoMovieProductionProject.open(fixture.root);
    const targets = (): IAutoMovieDesignTarget[] => {
      const inventory = project.inventory();
      return [
        ...(inventory.production ? [{ kind: "production" } as const] : []),
        ...(inventory.world ? [{ kind: "world" } as const] : []),
        ...inventory.models.map((id) => ({ kind: "model", id }) as const),
        ...inventory.formations.map(
          (id) => ({ kind: "formation", id }) as const,
        ),
        ...inventory.shots.map((id) => ({ kind: "shot", id }) as const),
        ...inventory.acceptance.map(
          (id) => ({ kind: "acceptance", id }) as const,
        ),
      ];
    };

    // Stored through the project rather than shipped by the fixture, which is
    // also the real shape of the problem: a formation record put there by
    // something other than the emitter that runs today is exactly the residue
    // the emitter has to be able to see.
    const formation = formationDesign();
    TestValidator.equals(
      "a formation record can be stored into the fixture",
      project.setFormationDesign(formation).accepted,
      true,
    );

    // The emitter turns the inventory into targets by naming its fields one by
    // one, and nothing in the type system objects when the inventory grows a
    // seventh. A record of a kind nobody listed would then be resident and
    // invisible, which is the exact failure this whole gate exists to end, so
    // the field set is pinned here rather than trusted.
    TestValidator.equals(
      "the inventory reports exactly the kinds the emitter enumerates",
      Object.keys(project.inventory()).sort(compareCodeUnits),
      ["acceptance", "formations", "models", "production", "shots", "world"],
    );

    const resident = targets();
    TestValidator.equals(
      "every design kind a project can store is enumerable",
      [...new Set(resident.map((target) => target.kind))].sort(
        compareCodeUnits,
      ),
      ["acceptance", "formation", "model", "production", "shot", "world"],
    );

    TestValidator.equals(
      "every enumerated record names a design file that exists",
      resident
        .map((target) => project.designRecordPath(target))
        .filter(
          (relative) =>
            relative.startsWith("automovie/design/") === false ||
            relative.endsWith(".json") === false ||
            fs.existsSync(path.join(fixture.root, relative)) === false,
        ),
      [],
    );

    const index = path.join(
      fixture.root,
      "automovie/design",
      project.productionId,
      "screenplay/index.json",
    );
    TestValidator.equals(
      "the hand-authored screenplay index is resident and is never residue",
      {
        resident: fs.existsSync(index),
        // Proved by path rather than by kind. No `IAutoMovieDesignTarget`
        // addresses the index, so the emitter cannot name the one record it
        // deliberately leaves alone however the union later grows.
        accusable: resident.some(
          (target) =>
            path.resolve(fixture.root, project.designRecordPath(target)) ===
            path.resolve(index),
        ),
      },
      { resident: true, accusable: false },
    );

    // The refusal's remedy is "delete the file". A residue set that did not
    // shrink when the author did that would send them round the same loop
    // forever, so the shrink is the assertion rather than the deletion. The
    // record is chosen by sorted id so a directory-order change cannot make
    // this case delete something else.
    const doomed = resident
      .flatMap((entry) => (entry.kind === "model" ? [entry.id] : []))
      .sort(compareCodeUnits)[0];
    TestValidator.equals(
      "a model record is resident to delete",
      doomed !== undefined,
      true,
    );
    const doomedTarget: IAutoMovieDesignTarget = { kind: "model", id: doomed! };
    fs.rmSync(path.join(fixture.root, project.designRecordPath(doomedTarget)));
    TestValidator.equals(
      "deleting a record removes it from the residue the emitter can see",
      targets().some((entry) => entry.kind === "model" && entry.id === doomed),
      false,
    );

    const emitter = fs.readFileSync(
      path.resolve(
        __dirname,
        "../../../../packages/template/scaffold/scripts/emitDesign.ts",
      ),
      "utf8",
    );
    TestValidator.equals(
      "the emitter asks the ownership question in a way a new record cannot escape",
      namedFacts([
        [
          // Registration is a side effect of emitting. A replacement rewrites
          // every import and every call in that file, and a second list of
          // what those calls cover is the one that would be updated last.
          "each record registers itself inside emit",
          () =>
            emitter.includes("derived.add(address(target));") &&
            emitter.indexOf("derived.add(address(target));") >
              emitter.indexOf("const emit = ("),
        ],
        [
          "the resident set is read from the project rather than walked",
          () => emitter.includes("project.inventory()"),
        ],
        [
          "the refusal names each record's own file",
          () => emitter.includes("project.designRecordPath(target)"),
        ],
        [
          // The bare presence of `throw new Error(` proves nothing here: the
          // emitter already throws when a setter refuses a record. What has to
          // hold is that the residue branch is the thing that throws, so this
          // reads the first throw at or after that branch rather than any.
          "an unowned record fails the run rather than warning under it",
          () =>
            emitter.includes("if (orphaned.length !== 0)") &&
            emitter.indexOf(
              "throw new Error(",
              emitter.indexOf("if (orphaned.length !== 0)"),
            ) !== -1,
        ],
      ]),
      {
        "each record registers itself inside emit": true,
        "the resident set is read from the project rather than walked": true,
        "the refusal names each record's own file": true,
        "an unowned record fails the run rather than warning under it": true,
      },
    );
  } finally {
    fixture.dispose();
  }
};
