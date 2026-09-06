import type { IAutoMovieLibraryReviewProjectReader } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";
import path from "node:path";

import {
  type ILibraryPublicationFile,
  type ILibraryPublicationIO,
  createLibraryPublicationFixture,
  libraryPublicationOriginal,
} from "../internal/libraryReviewPublicationFixture";
import { loadSourceModule } from "../internal/loadSourceModule";
import { throwsError } from "../internal/predicates";

const { createLibraryReviewPublicationAdmissionReader: create } =
  loadSourceModule<{
    createLibraryReviewPublicationAdmissionReader(props: {
      project: IAutoMovieLibraryReviewProjectReader;
      target: string;
      before: ILibraryPublicationFile | null;
      pending: { path: string; file: ILibraryPublicationFile } | null;
      io: ILibraryPublicationIO;
    }): IAutoMovieLibraryReviewProjectReader;
  }>(
    path.resolve(
      __dirname,
      "../../../../packages/template/scaffold/scripts/libraryReviewPublicationAdmission.ts",
    ),
  );

/**
 * Only a publisher's exact in-flight reservation can admit its predecessor.
 *
 * Scenarios:
 *
 * 1. Initial and identical retries use the ordinary reader. Final admission
 *    sees only the approved predecessor while other readers still see pending.
 * 2. Generation, bytes, version, missing paths, a different reservation path
 *    and replaced parents all refuse; a previously created reader also expires.
 * 3. Other plans and pending markers, physical presence, sources, render bytes
 *    and failures retain their original receiver and do not gain an exemption.
 * 4. A failed final admission preserves the predecessor; a finalization failure
 *    leaves the installed sidecar pending and invalidates the admission reader.
 */
