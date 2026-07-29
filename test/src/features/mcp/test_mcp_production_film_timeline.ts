import { scaffoldAssetDirectory } from "@automovie/cli";
import {
  IAutoMovieFilmEdit,
  IAutoMovieFilmTimeline,
  IAutoMoviePrepareReviewOutput,
  IAutoMovieReviewEvidence,
  IAutoMovieShotContract,
  IAutoMovieSubmitReviewInput,
} from "@automovie/interface";
import {
  AutoMovieProductionCompiler,
  AutoMovieProductionOracleService,
  AutoMovieProductionProject,
  AutoMovieProductionReviewService,
  digestAutoMovieBytes,
  parseAutoMovieFilmTimeline,
  selectAutoMovieFilmReviewFrames,
} from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";

import {
  productionDesign,
  productionFixture,
  testCaptureRuntimeIdentity,
} from "./productionFixtures";

const editSource = (edit: unknown): string =>
  `export const film = { build() { return ${JSON.stringify(edit)}; } };\n`;

const diagnosticCodes = (
  output: ReturnType<AutoMovieProductionCompiler["compile"]>,
): Set<string> => new Set(output.diagnostics.map((item) => item.code));

const throws = (closure: () => unknown): boolean => {
  try {
    closure();
    return false;
  } catch {
    return true;
  }
};

const captureBytes = (): Uint8Array => {
  const png = new PNG({ width: 16, height: 16 });
  png.data.fill(200);
  png.data[0] = 0;
  return PNG.sync.write(png);
};

const filmWorksheet = (
  project: AutoMovieProductionProject,
  prepared: IAutoMoviePrepareReviewOutput,
): IAutoMovieSubmitReviewInput => {
  const scenarios = [...project.graph().acceptance.values()]
    .filter((scenario) => {
      if (scenario.required === false) return false;
      if (prepared.outcomes.some((outcome) => outcome.scenario === scenario.id))
        return true;
      const criterion = scenario.criterion;
      if (criterion.kind !== "frame") return false;
      const shot =
        criterion.shot ??
        (scenario.target.kind === "shot" ? scenario.target.id : undefined);
      return prepared.frames.some(
        (frame) =>
          frame.shot === shot &&
          frame.reviewFrame === criterion.frame &&
          frame.pass === criterion.pass,
      );
    })
    .sort((left, right) => left.id.localeCompare(right.id));
  const frame = prepared.frames[0]!;
  const frameEvidence = {
    kind: "frame" as const,
    shot: frame.shot,
    reviewFrame: frame.reviewFrame,
    bundle: frame.bundle,
    frame: frame.frame,
    time: frame.time,
    pass: frame.pass,
    digest: frame.digest,
  };
  return {
    target: prepared.target,
    preparedFingerprint: prepared.fingerprint,
    observations:
      "The exact canonical film cut and its current frame were inspected.",
    checks: prepared.requiredCriteria.map((criterion, index) => ({
      criterion,
      verdict: "pass",
      observation: `${criterion} is established by current film evidence ${index}.`,
      evidence:
        criterion === "acceptance-scenarios"
          ? scenarios.flatMap((scenario): IAutoMovieReviewEvidence[] => {
              const contractEvidence: IAutoMovieReviewEvidence = {
                kind: "acceptance",
                scenario: scenario.id,
                exactValue: scenario,
              };
              const scenarioCriterion = scenario.criterion;
              if (scenarioCriterion.kind === "frame") {
                const shot =
                  scenarioCriterion.shot ??
                  (scenario.target.kind === "shot"
                    ? scenario.target.id
                    : undefined);
                const evidence = prepared.frames.find(
                  (candidate) =>
                    candidate.shot === shot &&
                    candidate.reviewFrame === scenarioCriterion.frame &&
                    candidate.pass === scenarioCriterion.pass,
                )!;
                return [
                  contractEvidence,
                  {
                    kind: "frame" as const,
                    shot: evidence.shot,
                    reviewFrame: evidence.reviewFrame,
                    bundle: evidence.bundle,
                    frame: evidence.frame,
                    time: evidence.time,
                    pass: evidence.pass,
                    digest: evidence.digest,
                  },
                ];
              }
              const outcome = prepared.outcomes.find(
                (candidate) => candidate.scenario === scenario.id,
              )!;
              return [
                contractEvidence,
                {
                  kind: "outcome" as const,
                  scenario: scenario.id,
                  exactValue: outcome,
                },
              ];
            })
          : [frameEvidence],
      ...(criterion === "acceptance-scenarios"
        ? { acceptanceScenarios: scenarios.map((scenario) => scenario.id) }
        : {}),
    })),
    corrections: [],
    completionBasis: prepared.requiredCriteria.join(", "),
    complete: true,
  };
};

