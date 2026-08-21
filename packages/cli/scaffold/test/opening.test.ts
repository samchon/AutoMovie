import type {
  IAutoMovieProductionShotProgram,
  IAutoMovieShotBuildContext,
} from "@automovie/interface";
import {
  AutoMovieProductionCompiler,
  AutoMovieProductionProject,
} from "@automovie/mcp";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { createAutoMovieEvidenceConfig } from "../config/src/createAutoMovieEvidenceConfig";
import { film } from "../src/film";
import { Chorus, chorus } from "../src/formations/chorus";
import { createChorusAdvanceMotion } from "../src/motions/chorusAdvance";
import { createChorusBreakMotion } from "../src/motions/chorusBreak";
import { createChorusHoldMotion } from "../src/motions/chorusHold";
import { createSoloistCueMotion } from "../src/motions/soloistCue";
import { PlazaGate, gate } from "../src/objects/gate";
import { PRODUCTION_BACKGROUND, production } from "../src/production";
import { answer, answerAcceptance, opening } from "../src/shots/opening";
import {
  ChorusMember,
  ChorusTier,
  chorusFar,
  chorusNear,
} from "../src/units/chorusHero";
import { Soloist, soloist } from "../src/units/soloist";
import {
  Plaza,
  PlazaCenterMark,
  PlazaGround,
  PlazaHaze,
  WorldPiece,
  plaza,
} from "../src/world/plaza";

const firstProject = AutoMovieProductionProject.open(process.cwd());
const first = new AutoMovieProductionCompiler(firstProject).compile({
  scope: "source",
});
assert.equal(first.success, true, JSON.stringify(first.diagnostics, null, 2));

const reopenedProject = AutoMovieProductionProject.open(process.cwd());
const reopened = new AutoMovieProductionCompiler(reopenedProject).compile({
  scope: "source",
});
assert.equal(
  reopened.compiler.inputFingerprint,
  first.compiler.inputFingerprint,
  "Reopening the project must preserve compiler identity.",
);
assert.ok(
  reopened.materialized.every((file) => file.status === "unchanged"),
  "A second unchanged compile must materialize no changed files.",
);
process.stdout.write("opening compile/reopen identity: ok\n");

assert.equal(PRODUCTION_BACKGROUND, "#182235");
assert.deepEqual(production.frameFormat, {
  width: 1280,
  height: 720,
  fps: 24,
  colorSpace: "srgb",
});
assert.deepEqual(production.artDirection.palette, [
  "#182235",
  "#d7b56d",
  "#8f9d74",
  "#6f746e",
  "#89918a",
]);
assert.deepEqual(
  production.deliverables.map(({ kind }) => kind),
  ["preview", "feature", "guide-pass", "captions", "audio-mix"],
);
const filmEdit = film.build({
  production,
  shots: {},
  assets: [],
  derivedArtifacts: {},
  effectZones: [],
});
assert.deepEqual(
  filmEdit.tracks.video.map(
    ({ shot, sourceOut, start, transitionIn, transitionOut }) => ({
      shot,
      sourceOut,
      start,
      transitionIn,
      transitionOut,
    }),
  ),
  [
    {
      shot: "opening",
      sourceOut: { seconds: 6 },
      start: { frame: 0 },
      transitionIn: { kind: "fade", duration: { seconds: 0.5 } },
      transitionOut: { kind: "dissolve", duration: { seconds: 0.5 } },
    },
    {
      shot: "answer",
      sourceOut: { seconds: 6 },
      start: { seconds: 5.5 },
      transitionIn: { kind: "dissolve", duration: { seconds: 0.5 } },
      transitionOut: { kind: "fade", duration: { seconds: 0.5 } },
    },
  ],
);
assert.deepEqual(filmEdit.tracks.captions, [
  {
    id: "cue-caption",
    text: "The soloist raises the cue.",
    language: "en",
    start: { seconds: 1.5 },
    end: { seconds: 3 },
  },
]);
assert.deepEqual(
  filmEdit.tracks.audio.map(({ id, duration, gain }) => ({
    id,
    duration,
    gain,
  })),
  [
    {
      id: "starter-silent-guide",
      duration: { seconds: 11.5 },
      gain: 0,
    },
  ],
);
process.stdout.write("production and film source contracts: ok\n");

// A subject refuses a measurement its specification does not state, and says
// which document it contradicts. Checked here rather than in a constructor: a
// subclass sets its own fields after the base constructor has run, so only the
// method that emits the record sees what the subject finally is.
assert.throws(
  () =>
    new (class extends Chorus {
      public override readonly count = 1;
    })().design(),
  /docs\/models\/020-chorus\.md/,
  "A chorus whose count leaves a declared row empty must be refused.",
);
assert.throws(
  () =>
    new (class extends ChorusMember {
      public override readonly height = 1.9;
    })().design(),
  /docs\/models\/020-chorus\.md/,
  "A member taller than the specification states must be refused.",
);
// The scale is compared within a tolerance because an equivalent arithmetic
// derivation can land a fraction above 1.7; this checks numeric tolerance, not
// an alternative production-scale relationship.
assert.doesNotThrow(
  () =>
    new (class extends ChorusMember {
      public override readonly height = 1.85 - 0.15;
    })().design(),
  "A derived scale that only drifts by float representation must be accepted.",
);
process.stdout.write(
  "subject constraints refuse what the spec does not state: ok\n",
);

