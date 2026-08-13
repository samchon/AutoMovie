import { describeAutoMovieSubjects } from "@automovie/engine";
import type { IAutoMovieCompiledShotSource } from "@automovie/interface";
import {
  AutoMovieProductionCompiler,
  AutoMovieProductionProject,
  type AutoMovieProductionSubjectInspection,
  AutoMovieProductionSubjectInspectionService,
  type IAutoMovieProductionServices,
  openAutoMovieProduction,
} from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";

import {
  productionCompileSucceeded,
  productionFixture,
} from "./productionFixtures";
import { inspectionPng, recordingInstrument } from "./test_mcp_inspect_subject";

const SUBJECT = "prototype:automovie:model:soloist";

/** Replace only the compile gate so freshness refusals are reachable. */
const withStatus = (
  services: IAutoMovieProductionServices,
  patch: Partial<ReturnType<IAutoMovieProductionServices["compileStatus"]>>,
): IAutoMovieProductionServices => {
  const current = services.compileStatus();
  return {
    ...services,
    compileStatus: () => ({ ...current, ...patch }),
  };
};

/** One instrument that always answers with the same fixed bytes. */
const fixedInstrument =
  (
    bytes: Uint8Array,
    size?: { width: number; height: number },
  ): AutoMovieProductionSubjectInspection =>
  (input) =>
    Promise.resolve({
      bytes,
      width: size?.width ?? input.width,
      height: size?.height ?? input.height,
    });

/**
 * Every way one subject inspection can fail names what is missing instead of
 * inventing an observation.
 *
 * Scenarios:
 *
 * 1. A host with no inspection instrument, an uncompiled project, a stale or
 *    failing compile gate, and a production without a frame format each refuse
 *    with the exact cause and produce no artifact.
 * 2. An out-of-range raster, an impossible viewpoint rule, and an absent
 *    subject id are refused before the instrument is ever called.
 * 3. Instrument output that throws, decodes as something other than a PNG,
 *    reports the wrong size, or carries no visible pixel variance is discarded
 *    rather than recorded, and a compile that moves mid-sweep discards the
 *    mixed set.
 * 4. Every refusal keeps `deliveryEvidence` false, so a failed inspection is
 *    still structurally incapable of standing as a delivered frame.
 */
