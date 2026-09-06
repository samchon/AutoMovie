import type {
  AutoMovieLibraryReviewEvidence,
  IAutoMovieLibraryReviewObservationReceipt,
  IAutoMovieLibraryReviewPlanFile,
  IAutoMovieLibraryReviewUnitPlan,
} from "@automovie/interface";
import path from "node:path";

import { loadSourceModule } from "./loadSourceModule";

export interface ILibraryPublicationFile {
  identity: string;
  source: string;
  version: string;
}
export interface ILibraryPublicationIO {
  assertBound(): void;
  read(path: string): ILibraryPublicationFile | null;
  stage(path: string, source: string): ILibraryPublicationFile;
  move(
    source: { path: string; file: ILibraryPublicationFile },
    target: string,
  ): void;
}
export const libraryPublication = loadSourceModule<{
  admitLibraryReviewReceipt: (props: {
    assertCurrent: () => void;
    expected: AutoMovieLibraryReviewEvidence;
    read: () => AutoMovieLibraryReviewEvidence;
  }) => void;
  assertLibraryReviewPlanAuthoring: <Authoring>(props: {
    expected: Authoring;
    read: () => Authoring;
  }) => void;
  parseLibraryReviewPublication: (props: {
    before: ILibraryPublicationFile | null;
    parse: (source: string) => IAutoMovieLibraryReviewPlanFile;
  }) => IAutoMovieLibraryReviewPlanFile;
  planLibraryReviewUnit: (props: {
    previous: IAutoMovieLibraryReviewPlanFile;
    unit: Pick<
      IAutoMovieLibraryReviewUnitPlan,
      "anchor" | "sources" | "observations"
    >;
  }) => IAutoMovieLibraryReviewPlanFile;
  recordLibraryReviewReceipt: (props: {
    previous: IAutoMovieLibraryReviewPlanFile;
    anchor: string;
    receipt: IAutoMovieLibraryReviewObservationReceipt;
  }) => IAutoMovieLibraryReviewPlanFile;
  libraryReviewPublicationSource: (props: {
    before: ILibraryPublicationFile | null;
    previous: IAutoMovieLibraryReviewPlanFile;
    plan: IAutoMovieLibraryReviewPlanFile;
  }) => string;
  readLibraryReviewPublication: (props: {
    target: string;
    io: ILibraryPublicationIO;
  }) => ILibraryPublicationFile | null;
  publishLibraryReview: (props: {
    target: string;
    before: ILibraryPublicationFile | null;
    source: string;
    attempt: string;
    admit: () => void;
    io: ILibraryPublicationIO;
  }) => "published" | "already-recorded";
}>(
  path.resolve(
    __dirname,
    "../../../../packages/template/scaffold/scripts/libraryReviewPublication.ts",
  ),
);

export type LibraryPublicationEvent = {
  kind: "bound" | "read" | "stage" | "move" | "moved";
  path: string;
  target?: string;
};

/** A typed publication protocol double; no project or operating system is created. */
export const createLibraryPublicationFixture = (
  before: ILibraryPublicationFile | null,
) => {
  const target = "docs/models/subject.review.json";
  const files = new Map<string, ILibraryPublicationFile>();
  if (before !== null) files.set(target, { ...before });
  const events: LibraryPublicationEvent[] = [];
  let hook = (_event: LibraryPublicationEvent): void => {};
  let serial = 0;
  const event = (entry: LibraryPublicationEvent): void => {
    events.push(entry);
    hook(entry);
  };
  const io: ILibraryPublicationIO = {
    assertBound: () => event({ kind: "bound", path: target }),
    read: (relative) => {
      event({ kind: "read", path: relative });
      const file = files.get(relative);
      return file === undefined ? null : { ...file };
    },
    stage: (relative, source) => {
      event({ kind: "stage", path: relative });
      if (files.has(relative)) throw new Error("exclusive staging competitor");
      const file = { identity: `created-${++serial}`, version: "1", source };
      files.set(relative, file);
      return { ...file };
    },
    move: (source, destination) => {
      event({ kind: "move", path: source.path, target: destination });
      const current = files.get(source.path);
      if (JSON.stringify(current) !== JSON.stringify(source.file))
        throw new Error("move source changed");
      if (files.has(destination)) throw new Error("no-replace competitor");
      files.delete(source.path);
      files.set(destination, { ...source.file });
      event({ kind: "moved", path: source.path, target: destination });
    },
  };
  return {
    target,
    files,
    events,
    io,
    hook: (next: typeof hook): void => {
      hook = next;
    },
    run: (admit: () => void = () => {}, source: string = "new receipt bytes") =>
      libraryPublication.publishLibraryReview({
        target,
        before,
        source,
        attempt: "attempt",
        admit,
        io,
      }),
  };
};

export const libraryPublicationOriginal = (): ILibraryPublicationFile => ({
  identity: "original",
  source: "original failed history",
  version: "1",
});

export const libraryPublicationReceipt = (
  verdict: IAutoMovieLibraryReviewObservationReceipt["verdict"],
): IAutoMovieLibraryReviewObservationReceipt => ({
  observation: "whole",
  evidence: { kind: "turntable", model: "subject" },
  identity: {
    design: `sha256:${"a".repeat(64)}`,
    source: `sha256:${"b".repeat(64)}`,
    generated: `sha256:${"c".repeat(64)}`,
    plan: `sha256:${"d".repeat(64)}`,
  },
  runtimeIdentity: "instrument:1",
  pose: null,
  measurements: {},
  verdict,
});