export const test_cli_library_review_publication_admission = (): void => {
  for (const before of [null, libraryPublicationOriginal()]) {
    const fixture = createLibraryPublicationFixture(before);
    const project: IAutoMovieLibraryReviewProjectReader = {
      root: "unit-root",
      readProseDocument(relative) {
        TestValidator.equals("prose receiver retained", this.root, "unit-root");
        return fixture.files.get(relative)?.source ?? null;
      },
      readSource() {
        TestValidator.equals(
          "source receiver retained",
          this.root,
          "unit-root",
        );
        return new Uint8Array([1]);
      },
      readRenderFile() {
        TestValidator.equals(
          "render receiver retained",
          this.root,
          "unit-root",
        );
        return new Uint8Array([2]);
      },
    };
    const pendingPath = `${fixture.target}.pending`;
    let retained: IAutoMovieLibraryReviewProjectReader | undefined;
    TestValidator.equals(
      "publish can run its strict final admission",
      fixture.run((pending) => {
        const reader = create({
          project,
          target: fixture.target,
          before,
          pending,
          io: fixture.io,
        });
        if (pending === null) {
          TestValidator.equals(
            "initial reader is unchanged",
            reader === project,
            true,
          );
          return;
        }
        retained = reader;
        TestValidator.equals(
          "other readers still see the actual reservation",
          project.readProseDocument(pendingPath),
          pending.file.source,
        );
        TestValidator.equals(
          "owned reservation is absent only inside admission",
          [
            reader.proseDocumentExists!(pendingPath),
            reader.readProseDocument(pendingPath),
          ],
          [false, null],
        );
        TestValidator.equals(
          "exact predecessor is read",
          reader.readProseDocument(fixture.target),
          before?.source ?? null,
        );
        fixture.files.set("other.review.json.pending", {
          identity: "other",
          version: "1",
          source: "other writer",
        });
        TestValidator.equals(
          "other pending is not hidden",
          [
            reader.proseDocumentExists!("other.review.json.pending"),
            reader.readProseDocument("other.review.json.pending"),
          ],
          [true, "other writer"],
        );
        TestValidator.equals(
          "missing unrelated text remains absent",
          [
            reader.proseDocumentExists!("missing"),
            reader.readProseDocument("missing"),
          ],
          [false, null],
        );
        project.proseDocumentExists = function (relative) {
          TestValidator.equals(
            "presence receiver retained",
            this.root,
            "unit-root",
          );
          return relative === "unreadable-entry";
        };
        TestValidator.equals(
          "physical presence delegates rather than text probing",
          [
            reader.proseDocumentExists!("unreadable-entry"),
            reader.proseDocumentExists!("other"),
          ],
          [true, false],
        );
        TestValidator.equals(
          "source and artifact bytes are delegated",
          [
            Array.from(reader.readSource("source")),
            Array.from(reader.readRenderFile("render")),
          ],
          [[1], [2]],
        );
      }),
      "published",
    );
    TestValidator.equals(
      "reader expires after completed publication",
      throwsError(() => retained!.readProseDocument(pendingPath)),
      true,
    );
  }
  for (const target of ["pending", "before"] as const)
    for (const field of ["identity", "source", "version", "missing"] as const) {
      const before = libraryPublicationOriginal();
      const fixture = createLibraryPublicationFixture(before);
      const project: IAutoMovieLibraryReviewProjectReader = {
        root: "unit",
        readProseDocument: () => null,
        readSource: () => new Uint8Array(),
        readRenderFile: () => new Uint8Array(),
      };
      const expired: boolean[] = [];
      TestValidator.equals(
        "changed admission basis refuses publication",
        throwsError(() =>
          fixture.run((pending) => {
            if (pending === null) return;
            const reader = create({
              project,
              target: fixture.target,
              before,
              pending,
              io: fixture.io,
            });
            const relative =
              target === "pending" ? pending.path : fixture.target;
            if (field === "missing") fixture.files.delete(relative);
            else
              fixture.files.set(relative, {
                ...fixture.files.get(relative)!,
                [field]: "changed",
              });
            expired.push(
              throwsError(() => reader.proseDocumentExists!(pending.path)),
            );
            expired.push(
              throwsError(() => reader.readProseDocument(fixture.target)),
            );
            create({
              project,
              target: fixture.target,
              before,
              pending,
              io: fixture.io,
            });
          }),
        ),
        true,
      );
      TestValidator.equals(
        "existing presence and predecessor readers both expire",
        expired,
        [true, true],
      );
    }
  for (const failure of [
    "wrong-path",
    "parent",
    "source",
    "render",
    "prose",
    "presence",
  ] as const) {
    const before = libraryPublicationOriginal();
    const fixture = createLibraryPublicationFixture(before);
    const fail = (): never => {
      throw new Error(`original ${failure} failure`);
    };
    const project: IAutoMovieLibraryReviewProjectReader = {
      root: "unit",
      readProseDocument: fail,
      proseDocumentExists: fail,
      readSource: fail,
      readRenderFile: fail,
    };
    let thrown: unknown;
    try {
      fixture.run((pending) => {
        if (pending === null) return;
        if (failure === "parent") fixture.io.assertBound = fail;
        const reader = create({
          project,
          target: fixture.target,
          before,
          pending:
            failure === "wrong-path"
              ? { ...pending, path: "other.pending" }
              : pending,
          io: fixture.io,
        });
        if (failure === "source") reader.readSource("source");
        if (failure === "render") reader.readRenderFile("render");
        if (failure === "prose") reader.readProseDocument("other");
        if (failure === "presence") reader.proseDocumentExists!("other");
      });
    } catch (error) {
      thrown = error;
    }
    TestValidator.equals(
      "the admission refusal retains its original reason",
      thrown instanceof Error &&
        thrown.message.includes(
          failure === "wrong-path"
            ? "does not own this pending path"
            : `original ${failure} failure`,
        ),
      true,
    );
  }
  const before = libraryPublicationOriginal();
  const fixture = createLibraryPublicationFixture(before);
  const project: IAutoMovieLibraryReviewProjectReader = {
    root: "unit",
    readProseDocument: (relative) =>
      fixture.files.get(relative)?.source ?? null,
    readSource: () => new Uint8Array(),
    readRenderFile: () => new Uint8Array(),
  };
  let retained: IAutoMovieLibraryReviewProjectReader | undefined;
  fixture.hook((event) => {
    if (event.kind === "move" && event.target?.endsWith(".completed"))
      throw new Error("cannot settle marker");
  });
  TestValidator.equals(
    "finalization failure is reported",
    throwsError(() =>
      fixture.run((pending) => {
        retained = create({
          project,
          target: fixture.target,
          before,
          pending,
          io: fixture.io,
        });
      }),
    ),
    true,
  );
  TestValidator.equals(
    "installed target and pending both remain physical",
    [
      project.readProseDocument(fixture.target),
      project.readProseDocument(`${fixture.target}.pending`) !== null,
    ],
    ["new receipt bytes", true],
  );
  TestValidator.equals(
    "retained admission cannot exempt a published successor",
    throwsError(() => retained!.readProseDocument(`${fixture.target}.pending`)),
    true,
  );
  const retry = createLibraryPublicationFixture(before);
  TestValidator.equals(
    "identical retry gets no reservation authority",
    retry.run(
      (pending) =>
        TestValidator.equals(
          "unchanged admission has no marker",
          pending,
          null,
        ),
      before.source,
    ),
    "already-recorded",
  );
};
