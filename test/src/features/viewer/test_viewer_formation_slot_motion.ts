import { placeFormationSlot } from "@automovie/engine";
import type {
  IAutoMovieFormationMotion,
  IAutoMovieFormationSlotMotion,
  IAutoMovieModelRecipe,
} from "@automovie/interface";
import {
  materializeCompiledFormation,
  materializeProductionModels,
} from "@automovie/mcp";
import {
  buildInstancedFormation,
  regenerateFormationSlot,
  sampleFormationMotion,
  sampleFormationSlotMotion,
} from "@automovie/viewer";
import { TestValidator } from "@nestia/e2e";
import * as THREE from "three";

import { namedFacts, nclose, vclose } from "../internal/predicates";
import { formationDesign, modelRecipe } from "../mcp/productionFixtures";

/**
 * A member of a crowd may do what its neighbours do not, on screen as well.
 *
 * A gate that reads a per-member cue and a renderer that does not would put a
 * review frame and the film it is meant to prove into disagreement, which is
 * the one failure this channel cannot be allowed to introduce. So the renderer
 * is checked against the same engine placement the gate reads, and the crowd
 * nobody singled out is checked to be exactly the crowd that was drawn before.
 *
 * Scenarios:
 *
 * 1. A crowd with no per-member cue draws exactly the instances it drew before the
 *    channel existed, at every sampled time.
 * 2. A named member's instance matches its neighbours before its cue and leaves
 *    them behind afterwards, while the neighbours never move.
 * 3. The drawn world placement of a named member is the engine's own composed
 *    answer, including the unit's travel, turn and spacing.
 * 4. A removed member is drawn at zero scale, counted apart from culling, and
 *    keeps the viewer's anonymous inventory adding up.
 * 5. The same compiled crowd and the same cues reproduce the same instance
 *    matrices.
 * 6. A cue naming a member the batches do not hold — a promoted hero, or an index
 *    past the unit — singles nobody out, and a frame drawn without a time reads
 *    the cues at zero.
 */
