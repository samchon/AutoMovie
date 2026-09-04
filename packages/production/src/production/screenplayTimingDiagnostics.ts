import type {
  IAutoMovieDiagnostic,
  IAutoMovieScreenplayIndex,
  IAutoMovieShotContract,
} from "@automovie/interface";

import {
  type IAutoMovieParsedScreenplayTimingOccurrence,
  authoredScreenplayMarkdownLines,
  parseScreenplayProse,
  parseScreenplayTimingOccurrences,
} from "./screenplayProseDiagnostics";

/** Compare authored seconds at the precision of the portable JSON contract. */
const SAME_SECOND = 1e-6;

export type IAutoMovieScreenplayTimingSelector =
  | { kind: "duration"; shot: string }
  | {
      kind: "event";
      shot: string;
      event: string;
      boundary: "from" | "to";
    }
  | { kind: "review"; shot: string; frame: string };

/**
 * Parse the exact owner selector attached to one screenplay timing occurrence.
 *
 * The grammar is deliberately closed. A target that is almost right is not
 * silently redirected to a different clock field.
 */
export const parseScreenplayTimingSelector = (
  value: string,
): IAutoMovieScreenplayTimingSelector | null => {
  const duration = /^shot:([^/\s]+)\/duration$/u.exec(value);
  if (duration !== null) return { kind: "duration", shot: duration[1]! };
  const event = /^shot:([^/\s]+)\/event:([^/\s]+)\/(from|to)$/u.exec(value);
  if (event !== null)
    return {
      kind: "event",
      shot: event[1]!,
      event: event[2]!,
      boundary: event[3] as "from" | "to",
    };
  const review = /^shot:([^/\s]+)\/review:([^/\s]+)$/u.exec(value);
  return review === null
    ? null
    : { kind: "review", shot: review[1]!, frame: review[2]! };
};

const ownedValue = (
  contract: IAutoMovieShotContract,
  selector: IAutoMovieScreenplayTimingSelector,
): number | null => {
  if (selector.kind === "duration") return contract.durationSeconds;
  if (selector.kind === "event") {
    const event = contract.events.find((entry) => entry.id === selector.event);
    return event === undefined ? null : event.window[selector.boundary];
  }
  return (
    contract.reviewFrames.find((frame) => frame.id === selector.frame)?.time ??
    null
  );
};

const screenplayPreambleTiming = (
  content: string,
): IAutoMovieParsedScreenplayTimingOccurrence[] => {
  const preamble: string[] = [];
  for (const line of authoredScreenplayMarkdownLines(content)) {
    if (/^#{1,6}[ \t]+SCN-[A-Za-z0-9-]+[ \t]+(?:—|-|:)/u.test(line)) break;
    preamble.push(line);
  }
  return parseScreenplayTimingOccurrences(preamble.join("\n"));
};

/**
 * Validate every prose timing claim against its explicit local owner.
 *
 * Numeric equality is never authority. The inline selector must name a shot
 * that cites this scene and the exact duration, event boundary or review frame
 * whose value the prose states. Word and fraction spellings are normalized by
 * the shared prose parser before this join.
 */
export const screenplayTimingDiagnostics = (props: {
  contracts: ReadonlyMap<string, IAutoMovieShotContract>;
  read: (relativePath: string) => string | null;
  scope: "design" | "source" | "review" | "final";
  screenplay: IAutoMovieScreenplayIndex | null;
}): IAutoMovieDiagnostic[] => {
  const screenplay = props.screenplay;
  if (screenplay === null) return [];
  const diagnostics: IAutoMovieDiagnostic[] = [];
  const category =
    props.scope === "review" || props.scope === "final" ? "error" : "warning";
  const documents = new Map<string, string | null>();
  const read = (path: string): string | null => {
    if (documents.has(path)) return documents.get(path)!;
    const content = props.read(path);
    documents.set(path, content);
    return content;
  };
  const refuse = (
    code:
      | "screenplay-timing-unowned"
      | "screenplay-timing-reference-invalid"
      | "screenplay-timing-owner-absent"
      | "screenplay-timing-value-mismatch",
    message: string,
    path: string,
  ): void => {
    diagnostics.push({
      code,
      category,
      phase: "compile",
      target: "screenplay",
      path,
      message,
    });
  };
  const screenplayDocument = read(screenplay.screenplay.path);
  if (screenplayDocument !== null)
    for (const occurrence of screenplayPreambleTiming(screenplayDocument))
      refuse(
        "screenplay-timing-unowned",
        `Screenplay prose outside an indexed scene states "${occurrence.text} seconds". A sequence heading or preamble has no shot-local timing owner. Move the claim into its scene with an exact {@timing ...} selector, then compile again.`,
        screenplay.screenplay.path,
      );

  for (const scene of screenplay.screenplay.scenes) {
    if (scene.status !== "active" || scene.disposition?.phase === "screenplay")
      continue;
    const documentPath = scene.path ?? screenplay.screenplay.path;
    const content = read(documentPath);
    if (content === null) continue;
    const parsed = parseScreenplayProse(content).find(
      (entry) => entry.id === scene.id,
    );
    if (parsed === undefined) continue;
    for (const occurrence of parsed.timing) {
      if (occurrence.selector === null) {
        refuse(
          "screenplay-timing-unowned",
          `Scene "${scene.id}" states "${occurrence.text} seconds" without an inline {@timing ...} owner. Numeric coincidence elsewhere in the production is not traceability. Name the exact shot field, then compile again.`,
          documentPath,
        );
        continue;
      }
      const selector = parseScreenplayTimingSelector(occurrence.selector);
      if (selector === null) {
        refuse(
          "screenplay-timing-reference-invalid",
          `Scene "${scene.id}" uses unsupported timing selector "${occurrence.selector}". Use shot:<id>/duration, shot:<id>/event:<id>/from, shot:<id>/event:<id>/to or shot:<id>/review:<id>, then compile again.`,
          documentPath,
        );
        continue;
      }
      const contract = props.contracts.get(selector.shot);
      const realizesScene = contract?.evidence?.some(
        (evidence) => evidence.scene === scene.id,
      );
      if (contract === undefined || realizesScene !== true) {
        refuse(
          "screenplay-timing-owner-absent",
          `Scene "${scene.id}" assigns "${occurrence.text} seconds" to shot "${selector.shot}", but that shot does not exist or does not cite this scene. An equal value in another shot cannot own this occurrence. Correct the selector or the shot evidence, then compile again.`,
          documentPath,
        );
        continue;
      }
      const expected = ownedValue(contract, selector);
      if (expected === null) {
        refuse(
          "screenplay-timing-owner-absent",
          `Scene "${scene.id}" timing selector "${occurrence.selector}" names no field in its shot contract. Correct the event, boundary or review-frame identity, then compile again.`,
          documentPath,
        );
        continue;
      }
      if (Math.abs(expected - occurrence.seconds) > SAME_SECOND)
        refuse(
          "screenplay-timing-value-mismatch",
          `Scene "${scene.id}" states ${occurrence.seconds}s for "${occurrence.selector}", whose authoritative contract value is ${expected}s. Correct the prose or the owning field instead of borrowing an equal value elsewhere, then compile again.`,
          documentPath,
        );
    }
  }
  return diagnostics;
};