const advance = chorus.advance({ id: "advance", start: 0, end: 6 });
assert.equal(advance.gait, "walk");
assert.deepEqual(advance.from.spacingScale, { lateral: 1, depth: 1 });
assert.deepEqual(advance.to.translation, { x: 0, y: 0, z: -2 });
assert.deepEqual(advance.to.spacingScale, { lateral: 1, depth: 1 });

const hold = chorus.hold({ id: "hold", start: 0, end: 6 });
assert.deepEqual(chorus.design().capabilities, ["hold", "advance", "break"]);
assert.deepEqual(new ChorusMember().design().capabilities, []);
assert.deepEqual(
  new ChorusMember().design().profiles?.map((profile) => ({
    id: profile.id,
    name: profile.name,
    gaits: profile.gaits?.map((gait) => gait.name) ?? [],
  })),
  [{ id: "chorus-hero-stride", name: "stride", gaits: ["walk"] }],
);
assert.deepEqual(
  chorusNear.design().profiles?.map((profile) => profile.id),
  ["chorus-near-stride"],
);
assert.deepEqual(
  chorusFar.design().profiles?.map((profile) => profile.id),
  ["chorus-far-stride"],
);
assert.equal(hold.action, "hold");
assert.equal(hold.gait, "walk");
assert.deepEqual(hold.from, hold.to);
assert.deepEqual(hold.to.translation, { x: 0, y: 0, z: -2 });

const broken = chorus.break({ id: "break", start: 0, end: 2, scale: 1.25 });
assert.equal(broken.gait, "walk");
assert.deepEqual(broken.to.spacingScale, { lateral: 1.25, depth: 1.25 });
assert.throws(
  () => chorus.break({ id: "break", start: 0, end: 2, scale: 1 }),
  /greater than one/,
);
assert.throws(
  () => chorus.advance({ id: "advance", start: 2, end: 2 }),
  /start < end/,
);

const cue = createSoloistCueMotion({
  id: "opening",
  duration: 6,
  skeleton: "soloist-skeleton",
  from: 0,
});
assert.equal(cue.keyframes[1]?.time, 2);
assert.equal(cue.keyframes[1]?.pose.joints[0]?.abduction, 110);
assert.equal(cue.keyframes.at(-1)?.time, 6);

const heldCue = createSoloistCueMotion({
  id: "answer",
  duration: 6,
  skeleton: "soloist-skeleton",
  from: 110,
});
assert.equal(heldCue.keyframes.length, 2);
assert.equal(heldCue.keyframes[0]?.pose.joints[0]?.abduction, 110);
assert.equal(heldCue.keyframes[1]?.pose.joints[0]?.abduction, 110);
assert.throws(
  () =>
    createSoloistCueMotion({
      id: "short",
      duration: 1,
      skeleton: "soloist-skeleton",
      from: 0,
    }),
  /at least 2 seconds/,
);
assert.throws(
  () =>
    createSoloistCueMotion({
      id: "invalid",
      duration: 6,
      skeleton: "soloist-skeleton",
      from: 111,
    }),
  /between 0 and 110 degrees/,
);
for (const motion of [
  () =>
    createChorusAdvanceMotion({
      id: "",
      formation: "chorus",
      start: 0,
      end: 1,
    }),
  () =>
    createChorusBreakMotion({
      id: "",
      formation: "chorus",
      start: 0,
      end: 1,
      scale: 1.1,
    }),
  () =>
    createChorusHoldMotion({
      id: "",
      formation: "chorus",
      start: 0,
      end: 1,
    }),
  () =>
    createSoloistCueMotion({
      id: "",
      duration: 2,
      skeleton: "soloist-skeleton",
      from: 0,
    }),
])
  assert.throws(motion, /ids must be non-empty/);
for (const motion of [
  () =>
    createChorusAdvanceMotion({
      id: "advance",
      formation: "chorus",
      start: Number.NaN,
      end: 1,
    }),
  () =>
    createChorusAdvanceMotion({
      id: "advance",
      formation: "chorus",
      start: 0,
      end: Number.POSITIVE_INFINITY,
    }),
  () =>
    createChorusBreakMotion({
      id: "break",
      formation: "chorus",
      start: Number.NaN,
      end: 1,
      scale: 1.1,
    }),
  () =>
    createChorusBreakMotion({
      id: "break",
      formation: "chorus",
      start: 0,
      end: Number.POSITIVE_INFINITY,
      scale: 1.1,
    }),
  () =>
    createChorusHoldMotion({
      id: "hold",
      formation: "chorus",
      start: Number.NaN,
      end: 1,
    }),
  () =>
    createChorusHoldMotion({
      id: "hold",
      formation: "chorus",
      start: 0,
      end: Number.POSITIVE_INFINITY,
    }),
])
  assert.throws(motion, /finite start < end/);
assert.throws(
  () =>
    createChorusBreakMotion({
      id: "break",
      formation: "chorus",
      start: 0,
      end: 1,
      scale: Number.NaN,
    }),
  /scale must be finite and greater than one/,
);
process.stdout.write("motion endpoints, holds, and refusals: ok\n");

