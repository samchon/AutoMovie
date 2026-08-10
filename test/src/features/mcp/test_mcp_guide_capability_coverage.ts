import { AUTOMOVIE_SANDBOX_ENGINE_SURFACE } from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import path from "node:path";

/** One served guide's claim to teach a group of agent-facing records. */
interface ICapabilityClaim {
  /** Served guide stem whose prose teaches every file below. */
  guide: string;
  /**
   * Distinctive fragment of that guide's Markdown.
   *
   * The fragment must occur in the named guide and in no other served guide,
   * which is what stops a claim from pointing at boilerplate every document
   * happens to share. A claim may cover several files with one fragment when
   * one passage genuinely teaches them together.
   */
  probe: string;
  /** Interface record files, relative to `packages/interface/src`. */
  files: string[];
}

/** One group of records no served guide teaches, with the reason why. */
interface ICapabilityExemption {
  /**
   * Closed reason family.
   *
   * - `primitive`: a shared scalar or vocabulary type carrying no independent
   *   authoring decision, reached only inside a record that has a claim.
   * - `host-contract`: a request, selector, or migration shape of the host
   *   harness API rather than something an agent authors.
   * - `undelivered`: a typed surface an MCP-only agent cannot reach at all. This
   *   is the honest hole, and it is the list a reviewer reads first.
   */
  reason: "primitive" | "host-contract" | "undelivered";
  /** Interface record files, relative to `packages/interface/src`. */
  files: string[];
}

