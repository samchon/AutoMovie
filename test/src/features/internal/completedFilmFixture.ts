import { renderScaffold } from "@automovie/template";
import fs from "node:fs";
import path from "node:path";

const FIXTURE = path.resolve(__dirname, "../../../fixtures/completed-film");

const files = (root: string): string[] => {
  return fs
    .readdirSync(root, { withFileTypes: true })
    .sort(
      (left, right) =>
        Number(left.name > right.name) - Number(left.name < right.name),
    )
    .flatMap((entry) => {
      const absolute = path.join(root, entry.name);
      return entry.isDirectory()
        ? files(absolute)
        : entry.isFile() && entry.name !== ".gitkeep"
          ? [absolute]
          : [];
    });
};

/**
 * Overlay the repository-only completed film fixture on the blank public
 * scaffold. The fixture proves production behavior without making every new
 * user's project inherit somebody else's evidence, source, assets, or design.
 * It deliberately leaves the blank scaffold's lint declaration untouched:
 * historical fixture annotations are regression data, not a current authored
 * evidence state that may be promoted by a test helper.
 */
export const renderCompletedFilmFixture = (
  name: string,
  scaffold: (props: {
    name: string;
  }) => Record<string, string> = renderScaffold,
): Record<string, string> => {
  const rendered = scaffold({ name });
  for (const absolute of files(FIXTURE)) {
    const legacyRelative = path
      .relative(FIXTURE, absolute)
      .replaceAll("\\", "/")
      .replaceAll("{{name}}", name);
    const relative = legacyRelative
      .replace(/^src\/formations\//u, "src/models/")
      .replace(/^src\/objects\//u, "src/models/")
      .replace(/^src\/units\//u, "src/models/")
      .replace(/^src\/world\//u, "src/models/");
    rendered[relative] = fs
      .readFileSync(absolute, "utf8")
      .replaceAll("\r\n", "\n")
      .replaceAll("{{name}}", name)
      .replaceAll("src/formations/", "src/models/")
      .replaceAll("src/objects/", "src/models/")
      .replaceAll("src/units/", "src/models/")
      .replaceAll("src/world/", "src/models/")
      .replaceAll("../formations/", "../models/")
      .replaceAll("../objects/", "../models/")
      .replaceAll("../units/", "../models/")
      .replaceAll("../world/", "../models/")
      .replaceAll("./formations/", "./models/")
      .replaceAll("./objects/", "./models/")
      .replaceAll("./units/", "./models/")
      .replaceAll("./world/", "./models/");
  }
  const viewerDocument = rendered["viewer/src/viewerDocument.ts"]!;
  const backgroundSlot = "export const VIEWER_BACKGROUND = 0x202020;";
  if (viewerDocument.split(backgroundSlot).length !== 2)
    throw new Error(
      "The public scaffold no longer exposes exactly one neutral viewer background slot for completed fixtures.",
    );
  rendered["viewer/src/viewerDocument.ts"] =
    `import { PRODUCTION_BACKGROUND } from "../../src/production";\n\n${viewerDocument.replace(backgroundSlot, "export const VIEWER_BACKGROUND = PRODUCTION_BACKGROUND;")}`;
  return rendered;
};

/** Read one unrendered repository-only completed-film record. */
export const completedFilmJson = <T>(relative: string): T =>
  JSON.parse(fs.readFileSync(path.resolve(FIXTURE, relative), "utf8")) as T;
