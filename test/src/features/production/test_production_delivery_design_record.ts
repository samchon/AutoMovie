import { AutoMovieProductionProject } from "@automovie/production";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { namedFacts, throwsError } from "../internal/predicates";
import { productionFixture } from "./productionFixtures";

interface IDesignEscapeFailure {
  error: unknown;
}

class DesignEscapeCleanupError extends AggregateError {}

/** Remove one staged escape without replacing the assertion's own failure. */
const preserveDesignEscapeCleanup = (
  failure: IDesignEscapeFailure | undefined,
  cleanup: () => void,
): void => {
  try {
    cleanup();
  } catch (cleanupFailure) {
    if (failure === undefined) throw cleanupFailure;
    throw new DesignEscapeCleanupError(
      [failure.error, cleanupFailure],
      "Staged design-escape cleanup failed after the refusal assertion failed.",
    );
  }
};

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
 * 5. A record reached through a namespace directory that links outside the
 *    project is refused rather than followed out of it.
 * 6. Malformed UTF-8 and a duplicate object member are refused by the shared
 *    structured JSON admission before schema validation, naming the record and
 *    the failed stage, so neither a replacement character nor a shadowed
 *    member can become current design.
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

    fs.writeFileSync(
      record,
      Buffer.concat([
        Buffer.from('{"id":"'),
        Buffer.from([0x80]),
        Buffer.from('"}'),
      ]),
    );
    TestValidator.predicate(
      "a design record with malformed UTF-8 is refused before a replacement character can pass as its id",
      throwsError(
        () =>
          AutoMovieProductionProject.productionDesign(
            fixture.root,
            "fixture-film",
          ),
        ["Invalid AutoMovie JSON", "production.json", "encoding admission"],
      ),
    );

    fs.writeFileSync(
      record,
      original.replace(/\}\s*$/u, ',"id":"shadow"}'),
      "utf8",
    );
    TestValidator.predicate(
      "a design record with a duplicate member is refused instead of read last-wins",
      throwsError(
        () =>
          AutoMovieProductionProject.productionDesign(
            fixture.root,
            "fixture-film",
          ),
        ["Invalid AutoMovie JSON", "production.json", "duplicate member"],
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

    // The escape is staged as a directory junction rather than a file symlink:
    // a junction needs no elevation on Windows, which is why every other fence
    // scenario in this suite stages one, and the file it exposes is an ordinary
    // regular file so only the realpath check can catch it.
    const outside = fs.mkdtempSync(
      path.join(os.tmpdir(), "automovie-design-escape-"),
    );
    fs.writeFileSync(path.join(outside, "production.json"), original, "utf8");
    fs.rmSync(path.dirname(record), { force: true, recursive: true });
    fs.symlinkSync(
      outside,
      path.dirname(record),
      process.platform === "win32" ? "junction" : "dir",
    );
    let escapeFailure: IDesignEscapeFailure | undefined;
    try {
      TestValidator.predicate(
        "a design record reached through an escaping namespace is refused",
        throwsError(
          () =>
            AutoMovieProductionProject.productionDesign(
              fixture.root,
              "fixture-film",
            ),
          ["escapes the production root", "production.json"],
        ),
      );
    } catch (error) {
      escapeFailure = { error };
      throw error;
    } finally {
      preserveDesignEscapeCleanup(escapeFailure, () => {
        fs.unlinkSync(path.dirname(record));
        fs.rmSync(outside, { force: true, recursive: true });
      });
    }
  } finally {
    fixture.dispose();
  }
};