const baseEdit = (): IAutoMovieFilmEdit => ({
  id: "fixture-film",
  omissions: [],
  tracks: {
    video: [
      {
        shot: "opening",
        sourceIn: { frame: 0 },
        sourceOut: { seconds: 6 },
        start: { frame: 0 },
        handles: { head: { frame: 0 }, tail: { frame: 0 } },
        transitionIn: { kind: "cut" },
        transitionOut: { kind: "cut" },
      },
    ],
    audio: [],
    captions: [],
    effects: [],
  },
});

const twoShotEdit = (): IAutoMovieFilmEdit => {
  const edit = baseEdit();
  edit.tracks.video[0]!.handles.tail = { seconds: 0.5 };
  edit.tracks.video[0]!.transitionOut = {
    kind: "dissolve",
    duration: { seconds: 0.5 },
  };
  edit.tracks.video.push({
    shot: "answer",
    sourceIn: { frame: 0 },
    sourceOut: { seconds: 6 },
    start: { seconds: 5.5 },
    handles: { head: { seconds: 0.5 }, tail: { seconds: 0.5 } },
    transitionIn: { kind: "dissolve", duration: { seconds: 0.5 } },
    transitionOut: { kind: "fade", duration: { seconds: 0.5 } },
  });
  edit.tracks.audio.push({
    id: "silent-guide",
    asset: "public/audio/starter-tone.json",
    sourceDuration: { seconds: 11.5 },
    sourceOffset: { frame: 0 },
    start: { frame: 0 },
    duration: { seconds: 11.5 },
    gain: 0,
    fadeIn: { frame: 0 },
    fadeOut: { frame: 0 },
    bus: "ambience",
  });
  edit.tracks.captions.push({
    id: "signal-caption",
    text: "Signal.",
    language: "en",
    start: { seconds: 1 },
    end: { seconds: 2 },
  });
  return edit;
};

