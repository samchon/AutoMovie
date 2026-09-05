import {
  type IAutoMovieBuildingRecord,
  describeAutoMovieBuildingGaps,
  describeAutoMovieBuildingReport,
} from "./buildingRecords";
import {
  type IAutoMovieBuildingSidecar,
  planAutoMovieBuildingSidecars,
} from "./buildingSidecars";

/** One thing the derivation does: a file it writes, or a line it says. */
export type IAutoMovieBuildingAction =
  | { kind: "write"; sidecar: IAutoMovieBuildingSidecar }
  | { kind: "say"; line: string };

/**
 * Collect one record per id from every compiled shot, refusing a divergence.
 *
 * Two shots staging one building carry one record each, and they are the same
 * record: the compiler copies the source's own declaration into every artifact
 * that stages it. So the id is the identity, and deriving both copies would put
 * one sheet on the page twice and make the take-off double the concrete.
 *
 * Two _different_ records wearing one id is a different fact, and this refuses
 * rather than picking. The compiler publishes building ids across shots but
 * does not compare the records behind them, so a divergence reaches here
 * intact; a document silently derived from whichever shot happened to be read
 * first is exactly the kind of evidence nobody can act on.
 *
 * Split from the command with everything else it decides. The command opened
 * project state at module level and refused unless it was current, so nothing
 * could load it, and this refusal; the one place a real contradiction between
 * two shots is caught; had no reader at all.
 */
export const collectAutoMovieStagedRecords = <T extends { id: string }>(props: {
  shots: ReadonlyArray<readonly [string, unknown]>;
  select: (compiled: never) => readonly T[] | undefined;
  what: string;
}): T[] => {
  const found = new Map<string, { record: T; from: string; json: string }>();
  for (const [shot, compiled] of props.shots)
    for (const record of props.select(compiled as never) ?? []) {
      const json = JSON.stringify(record);
      const seen = found.get(record.id);
      if (seen === undefined) {
        found.set(record.id, { record, from: shot, json });
        continue;
      }
      if (seen.json !== json)
        throw new Error(
          `shots "${seen.from}" and "${shot}" stage two different ${props.what} records under the id "${record.id}". One id is one record; rename one of them, or share the subject that emits it.`,
        );
    }
  return [...found.values()]
    .map((entry) => entry.record)
    .sort((left, right) =>
      left.id < right.id ? -1 : left.id > right.id ? 1 : 0,
    );
};

/**
 * Everything one derivation run writes and says, in the order it happens.
 *
 * Returned rather than performed, so the whole decision is readable without a
 * compiled project on disk. The command that used to hold this opens project
 * state at module level and refuses unless it is current, which is why the
 * report loop, the empty-production message and the tally guard beside it went
 * unread for as long as they existed.
 *
 * The sheets of one building come before its lines on purpose: a reader
 * watching the log sees the pages land and then reads what they add up to,
 * which is the order they would open the directory in.
 */
export const deriveAutoMovieBuildingActions = (props: {
  encode: (segment: string) => string;
  records: readonly IAutoMovieBuildingRecord[];
  report: (record: IAutoMovieBuildingRecord) => {
    gaps: ReadonlyArray<{
      status: string;
      subject: string;
      reason: string;
      remedy: string;
    }>;
    quantities: { findings: readonly unknown[] };
    runs: readonly unknown[];
    schedules: ReadonlyArray<{ subject: string; total: number }>;
    services: readonly unknown[];
    sheets: ReadonlyArray<{ view: { id: string }; svg: string }>;
  };
  tally: (records: readonly IAutoMovieBuildingRecord[]) => string;
}): IAutoMovieBuildingAction[] => {
  const actions: IAutoMovieBuildingAction[] = [];
  const say = (line: string): void => {
    actions.push({ kind: "say", line });
  };
  if (props.records.length === 0) {
    say(
      "no built environment is staged or materialized by this production, so there is nothing to draw, count or study. Contribute one from a shot's source and compile before deriving.",
    );
    return actions;
  }
  for (const record of props.records) {
    const report = props.report(record);
    for (const sidecar of planAutoMovieBuildingSidecars({
      encode: props.encode,
      id: record.environment.id,
      report,
    }))
      actions.push({ kind: "write", sidecar });
    for (const line of describeAutoMovieBuildingReport({
      gaps: report.gaps.length,
      id: record.environment.id,
      networks: report.services.length,
      quantitySubjects: report.quantities.findings.length,
      runs: report.runs.length,
      schedules: report.schedules,
      sheets: report.sheets.length,
      source: record.source,
    }))
      say(line);
    for (const line of describeAutoMovieBuildingGaps(report.gaps)) say(line);
  }
  // The tally a reviewer reads before deciding what a claim about this
  // production may rest on. A materialized building has no frames at all, so a
  // review citing one has to cite these drawings; saying so once here is
  // cheaper than rediscovering it per building. With nothing to report the
  // early return above already said so, and a tally of zeroes beside it would
  // only invite reading it as a result.
  say(props.tally(props.records));
  return actions;
};