const productionWorld = plaza.design();
const shotContext = (
  shot: typeof opening | typeof answer,
): IAutoMovieShotBuildContext =>
  ({
    contract: {
      ...shot.contract,
      id: shot.id,
      source: { module: "src/shots/opening.ts", export: shot.id },
    },
    models: {
      [soloist.id]: soloist.design(),
      "chorus-hero": new ChorusMember().design(),
      "chorus-near": chorusNear.design(),
      "chorus-far": chorusFar.design(),
    },
    derivedArtifacts: {},
    world: productionWorld,
    formations: { [chorus.id]: chorus.design() },
    runtimeModels: {
      [soloist.id]: {
        id: "soloist-runtime",
        skeleton: { id: "soloist-skeleton" },
      },
    },
    formationRuntime: {},
    instanceSetRuntime: {},
    engine: {},
  }) as unknown as IAutoMovieShotBuildContext;

const openingContext = shotContext(opening);
const answerContext = shotContext(answer);
const openingProgram = opening.build(
  openingContext,
) as IAutoMovieProductionShotProgram;
const answerProgram = answer.build(
  answerContext,
) as IAutoMovieProductionShotProgram;
assert.equal(openingProgram.formationMotions!.length, 2);
assert.equal(openingProgram.formationMotions![0]?.end, 2);
assert.equal(openingProgram.formationMotions![0]?.gait, "walk");
assert.equal(openingProgram.formationMotions![0]?.to.translation.z, -2);
assert.equal(openingProgram.formationMotions![1]?.action, "hold");
assert.equal(openingProgram.formationMotions![1]?.gait, "walk");
assert.equal(openingProgram.formationMotions![1]?.start, 2);
assert.equal(openingProgram.formationMotions![1]?.end, 6);
assert.deepEqual(
  openingProgram.formationMotions![1]?.from,
  openingProgram.formationMotions![1]?.to,
);
assert.equal(openingProgram.effectCues!.length, 1);
assert.equal(answerProgram.props!.length, 1);
assert.equal(answerProgram.formationMotions![0]?.from.translation.z, -2);
assert.equal(gate.height(), 2.1);
assert.equal(gate.hingeNode(), "plaza-gate/hinge");
assert.equal(gate.positiveEdgeX(answerContext), 40);
assert.equal(gate.position(answerContext).x, 20);
assert.equal(gate.position(answerContext).z, -40);
assert.deepEqual(
  gate.position({
    ...answerContext,
    world: {
      ...answerContext.world,
      surfaces: [
        {
          ...answerContext.world.surfaces[0]!,
          polygon: [
            { x: -12, z: -30 },
            { x: 12, z: -30 },
            { x: 12, z: 30 },
            { x: -12, z: 30 },
          ],
        },
      ],
    },
  }),
  { x: 6, y: 0, z: -30 },
);
assert.deepEqual(answer.contract.camera.requiredSubjects, [gate.id]);
assert.deepEqual(answer.contract.reviewFrames[0], {
  id: "shut-gate",
  time: 4,
  passes: ["beauty", "mask"],
});
assert.deepEqual(answerProgram.stage.cameras[0]?.position, {
  x: 28.4,
  y: 1.05,
  z: -31.6,
});
assert.deepEqual(answerProgram.blocking.camera.on, {
  kind: "node",
  node: gate.id,
});
assert.deepEqual(answerProgram.performance.draft[1], {
  verb: "frame",
  actor: "camera",
  start: 0,
  duration: "auto",
  framing: "wide",
  move: "static",
  on: { kind: "node", node: gate.id },
});
assert.equal(answerAcceptance[0]?.criterion.kind, "frame");
assert.deepEqual(answerAcceptance[1]?.criterion, {
  kind: "event",
  event: "cue-answered",
  expectation:
    "The realized cue-answered event samples the raised arm at or above 100 degrees inside this shot rather than borrowing the opening realization.",
});
assert.deepEqual(answerAcceptance[2]?.criterion, {
  kind: "frame",
  frame: "shut-gate",
  pass: "mask",
  expectation:
    "The mask isolates plaza-gate at the shut-gate review frame with no unresolved subject identity.",
});
assert.equal(gate.stage(answerContext).model, gate.id);
assert.equal(gate.design().model.parts.length, 2);
assert.deepEqual(gate.design().model.materials, [
  {
    id: "gate-finish",
    name: "desaturated gate blocking finish",
    baseColor: {
      r: 0.1589608350608804,
      g: 0.17464740365558504,
      b: 0.1559264637078274,
      a: 1,
      hex: "#6f746e",
    },
    metallic: 0,
    roughness: 0.82,
    emissive: null,
    opacity: 1,
    baseColorTexture: null,
  },
]);
assert.ok(
  gate.design().model.parts.every((part) => part.material === "gate-finish"),
);
assert.equal(gate.render(answerContext).set?.length, 1);
assert.throws(
  () =>
    new PlazaGate().farEdgeZ({
      ...answerContext,
      world: { ...answerContext.world, surfaces: [] },
    }),
  /needs staged ground/,
);
assert.throws(
  () =>
    new PlazaGate().positiveEdgeX({
      ...answerContext,
      world: { ...answerContext.world, surfaces: [] },
    }),
  /needs staged ground/,
);
assert.throws(
  () =>
    new PlazaGate().positiveEdgeX({
      ...answerContext,
      world: {
        ...answerContext.world,
        surfaces: [
          {
            ...answerContext.world.surfaces[0]!,
            polygon: [
              { x: -2, z: -1 },
              { x: 0, z: -1 },
              { x: 0, z: 1 },
            ],
          },
        ],
      },
    }),
  /positive-x edge.*greatest x coordinate is 0/,
);

