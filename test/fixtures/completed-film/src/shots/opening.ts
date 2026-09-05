import { defineShot } from "@automovie/engine";
import type {
  IAutoMovieAcceptanceScenario,
  IAutoMovieDefinedShotContract,
  IAutoMovieProductionShotProgram,
  IAutoMovieShotBuildContext,
} from "@automovie/interface";

import { chorus } from "../formations/chorus";
import { SOLOIST_CUE_ABDUCTION } from "../motions/soloistCue";
import { gate } from "../objects/gate";
import { soloist } from "../units/soloist";
import { plaza } from "../world/plaza";

const OPENING_CONTRACT: IAutoMovieDefinedShotContract = {
  beat: "cue",
  evidence: [
    {
      reason: "This shot realizes the screenplay's visible cue action.",
      scene: "SCN-001",
      claim: "cue-arm-readable",
    },
  ],
  durationSeconds: 6,
  participants: [
    { kind: "actor", id: "soloist" },
    { kind: "formation", id: "chorus" },
  ],
  opening: [
    {
      id: "arm-lowered",
      description: "The soloist begins in a readable neutral stance.",
      predicates: [
        {
          kind: "joint-angle",
          actor: "soloist",
          bone: "leftUpperArm",
          axis: "abduction",
          operator: "==",
          value: 0,
          tolerance: 0.001,
        },
      ],
    },
  ],
  closing: [
    {
      id: "cue-held",
      description: "The raised hand holds the cue at the final frame.",
      predicates: [
        {
          kind: "joint-angle",
          actor: "soloist",
          bone: "leftUpperArm",
          axis: "abduction",
          operator: ">=",
          value: 100,
          tolerance: 0.001,
        },
      ],
    },
  ],
  camera: {
    intent:
      "A full-body three-quarter view proves silhouette and pose-pass wiring.",
    requiredSubjects: ["soloist", "chorus"],
    maxOcclusionRatio: 0.05,
  },
  events: [
    {
      id: "cue-raised",
      kind: "reveal",
      window: { from: 1.5, to: 3 },
      subjects: ["soloist"],
      predicates: [
        {
          kind: "joint-angle",
          actor: "soloist",
          bone: "leftUpperArm",
          axis: "abduction",
          operator: ">=",
          value: 100,
          tolerance: 0.001,
        },
      ],
    },
  ],
  reviewFrames: [
    {
      id: "cue-apex",
      time: 2,
      passes: ["beauty", "mask", "pose"],
    },
  ],
};

const ANSWER_CONTRACT: IAutoMovieDefinedShotContract = {
  beat: "answer",
  evidence: [
    {
      reason:
        "This shot holds the completed answer while its terminal gate insert makes the shut boundary readable.",
      scene: "SCN-002",
    },
  ],
  durationSeconds: 6,
  participants: [
    { kind: "actor", id: "soloist" },
    { kind: "formation", id: "chorus" },
  ],
  opening: [
    {
      id: "cue-carried",
      description:
        "The answering shot independently carries the established raised cue into the gate insert.",
      predicates: [
        {
          kind: "joint-angle",
          actor: "soloist",
          bone: "leftUpperArm",
          axis: "abduction",
          operator: ">=",
          value: 100,
          tolerance: 0.001,
        },
      ],
    },
  ],
  closing: [
    {
      id: "answer-held",
      description:
        "The cue remains held through the insert even after it leaves the frame.",
      predicates: [
        {
          kind: "joint-angle",
          actor: "soloist",
          bone: "leftUpperArm",
          axis: "abduction",
          operator: ">=",
          value: 100,
          tolerance: 0.001,
        },
      ],
    },
  ],
  camera: {
    intent:
      "A wide terminal insert faces the shut gate along its clear far-edge sightline; the compiled cue and chorus holds continue off-screen.",
    requiredSubjects: ["plaza-gate"],
    maxOcclusionRatio: 0.05,
  },
  events: [
    {
      id: "cue-answered",
      kind: "reveal",
      window: { from: 3, to: 5 },
      subjects: ["soloist"],
      predicates: [
        {
          kind: "joint-angle",
          actor: "soloist",
          bone: "leftUpperArm",
          axis: "abduction",
          operator: ">=",
          value: 100,
          tolerance: 0.001,
        },
      ],
    },
  ],
  reviewFrames: [
    {
      id: "shut-gate",
      time: 4,
      passes: ["beauty", "mask"],
    },
  ],
};