const CLAIMS: ICapabilityClaim[] = [
  {
    guide: "WORLD_BUILDING",
    probe: "A target carries its unit beside its value",
    files: ["analysis/IAutoMovieAnalysisRun.ts"],
  },
  {
    guide: "WORLD_BUILDING",
    probe: "Naming a domain is not a claim that it is solved",
    files: ["analysis/IAutoMovieAnalysisReport.ts"],
  },
  {
    guide: "WORLD_BUILDING",
    probe: "The site is the production's `environmentContext`",
    files: ["analysis/IAutoMovieEnvironmentContext.ts"],
  },
  {
    guide: "WORLD_BUILDING",
    probe: "Architecture has two linked graphs.",
    files: ["architecture/IAutoMovieBuiltEnvironment.ts"],
  },
  {
    guide: "WORLD_BUILDING",
    probe: "Lineage deliberately imports none of the graphs it annotates",
    files: ["architecture/IAutoMovieDesignLineage.ts"],
  },
  {
    guide: "ASSET_SOURCING",
    probe: "Promotion is the one-way gate",
    files: ["architecture/IAutoMovieDesignReference.ts"],
  },
  {
    guide: "SHOT_CONTRACT",
    probe: "returns below are source-owned by design",
    files: ["authoring/IAutoMovieAuthoring.ts"],
  },
  {
    guide: "CAPTURE_FRAME",
    probe: "A structural pass is evidence about geometry",
    files: ["cinematics/AutoMovieGuidePass.ts"],
  },
  {
    guide: "SHOT_CONTRACT",
    probe: "needs at least one machine-checkable predicate",
    files: ["cinematics/IAutoMovieInteractionEvent.ts"],
  },
  {
    guide: "CAPTURE_FRAME",
    probe: "Use `beauty` to judge appearance.",
    files: ["cinematics/IAutoMoviePoseKeypoint.ts"],
  },
  {
    guide: "PRODUCTION_DESIGN",
    probe: "Width and height are each bounded to 16,384",
    files: ["cinematics/IAutoMovieRenderFrameFormat.ts"],
  },
  {
    guide: "CINEMATOGRAPHY",
    probe: "Tone mapping has one owner.",
    files: ["cinematics/IAutoMovieRenderSpec.ts"],
  },
  {
    guide: "EDITING",
    probe: "Sequence review owns local cut logic",
    files: ["cinematics/IAutoMovieSequence.ts"],
  },
  {
    guide: "SHOT_CONTRACT",
    probe: "A tracked shot contract says what a shot must accomplish",
    files: ["cinematics/IAutoMovieShot.ts"],
  },
  {
    guide: "EDITING",
    probe: "A transition consumes time from both sides",
    files: ["cinematics/IAutoMovieTransition.ts"],
  },
  {
    guide: "SHOT_CONTRACT",
    probe: "A trimmed boundary cannot use edge states at all",
    files: ["cinematics/IAutoMovieTrim.ts"],
  },
  {
    guide: "MODEL_RECIPE",
    probe: "A capability outside the archetype's own list is refused",
    files: ["core/IAutoMovieCapability.ts"],
  },
  {
    guide: "OBJECT_RIGGING",
    probe: "Use constraints for physical limits and coupling.",
    files: ["core/IAutoMovieChannelLimit.ts"],
  },
  {
    guide: "OBJECT_RIGGING",
    probe: "Define range, unit, neutral value, and driven relationships.",
    files: ["core/IAutoMovieDriver.ts"],
  },
  {
    guide: "OBJECT_RIGGING",
    probe: "A profile names semantic capability over that topology.",
    files: ["core/IAutoMovieProfile.ts"],
  },
  {
    guide: "WORLD_BUILDING",
    probe: "A drawing is a question asked of the design",
    files: ["drawing/IAutoMovieDrawing.ts"],
  },
  {
    guide: "WORLD_BUILDING",
    probe: "Four projections are two decisions, not four algorithms",
    files: ["drawing/IAutoMovieDrawingView.ts"],
  },
  {
    guide: "WORLD_BUILDING",
    probe: "A schedule therefore cannot lose or invent a door.",
    files: ["drawing/IAutoMovieDrawingSchedule.ts"],
  },
  {
    guide: "WORLD_BUILDING",
    probe: "Read the basis before you order anything",
    files: ["drawing/IAutoMovieQuantityReport.ts"],
  },
  {
    guide: "MOTION",
    probe: "do not invent facial capability absent from the asset",
    files: [
      "expression/AutoMovieArkitChannel.ts",
      "expression/AutoMovieExpressionPreset.ts",
      "expression/IAutoMovieBlendshapeChannel.ts",
      "expression/IAutoMovieExpression.ts",
    ],
  },
  {
    guide: "WORLD_BUILDING",
    probe: "a fixed-grid, fixed-step shallow-water field",
    files: ["fluid/IAutoMovieFluidDomain.ts"],
  },
  {
    guide: "WORLD_BUILDING",
    probe: "compare the digest across machines",
    files: ["fluid/IAutoMovieFluidState.ts"],
  },
  {
    guide: "WORLD_BUILDING",
    probe: "The water-feature binding names the basin space",
    files: ["fluid/IAutoMovieWaterFeature.ts"],
  },
  {
    guide: "WORLD_DESIGN",
    probe: "a `heightfield` lattice of row-major samples",
    files: ["geometry/IAutoMovieHeightRule.ts"],
  },
  {
    guide: "SHOT_CONTRACT",
    probe: "an explicit `enact` may cite a source-computed clip",
    files: [
      "harness/IAutoMovieActionCall.ts",
      "harness/IAutoMovieScriptNode.ts",
    ],
  },
  {
    guide: "SHOT_CONTRACT",
    probe: "Edge states are a claim about a handoff",
    files: ["harness/IAutoMovieBeatEndState.ts"],
  },
  {
    guide: "FORMATION_DESIGN",
    probe: "naming it in a group target's `formations`",
    files: ["harness/IAutoMovieGroupTarget.ts"],
  },
  {
    guide: "MODEL_RECIPE",
    probe: "A `mountable` trait owns",
    files: ["harness/IAutoMovieMountBinding.ts"],
  },
  {
    guide: "MOTION",
    probe: "Default reactions derived from them are hints",
    files: ["harness/IAutoMovieOnHitReaction.ts"],
  },
  {
    guide: "WORLD_BUILDING",
    probe: "Six typed relations are available",
    files: ["harness/IAutoMoviePropSpec.ts"],
  },
  {
    guide: "MOTION",
    probe:
      "Preserve the exact semantic-event time used by shot and sound contracts.",
    files: ["harness/IAutoMovieTimingAnchor.ts"],
  },
  {
    guide: "MODEL_RECIPE",
    probe: "A texture binding is either a bare asset id or a full reference",
    files: ["material/IAutoMovieMaterial.ts"],
  },
  {
    guide: "WORLD_BUILDING",
    probe: "answers how thick the thing actually is",
    files: ["material/IAutoMovieMaterialAssembly.ts"],
  },
  {
    guide: "MODEL_RECIPE",
    probe: "To bind an external appearance, set `asset` to one exact glTF",
    files: ["model/AutoMovieAssetOrigin.ts"],
  },
  {
    guide: "MODEL_RECIPE",
    probe:
      "`archetype` names a registered builder, not a member of a fixed list.",
    files: ["model/AutoMoviePrimitiveShape.ts"],
  },
  {
    guide: "WORLD_BUILDING",
    probe: "the contact affordances, and a self-declared articulation",
    files: ["model/IAutoMovieAffordance.ts"],
  },
  {
    guide: "MODEL_RECIPE",
    probe: "Collision accepts `capsule-v1 { radius, height }`",
    files: ["model/IAutoMovieBody.ts"],
  },
  {
    guide: "GEOMETRY",
    probe: "constructors cover the convex constructive vocabulary",
    files: ["model/IAutoMovieGeometry.ts"],
  },
  {
    guide: "GEOMETRY",
    probe: "Measure what you built before you ship it.",
    files: ["model/IAutoMovieMesh.ts"],
  },
  {
    guide: "MODEL_RECIPE",
    probe: "materializes every registered recipe as an immutable runtime model",
    files: ["model/IAutoMovieModel.ts"],
  },
  {
    guide: "OBJECT_RIGGING",
    probe: "Each part should contribute identity, structure, articulation",
    files: ["model/IAutoMovieModelPart.ts"],
  },
  {
    guide: "MOTION",
    probe: "Key important changes, then choose interpolation.",
    files: ["motion/AutoMovieEasing.ts"],
  },
  {
    guide: "FORMATION_DESIGN",
    probe: "which of the figure's declared gaits its members perform",
    files: ["motion/IAutoMovieGait.ts"],
  },
  {
    guide: "MOTION",
    probe:
      "coordinate root travel with step length, cadence, foot phase, and heading",
    files: ["motion/IAutoMovieGaitLimb.ts"],
  },
  {
    guide: "MOTION",
    probe: "Sample the exact production frame grid.",
    files: ["motion/IAutoMovieKeyframe.ts"],
  },
  {
    guide: "MOTION",
    probe:
      "Author a playable verb and its state change, not a bag of keyframes.",
    files: ["motion/IAutoMovieMotion.ts"],
  },
  {
    guide: "MOTION",
    probe: "Start from pelvis or mechanical root",
    files: ["pose/IAutoMovieJointPose.ts"],
  },
  {
    guide: "MOTION",
    probe: "Plant contacts in world space when the story says they are fixed.",
    files: ["pose/IAutoMoviePose.ts"],
  },
  {
    guide: "ASSET_SOURCING",
    probe: "Register each image with a typed use",
    files: ["production/IAutoMovieAssetManifest.ts"],
  },
  {
    guide: "COMPILATION",
    probe: "The non-MCP compiler is an atomic fence with four scopes.",
    files: ["production/IAutoMovieProductionCompiler.ts"],
  },
  {
    guide: "PRODUCTION_DESIGN",
    probe: "The tracked production design record stores global invariants",
    files: ["production/IAutoMovieProductionDesign.ts"],
  },
  {
    guide: "GEOMETRY",
    probe: "The geometry oracle is intentionally compact.",
    files: ["production/IAutoMovieProductionOracle.ts"],
  },
  {
    guide: "REPAINT_SHOT",
    probe: "repaint is a separately reviewed visual delivery layer",
    files: ["production/IAutoMovieProductionRendition.ts"],
  },
  {
    guide: "AUTOMOVIE_OVERALL",
    probe:
      "Read the exact target guide before both `prepareReview` and `submitReview`",
    files: ["production/IAutoMovieProductionReview.ts"],
  },
  {
    guide: "SOUND_DESIGN",
    probe: "An audio cue on the film timeline names its `asset`",
    files: ["production/IAutoMovieProductionSound.ts"],
  },
  {
    guide: "SCREENPLAY_WRITING",
    probe: "The typed scene index points from stable ids into prose.",
    files: ["production/IAutoMovieScreenplayIndex.ts"],
  },
  {
    guide: "CAPTURE_FRAME",
    probe: "Choose exactly one compiler-registry target",
    files: ["production/application/IAutoMovieCaptureFrame.ts"],
  },
  {
    guide: "AUTOMOVIE_OVERALL",
    probe:
      "retrieve only that guide by calling `getGuideDocument` with its exact stem",
    files: ["production/application/IAutoMovieGetGuideDocument.ts"],
  },
  {
    guide: "REVIEW_ASSET",
    probe: "Treat its fingerprint as the worksheet identity.",
    files: ["production/application/IAutoMoviePrepareReview.ts"],
  },
  {
    guide: "REPAINT_SHOT",
    probe: "Lock references by role and project-relative manifest path.",
    files: ["production/application/IAutoMovieRepaintShot.ts"],
  },
  {
    guide: "REVIEW_ASSET",
    probe: "Call `submitReview` with the exact prepared fingerprint.",
    files: ["production/application/IAutoMovieSubmitReview.ts"],
  },
  {
    guide: "PRODUCTION_DESIGN",
    probe: "`triangles`, `vertices`, `drawCalls`, `materials`, `textures`",
    files: ["render/AutoMovieRenderMetric.ts"],
  },
  {
    guide: "PRODUCTION_DESIGN",
    probe: "`renderBudgets` is optional and states the render cost",
    files: ["render/IAutoMovieRenderBudget.ts"],
  },
  {
    guide: "PRODUCTION_DESIGN",
    probe: "counted from the compiled artifact before any GPU draws it",
    files: ["render/IAutoMovieRenderInventory.ts"],
  },
  {
    guide: "PRODUCTION_DESIGN",
    probe: "A metric that produced no number is `unsupported`",
    files: ["render/IAutoMovieRenderReport.ts"],
  },
  {
    guide: "PRODUCTION_DESIGN",
    probe: "every asset byte are fingerprinted together",
    files: ["render/IAutoMovieRenderTarget.ts"],
  },
  {
    guide: "WORLD_BUILDING",
    probe: "a space is hidden only when it is proved unreachable",
    files: ["render/IAutoMovieRoomVisibility.ts"],
  },
  {
    guide: "CAPTURE_FRAME",
    probe: "four exact colours that survive a rebuild in a different order",
    files: ["render/IAutoMovieSemanticMask.ts"],
  },
  {
    guide: "WORLD_DESIGN",
    probe: "Mark walkability honestly.",
    files: ["scene/AutoMovieSurfaceKind.ts"],
  },
  {
    guide: "SHOT_CONTRACT",
    probe: "Camera validation clips each required subject's real world extent",
    files: ["scene/IAutoMovieCamera.ts"],
  },
  {
    guide: "CINEMATOGRAPHY",
    probe: "Atmosphere is a declared value, not a mood word.",
    files: ["scene/IAutoMovieFog.ts"],
  },
  {
    guide: "CINEMATOGRAPHY",
    probe: "Shadows are a declared cost, not a default.",
    files: ["scene/IAutoMovieLight.ts"],
  },
  {
    guide: "PRODUCTION_DESIGN",
    probe: "`lighting` is optional and rides on that clock",
    files: ["scene/IAutoMovieProductionLighting.ts"],
  },
  {
    guide: "CINEMATOGRAPHY",
    probe: "it owns the photographic response of every beauty frame",
    files: ["scene/IAutoMovieScene.ts"],
  },
  {
    guide: "CINEMATOGRAPHY",
    probe: "Image lighting is what makes a physically-based interior read.",
    files: ["scene/IAutoMovieSceneEnvironment.ts"],
  },
  {
    guide: "SOURCE_COMPOSITION",
    probe: "the first step toward ten thousand nodes",
    files: ["scene/IAutoMovieSceneNode.ts"],
  },
  {
    guide: "WORLD_DESIGN",
    probe: "A shot's staged `space` states its standable patches",
    files: ["scene/IAutoMovieSpace.ts"],
  },
  {
    guide: "WORLD_DESIGN",
    probe: "Surface polygons live in XZ and carry a height rule",
    files: ["scene/IAutoMovieSurface.ts"],
  },
  {
    guide: "WORLD_BUILDING",
    probe: "fire suppression, and control are one computational object",
    files: ["service/IAutoMovieServiceNetwork.ts"],
  },
  {
    guide: "WORLD_BUILDING",
    probe: "Those are the facts a leak is found in",
    files: ["service/IAutoMovieWetZone.ts"],
  },
  {
    guide: "OBJECT_RIGGING",
    probe: "Map semantic bone chains rather than assuming equal bone counts",
    files: ["skeleton/AutoMovieBodyRegion.ts"],
  },
  {
    guide: "OBJECT_RIGGING",
    probe: "preserve a conventional hips-rooted hierarchy",
    files: ["skeleton/AutoMovieHumanoidBone.ts"],
  },
  {
    guide: "OBJECT_RIGGING",
    probe: "joint limits across the required range of motion",
    files: ["skeleton/IAutoMovieAngleRange.ts"],
  },
  {
    guide: "MODEL_RECIPE",
    probe:
      "A bone attachment is accepted only when that bone is on the skeleton",
    files: ["skeleton/IAutoMovieAttachment.ts"],
  },
  {
    guide: "OBJECT_RIGGING",
    probe: "parent-child continuity and nonzero bone lengths",
    files: ["skeleton/IAutoMovieBone.ts"],
  },
  {
    guide: "OBJECT_RIGGING",
    probe: "Use springs only where secondary motion is intended and bounded.",
    files: ["skeleton/IAutoMovieJointConstraint.ts"],
  },
  {
    guide: "OBJECT_RIGGING",
    probe: "A skeleton names topology.",
    files: ["skeleton/IAutoMovieSkeleton.ts"],
  },
  {
    guide: "WORLD_BUILDING",
    probe: "There is no species catalogue and there will not be one",
    files: ["soft/IAutoMoviePlantingDomain.ts"],
  },
  {
    guide: "WORLD_BUILDING",
    probe: "A `null` irrigation is a legitimate authoring state",
    files: ["soft/IAutoMoviePlantingInstallation.ts"],
  },
  {
    guide: "WORLD_BUILDING",
    probe: "Growth is a state rather than an animation",
    files: ["soft/IAutoMoviePlantingState.ts"],
  },
  {
    guide: "WORLD_BUILDING",
    probe: "a fixed-lattice, fixed-step position-based solve",
    files: ["soft/IAutoMovieSoftBodyDomain.ts"],
  },
  {
    guide: "WORLD_BUILDING",
    probe: "produces exactly zero correction however long it integrates",
    files: ["soft/IAutoMovieSoftBodyState.ts"],
  },
  {
    guide: "WORLD_BUILDING",
    probe:
      "the furnishing selects a boundary condition and the solver finds the folds",
    files: ["soft/IAutoMovieSoftFurnishing.ts"],
  },
  {
    guide: "DEBUGGING",
    probe: "Read the exact diagnostic code, target, phase, path, message",
    files: ["validation/AutoMovieViolationKind.ts"],
  },
  {
    guide: "DEBUGGING",
    probe: "Identify the owner named by the diagnostic.",
    files: ["validation/IAutoMovieConstraintViolation.ts"],
  },
  {
    guide: "DEBUGGING",
    probe: "Debug from the first authoritative disagreement",
    files: ["validation/IAutoMovieValidation.ts"],
  },
];