export const test_viewer_formation_slot_motion = (): void => {
  const recipe: IAutoMovieModelRecipe = {
    ...modelRecipe(),
    id: "member",
    role: "prop",
    archetype: "primitive-prop",
    parameters: { shape: "box", width: 0.4, height: 0.8, depth: 0.4 },
    capabilities: [],
    lod: [{ tier: "near", maxDistance: null, recipe: "member" }],
  };
  const recipes = new Map([[recipe.id, recipe]]);
  const design = {
    ...formationDesign({
      kind: "line" as const,
      ranks: 2,
      files: 4,
      spacing: { lateral: 1, depth: 1 },
    }),
    id: "crowd",
    modelRecipe: recipe.id,
    count: 8,
    heroOverrides: [],
  };
  const formation = materializeCompiledFormation(design, recipes);
  const models = new Map(
    [...materializeProductionModels(recipes).values()].map((model) => [
      model.id,
      model,
    ]),
  );

  /** The unit as a whole travels, turns and tightens across four seconds. */
  const advance: IAutoMovieFormationMotion = {
    id: "crowd-advance",
    formation: formation.id,
    action: "advance",
    start: 0,
    end: 4,
    from: {
      translation: { x: 0, y: 0, z: 0 },
      facingOffsetDeg: 0,
      spacingScale: { lateral: 1, depth: 1 },
    },
    to: {
      translation: { x: 0, y: 0, z: 5 },
      facingOffsetDeg: 40,
      spacingScale: { lateral: 1.25, depth: 0.8 },
    },
    easing: "linear",
  };
  /** One member steps out of the unit and turns away from it. */
  const aside: IAutoMovieFormationSlotMotion = {
    id: "crowd-aside",
    formation: formation.id,
    slots: [2],
    start: 1,
    end: 3,
    from: { present: true, offset: { x: 0, y: 0, z: 0 }, facingOffsetDeg: 0 },
    to: {
      present: true,
      offset: { x: 0, y: 0, z: -4 },
      facingOffsetDeg: 50,
    },
    easing: "linear",
  };
  /** Another member stops being drawn at two seconds and never returns. */
  const departs: IAutoMovieFormationSlotMotion = {
    id: "crowd-departure",
    formation: formation.id,
    slots: [5],
    start: 2,
    end: 3,
    from: { present: false, offset: { x: 0, y: 0, z: 0 }, facingOffsetDeg: 0 },
    to: { present: false, offset: { x: 0, y: 0, z: 0 }, facingOffsetDeg: 0 },
    easing: "step",
  };

  const camera = new THREE.PerspectiveCamera(50, 16 / 9, 0.1, 400);
  camera.position.set(0, 4, -18);
  camera.lookAt(0, 0, 2);
  const build = (slotMotions?: readonly IAutoMovieFormationSlotMotion[]) =>
    buildInstancedFormation({
      formation,
      models,
      motions: [advance],
      ...(slotMotions === undefined ? {} : { slotMotions }),
    });
  /** The one instance mesh this single-chunk, single-tier crowd draws. */
  const mesh = (built: ReturnType<typeof build>): THREE.InstancedMesh =>
    built.object.children.find(
      (object): object is THREE.InstancedMesh =>
        object instanceof THREE.InstancedMesh,
    )!;
  const matrixOf = (
    built: ReturnType<typeof build>,
    slot: number,
  ): THREE.Matrix4 => {
    const matrix = new THREE.Matrix4();
    mesh(built).getMatrixAt(slot, matrix);
    return matrix;
  };
  const matrices = (built: ReturnType<typeof build>): string =>
    Array.from({ length: formation.count }, (_, slot) =>
      matrixOf(built, slot).elements.join(","),
    ).join("|");
  const worldOf = (
    built: ReturnType<typeof build>,
    slot: number,
  ): { x: number; y: number; z: number } =>
    built.object.localToWorld(
      new THREE.Vector3().setFromMatrixPosition(matrixOf(built, slot)),
    );
  const worldYawOf = (built: ReturnType<typeof build>, slot: number): number =>
    THREE.MathUtils.radToDeg(
      new THREE.Euler().setFromQuaternion(
        built.object.quaternion
          .clone()
          .multiply(
            new THREE.Quaternion().setFromRotationMatrix(matrixOf(built, slot)),
          ),
        "YXZ",
      ).y,
    );

  const times = [0, 0.5, 1, 2, 3, 4];
  const untouched = build();
  const declaredEmpty = build([]);
  const someoneElse = build([{ ...aside, formation: "other-crowd" }]);
  const readings = times.map((time) => {
    for (const built of [untouched, declaredEmpty, someoneElse])
      built.update(camera, 720, time);
    return [
      matrices(untouched),
      matrices(declaredEmpty),
      matrices(someoneElse),
    ] as const;
  });
  TestValidator.equals(
    "a crowd nobody singled out draws exactly the instances it drew before",
    namedFacts([
      [
        "anEmptyChannelDrawsWhatNoChannelDraws",
        () => readings.every(([none, empty]) => none === empty),
      ],
      [
        "aChannelForAnotherUnitDrawsTheSameToo",
        () => readings.every(([none, , other]) => none === other),
      ],
      [
        "theCrowdIsActuallyDrawnRatherThanEmpty",
        () => mesh(untouched).count === formation.count,
      ],
      [
        "nothingIsCountedAsRemoved",
        () =>
          untouched.stats.removed === 0 && declaredEmpty.stats.removed === 0,
      ],
    ]),
    {
      anEmptyChannelDrawsWhatNoChannelDraws: true,
      aChannelForAnotherUnitDrawsTheSameToo: true,
      theCrowdIsActuallyDrawnRatherThanEmpty: true,
      nothingIsCountedAsRemoved: true,
    },
  );

  const singled = build([aside, departs]);
  singled.update(camera, 720, 1);
  untouched.update(camera, 720, 1);
  const neighbourSlots = [1, 3, 4, 6];
  const reading = (slot: number) =>
    [
      matrixOf(singled, slot).elements.join(","),
      matrixOf(untouched, slot).elements.join(","),
    ] as const;
  const beforeSingled = reading(2);
  const beforeNeighbours = neighbourSlots.map(reading);
  singled.update(camera, 720, 3);
  untouched.update(camera, 720, 3);
  const afterSingled = reading(2);
  const afterNeighbours = neighbourSlots.map(reading);
  TestValidator.equals(
    "a named member holds its place until its cue and leaves it afterwards",
    namedFacts([
      [
        "itStandsWithTheCrowdBeforeItsCue",
        () => beforeSingled[0] === beforeSingled[1],
      ],
      [
        "itHasLeftThatPlaceAfterwards",
        () => afterSingled[0] !== afterSingled[1],
      ],
      [
        "itsNeighboursNeverDeviateBefore",
        () => beforeNeighbours.every(([left, right]) => left === right),
      ],
      [
        "itsNeighboursNeverDeviateAfterwardsEither",
        () => afterNeighbours.every(([left, right]) => left === right),
      ],
    ]),
    {
      itStandsWithTheCrowdBeforeItsCue: true,
      itHasLeftThatPlaceAfterwards: true,
      itsNeighboursNeverDeviateBefore: true,
      itsNeighboursNeverDeviateAfterwardsEither: true,
    },
  );

  singled.update(camera, 720, 2);
  const unitState = sampleFormationMotion([advance], formation.id, 2);
  const memberState = sampleFormationSlotMotion([aside], formation.id, 2, 2);
  const expected = placeFormationSlot({
    position: regenerateFormationSlot(formation, 2).position,
    facingDeg: formation.facingDeg,
    anchor: formation.anchor,
    baseFacingDeg: formation.facingDeg,
    unit: unitState,
    member: memberState,
  });
  const neighbourExpected = placeFormationSlot({
    position: regenerateFormationSlot(formation, 3).position,
    facingDeg: formation.facingDeg,
    anchor: formation.anchor,
    baseFacingDeg: formation.facingDeg,
    unit: unitState,
    member: sampleFormationSlotMotion([aside], formation.id, 3, 2),
  });
  // The same member with no cue of its own, so the reading below is the cue's
  // own contribution rather than the distance between two different members.
  const unsingled = placeFormationSlot({
    position: regenerateFormationSlot(formation, 2).position,
    facingDeg: formation.facingDeg,
    anchor: formation.anchor,
    baseFacingDeg: formation.facingDeg,
    unit: unitState,
    member: sampleFormationSlotMotion([], formation.id, 2, 2),
  });
  TestValidator.equals(
    "what the renderer draws is the engine placement the gates read",
    namedFacts([
      [
        "theSingledMemberIsDrawnWhereTheEnginePlacesIt",
        () => vclose(worldOf(singled, 2), expected.position, 1e-6),
      ],
      [
        "itsHeadingIsTheSumTheEngineReports",
        () => nclose(worldYawOf(singled, 2), expected.facingDeg, 1e-4),
      ],
      [
        "anUnsingledNeighbourStillAgreesToo",
        () => vclose(worldOf(singled, 3), neighbourExpected.position, 1e-6),
      ],
      [
        "theCueHasCarriedItExactlyItsOwnTwoMetres",
        () =>
          nclose(
            Math.hypot(
              expected.position.x - unsingled.position.x,
              expected.position.y - unsingled.position.y,
              expected.position.z - unsingled.position.z,
            ),
            2,
          ),
      ],
    ]),
    {
      theSingledMemberIsDrawnWhereTheEnginePlacesIt: true,
      itsHeadingIsTheSumTheEngineReports: true,
      anUnsingledNeighbourStillAgreesToo: true,
      theCueHasCarriedItExactlyItsOwnTwoMetres: true,
    },
  );

  const inventory = (built: ReturnType<typeof build>): number =>
    built.stats.visible.near +
    built.stats.visible.far +
    built.stats.culled +
    built.stats.removed;
  singled.update(camera, 720, 1.9);
  const presentScale = new THREE.Vector3().setFromMatrixScale(
    matrixOf(singled, 5),
  );
  const presentRemoved = singled.stats.removed;
  const presentInventory = inventory(singled);
  singled.update(camera, 720, 2);
  const absentScale = new THREE.Vector3().setFromMatrixScale(
    matrixOf(singled, 5),
  );
  const absentRemoved = singled.stats.removed;
  const absentInventory = inventory(singled);
  singled.update(camera, 720, 4);
  const laterRemoved = singled.stats.removed;
  TestValidator.equals(
    "a removed member stops being drawn and is counted apart from culling",
    namedFacts([
      ["itIsDrawnAtFullScaleBeforeItLeaves", () => nclose(presentScale.x, 1)],
      ["nothingIsRemovedYet", () => presentRemoved === 0],
      [
        "theInventoryAddsUpWhileEveryoneIsThere",
        () => presentInventory === formation.anonymousCount,
      ],
      ["itIsDrawnAtZeroScaleOnceItLeaves", () => nclose(absentScale.x, 0)],
      ["exactlyOneMemberIsRemoved", () => absentRemoved === 1],
      [
        "theInventoryStillAddsUpWithOneGone",
        () => absentInventory === formation.anonymousCount,
      ],
      ["itStaysRemovedAfterItsCueEnds", () => laterRemoved === 1],
      [
        "itsNeighbourIsStillDrawnAtFullScale",
        () =>
          nclose(
            new THREE.Vector3().setFromMatrixScale(matrixOf(singled, 4)).x,
            1,
          ),
      ],
    ]),
    {
      itIsDrawnAtFullScaleBeforeItLeaves: true,
      nothingIsRemovedYet: true,
      theInventoryAddsUpWhileEveryoneIsThere: true,
      itIsDrawnAtZeroScaleOnceItLeaves: true,
      exactlyOneMemberIsRemoved: true,
      theInventoryStillAddsUpWithOneGone: true,
      itStaysRemovedAfterItsCueEnds: true,
      itsNeighbourIsStillDrawnAtFullScale: true,
    },
  );

  const repeated = build([aside, departs]);
  const original = build([aside, departs]);
  const sampled = times.map((time) => {
    repeated.update(camera, 720, time);
    original.update(camera, 720, time);
    return [matrices(repeated), matrices(original)] as const;
  });
  TestValidator.equals(
    "the same crowd and the same cues reproduce the same instances",
    namedFacts([
      [
        "everySampledTimeAgreesBetweenTwoBuilds",
        () => sampled.every(([left, right]) => left === right),
      ],
      [
        "theTimesAreNotAllTheSameDrawing",
        () => new Set(sampled.map(([left]) => left)).size === times.length,
      ],
    ]),
    {
      everySampledTimeAgreesBetweenTwoBuilds: true,
      theTimesAreNotAllTheSameDrawing: true,
    },
  );

  // A cue may name a member no instance buffer holds. A promoted hero is a
  // scene node rather than an instance, and an index past the unit is not a
  // member at all; the compiler's own gate refuses both, so what is left here
  // is that the renderer locates nobody rather than writing into whatever
  // index the arithmetic happened to land on.
  const withHero = materializeCompiledFormation(
    { ...design, heroOverrides: [{ slot: 3, actor: "captain" }] },
    recipes,
  );
  const strayCues: IAutoMovieFormationSlotMotion[] = [
    { ...aside, id: "crowd-hero-aside", slots: [3] },
    { ...aside, id: "crowd-past-the-end", slots: [design.count + 4] },
  ];
  const strayBuild = (cues: readonly IAutoMovieFormationSlotMotion[]) =>
    buildInstancedFormation({
      formation: withHero,
      models,
      motions: [advance],
      slotMotions: cues,
      // Its own object per build: a hero handed to two units is written by
      // both, and the second unit would then capture whatever the first left
      // behind rather than what this fixture staged.
      heroObjects: new Map([["captain", new THREE.Object3D()]]),
    });
  const strayed = strayBuild(strayCues);
  const unstrayed = strayBuild([]);
  const heroMesh = (built: ReturnType<typeof strayBuild>) =>
    built.object.children.find(
      (object): object is THREE.InstancedMesh =>
        object instanceof THREE.InstancedMesh,
    )!;
  const heroMatrices = (built: ReturnType<typeof strayBuild>): string =>
    Array.from({ length: withHero.anonymousCount }, (_, index) => {
      const matrix = new THREE.Matrix4();
      heroMesh(built).getMatrixAt(index, matrix);
      return matrix.elements.join(",");
    }).join("|");
  strayed.update(camera, 720, 3);
  unstrayed.update(camera, 720, 3);
  const strayedDrawing = heroMatrices(strayed);
  // Drawn with no time at all: the cues are read at zero, which for these two
  // is before they start, so the crowd stands exactly where a frame at zero
  // puts it rather than where the frame just before it did.
  const timeless = strayBuild([aside]);
  timeless.update(camera, 720);
  const timelessDrawing = heroMatrices(timeless);
  const zeroed = strayBuild([aside]);
  zeroed.update(camera, 720, 0);
  const later = strayBuild([aside]);
  later.update(camera, 720, 3);
  TestValidator.equals(
    "a cue naming a member no batch holds singles nobody out",
    namedFacts([
      [
        "aHeroAndAnOutOfRangeIndexChangeNothing",
        () => strayedDrawing === heroMatrices(unstrayed),
      ],
      ["nobodyIsCountedRemoved", () => strayed.stats.removed === 0],
      [
        "theHeroIsStillPromotedOutOfTheBatch",
        () => heroMesh(strayed).count === withHero.anonymousCount,
      ],
      [
        "aFrameWithNoTimeReadsTheCuesAtZero",
        () => timelessDrawing === heroMatrices(zeroed),
      ],
      // Negative twin: the same crowd under the same cue draws differently at
      // three seconds, so agreeing with zero is a claim about the default the
      // frame took and not about the drawing being the same at every instant.
      [
        "andZeroIsNotJustAnyTime",
        () => timelessDrawing !== heroMatrices(later),
      ],
    ]),
    {
      aHeroAndAnOutOfRangeIndexChangeNothing: true,
      nobodyIsCountedRemoved: true,
      theHeroIsStillPromotedOutOfTheBatch: true,
      aFrameWithNoTimeReadsTheCuesAtZero: true,
      andZeroIsNotJustAnyTime: true,
    },
  );
};
