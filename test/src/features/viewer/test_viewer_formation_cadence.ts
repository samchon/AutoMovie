import { formationCadenceSegments } from "@automovie/engine";
import {
  IAutoMovieFormationDesign,
  IAutoMovieFormationMotion,
  IAutoMovieFormationMotionState,
  IAutoMovieGait,
  IAutoMovieModelRecipe,
  IAutoMovieProfile,
} from "@automovie/interface";
import {
  materializeCompiledFormation,
  materializeProductionModels,
} from "@automovie/mcp";
import {
  buildInstancedFormation,
  formationCycleOf,
  formationCyclePosition,
  regenerateFormationSlot,
} from "@automovie/viewer";
import { TestValidator } from "@nestia/e2e";
import * as THREE from "three";

import { namedFacts, nclose, throwsError } from "../internal/predicates";
import { formationDesign, modelRecipe } from "../mcp/productionFixtures";

/**
 * A unit's cadence is the ground its own cues cover, and its action is theirs.
 *
 * A crowd that cycles on a number nobody authored is a crowd that marches while
 * it stands still and skates while it advances, and at that point a stopped
 * mass and a moving mass read the same. These scenarios pin the other law: one
 * turn of a cycle per stride of ground, the stride measured from the bake, the
 * ground measured from the cues, and the cycle itself named by the cue so one
 * group can hold, then move, then hold again inside one shot.
 *
 * Scenarios:
 *
 * 1. Cues cut into cadence intervals: the interval before the first cue covers no
 *    ground, a cue covers its displacement under its own easing, a partial cue
 *    covers its eased part, a cue past the sampled time is not reached, a step
 *    cue delivers at its end, and another unit's cue is not this one's.
 * 2. A unit at rest does not cycle, with no cue at all and under a cue that holds
 *    it, while its members still stand at their own separate phases.
 * 3. Ground drives the cycle: a cue covers stride-many turns, twice the ground
 *    turns twice as far, half the cue turns half as far, and the measured
 *    stride is a stride a figure of that height could take.
 * 4. A cue naming a gait performs that gait, a cue naming only its capability
 *    performs the gait carrying that name, and a unit that changes action mid
 *    shot keeps every turn it already took while taking the next in the new
 *    gait's strides.
 * 5. A cycle that carries a body nowhere runs on its own declared period, and
 *    keeps running after its cue ends.
 * 6. A turning unit carries each member over that member's own arc, and the vertex
 *    stage reads that radius from the instance matrix it already has.
 * 7. The same cues at the same time rebuild the same cadence, revisiting a time
 *    returns the same cadence, and a cue naming a gait no figure declares is
 *    refused.
 */
