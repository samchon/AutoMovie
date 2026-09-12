import { TestValidator } from "@nestia/e2e";

import { loadSourceModule } from "../internal/loadSourceModule";
import { productionModule } from "./sourceStatusFixtures";

interface ITrace {
  documents: Array<{ path: string; content: string | null }>;
  revisionBound: boolean;
}

interface IClearanceRuntime {
  revision: string;
  currentRevision: string;
  sampleRate: number;
}

const { recordAutoMovieProductionDocumentRead } = loadSourceModule<{
  recordAutoMovieProductionDocumentRead(props: {
    trace: ITrace | undefined;
    read: (relativePath: string) => string | null;
  }): (relativePath: string) => string | null;
}>(productionModule("recordAutoMovieProductionDocumentRead.ts"));
const { recordAutoMovieProductionClearanceRevision } = loadSourceModule<{
  recordAutoMovieProductionClearanceRevision(props: {
    trace: ITrace | undefined;
    runtime: IClearanceRuntime;
  }): IClearanceRuntime;
}>(productionModule("recordAutoMovieProductionClearanceRevision.ts"));

/**
 * A gate run records exactly the reads its answer depends on.
 *
 * Validation reads author-owned documents through one reader, and a clearance
 * evaluation reads the project revision through the runtime the builder hands
 * it. A retained answer is safe to reuse only when every document it read is
 * read again and only when its dependence on the revision is known, so the
 * reader must record each read as it happened and the runtime must record a
 * revision read without recording a read that is not one. Without a trace both
 * must be exactly what the builder would have used anyway.
 *
 * Scenarios:
 *
 * 1. A recorded reader returns each document's text and records every read in
 *    order, a repeated read with changed text and an absent document included.
 * 2. Without a trace the reader is the builder's own reader.
 * 3. Reading the sample rate leaves the trace unbound, and reading the measured
 *    revision or the current revision binds it, each returning the builder's
 *    value.
 * 4. Without a trace the clearance runtime is the builder's own runtime.
 */
export const test_production_source_gate_trace = (): void => {
  const texts = new Map<string, string>([
    ["docs/screenplays/001-harbor.md", "INT. HARBOR - NIGHT"],
  ]);
  const read = (relativePath: string): string | null =>
    texts.get(relativePath) ?? null;
  const trace: ITrace = { documents: [], revisionBound: false };
  const recorded = recordAutoMovieProductionDocumentRead({ trace, read });
  const returned = [
    recorded("docs/screenplays/001-harbor.md"),
    recorded("docs/treatment.md"),
  ];
  texts.set("docs/screenplays/001-harbor.md", "EXT. HARBOR - DAWN");
  returned.push(recorded("docs/screenplays/001-harbor.md"));
  TestValidator.equals(
    "every document read is returned and recorded in order",
    { returned, documents: trace.documents },
    {
      returned: ["INT. HARBOR - NIGHT", null, "EXT. HARBOR - DAWN"],
      documents: [
        {
          path: "docs/screenplays/001-harbor.md",
          content: "INT. HARBOR - NIGHT",
        },
        { path: "docs/treatment.md", content: null },
        {
          path: "docs/screenplays/001-harbor.md",
          content: "EXT. HARBOR - DAWN",
        },
      ],
    },
  );
  TestValidator.equals(
    "an untraced reader is the builder's own reader",
    recordAutoMovieProductionDocumentRead({ trace: undefined, read }) === read,
    true,
  );

  const runtime: IClearanceRuntime = {
    revision: "41",
    currentRevision: "41",
    sampleRate: 24,
  };
  const bound = (key: keyof IClearanceRuntime) => {
    const clearanceTrace: ITrace = { documents: [], revisionBound: false };
    const recordedRuntime = recordAutoMovieProductionClearanceRevision({
      trace: clearanceTrace,
      runtime,
    });
    return {
      value: recordedRuntime[key],
      revisionBound: clearanceTrace.revisionBound,
    };
  };
  TestValidator.equals(
    "only a revision read binds the trace",
    {
      sampleRate: bound("sampleRate"),
      revision: bound("revision"),
      currentRevision: bound("currentRevision"),
    },
    {
      sampleRate: { value: 24, revisionBound: false },
      revision: { value: "41", revisionBound: true },
      currentRevision: { value: "41", revisionBound: true },
    },
  );
  TestValidator.equals(
    "an untraced clearance runtime is the builder's own runtime",
    recordAutoMovieProductionClearanceRevision({
      trace: undefined,
      runtime,
    }) === runtime,
    true,
  );
};
