import {
  type IScaffoldPublicationOptions,
  publishFiles,
} from "@automovie/template";
import { TestValidator } from "@nestia/e2e";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

interface IAttempt {
  /** Candidate-wide receipt status. */
  status: "completed" | "partial" | "refused";
  /** Refusal reason of the stopping entry, or null when nothing stopped. */
  reason: string | null;
  /** Whether the stopping error names the populated-root refusal. */
  rootRefused: boolean;
  /** Bytes resident at `entry.txt` after the attempt, or null when absent. */
  resident: string | null;
}

/**
 * Root admission and exact-file replacement are independent authorities.
 *
 * A maintenance write into a project that already exists needs the first
 * without the second, so a creation can never overwrite a competitor; `force`
 * is only the compatibility shorthand that grants both. Each attempt publishes
 * into a real temporary directory and reads the resident bytes back, so the
 * receipt and the tree must agree.
 *
 * Scenarios:
 * 1. A fresh root accepts a creation with no authority; the same populated
 *    root then refuses a second creation until root admission is granted.
 * 2. Root admission alone creates a new path but refuses to replace an
 *    existing one as a target competitor, leaving the resident bytes intact;
 *    adding replacement authority replaces them.
 * 3. Replacement authority alone still refuses a populated root; `force`
 *    grants both; an explicit `false` beside `force` withdraws exactly that one
 *    authority; `force: false` grants nothing.
 */
export const test_cli_scaffold_write_authority = (): void => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "automovie-authority-"));
  const target = path.join(root, "entry.txt");
  try {
    const attempt = (
      files: Record<string, string>,
      options?: IScaffoldPublicationOptions,
    ): IAttempt => {
      const receipt = publishFiles(root, files, options);
      const failure = receipt.failure;
      const error =
        failure !== null && failure.outcome.status === "refused"
          ? failure.outcome.error
          : undefined;
      return {
        status: receipt.status,
        reason:
          failure !== null && failure.outcome.status === "refused"
            ? failure.outcome.reason
            : null,
        rootRefused:
          error instanceof Error &&
          error.message.includes("target directory is not empty"),
        resident: fs.existsSync(target)
          ? fs.readFileSync(target, "utf8")
          : null,
      };
    };
    const created: IAttempt = {
      status: "completed",
      reason: null,
      rootRefused: false,
      resident: "first",
    };
    const rootRefusal = (resident: string | null): IAttempt => ({
      status: "refused",
      reason: "create-failed",
      rootRefused: true,
      resident,
    });
    const competitor: IAttempt = {
      status: "refused",
      reason: "target-competitor",
      rootRefused: false,
      resident: "first",
    };
    const replaced = (resident: string): IAttempt => ({
      status: "completed",
      reason: null,
      rootRefused: false,
      resident,
    });

    TestValidator.equals(
      "an empty root needs no authority and a populated root needs admission",
      [
        attempt({ "entry.txt": "first" }),
        attempt({ "sibling.txt": "x" }),
        attempt({ "sibling.txt": "x" }, { force: false }),
        attempt({ "sibling.txt": "x" }, { allowExistingRoot: true }),
      ],
      [created, rootRefusal("first"), rootRefusal("first"), created],
    );
    TestValidator.equals(
      "root admission creates but never replaces; replacement is its own grant",
      [
        attempt({ "entry.txt": "second" }, { allowExistingRoot: true }),
        attempt(
          { "entry.txt": "second" },
          { allowExistingRoot: true, overwriteExistingFiles: true },
        ),
        attempt({ "entry.txt": "third" }, { overwriteExistingFiles: true }),
      ],
      [competitor, replaced("second"), rootRefusal("second")],
    );
    TestValidator.equals(
      "force grants both authorities and an explicit false withdraws one",
      [
        attempt({ "entry.txt": "third" }, { force: true }),
        attempt(
          { "entry.txt": "fourth" },
          { force: true, overwriteExistingFiles: false },
        ),
        attempt({ "entry.txt": "fourth" }, { force: true, allowExistingRoot: false }),
      ],
      [
        replaced("third"),
        { ...competitor, resident: "third" },
        rootRefusal("third"),
      ],
    );
  } finally {
    fs.rmSync(root, { force: true, recursive: true });
  }
};