export const test_viewer_formation_cadence = (): void => {
  const figure: IAutoMovieModelRecipe = {
    ...modelRecipe(),
    id: "cadence-figure",
    profiles: [REPERTOIRE],
    lod: [{ tier: "near", maxDistance: null, recipe: "cadence-figure" }],
  };
  const recipes = new Map([[figure.id, figure]]);
  const models = new Map(
    [...materializeProductionModels(recipes).values()].map((model) => [
      model.id,
      model,
    ]),
  );
  const design: IAutoMovieFormationDesign = {
    ...formationDesign({
      kind: "line",
      ranks: 1,
      files: 8,
      spacing: { lateral: 1, depth: 1 },
    }),
    id: "cadence-unit",
    modelRecipe: figure.id,
    count: 8,
    heroOverrides: [],
  };
  const formation = materializeCompiledFormation(design, recipes);
  const camera = new THREE.PerspectiveCamera(45, 16 / 9, 0.1, 2_000);
  camera.position.set(0, 5, 20);
  camera.lookAt(0, 0, 0);

  const cue = (
    over: Partial<IAutoMovieFormationMotion>,
  ): IAutoMovieFormationMotion => ({
    id: "cue",
    formation: formation.id,
    action: "advance",
    start: 0,
    end: 4,
    from: place(),
    to: place(),
    easing: "linear",
    ...over,
  });
  /** One built unit, its one animated tier, and its cadence at a time. */
  const perform = (
    motions: readonly IAutoMovieFormationMotion[],
  ): {
    at: (time?: number) => {
      advance: number;
      turn: number;
      gait: string;
    };
    cycle: NonNullable<ReturnType<typeof formationCycleOf>>;
    vertexShader: string;
  } => {
    const built = buildInstancedFormation({ formation, models, motions });
    const mesh = built.object.children.find(
      (child): child is THREE.InstancedMesh =>
        child instanceof THREE.InstancedMesh &&
        formationCycleOf(child) !== null,
    )!;
    const cycle = formationCycleOf(mesh)!;
    return {
      at: (time) => {
        built.update(camera, 1_080, time);
        return {
          advance: cycle.uniforms.automovieCycleAdvance.value,
          turn: cycle.uniforms.automovieCycleTurn.value,
          gait: cycle.active.gait,
        };
      },
      cycle,
      vertexShader: injectedVertexShader(mesh),
    };
  };

  const walking = perform([]).cycle;
  const stride = walking.takes.get("advance")!.strideMeters;
  const charge = walking.takes.get("charge")!.strideMeters;

  const segments = formationCadenceSegments(
    [
      cue({ id: "later", start: 4, end: 6, gait: "idle", from: place(0, 8) }),
      cue({ id: "opening", start: 2, end: 4, to: place(0, 8) }),
      cue({ id: "elsewhere", formation: "another-unit", to: place(0, 99) }),
    ],
    formation.id,
    5,
  );
  const stepped = formationCadenceSegments(
    [cue({ easing: "step", to: place(0, 6) })],
    formation.id,
    2,
  );
  TestValidator.equals(
    "cues cut into the intervals a cadence is made of",
    namedFacts([
      ["intervalPerCue", () => segments.length === 3],
      [
        "nothingIsCoveredBeforeTheFirstCue",
        () =>
          segments[0]!.gait === null &&
          nclose(segments[0]!.seconds, 2) &&
          nclose(segments[0]!.distance, 0),
      ],
      [
        "aFinishedCueCoversItsWholeDisplacement",
        () =>
          segments[1]!.gait === "advance" &&
          nclose(segments[1]!.seconds, 2) &&
          nclose(segments[1]!.distance, 8),
      ],
      [
        "aRunningCueCoversItsEasedPart",
        () =>
          segments[2]!.gait === "idle" &&
          nclose(segments[2]!.seconds, 1) &&
          nclose(segments[2]!.distance, 0),
      ],
      [
        "aCueBeyondTheSampledTimeIsNotReached",
        () =>
          formationCadenceSegments(
            [cue({ start: 2, end: 4, to: place(0, 8) })],
            formation.id,
            1,
          ).every((segment) => segment.gait === null),
      ],
      [
        "aSampledZeroCoversNothingAtAll",
        () => formationCadenceSegments([], formation.id, 0).length === 0,
      ],
      [
        "aStepCueDeliversAtItsEndAndNotBefore",
        () =>
          nclose(stepped[0]!.distance, 0) &&
          nclose(
            formationCadenceSegments(
              [cue({ easing: "step", to: place(0, 6) })],
              formation.id,
              4,
            )[0]!.distance,
            6,
          ),
      ],
      [
        "anotherUnitsCueIsNotThisUnits",
        () =>
          formationCadenceSegments(
            [cue({ formation: "another-unit", to: place(0, 8) })],
            formation.id,
            4,
          ).every((segment) => nclose(segment.distance, 0)),
      ],
    ]),
    {
      intervalPerCue: true,
      nothingIsCoveredBeforeTheFirstCue: true,
      aFinishedCueCoversItsWholeDisplacement: true,
      aRunningCueCoversItsEasedPart: true,
      aCueBeyondTheSampledTimeIsNotReached: true,
      aSampledZeroCoversNothingAtAll: true,
      aStepCueDeliversAtItsEndAndNotBefore: true,
      anotherUnitsCueIsNotThisUnits: true,
    },
  );

  const idle = perform([]).at(3);
  const held = perform([cue({ action: "hold" })]).at(3);
  const lead = regenerateFormationSlot(formation, 0);
  const trail = regenerateFormationSlot(formation, 5);
  /**
   * How far one member stands from the origin its unit turns about.
   *
   * The same distance the vertex stage reads out of the instance matrix, taken
   * here from the placement the compiler derived rather than from the buffer,
   * so the two have to agree about a member rather than about a number.
   */
  const radiusOf = (slot: number): number => {
    const member = regenerateFormationSlot(formation, slot);
    return Math.hypot(
      member.position.x - formation.anchor.x,
      member.position.z - formation.anchor.z,
    );
  };
  TestValidator.equals(
    "a unit that covers no ground does not cycle",
    namedFacts([
      [
        "aUnitWithNoCueStandsStill",
        () => nclose(idle.advance, 0) && nclose(idle.turn, 0),
      ],
      [
        "itStandsInTheGaitItsFigureDeclaresFirst",
        () => idle.gait === "advance",
      ],
      [
        "aHeldUnitStandsStill",
        () => nclose(held.advance, 0) && nclose(held.turn, 0),
      ],
      [
        "aHeldUnitPerformsItsFiguresDefault",
        () => held.gait === "advance" && walking.takes.has("hold") === false,
      ],
      [
        "membersKeepTheirOwnPhases",
        () => lead.motionPhase !== trail.motionPhase,
      ],
      [
        "aStandingMemberStandsAtItsOwnPhase",
        () =>
          nclose(
            formationCyclePosition(idle, lead.motionPhase),
            lead.motionPhase,
          ) &&
          nclose(
            formationCyclePosition(idle, trail.motionPhase),
            trail.motionPhase,
          ),
      ],
      [
        "standingMembersStillDiffer",
        () =>
          formationCyclePosition(idle, lead.motionPhase) !==
          formationCyclePosition(idle, trail.motionPhase),
      ],
    ]),
    {
      aUnitWithNoCueStandsStill: true,
      itStandsInTheGaitItsFigureDeclaresFirst: true,
      aHeldUnitStandsStill: true,
      aHeldUnitPerformsItsFiguresDefault: true,
      membersKeepTheirOwnPhases: true,
      aStandingMemberStandsAtItsOwnPhase: true,
      standingMembersStillDiffer: true,
    },
  );

  const marching = perform([cue({ to: place(3, 4) })]);
  const covered = marching.at(4);
  const halfway = marching.at(2);
  const faster = perform([cue({ to: place(6, 8) })]).at(4);
  TestValidator.equals(
    "the ground a unit covers is what turns its members' cycles",
    namedFacts([
      ["oneTurnPerStrideOfGround", () => nclose(covered.advance, 5 / stride)],
      [
        "twiceTheGroundIsTwiceTheCycle",
        () => nclose(faster.advance, 10 / stride),
      ],
      ["halfTheCueIsHalfTheCycle", () => nclose(halfway.advance, 2.5 / stride)],
      ["travellingStraightNeverTurns", () => nclose(covered.turn, 0)],
      [
        "theStrideIsOneAFigureThatSizeCouldTake",
        () => stride > 1.8 * 0.2 && stride < 1.8 * 1.2,
      ],
      [
        "aMemberIsCarriedThroughItsCycle",
        () =>
          nclose(
            formationCyclePosition(covered, lead.motionPhase),
            fraction(lead.motionPhase + 5 / stride),
          ),
      ],
    ]),
    {
      oneTurnPerStrideOfGround: true,
      twiceTheGroundIsTwiceTheCycle: true,
      halfTheCueIsHalfTheCycle: true,
      travellingStraightNeverTurns: true,
      theStrideIsOneAFigureThatSizeCouldTake: true,
      aMemberIsCarriedThroughItsCycle: true,
    },
  );

  const named = perform([cue({ gait: "charge", to: place(0, 5) })]).at(4);
  const labelled = perform([cue({ action: "charge", to: place(0, 5) })]).at(4);
  const changing = perform([
    cue({ id: "opening", start: 0, end: 4, to: place(0, 5) }),
    cue({
      id: "closing",
      start: 4,
      end: 8,
      gait: "charge",
      from: place(0, 5),
      to: place(0, 15),
    }),
  ]);
  const opened = changing.at(4);
  const closed = changing.at(8);
  TestValidator.equals(
    "a cue says which cycle a unit performs, and a change keeps what it turned",
    namedFacts([
      ["aNamedGaitIsTheGaitPerformed", () => named.gait === "charge"],
      [
        "aNamedGaitCyclesOnItsOwnStride",
        () => nclose(named.advance, 5 / charge),
      ],
      ["aCapabilityLabelNamesAGaitToo", () => labelled.gait === "charge"],
      [
        "theTwoWaysOfNamingAgree",
        () => nclose(labelled.advance, named.advance),
      ],
      ["twoGaitsAreTwoStrides", () => charge !== stride],
      [
        "twoGaitsAreTwoTables",
        () =>
          walking.takes.get("charge")!.texture !==
          walking.takes.get("advance")!.texture,
      ],
      ["theFirstActionRunsFirst", () => opened.gait === "advance"],
      ["theSecondActionRunsNext", () => closed.gait === "charge"],
      [
        "aChangeOfActionKeepsEveryTurnAlreadyTaken",
        () => nclose(closed.advance, 5 / stride + 10 / charge),
      ],
    ]),
    {
      aNamedGaitIsTheGaitPerformed: true,
      aNamedGaitCyclesOnItsOwnStride: true,
      aCapabilityLabelNamesAGaitToo: true,
      theTwoWaysOfNamingAgree: true,
      twoGaitsAreTwoStrides: true,
      twoGaitsAreTwoTables: true,
      theFirstActionRunsFirst: true,
      theSecondActionRunsNext: true,
      aChangeOfActionKeepsEveryTurnAlreadyTaken: true,
    },
  );

  const resting = perform([cue({ gait: "idle", action: "hold" })]);
  const inside = resting.at(3);
  const after = resting.at(6);
  TestValidator.equals(
    "a cycle no ground drives runs on its own declared period",
    namedFacts([
      [
        "aStandingCycleCarriesNobodyAnywhere",
        () => walking.takes.get("idle")!.strideMeters === 0,
      ],
      ["itRunsOnItsGaitsPeriod", () => nclose(inside.advance, 3 / 2)],
      ["itKeepsRunningAfterItsCueEnds", () => nclose(after.advance, 6 / 2)],
      ["itNeverTurnsWithTheGround", () => nclose(after.turn, 0)],
      ["itIsStillTheGaitTheCueNamed", () => after.gait === "idle"],
    ]),
    {
      aStandingCycleCarriesNobodyAnywhere: true,
      itRunsOnItsGaitsPeriod: true,
      itKeepsRunningAfterItsCueEnds: true,
      itNeverTurnsWithTheGround: true,
      itIsStillTheGaitTheCueNamed: true,
    },
  );

  const wheeling = perform([
    cue({ action: "wheel", to: { ...place(), facingOffsetDeg: 90 } }),
  ]);
  const wheeled = wheeling.at(4);
  const inner = radiusOf(1);
  const outer = radiusOf(7);
  TestValidator.equals(
    "a turning unit carries every member over that member's own arc",
    namedFacts([
      ["turningCoversNoTravel", () => nclose(wheeled.advance, 0)],
      [
        "aQuarterTurnIsAQuarterCircleOfGround",
        () => nclose(wheeled.turn, Math.PI / 2 / stride),
      ],
      ["theUnitIsWideEnoughToTellFilesApart", () => outer > inner],
      [
        "aMemberTurnsThroughItsOwnRadius",
        () =>
          nclose(
            formationCyclePosition(wheeled, 0, outer),
            fraction(outer * wheeled.turn),
          ),
      ],
      [
        "theOuterFileStepsMoreThanTheInner",
        () =>
          outer * wheeled.turn - inner * wheeled.turn >
          Number.EPSILON * outer * wheeled.turn,
      ],
      [
        "theVertexStageReadsThatRadiusFromTheInstanceMatrix",
        () =>
          wheeling.vertexShader.includes("length(instanceMatrix[3].xz)") &&
          wheeling.vertexShader.includes(
            "automovieCycleRadius() * automovieCycleTurn",
          ),
      ],
    ]),
    {
      turningCoversNoTravel: true,
      aQuarterTurnIsAQuarterCircleOfGround: true,
      theUnitIsWideEnoughToTellFilesApart: true,
      aMemberTurnsThroughItsOwnRadius: true,
      theOuterFileStepsMoreThanTheInner: true,
      theVertexStageReadsThatRadiusFromTheInstanceMatrix: true,
    },
  );

  const repeated = perform([cue({ to: place(3, 4) })]);
  const first = repeated.at(3);
  repeated.at(1);
  const revisited = repeated.at(3);
  const rebuilt = perform([cue({ to: place(3, 4) })]).at(3);
  TestValidator.equals(
    "the same cues at the same time always draw the same frame",
    namedFacts([
      [
        "revisitingATimeReturnsTheSameCadence",
        () =>
          revisited.advance === first.advance && revisited.turn === first.turn,
      ],
      [
        "aRebuiltUnitCyclesIdentically",
        () => rebuilt.advance === first.advance && rebuilt.turn === first.turn,
      ],
      [
        "aRestedUnitIsBackAtTheTopOfItsCycle",
        () => nclose(repeated.at().advance, 0),
      ],
      [
        "aGaitNoFigureDeclaresIsRefused",
        () =>
          throwsError(
            () =>
              buildInstancedFormation({
                formation,
                models,
                motions: [cue({ gait: "amble" })],
              }),
            ["amble", "no runtime model"],
          ),
      ],
    ]),
    {
      revisitingATimeReturnsTheSameCadence: true,
      aRebuiltUnitCyclesIdentically: true,
      aRestedUnitIsBackAtTheTopOfItsCycle: true,
      aGaitNoFigureDeclaresIsRefused: true,
    },
  );
};

