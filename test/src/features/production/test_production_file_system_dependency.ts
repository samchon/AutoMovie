import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";

import {
  createTestFileSystem,
  currentTestFileSystem,
  productionTestFileSystem,
  withTestFileSystem,
} from "../internal/testFileSystem";

export const test_production_file_system_dependency =
  async (): Promise<void> => {
    const first = createTestFileSystem({ existsSync: () => true });
    const second = createTestFileSystem({ existsSync: () => false });
    const observed = await Promise.all([
      withTestFileSystem(first.fileSystem, async () => {
        await Promise.resolve();
        return productionTestFileSystem().existsSync("isolated-first");
      }),
      withTestFileSystem(second.fileSystem, async () => {
        await Promise.resolve();
        return productionTestFileSystem().existsSync("isolated-second");
      }),
    ]);
    TestValidator.equals(
      "concurrent filesystem dependencies remain isolated",
      observed,
      [true, false],
    );
    TestValidator.equals(
      "each adapter records only its own calls",
      {
        first: first.calls().map((call) => call.operation),
        second: second.calls().map((call) => call.operation),
      },
      {
        first: ["existsSync"],
        second: ["existsSync"],
      },
    );
    TestValidator.equals(
      "production uses the native filesystem outside an injected invocation",
      currentTestFileSystem(),
      fs,
    );
  };
