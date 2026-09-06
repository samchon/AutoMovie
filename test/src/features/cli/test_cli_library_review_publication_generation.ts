import { TestValidator } from "@nestia/e2e";

import {
  type ILibraryPublicationFile,
  createLibraryPublicationFixture,
  libraryPublicationOriginal,
} from "../internal/libraryReviewPublicationFixture";
import { throwsError } from "../internal/predicates";

/**
 * A stable size/mtime token belongs to every retained publication generation.
 *
 * Scenarios:
 *
 * 1. No-replace moves preserve the full file token on successful creation and
 *    replacement, including predecessor and completed-record archival moves.
 * 2. An installed candidate rewritten with the same identity and bytes but a
 *    newer modification version is a competitor, including ambiguous activation.
 * 3. A same-byte rewrite of the resident predecessor, preserved predecessor or
 *    restored predecessor never settles recovery as though the original survived.
 */
export const test_cli_library_review_publication_generation = (): void => {
  const original = {
    ...libraryPublicationOriginal(),
    version: "original:29:mtime17",
  };
  for (const before of [null, original]) {
    const fixture = createLibraryPublicationFixture(before);
    const held = new Map<string, ILibraryPublicationFile>();
    const renamed: Array<{
      before: ILibraryPublicationFile;
      after: ILibraryPublicationFile;
    }> = [];
    fixture.hook((event) => {
      if (event.kind === "move")
        held.set(event.path, { ...fixture.files.get(event.path)! });
      if (event.kind === "moved")
        renamed.push({
          before: held.get(event.path)!,
          after: fixture.files.get(event.target!)!,
        });
    });
    TestValidator.equals(
      "stable generation publishes",
      fixture.run(),
      "published",
    );
    TestValidator.equals(
      "every rename preserves identity, bytes and stable version",
      renamed.map((entry) => entry.after),
      renamed.map((entry) => entry.before),
    );
    TestValidator.equals(
      "all expected no-replace moves were observed",
      renamed.length,
      before === null ? 2 : 3,
    );
    TestValidator.equals(
      "the preserved predecessor retains its stable token",
      fixture.files.get(`${fixture.target}.attempt.before`) ?? null,
      before,
    );
  }
  for (const before of [null, original])
    for (const ambiguous of [false, true]) {
      const fixture = createLibraryPublicationFixture(before);
      let rewritten: ILibraryPublicationFile | undefined;
      fixture.hook((event) => {
        if (event.kind === "moved" && event.path.endsWith(".after")) {
          rewritten = {
            ...fixture.files.get(fixture.target)!,
            version: "same-bytes-new-mtime",
          };
          fixture.files.set(fixture.target, rewritten);
          if (ambiguous)
            throw new Error("activation reported failure after effect");
        }
      });
      TestValidator.equals(
        "changed candidate generation requires recovery",
        throwsError(() => fixture.run(), "recovery required"),
        true,
      );
      TestValidator.equals(
        "same-byte competitor is not rolled back",
        fixture.files.get(fixture.target),
        rewritten,
      );
      TestValidator.equals(
        "pending marker remains unresolved",
        fixture.files.has(`${fixture.target}.pending`),
        true,
      );
      TestValidator.equals(
        "recovery does not move the rewritten candidate",
        fixture.events.some(
          (event) =>
            event.kind === "move" &&
            event.path === fixture.target &&
            event.target?.endsWith(".after"),
        ),
        false,
      );
    }
  for (const timing of ["resident", "archive", "restored"] as const) {
    const fixture = createLibraryPublicationFixture(original);
    let rewritten: ILibraryPublicationFile | undefined;
    let activated = false;
    const rewrite = (relative: string): void => {
      rewritten = {
        ...fixture.files.get(relative)!,
        version: "same-bytes-new-mtime",
      };
      fixture.files.set(relative, rewritten);
    };
    fixture.hook((event) => {
      if (
        timing !== "resident" &&
        !activated &&
        event.kind === "move" &&
        event.path.endsWith(".after")
      ) {
        activated = true;
        if (timing === "archive") rewrite(`${fixture.target}.attempt.before`);
        throw new Error("activation refused");
      }
      if (
        timing === "restored" &&
        event.kind === "moved" &&
        event.path.endsWith(".before")
      )
        rewrite(fixture.target);
    });
    TestValidator.equals(
      "rewritten predecessor cannot complete recovery",
      throwsError(
        () =>
          fixture.run((pending) => {
            if (pending !== null && timing === "resident")
              rewrite(fixture.target);
          }),
        "recovery required",
      ),
      true,
    );
    TestValidator.equals(
      "rewritten predecessor remains untouched",
      fixture.files.get(
        timing === "archive"
          ? `${fixture.target}.attempt.before`
          : fixture.target,
      ),
      rewritten,
    );
    TestValidator.equals(
      "pending is not falsely settled",
      [
        fixture.files.has(`${fixture.target}.pending`),
        fixture.files.has(`${fixture.target}.attempt.failed`),
      ],
      [true, false],
    );
  }
};