const noFormationContext = shotContext(opening);
noFormationContext.contract = {
  ...noFormationContext.contract,
  participants: noFormationContext.contract.participants.filter(
    (participant) => participant.kind !== "formation",
  ),
};
noFormationContext.world = { ...noFormationContext.world, effectZones: [] };
const noFormationProgram = opening.build(
  noFormationContext,
) as IAutoMovieProductionShotProgram;
assert.deepEqual(noFormationProgram.formationMotions, []);
assert.deepEqual(noFormationProgram.effectCues, []);

assert.equal(soloist.eyeHeight(), 1.62);
assert.equal(soloist.modelRef(openingContext), "soloist-runtime");
assert.equal(soloist.skeleton(openingContext), "soloist-skeleton");
assert.equal(soloist.cue(openingContext).keyframes[0]?.time, 0);
assert.equal(soloist.render(openingContext).actors?.length, 1);
assert.equal(soloist.render(openingContext).actors?.[0]?.speed, 1.2);
assert.throws(
  () => new Soloist().modelRef({ ...openingContext, runtimeModels: {} }),
  /runtime model must be available/,
);
assert.throws(
  () => new Soloist().skeleton({ ...openingContext, runtimeModels: {} }),
  /must provide a skeleton/,
);
assert.throws(
  () =>
    new Soloist().skeleton({
      ...openingContext,
      runtimeModels: {
        [soloist.id]: {
          ...openingContext.runtimeModels[soloist.id]!,
          skeleton: null,
        },
      },
    }),
  /must provide a skeleton/,
);

assert.deepEqual(new ChorusMember().render(openingContext), {});
assert.deepEqual(chorusNear.render(openingContext), {});
assert.equal(chorusNear.profile().gaits?.length, 1);
assert.equal(chorusFar.design().lod[0]?.tier, "far");
assert.throws(
  () => new ChorusTier("fine-head", "near", 0.13, 0.06).design(),
  /cannot be finer than the hero tier/,
);
assert.throws(
  () => new ChorusTier("fine-limb", "near", 0.15, 0.04).design(),
  /cannot be finer than the hero tier/,
);
assert.throws(
  () =>
    new (class extends Chorus {
      public override readonly count = this.ranks * this.files + 1;
    })().design(),
  /with no slot/,
);
assert.deepEqual(chorus.render(openingContext), {});
assert.deepEqual(chorus.footprint(), { width: 31.5, depth: 32 });
assert.equal(chorus.reach(), 39);

const ground = new PlazaGround();
const mark = new PlazaCenterMark();
const haze = new PlazaHaze();
assert.equal(ground.heightAt({ x: 0, z: 0 }), 0);
assert.equal(ground.patches()[0]?.kind, "floor");
assert.equal(mark.design().landmarks?.length, 1);
assert.equal(mark.render(openingContext).landmarks?.length, 1);
assert.deepEqual(mark.patches(), []);
assert.equal(haze.place().effectZones?.length, 1);
assert.equal(plaza.members().length, 3);
assert.equal(plaza.space().walkable.length, 1);

class CompleteWorldPiece extends WorldPiece {
  public readonly id = "complete-world-piece";

  public place(): ReturnType<WorldPiece["design"]> {
    return {
      landmarks: [],
      surfaces: [],
      routes: [],
      effectRecipes: [],
      effectZones: [],
      instanceSets: [
        {
          id: "complete-instance-set",
          modelRecipe: "chorus-hero",
          count: 1,
          layout: {
            kind: "explicit",
            transforms: [
              {
                id: "only",
                translation: { x: 0, y: 0, z: 0 },
                rotation: { x: 0, y: 0, z: 0, w: 1 },
                scale: { x: 1, y: 1, z: 1 },
              },
            ],
          },
          anchor: { x: 0, y: 0, z: 0 },
          facingDeg: 0,
          seed: 1,
          variation: { scale: { min: 1, max: 1 }, palette: [], traits: [] },
        },
      ],
    };
  }
}
class CompletePlaza extends Plaza {
  public override members(): readonly WorldPiece[] {
    return [new CompleteWorldPiece()];
  }
}
assert.equal(new CompletePlaza().design().instanceSets?.length, 1);
process.stdout.write("subject, world, prop, and shot owners: ok\n");

const topologyRoots: string[] = [];
const topologyRoot = (hosts: string[]): string => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "automovie-topology-"));
  topologyRoots.push(root);
  for (const host of hosts) {
    const absolute = path.join(root, host);
    fs.mkdirSync(path.dirname(absolute), { recursive: true });
    const normalized = host.replaceAll("\\", "/");
    const ladder = /^docs\/(?:storylines|scenarios|script|briefs)\//u.test(
      normalized,
    );
    fs.writeFileSync(
      absolute,
      host.endsWith(".md")
        ? ladder
          ? "# Governed host\n\n## Unit {#unit}\n\n### Child {#child}\n\n#### Observation {#observation}\n"
          : "# Governed host\n\n## Unit {#unit}\n"
        : "export const governedOwner = true;\n",
      "utf8",
    );
  }
  return root;
};
const writeTopologyHost = (
  root: string,
  host: string,
  content: string,
): void => {
  const absolute = path.join(root, host);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, content, "utf8");
};

