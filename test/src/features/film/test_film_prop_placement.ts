import { validatePropPlacements } from "@automovie/engine";
import {
  IAutoMovieBuiltEnvironment,
  IAutoMoviePropSpec,
  IAutoMovieStageSetPiece,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { namedFacts } from "../internal/predicates";
import {
  inSpace,
  propEnvironment,
  propRegistry,
  propSet,
  sculpture,
} from "./propPlacementFixtures";

const TABLE = 0;
const LAMP = 1;
const SCONCE = 2;
const CHARGER = 3;
const PENDANT = 4;
const CHIME = 5;
const CABINET = 6;
const DOOR = 7;
const CRATE = 8;
const SCULPTURE = 9;

const validate = (
  props: IAutoMoviePropSpec[] = propRegistry(),
  set: IAutoMovieStageSetPiece[] = propSet(),
  builtEnvironments: IAutoMovieBuiltEnvironment[] = [propEnvironment()],
) => validatePropPlacements({ props, set, builtEnvironments });

/**
 * A mutated registry must fail at `path`, and with `message` when one is given.
 *
 * The mutation runs against a fresh registry every time, so a case never
 * inherits the damage of the one before it.
 */
const violated = (
  mutate: (
    props: IAutoMoviePropSpec[],
    set: IAutoMovieStageSetPiece[],
    environments: IAutoMovieBuiltEnvironment[],
  ) => void,
  path: string,
  message?: string,
): boolean => {
  const props = propRegistry();
  const set = propSet();
  const environments = [propEnvironment()];
  mutate(props, set, environments);
  const result = validate(props, set, environments);
  return (
    result.success === false &&
    result.violations.some(
      (item) =>
        item.path === path &&
        (message === undefined || item.expected.includes(message)),
    )
  );
};

/** The same mutation, asserted to leave the registry valid. */
const tolerated = (
  mutate: (
    props: IAutoMoviePropSpec[],
    set: IAutoMovieStageSetPiece[],
    environments: IAutoMovieBuiltEnvironment[],
  ) => void,
): boolean => {
  const props = propRegistry();
  const set = propSet();
  const environments = [propEnvironment()];
  mutate(props, set, environments);
  return validate(props, set, environments).success;
};

/**
 * Semantic prop placement resolves order-independently, judges every relation
 * the architecture graph can answer for, and refuses only what it can measure.
 *
 * Scenarios:
 *
 * 1. A furnished room exercising all six relation kinds against both the building
 *    graph and other props passes, as does its reversal, a legacy registry that
 *    declares no placement at all, and the empty registry.
 * 2. Prop, set-piece, and environment identity failures, a missing or forged
 *    staged join, and a staged model that contradicts the spec are located at
 *    the field that authored the contradiction.
 * 3. Each relation kind refuses a target kind it does not accept, and every
 *    citation (space, element, boundary, opening, surface, prop, affordance)
 *    has a missing, ambiguous, wrong-kind, or cross-environment negative twin.
 * 4. A prop occupies at most one space and fills at most one opening, a relation
 *    cannot be declared twice for the same target, and a support graph closing
 *    on itself is refused both directly and through a cycle.
 * 5. Footprint and clearance boxes are gated on all three axes before any geometry
 *    runs, and an invalid box does not make the geometry pass throw.
 * 6. Containment, opening fit, prop overlap, clearance intrusion, and blocked
 *    opening and connector each fail once and are each paired with the adjacent
 *    case where they must not fire: exact contact, a declared contact pair, a
 *    cell-less space, an unfilled opening, and a prop that declares no
 *    placement at all.
 */
export const test_film_prop_placement = (): void => {
  TestValidator.equals("the furnished room resolves", validate().success, true);
  TestValidator.equals(
    "forward references are declaration-order independent",
    validate(propRegistry().reverse(), propSet().reverse()).success,
    true,
  );
  TestValidator.equals(
    "a legacy registry without placements stays compatible",
    validate([sculpture()], [propSet()[SCULPTURE]!], []).success,
    true,
  );
  TestValidator.equals(
    "empty registries stay compatible",
    validate([], [], []).success,
    true,
  );

  TestValidator.equals(
    "identity, relation, box and geometry failures are located",
    namedFacts([
      // 2. identity and the staged join.
      [
        "duplicateProp",
        () =>
          violated(
            (props) => props.push(props[TABLE]!),
            "$input.props[10].node",
            "duplicated",
          ),
      ],
      [
        "ambiguousSupportingProp",
        () =>
          violated(
            (props) => props.push(props[TABLE]!),
            "$input.props[1].placement.relations[1].target.prop",
            "ambiguous",
          ),
      ],
      [
        "duplicateSet",
        () =>
          violated(
            (_props, set) => set.push(set[TABLE]!),
            "$input.set[10].node",
            "duplicated",
          ),
      ],
      [
        "duplicateEnvironment",
        () =>
          violated(
            (_p, _s, environments) => environments.push(propEnvironment()),
            "$input.builtEnvironments[1].id",
            "duplicated",
          ),
      ],
      [
        "ambiguousEnvironment",
        () =>
          violated(
            (_p, _s, environments) => environments.push(propEnvironment()),
            "$input.props[0].placement.relations[0].target.environment",
            "ambiguous",
          ),
      ],
      [
        "forgeFailure",
        () =>
          violated(
            (props) => (props[TABLE]!.model.id = "wrong"),
            "$input.props[0].model.id",
          ),
      ],
      [
        "missingStagedPiece",
        () =>
          violated(
            (_props, set) => set.splice(LAMP, 1),
            "$input.props[1].node",
            "needs one staged set placement",
          ),
      ],
      [
        "stagedModelMismatch",
        () =>
          violated(
            (_props, set) => (set[LAMP]!.model = "wrong"),
            "$input.set[1].model",
            "instead of",
          ),
      ],
      // 3. relation shape and citations.
      [
        "unacceptedTargetKind",
        () =>
          violated(
            (props) =>
              (props[TABLE]!.placement!.relations[0] = {
                kind: "in-space",
                target: {
                  kind: "element",
                  environment: "house",
                  element: "wall",
                },
              }),
            "$input.props[0].placement.relations[0].target.kind",
            'does not accept a "element" target',
          ),
      ],
      [
        "unacceptedPropAffordanceTarget",
        () =>
          violated(
            (props) =>
              (props[DOOR]!.placement!.relations[1] = {
                kind: "fill-opening",
                target: {
                  kind: "prop-affordance",
                  prop: "table",
                  affordance: "top",
                },
              }),
            "$input.props[7].placement.relations[1].target.kind",
            'does not accept a "prop-affordance" target',
          ),
      ],
      [
        "missingEnvironment",
        () =>
          violated(
            (props) => {
              const target = props[TABLE]!.placement!.relations[0]!.target;
              if (target.kind === "space") target.environment = "missing";
            },
            "$input.props[0].placement.relations[0].target.environment",
            "does not resolve",
          ),
      ],
      [
        "missingSpace",
        () =>
          violated(
            (props) => {
              const target = props[TABLE]!.placement!.relations[0]!.target;
              if (target.kind === "space") target.space = "missing";
            },
            "$input.props[0].placement.relations[0].target.space",
            "does not resolve",
          ),
      ],
      [
        "missingElement",
        () =>
          violated(
            (props) => {
              const target = props[SCONCE]!.placement!.relations[1]!.target;
              if (target.kind === "element") target.element = "missing";
            },
            "$input.props[2].placement.relations[1].target.element",
            "does not resolve",
          ),
      ],
      [
        "missingBoundary",
        () =>
          violated(
            (props) => {
              const target = props[CABINET]!.placement!.relations[1]!.target;
              if (target.kind === "boundary") target.boundary = "missing";
            },
            "$input.props[6].placement.relations[1].target.boundary",
            "does not resolve",
          ),
      ],
      [
        "missingOpening",
        () =>
          violated(
            (props) => {
              const target = props[DOOR]!.placement!.relations[1]!.target;
              if (target.kind === "opening") target.opening = "missing";
            },
            "$input.props[7].placement.relations[1].target.opening",
            "does not resolve",
          ),
      ],
      [
        "missingSurface",
        () =>
          violated(
            (props) => {
              const target = props[TABLE]!.placement!.relations[1]!.target;
              if (target.kind === "surface") target.surface = "missing";
            },
            "$input.props[0].placement.relations[1].target.surface",
            "does not resolve",
          ),
      ],
      [
        "crossEnvironmentRelation",
        () =>
          violated(
            (props, _set, environments) => {
              environments.push(propEnvironment("annexe"));
              const target = props[SCONCE]!.placement!.relations[1]!.target;
              if (target.kind === "element") target.environment = "annexe";
            },
            "$input.props[2].placement.relations[1].target.environment",
            "differs from occupied space environment",
          ),
      ],
      [
        "selfSupport",
        () =>
          violated(
            (props) => {
              const target = props[LAMP]!.placement!.relations[1]!.target;
              if (target.kind === "prop-affordance") target.prop = "lamp";
            },
            "$input.props[1].placement.relations[1].target.prop",
            "cannot rest on",
          ),
      ],
      [
        "missingSupportingProp",
        () =>
          violated(
            (props) => {
              const target = props[LAMP]!.placement!.relations[1]!.target;
              if (target.kind === "prop-affordance") target.prop = "missing";
            },
            "$input.props[1].placement.relations[1].target.prop",
            "does not resolve",
          ),
      ],
      [
        "missingAffordance",
        () =>
          violated(
            (props) => {
              const target = props[LAMP]!.placement!.relations[1]!.target;
              if (target.kind === "prop-affordance")
                target.affordance = "missing";
            },
            "$input.props[1].placement.relations[1].target.affordance",
            "does not resolve",
          ),
      ],
      [
        "wrongAffordanceKindForSupport",
        () =>
          violated(
            (props) => {
              const target = props[LAMP]!.placement!.relations[1]!.target;
              if (target.kind === "prop-affordance") target.affordance = "plug";
            },
            "$input.props[1].placement.relations[1].target.affordance",
            'needs a "stack-top" affordance',
          ),
      ],
      [
        "wrongAffordanceKindForAttachment",
        () =>
          violated(
            (props) => {
              const target = props[CHARGER]!.placement!.relations[1]!.target;
              if (target.kind === "prop-affordance") target.affordance = "peg";
            },
            "$input.props[3].placement.relations[1].target.affordance",
            'needs a "socket" affordance',
          ),
      ],
      [
        "wrongAffordanceKindForSuspension",
        () =>
          violated(
            (props) => {
              const target = props[CHIME]!.placement!.relations[1]!.target;
              if (target.kind === "prop-affordance") target.affordance = "top";
            },
            "$input.props[5].placement.relations[1].target.affordance",
            'needs a "hook" affordance',
          ),
      ],
      [
        "supportingPropInAnotherEnvironment",
        () =>
          violated(
            (props, _set, environments) => {
              environments.push(propEnvironment("annexe"));
              props[TABLE]!.placement!.relations[0] = inSpace("room", "annexe");
            },
            "$input.props[1].placement.relations[1].target.prop",
            "occupies environment",
          ),
      ],
      // 4. relation multiplicity and the support graph.
      [
        "duplicateRelation",
        () =>
          violated(
            (props) =>
              props[SCONCE]!.placement!.relations.push(
                props[SCONCE]!.placement!.relations[1]!,
              ),
            "$input.props[2].placement.relations[2]",
            "declared twice",
          ),
      ],
      [
        "secondOccupiedSpace",
        () =>
          violated(
            (props) =>
              props[SCONCE]!.placement!.relations.push(inSpace("annex")),
            "$input.props[2].placement.relations[2].kind",
            "at most one logical space",
          ),
      ],
      [
        "secondFilledOpening",
        () =>
          violated(
            (props) =>
              props[DOOR]!.placement!.relations.push({
                kind: "fill-opening",
                target: {
                  kind: "opening",
                  environment: "house",
                  opening: "arch",
                },
              }),
            "$input.props[7].placement.relations[2].kind",
            "at most one opening",
          ),
      ],
      [
        "filledOpeningInAnotherEnvironment",
        () =>
          violated(
            (props, _set, environments) => {
              environments.push(propEnvironment("annexe"));
              const target = props[DOOR]!.placement!.relations[1]!.target;
              if (target.kind === "opening") target.environment = "annexe";
            },
            "$input.props[7].placement.relations[1].target.environment",
            "differs from occupied space environment",
          ),
      ],
      [
        "supportCycle",
        () =>
          violated(
            (props) => {
              props[TABLE]!.placement!.relations.push({
                kind: "on-support",
                target: {
                  kind: "prop-affordance",
                  prop: "lamp",
                  affordance: "top",
                },
              });
            },
            "$input.props[1].placement.relations[1].target.prop",
            "forms a cycle",
          ),
      ],
      // 5. box gates.
      [
        "footprintAxis",
        () =>
          violated(
            (props) => (props[CABINET]!.placement!.footprint!.max.x = -1),
            "$input.props[6].placement.footprint.x",
            "min < max",
          ),
      ],
      [
        "blankClearanceId",
        () =>
          violated(
            (props) => (props[LAMP]!.placement!.clearance[0]!.id = " "),
            "$input.props[1].placement.clearance[0].id",
            "non-empty",
          ),
      ],
      [
        "duplicateClearanceId",
        () =>
          violated(
            (props) =>
              props[LAMP]!.placement!.clearance.push(
                props[LAMP]!.placement!.clearance[0]!,
              ),
            "$input.props[1].placement.clearance[1].id",
            "duplicated",
          ),
      ],
      [
        "clearanceXOrder",
        () =>
          violated(
            (props) => (props[LAMP]!.placement!.clearance[0]!.max.x = -1),
            "$input.props[1].placement.clearance[0].x",
          ),
      ],
      [
        "clearanceYNotFinite",
        () =>
          violated(
            (props) => (props[LAMP]!.placement!.clearance[0]!.min.y = NaN),
            "$input.props[1].placement.clearance[0].y",
          ),
      ],
      [
        "clearanceZInfinite",
        () =>
          violated(
            (props) => (props[LAMP]!.placement!.clearance[0]!.max.z = Infinity),
            "$input.props[1].placement.clearance[0].z",
          ),
      ],
      // 6. geometry.
      [
        "leavesOccupiedSpace",
        () =>
          violated(
            (_props, set) => (set[PENDANT]!.position = { x: 0, y: 3, z: 12 }),
            "$input.props[4].placement.relations[0].target.space",
            "leaves logical space",
          ),
      ],
      [
        "doorDoesNotFitOpening",
        () =>
          violated(
            (_props, set) => (set[DOOR]!.scale = 3),
            "$input.props[7].placement.relations[1].target.opening",
            "does not fit the fill element",
          ),
      ],
      [
        "spacelessLeafIsStillMeasured",
        () =>
          violated(
            (props, set) => {
              props[DOOR]!.placement!.relations.splice(0, 1);
              set[DOOR]!.scale = 3;
            },
            "$input.props[7].placement.relations[0].target.opening",
            "does not fit the fill element",
          ),
      ],
      [
        "occupancyOverlapsUndeclaredProp",
        () =>
          violated(
            (_props, set) => (set[PENDANT]!.position = { x: 0, y: 2, z: -2 }),
            "$input.props[5].placement.footprint",
            "declares no contact with it",
          ),
      ],
      [
        "clearanceIntersectsProp",
        () =>
          violated(
            (_props, set) =>
              (set[CHARGER]!.position = { x: 1.5, y: 0.9, z: 0 }),
            "$input.props[1].placement.clearance[0]",
            "intersects staged prop",
          ),
      ],
      [
        "blocksOpening",
        () =>
          violated(
            (_props, set) => (set[SCONCE]!.position = { x: 3.9, y: 1, z: 0 }),
            "$input.props[2].placement",
            'blocks opening "doorway"',
          ),
      ],
      [
        "blocksConnector",
        () =>
          violated(
            (_props, set) => (set[SCONCE]!.position = { x: -4.5, y: 1, z: -3 }),
            "$input.props[2].placement",
            'blocks connector "stair"',
          ),
      ],
    ]),
    {
      duplicateProp: true,
      ambiguousSupportingProp: true,
      duplicateSet: true,
      duplicateEnvironment: true,
      ambiguousEnvironment: true,
      forgeFailure: true,
      missingStagedPiece: true,
      stagedModelMismatch: true,
      unacceptedTargetKind: true,
      unacceptedPropAffordanceTarget: true,
      missingEnvironment: true,
      missingSpace: true,
      missingElement: true,
      missingBoundary: true,
      missingOpening: true,
      missingSurface: true,
      crossEnvironmentRelation: true,
      selfSupport: true,
      missingSupportingProp: true,
      missingAffordance: true,
      wrongAffordanceKindForSupport: true,
      wrongAffordanceKindForAttachment: true,
      wrongAffordanceKindForSuspension: true,
      supportingPropInAnotherEnvironment: true,
      duplicateRelation: true,
      secondOccupiedSpace: true,
      secondFilledOpening: true,
      filledOpeningInAnotherEnvironment: true,
      supportCycle: true,
      footprintAxis: true,
      blankClearanceId: true,
      duplicateClearanceId: true,
      clearanceXOrder: true,
      clearanceYNotFinite: true,
      clearanceZInfinite: true,
      leavesOccupiedSpace: true,
      doorDoesNotFitOpening: true,
      spacelessLeafIsStillMeasured: true,
      occupancyOverlapsUndeclaredProp: true,
      clearanceIntersectsProp: true,
      blocksOpening: true,
      blocksConnector: true,
    },
  );

  TestValidator.equals(
    "each refusal has an adjacent case where it must not fire",
    namedFacts([
      [
        "exactContactIsNotOccupancy",
        () =>
          tolerated(
            (_props, set) => (set[PENDANT]!.position = { x: 0, y: 2.6, z: -2 }),
          ),
      ],
      [
        "declaredContactMayOverlap",
        () =>
          tolerated(
            (_props, set) => (set[CHARGER]!.position = { x: 0, y: 0.15, z: 0 }),
          ),
      ],
      [
        "cellLessSpaceContainsAnything",
        () =>
          tolerated(
            (_props, set) =>
              (set[CRATE]!.position = { x: 900, y: 900, z: 900 }),
          ),
      ],
      [
        "unfilledOpeningNeverBlocks",
        () =>
          tolerated((props, set, environments) => {
            environments[0]!.openings[0]!.fill = null;
            props.splice(DOOR, 1);
            set.splice(DOOR, 1);
            set[SCONCE]!.position = { x: 3.9, y: 1, z: 0 };
          }),
      ],
      [
        "unmodelledFillNeverBlocks",
        () =>
          tolerated((props, set, environments) => {
            environments[0]!.models = [];
            props.splice(DOOR, 1);
            set.splice(DOOR, 1);
            set[SCONCE]!.position = { x: 3.9, y: 1, z: 0 };
          }),
      ],
      [
        "placementlessPropIsNeitherJudgedNorCounted",
        () =>
          tolerated(
            (_props, set) =>
              (set[SCULPTURE]!.position = { x: 0, y: 0.3, z: 0.3 }),
          ),
      ],
      [
        "clearanceOverInvalidBoxDoesNotThrow",
        () => {
          const props = propRegistry();
          const set = propSet();
          const environments = [propEnvironment()];
          props[LAMP]!.placement!.clearance[0]!.min.x = NaN;
          set[CHARGER]!.position = { x: 1.5, y: 0.9, z: 0 };
          const result = validate(props, set, environments);
          return (
            result.success === false &&
            result.violations.some(
              (item) =>
                item.path === "$input.props[1].placement.clearance[0].x",
            ) &&
            result.violations.every(
              (item) => !item.expected.includes("intersects staged prop"),
            )
          );
        },
      ],
      [
        "degenerateFootprintIsNotAlsoMismeasured",
        () => {
          const props = propRegistry();
          const set = propSet();
          const environments = [propEnvironment()];
          props[CABINET]!.placement!.footprint!.min.x = NaN;
          const result = validate(props, set, environments);
          return (
            result.success === false &&
            result.violations.some(
              (item) => item.path === "$input.props[6].placement.footprint.x",
            ) &&
            result.violations.every(
              (item) => !item.expected.includes("leaves logical space"),
            )
          );
        },
      ],
      [
        "relationsAcrossTwoBuildingsMeasureNothing",
        () =>
          tolerated((props, _set, environments) => {
            environments.push(propEnvironment("annexe"));
            props[CABINET]!.placement!.relations.splice(0, 1);
            const target = props[CABINET]!.placement!.relations[0]!.target;
            if (target.kind === "boundary") target.environment = "annexe";
          }),
      ],
      [
        "propAffordanceAloneLocatesNothing",
        () =>
          tolerated((props) => props[LAMP]!.placement!.relations.splice(0, 1)),
      ],
      [
        "supportingPropWithoutPlacementMakesNoClaim",
        () => tolerated((props) => delete props[TABLE]!.placement),
      ],
      [
        "cyclicElementParentDoesNotHang",
        () =>
          tolerated((_props, _set, environments) => {
            environments[0]!.elements = environments[0]!.elements.map(
              (element) =>
                element.id === "root"
                  ? { ...element, parent: "door-leaf" }
                  : element,
            );
          }),
      ],
    ]),
    {
      exactContactIsNotOccupancy: true,
      declaredContactMayOverlap: true,
      cellLessSpaceContainsAnything: true,
      unfilledOpeningNeverBlocks: true,
      unmodelledFillNeverBlocks: true,
      placementlessPropIsNeitherJudgedNorCounted: true,
      clearanceOverInvalidBoxDoesNotThrow: true,
      degenerateFootprintIsNotAlsoMismeasured: true,
      relationsAcrossTwoBuildingsMeasureNothing: true,
      propAffordanceAloneLocatesNothing: true,
      supportingPropWithoutPlacementMakesNoClaim: true,
      cyclicElementParentDoesNotHang: true,
    },
  );
};