const EXEMPTIONS: ICapabilityExemption[] = [
  // Vectors, quaternions, channels, tracks, drivers' curve shapes and the
  // colour record. An author never decides one of these on its own; it is
  // decided by the record that embeds it, and every such record is claimed
  // above.
  {
    reason: "primitive",
    files: [
      "color/IAutoMovieColor.ts",
      "core/AutoMovieChannelValueType.ts",
      "core/AutoMovieInterpolation.ts",
      "core/AutoMovieNodeKind.ts",
      "core/IAutoMovieChannel.ts",
      "core/IAutoMovieDrivenCurve.ts",
      "core/IAutoMovieNamedId.ts",
      "core/IAutoMovieNode.ts",
      "core/IAutoMovieTrack.ts",
      "geometry/IAutoMovieEuler.ts",
      "geometry/IAutoMovieQuaternion.ts",
      "geometry/IAutoMovieTransform.ts",
      "geometry/IAutoMovieVector3.ts",
      "geometry/IAutoMovieYawPitch.ts",
    ],
  },
  // Request and selector shapes of the retired host harness API, plus the
  // migration plan the CLI writes. The agent-facing surface is the five MCP
  // tools; none of these is a payload an authoring agent composes.
  {
    reason: "host-contract",
    files: [
      "harness/IAutoMovieBoneTarget.ts",
      "harness/IAutoMovieContextRequest.ts",
      "harness/IAutoMovieDirectionTarget.ts",
      "harness/IAutoMovieGetBeatEndRequest.ts",
      "harness/IAutoMovieGetNotesRequest.ts",
      "harness/IAutoMovieGetReachRequest.ts",
      "harness/IAutoMovieGetResolvedPoseRequest.ts",
      "harness/IAutoMovieGetSceneRequest.ts",
      "harness/IAutoMovieGetScriptRequest.ts",
      "harness/IAutoMovieGetShotRequest.ts",
      "harness/IAutoMovieMeasureDistanceRequest.ts",
      "harness/IAutoMovieNodeTarget.ts",
      "harness/IAutoMovieOffscreenTarget.ts",
      "harness/IAutoMoviePointTarget.ts",
      "harness/IAutoMovieSlate.ts",
      "production/IAutoMovieLegacyImport.ts",
    ],
  },
  // The parametric head and face surface. No model recipe, production record,
  // compiler path, or scaffold module references it, so an agent holding only
  // the MCP surface cannot reach it at all, and a guide teaching it would be
  // teaching a door with no room behind it. Teaching it is the same work as
  // delivering it; until then this list says so out loud rather than letting
  // the absence look like an oversight nobody noticed.
  {
    reason: "undelivered",
    files: [
      "face/AutoMovieFaceParameterName.ts",
      "face/AutoMovieFaceWeight.ts",
      "face/AutoMovieHeadParameterName.ts",
      "face/IAutoMovieFace.ts",
      "face/IAutoMovieFaceBrow.ts",
      "face/IAutoMovieFaceBrowSet.ts",
      "face/IAutoMovieFaceCheek.ts",
      "face/IAutoMovieFaceCheekSet.ts",
      "face/IAutoMovieFaceChin.ts",
      "face/IAutoMovieFaceEye.ts",
      "face/IAutoMovieFaceEyeSet.ts",
      "face/IAutoMovieFaceJaw.ts",
      "face/IAutoMovieFaceLips.ts",
      "face/IAutoMovieFaceMouth.ts",
      "face/IAutoMovieFaceNose.ts",
      "face/IAutoMovieFaceTemplate.ts",
      "face/IAutoMovieHead.ts",
    ],
  },
];

