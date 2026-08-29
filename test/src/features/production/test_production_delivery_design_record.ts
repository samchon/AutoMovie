import { AutoMovieProductionProject } from "@automovie/production";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import path from "node:path";

import { namedFacts, throwsError } from "../internal/predicates";
import { productionFixture } from "./productionFixtures";

/**
 * One production's design record, read without opening project state.
 *
 * The delivery decisions a project used to keep in a central configuration file
 * are fields of its design record now, so the scripts that execute them need
 * that record before anything has been opened for writing: a render command
 * needs the tier before it takes a session lease, and the viewer middleware
 * needs the admitted soft-body list on a request that must create nothing.
 * `AutoMovieProductionProject.productionDesign` is that read. It takes no lock,
 * creates no directory, and resolves the record through the same path fence the
 * project reads it through.
 *
 * The absent case is the one that decides the shape of every consumer. A
 * project that has emitted no design record has authored no delivery decision,
 * and answering `null` is what lets each reader fall back to its shipped
 * default rather than inventing a value or refusing to run. A record that is
 * resident but unreadable is the opposite case and stays an error, because a
 * decision nobody can read is not the same as a decision nobody made.
 *
 * Scenarios:
 *
 * 1. A production namespace with no design record reads as `null`, on a project
 *    root that carries other productions' records.
 * 2. A resident record is returned with its delivery decisions intact, and the
 *    call creates no directory for the namespace it was asked about.
 * 3. A resident record whose bytes are not JSON is refused by file name.
 * 4. A resident record whose shape is not a production design is refused by
 *    file name and by the offending path inside it.
 * 5. A record reached through a symlinked file is refused rather than followed
 *    out of the project.
 */
export const test_production_delivery_design_record = (): void => {
  const fixture = productionFixture();
  try {
    const project = AutoMovieProductionProject.open(
      fixture.root,
      "fixture-film",
    );
    const record = path.join(
      fixture.root,
      ...project.designRecordPath({ kind: "production" }).split("/"),
    );
    const absentNamespace = path.dirname(path.dirname(record));
    const before = fs.readdirSync(absentNamespace).length;

    const resident = AutoMovieProductionProject.productionDesign(
      fixture.root,
      "fixture-film",
    );
    const missing = AutoMovieProductionProject.productionDesign(
      fixture.root,
      "no-such-production",
    );

    TestValidator.equals(
      "a design record is read where one exists and absent where none does",
      namedFacts([
        ["theResidentRecordIsReturned", () => resident !== null],
        [
          "theResidentRecordCarriesItsOwnIdentity",
          () => resident?.id === "fixture-film",
        ],
        [
          "theResidentRecordCarriesItsFrameClock",
          () => resident?.frameFormat.fps === 24,
        ],
        ["anUnwrittenRecordIsNull", () => missing === null],
        [
          "readingCreatedNothingForTheAbsentNamespace",
          () => fs.readdirSync(absentNamespace).length === before,
        ],
      ]),
      {
        theResidentRecordIsReturned: true,
        theResidentRecordCarriesItsOwnIdentity: true,
        theResidentRecordCarriesItsFrameClock: true,
        anUnwrittenRecordIsNull: true,
        readingCreatedNothingForTheAbsentNamespace: true,
      },
    );

    const original = fs.readFileSync(record, "utf8");
    fs.writeFileSync(record, "{ not json", "utf8");
    TestValidator.predicate(
      "an unparsable design record is refused by its own file name",
      throwsError(
        () =>
          AutoMovieProductionProject.productionDesign(
            fixture.root,
            "fixture-film",
          ),
        ["Invalid AutoMovie JSON", "production.json"],
      ),
    );

    fs.writeFileSync(record, JSON.stringify({ id: 7 }), "utf8");
    TestValidator.predicate(
      "a record that is not a production design names the field that failed",
      throwsError(
        () =>
          AutoMovieProductionProject.productionDesign(
            fixture.root,
            "fixture-film",
          ),
        ["Invalid AutoMovie file", "production.json", "$input.id"],
      ),
    );

    fs.writeFileSync(record, original, "utf8");
    const outside = path.join(fixture.root, "outside-production.json");
    fs.writeFileSync(outside, original, "utf8");
    fs.rmSync(record);
    let linked = true;
    try {
      fs.symlinkSync(outside, record, "file");
    } catch {
      // A host that refuses to create symbolic links cannot exercise this
      // refusal, and inventing a substitute would assert something the fence
      // does not do. Restore the record and say so through the fact below.
      linked = false;
      fs.writeFileSync(record, original, "utf8");
    }
    TestValidator.equals(
      "a linked design record is refused rather than followed out of the project",
      linked === false ||
        throwsError(
          () =>
            AutoMovieProductionProject.productionDesign(
              fixture.root,
              "fixture-film",
            ),
          ["is a symlink", "production.json"],
        ),
      true,
    );
  } finally {
    fixture.dispose();
  }
};