const buildCue = (
  context: IAutoMovieShotBuildContext,
  props: {
    openingAbduction: number;
    chorusMotion: "advance" | "hold";
    includeGate: boolean;
  },
): IAutoMovieProductionShotProgram => {
  // The soloist owns its own rig lookup, its raise-and-hold, and what it
  // stages. This shot states the beat and the frame; it does not rebuild the
  // figure.
  const performer = soloist.render(context, { from: props.openingAbduction });
  const fixture = props.includeGate ? gate.render(context) : {};
  const framing = props.includeGate ? "wide" : "full";
  const gatePosition = props.includeGate ? gate.position(context) : null;
  const cameraTarget = props.includeGate ? gate.id : "soloist";
  const sceneId = `${context.contract.id}-scene`;
  return {
    actors: [...performer.actors!],
    props: [...(fixture.props ?? [])],
    script: {
      logline: "A soloist raises a hand and the plaza answers.",
      theme: "one readable gesture changes the plaza",
      cast: [
        {
          node: "soloist",
          character: "the soloist",
          modelRef: soloist.modelRef(context),
        },
      ],
      beats: [
        {
          id: context.contract.beat,
          name: context.contract.beat,
          summary: "the soloist holds the authored cue",
          durationHint: context.contract.durationSeconds,
        },
      ],
    },
    stage: {
      scene: { id: sceneId, name: "starter plaza ground" },
      plan:
        framing === "wide"
          ? "The fixed terminal insert faces the shut gate from its clear sightline while the held chorus remains peripheral context."
          : "The soloist stands centered while a fixed camera reads the hand.",
      actors: [
        {
          node: "soloist",
          position: { x: 0, y: 0, z: 0 },
          facingDeg: 0,
        },
      ],
      set: [...(fixture.set ?? [])],
      cameras: [
        {
          node: "camera",
          position:
            gatePosition === null
              ? { x: 0, y: 1.35, z: 4.8 }
              : {
                  x: gatePosition.x + gate.height() * 4,
                  y: gate.height() / 2,
                  z: gatePosition.z + gate.height() * 4,
                },
          lookAt: { kind: "node", node: cameraTarget },
          fovDeg: 38,
          near: 0.1,
          far: 1000,
          depthPrecision: {
            minimumDepthBits: 24,
            maximumStepMeters: 0.6,
          },
        },
      ],
      lights: [
        {
          node: "sun",
          role: "sun",
          direction: { x: -0.4, y: -1, z: -0.6 },
          color: { r: 1, g: 0.92, b: 0.8, a: null, hex: "#fff5df" },
          intensity: 2.5,
        },
      ],
      // The world owns its ground, and the ground derives its extent from the
      // group standing on it. A polygon spelled out here would be a second
      // plaza, and it is the one the viewer draws.
      space: plaza.space(),
    },
    blocking: {
      beat: context.contract.beat,
      analysis: props.includeGate
        ? "The shut leaf and fixed post must separate against open background."
        : "The cueing arm and whole silhouette must remain readable.",
      rationale:
        framing === "wide"
          ? "The terminal insert gives the small far-edge gate its own readable image scale instead of pretending it can share the formation's widest view."
          : "One fixed full-body view proves the authored pose.",
      actors: [{ node: "soloist", beats: "raises and holds the cueing arm" }],
      camera: {
        framing,
        move: "static",
        on: { kind: "node", node: cameraTarget },
      },
      duration: context.contract.durationSeconds,
    },
    performance: {
      beat: context.contract.beat,
      plan: "Execute the source-computed cue clip under engine ROM gates.",
      draft: [
        {
          verb: "enact",
          actor: "soloist",
          start: 0,
          duration: context.contract.durationSeconds,
          clip: performer.clips![0]!.id,
        },
        // The action, not the staged position, is what the frame renders from.
        // Staging above chose the side the lens watches from; this keeps that
        // bearing and solves the distance from `framing` and the subject, so
        // the stand-off written there is an input rather than the result. The
        // realization records the placement it measured whenever a shot
        // compiles a move; read that, not the staged transform, when a frame is
        // not what was expected.
        {
          verb: "frame",
          actor: "camera",
          start: 0,
          duration: "auto",
          framing,
          move: "static",
          on: { kind: "node", node: cameraTarget },
        },
      ],
      revise: {
        review: props.includeGate
          ? "The shut leaf and fixed post read clearly while the cue and formation remain compiled holds."
          : "The cue is readable and remains held at the final frame.",
        final: null,
      },
      duration: context.contract.durationSeconds,
    },
    eventSamples: context.contract.events.map((event) => ({
      id: event.id,
      time: (event.window.from + event.window.to) / 2,
    })),
    clips: [...performer.clips!],
    formationMotions: context.contract.participants.some(
      (participant) =>
        participant.kind === "formation" && participant.id === chorus.id,
    )
      ? // The group owns its own advance. Spelling the cue out here loosened
        // the intervals by five percent and turned the rows four degrees,
        // which `docs/settings/020-chorus.md` permits only as an authored
        // dramatic event, and `Chorus.break` is what authors one.
        props.chorusMotion === "advance"
        ? [
            chorus.advance({
              id: `${context.contract.id}-chorus-advance`,
              start: 0,
              end: context.contract.reviewFrames[0]!.time,
            }),
            chorus.hold({
              id: `${context.contract.id}-chorus-hold`,
              start: context.contract.reviewFrames[0]!.time,
              end: context.contract.durationSeconds,
            }),
          ]
        : [
            chorus.hold({
              id: `${context.contract.id}-chorus-hold`,
              start: 0,
              end: context.contract.durationSeconds,
            }),
          ]
      : [],
    effectCues:
      context.world.effectZones.some((zone) => zone.id === "plaza-haze") &&
      context.contract.events.some((event) => event.id === "cue-raised")
        ? [
            {
              id: `${context.contract.id}-plaza-haze`,
              zone: "plaza-haze",
              start: 0,
              end: context.contract.durationSeconds,
              intensity: { from: 0.35, to: 0.35 },
              event: "cue-raised",
            },
          ]
        : [],
  };
};