/**
 * Every immediate child of the engine source tree, and where the decision about
 * it was recorded.
 *
 * This entry is the unit because it is how a capability arrives: the cycle that
 * needed this case shipped `analysis`, `architecture`, `drawing`, `fluid`,
 * `render`, `service`, and `soft` as new folds, and nothing asked whether any
 * of them was taught. Top-level modules are classified beside the folds so a
 * capability cannot escape by not being a directory. A guide names the served
 * document that answers for the entry, and `null` marks an engine internal the
 * authoring surface reaches only through a record that already carries its own
 * claim above.
 */
const ENGINE_ENTRIES: Record<string, string | null> = {
  analysis: "WORLD_BUILDING",
  architecture: "WORLD_BUILDING",
  drawing: "WORLD_BUILDING",
  "effect.ts": "WORLD_DESIGN",
  face: null,
  film: "SHOT_CONTRACT",
  fluid: "WORLD_BUILDING",
  "formation.ts": "FORMATION_DESIGN",
  "formationCadence.ts": "FORMATION_DESIGN",
  "formationSlot.ts": "FORMATION_DESIGN",
  geometry: "GEOMETRY",
  kinematics: null,
  math: null,
  motion: "MOTION",
  perform: null,
  physics: null,
  "productionIdentity.ts": "COMPILATION",
  render: "PRODUCTION_DESIGN",
  resolve: null,
  rom: "OBJECT_RIGGING",
  scene: "CINEMATOGRAPHY",
  service: "WORLD_BUILDING",
  soft: "WORLD_BUILDING",
  sound: "SOUND_DESIGN",
  space: "WORLD_DESIGN",
  "subject.ts": "SOURCE_COMPOSITION",
  text: null,
  validation: "DEBUGGING",
  "worldKit.ts": "WORLD_DESIGN",
};

