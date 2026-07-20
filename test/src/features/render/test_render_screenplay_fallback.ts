import { IAutoMovieScript } from "@automovie/interface";
import { renderScreenplay } from "@automovie/render";
import { TestValidator } from "@nestia/e2e";

import { throwsError } from "../internal/predicates";
import { TREE_SCRIPT, screenplayNode } from "./test_render_screenplay";

/**
 * The treeless fallback and the guards: flat scripts stay exportable, ghost
 * references degrade to the raw id, an empty tree renders only the terminator,
 * and a script with no beats refuses to render.
 *
 * Scenarios:
 *
 * 1. A treeless script renders the flat fallback: header from the flat
 *    logline/theme, each beat as name over summary.
 * 2. A beat node naming a ghost flat beat falls back to the raw beat id (the
 *    renderer is total; commit validation owns the rejection).
 * 3. `tree: []` renders an empty document body (total function).
 * 4. Zero beats throw: there is no screenplay to render.
 */
export const test_render_screenplay_fallback = (): void => {
  const flat: IAutoMovieScript = { ...TREE_SCRIPT, tree: null };
  const text = renderScreenplay(flat);
  TestValidator.predicate(
    "flat header from the script fields",
    text.includes("LOGLINE: flat logline (ignored when a tree exists)") &&
      text.includes("THEME: flat theme"),
  );
  TestValidator.predicate(
    "flat beats render name over summary",
    text.includes("BEAT, The duel\nThe duel summary") &&
      text.includes("BEAT, The aftermath\nThe aftermath summary"),
  );

  const ghost: IAutoMovieScript = {
    ...TREE_SCRIPT,
    tree: [
      screenplayNode({
        id: "root",
        parent: null,
        kind: "intent",
        payload: { logline: "l", theme: "t" },
      }),
      screenplayNode({
        id: "b1",
        parent: "root",
        kind: "beat",
        payload: { beat: "ghost", direction: "d", dialogue: [], caption: null },
      }),
    ],
  };
  TestValidator.predicate(
    "ghost beat id passes through",
    renderScreenplay(ghost).includes("BEAT, ghost"),
  );

  TestValidator.equals(
    "empty tree renders empty body",
    renderScreenplay({ ...TREE_SCRIPT, tree: [] }),
    "\n",
  );

  TestValidator.predicate(
    "zero beats throw",
    throwsError(
      () => renderScreenplay({ ...TREE_SCRIPT, beats: [] }),
      "no beats",
    ),
  );
};
