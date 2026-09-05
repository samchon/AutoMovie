import {
  acquireOrCreateProductionRootNamespace,
  releaseProductionRootNamespace,
} from "@automovie/production";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  createTestFileSystem,
  withTestFileSystem,
} from "../internal/testFileSystem";

const platformError = (code: string): Error =>
  Object.assign(new Error(code), { code });

/**
 * Creating a project root reserves each missing parent under a creation lock
 * and re-inspects it inside that lock, so a parent that appears as a file
 * between the first look and the reservation is refused rather than adopted.
 *
 * Scenarios:
 *
 * 1. A root two directories deep is created with every missing parent, and the
 *    lease names it.
 * 2. A parent that is a regular file when the reservation re-inspects it is
 *    refused as not a physical directory, and nothing is created beside it.
 */
export const test_production_root_namespace_creation = (): void => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "automovie-root-create-"));
  try {
    const created = path.join(base, "parent", "project");
    const lease = acquireOrCreateProductionRootNamespace(created);
    releaseProductionRootNamespace(lease);
    const occupiedParent = path.join(base, "occupied");
    fs.writeFileSync(occupiedParent, "not a directory");
    let firstLook = true;
    const fault = createTestFileSystem({
      lstatSync: ((...args: unknown[]) => {
        if (String(args[0]) === occupiedParent && firstLook) {
          firstLook = false;
          throw platformError("ENOENT");
        }
        return Reflect.apply(fs.lstatSync, fs, args);
      }) as typeof fs.lstatSync,
    });
    let refusal: string | null = null;
    try {
      withTestFileSystem(fault.fileSystem, () =>
        acquireOrCreateProductionRootNamespace(
          path.join(occupiedParent, "project"),
        ),
      );
    } catch (error) {
      refusal = error instanceof Error ? error.message : String(error);
    }
    TestValidator.equals(
      "missing parents are created and a parent that turns into a file is refused",
      {
        created: fs.statSync(created).isDirectory(),
        refusal,
        parentUntouched: fs.readFileSync(occupiedParent, "utf8"),
      },
      {
        created: true,
        refusal: `Production project parent "${occupiedParent}" is not a physical directory.`,
        parentUntouched: "not a directory",
      },
    );
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
  }
};
