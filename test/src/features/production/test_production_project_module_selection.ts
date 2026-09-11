import { TestValidator } from "@nestia/e2e";
import path from "node:path";

import { loadSourceModule } from "../internal/loadSourceModule";
import { productionModule } from "./sourceStatusFixtures";

const { listAutoMovieProjectModules } = loadSourceModule<{
  listAutoMovieProjectModules(props: {
    root: string;
    loaded: readonly string[];
  }): string[];
}>(productionModule("listAutoMovieProjectModules.ts"));

/**
 * Only a project's own loaded modules are selected.
 *
 * The builder evicts this selection before it evaluates source, and the source
 * status reads the same selection afterwards to learn which project files an
 * answer executed. An installed package stays loaded for the life of the
 * process and must never be selected, even when it is installed beneath the
 * project, and nothing outside the project root belongs to it.
 *
 * Scenarios:
 *
 * 1. A shot module and a capture script under the project root are selected, in
 *    their loaded order.
 * 2. The root itself, a package under the root's `node_modules`, a package under
 *    a nested `node_modules`, a sibling checkout, a path elsewhere on the same
 *    volume, and a path on another volume are not.
 */
export const test_production_project_module_selection = (): void => {
  const root = path.join(path.parse(process.cwd()).root, "workspace", "harbor");
  const opening = path.join(root, "src", "shots", "opening.ts");
  const capture = path.join(root, "scripts", "capture.ts");
  TestValidator.equals(
    "only the project's own modules are selected",
    listAutoMovieProjectModules({
      root,
      loaded: [
        opening,
        root,
        path.join(
          root,
          "node_modules",
          "@automovie",
          "engine",
          "src",
          "index.ts",
        ),
        path.join(
          root,
          "src",
          "vendor",
          "node_modules",
          "left-pad",
          "index.js",
        ),
        capture,
        path.join(root, "..", "harbor-annex", "src", "shots", "opening.ts"),
        path.join(path.parse(root).root, "elsewhere", "helper.ts"),
        "Z:\\cache\\helper.ts",
      ],
    }),
    [opening, capture],
  );
};