/**
 * Opening source proves a neutral-to-raised transition.
 *
 * @evidence screenplays/001-cue/001-cue.md#scn-001 Realizes SCN-001's local six-second
 *   raised-hand, ordered-advance, bounded-haze, and terminal-hold image.
 * @evidenceReview screenplays/001-cue/001-cue.md#scn-001 #e482bce Read screenplays/001-cue/001-cue.md#scn-001 and opening in src/shots/opening.ts; confirmed this citation after checking the claim that realizes SCN-001's local six-second raised-hand, ordered-advance, constant bounded-haze, and terminal-hold image while leaving its caption to film source.
 * @evidence obligations/delivery/shots.md#contract-only-composition Composes reviewed
 *   subject, world, and motion owners without inventing a story or path.
 * @evidenceReview obligations/delivery/shots.md#contract-only-composition #70b20d3 Read obligations/delivery/shots.md#contract-only-composition and opening in src/shots/opening.ts; confirmed this citation after checking the claim that composes only the local visual portion from reviewed subject, world, and motion owners and leaves captions and edit transitions to film source.
 * @evidence obligations/delivery/shots.md#explicit-inputs-and-time Reads only compile
 *   context and authored seconds, then delegates model and motion evaluation.
 * @evidenceReview obligations/delivery/shots.md#explicit-inputs-and-time #7941a62 Read obligations/delivery/shots.md#explicit-inputs-and-time and opening in src/shots/opening.ts; confirmed this citation after checking the claim that reads only compile context and authored seconds, then delegates model and motion evaluation.
 * @evidence obligations/delivery/shots.md#acceptance-travels-with-delivery Ships named
 *   review frames and acceptance scenarios beside the opening delivery.
 * @evidenceReview obligations/delivery/shots.md#acceptance-travels-with-delivery #b6230bb Read obligations/delivery/shots.md#acceptance-travels-with-delivery and opening in src/shots/opening.ts; confirmed this citation after checking the claim that ships named review frames and acceptance scenarios beside the opening delivery.
 * @evidence principles/core/source-units.md#source-scope-preservation opening keeps responsibility for the exported opening source owner and its declared value or behavior in this declaration; the implementation fragment defineShot("opening", { scene: "opening-scene", contract: OPENING_CONTRACT, build: (context: IAutoMovieShotBuildContext) => buildCue(context, { openingAbduction: 0 introduces no second creative owner.
 * @evidenceReview principles/core/source-units.md#source-scope-preservation #e4bc845 I compared the complete opening declaration and implementation with the exact screenplay scenes, source interfaces, camera, timing, and acceptance predicates; the implemented value, branches, and source-local calls stay inside that named responsibility and leave none of its cited behavior unpaid.
 * @evidence principles/core/source-units.md#source-substantive-completion opening is a usable source artifact for the exported opening source owner and its declared value or behavior; it is implemented directly as defineShot("opening", { scene: "opening-scene", contract: OPENING_CONTRACT, build: (context: IAutoMovieShotBuildContext) => buildCue(context, { openingAbduction: 0 rather than as a placeholder or future-work wrapper.
 * @evidenceReview principles/core/source-units.md#source-substantive-completion #e9c974f I traced the applicable opening signature, initializer, type surface, branches, returns, and failures; together they provide a complete deterministic value or operation that its consumer can use without inventing another boundary.
 * @evidenceExclude upstream/delivery/shots.md#parent-revision-from-shot-work Implementing opening tested the exact screenplay scenes, source interfaces, camera, timing, and acceptance predicates through the exported opening source owner and its declared value or behavior; the implementation fragment defineShot("opening", { scene: "opening-scene", contract: OPENING_CONTRACT, build: (context: IAutoMovieShotBuildContext) => buildCue(context, { openingAbduction: 0 shows the authored inputs, interfaces, limits, and result were sufficient, so source work exposed no upstream defect.
 * @evidenceExcludeReview upstream/delivery/shots.md#parent-revision-from-shot-work #445ed4e I compared the complete opening implementation with its actual reviewed parent, including its applicable inputs, derived values, boundary behavior, and returned state; it required no code-local repair to the parent decision.
 */
