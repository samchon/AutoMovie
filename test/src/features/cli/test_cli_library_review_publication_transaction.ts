import { TestValidator } from "@nestia/e2e";

import {
  createLibraryPublicationFixture,
  libraryPublication,
  libraryPublicationOriginal,
} from "../internal/libraryReviewPublicationFixture";
import { throwsError } from "../internal/predicates";

/**
 * Approved sidecar generations survive competition and publication failures.
 *
 * Scenarios:
 *
 * 1. Empty creation and replacement publish only after final admission, retain
 *    predecessor bytes and settle their pending marker; identical retries stage nothing.
 * 2. Replacement, deletion, byte/generation edits, pending writers and parent
 *    refusal prevent an old approval from overwriting a new resident.
 * 3. Temporary, reservation and move failures retain originals; ambiguous move
 *    failures restore only this attempt's candidate and predecessor.
 * 4. Late competitors in target, archive or pending survive failed recovery,
 *    whose error retains the original diagnostic and all recovery causes.
 * 5. Finalization errors keep the actually published sidecar and report the
 *    pending or completed record instead of relabeling it an atomic rollback.
 */
export const test_cli_library_review_publication_transaction = (): void => {
  for (const before of [null, libraryPublicationOriginal()]) {
    const fixture = createLibraryPublicationFixture(before);
    let admissions = 0;
    TestValidator.equals(
      "publication succeeds",
      fixture.run(() => {
        ++admissions;
        TestValidator.equals(
          "admission sees exact approved predecessor",
          fixture.files.get(fixture.target) ?? null,
          before,
        );
      }),
      "published",
    );
    TestValidator.equals("initial and final admission both ran", admissions, 2);
    TestValidator.equals(
      "complete candidate is current",
      fixture.files.get(fixture.target)?.source,
      "new receipt bytes",
    );
    TestValidator.equals(
      "predecessor retained",
      fixture.files.get(`${fixture.target}.attempt.before`) ?? null,
      before,
    );
    TestValidator.equals(
      "pending was settled",
      fixture.files.has(`${fixture.target}.pending`),
      false,
    );
    TestValidator.equals(
      "completed record retained",
      fixture.files.has(`${fixture.target}.attempt.completed`),
      true,
    );
  }
  const unchanged = createLibraryPublicationFixture(
    libraryPublicationOriginal(),
  );
  const diagnosticFixture = createLibraryPublicationFixture(
    libraryPublicationOriginal(),
  );
  const diagnostic = new Error(
    'generated-tampered: {"target":"model:subject"}',
  );
  let diagnosticAdmissions = 0;
  let diagnosed: unknown;
  try {
    diagnosticFixture.run(() => {
      if (++diagnosticAdmissions === 2) throw diagnostic;
    });
  } catch (error) {
    diagnosed = error;
  }
  TestValidator.equals(
    "original diagnostic object retained",
    diagnosed instanceof AggregateError && diagnosed.errors[0] === diagnostic,
    true,
  );
  TestValidator.equals(
    "CLI-visible message retains compiler diagnostic",
    diagnosed instanceof Error &&
      diagnosed.message.includes(diagnostic.message),
    true,
  );
  let repeatedAdmission = 0;
  TestValidator.equals(
    "already recorded",
    unchanged.run(() => {
      ++repeatedAdmission;
    }, libraryPublicationOriginal().source),
    "already-recorded",
  );
  TestValidator.equals(
    "unchanged request still admitted",
    repeatedAdmission,
    1,
  );
  TestValidator.equals(
    "unchanged request stages nothing",
    unchanged.events.some((event) => event.kind === "stage"),
    false,
  );
  TestValidator.equals(
    "unchanged refusal is not success",
    throwsError(
      () =>
        unchanged.run(() => {
          throw new Error("compile-input-changed");
        }, libraryPublicationOriginal().source),
      "compile-input-changed",
    ),
    true,
  );
  for (const changed of [
    null,
    { ...libraryPublicationOriginal(), identity: "replacement" },
    { ...libraryPublicationOriginal(), version: "2" },
    { ...libraryPublicationOriginal(), source: "another failed observation" },
  ]) {
    const fixture = createLibraryPublicationFixture(
      libraryPublicationOriginal(),
    );
    if (changed === null) fixture.files.delete(fixture.target);
    else fixture.files.set(fixture.target, changed);
    TestValidator.equals(
      "changed approved predecessor refused",
      throwsError(() => fixture.run(), "predecessor changed"),
      true,
    );
    TestValidator.equals(
      "competitor retained",
      fixture.files.get(fixture.target) ?? null,
      changed,
    );
  }
  const absent = createLibraryPublicationFixture(null);
  absent.files.set(absent.target, libraryPublicationOriginal());
  TestValidator.equals(
    "late creation refused",
    throwsError(() => absent.run(), "predecessor changed"),
    true,
  );
  const read = createLibraryPublicationFixture(libraryPublicationOriginal());
  const captured = libraryPublication.readLibraryReviewPublication({
    target: read.target,
    io: read.io,
  });
  TestValidator.equals(
    "approved snapshot frozen",
    Object.isFrozen(captured),
    true,
  );
  read.files.get(read.target)!.source = "later change";
  TestValidator.equals(
    "approved source does not alias mutable resident",
    captured?.source,
    libraryPublicationOriginal().source,
  );
  for (const timing of ["existing", "during-read"] as const) {
    const fixture = createLibraryPublicationFixture(
      libraryPublicationOriginal(),
    );
    const marker = `${fixture.target}.pending`;
    if (timing === "existing")
      fixture.files.set(marker, libraryPublicationOriginal());
    else
      fixture.hook((event) => {
        if (event.kind === "read" && event.path === fixture.target)
          fixture.files.set(marker, libraryPublicationOriginal());
      });
    TestValidator.equals(
      "pending prevents approval",
      throwsError(
        () => fixture.run(),
        timing === "existing" ? "requires recovery" : "started while reading",
      ),
      true,
    );
  }
  const parent = createLibraryPublicationFixture(libraryPublicationOriginal());
  parent.hook((event) => {
    if (event.kind === "bound") throw new Error("linked or replaced parent");
  });
  TestValidator.equals(
    "physical refusal preserved",
    throwsError(() => parent.run(), "linked or replaced parent"),
    true,
  );
  const duringAdmission = createLibraryPublicationFixture(
    libraryPublicationOriginal(),
  );
  TestValidator.equals(
    "initial admission edit refused",
    throwsError(
      () =>
        duringAdmission.run(() =>
          duringAdmission.files.delete(duringAdmission.target),
        ),
      "predecessor changed",
    ),
    true,
  );
  for (const suffix of [".after", ".pending"]) {
    const fixture = createLibraryPublicationFixture(
      libraryPublicationOriginal(),
    );
    fixture.hook((event) => {
      if (event.kind === "stage" && event.path.endsWith(suffix))
        throw new Error("temporary write failed");
    });
    TestValidator.equals(
      "staging failure preserves cause",
      throwsError(() => fixture.run(), "temporary write failed"),
      true,
    );
    TestValidator.equals(
      "staging never changed predecessor",
      fixture.files.get(fixture.target),
      libraryPublicationOriginal(),
    );
  }
  for (const suffix of [".after", ".pending"]) {
    const fixture = createLibraryPublicationFixture(
      libraryPublicationOriginal(),
    );
    const competitor = {
      ...libraryPublicationOriginal(),
      identity: "staging competitor",
    };
    fixture.hook((event) => {
      if (event.kind === "stage" && event.path.endsWith(suffix))
        fixture.files.set(event.path, competitor);
    });
    TestValidator.equals(
      "exclusive create competition refused",
      throwsError(() => fixture.run(), "exclusive staging competitor"),
      true,
    );
    TestValidator.equals(
      "staging competitor not cleaned up",
      [...fixture.files.values()].some(
        (file) => file.identity === competitor.identity,
      ),
      true,
    );
  }
  for (const fault of [
    "final-admission",
    "marker",
    "candidate",
    "preserve",
    "activate",
    "after-preserve",
    "after-activate",
    "readback",
  ] as const) {
    const fixture = createLibraryPublicationFixture(
      libraryPublicationOriginal(),
    );
    let admissions = 0;
    let injected = false;
    fixture.hook((event) => {
      const hit =
        (fault === "preserve" &&
          event.kind === "move" &&
          event.path === fixture.target) ||
        (fault === "activate" &&
          event.kind === "move" &&
          event.path.endsWith(".after")) ||
        (fault === "after-preserve" &&
          event.kind === "moved" &&
          event.path === fixture.target) ||
        (fault === "after-activate" &&
          event.kind === "moved" &&
          event.path.endsWith(".after")) ||
        (fault === "readback" &&
          event.kind === "read" &&
          event.path === fixture.target &&
          fixture.files.get(fixture.target)?.source === "new receipt bytes");
      if (!injected && hit) {
        injected = true;
        throw new Error(`injected ${fault}`);
      }
    });
    const refused = throwsError(
      () =>
        fixture.run(() => {
          if (++admissions !== 2) return;
          // eslint-disable-next-line typescript/only-throw-error -- final admission must retain a host's non-Error diagnostic
          if (fault === "final-admission") throw "fresh-source-diagnostic";
          if (fault === "marker" || fault === "candidate") {
            const name =
              fault === "marker"
                ? `${fixture.target}.pending`
                : `${fixture.target}.attempt.after`;
            fixture.files.set(name, {
              ...fixture.files.get(name)!,
              version: "changed",
            });
          }
        }),
      fault === "marker" ? "recovery required" : "predecessor restored",
    );
    TestValidator.equals(`failure ${fault} refused`, refused, true);
    TestValidator.equals(
      `failure ${fault} retained predecessor`,
      fixture.files.get(fixture.target),
      libraryPublicationOriginal(),
    );
    TestValidator.equals(
      `failure ${fault} retains recovery record`,
      fixture.files.has(
        `${fixture.target}.${fault === "marker" ? "pending" : "attempt.failed"}`,
      ),
      true,
    );
  }
  for (const before of [null, libraryPublicationOriginal()]) {
    const fixture = createLibraryPublicationFixture(before);
    let failed = false;
    fixture.hook((event) => {
      if (!failed && event.kind === "moved" && event.path.endsWith(".after")) {
        failed = true;
        throw new Error("post-activation failure");
      }
    });
    TestValidator.equals(
      "owned candidate restored to archive",
      throwsError(() => fixture.run(), "predecessor restored"),
      true,
    );
    TestValidator.equals(
      "absence or original restored",
      fixture.files.get(fixture.target) ?? null,
      before,
    );
    TestValidator.equals(
      "candidate remains retained",
      fixture.files.get(`${fixture.target}.attempt.after`)?.source,
      "new receipt bytes",
    );
  }
  for (const point of [
    "target",
    "archive",
    "restore",
    "restored-readback",
    "settle",
  ] as const) {
    const fixture = createLibraryPublicationFixture(
      libraryPublicationOriginal(),
    );
    const competitor = {
      ...libraryPublicationOriginal(),
      identity: "late writer",
      source: "late failed history",
    };
    let activated = false;
    fixture.hook((event) => {
      if (
        !activated &&
        event.kind === "move" &&
        event.path.endsWith(".after")
      ) {
        activated = true;
        if (point === "target") fixture.files.set(fixture.target, competitor);
        if (point === "archive")
          fixture.files.set(`${fixture.target}.attempt.before`, competitor);
        throw new Error("activation failed");
      }
      if (
        activated &&
        point === "restore" &&
        event.kind === "move" &&
        event.path.endsWith(".before")
      )
        throw new Error("restore failed");
      if (
        activated &&
        point === "restored-readback" &&
        event.kind === "moved" &&
        event.path.endsWith(".before")
      )
        fixture.files.set(fixture.target, competitor);
      if (
        activated &&
        point === "settle" &&
        event.kind === "move" &&
        event.path.endsWith(".pending")
      )
        throw new Error("settlement failed");
    });
    TestValidator.equals(
      `recovery ${point} refuses`,
      throwsError(() => fixture.run(), "recovery required"),
      true,
    );
    TestValidator.equals(
      "recovery retains pending",
      fixture.files.has(`${fixture.target}.pending`),
      true,
    );
    if (["target", "archive", "restored-readback"].includes(point))
      TestValidator.equals(
        "late failed history retained",
        [...fixture.files.values()].some(
          (file) => file.source === competitor.source,
        ),
        true,
      );
  }
  for (const timing of [
    "final-admission",
    "post-activation",
    "missing-archive",
  ] as const) {
    const fixture = createLibraryPublicationFixture(
      libraryPublicationOriginal(),
    );
    let admissions = 0;
    const competitor = {
      ...libraryPublicationOriginal(),
      identity: "replacement after observation",
      source: "new failed history",
    };
    fixture.hook((event) => {
      if (
        timing === "post-activation" &&
        event.kind === "moved" &&
        event.path.endsWith(".after")
      )
        fixture.files.set(fixture.target, competitor);
      if (
        timing === "missing-archive" &&
        event.kind === "move" &&
        event.path.endsWith(".after")
      ) {
        fixture.files.delete(`${fixture.target}.attempt.before`);
        throw new Error("activation failed after archive disappeared");
      }
    });
    TestValidator.equals(
      "final publication races refuse",
      throwsError(
        () =>
          fixture.run(() => {
            if (++admissions === 2 && timing === "final-admission")
              fixture.files.set(fixture.target, competitor);
          }),
        "recovery required",
      ),
      true,
    );
    TestValidator.equals(
      "final race leaves pending",
      fixture.files.has(`${fixture.target}.pending`),
      true,
    );
    if (timing !== "missing-archive")
      TestValidator.equals(
        "late writer bytes remain",
        fixture.files.get(fixture.target),
        competitor,
      );
  }
  for (const before of [null, libraryPublicationOriginal()]) {
    const fixture = createLibraryPublicationFixture(before);
    fixture.hook((event) => {
      if (event.kind === "moved" && event.path.endsWith(".after")) {
        const resident = fixture.files.get(fixture.target)!;
        fixture.files.set(fixture.target, {
          ...resident,
          source: "tampered after activation",
        });
      }
    });
    TestValidator.equals(
      "same-generation changed bytes are not owned",
      throwsError(() => fixture.run(), "recovery required"),
      true,
    );
    TestValidator.equals(
      "unowned bytes remain",
      fixture.files.get(fixture.target)?.source,
      "tampered after activation",
    );
  }
  for (const timing of ["before", "after"] as const) {
    const fixture = createLibraryPublicationFixture(
      libraryPublicationOriginal(),
    );
    fixture.hook((event) => {
      if (
        event.kind === (timing === "before" ? "move" : "moved") &&
        event.target?.endsWith(".completed")
      )
        throw new Error("marker finalization failed");
    });
    TestValidator.equals(
      "completed bytes are not falsely rolled back",
      throwsError(
        () => fixture.run(),
        "sidecar was published but finalization requires recovery",
      ),
      true,
    );
    TestValidator.equals(
      "published sidecar retained",
      fixture.files.get(fixture.target)?.source,
      "new receipt bytes",
    );
    TestValidator.equals(
      "recoverable marker path is truthful",
      fixture.files.has(
        `${fixture.target}.${timing === "before" ? "pending" : "attempt.completed"}`,
      ),
      true,
    );
  }
};
