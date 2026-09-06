import { assertAutoMovieProductionMaintenanceComplete } from "@automovie/evidence";
import { TestValidator } from "@nestia/e2e";

import { throwsError } from "../internal/predicates";

/** No pending entry shape can be misread as an admitted contract generation. */
export const test_evidence_pending_maintenance = (): void => {
  const directory = { isDirectory: () => true, isSymbolicLink: () => false };
  const absent = Object.assign(new Error("absent"), { code: "ENOENT" });
  assertAutoMovieProductionMaintenanceComplete("project", () => {
    throw absent;
  });
  assertAutoMovieProductionMaintenanceComplete("project", (file) => {
    if (file.endsWith(".pending.json")) throw absent;
    return directory;
  });
  for (const entry of [
    directory,
    { isDirectory: () => false, isSymbolicLink: () => false },
    { isDirectory: () => false, isSymbolicLink: () => true },
  ])
    TestValidator.predicate(
      "every pending entry refuses",
      throwsError(() =>
        assertAutoMovieProductionMaintenanceComplete("project", (file) =>
          file.endsWith(".pending.json") ? entry : directory,
        ),
      ),
    );
  for (const entry of [
    { isDirectory: () => false, isSymbolicLink: () => false },
    { isDirectory: () => true, isSymbolicLink: () => true },
  ])
    TestValidator.predicate(
      "unsafe state parent refuses",
      throwsError(() =>
        assertAutoMovieProductionMaintenanceComplete("project", () => entry),
      ),
    );
  for (const cause of [
    new Error("denied"),
    Object.assign(new Error("denied"), { code: "EACCES" }),
    null,
    "failure",
  ]) {
    let observed: unknown = "not thrown";
    try {
      assertAutoMovieProductionMaintenanceComplete("project", () => {
        throw cause;
      });
    } catch (error) {
      observed = error;
    }
    TestValidator.predicate(
      "observation failures are not absence",
      observed === cause,
    );
  }
};
