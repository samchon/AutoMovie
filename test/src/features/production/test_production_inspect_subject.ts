import {
  describeAutoMovieSubjects,
  foldAutoMovieSubjectReviewCoverage,
  resolveAutoMovieSubjectReviewUnit,
} from "@automovie/engine";
import type { IAutoMovieCompiledShotSource } from "@automovie/interface";
import {
  AUTOMOVIE_SUBJECT_INSPECTION_PLAN_FILE,
  AUTOMOVIE_SUBJECT_INSPECTION_ROOT,
  AutoMovieProductionCompiler,
  AutoMovieProductionProject,
  type AutoMovieProductionSubjectInspection,
  AutoMovieProductionSubjectInspectionService,
  type IAutoMovieSubjectInspectionPlanRecord,
  autoMovieSubjectInspectionPlanIdentity,
  openAutoMovieProduction,
  readAutoMovieSubjectInspection,
} from "@automovie/production";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";

import {
  productionCompileSucceeded,
  productionFixture,
  testCaptureRuntimeIdentity,
} from "./productionFixtures";

const SUBJECT = "prototype:automovie:model:soloist";

/** One raster with visible variance, sized exactly as the request asked. */
export const inspectionPng = (width: number, height: number): Uint8Array => {
  const image = new PNG({ width, height });
  for (let offset = 0; offset < image.data.length; offset += 4) {
    image.data[offset] = offset % 251;
    image.data[offset + 1] = (offset * 7) % 241;
    image.data[offset + 2] = (offset * 13) % 239;
    image.data[offset + 3] = 255;
  }
  return PNG.sync.write(image);
};

/** Record every pose the instrument was asked for and answer each one. */
export const recordingInstrument = (): {
  adapter: AutoMovieProductionSubjectInspection;
  calls: Array<Parameters<AutoMovieProductionSubjectInspection>[0]>;
} => {
  const calls: Array<Parameters<AutoMovieProductionSubjectInspection>[0]> = [];
  return {
    calls,
    adapter: (input) => {
      calls.push(input);
      return Promise.resolve({
        bytes: inspectionPng(input.width, input.height),
        width: input.width,
        height: input.height,
        runtimeIdentity: testCaptureRuntimeIdentity(),
        assertRuntimeCurrent: () => undefined,
      });
    },
  };
};

/**
 * An authoring agent that cannot see a screen opens one compiled subject by
 * name, states a viewpoint rule, and receives one image per planned viewpoint.
 *
 * Scenarios:
 *
 * 1. Naming `prototype:automovie:model:soloist` with the default turntable
 *    produces the deterministic plan, one verified PNG per viewpoint, and
 *    `reviewed` coverage over the declared population.
 * 2. Every artifact lands outside the delivery render root, exists on disk with
 *    the digest the observation quotes, and every observation carries the
 *    `subject-view` discriminator a frame receipt cannot supply.
 * 3. A second request naming the same subject and rule resolves the same
 *    viewpoint identities and the same camera state, which is what lets two
 *    agents settle a disagreement by opening the object instead of trading
 *    screenshots.
 * 4. A narrower rule at a smaller raster is honoured exactly, and its plan is
 *    the population coverage is measured against rather than the default one.
 */
