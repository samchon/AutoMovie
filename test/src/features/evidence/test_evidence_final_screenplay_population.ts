import {
  type IAutoMovieScreenplayDocumentIdentity,
  validateAutoMovieFinalScreenplayPopulation,
} from "@automovie/evidence";
import { TestValidator } from "@nestia/e2e";

/**
 * Final language revision cannot change the frozen screenplay address space.
 *
 * Scenarios:
 * 1. Disabled empty populations pass without reading; resident residue refuses.
 * 2. Active empty, missing, extra, renamed, and reordered files refuse.
 * 3. Changed H1, unit count, depth, anchor, lineage, title, or order refuses.
 * 4. Draft annotations refuse, while later-stage annotations and revised body
 *    language preserve identity; group titles remain exact in every stage.
 */
export const test_evidence_final_screenplay_population = (): void => {
  const document: IAutoMovieScreenplayDocumentIdentity = {
    title: "Arrival",
    source: "# Arrival\n\n## Gate {#gate}\n\nThe door is shut.\n",
    units: [
      { depth: 2, anchor: "gate", lineage: "gate", title: "Gate" },
      { depth: 3, anchor: "entry", lineage: "gate/entry", title: "Entry" },
      {
        depth: 4,
        anchor: "knock",
        lineage: "gate/entry/knock",
        title: "Knock",
      },
    ],
  };
  const files = ["001-part/001-arrival.md", "002-part/001-return.md"];
  const base: Parameters<typeof validateAutoMovieFinalScreenplayPopulation>[0] =
    {
      stage: "draft",
      residents: files,
      files,
      construction: new Map(files.map((file) => [file, document])),
      readFinal: () => document,
      readGroupTitles: () => ({ construction: "Part", final: "Part" }),
    };
  const refuse = (overrides: Partial<typeof base>, reason: string): void => {
    let message = "";
    try {
      validateAutoMovieFinalScreenplayPopulation({ ...base, ...overrides });
    } catch (error) {
      message = (error as Error).message;
    }
    TestValidator.predicate(reason, message.includes(reason));
  };
  let reads = 0;
  validateAutoMovieFinalScreenplayPopulation({
    ...base,
    stage: "disabled",
    residents: [],
    files: [],
    construction: new Map(),
    readFinal: () => {
      reads++;
      return document;
    },
  });
  TestValidator.equals("disabled needs no final reads", reads, 0);
  refuse({ stage: "disabled" }, "disabled but governed hosts remain");
  refuse({ files: [] }, "without a final screenplay host");
  for (const changed of [
    [files[0]!],
    [...files, "003-extra/001-unit.md"],
    ["001-part/002-renamed.md", files[1]!],
    [...files].reverse(),
  ])
    refuse({ files: changed }, "filenames must exactly preserve");
  refuse(
    { readFinal: () => ({ ...document, title: "Departure" }) },
    "H1 title",
  );
  for (const units of [
    [],
    document.units.slice(0, 2),
    [...document.units].reverse(),
    ...[
      { depth: 3 as const },
      { anchor: "changed" },
      { lineage: "other/gate" },
      { title: "Other title" },
    ].map((change) => [
      { ...document.units[0]!, ...change },
      ...document.units.slice(1),
    ]),
  ])
    refuse(
      { readFinal: () => ({ ...document, units }) },
      "headings, identity, nesting, and order",
    );
  const annotated = {
    ...document,
    source:
      "<!--\n@evidence screenplays/001-part/001-arrival.md Exact construction file.\n-->\n" +
      document.source,
  };
  refuse({ readFinal: () => annotated }, "before evidence tags are authored");
  for (const stage of ["evidence", "review"] as const)
    validateAutoMovieFinalScreenplayPopulation({
      ...base,
      stage,
      readFinal: () => annotated,
    });
  refuse(
    { readGroupTitles: () => ({ construction: "Part", final: "Other" }) },
    "delivery-group H1 title",
  );
  const groups: string[] = [];
  validateAutoMovieFinalScreenplayPopulation({
    ...base,
    readFinal: () => ({
      ...document,
      source: document.source + '\n"Come in."\n',
    }),
    readGroupTitles: (group) => {
      groups.push(group);
      return { construction: "Part", final: "Part" };
    },
  });
  TestValidator.equals("each delivery group is checked", groups, [
    "001-part",
    "002-part",
  ]);
};
