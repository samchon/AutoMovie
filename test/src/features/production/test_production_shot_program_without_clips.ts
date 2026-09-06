import {
  AutoMovieProductionCompiler,
  AutoMovieProductionProject,
} from "@automovie/production";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import path from "node:path";

import { productionFixture, rewriteSource } from "./productionFixtures";

/**
 * A shot program that declares no clips is a complete program whose enact
 * actions have nothing to enact: the compiler reads the absent clip list as
 * empty, adopts nothing into it, and refuses the action by naming the clip
 * rather than crashing on the missing field or inventing a default clip.
 */
export const test_production_shot_program_without_clips = (): void => {
  const fixture = productionFixture();
  try {
    const shotPath = path.join(fixture.root, "src", "shots", "opening.ts");
    fs.writeFileSync(
      shotPath,
      rewriteSource(
        fs.readFileSync(shotPath, "utf8"),
        "    clips: [...performer.clips!],\n",
        "",
      ),
      "utf8",
    );
    const output = new AutoMovieProductionCompiler(
      AutoMovieProductionProject.open(fixture.root),
    ).compile({ scope: "source" });
    TestValidator.equals(
      "a program that enacts a clip it never declares is refused by that clip",
      {
        success: output.success,
        absentClip: output.diagnostics.some((diagnostic) =>
          diagnostic.message.includes("enacts absent clip"),
        ),
      },
      { success: false, absentClip: true },
    );
  } finally {
    fixture.dispose();
  }
};
