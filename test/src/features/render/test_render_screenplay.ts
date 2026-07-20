import { IAutoMovieScript, IAutoMovieScriptNode } from "@automovie/interface";
import { renderScreenplay } from "@automovie/render";
import { TestValidator } from "@nestia/e2e";

export const screenplayBeat = (id: string, name: string) => ({
  id,
  name,
  summary: `${name} summary`,
  durationHint: 2,
});

export const screenplayNode = (
  partial: Omit<IAutoMovieScriptNode, "temporal" | "interactsWith">,
): IAutoMovieScriptNode =>
  ({ temporal: null, interactsWith: [], ...partial }) as IAutoMovieScriptNode;

/** Intent → act → scene → group → two beats, exercising every payload branch. */
export const TREE_SCRIPT: IAutoMovieScript = {
  logline: "flat logline (ignored when a tree exists)",
  theme: "flat theme",
  cast: [],
  beats: [
    screenplayBeat("duel", "The duel"),
    screenplayBeat("aftermath", "The aftermath"),
  ],
  tree: [
    screenplayNode({
      id: "root",
      parent: null,
      kind: "intent",
      payload: { logline: "A knight faces his rival.", theme: "honor" },
    }),
    screenplayNode({
      id: "act1",
      parent: "root",
      kind: "act",
      payload: { purpose: "the rivalry breaks" },
    }),
    screenplayNode({
      id: "scene1",
      parent: "act1",
      kind: "scene",
      payload: {
        interiorExterior: "EXT",
        location: "castle courtyard",
        timeOfDay: "dawn",
        description: "Mist over the flagstones.",
      },
    }),
    screenplayNode({
      id: "grp",
      parent: "scene1",
      kind: "group",
      payload: { rationale: "the exchange" },
    }),
    screenplayNode({
      id: "b1",
      parent: "grp",
      kind: "beat",
      payload: {
        beat: "duel",
        direction: "A lunges; B parries.",
        dialogue: [
          { speaker: "knightA", text: "Yield!", anchor: 1.5 },
          { speaker: "knightB", text: "Never.", anchor: null },
        ],
        caption: "two knights clash at dawn",
      },
    }),
    screenplayNode({
      id: "b2",
      parent: "scene1",
      kind: "beat",
      payload: {
        beat: "aftermath",
        direction: "Dust settles.",
        dialogue: [],
        caption: null,
      },
    }),
  ],
};

/**
 * The screenplay document: the tree renders depth-first with the documented
 * plain-text convention (slug, direction, indented dialogue with anchors,
 * bracketed captions), and the same script yields the same bytes.
 *
 * Scenarios:
 *
 * 1. The five-kind tree renders in refinement order: intent header, act rule,
 *    upper-cased slug + description, group rationale, both beats with their
 *    flat names.
 * 2. Dialogue renders as the indented SPEAKER-over-text convention; an anchored
 *    line carries `[t=1.5s]`, an unanchored one does not.
 * 3. A present caption renders bracketed; the caption-less beat renders none.
 * 4. Determinism: rendering twice yields byte-identical text.
 */
export const test_render_screenplay = (): void => {
  const text = renderScreenplay(TREE_SCRIPT);

  const order = [
    "LOGLINE: A knight faces his rival.",
    "THEME: honor",
    "ACT, the rivalry breaks",
    "EXT. CASTLE COURTYARD - DAWN",
    "Mist over the flagstones.",
    "[the exchange]",
    "BEAT, The duel",
    "A lunges; B parries.",
    "                KNIGHTA",
    "        [t=1.5s] Yield!",
    "                KNIGHTB",
    "        Never.",
    "[Shot: two knights clash at dawn]",
    "BEAT, The aftermath",
    "Dust settles.",
  ];
  let cursor = -1;
  for (const fragment of order) {
    const at = text.indexOf(fragment);
    TestValidator.predicate(`renders "${fragment}" in order`, at > cursor);
    cursor = at;
  }
  TestValidator.equals(
    "caption-less beat renders no bracket",
    text.includes("[Shot: two knights clash at dawn]") &&
      text.split("[Shot:").length,
    2,
  );
  TestValidator.equals(
    "deterministic bytes",
    renderScreenplay(TREE_SCRIPT),
    text,
  );
};
