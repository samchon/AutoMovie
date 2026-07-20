import { IAutoMovieScript, IAutoMovieShot } from "@automovie/interface";
import {
  AutoMovieApplication,
  IAutoMovieMcpWritableSlate,
} from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";

import {
  createScriptTree,
  treeBeats,
} from "../validation/test_validation_script_tree";

const app = new AutoMovieApplication();

const script = (withTree: boolean): IAutoMovieScript => ({
  logline: "A hunter becomes the hunted.",
  theme: "reversal",
  cast: [],
  beats: treeBeats(),
  ...(withTree ? { tree: createScriptTree() } : {}),
});

const slate = (withTree: boolean): IAutoMovieMcpWritableSlate => ({
  script: script(withTree),
  scene: null,
  shots: [],
  beatEnds: [],
  notes: [],
  film: null,
});

const shot: IAutoMovieShot = {
  id: "shot:beat-1",
  name: null,
  scene: "scene-1",
  camera: "cam-main",
  cameraMotion: null,
  performances: [],
  objectMotions: [],
  duration: 1,
};

/**
 * The one real wiring of the feedback cascade (#620): commitShot locates its
 * violations on the screenplay graph. The film-ladder consumers take the script
 * WRITE payload (no tree), so the commit gate, which holds the committed
 * script, the beat, and the violations together, is where the stamp lives;
 * downstream, scriptAncestors climbs from the stamped node.
 *
 * Scenarios:
 *
 * 1. A shot committed before the scene exists is refused, and, because the
 *    committed script carries a refinement tree claiming `beat-1`, every
 *    violation of that commit carries `node: "b1"`.
 * 2. The treeless twin: the identical refusal without a tree carries no node ,
 *    byte-compatible pre-#620 behavior.
 */
export const test_mcp_commit_shot_located = (): void => {
  const located = app.commitShot({ slate: slate(true), shot });
  TestValidator.equals("commit refused", located.committed, false);
  TestValidator.predicate(
    "every violation locates on the beat node",
    located.validation.success === false &&
      located.validation.violations.length > 0 &&
      located.validation.violations.every(
        (violation) => violation.node === "b1",
      ),
  );

  const treeless = app.commitShot({ slate: slate(false), shot });
  TestValidator.equals(
    "treeless commit refused too",
    treeless.committed,
    false,
  );
  TestValidator.predicate(
    "treeless violations stay unlocated",
    treeless.validation.success === false &&
      treeless.validation.violations.every(
        (violation) => violation.node === undefined,
      ),
  );
};