export const opening = defineShot("opening", {
  scene: "opening-scene",
  contract: OPENING_CONTRACT,
  build: (context: IAutoMovieShotBuildContext) =>
    buildCue(context, {
      openingAbduction: 0,
      chorusMotion: "advance",
      includeGate: false,
    }),
});

/**
 * Answer source begins from the raised state established by the first shot.
 *
 * @evidence screenplays/002-answer/001-answer.md#scn-002 Realizes SCN-002's local six-second
 *   raised-hand hold, translated-formation hold, and shut-gate state.
 * @evidenceReview screenplays/002-answer/001-answer.md#scn-002 #8297a69 Read screenplays/002-answer/001-answer.md#scn-002 and answer in src/shots/opening.ts; confirmed this citation after checking the claim that realizes SCN-002's local six-second raised-hand hold, translated-formation hold, and shut-gate state.
 * @evidence obligations/delivery/shots.md#contract-only-composition Reuses the reviewed
 *   cue, formation hold, gate, and plaza without inventing a new event.
 * @evidenceReview obligations/delivery/shots.md#contract-only-composition #70b20d3 Read obligations/delivery/shots.md#contract-only-composition and answer in src/shots/opening.ts; confirmed this citation after checking the claim that reuses the reviewed cue, formation hold, gate, and plaza for one local image without inventing an event or edit.
 * @evidence obligations/delivery/shots.md#explicit-inputs-and-time Reads only compile
 *   context and exact contract seconds, with no hidden prior shot state.
 * @evidenceReview obligations/delivery/shots.md#explicit-inputs-and-time #7941a62 Read obligations/delivery/shots.md#explicit-inputs-and-time and answer in src/shots/opening.ts; confirmed this citation after checking the claim that reads only compile context and exact contract seconds, with no hidden prior shot state.
 * @evidence obligations/delivery/shots.md#acceptance-travels-with-delivery Ships its own
 *   gate review frame and compiled held-state acceptance beside the shot.
 * @evidenceReview obligations/delivery/shots.md#acceptance-travels-with-delivery #b6230bb Read obligations/delivery/shots.md#acceptance-travels-with-delivery and answer in src/shots/opening.ts; confirmed this citation after checking the claim that ships its own answer review frame and acceptance conditions beside the shot.
 * @evidence principles/core/source-units.md#source-scope-preservation answer keeps responsibility for the exported answer source owner and its declared value or behavior in this declaration; the implementation fragment defineShot("answer", { scene: "answer-scene", contract: ANSWER_CONTRACT, build: (context: IAutoMovieShotBuildContext) => buildCue(context, { openingAbduction introduces no second creative owner.
 * @evidenceReview principles/core/source-units.md#source-scope-preservation #e4bc845 I compared the complete answer declaration and implementation with the exact screenplay scenes, source interfaces, camera, timing, and acceptance predicates; the implemented value, branches, and source-local calls stay inside that named responsibility and leave none of its cited behavior unpaid.
 * @evidence principles/core/source-units.md#source-substantive-completion answer is a usable source artifact for the exported answer source owner and its declared value or behavior; it is implemented directly as defineShot("answer", { scene: "answer-scene", contract: ANSWER_CONTRACT, build: (context: IAutoMovieShotBuildContext) => buildCue(context, { openingAbduction rather than as a placeholder or future-work wrapper.
 * @evidenceReview principles/core/source-units.md#source-substantive-completion #e9c974f I traced the applicable answer signature, initializer, type surface, branches, returns, and failures; together they provide a complete deterministic value or operation that its consumer can use without inventing another boundary.
 * @evidenceExclude upstream/delivery/shots.md#parent-revision-from-shot-work Implementing answer tested the exact screenplay scenes, source interfaces, camera, timing, and acceptance predicates through the exported answer source owner and its declared value or behavior; the implementation fragment defineShot("answer", { scene: "answer-scene", contract: ANSWER_CONTRACT, build: (context: IAutoMovieShotBuildContext) => buildCue(context, { openingAbduction shows the authored inputs, interfaces, limits, and result were sufficient, so source work exposed no upstream defect.
 * @evidenceExcludeReview upstream/delivery/shots.md#parent-revision-from-shot-work #445ed4e I compared the complete answer implementation with its actual reviewed parent, including its applicable inputs, derived values, boundary behavior, and returned state; it required no code-local repair to the parent decision.
 */
