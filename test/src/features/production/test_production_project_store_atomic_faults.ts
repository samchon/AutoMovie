import {
  AutoMovieProject,
  type IAutoMovieLegacyPropSpec,
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

const propSpec = (node: string): IAutoMovieLegacyPropSpec => ({
  node,
  model: {
    id: node,
    name: null,
    origin: "generated",
    skeleton: null,
    body: null,
    materials: [],
    parts: [
      {
        id: "box",
        name: null,
        geometry: {
          type: "primitive",
          shape: { type: "box", width: 1, height: 1, depth: 1 },
        },
        material: null,
        attachedBone: null,
        transform: null,
      },
    ],
    asset: null,
  },
  articulation: null,
});

const stored = (root: string): string[] =>
  fs.existsSync(path.join(root, "props"))
    ? fs
        .readdirSync(path.join(root, "props"))
        .sort((left, right) => left.localeCompare(right))
    : [];

/**
 * Project-store mutations are atomic under filesystem faults and refuse a
 * case-colliding sibling before a case-insensitive volume could clobber it.
 *
 * Scenarios:
 *
 * 1. A prop whose slice filename differs from a stored sibling's only by case
 *    is reported as that sibling; an exact id and an unrelated id are not.
 * 2. A write whose temporary file cannot be written leaves no temporary residue
 *    and no partial slice, and the store still accepts the same write after.
 * 3. A removal whose quarantined slice cannot be deleted restores the slice at
 *    its original name and reports the failure, so the prop is still stored.
 */
export const test_production_project_store_atomic_faults = (): void => {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "automovie-store-faults-"),
  );
  try {
    const project = AutoMovieProject.open(root);
    project.saveProp(propSpec("Crate"));
    TestValidator.equals(
      "a case-only-distinct prop id names the stored sibling it would clobber",
      {
        collision: project.propCaseCollision("crate"),
        exact: project.propCaseCollision("Crate"),
        unrelated: project.propCaseCollision("barrel"),
      },
      { collision: "Crate", exact: null, unrelated: null },
    );

    const writeFault = createTestFileSystem({
      writeFileSync: ((...args: unknown[]) => {
        if (String(args[0]).includes(".tmp.")) throw platformError("EIO");
        return Reflect.apply(fs.writeFileSync, fs, args);
      }) as typeof fs.writeFileSync,
    });
    let writeRefusal: string | null = null;
    try {
      withTestFileSystem(writeFault.fileSystem, () =>
        project.saveProp(propSpec("Barrel")),
      );
    } catch (error) {
      writeRefusal = error instanceof Error ? error.message : String(error);
    }
    const afterFailedWrite = stored(root);
    project.saveProp(propSpec("Barrel"));

    const removeFault = createTestFileSystem({
      rmSync: ((...args: unknown[]) => {
        if (String(args[0]).includes(".delete.")) throw platformError("EBUSY");
        return Reflect.apply(fs.rmSync, fs, args);
      }) as typeof fs.rmSync,
    });
    let removeRefusal: string | null = null;
    try {
      withTestFileSystem(removeFault.fileSystem, () =>
        project.removeProp("Barrel"),
      );
    } catch (error) {
      removeRefusal = error instanceof Error ? error.message : String(error);
    }
    TestValidator.equals(
      "faulted writes leave no residue and faulted removals restore the slice",
      {
        writeRefusal,
        afterFailedWrite,
        afterWrite: stored(root),
        removeRefusal,
        afterFailedRemove: stored(root),
        reopened: AutoMovieProject.open(root)
          .storedProps()
          .map((spec) => spec.node)
          .sort((left, right) => left.localeCompare(right)),
      },
      {
        writeRefusal: "EIO",
        afterFailedWrite: ["Crate.json"],
        afterWrite: ["Barrel.json", "Crate.json"],
        removeRefusal: "EBUSY",
        afterFailedRemove: ["Barrel.json", "Crate.json"],
        reopened: ["Barrel", "Crate"],
      },
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
};
