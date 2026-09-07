import * as path from "node:path";

import { loadSourceModule } from "./loadSourceModule";

/**
 * The private parser seam needed by snapshot and injected-failure units.
 *
 * Only the empty-root syntax injection and observed snapshot fields are typed
 * here. Private package source stays outside the test compiler's rootDir.
 */
export const referenceParser = loadSourceModule<{
  parseReference(
    file: string,
    bytes: Uint8Array,
    syntax?: (source: string) => Promise<{
      tree: { type: "root"; children: [] };
      Parser: new (
        callbacks: { oncomment(): void },
        options: { decodeEntities: boolean },
      ) => {
        startIndex: number;
        endIndex: number;
        end(source: string): void;
      };
    }>,
  ): Promise<{
    source: string;
    file: string;
    revision: string;
    sourceBytes: number;
  }>;
}>(
  path.resolve(
    __dirname,
    "../../../../packages/mcp/src/internal/parseReference.ts",
  ),
);

/** Load the actual refusal constructor so the command's instanceof branch sees its own class. */
export const referenceErrors = loadSourceModule<{
  ReferenceError: new (
    code: string,
    message: string,
  ) => Error & { code: string };
}>(
  path.resolve(
    __dirname,
    "../../../../packages/mcp/src/internal/referenceError.ts",
  ),
);