/**
 * Where an authoring agent may call one engine capability the corpus names.
 *
 * Being taught and being reachable are two facts, and this repository has
 * already shipped them contradicting each other: a guide taught drawings,
 * schedules, take-offs and performance studies in detail while no module an
 * authoring agent may write could call any of them. A capability nobody can
 * reach is worse than one nobody teaches, because the agent tries it and fails,
 * then reads the compiler to find out why.
 *
 * There are exactly two places an agent's code runs, and they differ in what
 * they may name.
 *
 * - `surface`: published on {@link AUTOMOVIE_SANDBOX_ENGINE_SURFACE}, so a shot or
 *   film build function may import it and the result becomes a frame.
 * - `script`: off that surface, so it may only be called from the project's
 *   ordinary Node or browser code, and the starter proves the place is real by
 *   calling it from `scripts/` or `viewer/src/`.
 * - `unreached`: off that surface, and no module the starter ships calls it. The
 *   honest hole, and the list a reviewer reads first.
 */
type AutoMovieCapabilityReach = "surface" | "script" | "unreached";

/**
 * Every engine value export a served guide names, and where it is called from.
 *
 * The population is derived rather than listed: naming an engine export in a
 * guide's code span is what puts it here, so teaching a capability and deciding
 * where it may be called are one edit. The value is checked against the sandbox
 * surface and against the starter's own modules, so a name that moves onto or
 * off the surface, or a call site that disappears, fails here by name.
 */
