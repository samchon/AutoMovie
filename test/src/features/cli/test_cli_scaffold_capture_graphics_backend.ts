import { TestValidator } from "@nestia/e2e";
import path from "node:path";

import { loadSourceModule } from "../internal/loadSourceModule";
import { throwsError } from "../internal/predicates";

const { readCaptureGraphicsBackend } = loadSourceModule<{
  readCaptureGraphicsBackend: (
    environment: Readonly<Record<string, string | undefined>>,
  ) => { args: string[]; requestedBackend: string };
}>(
  path.resolve(
    __dirname,
    "../../../../packages/template/scaffold/scripts/captureGraphicsBackend.ts",
  ),
);

/**
 * The browser launch and capture identity use the same explicit host backend.
 *
 * Scenarios:
 *
 * 1. Absent, empty, and explicit software settings retain SwiftShader.
 * 2. Browser selection removes the forced software argument and records that
 *    request without claiming an observed hardware device.
 * 3. Unknown and untrimmed values fail rather than silently selecting a backend.
 */
export const test_cli_scaffold_capture_graphics_backend = (): void => {
  for (const selected of [undefined, "", "swiftshader"])
    TestValidator.equals(
      "software request matches launch arguments",
      readCaptureGraphicsBackend({
        AUTOMOVIE_CAPTURE_GRAPHICS_BACKEND: selected,
      }),
      {
        args: ["--use-angle=swiftshader"],
        requestedBackend: "angle:swiftshader",
      },
    );
  TestValidator.equals(
    "browser default is recorded without forcing software",
    readCaptureGraphicsBackend({
      AUTOMOVIE_CAPTURE_GRAPHICS_BACKEND: "default",
    }),
    { args: [], requestedBackend: "browser-default" },
  );
  for (const selected of ["unknown", " default", "swiftshader "])
    TestValidator.equals(
      "unknown host request refuses",
      throwsError(
        () =>
          readCaptureGraphicsBackend({
            AUTOMOVIE_CAPTURE_GRAPHICS_BACKEND: selected,
          }),
        "must be",
      ),
      true,
    );
};