const emptyRoot = topologyRoot([]);
const briefRoot = topologyRoot([
  "docs/settings/production.md",
  "docs/briefs/demonstration.md",
  "src/shots/demonstration.ts",
]);
const filmRoot = topologyRoot([
  "docs/settings/production.md",
  "docs/storylines/sequence.md",
  "docs/scenarios/sequence.md",
  "docs/script/sequence.md",
  "src/shots/sequence.ts",
]);
const researchRoot = topologyRoot([
  "docs/research/source.md",
  "docs/settings/production.md",
]);
const residueRoot = topologyRoot(["docs/models/residue.md"]);
const headinglessRoot = topologyRoot(["docs/settings/headingless.md"]);
fs.writeFileSync(
  path.join(headinglessRoot, "docs/settings/headingless.md"),
  "# Headingless host\n",
  "utf8",
);
const ownerlessRoot = topologyRoot([
  "docs/settings/production.md",
  "docs/briefs/demonstration.md",
  "src/shots/demonstration.ts",
  "src/shots/ownerless.ts",
]);
fs.writeFileSync(
  path.join(ownerlessRoot, "src/shots/ownerless.ts"),
  "// export const commentOwner = true;\nconst example = `\nexport function stringOwner() {}\n`;\nexport {};\n",
  "utf8",
);
const identityMismatchRoot = topologyRoot([
  "docs/settings/production.md",
  "docs/storylines/sequence.md",
  "docs/scenarios/sequence.md",
  "docs/script/sequence.md",
]);
fs.writeFileSync(
  path.join(identityMismatchRoot, "docs/script/sequence.md"),
  "# Governed host\n\n## Unit {#unit}\n\n### Child {#child}\n\n#### Different observation {#different-observation}\n",
  "utf8",
);
const unanchoredRoot = topologyRoot(["docs/settings/unanchored.md"]);
fs.writeFileSync(
  path.join(unanchoredRoot, "docs/settings/unanchored.md"),
  "# Governed host\n\n## Unit\n",
  "utf8",
);
const fencedRoot = topologyRoot(["docs/settings/fenced.md"]);
fs.writeFileSync(
  path.join(fencedRoot, "docs/settings/fenced.md"),
  "# Governed host\n\n```md\n```not-a-closing-fence\n## Example without a production anchor\n```\n\n## Real unit {#real-unit}\n",
  "utf8",
);
const commentedRoot = topologyRoot(["docs/settings/commented.md"]);
fs.writeFileSync(
  path.join(commentedRoot, "docs/settings/commented.md"),
  "# Governed host\n\n<!--\n## Retired unit {#retired-unit}\n-->\n",
  "utf8",
);
const duplicateAnchorRoot = topologyRoot(["docs/settings/duplicate.md"]);
fs.writeFileSync(
  path.join(duplicateAnchorRoot, "docs/settings/duplicate.md"),
  "# Governed host\n\n## First unit {#same-unit}\n\n## Second unit {#same-unit}\n",
  "utf8",
);
const orphanRoot = topologyRoot([
  "docs/settings/production.md",
  "docs/storylines/orphan.md",
]);
fs.writeFileSync(
  path.join(orphanRoot, "docs/storylines/orphan.md"),
  "# Governed host\n\n#### Orphan {#orphan}\n\n## Unit {#unit}\n\n### Child {#child}\n",
  "utf8",
);
const h3OrphanRoot = topologyRoot([
  "docs/settings/production.md",
  "docs/storylines/orphan.md",
]);
fs.writeFileSync(
  path.join(h3OrphanRoot, "docs/storylines/orphan.md"),
  "# Governed host\n\n### Orphan {#orphan}\n\n## Unit {#unit}\n\n#### Observation {#observation}\n",
  "utf8",
);
const missingH3Root = topologyRoot([
  "docs/settings/production.md",
  "docs/storylines/incomplete.md",
]);
fs.writeFileSync(
  path.join(missingH3Root, "docs/storylines/incomplete.md"),
  "# Governed host\n\n## Unit {#unit}\n",
  "utf8",
);
const missingH4Root = topologyRoot([
  "docs/settings/production.md",
  "docs/storylines/incomplete.md",
]);
fs.writeFileSync(
  path.join(missingH4Root, "docs/storylines/incomplete.md"),
  "# Governed host\n\n## Unit {#unit}\n\n### Child {#child}\n",
  "utf8",
);
const duplicateLayerRoot = topologyRoot([
  "docs/settings/production.md",
  "docs/storylines/first.md",
  "docs/storylines/second.md",
]);
const scenarioMismatchRoot = topologyRoot([
  "docs/settings/production.md",
  "docs/storylines/sequence.md",
  "docs/scenarios/sequence.md",
]);
fs.writeFileSync(
  path.join(scenarioMismatchRoot, "docs/scenarios/sequence.md"),
  "# Governed host\n\n## Unit {#unit}\n\n### Child {#different-child}\n\n#### Observation {#observation}\n",
  "utf8",
);
const lengthMismatchRoot = topologyRoot([
  "docs/settings/production.md",
  "docs/storylines/sequence.md",
  "docs/scenarios/sequence.md",
]);
fs.appendFileSync(
  path.join(lengthMismatchRoot, "docs/scenarios/sequence.md"),
  "\n## Additional {#additional}\n\n### Additional child {#additional-child}\n\n#### Additional observation {#additional-observation}\n",
  "utf8",
);
const modelOwnerlessRoot = topologyRoot([
  "docs/settings/production.md",
  "docs/models/model.md",
  "src/units/model.ts",
]);
fs.writeFileSync(
  path.join(modelOwnerlessRoot, "src/units/model.ts"),
  "// export class CommentModel {}\nexport const value = true;\n",
  "utf8",
);
const fullFilmRoot = topologyRoot([
  "docs/research/source.md",
  "docs/settings/nested/production.md",
  "docs/settings/z-direction.md",
  "docs/models/model.md",
  "docs/motions/motion.md",
  "docs/storylines/sequence.md",
  "docs/scenarios/sequence.md",
  "docs/script/sequence.md",
  "src/units/model.ts",
  "src/motions/motion.ts",
  "src/shots/sequence.ts",
  "src/production.ts",
  "src/film.ts",
]);
writeTopologyHost(
  fullFilmRoot,
  "docs/settings/nested/ignored.txt",
  "## Not governed",
);
writeTopologyHost(
  fullFilmRoot,
  "src/units/model.ts",
  [
    "/* export class BlockModel {} */",
    'const doubleText = "escaped \\\" export class DoubleModel {}";',
    "const singleText = 'escaped \\\' export class SingleModel {}';",
    "const templateText = `escaped \\` export class TemplateModel {}`;",
    "export default abstract class GovernedModel {}",
  ].join("\n"),
);
writeTopologyHost(
  fullFilmRoot,
  "src/motions/motion.ts",
  "export default async function governedMotion(): Promise<void> {}\n",
);
writeTopologyHost(
  fullFilmRoot,
  "src/shots/sequence.ts",
  "export let governedShot = true;\n",
);
const fullBriefRoot = topologyRoot([
  "docs/settings/production.md",
  "docs/models/model.md",
  "docs/motions/motion.md",
  "docs/briefs/delivery.md",
  "src/world/model.ts",
  "src/motions/motion.ts",
  "src/shots/delivery.ts",
  "src/production.ts",
  "src/film.ts",
]);
writeTopologyHost(
  fullBriefRoot,
  "src/world/model.ts",
  "export class GovernedWorld {}\n",
);
const researchOnlyRoot = topologyRoot(["docs/research/source.md"]);
const productionSourceMissingRoot = topologyRoot([
  "docs/settings/production.md",
]);
const filmSourceResidueRoot = topologyRoot(["src/film.ts"]);
const malformedContractRoot = topologyRoot([]);
writeTopologyHost(
  malformedContractRoot,
  "config/docs/principles/briefs.md",
  "# Reusable brief law without an anchored principle\n",
);
const ignoredHeadingRoot = topologyRoot(["docs/settings/production.md"]);
fs.appendFileSync(
  path.join(ignoredHeadingRoot, "docs/settings/production.md"),
  "\n### Documentation example without an anchor\n\n##### Too deep to govern\n\n##No heading\n\n~~~md\n~~~not-a-close\n## Fake without an anchor\n~~~~\n",
  "utf8",
);