export const answer = defineShot("answer", {
  scene: "answer-scene",
  contract: ANSWER_CONTRACT,
  build: (context: IAutoMovieShotBuildContext) =>
    buildCue(context, {
      openingAbduction: SOLOIST_CUE_ABDUCTION,
      chorusMotion: "hold",
      includeGate: true,
    }),
});

/**
 * What the opening shot's frames have to show before it is accepted.
 *
 * A scenario lives beside the contract it measures because it cannot be written
 * without it: the frame it inspects is one of the contract's own review frames,
 * and naming that id from anywhere else would be a second chance to name a
 * frame the shot never renders. The shot and the frame are therefore read from
 * the registration above; only the pass and the observable expectation are
 * authored, because which pass proves a claim, and what "proved" looks like in
 * it, is a judgement no contract field contains.
 *
 * @evidence screenplays/001-cue/001-cue.md#scn-001 Verifies the opening scene against its
 *   own declared beauty, effect-mask, and pose observations.
 * @evidenceReview screenplays/001-cue/001-cue.md#scn-001 #e482bce Read screenplays/001-cue/001-cue.md#scn-001 and openingAcceptance in src/shots/opening.ts; confirmed this citation after checking the claim that verifies the opening scene's local visual portion against its declared beauty, effect-mask, and pose observations while caption verification remains a film deliverable concern.
 * @evidence obligations/delivery/shots.md#acceptance-travels-with-delivery Places the
 *   opening beauty, haze-mask, and raised-arm pose checks beside their shot.
 * @evidenceReview obligations/delivery/shots.md#acceptance-travels-with-delivery #b6230bb Read obligations/delivery/shots.md#acceptance-travels-with-delivery and openingAcceptance in src/shots/opening.ts; confirmed that the opening beauty, bounded-haze mask, and raised-arm pose checks each name their owning review frame and falsifying expectation beside the shot.
 * @evidence principles/core/source-units.md#source-scope-preservation openingAcceptance keeps responsibility for the exported openingAcceptance source owner and its declared value or behavior in this declaration; the implementation fragment [ { id: '${opening.id}-beauty', evidence: [ { reason: "Beauty evidence verifies that the cue scene remains visually readable.", scene: "SCN-001", }, ], target: { kind: "shot" introduces no second creative owner.
 * @evidenceReview principles/core/source-units.md#source-scope-preservation #e4bc845 I compared the complete openingAcceptance declaration and implementation with the exact screenplay scenes, source interfaces, camera, timing, and acceptance predicates; the implemented value, branches, and source-local calls stay inside that named responsibility and leave none of its cited behavior unpaid.
 * @evidence principles/core/source-units.md#source-substantive-completion openingAcceptance is a usable source artifact for the exported openingAcceptance source owner and its declared value or behavior; it is implemented directly as [ { id: '${opening.id}-beauty', evidence: [ { reason: "Beauty evidence verifies that the cue scene remains visually readable.", scene: "SCN-001", }, ], target: { kind: "shot" rather than as a placeholder or future-work wrapper.
 * @evidenceReview principles/core/source-units.md#source-substantive-completion #e9c974f I traced the applicable openingAcceptance signature, initializer, type surface, branches, returns, and failures; together they provide a complete deterministic value or operation that its consumer can use without inventing another boundary.
 * @evidenceExclude upstream/delivery/shots.md#parent-revision-from-shot-work Implementing openingAcceptance tested the exact screenplay scenes, source interfaces, camera, timing, and acceptance predicates through the exported openingAcceptance source owner and its declared value or behavior; the implementation fragment [ { id: '${opening.id}-beauty', evidence: [ { reason: "Beauty evidence verifies that the cue scene remains visually readable.", scene: "SCN-001", }, ], target: { kind: "shot" shows the authored inputs, interfaces, limits, and result were sufficient, so source work exposed no upstream defect.
 * @evidenceExcludeReview upstream/delivery/shots.md#parent-revision-from-shot-work #445ed4e I compared the complete openingAcceptance implementation with its actual reviewed parent, including its applicable inputs, derived values, boundary behavior, and returned state; it required no code-local repair to the parent decision.
 */