/** One unit state at a world-space displacement from where it was designed. */
const place = (x = 0, z = 0): IAutoMovieFormationMotionState => ({
  translation: { x, y: 0, z },
  facingOffsetDeg: 0,
  spacingScale: { lateral: 1, depth: 1 },
});

const fraction = (value: number): number => value - Math.floor(value);

/**
 * A repertoire of three cycles on one figure.
 *
 * Two of them carry the body: the same rows at two amplitudes, so one covers
 * more ground per turn than the other and the two cannot be confused. The third
 * moves only what never touches the ground, which is what a cycle that carries
 * a body nowhere looks like in data.
 */
const travelling = (
  name: string,
  period: number,
  amplitude: number,
): IAutoMovieGait => ({
  name,
  period,
  limbs: [
    { bone: "leftUpperLeg", phase: 0, duty: 0.55, amplitude },
    { bone: "rightUpperLeg", phase: 0.5, duty: 0.55, amplitude },
    {
      bone: "leftLowerLeg",
      phase: 0.25,
      duty: 0.5,
      amplitude: amplitude * 0.6,
      neutral: 22,
    },
    {
      bone: "rightLowerLeg",
      phase: 0.75,
      duty: 0.5,
      amplitude: amplitude * 0.6,
      neutral: 22,
    },
  ],
});