try {
  const disabled = {
    location: emptyRoot,
    settings: "disabled",
    research: "disabled",
    models: "disabled",
    motions: "disabled",
    storylines: "disabled",
    scenarios: "disabled",
    script: "disabled",
    briefs: "disabled",
    modelSources: "disabled",
    motionSources: "disabled",
    shots: "disabled",
    productionSources: "disabled",
    filmSources: "disabled",
  } as const;
  assert.doesNotThrow(() =>
    createAutoMovieEvidenceConfig({ ...disabled, kind: "library" }),
  );
  const fullFilmGraph = createAutoMovieEvidenceConfig({
    ...disabled,
    location: fullFilmRoot,
    kind: "film",
    research: "review",
    settings: "review",
    models: "review",
    motions: "review",
    storylines: "review",
    scenarios: "review",
    script: "review",
    modelSources: "review",
    motionSources: "review",
    shots: "review",
    productionSources: "review",
    filmSources: "review",
  });
  assert.ok(
    fullFilmGraph.claims.some(
      (claim) =>
        claim.name ===
          "active research units support downstream authored decisions" &&
        Array.isArray(claim.reference) &&
        claim.reference.length === 1 &&
        claim.reference.every(
          (reference) => reference.noEvidenceExclude === true,
        ),
    ),
  );
  for (const name of [
    "model source realizes every model design unit and source principle",
    "motion source realizes every motion unit and source principle",
  ]) {
    const claim = fullFilmGraph.claims.find(
      (candidate) => candidate.name === name,
    );
    assert.ok(claim !== undefined && Array.isArray(claim.reference));
    assert.ok(
      claim.reference
        .filter((reference) => "root" in reference && reference.root === "docs")
        .every((reference) => reference.noEvidenceExclude === true),
    );
  }
  for (const name of [
    "production source serializes settings and production-source principles",
    "film source assembles screenplay or brief units and film-source principles",
  ])
    assert.ok(
      fullFilmGraph.claims.some((claim) => claim.name === name),
      `The full film graph must include ${name}.`,
    );
  assert.doesNotThrow(() =>
    createAutoMovieEvidenceConfig({
      ...disabled,
      location: fullBriefRoot,
      kind: "brief",
      settings: "review",
      models: "review",
      motions: "review",
      briefs: "review",
      modelSources: "review",
      motionSources: "review",
      shots: "review",
      productionSources: "review",
      filmSources: "review",
    }),
  );
  assert.throws(
    () =>
      createAutoMovieEvidenceConfig({
        ...disabled,
        location: malformedContractRoot,
        kind: "library",
      }),
    /config\/docs\/principles\/briefs\.md belongs to an active layer but has no H2 unit/,
  );
  assert.doesNotThrow(() =>
    createAutoMovieEvidenceConfig({
      ...disabled,
      location: researchOnlyRoot,
      kind: "library",
      research: "evidence",
    }),
  );
  assert.doesNotThrow(() =>
    createAutoMovieEvidenceConfig({
      ...disabled,
      location: ignoredHeadingRoot,
      kind: "library",
      settings: "evidence",
    }),
  );
  const directBriefGraph = createAutoMovieEvidenceConfig({
    ...disabled,
    location: briefRoot,
    kind: "brief",
    settings: "review",
    briefs: "review",
    shots: "evidence",
  });
  const directBriefH2 = directBriefGraph.claims.find(
    (claim) =>
      claim.name ===
      "brief H2 units account for settings and active design branches",
  );
  assert.ok(
    directBriefH2 !== undefined && Array.isArray(directBriefH2.reference),
  );
  assert.ok(
    directBriefH2.reference.every(
      (reference) =>
        reference.type !== "markdown" ||
        reference.files.every((file) => file.startsWith("settings/")),
    ),
    "A brief with disabled model and motion branches must not cite their resident starter documents.",
  );
  assert.doesNotThrow(() =>
    createAutoMovieEvidenceConfig({
      ...disabled,
      location: filmRoot,
      kind: "film",
      settings: "review",
      storylines: "review",
      scenarios: "review",
      script: "review",
      shots: "evidence",
    }),
  );
  assert.throws(
    () =>
      createAutoMovieEvidenceConfig({
        ...disabled,
        kind: "film",
        briefs: "evidence",
      }),
    /film cannot activate the direct-brief layer/,
  );
  assert.throws(
    () =>
      createAutoMovieEvidenceConfig({
        ...disabled,
        kind: "brief",
        settings: "review",
        storylines: "evidence",
      }),
    /direct brief cannot activate/,
  );
  assert.throws(
    () =>
      createAutoMovieEvidenceConfig({
        ...disabled,
        kind: "film",
        settings: "review",
        storylines: "evidence",
        scenarios: "evidence",
      }),
    /scenarios cannot enter evidence before storylines is in review/,
  );
  assert.throws(
    () =>
      createAutoMovieEvidenceConfig({
        ...disabled,
        kind: "brief",
        settings: "review",
        briefs: "evidence",
        shots: "evidence",
      }),
    /shots cannot enter evidence before briefs is in review/,
  );
  assert.throws(
    () =>
      createAutoMovieEvidenceConfig({
        ...disabled,
        kind: "brief",
        settings: "review",
        models: "review",
        briefs: "review",
        modelSources: "evidence",
        shots: "evidence",
      }),
    /shots cannot enter evidence before modelSources is in review/,
  );
  assert.throws(
    () =>
      createAutoMovieEvidenceConfig({
        ...disabled,
        kind: "brief",
        settings: "review",
        models: "review",
        motions: "review",
        briefs: "review",
        modelSources: "review",
        motionSources: "evidence",
        shots: "evidence",
      }),
    /shots cannot enter evidence before motionSources is in review/,
  );
  assert.throws(
    () =>
      createAutoMovieEvidenceConfig({
        ...disabled,
        kind: "library",
        shots: "evidence",
      }),
    /library cannot activate narrative, brief, shot, or film-source layers/,
  );
  assert.throws(
    () =>
      createAutoMovieEvidenceConfig({
        ...disabled,
        kind: "library",
        filmSources: "evidence",
      }),
    /library cannot activate narrative, brief, shot, or film-source layers/,
  );
  assert.throws(
    () =>
      createAutoMovieEvidenceConfig({
        ...disabled,
        kind: "film",
        settings: "evidence",
        productionSources: "evidence",
      }),
    /productionSources cannot enter evidence before settings is in review/,
  );
  assert.throws(
    () =>
      createAutoMovieEvidenceConfig({
        ...disabled,
        location: productionSourceMissingRoot,
        kind: "library",
        settings: "review",
        productionSources: "evidence",
      }),
    /productionSources cannot enter evidence without a governed \.ts host/,
  );
  assert.throws(
    () =>
      createAutoMovieEvidenceConfig({
        ...disabled,
        location: filmSourceResidueRoot,
        kind: "library",
      }),
    /filmSources is disabled but governed host files remain: src\/film\.ts/,
  );
  assert.throws(
    () =>
      createAutoMovieEvidenceConfig({
        ...disabled,
        location: filmRoot,
        kind: "film",
        settings: "review",
        storylines: "review",
        scenarios: "review",
        script: "review",
        productionSources: "review",
        shots: "evidence",
        filmSources: "evidence",
      }),
    /filmSources cannot enter evidence before shots is in review/,
  );
  assert.throws(
    () =>
      createAutoMovieEvidenceConfig({
        ...disabled,
        location: fullFilmRoot,
        kind: "film",
        settings: "review",
        storylines: "review",
        scenarios: "review",
        script: "review",
        shots: "review",
        productionSources: "evidence",
        filmSources: "evidence",
      }),
    /filmSources cannot enter evidence before productionSources is in review/,
  );
  assert.throws(
    () =>
      createAutoMovieEvidenceConfig({
        ...disabled,
        kind: "film",
        models: "evidence",
      }),
    /models cannot enter evidence before settings is in review/,
  );
  assert.throws(
    () =>
      createAutoMovieEvidenceConfig({
        ...disabled,
        kind: "film",
        settings: "review",
        models: "review",
        motions: "evidence",
        motionSources: "evidence",
      }),
    /motionSources cannot enter evidence before motions is in review/,
  );
  assert.throws(
    () =>
      createAutoMovieEvidenceConfig({
        ...disabled,
        kind: "film",
        research: "evidence",
        settings: "evidence",
      }),
    /settings cannot enter evidence before research is in review/,
  );
  assert.doesNotThrow(() =>
    createAutoMovieEvidenceConfig({
      ...disabled,
      location: researchRoot,
      kind: "film",
      research: "review",
      settings: "evidence",
    }),
  );
  assert.throws(
    () =>
      createAutoMovieEvidenceConfig({
        ...disabled,
        location: residueRoot,
        kind: "library",
      }),
    /models is disabled but governed host files remain/,
  );
  assert.throws(
    () =>
      createAutoMovieEvidenceConfig({
        ...disabled,
        kind: "film",
        settings: "evidence",
      }),
    /settings cannot enter evidence without a governed \.md host/,
  );
  assert.throws(
    () =>
      createAutoMovieEvidenceConfig({
        ...disabled,
        location: headinglessRoot,
        kind: "film",
        settings: "evidence",
      }),
    /belongs to an active layer but has no H2 unit/,
  );
  assert.throws(
    () =>
      createAutoMovieEvidenceConfig({
        ...disabled,
        location: ownerlessRoot,
        kind: "brief",
        settings: "review",
        briefs: "review",
        shots: "evidence",
      }),
    /src\/shots\/ownerless\.ts belongs to active shots but has no named exported function or property owner/,
  );
  assert.throws(
    () =>
      createAutoMovieEvidenceConfig({
        ...disabled,
        location: modelOwnerlessRoot,
        kind: "library",
        settings: "review",
        models: "review",
        modelSources: "evidence",
      }),
    /src\/units\/model\.ts belongs to active modelSources but has no named exported class owner/,
  );
  assert.throws(
    () =>
      createAutoMovieEvidenceConfig({
        ...disabled,
        location: identityMismatchRoot,
        kind: "film",
        settings: "review",
        storylines: "review",
        scenarios: "review",
        script: "evidence",
      }),
    /script heading identities must exactly preserve scenarios identity and order/,
  );
  assert.throws(
    () =>
      createAutoMovieEvidenceConfig({
        ...disabled,
        location: scenarioMismatchRoot,
        kind: "film",
        settings: "review",
        storylines: "review",
        scenarios: "evidence",
      }),
    /scenarios heading identities must exactly preserve storylines identity and order/,
  );
  assert.throws(
    () =>
      createAutoMovieEvidenceConfig({
        ...disabled,
        location: lengthMismatchRoot,
        kind: "film",
        settings: "review",
        storylines: "review",
        scenarios: "evidence",
      }),
    /scenarios heading identities must exactly preserve storylines identity and order/,
  );
  assert.throws(
    () =>
      createAutoMovieEvidenceConfig({
        ...disabled,
        location: unanchoredRoot,
        kind: "library",
        settings: "evidence",
      }),
    /active H2 unit without an explicit \{#anchor\}/,
  );
  assert.doesNotThrow(() =>
    createAutoMovieEvidenceConfig({
      ...disabled,
      location: fencedRoot,
      kind: "library",
      settings: "evidence",
    }),
  );
  assert.throws(
    () =>
      createAutoMovieEvidenceConfig({
        ...disabled,
        location: commentedRoot,
        kind: "library",
        settings: "evidence",
      }),
    /belongs to an active layer but has no H2 unit/,
  );
  assert.throws(
    () =>
      createAutoMovieEvidenceConfig({
        ...disabled,
        location: duplicateAnchorRoot,
        kind: "library",
        settings: "evidence",
      }),
    /repeats explicit heading anchor #same-unit/,
  );
  assert.throws(
    () =>
      createAutoMovieEvidenceConfig({
        ...disabled,
        location: duplicateLayerRoot,
        kind: "film",
        settings: "review",
        storylines: "evidence",
      }),
    /storylines declares duplicate heading identity #unit/,
  );
  assert.throws(
    () =>
      createAutoMovieEvidenceConfig({
        ...disabled,
        location: orphanRoot,
        kind: "film",
        settings: "review",
        storylines: "evidence",
      }),
    /H4 unit before its H2\/H3 parents/,
  );
  assert.throws(
    () =>
      createAutoMovieEvidenceConfig({
        ...disabled,
        location: h3OrphanRoot,
        kind: "film",
        settings: "review",
        storylines: "evidence",
      }),
    /H3 unit before any H2 parent/,
  );
  assert.throws(
    () =>
      createAutoMovieEvidenceConfig({
        ...disabled,
        location: missingH3Root,
        kind: "film",
        settings: "review",
        storylines: "evidence",
      }),
    /has no H3 unit/,
  );
  assert.throws(
    () =>
      createAutoMovieEvidenceConfig({
        ...disabled,
        location: missingH4Root,
        kind: "film",
        settings: "review",
        storylines: "evidence",
      }),
    /has no H4 unit/,
  );
} finally {
  for (const root of topologyRoots)
    fs.rmSync(root, { force: true, recursive: true });
}
process.stdout.write("evidence topologies and stage order: ok\n");