export const openingAcceptance: IAutoMovieAcceptanceScenario[] = [
  {
    id: `${opening.id}-beauty`,
    evidence: [
      {
        reason:
          "Beauty evidence verifies that the cue scene remains visually readable.",
        scene: "SCN-001",
      },
    ],
    target: { kind: "shot", id: opening.id },
    criterion: {
      kind: "frame",
      frame: OPENING_CONTRACT.reviewFrames[0]!.id,
      pass: "beauty",
      expectation:
        "The full soloist, the raised hand, the promoted formation heroes, and the bounded plaza haze remain readable against the background.",
    },
    required: true,
  },
  {
    id: `${opening.id}-effect-mask`,
    evidence: [
      {
        reason: "The effect mask verifies the cue scene's bounded visual cue.",
        scene: "SCN-001",
      },
    ],
    target: { kind: "shot", id: opening.id },
    criterion: {
      kind: "frame",
      frame: OPENING_CONTRACT.reviewFrames[0]!.id,
      pass: "mask",
      expectation:
        "The active plaza haze has visible bounded structural coverage without obscuring the soloist or the promoted formation heroes.",
    },
    required: true,
  },
  {
    id: `${opening.id}-pose`,
    evidence: [
      {
        reason:
          "The pose frame is the owning visual proof for the raised-hand continuity claim.",
        scene: "SCN-001",
        claim: "cue-arm-readable",
      },
    ],
    target: { kind: "shot", id: opening.id },
    criterion: {
      kind: "frame",
      frame: OPENING_CONTRACT.reviewFrames[0]!.id,
      pass: "pose",
      expectation:
        "The hips-to-head and raised-arm bone chains are visible in the pose pass.",
    },
    required: true,
  },
];

