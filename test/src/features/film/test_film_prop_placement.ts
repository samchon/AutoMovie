import { validatePropPlacements } from "@automovie/engine";
import {
  IAutoMovieBuiltEnvironment,
  IAutoMoviePropSpec,
  IAutoMovieStageSetPiece,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { IDENTITY_TRANSFORM, createModel } from "../internal/fixtures";
import { namedFacts } from "../internal/predicates";

const environment = (id = "house"): IAutoMovieBuiltEnvironment => ({
  version: 1,
  id,
  units: "meter",
  buildings: [{ id: "main", element: "root", space: "room" }],
  models: [],
  modelReferences: [],
  elements: [
    {
      id: "root",
      kind: "building",
      parent: null,
      transform: IDENTITY_TRANSFORM,
      model: null,
      space: "room",
    },
    {
      id: "wall",
      kind: "wall",
      parent: "root",
      transform: IDENTITY_TRANSFORM,
      model: null,
      space: "room",
    },
    {
      id: "annex-wall",
      kind: "wall",
      parent: "root",
      transform: IDENTITY_TRANSFORM,
      model: null,
      space: "annex",
    },
  ],
  spaces: [
    { id: "room", kind: "room", parent: null, cells: [] },
    { id: "annex", kind: "room", parent: "room", cells: [] },
  ],
  boundaries: [],
  openings: [],
  connectors: [],
  surfaces: [
    {
      space: "room",
      surface: {
        id: "floor",
        kind: "floor",
        polygon: [
          { x: -5, y: 0, z: -5 },
          { x: 5, y: 0, z: -5 },
          { x: 5, y: 0, z: 5 },
          { x: -5, y: 0, z: 5 },
        ],
        anchor: { x: 0, y: 0, z: 0 },
        rampTo: null,
      },
    },
    {
      space: "annex",
      surface: {
        id: "annex-floor",
        kind: "floor",
        polygon: [
          { x: 5, y: 0, z: -5 },
          { x: 10, y: 0, z: -5 },
          { x: 10, y: 0, z: 5 },
          { x: 5, y: 0, z: 5 },
        ],
        anchor: { x: 0, y: 0, z: 0 },
        rampTo: null,
      },
    },
  ],
  walkable: ["floor", "annex-floor"],
});

const table = (): IAutoMoviePropSpec => ({
  node: "table",
  model: {
    ...createModel(null),
    id: "table",
    affordances: [
      {
        id: "top",
        kind: "stack-top",
        frame: IDENTITY_TRANSFORM,
        extent: [
          { x: -0.5, y: 0, z: -0.5 },
          { x: 0.5, y: 0, z: -0.5 },
          { x: 0.5, y: 0, z: 0.5 },
          { x: -0.5, y: 0, z: 0.5 },
        ],
      },
    ],
  },
  articulation: null,
  placement: {
    space: { environment: "house", space: "room" },
    host: null,
    support: { kind: "surface", environment: "house", surface: "floor" },
    clearance: [],
  },
});

const lamp = (): IAutoMoviePropSpec => ({
  node: "lamp",
  model: { ...createModel(null), id: "lamp" },
  articulation: null,
  placement: {
    space: { environment: "house", space: "room" },
    host: { environment: "house", element: "wall" },
    support: { kind: "prop-affordance", prop: "table", affordance: "top" },
    clearance: [
      {
        id: "shade-service",
        min: { x: -0.2, y: 0, z: 4 },
        max: { x: 0.2, y: 1, z: 5 },
      },
    ],
  },
});

const sculpture = (): IAutoMoviePropSpec => ({
  node: "sculpture",
  model: {
    ...createModel(null),
    id: "sculpture",
    parts: [
      {
        id: "tetrahedron",
        name: null,
        geometry: {
          type: "mesh",
          mesh: {
            positions: [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1],
            normals: null,
            uvs: null,
            indices: [0, 2, 1, 0, 1, 3, 0, 3, 2, 1, 2, 3],
            skin: null,
          },
        },
        material: "mat-1",
        attachedBone: null,
        transform: {
          translation: { x: 0.1, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0, w: 1 },
          scale: { x: 1, y: 1, z: 1 },
        },
      },
    ],
  },
  articulation: null,
});

const setPieces = (): IAutoMovieStageSetPiece[] => [
  { node: "table", model: "table", position: { x: 0, y: 0, z: 0 } },
  {
    node: "lamp",
    model: "lamp",
    position: { x: 3, y: 1, z: 0 },
    facingDeg: 30,
    scale: 1.2,
  },
  {
    node: "sculpture",
    model: "sculpture",
    position: { x: -3, y: 0, z: 0 },
    rotation: { x: 0, y: Math.SQRT1_2, z: 0, w: Math.SQRT1_2 },
    scale: { x: 1, y: 2, z: 0.5 },
  },
];

const validate = (
  props: IAutoMoviePropSpec[] = [table(), lamp(), sculpture()],
  set: IAutoMovieStageSetPiece[] = setPieces(),
  builtEnvironments: IAutoMovieBuiltEnvironment[] = [environment()],
) => validatePropPlacements({ props, set, builtEnvironments });

/**
 * Semantic prop placement is order-independent and preserves the legacy prop
 * path while making every spatial relation and clearance failure locatable.
 *
 * Scenarios:
 *
 * 1. A valid registry, its reversed forward reference, a legacy unplaced prop, and
 *    the empty registry pass without inferred spatial claims.
 * 2. Duplicate prop, set, and environment ids plus missing and forged joins fail
 *    at the identity or model field that authored the contradiction.
 * 3. Space, host, surface, prop-affordance, and support-cycle references cover
 *    missing, ambiguous, and cross-environment negative twins without treating
 *    intentionally overlapping logical spaces as geometric contradictions.
 * 4. Clearance ids and all three finite ordered axes are gated before geometry and
 *    invalid owners or candidates do not make the geometry pass throw.
 * 5. Facing/scalar scale and quaternion/per-axis scale, primitive and mesh
 *    geometry, part-local transforms, collision, separation, and exact contact
 *    exercise the full transformed-bounds predicate.
 */
export const test_film_prop_placement = (): void => {
  TestValidator.equals(
    "valid prop registry resolves",
    validate().success,
    true,
  );
  TestValidator.equals(
    "forward support reference is declaration-order independent",
    validate([lamp(), table(), sculpture()]).success,
    true,
  );
  TestValidator.equals(
    "legacy prop without placement stays compatible",
    validate([sculpture()], [setPieces()[2]!], []).success,
    true,
  );
  TestValidator.equals(
    "empty registries stay compatible",
    validate([], [], []).success,
    true,
  );

  const invalid = (
    mutate: (
      props: IAutoMoviePropSpec[],
      set: IAutoMovieStageSetPiece[],
      environments: IAutoMovieBuiltEnvironment[],
    ) => void,
    path: string,
  ): boolean => {
    const props = [table(), lamp(), sculpture()];
    const set = setPieces();
    const environments = [environment()];
    mutate(props, set, environments);
    const result = validate(props, set, environments);
    return (
      result.success === false &&
      result.violations.some((item) => item.path === path)
    );
  };

  TestValidator.equals(
    "identity, relation, range and collision failures are located",
    namedFacts([
      [
        "duplicateProp",
        () => invalid((props) => props.push(props[0]!), "$input.props[3].node"),
      ],
      [
        "ambiguousSupportingProp",
        () =>
          invalid(
            (props) => props.push(props[0]!),
            "$input.props[1].placement.support.prop",
          ),
      ],
      [
        "duplicateSet",
        () => invalid((_props, set) => set.push(set[0]!), "$input.set[3].node"),
      ],
      [
        "duplicateEnvironment",
        () =>
          invalid(
            (_props, _set, environments) => environments.push(environment()),
            "$input.builtEnvironments[1].id",
          ),
      ],
      [
        "ambiguousEnvironment",
        () =>
          invalid(
            (_props, _set, environments) => environments.push(environment()),
            "$input.props[0].placement.space.environment",
          ),
      ],
      [
        "forge",
        () =>
          invalid(
            (props) => (props[0]!.model.id = "wrong"),
            "$input.props[0].model.id",
          ),
      ],
      [
        "clearanceOwnerForge",
        () =>
          invalid(
            (props) => (props[1]!.model.id = "wrong"),
            "$input.props[1].model.id",
          ),
      ],
      [
        "missingSet",
        () =>
          invalid((_props, set) => set.splice(1, 1), "$input.props[1].node"),
      ],
      [
        "missingCandidateSet",
        () =>
          invalid((_props, set) => set.splice(2, 1), "$input.props[2].node"),
      ],
      [
        "setModel",
        () =>
          invalid(
            (_props, set) => (set[1]!.model = "wrong"),
            "$input.set[1].model",
          ),
      ],
      [
        "spaceEnvironment",
        () =>
          invalid(
            (props) => (props[1]!.placement!.space!.environment = "missing"),
            "$input.props[1].placement.space.environment",
          ),
      ],
      [
        "space",
        () =>
          invalid(
            (props) => (props[1]!.placement!.space!.space = "missing"),
            "$input.props[1].placement.space.space",
          ),
      ],
      [
        "hostEnvironment",
        () =>
          invalid(
            (props) => (props[1]!.placement!.host!.environment = "missing"),
            "$input.props[1].placement.host.environment",
          ),
      ],
      [
        "host",
        () =>
          invalid(
            (props) => (props[1]!.placement!.host!.element = "missing"),
            "$input.props[1].placement.host.element",
          ),
      ],
      [
        "hostEnvironmentMismatch",
        () =>
          invalid((props, _set, environments) => {
            environments.push(environment("other-house"));
            props[1]!.placement!.host!.environment = "other-house";
          }, "$input.props[1].placement.host.environment"),
      ],
      [
        "surfaceEnvironment",
        () =>
          invalid((props) => {
            const support = props[0]!.placement!.support;
            if (support?.kind === "surface") support.environment = "missing";
          }, "$input.props[0].placement.support.environment"),
      ],
      [
        "surface",
        () =>
          invalid((props) => {
            const support = props[0]!.placement!.support;
            if (support?.kind === "surface") support.surface = "missing";
          }, "$input.props[0].placement.support.surface"),
      ],
      [
        "surfaceEnvironmentMismatch",
        () =>
          invalid((props, _set, environments) => {
            environments.push(environment("other-house"));
            const support = props[0]!.placement!.support;
            if (support?.kind === "surface")
              support.environment = "other-house";
          }, "$input.props[0].placement.support.environment"),
      ],
      [
        "self",
        () =>
          invalid((props) => {
            const support = props[1]!.placement!.support;
            if (support?.kind === "prop-affordance") support.prop = "lamp";
          }, "$input.props[1].placement.support.prop"),
      ],
      [
        "supportProp",
        () =>
          invalid((props) => {
            const support = props[1]!.placement!.support;
            if (support?.kind === "prop-affordance") support.prop = "missing";
          }, "$input.props[1].placement.support.prop"),
      ],
      [
        "affordance",
        () =>
          invalid((props) => {
            const support = props[1]!.placement!.support;
            if (support?.kind === "prop-affordance")
              support.affordance = "missing";
          }, "$input.props[1].placement.support.affordance"),
      ],
      [
        "supportEnvironmentMismatch",
        () =>
          invalid((props, _set, environments) => {
            environments.push(environment("other-house"));
            props[0]!.placement!.space!.environment = "other-house";
          }, "$input.props[1].placement.support.prop"),
      ],
      [
        "supportCycle",
        () =>
          invalid((props) => {
            props[0]!.placement!.support = {
              kind: "prop-affordance",
              prop: "lamp",
              affordance: "missing",
            };
          }, "$input.props[1].placement.support.prop"),
      ],
      [
        "blankClearance",
        () =>
          invalid(
            (props) => (props[1]!.placement!.clearance[0]!.id = " "),
            "$input.props[1].placement.clearance[0].id",
          ),
      ],
      [
        "duplicateClearance",
        () =>
          invalid(
            (props) =>
              props[1]!.placement!.clearance.push(
                props[1]!.placement!.clearance[0]!,
              ),
            "$input.props[1].placement.clearance[1].id",
          ),
      ],
      [
        "xBounds",
        () =>
          invalid(
            (props) => (props[1]!.placement!.clearance[0]!.max.x = -1),
            "$input.props[1].placement.clearance[0].x",
          ),
      ],
      [
        "yBounds",
        () =>
          invalid(
            (props) => (props[1]!.placement!.clearance[0]!.min.y = NaN),
            "$input.props[1].placement.clearance[0].y",
          ),
      ],
      [
        "zBounds",
        () =>
          invalid(
            (props) => (props[1]!.placement!.clearance[0]!.max.z = Infinity),
            "$input.props[1].placement.clearance[0].z",
          ),
      ],
      [
        "facingAndPartTransformCollision",
        () =>
          invalid((_props, set) => {
            set[2]!.position = { x: 5.7, y: 1.6, z: 4.68 };
          }, "$input.props[1].placement.clearance[0]"),
      ],
      [
        "quaternionAndNonUniformScaleCollision",
        () =>
          invalid((props, set) => {
            props[2]!.placement = {
              space: null,
              host: null,
              support: null,
              clearance: [
                {
                  id: "rotated-service",
                  min: { x: 1, y: 0, z: 0 },
                  max: { x: 2, y: 1, z: 1 },
                },
              ],
            };
            set[0]!.position = { x: -2.75, y: 1, z: -1.5 };
          }, "$input.props[2].placement.clearance[0]"),
      ],
    ]),
    {
      duplicateProp: true,
      ambiguousSupportingProp: true,
      duplicateSet: true,
      duplicateEnvironment: true,
      ambiguousEnvironment: true,
      forge: true,
      clearanceOwnerForge: true,
      missingSet: true,
      missingCandidateSet: true,
      setModel: true,
      spaceEnvironment: true,
      space: true,
      hostEnvironment: true,
      host: true,
      hostEnvironmentMismatch: true,
      surfaceEnvironment: true,
      surface: true,
      surfaceEnvironmentMismatch: true,
      self: true,
      supportProp: true,
      affordance: true,
      supportEnvironmentMismatch: true,
      supportCycle: true,
      blankClearance: true,
      duplicateClearance: true,
      xBounds: true,
      yBounds: true,
      zBounds: true,
      facingAndPartTransformCollision: true,
      quaternionAndNonUniformScaleCollision: true,
    },
  );

  const touchingProps = [table(), lamp(), sculpture()];
  touchingProps[0]!.placement!.clearance = [
    {
      id: "touching-is-not-occupied",
      min: { x: -1, y: -1, z: -1 },
      max: { x: 1, y: 1, z: 1 },
    },
  ];
  const touchingSet = setPieces();
  touchingSet[1] = {
    node: "lamp",
    model: "lamp",
    position: { x: 1.2, y: 0, z: 0 },
  };
  TestValidator.equals(
    "exactly touching clearance and occupancy bounds do not overlap",
    validate(touchingProps, touchingSet).success,
    true,
  );
};
