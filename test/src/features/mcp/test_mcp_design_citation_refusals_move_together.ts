import { openAutoMovieProduction } from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import path from "node:path";

import { namedFacts } from "../internal/predicates";
import { productionFixture } from "./productionFixtures";

/**
 * Both dangling-citation refusals name the layer, and neither can drift alone.
 *
 * A shot contract and an acceptance scenario cite a scene and a continuity
 * claim from one loop over one evidence entry, so the two refusals that loop
 * raises answer for the same fact: the citation lives in a compiler-owned
 * design record the author was never told was theirs to delete. The scene half
 * was taught to say so and the claim half was not, and nothing held them
 * together, so for one release the same evidence entry produced one refusal
 * that explained itself and one that read as a `src` problem.
 *
 * That is what this case pins, and it pins the pair rather than the prose. The
 * shared clause is taken as the longest run the two messages have in common
 * rather than quoted here, because a case that quotes the sentence goes red on
 * every legitimate rewording and teaches the next author to re-paste instead of
 * to read. Rewording both together keeps the run and stays green; rewording one
 * alone collapses it. Measured against the wording this replaced, the run falls
 * from 108 characters to 49 and stops naming the record at all.
 *
 * One phrase is quoted, `compiler-owned design record`, and it is the layer's
 * own name rather than a sentence. Without it the run could shrink to shared
 * boilerplate such as the closing instruction to compile again and still pass,
 * so the anchor is what keeps the run meaning what its name says. Renaming the
 * layer is a semantic change and is meant to be read here.
 *
 * Scenarios:
 *
 * 1. One production whose index declares neither the scene nor the claim its
 *    resident records cite raises both refusals, so neither is asserted vacuously.
 * 2. Every refusal of either code carries a `path` that is a design record file
 *    that exists, so the author can open what the message points at.
 * 3. One design record raises both, which is the join that makes them a pair
 *    rather than two independent messages that happen to be adjacent.
 * 4. The clause the two share names the compiler-owned design record, so the
 *    day one of them is reworded without it, this goes red.
 */
export const test_mcp_design_citation_refusals_move_together = (): void => {
  const fixture = productionFixture();
  try {
    // The docs layer moved on and the design layer did not. Renaming the
    // indexed scene and the indexed claim is the smallest way to reproduce it:
    // every starter record goes on citing the ids the index just dropped.
    const indexPath = path.join(
      fixture.root,
      ".automovie/design/screenplay/index.json",
    );
    rewrite(indexPath, [
      ['"SCN-001"', '"SCN-900"'],
      ['"cue-arm-readable"', '"cue-arm-vanished"'],
    ]);

    const output = openAutoMovieProduction({
      projectRoot: fixture.root,
    }).compiler.lint({ scope: "source" });
    const raised = (code: string) =>
      output.diagnostics.filter((diagnostic) => diagnostic.code === code);
    const scene = raised("screenplay-citation-scene-absent");
    const claim = raised("screenplay-citation-claim-absent");

    const opens = (relative: string | null): boolean =>
      relative !== null &&
      relative.startsWith(".automovie/design/") &&
      relative.endsWith(".json") &&
      fs.existsSync(path.join(fixture.root, relative));

    TestValidator.equals(
      "the pair of dangling-citation refusals answers for the record that wrote it",
      namedFacts([
        ["the scene citation is refused", () => scene.length > 0],
        ["the claim citation is refused", () => claim.length > 0],
        [
          "every refusal names a design record the author can open",
          () =>
            [...scene, ...claim].every((diagnostic) => opens(diagnostic.path)),
        ],
        [
          // The starter's shot contract cites a scene and a claim in one
          // evidence entry, so one record has to appear on both sides. Two
          // disjoint sets would mean the loop this case describes is not the
          // loop that raised them.
          "one record raises both halves of the pair",
          () =>
            scene.some((left) =>
              claim.some((right) => right.path === left.path),
            ),
        ],
        [
          // Computed from one of each and then required of all of them, so a
          // template split per owner kind cannot leave half the population
          // drifting behind the half this fact happened to sample.
          "the clause the two share names the compiler-owned design record",
          () => {
            const shared = longestCommonRun(
              scene[0]!.message,
              claim[0]!.message,
            );
            return (
              shared.includes("compiler-owned design record") &&
              [...scene, ...claim].every((diagnostic) =>
                diagnostic.message.includes(shared),
              )
            );
          },
        ],
      ]),
      {
        "the scene citation is refused": true,
        "the claim citation is refused": true,
        "every refusal names a design record the author can open": true,
        "one record raises both halves of the pair": true,
        "the clause the two share names the compiler-owned design record": true,
      },
    );
  } finally {
    fixture.dispose();
  }
};

/**
 * Apply every replacement, refusing one that matched nothing.
 *
 * `String.replaceAll` returns its input when the anchor is gone, so a rewrite
 * that silently no-ops leaves the case running against unmutated material: it
 * does not go red, it quietly starts asserting something else.
 */
const rewrite = (
  file: string,
  replacements: ReadonlyArray<readonly [string, string]>,
): void => {
  let content = fs.readFileSync(file, "utf8");
  for (const [from, to] of replacements) {
    const next = content.replaceAll(from, to);
    if (next === content)
      throw new Error(
        `Fixture rewrite of ${path.basename(file)} found no ${from} to replace. The case would have run against unmutated material.`,
      );
    content = next;
  }
  fs.writeFileSync(file, content, "utf8");
};

/**
 * The longest run of characters two strings have in common.
 *
 * Used instead of a quoted sentence so the assertion tracks what the two
 * messages agree on rather than what this file remembers them saying.
 */
const longestCommonRun = (left: string, right: string): string => {
  let best = "";
  const lengths = new Array<number>(right.length + 1).fill(0);
  for (let i = 1; i <= left.length; i += 1) {
    let diagonal = 0;
    for (let j = 1; j <= right.length; j += 1) {
      const above = lengths[j]!;
      if (left[i - 1] === right[j - 1]) {
        lengths[j] = diagonal + 1;
        if (lengths[j]! > best.length) best = left.slice(i - lengths[j]!, i);
      } else lengths[j] = 0;
      diagonal = above;
    }
  }
  return best;
};