const REPERTOIRE: IAutoMovieProfile = {
  id: "cadence-repertoire",
  name: "cadence-repertoire",
  controls: [],
  drivers: [],
  limits: [],
  gaits: [
    travelling("advance", 1, 24),
    travelling("charge", 0.6, 40),
    {
      name: "idle",
      period: 2,
      limbs: [
        { bone: "leftUpperArm", phase: 0, duty: 0.5, amplitude: 6 },
        { bone: "rightUpperArm", phase: 0.5, duty: 0.5, amplitude: 6 },
      ],
    },
  ],
};

/**
 * Run one material's compile hook over a minimal three-shaped vertex stage.
 *
 * No GL context exists here and none is needed: what the hook does is rewrite
 * the include sites, and that is observable as a plain string.
 */
const injectedVertexShader = (mesh: THREE.InstancedMesh): string => {
  const material = Array.isArray(mesh.material)
    ? mesh.material[0]!
    : mesh.material;
  const shader = {
    uniforms: {} as Record<string, { value: unknown } | undefined>,
    vertexShader: [
      "#include <common>",
      "void main() {",
      "  #include <beginnormal_vertex>",
      "  #include <begin_vertex>",
      "}",
    ].join("\n"),
    fragmentShader: "void main() {}",
  };
  material.onBeforeCompile(
    shader as unknown as Parameters<THREE.Material["onBeforeCompile"]>[0],
    null as unknown as Parameters<THREE.Material["onBeforeCompile"]>[1],
  );
  return shader.vertexShader;
};