export const test_mcp_inspect_subject_refusals = async (): Promise<void> => {
  const fixture = productionFixture();
  try {
    const project = AutoMovieProductionProject.open(fixture.root);
    const uncompiled = openAutoMovieProduction({
      projectRoot: fixture.root,
      productionId: "fixture-film",
    });
    const instrument = recordingInstrument();
    const inspection = new AutoMovieProductionSubjectInspectionService(
      instrument.adapter,
    );
    const target = { shot: "opening", subject: SUBJECT };

    const hostless =
      await new AutoMovieProductionSubjectInspectionService().inspect(
        uncompiled,
        target,
      );
    const beforeCompile = await inspection.inspect(uncompiled, target);
    TestValidator.equals(
      "a missing instrument and a missing compile each refuse by name",
      {
        hostless: {
          code: hostless.diagnostics[0]?.code,
          inspected: hostless.inspected,
          deliveryEvidence: hostless.deliveryEvidence,
          plan: hostless.plan,
          views: hostless.views,
          coverage: hostless.coverage,
        },
        beforeCompile: {
          code: beforeCompile.diagnostics[0]?.code,
          inspected: beforeCompile.inspected,
        },
        drawn: instrument.calls.length,
      },
      {
        hostless: {
          code: "capture-host-unavailable",
          inspected: false,
          deliveryEvidence: false,
          plan: [],
          views: [],
          coverage: null,
        },
        beforeCompile: { code: "compile-missing", inspected: false },
        drawn: 0,
      },
    );

    const compiled = new AutoMovieProductionCompiler(project).compile({
      scope: "source",
    });
    if (productionCompileSucceeded("inspection refusal fixture", compiled))
      TestValidator.equals("the refusal fixture compiles", true, true);
    else throw new Error("The inspection refusal fixture did not compile.");
    const services = openAutoMovieProduction({
      projectRoot: fixture.root,
      productionId: "fixture-film",
    });

    const stale = await inspection.inspect(
      withStatus(services, {
        compiler: {
          ...services.compileStatus().compiler,
          inputFingerprint: `sha256:${"9".repeat(64)}`,
        },
      }),
      target,
    );
    const failing = await inspection.inspect(
      withStatus(services, { success: false }),
      target,
    );
    TestValidator.equals(
      "a stale or failing compile gate refuses before any subject is read",
      {
        stale: stale.diagnostics[0]?.code,
        failing: failing.diagnostics[0]?.code,
        drawn: instrument.calls.length,
      },
      {
        stale: "generated-stale",
        failing: "compile-current-invalid",
        drawn: 0,
      },
    );

    const oversized = await inspection.inspect(services, {
      ...target,
      width: 4096,
    });
    const impossible = await inspection.inspect(services, {
      ...target,
      azimuthCount: 0,
    });
    const absent = await inspection.inspect(services, {
      shot: "opening",
      subject: "element:no-such-node",
    });
    TestValidator.equals(
      "an impossible raster, rule, or subject is refused before drawing",
      {
        oversized: oversized.diagnostics[0]?.code,
        impossible: {
          code: impossible.diagnostics[0]?.code,
          keptSubject: impossible.subject?.id,
        },
        absent: {
          code: absent.diagnostics[0]?.code,
          subject: absent.subject,
        },
        drawn: instrument.calls.length,
      },
      {
        oversized: "preview-input-invalid",
        impossible: {
          code: "preview-input-invalid",
          keptSubject: SUBJECT,
        },
        absent: { code: "capture-target-missing", subject: null },
        drawn: 0,
      },
    );

    const throwing = await new AutoMovieProductionSubjectInspectionService(
      () => {
        throw new Error("the inspection browser closed");
      },
    ).inspect(services, target);
    const undecodable = await new AutoMovieProductionSubjectInspectionService(
      fixedInstrument(new Uint8Array()),
    ).inspect(services, target);
    const mismatched = await new AutoMovieProductionSubjectInspectionService(
      fixedInstrument(inspectionPng(16, 16), { width: 8, height: 8 }),
    ).inspect(services, target);
    const blank = new PNG({ width: 16, height: 16 });
    blank.data.fill(0);
    const featureless = await new AutoMovieProductionSubjectInspectionService(
      fixedInstrument(PNG.sync.write(blank)),
    ).inspect(services, target);
    TestValidator.equals(
      "instrument output that cannot be trusted is discarded, not recorded",
      {
        throwing: throwing.diagnostics[0]?.code,
        undecodable: undecodable.diagnostics[0]?.code,
        mismatched: mismatched.diagnostics[0]?.code,
        featureless: featureless.diagnostics[0]?.code,
        planned: [
          throwing.plan.length,
          undecodable.plan.length,
          mismatched.plan.length,
          featureless.plan.length,
        ],
        views: [
          throwing.views.length,
          undecodable.views.length,
          mismatched.views.length,
          featureless.views.length,
        ],
      },
      {
        throwing: "capture-failed",
        undecodable: "capture-png-invalid",
        mismatched: "capture-size-mismatch",
        featureless: "capture-png-blank",
        planned: [6, 6, 6, 6],
        views: [0, 0, 0, 0],
      },
    );

    const manifestPath = path.join(
      fixture.root,
      ".automovie",
      "productions",
      "fixture-film",
      "generated-manifest.json",
    );
    const manifestBytes = fs.existsSync(manifestPath)
      ? fs.readFileSync(manifestPath)
      : null;
    if (manifestBytes === null)
      throw new Error(
        `The fixture generated manifest is not at ${manifestPath}; the mid-sweep case cannot be arranged.`,
      );
    const moved = await new AutoMovieProductionSubjectInspectionService(
      (input) => {
        if (fs.existsSync(manifestPath)) fs.rmSync(manifestPath);
        return Promise.resolve({
          bytes: inspectionPng(input.width, input.height),
          width: input.width,
          height: input.height,
        });
      },
    ).inspect(services, target);
    fs.writeFileSync(manifestPath, manifestBytes);
    TestValidator.equals(
      "a compile that moves mid-sweep discards the mixed set",
      {
        code: moved.diagnostics[0]?.code,
        inspected: moved.inspected,
        deliveryEvidence: moved.deliveryEvidence,
      },
      {
        code: "capture-input-changed",
        inspected: false,
        deliveryEvidence: false,
      },
    );

    const unframeable = describeAutoMovieSubjects({
      revision: "probe",
      compiled: JSON.parse(
        Buffer.from(
          services.project.readGeneratedFile("shots/opening.json"),
        ).toString("utf8"),
      ) as IAutoMovieCompiledShotSource,
    }).find(
      (subject) =>
        subject.bounds.content === null && subject.bounds.declared === null,
    );
    if (unframeable === undefined)
      throw new Error(
        "The fixture compiles no extentless subject, so the unsupported-viewpoint refusal cannot be arranged.",
      );
    const extentless = await inspection.inspect(services, {
      shot: "opening",
      subject: unframeable.id,
    });
    TestValidator.equals(
      "a subject with no measurable extent is unsupported, never framed anyway",
      {
        code: extentless.diagnostics[0]?.code,
        inspected: extentless.inspected,
        described: extentless.subject?.id,
        plan: extentless.plan,
        drawn: instrument.calls.length,
      },
      {
        code: "review-subject-viewpoint-unsupported",
        inspected: false,
        described: unframeable.id,
        plan: [],
        drawn: 0,
      },
    );

    const erased = project.eraseDesignArtifact({ kind: "production" });
    const formatless = await inspection.inspect(
      withStatus(
        openAutoMovieProduction({
          projectRoot: fixture.root,
          productionId: "fixture-film",
        }),
        {},
      ),
      target,
    );
    TestValidator.equals(
      "a production without a frame format cannot state an inspection raster",
      {
        erased: erased.accepted,
        code: formatless.diagnostics[0]?.code,
        inspected: formatless.inspected,
      },
      {
        erased: true,
        code: "compile-missing",
        inspected: false,
      },
    );
  } finally {
    fixture.dispose();
  }
};
