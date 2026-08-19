import { defineShot } from "@automovie/engine";
import type {
  IAutoMovieAcceptanceScenario,
  IAutoMovieDefinedShotContract,
  IAutoMovieProductionShotProgram,
  IAutoMovieShotBuildContext,
} from "@automovie/interface";

import { chorus } from "../formations/chorus";
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
    requiredSubjects: ["soloist"],
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
        "This shot realizes the screenplay's held cue, after the rows have closed on it.",
      scene: "SCN-002",
    },
  ],
  durationSeconds: 6,
  participants: [{ kind: "actor", id: "soloist" }],
  opening: [
    {
      id: "cue-seen",
      description: "The answering shot begins from the established raised cue.",
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
      description: "The cue remains legible through the second shot.",
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
      "A second full-body view proves that film rendering and review cannot stop after the opening shot.",
    requiredSubjects: ["soloist"],
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
      id: "cue-answer",
      time: 4,
      passes: ["beauty", "mask", "pose"],
    },
  ],
};

const buildCue = (
  context: IAutoMovieShotBuildContext,
  openingAbduction: number,
): IAutoMovieProductionShotProgram => {
  // The soloist owns its own rig lookup, its raise-and-hold, and what it
  // stages. This shot states the beat and the frame; it does not rebuild the
  // figure.
  const performer = soloist.render(context, { from: openingAbduction });
  const sceneId = `${context.contract.id}-scene`;
  return {
    actors: [...(performer.actors ?? [])],
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
      plan: "The soloist stands centered while a fixed camera reads the hand.",
      actors: [
        {
          node: "soloist",
          position: { x: 0, y: 0, z: 0 },
          facingDeg: 0,
        },
      ],
      cameras: [
        {
          node: "camera",
          position: { x: 0, y: 1.35, z: 4.8 },
          lookAt: { kind: "node", node: "soloist" },
          fovDeg: 38,
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
      analysis: "The cueing arm and whole silhouette must remain readable.",
      rationale: "One fixed full-body view proves the authored pose.",
      actors: [{ node: "soloist", beats: "raises and holds the cueing arm" }],
      camera: {
        framing: "full",
        move: "static",
        on: { kind: "node", node: "soloist" },
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
          framing: "full",
          move: "static",
          on: { kind: "node", node: "soloist" },
        },
      ],
      revise: {
        review: "The cue is readable and remains held at the final frame.",
        final: null,
      },
      duration: context.contract.durationSeconds,
    },
    eventSamples: context.contract.events.map((event) => ({
      id: event.id,
      time: (event.window.from + event.window.to) / 2,
    })),
    clips: [...(performer.clips ?? [])],
    formationMotions: context.contract.participants.some(
      (participant) =>
        participant.kind === "formation" && participant.id === chorus.id,
    )
      ? // The group owns its own advance. Spelling the cue out here loosened
        // the intervals by five percent and turned the rows four degrees,
        // which `docs/settings/020-chorus.md` permits only as an authored
        // dramatic event, and `Chorus.break` is what authors one.
        [
          chorus.advance({
            id: `${context.contract.id}-chorus-advance`,
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
              start: 1,
              end: 4,
              intensity: { from: 0.35, to: 0.8 },
              event: "cue-raised",
            },
          ]
        : [],
  };
};

/**
 * Opening source proves a neutral-to-raised transition.
 *
 * @evidenceReview script/001-cue.md #e592a47 Read the scene and checked this
 *   contract against it: duration 6.0, the cue window closing at 3.0, and the
 *   closing predicate that keeps the hand up to the last frame.
 * @evidence script/001-cue.md Realizes the raised hand this
 *   scene stages, with the rows held in order behind it.
 * @evidence principles/source/shots.md#realizes-a-named-scene Names SCN-001 in
 *   this
 *   citation and in the contract's own evidence entry, and the two agree.
 * @evidence principles/source/shots.md#the-contract-is-the-claim Declares the
 *   opening
 *   and closing states the engine evaluates, so what this shot promises is what
 *   it is measured on.
 * @evidence principles/craft/motion.md#seconds-not-adverbs Declares
 *   its duration and its cue window in seconds, which is the only form the
 *   engine reads.
 * @evidence principles/review/observation.md#declared-view-set
 *   Declares the frames and passes its judgment rests on, including the mask
 *   pass that carries the silhouette.
 * @evidence principles/craft/light.md#accent-is-scarce Spends
 *   the reserved accent on the soloist alone, which is what makes the
 *   raised hand findable in one frame.
 * @evidence principles/craft/motion.md#holds-are-authored Holds the
 *   raised hand to the last frame rather than letting the
 *   interpolation decide how long it reads.
 */
export const opening = defineShot("opening", {
  scene: "opening-scene",
  contract: OPENING_CONTRACT,
  build: (context: IAutoMovieShotBuildContext) => buildCue(context, 0),
});

/**
 * Answer source begins from the raised state established by the first shot.
 *
 * @evidenceReview script/002-answer.md #ecd3d70 Read the scene and checked this
 *   contract against it: duration 6.0, the event window 3.0 to 5.0, and a cue
 *   clip that holds because it opens already raised.
 * @evidence script/002-answer.md Realizes the answering motion
 *   this scene stages, keeping the chorus the visible consequence.
 * @evidence principles/source/shots.md#timing-comes-from-the-contract Holds the
 *   raised
 *   cue for the duration this contract declares, which is the figure the scene
 *   quotes.
 * @evidence principles/source/shots.md#subjects-render-themselves Asks the
 *   soloist to
 *   render from its own established state rather than posing the arm here.
 * @evidence principles/craft/motion.md#change-needs-a-still Holds
 *   every subject still so the change the previous scene made stays legible as a
 *   change.
 * @evidence principles/craft/light.md#delivery-light Carries
 *   the key the cue scene established rather than relighting the plaza for a
 *   second look.
 * @evidence principles/craft/motion.md#screen-direction Keeps the
 *   camera on the side the cue scene established, so the two shots
 *   read as one place.
 * @evidence principles/craft/light.md#shadow-informs Keeps the
 *   key that plants the figures on the ground rather than adding a
 *   shape the eye must discount.
 */
export const answer = defineShot("answer", {
  scene: "answer-scene",
  contract: ANSWER_CONTRACT,
  build: (context: IAutoMovieShotBuildContext) =>
    buildCue(context, soloist.cueAbduction),
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
 * @evidenceReview script/001-cue.md #e592a47 Read the scene and checked that
 *   what it states is what this scenario set measures.
 * @evidence script/001-cue.md Verifies the raised hand this
 *   scene stages, against the frames the shot actually rendered.
 * @evidence principles/source/shots.md#acceptance-is-authored-with-the-shot
 *   Ships
 *   beside the shot it judges rather than being fitted to frames it already
 *   produced.
 * @evidence principles/review/observation.md#falsifying-condition
 *   Names the subject, the instant, and the measured condition that would refute
 *   each claim.
 * @evidence principles/craft/motion.md#measure-the-contact Measures
 *   the raised arm as a joint angle at a sampled time rather than describing it
 *   as readable.
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
 * shot's frames would accept an answer nobody rendered, which is why these name
 * this shot's own review frame and say what it alone has to carry.
 *
 * @evidenceReview script/002-answer.md #ecd3d70 Read the scene and checked that
 *   what it states is what this scenario set measures.
 * @evidence script/002-answer.md Verifies the answering motion
 *   this scene stages, against the frames the shot actually rendered.
 * @evidence principles/source/shots.md#no-hidden-inputs Judges the shot from
 *   compiled
 *   facts alone, and the module it sits in reads no clock, process, or
 *   filesystem.
 * @evidence principles/review/observation.md#declare-the-instants
 *   Samples the held interval rather than one still, so a cue that arrives and
 *   drifts cannot pass.
 * @evidence principles/craft/light.md#contrast-directs Requires
 *   the accented subject to remain the most readable thing in the frame.
 * @evidence principles/review/observation.md#evidence-is-dated Judges
 *   from compiler-derived outcomes bound to the compiled state, so a
 *   stale frame cannot discharge it.
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
        "The answering cue remains readable in the second shot rather than being inferred from the opening shot.",
    },
    required: true,
  },
  {
    id: `${answer.id}-pose`,
    evidence: [
      {
        reason: "The pose frame verifies that the authored cue is still held.",
        scene: "SCN-002",
      },
    ],
    target: { kind: "shot", id: answer.id },
    criterion: {
      kind: "frame",
      frame: ANSWER_CONTRACT.reviewFrames[0]!.id,
      pass: "pose",
      expectation:
        "The second shot carries its own current hips-to-head and raised-arm pose evidence.",
    },
    required: true,
  },
];