/**
 * What the answering shot's frames have to show before it is accepted.
 *
 * The second shot proves itself. A scenario that pointed back at the opening
 * shot's frames would accept an insert nobody rendered, which is why the visual
 * criterion names this shot's gate frame. The held cue is a different kind of
 * fact: its own event realization measures the current shot's source state
 * without pretending an off-screen arm appears in the gate image.
 *
 * @evidence screenplays/002-answer/001-answer.md#scn-002 Verifies the answering scene against
 *   its own declared gate images and compiled held-cue observation.
 * @evidenceReview screenplays/002-answer/001-answer.md#scn-002 #8297a69 Read screenplays/002-answer/001-answer.md#scn-002 and answerAcceptance in src/shots/opening.ts; confirmed this citation after checking the claim that verifies the answering scene against its own declared gate beauty and mask images and compiled held-cue observation.
 * @evidence obligations/delivery/shots.md#acceptance-travels-with-delivery Places the
 *   answer beauty, held-cue event, and shut-gate mask checks beside their shot.
 * @evidenceReview obligations/delivery/shots.md#acceptance-travels-with-delivery #b6230bb Read obligations/delivery/shots.md#acceptance-travels-with-delivery and answerAcceptance in src/shots/opening.ts; confirmed that the answer beauty, compiled held-cue event, and shut-gate mask checks each name their owning sample and falsifying expectation beside the shot.
 * @evidence principles/core/source-units.md#source-scope-preservation answerAcceptance keeps responsibility for the exported answerAcceptance source owner and its declared value or behavior in this declaration; the implementation fragment [ { id: '${answer.id}-beauty', evidence: [ { reason: "Beauty evidence verifies that the answering scene reads as a consequence.", scene: "SCN-002", }, ], target: { kind introduces no second creative owner.
 * @evidenceReview principles/core/source-units.md#source-scope-preservation #e4bc845 I compared the complete answerAcceptance declaration and implementation with the exact screenplay scenes, source interfaces, camera, timing, and acceptance predicates; the implemented value, branches, and source-local calls stay inside that named responsibility and leave none of its cited behavior unpaid.
 * @evidence principles/core/source-units.md#source-substantive-completion answerAcceptance is a usable source artifact for the exported answerAcceptance source owner and its declared value or behavior; it is implemented directly as [ { id: '${answer.id}-beauty', evidence: [ { reason: "Beauty evidence verifies that the answering scene reads as a consequence.", scene: "SCN-002", }, ], target: { kind rather than as a placeholder or future-work wrapper.
 * @evidenceReview principles/core/source-units.md#source-substantive-completion #e9c974f I traced the applicable answerAcceptance signature, initializer, type surface, branches, returns, and failures; together they provide a complete deterministic value or operation that its consumer can use without inventing another boundary.
 * @evidenceExclude upstream/delivery/shots.md#parent-revision-from-shot-work Implementing answerAcceptance tested the exact screenplay scenes, source interfaces, camera, timing, and acceptance predicates through the exported answerAcceptance source owner and its declared value or behavior; the implementation fragment [ { id: '${answer.id}-beauty', evidence: [ { reason: "Beauty evidence verifies that the answering scene reads as a consequence.", scene: "SCN-002", }, ], target: { kind shows the authored inputs, interfaces, limits, and result were sufficient, so source work exposed no upstream defect.
 * @evidenceExcludeReview upstream/delivery/shots.md#parent-revision-from-shot-work #445ed4e I compared the complete answerAcceptance implementation with its actual reviewed parent, including its applicable inputs, derived values, boundary behavior, and returned state; it required no code-local repair to the parent decision.
 */
export const answerAcceptance: IAutoMovieAcceptanceScenario[] = [
  {
    id: `${answer.id}-beauty`,
    evidence: [
      {
        reason:
          "Beauty evidence verifies that the answering scene reads as a consequence.",
        scene: "SCN-002",
      },
    ],
    target: { kind: "shot", id: answer.id },
    criterion: {
      kind: "frame",
      frame: ANSWER_CONTRACT.reviewFrames[0]!.id,
      pass: "beauty",
      expectation:
        "The shut leaf and fixed post separate at the far edge while the held chorus remains readable as peripheral context at frame left.",
    },
    required: true,
  },
  {
    id: `${answer.id}-held-cue`,
    evidence: [
      {
        reason:
          "The compiled event verifies that this shot independently holds the authored cue while the insert looks away.",
        scene: "SCN-002",
      },
    ],
    target: { kind: "shot", id: answer.id },
    criterion: {
      kind: "event",
      event: ANSWER_CONTRACT.events[0]!.id,
      expectation:
        "The realized cue-answered event samples the raised arm at or above 100 degrees inside this shot rather than borrowing the opening realization.",
    },
    required: true,
  },
  {
    id: `${answer.id}-gate-mask`,
    evidence: [
      {
        reason:
          "The object-id mask verifies that the terminal insert contains the authored gate rather than an unresolved or incidental silhouette.",
        scene: "SCN-002",
      },
    ],
    target: { kind: "shot", id: answer.id },
    criterion: {
      kind: "frame",
      frame: ANSWER_CONTRACT.reviewFrames[0]!.id,
      pass: "mask",
      expectation:
        "The mask isolates plaza-gate at the shut-gate review frame with no unresolved subject identity.",
    },
    required: true,
  },
];