/** Film source compiles into one frame-exact artifact shared downstream. */
export const test_mcp_production_film_timeline = async (): Promise<void> => {
  const fixture = productionFixture();
  try {
    const project = AutoMovieProductionProject.open(fixture.root);
    const compiler = new AutoMovieProductionCompiler(project);
    const filmPath = path.join(fixture.root, "src/film.ts");
    const originalSource = fs.readFileSync(filmPath);
    const first = compiler.compile({ scope: "source" });
    const timelinePath = path.join(
      fixture.root,
      "generated/film-timeline.json",
    );
    const editPath = path.join(
      fixture.root,
      "generated/contracts/film-edit.json",
    );
    const firstTimelineBytes = fs.readFileSync(timelinePath);
    const firstTimelineMtime = fs.statSync(timelinePath).mtimeMs;
    const timeline = JSON.parse(
      firstTimelineBytes.toString("utf8"),
    ) as IAutoMovieFilmTimeline;
    const compiledEdit = JSON.parse(fs.readFileSync(editPath, "utf8"));
    const reopened = new AutoMovieProductionCompiler(
      AutoMovieProductionProject.open(fixture.root),
    ).compile({ scope: "source" });
    TestValidator.predicate(
      "valid film materializes deterministic edit and timeline bytes",
      first.success &&
        timeline.id === "fixture-film" &&
        timeline.totalFrames === 144 &&
        timeline.segments.length === 1 &&
        timeline.segments[0]?.shot === "opening" &&
        timeline.segments[0]?.sourceInFrame === 0 &&
        timeline.segments[0]?.endFrame === 144 &&
        compiledEdit.source.path === "src/film.ts" &&
        compiledEdit.source.export === "film" &&
        compiledEdit.inputFingerprint === first.compiler.inputFingerprint &&
        timeline.inputFingerprint === first.compiler.inputFingerprint &&
        reopened.success &&
        reopened.compiler.inputFingerprint ===
          first.compiler.inputFingerprint &&
        reopened.materialized.every((file) => file.status === "unchanged") &&
        fs.readFileSync(timelinePath).equals(firstTimelineBytes) &&
        fs.statSync(timelinePath).mtimeMs === firstTimelineMtime &&
        fs.readFileSync(filmPath).equals(originalSource),
    );

    const compileEdit = (
      mutate: (edit: IAutoMovieFilmEdit) => void,
    ): ReturnType<AutoMovieProductionCompiler["compile"]> => {
      const edit = baseEdit();
      mutate(edit);
      fs.writeFileSync(filmPath, editSource(edit));
      return compiler.compile({ scope: "source" });
    };
    const cases: Array<{
      name: string;
      code: string;
      mutate(edit: IAutoMovieFilmEdit): void;
    }> = [
      {
        name: "film id",
        code: "film-id-mismatch",
        mutate: (edit) => {
          edit.id = "wrong-film";
        },
      },
      {
        name: "off-grid time",
        code: "film-time-off-grid",
        mutate: (edit) => {
          edit.tracks.video[0]!.start = { seconds: 0.1 };
        },
      },
      {
        name: "unknown shot",
        code: "film-shot-unknown",
        mutate: (edit) => {
          edit.tracks.video[0]!.shot = "missing";
        },
      },
      {
        name: "duplicate shot",
        code: "film-shot-accounting-invalid",
        mutate: (edit) => {
          edit.tracks.video.push(structuredClone(edit.tracks.video[0]!));
        },
      },
      {
        name: "shot both used and omitted",
        code: "film-shot-accounting-invalid",
        mutate: (edit) => {
          edit.omissions.push({ shot: "opening", reason: "duplicate claim" });
        },
      },
      {
        name: "unaccounted shot",
        code: "film-shot-unaccounted",
        mutate: (edit) => {
          edit.tracks.video = [];
        },
      },
      {
        name: "source range",
        code: "film-source-range-invalid",
        mutate: (edit) => {
          edit.tracks.video[0]!.sourceOut = { seconds: 7 };
        },
      },
      {
        name: "runtime",
        code: "film-runtime-mismatch",
        mutate: (edit) => {
          edit.tracks.video[0]!.sourceOut = { seconds: 5 };
        },
      },
      {
        name: "terminal dissolve",
        code: "film-transition-invalid",
        mutate: (edit) => {
          edit.tracks.video[0]!.transitionOut = {
            kind: "dissolve",
            duration: { seconds: 0.5 },
          };
        },
      },
      {
        name: "zero transition",
        code: "film-transition-invalid",
        mutate: (edit) => {
          edit.tracks.video[0]!.transitionIn = {
            kind: "fade",
            duration: { frame: 0 },
          };
        },
      },
      {
        name: "transition handle",
        code: "film-transition-handle-missing",
        mutate: (edit) => {
          edit.tracks.video[0]!.transitionIn = {
            kind: "fade",
            duration: { seconds: 7 },
          };
        },
      },
      {
        name: "audio ownership",
        code: "film-audio-cue-invalid",
        mutate: (edit) => {
          edit.tracks.audio.push({
            id: "bad-audio",
            asset: "outside.wav",
            sourceDuration: { seconds: 1 },
            sourceOffset: { seconds: 0.75 },
            start: { seconds: 5.5 },
            duration: { seconds: 1 },
            gain: 5,
            fadeIn: { seconds: 0.75 },
            fadeOut: { seconds: 0.75 },
            bus: "music",
          });
        },
      },
      {
        name: "caption range",
        code: "film-caption-cue-invalid",
        mutate: (edit) => {
          edit.tracks.captions.push({
            id: "bad-caption",
            text: " ",
            language: "not_a_language",
            speaker: " ",
            start: { seconds: 5 },
            end: { seconds: 4 },
          });
        },
      },
      {
        name: "effect support",
        code: "film-effect-cue-invalid",
        mutate: (edit) => {
          edit.tracks.effects.push({
            id: "bad-effect",
            recipe: "world-zone",
            zone: "missing",
            start: { frame: 0 },
            duration: { seconds: 7 },
            intensity: 2,
          });
        },
      },
    ];
    for (const testCase of cases) {
      const output = compileEdit(testCase.mutate);
      TestValidator.predicate(
        `${testCase.name} is refused without publishing a partial film`,
        output.success === false &&
          diagnosticCodes(output).has(testCase.code) &&
          fs.readFileSync(timelinePath).equals(firstTimelineBytes),
      );
    }

    fs.writeFileSync(filmPath, "export const wrong = {};\n");
    TestValidator.predicate(
      "missing named film export is diagnosed",
      diagnosticCodes(compiler.compile({ scope: "source" })).has(
        "source-export-missing",
      ),
    );
    fs.writeFileSync(
      filmPath,
      "export const film = { async build() { return {}; } };\n",
    );
    TestValidator.predicate(
      "async film source is forbidden",
      diagnosticCodes(compiler.compile({ scope: "source" })).has(
        "source-capability-forbidden",
      ),
    );
    fs.writeFileSync(
      filmPath,
      "export const film = { build() { return { id: 'fixture-film' }; } };\n",
    );
    TestValidator.predicate(
      "film output schema is exact",
      diagnosticCodes(compiler.compile({ scope: "source" })).has(
        "source-export-invalid",
      ),
    );
    fs.rmSync(filmPath);
    TestValidator.predicate(
      "missing film source is a source-owned refusal",
      diagnosticCodes(compiler.compile({ scope: "source" })).has(
        "source-path-missing",
      ),
    );
    fs.writeFileSync(filmPath, originalSource);

    const answer = JSON.parse(
      fs.readFileSync(
        path.join(
          scaffoldAssetDirectory(),
          ".automovie/design/shots/answer.json",
        ),
        "utf8",
      ),
    ) as IAutoMovieShotContract;
    project.setProductionDesign(
      productionDesign({ targetRuntimeSeconds: 11.5 }),
    );
    project.setShotContract(answer);
    project.setAcceptanceScenario({
      id: "film-runtime",
      target: { kind: "film", id: "fixture-film" },
      criterion: {
        kind: "metric",
        metric: "runtime-seconds",
        operator: "==",
        value: 11.5,
      },
      required: true,
    });
    project.setAcceptanceScenario({
      id: "film-opening-event",
      target: { kind: "film", id: "fixture-film" },
      criterion: {
        kind: "event",
        shot: "opening",
        event: "signal-raised",
        expectation:
          "The actual compiled signal sample remains inside the finished edit.",
      },
      required: true,
    });
    fs.writeFileSync(filmPath, editSource(twoShotEdit()));
    const twoShot = compiler.compile({ scope: "source" });
    const twoShotTimeline = JSON.parse(
      fs.readFileSync(timelinePath, "utf8"),
    ) as IAutoMovieFilmTimeline;
    const overlapFrame = new AutoMovieProductionOracleService(project).query({
      request: { query: "film-time", at: { frame: 132 } },
    });
    TestValidator.predicate(
      "cut, dissolve and fade law materializes an overlap without changing total frames",
      twoShot.success &&
        twoShotTimeline.totalFrames === 276 &&
        twoShotTimeline.segments[0]?.transitionIn.kind === "cut" &&
        twoShotTimeline.segments[0]?.transitionOut.kind === "dissolve" &&
        twoShotTimeline.segments[1]?.transitionIn.kind === "dissolve" &&
        twoShotTimeline.segments[1]?.transitionOut.kind === "fade" &&
        twoShotTimeline.segments[1]?.startFrame === 132 &&
        twoShotTimeline.tracks.audio.length === 1 &&
        twoShotTimeline.tracks.captions.length === 1 &&
        overlapFrame.result?.kind === "measurement" &&
        overlapFrame.result.values.shot === "answer",
    );
    const filmReview = new AutoMovieProductionReviewService(project).prepare({
      target: { kind: "film", id: "fixture-film" },
    });
    TestValidator.predicate(
      "film review consumes canonical overlap runtime and exposes film source evidence",
      filmReview.outcomes.some(
        (outcome) =>
          outcome.kind === "metric" &&
          outcome.scenario === "film-runtime" &&
          outcome.actual === 11.5 &&
          outcome.passed,
      ) &&
        filmReview.quotable.some(
          (selector) =>
            selector.kind === "source" && selector.path === "src/film.ts",
        ),
    );
    const invalidTwoShotCases: Array<{
      code: string;
      mutate(edit: IAutoMovieFilmEdit): void;
    }> = [
      {
        code: "film-transition-mismatch",
        mutate: (edit) => {
          edit.tracks.video[1]!.transitionIn = { kind: "cut" };
        },
      },
      {
        code: "film-global-order-invalid",
        mutate: (edit) => {
          edit.tracks.video[1]!.start = { seconds: 5 };
        },
      },
      {
        code: "film-transition-handle-missing",
        mutate: (edit) => {
          edit.tracks.video[1]!.handles.head = { frame: 0 };
        },
      },
      {
        code: "film-state-handoff-unverifiable",
        mutate: (edit) => {
          edit.tracks.video[1]!.sourceIn = { frame: 1 };
        },
      },
    ];
    for (const testCase of invalidTwoShotCases) {
      const edit = twoShotEdit();
      testCase.mutate(edit);
      fs.writeFileSync(filmPath, editSource(edit));
      TestValidator.predicate(
        `${testCase.code} blocks two-shot publication`,
        diagnosticCodes(compiler.compile({ scope: "source" })).has(
          testCase.code,
        ),
      );
    }
    const mismatched = structuredClone(answer);
    mismatched.opening[0]!.predicates[0]!.value = 90;
    project.setShotContract(mismatched);
    fs.writeFileSync(filmPath, editSource(twoShotEdit()));
    TestValidator.predicate(
      "adjacent compiled opening and closing state predicates must match",
      diagnosticCodes(compiler.compile({ scope: "source" })).has(
        "film-state-handoff-mismatch",
      ),
    );
    project.setShotContract(answer);
    project.setProductionDesign(productionDesign({ targetRuntimeSeconds: 6 }));
    const omitted = baseEdit();
    omitted.omissions.push({
      shot: "answer",
      reason: "The alternate answer is intentionally excluded.",
    });
    fs.writeFileSync(filmPath, editSource(omitted));
    const legalOmission = compiler.compile({ scope: "source" });
    const omissionReview = new AutoMovieProductionReviewService(
      project,
    ).prepare({
      target: { kind: "film", id: "fixture-film" },
    });
    const currentManifest = project.generatedManifest()!;
    const currentTimelineBytes =
      project.readGeneratedFile("film-timeline.json");
    const validTimeline = parseAutoMovieFilmTimeline({
      manifest: currentManifest,
      fingerprint: legalOmission.compiler.inputFingerprint,
      read: () => currentTimelineBytes,
    });
    const invalidTimelineBytes = Buffer.from("{}");
    const invalidTimelineManifest = structuredClone(currentManifest);
    invalidTimelineManifest.files.find(
      (file) => file.path === "film-timeline.json",
    )!.digest = digestAutoMovieBytes(invalidTimelineBytes);
    const staleTimeline = structuredClone(validTimeline);
    staleTimeline.inputFingerprint =
      `sha256:${"0".repeat(64)}` as typeof staleTimeline.inputFingerprint;
    const staleTimelineBytes = Buffer.from(JSON.stringify(staleTimeline));
    const staleTimelineManifest = structuredClone(currentManifest);
    staleTimelineManifest.files.find(
      (file) => file.path === "film-timeline.json",
    )!.digest = digestAutoMovieBytes(staleTimelineBytes);
    TestValidator.predicate(
      "an explicit current-shot omission controls review evidence and shared timeline validation",
      legalOmission.success &&
        validTimeline.omissions[0]?.shot === "answer" &&
        omissionReview.diagnostics.every(
          (diagnostic) =>
            diagnostic.code !== "review-evidence-missing" ||
            diagnostic.target.startsWith("answer:") === false,
        ) &&
        throws(() =>
          parseAutoMovieFilmTimeline({
            manifest: null,
            fingerprint: legalOmission.compiler.inputFingerprint,
            read: () => currentTimelineBytes,
          }),
        ) &&
        throws(() =>
          parseAutoMovieFilmTimeline({
            manifest: currentManifest,
            fingerprint: legalOmission.compiler.inputFingerprint,
            read: () => invalidTimelineBytes,
          }),
        ) &&
        throws(() =>
          parseAutoMovieFilmTimeline({
            manifest: invalidTimelineManifest,
            fingerprint: legalOmission.compiler.inputFingerprint,
            read: () => invalidTimelineBytes,
          }),
        ) &&
        throws(() =>
          parseAutoMovieFilmTimeline({
            manifest: staleTimelineManifest,
            fingerprint: legalOmission.compiler.inputFingerprint,
            read: () => staleTimelineBytes,
          }),
        ),
    );
    const openingWithBoundaryEvents = structuredClone(
      project.graph().shots.get("opening")!,
    );
    const signalEvent = openingWithBoundaryEvents.events[0]!;
    openingWithBoundaryEvents.events.push(
      {
        ...structuredClone(signalEvent),
        id: "source-in-boundary",
        window: { from: 2, to: 4 },
      },
      {
        ...structuredClone(signalEvent),
        id: "source-out-boundary",
        window: { from: 4, to: 6 },
      },
    );
    project.setShotContract(openingWithBoundaryEvents);
    project.setProductionDesign(productionDesign({ targetRuntimeSeconds: 2 }));
    project.setAcceptanceScenario({
      id: "film-runtime",
      target: { kind: "film", id: "fixture-film" },
      criterion: {
        kind: "metric",
        metric: "runtime-seconds",
        operator: "==",
        value: 2,
      },
      required: true,
    });
    project.setAcceptanceScenario({
      id: "film-source-in-event",
      target: { kind: "film", id: "fixture-film" },
      criterion: {
        kind: "event",
        shot: "opening",
        event: "source-in-boundary",
        expectation: "An event exactly on sourceIn belongs to the film.",
      },
      required: true,
    });
    project.setAcceptanceScenario({
      id: "film-source-out-event",
      target: { kind: "film", id: "fixture-film" },
      criterion: {
        kind: "event",
        shot: "opening",
        event: "source-out-boundary",
        expectation: "An event exactly on sourceOut is outside the film.",
      },
      required: true,
    });
    const trimmed = baseEdit();
    trimmed.tracks.video[0]!.sourceIn = { seconds: 3 };
    trimmed.tracks.video[0]!.sourceOut = { seconds: 5 };
    trimmed.omissions.push({
      shot: "answer",
      reason: "The alternate answer remains excluded from the shorter cut.",
    });
    fs.writeFileSync(filmPath, editSource(trimmed));
    const legalTrim = compiler.compile({ scope: "source" });
    const trimTimeline = JSON.parse(
      fs.readFileSync(timelinePath, "utf8"),
    ) as IAutoMovieFilmTimeline;
    const trimSelection = selectAutoMovieFilmReviewFrames(
      trimTimeline.segments[0]!,
      project.graph().shots.get("opening")!,
      trimTimeline.fps,
    );
    const trimReview = new AutoMovieProductionReviewService(project).prepare({
      target: { kind: "film", id: "fixture-film" },
    });
    const captureOracle = new AutoMovieProductionOracleService(
      project,
      async () => ({
        bytes: captureBytes(),
        runtimeIdentity: testCaptureRuntimeIdentity(),
        width: 16,
        height: 16,
      }),
    );
    const capturedTrimEntry = await captureOracle.preview({
      target: { kind: "shot", id: "opening" },
      time: 3,
      pass: "beauty",
      width: 16,
      height: 16,
    });
    const completeTrimReview = new AutoMovieProductionReviewService(
      project,
    ).prepare({
      target: { kind: "film", id: "fixture-film" },
    });
    const trimWorksheet = filmWorksheet(project, completeTrimReview);
    const trimSubmission = new AutoMovieProductionReviewService(project).submit(
      trimWorksheet,
    );
    const submittedAcceptance = trimWorksheet.checks.find(
      (check) => check.criterion === "acceptance-scenarios",
    )?.acceptanceScenarios;
    TestValidator.predicate(
      "a legal trim uses one in-range fallback and submits exact half-open event coverage",
      legalTrim.success &&
        trimSelection.length === 1 &&
        trimSelection[0]?.id === "film-segment-entry" &&
        trimSelection[0]?.index === 72 &&
        trimSelection[0]?.time === 3 &&
        trimSelection[0]?.passes[0] === "beauty" &&
        trimReview.diagnostics.some(
          (diagnostic) =>
            diagnostic.code === "review-evidence-missing" &&
            diagnostic.target === "opening:film-segment-entry:beauty",
        ) &&
        trimReview.diagnostics.every(
          (diagnostic) =>
            (diagnostic.code !== "review-evidence-missing" ||
              diagnostic.target.includes("signal-apex") === false) &&
            (diagnostic.code !== "review-outcome-missing" ||
              diagnostic.message.includes("film-opening-event") === false),
        ) &&
        capturedTrimEntry.captured &&
        completeTrimReview.outcomes.some(
          (outcome) => outcome.scenario === "film-source-in-event",
        ) &&
        completeTrimReview.outcomes.every(
          (outcome) =>
            outcome.scenario !== "film-opening-event" &&
            outcome.scenario !== "film-source-out-event",
        ) &&
        submittedAcceptance?.join(",") ===
          "film-runtime,film-source-in-event" &&
        trimSubmission.accepted &&
        trimSubmission.state === "complete",
    );
    const realizationPath = path.join(
      fixture.root,
      "generated/realizations/opening.json",
    );
    const realizationBytes = fs.readFileSync(realizationPath);
    const realization = JSON.parse(realizationBytes.toString("utf8")) as {
      events: Array<{ id: string }>;
    };
    const corruptions: Array<{ name: string; bytes: Uint8Array }> = [
      {
        name: "valid realization missing the event",
        bytes: Buffer.from(
          JSON.stringify({
            ...realization,
            events: realization.events.filter(
              (event) => event.id !== "source-in-boundary",
            ),
          }),
        ),
      },
      { name: "schema-invalid realization", bytes: Buffer.from("{}") },
      { name: "malformed realization", bytes: Buffer.from("{") },
    ];
    for (const corruption of corruptions) {
      fs.writeFileSync(realizationPath, corruption.bytes);
      const corruptReviewService = new AutoMovieProductionReviewService(
        project,
      );
      const refused = corruptReviewService.prepare({
        target: { kind: "film", id: "fixture-film" },
      });
      const corruptWorksheet: IAutoMovieSubmitReviewInput = {
        ...trimWorksheet,
        preparedFingerprint: refused.fingerprint,
        checks: trimWorksheet.checks.map((check) =>
          check.criterion !== "acceptance-scenarios"
            ? check
            : {
                ...check,
                acceptanceScenarios: check.acceptanceScenarios?.filter(
                  (scenario) => scenario !== "film-source-in-event",
                ),
                evidence: check.evidence.filter(
                  (evidence) =>
                    !(
                      (evidence.kind === "acceptance" ||
                        evidence.kind === "outcome") &&
                      evidence.scenario === "film-source-in-event"
                    ),
                ),
              },
        ),
      };
      const corruptSubmission = corruptReviewService.submit(corruptWorksheet);
      TestValidator.equals(
        `${corruption.name} retains required event coverage and refuses review`,
        {
          reportsMissingOutcome: refused.diagnostics.some(
            (diagnostic) =>
              diagnostic.code === "review-outcome-missing" &&
              diagnostic.message.includes("film-source-in-event"),
          ),
          accepted: corruptSubmission.accepted,
          reportsIncompleteCoverage: corruptSubmission.diagnostics.some(
            (diagnostic) =>
              diagnostic.code === "review-acceptance-coverage-incomplete" &&
              diagnostic.message.includes("film-source-in-event"),
          ),
        },
        {
          reportsMissingOutcome: true,
          accepted: false,
          reportsIncompleteCoverage: true,
        },
      );
    }
    fs.writeFileSync(realizationPath, realizationBytes);
  } finally {
    fixture.dispose();
  }
};
