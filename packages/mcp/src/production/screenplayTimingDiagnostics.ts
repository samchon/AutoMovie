import {
  IAutoMovieDiagnostic,
  IAutoMovieScreenplayIndex,
  IAutoMovieShotContract,
} from "@automovie/interface";

import { parseScreenplayProse } from "./screenplayProseDiagnostics";

/** Compare two authored durations at the precision a script states them in. */
const SAME_SECOND = 1e-6;

/**
 * A standalone decimal token, so an identifier's digits are never a duration.
 *
 * `SCN-002` and `plaza-2` carry numbers that mean nothing about time, and a
 * scan that took them would refuse prose for saying its own scene number.
 */
const NUMBER = /(?<![\w.-])(\d+(?:\.\d+)?)(?![\w-])/gu;

/** Sentences, cheaply: a script states one timing per sentence, not per line. */
const sentences = (body: string): string[] =>
  body
    .replace(/[*_`]/gu, "")
    .split(/(?<=[.!?])\s+/u)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

/** Every duration in seconds a scene's prose states. */
const statedSeconds = (body: string): number[] => {
  const found: number[] = [];
  for (const sentence of sentences(body)) {
    if (/\bseconds?\b/iu.test(sentence) === false) continue;
    for (const match of sentence.matchAll(NUMBER)) found.push(Number(match[1]));
  }
  return found;
};

/** Every duration in seconds a shot contract actually carries. */
const carriedSeconds = (contract: IAutoMovieShotContract): number[] => [
  contract.durationSeconds,
  ...(contract.events ?? []).flatMap((event) => [
    event.window.from,
    event.window.to,
  ]),
];

/**
 * A duration a scene states in prose must be one its shots actually carry.
 *
 * This closes the last open joint between the screenplay and the motion under
 * it. The ledger checks that a shot cites a scene the index declares, the
 * coverage gate checks that every active scene has a realizing shot, and the
 * engine checks a shot's own predicates against the motion it compiled. None of
 * them reads the scene's prose, so a sentence like "the hand holds for 1.2
 * seconds" sat in the shipped starter next to shots whose cue window closed at
 * 3.0 of a 6.0 second scene, and every gate stayed green.
 *
 * The scan is deliberately narrow. Only a sentence that says "second" is read,
 * only standalone decimal tokens inside it are taken, and a number is satisfied
 * by the shot's `durationSeconds` or by either bound of any event window. So a
 * scene that quotes a figure the contract holds passes, and one that quotes a
 * figure nobody holds is named with what the shot does carry.
 *
 * Severity follows `screenplay-scene-unrealized`: a warning while authoring,
 * because prose legitimately runs ahead of the shot that will realize it, and
 * an error at review and final, because a film presented as deliverable is
 * claiming its script describes it.
 *
 * A scene nothing realizes yet is skipped here; the coverage gate owns that.
 */
export const screenplayTimingDiagnostics = (props: {
  contracts: ReadonlyMap<string, IAutoMovieShotContract>;
  read: (relativePath: string) => string | null;
  scope: "design" | "source" | "review" | "final";
  screenplay: IAutoMovieScreenplayIndex | null;
}): IAutoMovieDiagnostic[] => {
  const screenplay = props.screenplay;
  if (screenplay === null) return [];
  const byScene = new Map<string, IAutoMovieShotContract[]>();
  for (const contract of props.contracts.values())
    for (const evidence of contract.evidence ?? [])
      byScene.set(evidence.scene, [
        ...(byScene.get(evidence.scene) ?? []),
        contract,
      ]);

  const diagnostics: IAutoMovieDiagnostic[] = [];
  for (const scene of screenplay.screenplay.scenes) {
    if (scene.status !== "active" || scene.disposition !== null) continue;
    const realizing = byScene.get(scene.id) ?? [];
    if (realizing.length === 0) continue;
    const documentPath = scene.path ?? screenplay.screenplay.path;
    const content = props.read(documentPath);
    if (content === null) continue;
    const parsed = parseScreenplayProse(content).find(
      (entry) => entry.id === scene.id,
    );
    if (parsed === undefined) continue;
    const carried = realizing.flatMap(carriedSeconds);
    const unrealized = [
      ...new Set(
        statedSeconds(parsed.body).filter(
          (stated) =>
            carried.some((value) => Math.abs(value - stated) <= SAME_SECOND) ===
            false,
        ),
      ),
    ];
    if (unrealized.length === 0) continue;
    diagnostics.push({
      code: "screenplay-scene-timing-unrealized",
      category:
        props.scope === "review" || props.scope === "final"
          ? "error"
          : "warning",
      phase: "compile",
      target: "screenplay",
      path: documentPath,
      message: `Scene "${scene.id}" states ${unrealized.length === 1 ? "a duration" : "durations"} ${unrealized
        .map((value) => `${value}s`)
        .join(", ")} that no shot realizing it carries; those shots carry ${[
        ...new Set(carried),
      ]
        .sort((a, b) => a - b)
        .map((value) => `${value}s`)
        .join(
          ", ",
        )}. A number in scene prose reads as a measurement of the film, so one nothing implements is a promise the shot never made. Quote a duration the contract holds, or change the contract to the duration the scene asks for, then compile again.`,
    });
  }
  return diagnostics;
};