export const test_production_inspect_subject = async (): Promise<void> => {
  const fixture = productionFixture();
  try {
    const project = AutoMovieProductionProject.open(fixture.root);
    const compiled = new AutoMovieProductionCompiler(project).compile({
      scope: "source",
    });
    if (
      productionCompileSucceeded("subject inspection fixture", compiled) ===
      false
    )
      throw new Error("The subject-inspection fixture did not compile.");
    const services = openAutoMovieProduction({
      projectRoot: fixture.root,
      productionId: "fixture-film",
    });

    const instrument = recordingInstrument();
    const inspection = new AutoMovieProductionSubjectInspectionService(
      instrument.adapter,
    );
    const swept = await inspection.inspect(services, {
      shot: "opening",
      subject: SUBJECT,
    });
    TestValidator.equals(
      "one named subject answers a viewpoint rule with a complete sweep",
      {
        inspected: swept.inspected,
        productionId: swept.productionId,
        target: swept.target,
        subject: swept.subject?.id,
        deliveryEvidence: swept.deliveryEvidence,
        diagnostics: swept.diagnostics,
        plan: swept.plan.map((viewpoint) => viewpoint.id),
        projections: [
          ...new Set(swept.plan.map((viewpoint) => viewpoint.projection)),
        ],
        coverage: swept.coverage,
        drawn: instrument.calls.length,
      },
      {
        inspected: true,
        productionId: "fixture-film",
        target: { shot: "opening", subject: SUBJECT },
        subject: SUBJECT,
        deliveryEvidence: false,
        diagnostics: [],
        plan: [
          "az000-el020",
          "az060-el020",
          "az120-el020",
          "az180-el020",
          "az240-el020",
          "az300-el020",
        ],
        projections: ["perspective"],
        coverage: {
          state: "reviewed",
          planned: [
            "az000-el020",
            "az060-el020",
            "az120-el020",
            "az180-el020",
            "az240-el020",
            "az300-el020",
          ],
          observed: [
            "az000-el020",
            "az060-el020",
            "az120-el020",
            "az180-el020",
            "az240-el020",
            "az300-el020",
          ],
          missing: [],
          stale: [],
          unplanned: [],
          foreign: 0,
          duplicates: 0,
        },
        drawn: 6,
      },
    );

    TestValidator.equals(
      "every artifact is a real file outside the delivery render root",
      swept.views.map((view) => ({
        separated:
          view.path.startsWith(`${AUTOMOVIE_SUBJECT_INSPECTION_ROOT}/`) &&
          view.path.includes("/renders/") === false,
        present: fs.existsSync(
          path.join(fixture.root, ...view.path.split("/")),
        ),
        quotesItsOwnBytes: view.digest === view.observation.digest,
        kind: view.observation.kind,
        subject: view.observation.subject,
        revision: view.observation.revision === swept.revision,
        viewpoint: view.observation.viewpoint === view.viewpoint,
        artifact: view.observation.artifact === view.path,
        raster: `${view.width}x${view.height}`,
      })),
      swept.plan.map(() => ({
        separated: true,
        present: true,
        quotesItsOwnBytes: true,
        kind: "subject-view" as const,
        subject: SUBJECT,
        revision: true,
        viewpoint: true,
        artifact: true,
        raster: "16x16",
      })),
    );

    const second = new AutoMovieProductionSubjectInspectionService(
      recordingInstrument().adapter,
    );
    const reopened = await second.inspect(services, {
      shot: "opening",
      subject: SUBJECT,
    });
    TestValidator.equals(
      "the same subject and rule open the same thing for a second party",
      {
        plan: reopened.plan,
        poses: reopened.views.map((view) => view.pose),
        revision: reopened.revision,
      },
      {
        plan: swept.plan,
        poses: swept.views.map((view) => view.pose),
        revision: swept.revision,
      },
    );

    const narrow = await inspection.inspect(services, {
      shot: "opening",
      subject: SUBJECT,
      azimuthCount: 2,
      elevationsDeg: [0, 30],
      distanceFactor: 2,
      width: 8,
      height: 4,
    });
    const wider =
      narrow.views[0] !== undefined &&
      swept.views[0] !== undefined &&
      narrow.views[0].pose.aspect === 2 &&
      narrow.plan[0]!.distance > swept.plan[0]!.distance;
    TestValidator.equals(
      "a stated rule replaces the default plan and the raster it is drawn at",
      {
        inspected: narrow.inspected,
        plan: narrow.plan.map((viewpoint) => viewpoint.id),
        state: narrow.coverage?.state,
        raster: [
          ...new Set(
            narrow.views.map((view) => `${view.width}x${view.height}`),
          ),
        ],
        wider,
      },
      {
        inspected: true,
        plan: ["az000-el000", "az180-el000", "az000-el030", "az180-el030"],
        state: "reviewed",
        raster: ["8x4"],
        wider: true,
      },
    );

    const box =
      swept.subject !== null && swept.subject.kind !== "formation"
        ? (swept.subject.bounds.content ?? swept.subject.bounds.declared)
        : null;
    if (box === null)
      throw new Error("The inspected subject reported no measurable extent.");
    const floor = Math.min(0, box.min.y);
    const dug = await inspection.inspect(services, {
      shot: "opening",
      subject: SUBJECT,
      azimuthCount: 2,
      elevationsDeg: [-45],
    });
    TestValidator.equals(
      "a downward angle that would bury the eye is raised to the subject's floor",
      {
        inspected: dug.inspected,
        askedFor: dug.plan.map((viewpoint) => viewpoint.id),
        underground: dug.views.filter((view) => view.pose.position.y < floor)
          .length,
        aimedAtTheSubject: dug.views.every(
          (view) => view.pose.target.y === (box.min.y + box.max.y) / 2,
        ),
      },
      {
        inspected: true,
        askedFor: dug.plan.map((viewpoint) => viewpoint.id),
        underground: 0,
        aimedAtTheSubject: true,
      },
    );
    TestValidator.equals(
      "the buried angle is not the angle that was asked for",
      dug.plan.some((viewpoint) => viewpoint.id === "az000-eln045"),
      false,
    );

    const described = describeAutoMovieSubjects({
      revision: "probe",
      compiled: JSON.parse(
        Buffer.from(
          services.project.readGeneratedFile("shots/opening.json"),
        ).toString("utf8"),
      ) as IAutoMovieCompiledShotSource,
    });
    const placedPart = described
      .filter((subject) => subject.kind === "element")
      .flatMap((subject) => subject.members.items)
      .find((id) => id.startsWith("element-part:"));
    if (placedPart === undefined)
      throw new Error(
        "The fixture compiles no placed part, so the viewer-key spelling cannot be exercised.",
      );
    const viewerKey = `part:${placedPart.slice("element-part:".length)}@${swept.revision}`;
    const pasted = await inspection.inspect(services, {
      shot: "opening",
      subject: viewerKey,
      azimuthCount: 1,
      elevationsDeg: [0],
    });
    TestValidator.equals(
      "a name copied out of the viewer page opens the compiled subject it means",
      {
        inspected: pasted.inspected,
        resolved: pasted.subject?.id,
        observed: pasted.views.map((view) => view.observation.subject),
        echoedTarget: pasted.target.subject,
      },
      {
        inspected: true,
        resolved: placedPart,
        observed: [placedPart],
        echoedTarget: placedPart,
      },
    );

    // The review surface counts coverage from what was published, not from a
    // plan it recomputes: one subject is legitimately planned differently by
    // the page and by this tool, so the denominator has to come from whoever
    // actually took the look.
    const compiledShot = JSON.parse(
      Buffer.from(
        services.project.readGeneratedFile("shots/opening.json"),
      ).toString("utf8"),
    ) as IAutoMovieCompiledShotSource;
    const revision = swept.revision;
    if (revision === null)
      throw new Error("The sweep reported no compiled revision.");
    const unit = resolveAutoMovieSubjectReviewUnit(
      { revision, compiled: compiledShot },
      { shot: "opening", subject: SUBJECT },
    );
    const readBack = () =>
      readAutoMovieSubjectInspection({
        projectRoot: fixture.root,
        productionId: "fixture-film",
        shot: "opening",
        subject: SUBJECT,
        plan: dug.planRecord!,
        runtimeIdentity: dug.runtimeIdentity,
      });
    const published = readBack();
    TestValidator.equals(
      "the published plan and its observations reopen as the sweep that took them",
      {
        planned: published.planned.map((viewpoint) => viewpoint.id),
        observed: published.observations.map(
          (observation) => observation.viewpoint,
        ),
        revisions: [
          ...new Set(
            published.observations.map((observation) => observation.revision),
          ),
        ],
        state: foldAutoMovieSubjectReviewCoverage(
          unit,
          {
            productionId: "fixture-film",
            target: { shot: "opening", subject: SUBJECT },
            revision,
            compileFingerprint:
              services.project.generatedManifest()!.inputFingerprint,
            planIdentity: dug.planIdentity!,
            captureRuntimeIdentity:
              published.observations[0]!.captureRuntimeIdentity,
          },
          published.planned,
          published.observations,
        ).state,
      },
      {
        planned: dug.plan.map((viewpoint) => viewpoint.id),
        observed: dug.plan.map((viewpoint) => viewpoint.id),
        revisions: [revision],
        state: "reviewed",
      },
    );

    const failedAgain = await new AutoMovieProductionSubjectInspectionService(
      () => Promise.resolve({ refused: "current subject cannot be framed" }),
    ).inspect(services, {
      shot: "opening",
      subject: SUBJECT,
      azimuthCount: 2,
      elevationsDeg: [-45],
    });
    const coexisting = readBack();
    TestValidator.equals(
      "a later same-plan failure remains beside, and cannot erase, current passed receipts",
      {
        failed: failedAgain.inspected,
        observed: coexisting.observations.map(
          (observation) => observation.viewpoint,
        ),
        history: coexisting.history.map((attempt) => attempt.verdict),
      },
      {
        failed: false,
        observed: dug.plan.map((viewpoint) => viewpoint.id),
        history: ["passed", "unsupported"],
      },
    );

    const receiptPath = path.join(
      fixture.root,
      ...dug.views[0]!.path.replace(/\.png$/u, ".json").split("/"),
    );
    const receiptBytes = fs.readFileSync(receiptPath);
    const planPath = path.join(
      path.dirname(path.dirname(path.dirname(receiptPath))),
      AUTOMOVIE_SUBJECT_INSPECTION_PLAN_FILE,
    );
    const planBytes = fs.readFileSync(planPath);
    const journalPath = path.join(
      path.dirname(path.dirname(receiptPath)),
      "attempts.json",
    );
    const journalBytes = fs.readFileSync(journalPath);
    const journal = JSON.parse(journalBytes.toString("utf8")) as {
      planIdentity: string;
      attempts: Array<{ attempt: number; observations: string[] }>;
    };
    const readWithJournal = (
      mutate: (value: typeof journal) => void,
    ): ReturnType<typeof readBack> => {
      const value = structuredClone(journal);
      mutate(value);
      fs.writeFileSync(journalPath, `${JSON.stringify(value, null, 2)}\n`);
      try {
        return readBack();
      } finally {
        fs.writeFileSync(journalPath, journalBytes);
      }
    };
    const invalidExpected = readAutoMovieSubjectInspection({
      projectRoot: fixture.root,
      productionId: "fixture-film",
      shot: "opening",
      subject: SUBJECT,
      plan: {
        ...dug.planRecord!,
        version: 1,
      } as unknown as IAutoMovieSubjectInspectionPlanRecord,
      runtimeIdentity: dug.runtimeIdentity,
    });
    const absentDirectory = readAutoMovieSubjectInspection({
      projectRoot: path.join(fixture.root, "absent-project"),
      productionId: "fixture-film",
      shot: "opening",
      subject: SUBJECT,
      plan: dug.planRecord!,
      runtimeIdentity: dug.runtimeIdentity,
    });
    const brokenRoot = path.join(fixture.root, "broken-project");
    fs.mkdirSync(
      path.join(
        brokenRoot,
        ...`${AUTOMOVIE_SUBJECT_INSPECTION_ROOT}/fixture-film/opening/${encodeURIComponent(
          SUBJECT,
        )}/${AUTOMOVIE_SUBJECT_INSPECTION_PLAN_FILE}`.split("/"),
      ),
      { recursive: true },
    );
    const unreadablePlan = readAutoMovieSubjectInspection({
      projectRoot: brokenRoot,
      productionId: "fixture-film",
      shot: "opening",
      subject: SUBJECT,
      plan: dug.planRecord!,
      runtimeIdentity: dug.runtimeIdentity,
    });
    fs.writeFileSync(planPath, "{}", "utf8");
    const malformedPlan = readBack();
    fs.writeFileSync(planPath, planBytes);
    const reversed = {
      ...dug.planRecord!,
      planned: [...dug.planRecord!.planned].reverse(),
      poses: [...dug.planRecord!.poses].reverse(),
    };
    const mismatchedPlan = readAutoMovieSubjectInspection({
      projectRoot: fixture.root,
      productionId: "fixture-film",
      shot: "opening",
      subject: SUBJECT,
      plan: {
        ...reversed,
        planIdentity: autoMovieSubjectInspectionPlanIdentity(reversed),
      },
      runtimeIdentity: dug.runtimeIdentity,
    });
    fs.rmSync(journalPath);
    const absentJournal = readBack();
    fs.writeFileSync(journalPath, journalBytes);
    fs.writeFileSync(journalPath, "{}", "utf8");
    const malformedJournal = readBack();
    fs.writeFileSync(journalPath, journalBytes);
    const nonCanonicalJournal = readWithJournal((value) => {
      value.attempts[0]!.attempt = 7;
    });
    const foreignRecord = readWithJournal((value) => {
      value.attempts[0]!.observations[0] = "../foreign.json";
    });
    const absentRecord = readWithJournal((value) => {
      value.attempts[0]!.observations[0] = `${AUTOMOVIE_SUBJECT_INSPECTION_ROOT}/fixture-film/opening/${encodeURIComponent(
        SUBJECT,
      )}/${encodeURIComponent(dug.planIdentity!)}/attempt-1/absent.json`;
    });
    fs.writeFileSync(receiptPath, "{}", "utf8");
    const malformedRecord = readBack();
    fs.writeFileSync(receiptPath, receiptBytes);
    TestValidator.equals(
      "every malformed or stale persistence layer fails closed without changing the current denominator",
      {
        invalidExpected: invalidExpected.planned.length,
        absentDirectory: absentDirectory.planned.length,
        unreadablePlan: unreadablePlan.planned.length,
        malformedPlan: malformedPlan.planned.length,
        mismatchedPlan: mismatchedPlan.planned.length,
        absentJournal: absentJournal.observations.length,
        malformedJournal: malformedJournal.observations.length,
        nonCanonicalJournal: nonCanonicalJournal.observations.length,
        foreignRecord: foreignRecord.observations.length,
        absentRecord: absentRecord.observations.length,
        malformedRecord: malformedRecord.observations.length,
      },
      {
        invalidExpected: 0,
        absentDirectory: 0,
        unreadablePlan: 0,
        malformedPlan: 0,
        mismatchedPlan: dug.plan.length,
        absentJournal: 0,
        malformedJournal: 0,
        nonCanonicalJournal: 0,
        foreignRecord: dug.plan.length - 1,
        absentRecord: dug.plan.length - 1,
        malformedRecord: dug.plan.length - 1,
      },
    );
    const escaped = JSON.parse(receiptBytes.toString("utf8")) as {
      observation: { artifact: string };
    };
    escaped.observation.artifact = `${AUTOMOVIE_SUBJECT_INSPECTION_ROOT}/fixture-film/opening/${encodeURIComponent(
      SUBJECT,
    )}/foreign.png`;
    fs.writeFileSync(receiptPath, `${JSON.stringify(escaped, null, 2)}\n`);
    const escapedRead = readBack();
    fs.writeFileSync(receiptPath, receiptBytes);
    TestValidator.equals(
      "a foreign artifact locator is refused before matching bytes can be opened",
      escapedRead.observations.length,
      dug.plan.length - 1,
    );

    const firstArtifact = path.join(
      fixture.root,
      ...dug.views[0]!.path.split("/"),
    );
    // A different raster is different bytes, and different bytes are a
    // different digest, which is the only thing that decides whether the
    // picture still answers for the observation naming it.
    fs.writeFileSync(firstArtifact, Buffer.from(inspectionPng(8, 8)));
    const tampered = readBack();
    fs.rmSync(
      path.join(
        fixture.root,
        ...`${AUTOMOVIE_SUBJECT_INSPECTION_ROOT}/fixture-film/opening/${encodeURIComponent(SUBJECT)}/${AUTOMOVIE_SUBJECT_INSPECTION_PLAN_FILE}`.split(
          "/",
        ),
      ),
    );
    const unplanned = readBack();
    TestValidator.equals(
      "a replaced picture stops being an observation and a missing plan is no denominator",
      {
        tampered: foldAutoMovieSubjectReviewCoverage(
          unit,
          {
            productionId: "fixture-film",
            target: { shot: "opening", subject: SUBJECT },
            revision,
            compileFingerprint:
              services.project.generatedManifest()!.inputFingerprint,
            planIdentity: dug.planIdentity!,
            captureRuntimeIdentity:
              published.observations[0]!.captureRuntimeIdentity,
          },
          tampered.planned,
          tampered.observations,
        ).state,
        stillPlanned: tampered.planned.length,
        unplanned: foldAutoMovieSubjectReviewCoverage(
          unit,
          {
            productionId: "fixture-film",
            target: { shot: "opening", subject: SUBJECT },
            revision,
            compileFingerprint:
              services.project.generatedManifest()!.inputFingerprint,
            planIdentity: dug.planIdentity!,
            captureRuntimeIdentity:
              published.observations[0]!.captureRuntimeIdentity,
          },
          unplanned.planned,
          unplanned.observations,
        ).state,
        nothingRead: unplanned.observations.length,
      },
      {
        tampered: "partial",
        stillPlanned: dug.plan.length,
        unplanned: "indeterminate",
        nothingRead: 0,
      },
    );

    let middleCalls = 0;
    const middle = await new AutoMovieProductionSubjectInspectionService(
      (input) => {
        ++middleCalls;
        return Promise.resolve(
          middleCalls === 2
            ? { refused: "middle viewpoint unsupported" }
            : {
                bytes: inspectionPng(input.width, input.height),
                width: input.width,
                height: input.height,
                runtimeIdentity: testCaptureRuntimeIdentity(),
                assertRuntimeCurrent: () => undefined,
              },
        );
      },
    ).inspect(services, {
      shot: "opening",
      subject: SUBJECT,
      azimuthCount: 3,
      elevationsDeg: [0],
    });
    const partial = readAutoMovieSubjectInspection({
      projectRoot: fixture.root,
      productionId: "fixture-film",
      shot: "opening",
      subject: SUBJECT,
      plan: middle.planRecord!,
      runtimeIdentity: middle.runtimeIdentity,
    });
    TestValidator.equals(
      "a middle refusal preserves the original denominator, passed prefix, and terminal reason",
      {
        inspected: middle.inspected,
        returnedViews: middle.views.length,
        planned: partial.planned.length,
        observed: partial.observations.length,
        terminal: partial.history.at(-1),
      },
      {
        inspected: false,
        returnedViews: 1,
        planned: 3,
        observed: 1,
        terminal: {
          attempt: 1,
          verdict: "unsupported",
          reason:
            'The subject inspection instrument cannot frame compiled subject "prototype:automovie:model:soloist": middle viewpoint unsupported Report its viewpoint range as unsupported rather than as observed.',
          observations: [
            `${AUTOMOVIE_SUBJECT_INSPECTION_ROOT}/fixture-film/opening/${encodeURIComponent(
              SUBJECT,
            )}/${encodeURIComponent(middle.planIdentity!)}/attempt-1/az000-el000.json`,
          ],
        },
      },
    );
  } finally {
    fixture.dispose();
  }
};
