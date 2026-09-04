import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import {
  captureScaffoldPhysicalDirectory,
  publishNativeScaffoldFile,
  publishScaffoldFileToCapturedParent,
} from "../packages/template/src";

const temporaryRoot = fs.realpathSync(os.tmpdir());
const scratch = fs.mkdtempSync(
  path.join(temporaryRoot, "automovie-scaffold-parent-"),
);
if (path.dirname(scratch) !== temporaryRoot)
  throw new Error(`temporary probe escaped its declared root: ${scratch}`);

try {
  const owned = path.join(scratch, "owned");
  const nested = path.join(owned, "nested");
  const parked = path.join(owned, "parked");
  const outside = path.join(scratch, "outside");
  fs.mkdirSync(nested, { recursive: true });
  fs.mkdirSync(outside);

  const captured = captureScaffoldPhysicalDirectory(nested);
  fs.renameSync(nested, parked);
  fs.symlinkSync(
    outside,
    nested,
    process.platform === "win32" ? "junction" : "dir",
  );

  const successor = publishScaffoldFileToCapturedParent({
    bytes: Buffer.from("must-not-escape", "utf8"),
    capability: { publish: publishNativeScaffoldFile },
    parent: captured,
    target: path.join(nested, "successor.txt"),
  });
  assert.equal(successor.status, "refused");
  if (successor.status === "refused")
    assert.equal(successor.reason, "parent-changed");
  assert.deepEqual(fs.readdirSync(outside), []);
  assert.deepEqual(fs.readdirSync(parked), []);

  const current = captureScaffoldPhysicalDirectory(parked);
  const positiveBytes = Buffer.from("bound-parent", "utf8");
  const positive = publishScaffoldFileToCapturedParent({
    bytes: positiveBytes,
    capability: { publish: publishNativeScaffoldFile },
    parent: current,
    target: path.join(parked, "positive.txt"),
  });
  assert.equal(positive.status, "completed");
  assert.deepEqual(
    fs.readFileSync(path.join(parked, "positive.txt")),
    positiveBytes,
  );

  const competitor = path.join(parked, "competitor.txt");
  fs.writeFileSync(competitor, "resident", "utf8");
  const before = fs.lstatSync(competitor, { bigint: true });
  const collision = publishScaffoldFileToCapturedParent({
    bytes: Buffer.from("replacement", "utf8"),
    capability: { publish: publishNativeScaffoldFile },
    parent: current,
    target: competitor,
  });
  const after = fs.lstatSync(competitor, { bigint: true });
  assert.equal(collision.status, "refused");
  if (collision.status === "refused")
    assert.equal(collision.reason, "target-competitor");
  assert.equal(`${after.dev}:${after.ino}`, `${before.dev}:${before.ino}`);
  assert.equal(fs.readFileSync(competitor, "utf8"), "resident");
} finally {
  if (path.dirname(scratch) !== temporaryRoot)
    throw new Error(`refusing unsafe probe cleanup: ${scratch}`);
  fs.rmSync(scratch, { force: true, recursive: true });
}
