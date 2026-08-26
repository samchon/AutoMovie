import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import path from "node:path";

import { namedFacts } from "../internal/predicates";

/**
 * The scaffold's subject tree can reach past a node's first page of members.
 *
 * A description's member sample is bounded at 64, and a building is flat: one
 * measured manor is a single root owning 988 children, so opening the building
 * listed 64 and the reviewer reached no further. Nothing was lost — the subject
 * census enumerates every one — but the tree is how a reviewer actually looks,
 * and it stopped there while reporting the rest as "named only by key", which
 * is a statement that they were unreachable by clicking. They were.
 *
 * The engine now answers a page at a rank, so the tree asks for the next one.
 *
 * **This case is structural, and that is a limitation rather than a choice.**
 * Nothing in this suite loads the scaffold's viewer: it needs a browser, and
 * the viewer package is tested through its own API instead. That gap is exactly
 * how a top-level statement ordered before its own declaration shipped in
 * `film.ts` and left every generated project unable to draw a film frame. Until
 * a browser runs these pages here, a structural case that fails on a revert is
 * worth more than no case, and the browser check belongs to the
 * viewer-verification pass rather than to this file.
 *
 * Scenarios:
 *
 * 1. The tree asks for a later page rather than only the first, and remembers
 *    pages apart so a second page is not served the first one's rows.
 * 2. The membership line no longer describes the remainder as reachable only by
 *    key, which was true before and would be a lie now.
 * 3. The control that asks for the next page carries a class the stylesheet
 *    actually styles, so it is visible and reads as something to press.
 */
export const test_cli_scaffold_viewer_member_paging = (): void => {
  const root = path.resolve(__dirname, "../../../../packages/template/scaffold");
  const source = fs.readFileSync(
    path.join(root, "viewer", "src", "subject.ts"),
    "utf8",
  );
  const styles = fs.readFileSync(
    path.join(root, "viewer", "subject.html"),
    "utf8",
  );

  TestValidator.equals(
    "the subject tree reaches past a node's first page",
    namedFacts([
      [
        "it asks the description for a rank",
        () => source.includes("memberOffset"),
      ],
      [
        "and asks for one past the first",
        () =>
          /expandFrom\(row, offset \+ answer\.members\.items\.length\)/.test(
            source,
          ),
      ],
      // Two pages of one node are two answers. A cache keyed by subject alone
      // would hand the second reader the first reader's rows, which reads as a
      // node whose children never grow.
      [
        "pages are remembered apart",
        () =>
          /const key = `\$\{compiledId\}[^`]*\$\{memberOffset\}`/.test(source),
      ],
      [
        "the remainder is no longer called reachable only by key",
        () => source.includes("named only by key") === false,
      ],
      [
        "the page control is styled",
        () => source.includes('"more"') && styles.includes("#subject .more {"),
      ],
    ]),
    {
      "it asks the description for a rank": true,
      "and asks for one past the first": true,
      "pages are remembered apart": true,
      "the remainder is no longer called reachable only by key": true,
      "the page control is styled": true,
    },
  );
};
