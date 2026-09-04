import { compareCodeUnits } from "@automovie/engine";
import {
  type IAutoMovieEvidenceConfigProps,
  createBlankAutoMovieProductionEvidence,
} from "@automovie/evidence";
import { renderScaffold } from "@automovie/template";
import fs from "node:fs";
import path from "node:path";

const FIXTURE = path.resolve(__dirname, "../../../fixtures/completed-film");

/** Exact graph declaration exercised by the completed-film regression. */
export const completedFilmEvidenceConfig = (
  root: string,
): IAutoMovieEvidenceConfigProps => ({
  ...createBlankAutoMovieProductionEvidence(root, "english"),
  kind: "film",
  settings: "review",
  models: "review",
  motions: "review",
  treatments: "review",
  scripts: "review",
  screenplays: "review",
  modelSources: "review",
  motionSources: "review",
  shots: "review",
  productionSources: "review",
  filmSources: "review",
});

const files = (root: string): string[] => {
  return fs
    .readdirSync(root, { withFileTypes: true })
    .sort((left, right) => compareCodeUnits(left.name, right.name))
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
 * Its authored files are paired with the explicit declaration returned by
 * {@link completedFilmEvidenceConfig}; tests pass that declaration through the
 * public evidence reader instead of reconstructing a partial evidence object.
 */
export const renderCompletedFilmFixture = (
  name: string,
  scaffold: (props: {
    name: string;
    language: "english";
  }) => Record<string, string> = renderScaffold,
): Record<string, string> => {
  const rendered = scaffold({ name, language: "english" });
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
