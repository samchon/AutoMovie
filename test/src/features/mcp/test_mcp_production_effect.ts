import {
  IAutoMovieCompiledShotSource,
  IAutoMovieShotEffectCue,
} from "@automovie/interface";
import {
  AutoMovieProductionCompiler,
  AutoMovieProductionOracleService,
  AutoMovieProductionProject,
  digestAutoMovieBytes,
  materializeCompiledEffects,
  validateAutoMovieEffects,
} from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import path from "node:path";

import {
  productionFixture,
  shotContract,
  worldDesign,
} from "./productionFixtures";

/** Effect cues compile into seeded streams and bounded oracle evidence. */
export const test_mcp_production_effect = (): void => {
  const fixture = productionFixture();
  try {
    const project = AutoMovieProductionProject.open(fixture.root);
    project.setWorldDesign(worldDesign());
    const compile = new AutoMovieProductionCompiler(project).compile({
      scope: "source",
    });
    const compiled = compile.success
      ? (JSON.parse(
          fs.readFileSync(
            path.join(fixture.root, "generated/shots/opening.json"),
            "utf8",
          ),
        ) as IAutoMovieCompiledShotSource)
      : null;
    const summary = new AutoMovieProductionOracleService(project).query({
      request: {
        query: "effect",
        zone: "signal-smoke",
        shot: "opening",
        time: 2,
        subjects: ["sentinel"],
      },
    });
    const inactive = new AutoMovieProductionOracleService(project).query({
      request: {
        query: "effect",
        zone: "signal-smoke",
        shot: "opening",
        time: 5,
      },
    });
    const unsafeSubjects = new AutoMovieProductionOracleService(project).query({
      request: {
        query: "effect",
        zone: "signal-smoke",
        shot: "opening",
        time: 2,
        subjects: ["sentinel", "sentinel"],
      },
    });
    const missingZone = new AutoMovieProductionOracleService(project).query({
      request: {
        query: "effect",
        zone: "missing",
        shot: "opening",
        time: 2,
      },
    });
    TestValidator.predicate(
      "source cue becomes one current deterministic effect stream and oracle summary",
      compile.success &&
        compiled?.effects.length === 1 &&
        compiled.effects[0]?.kind === "smoke" &&
        compiled.effects[0]?.event === "signal-raised" &&
        summary.result?.kind === "measurement" &&
        summary.result.values.active === true &&
        Number(summary.result.values.particleCount) > 0 &&
        Number(summary.result.values.particleCount) <=
          Number(summary.result.values.particleCap) &&
        Number(summary.result.values.visibilityRisk) >= 0 &&
        summary.result.values.effectDigest === compiled.effects[0]?.digest &&
        inactive.result?.kind === "measurement" &&
        inactive.result.values.active === false &&
        unsafeSubjects.result === null &&
        unsafeSubjects.diagnostics[0]?.message.includes("256 unique") &&
        missingZone.result === null,
    );

    const cue = compiled!.effectCues![0]!;
    const validate = (
      cues: IAutoMovieShotEffectCue[],
      effects = compiled!.effects,
    ) =>
      validateAutoMovieEffects(shotContract(), {
        ...compiled!,
        effectCues: cues,
        effects,
      });
    const valid = validate([cue]);
    const invalid = [
      ...validate(
        Array.from({ length: 129 }, (_, index) => ({
          ...cue,
          id: `effect-${index}`,
        })),
      ),
      ...validate([{ ...cue, id: "" }]),
      ...validate([cue, { ...cue }]),
      ...validate([{ ...cue, zone: "missing-zone" }]),
      ...[
        { start: Number.NaN, end: 2 },
        { start: 1, end: Number.NaN },
        { start: -1, end: 2 },
        { start: 2, end: 2 },
        { start: 1, end: shotContract().durationSeconds + 1 },
      ].flatMap((time, index) =>
        validate([{ ...cue, id: `time-${index}`, ...time }]),
      ),
      ...[Number.NaN, -0.1, 1.1].flatMap((from, index) =>
        validate([
          {
            ...cue,
            id: `intensity-${index}`,
            intensity: { ...cue.intensity, from },
          },
        ]),
      ),
      ...validate([{ ...cue, event: "missing-event" }]),
      ...validate([{ ...cue, start: 2.5, end: 3 }]),
      ...validate([cue, { ...cue, id: "overlap", start: cue.start + 0.25 }]),
      ...validate([cue], []),
      ...validate([], compiled!.effects),
    ];
    TestValidator.predicate(
      "effect validation rejects every unsafe cue and compiler-stream mismatch",
      valid.length === 0 &&
        [
          "at most 128",
          "unique inside the shot",
          "compiler-materialized world zone",
          "positive interval",
          "bounded 0..1",
          "compiled event realized inside",
          "must not overlap prior zone cue",
          "exactly one compiler-owned stream",
        ].every((message) =>
          invalid.some((diagnostic) => diagnostic.message.includes(message)),
        ) &&
        materializeCompiledEffects({
          contract: shotContract(),
          cues: [cue],
        }).length === 0,
    );

    const shotPath = path.join(fixture.root, "generated/shots/opening.json");
    const manifestPath = path.join(
      fixture.root,
      ".automovie/generated-manifest.json",
    );
    const originalShot = fs.readFileSync(shotPath);
    const originalManifest = fs.readFileSync(manifestPath);
    const ambiguous = structuredClone(compiled!);
    ambiguous.effects = [
      { ...compiled!.effects[0]!, id: "first", start: 1, end: 2 },
      { ...compiled!.effects[0]!, id: "second", start: 3, end: 4 },
    ];
    const ambiguousBytes = Buffer.from(JSON.stringify(ambiguous));
    fs.writeFileSync(shotPath, ambiguousBytes);
    const manifest = JSON.parse(originalManifest.toString("utf8")) as {
      files: Array<{ path: string; digest: `sha256:${string}` }>;
    };
    manifest.files.find((file) => file.path === "shots/opening.json")!.digest =
      digestAutoMovieBytes(ambiguousBytes);
    fs.writeFileSync(manifestPath, JSON.stringify(manifest));
    const ambiguousSummary = new AutoMovieProductionOracleService(
      project,
    ).query({
      request: {
        query: "effect",
        zone: "signal-smoke",
        shot: "opening",
        time: 2.5,
      },
    });
    fs.writeFileSync(shotPath, originalShot);
    fs.writeFileSync(manifestPath, originalManifest);
    TestValidator.predicate(
      "effect oracle refuses an ambiguous inactive gap between repeated zone cues",
      ambiguousSummary.result === null &&
        ambiguousSummary.diagnostics[0]?.message.includes("unambiguous"),
    );
  } finally {
    fixture.dispose();
  }
};