const CAPABILITY_REACH: Record<string, AutoMovieCapabilityReach> = {
  AutoMovieSubject: "surface",
  AutoMovieSubjectGroup: "surface",
  analyzeAutoMovieAcoustics: "script",
  analyzeAutoMovieDaylight: "script",
  analyzeAutoMovieEnvelope: "script",
  analyzeAutoMovieSpaceAir: "script",
  // The world kit's placement validator. `WORLD_DESIGN` teaches it, the sandbox
  // does not publish it, and no shipped module calls it: a world design record
  // is emitted by `scripts/emitDesign.ts`, which is where the check belongs and
  // does not yet run it.
  assertWorldPlacements: "unreached",
  autoMovieDrawingToSvg: "script",
  autoMovieRenderSubjectOfCompiledShot: "script",
  // The older render-subject reading, taught by `PRODUCTION_DESIGN` as the
  // escape hatch for drawables the compiled artifact does not carry. Its own
  // JSDoc records that the test suite is its only caller, so the starter
  // demonstrates the compiled reading beside it and not this one.
  autoMovieRenderSubjectOfShot: "unreached",
  buildAutoMoviePolyhedron: "surface",
  buildAutoMovieWall: "surface",
  builtEnvironmentAdjacentSpaces: "surface",
  builtEnvironmentBuildingOfSpace: "surface",
  builtEnvironmentContainsPoint: "surface",
  builtEnvironmentSpaceConnectors: "surface",
  builtEnvironmentSpaceNodes: "surface",
  builtEnvironmentSpaceSurfaces: "surface",
  defineShot: "surface",
  deriveAutoMovieDrawing: "script",
  deriveAutoMovieDrawingSchedule: "script",
  deriveAutoMovieSemanticMask: "script",
  extrudeAutoMovieProfile: "surface",
  extrudeAutoMovieRegion: "surface",
  inspectAutoMovieMeshTopology: "surface",
  loftAutoMovieSections: "surface",
  lowerBuiltEnvironment: "surface",
  lowerServiceNetwork: "script",
  lowerWetZoneDrainage: "script",
  measureAutoMovieQuantities: "script",
  mergeAutoMovieMeshParts: "surface",
  mergeAutoMovieMeshes: "surface",
  mergeAutoMovieSpaces: "surface",
  renderAutoMovieSemanticMaskSidecar: "script",
  revolveAutoMovieProfile: "surface",
  summarizeAutoMovieAnalysis: "script",
  sweepAutoMovieProfile: "surface",
  tessellateSurface: "surface",
  transformAutoMovieMesh: "surface",
  triangulateAutoMovieRegion: "surface",
};

/** Shortest fragment accepted as a distinctive teaching quotation. */
const MINIMUM_PROBE_LENGTH = 20;

const ROOT = path.resolve(__dirname, "..", "..", "..", "..");

const compareCodeUnits = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;

/** Every record file of one package source tree, excluding barrels. */
const recordFiles = (root: string): string[] => {
  const walk = (directory: string, prefix: string): string[] =>
    fs
      .readdirSync(directory, { withFileTypes: true })
      .flatMap((entry) =>
        entry.isDirectory()
          ? walk(path.join(directory, entry.name), `${prefix}${entry.name}/`)
          : entry.name.endsWith(".ts") && entry.name !== "index.ts"
            ? [`${prefix}${entry.name}`]
            : [],
      );
  return walk(root, "").sort(compareCodeUnits);
};

/** Every `.ts` file under one tree, in no particular order. */
const sourceFiles = (root: string): string[] =>
  fs
    .readdirSync(root, { withFileTypes: true })
    .flatMap((entry) =>
      entry.isDirectory()
        ? sourceFiles(path.join(root, entry.name))
        : entry.name.endsWith(".ts")
          ? [path.join(root, entry.name)]
          : [],
    );

/** One tree's whole source text, for asking whether a name occurs in it. */
const sourceText = (root: string): string =>
  sourceFiles(root)
    .map((file) => fs.readFileSync(file, "utf8"))
    .join("\n");

/**
 * Every value one package source tree exports, excluding barrels.
 *
 * Values rather than types, because a type is reached by writing a record and
 * the record population above already answers for that. A value has to be
 * imported by name from a module the author's own code is allowed to import
 * from, which is the reachability question this file asks.
 */
const valueExports = (root: string): string[] => {
  const found = new Set<string>();
  for (const file of sourceFiles(root)) {
    if (path.basename(file) === "index.ts") continue;
    const text = fs.readFileSync(file, "utf8");
    for (const pattern of [
      /^export const ([A-Za-z0-9_]+)/gm,
      /^export (?:abstract )?class ([A-Za-z0-9_]+)/gm,
      /^export function ([A-Za-z0-9_]+)/gm,
    ])
      for (const match of text.matchAll(pattern)) found.add(match[1]!);
  }
  return [...found].sort(compareCodeUnits);
};

/**
 * Only the code spans and fenced blocks of one Markdown document.
 *
 * A guide names a function in backticks and describes a building in prose, so
 * restricting the search to code keeps `ease`, `violation` and every other
 * ordinary English word that happens to be an export out of the population.
 */
const codeSpans = (document: string): string =>
  [
    ...[...document.matchAll(/```[\s\S]*?```/g)].map((match) => match[0]),
    ...[...document.matchAll(/`[^`\n]+`/g)].map((match) => match[0]),
  ].join("\n");

/**
 * Whether one identifier is named on its own rather than as somebody's member.
 *
 * `context.engine.formationSlot` is a method on the injected build context and
 * reached without importing anything, so a bare-name test is what separates the
 * names an author has to import from the ones already handed to them.
 */
const names = (text: string, symbol: string): boolean =>
  new RegExp(`(?<![A-Za-z0-9_.])${symbol}(?![A-Za-z0-9_])`, "u").test(text);

/** Immediate children of one package source tree, folds and modules alike. */
const sourceEntries = (root: string): string[] =>
  fs
    .readdirSync(root, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isDirectory() ||
        (entry.name.endsWith(".ts") && entry.name !== "index.ts"),
    )
    .map((entry) => entry.name)
    .sort(compareCodeUnits);

/**
 * Make an untaught shipped capability impossible to ship quietly.
 *
 * The guide corpus already has two gates: `test_mcp_guide_corpus` compiles its
 * fenced TypeScript, and `test_workspace_public_contracts` compares its
 * enumerating tables with the folders they describe. Neither asks the question
 * this case asks, which is whether a sentence anywhere in the corpus teaches a
 * capability the repository ships. To an agent holding only the MCP surface, a
 * capability no guide teaches does not exist, so that gap is a delivery defect
 * rather than a documentation chore.
 *
 * The gated population is the interface record surface, because interface is
 * the AST an authoring agent emits against: every capability this repository
 * ships lands a record there, and a record nobody can be told about is a record
 * nobody writes. Each file is either claimed by a served guide with a
 * distinctive quotation from that guide, or exempted for one of three closed
 * reasons whose totals are pinned here, so an exemption can only grow through a
 * visible edit to this case. The engine tree carries the coarser half of the
 * same obligation, so a new fold or top-level module forces a classification
 * instead of arriving silently. The viewer is deliberately outside both
 * populations: an authoring agent never writes viewer code, it consumes what a
 * record already declared.
 *
 * Scenarios:
 *
 * 1. The claimed and exempted files together are exactly the interface record
 *    files on disk, with no file claimed twice. A new record, a renamed one, or
 *    a deleted one fails with its own path.
 * 2. Every claimed guide is a served guide name, so a claim cannot point at a
 *    document `getGuideDocument` never delivers. Served names are read from the
 *    prompt folder rather than restated here, because `test_mcp_guide_corpus`
 *    already pins that folder against the served-name constant.
 * 3. Every probe is at least {@link MINIMUM_PROBE_LENGTH} characters, occurs in its
 *    own guide, and occurs in no other served guide. A guide that stops
 *    teaching a capability, or a claim pointing at prose shared by every
 *    document, fails naming the guide and the fragment.
 * 4. The exemption totals per closed reason are exactly the pinned numbers, so
 *    silencing a capability instead of teaching it cannot be a one-line edit.
 * 5. The engine tree's immediate children on disk are exactly the classified ones,
 *    and every entry that claims a guide names a served guide some interface
 *    claim already proved teaches something.
 * 6. Every engine value export the corpus names in a code span carries a reach,
 *    and nothing else does. Naming a function in a guide is what creates the
 *    obligation to say where it may be called from.
 * 7. A reach reads `surface` exactly when the sandbox publishes that name, so a
 *    capability promoted onto or demoted off the importable surface fails here
 *    rather than leaving a guide teaching the wrong place to call it.
 * 8. Every `script` capability is named by a module the starter ships outside the
 *    sandbox, every `unreached` one is named by none, and the unreached total
 *    is pinned so a hole cannot be opened by a one-line edit.
 *
 * What this case deliberately does not ask: whether a `script` capability is
 * also named under `packages/cli/scaffold/src/**`. It is, today —
 * `src/examples/drawings.ts`, `src/examples/services.ts` and
 * `src/examples/renderBudgets.ts` demonstrate script-side calls from modules
 * that sit in the sandbox half of the starter, so an author who follows the
 * shipped instruction to copy an example into `src/units` or `src/world` is
 * refused by the import gate. Moving those examples is a change to files this
 * case does not own; until it happens the fact is stated here rather than left
 * for an author to discover as a refusal.
 */
export const test_mcp_guide_capability_coverage = (): void => {
  const promptRoot = path.join(ROOT, "packages/mcp/prompts");
  const documents = new Map<string, string>(
    fs
      .readdirSync(promptRoot)
      .filter((file) => file.endsWith(".md") && file !== "README.md")
      .sort(compareCodeUnits)
      .map((file) => [
        file.slice(0, -".md".length),
        fs.readFileSync(path.join(promptRoot, file), "utf8"),
      ]),
  );
  const served = new Set<string>(documents.keys());

  const population = recordFiles(path.join(ROOT, "packages/interface/src"));
  const covered = [
    ...CLAIMS.flatMap((claim) => claim.files),
    ...EXEMPTIONS.flatMap((exemption) => exemption.files),
  ];
  TestValidator.equals(
    "every interface record file is claimed or exempted exactly once",
    [...covered].sort(compareCodeUnits),
    population,
  );
  TestValidator.equals(
    "no interface record file is covered twice",
    covered.filter((file, index) => covered.indexOf(file) !== index),
    [],
  );

  TestValidator.equals(
    "every claim names a served guide",
    CLAIMS.filter((claim) => served.has(claim.guide) === false).map(
      (claim) => `${claim.guide}: ${claim.files[0]}`,
    ),
    [],
  );

  TestValidator.equals(
    "every probe is a distinctive quotation",
    CLAIMS.filter((claim) => claim.probe.length < MINIMUM_PROBE_LENGTH).map(
      (claim) => `${claim.guide}: ${claim.probe}`,
    ),
    [],
  );
  TestValidator.equals(
    "every probe occurs in the guide that claims it",
    CLAIMS.filter(
      (claim) => documents.get(claim.guide)?.includes(claim.probe) !== true,
    ).map((claim) => `${claim.guide}: ${claim.probe}`),
    [],
  );
  TestValidator.equals(
    "no probe occurs in a second served guide",
    CLAIMS.flatMap((claim) => {
      const elsewhere = [...documents]
        .filter(
          ([name, document]) =>
            name !== claim.guide && document.includes(claim.probe),
        )
        .map(([name]) => name)
        .sort(compareCodeUnits);
      return elsewhere.length === 0
        ? []
        : [`${claim.guide}: ${claim.probe} -> ${elsewhere.join(",")}`];
    }),
    [],
  );

  TestValidator.equals(
    "the closed exemption families hold exactly 14, 16 and 17 records",
    EXEMPTIONS.map(
      (exemption) => `${exemption.reason}:${exemption.files.length}`,
    ).sort(compareCodeUnits),
    ["host-contract:16", "primitive:14", "undelivered:17"],
  );

  const engineEntries = sourceEntries(path.join(ROOT, "packages/engine/src"));
  TestValidator.equals(
    "every engine fold and module is classified as taught or internal",
    Object.keys(ENGINE_ENTRIES).sort(compareCodeUnits),
    engineEntries,
  );
  const claimedGuides = new Set<string>(CLAIMS.map((claim) => claim.guide));
  TestValidator.equals(
    "every taught engine entry names a guide a claim already proved",
    Object.entries(ENGINE_ENTRIES)
      .filter(
        ([, guide]) =>
          guide !== null &&
          (served.has(guide) === false || claimedGuides.has(guide) === false),
      )
      .map(([entry, guide]) => `${entry}: ${guide}`),
    [],
  );

  const spans = [...documents.values()].map(codeSpans);
  const taught = valueExports(path.join(ROOT, "packages/engine/src")).filter(
    (symbol) => spans.some((text) => names(text, symbol)),
  );
  TestValidator.equals(
    "every engine value the corpus names carries a recorded reach",
    Object.keys(CAPABILITY_REACH).sort(compareCodeUnits),
    taught,
  );

  const surface = new Set<string>(AUTOMOVIE_SANDBOX_ENGINE_SURFACE);
  TestValidator.equals(
    "a reach reads `surface` exactly when the sandbox publishes the name",
    Object.entries(CAPABILITY_REACH)
      .filter(
        ([symbol, reach]) => (reach === "surface") !== surface.has(symbol),
      )
      .map(([symbol, reach]) => `${symbol}: ${reach}`),
    [],
  );

  // The starter's own non-sandbox halves. A `script` capability is only a place
  // an agent can reach if something the agent receives actually calls it from
  // there; otherwise the guide is naming a door with no room behind it.
  const starter = [
    sourceText(path.join(ROOT, "packages/cli/scaffold/scripts")),
    sourceText(path.join(ROOT, "packages/cli/scaffold/viewer/src")),
  ].join("\n");
  TestValidator.equals(
    "every `script` capability has a call site the starter ships",
    Object.entries(CAPABILITY_REACH)
      .filter(
        ([symbol, reach]) =>
          reach === "script" && names(starter, symbol) === false,
      )
      .map(([symbol]) => symbol),
    [],
  );
  TestValidator.equals(
    "every `unreached` capability really is called by nothing shipped",
    Object.entries(CAPABILITY_REACH)
      .filter(
        ([symbol, reach]) => reach === "unreached" && names(starter, symbol),
      )
      .map(([symbol]) => symbol),
    [],
  );
  TestValidator.equals(
    "the unreached ledger holds exactly 2 taught capabilities",
    Object.values(CAPABILITY_REACH).filter((reach) => reach === "unreached")
      .length,
    2,
  );
};
