import {
  type IAutoMovieResolvedBone,
  simulateAutoMovieWearableSoftBody,
  simulateSoftBody,
  simulateSoftBodyWithBoundaries,
  validateSoftBodyDomain,
} from "@automovie/engine";
import type {
  IAutoMovieSoftBodyDomain,
  IAutoMovieValidation,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { hasViolation, nclose, throwsError } from "../internal/predicates";

const domain = (): IAutoMovieSoftBodyDomain => ({
  version: 1,
  id: "cape",
  units: "meter",
  lattice: { columns: 1, rows: 2 },
  solver: {
    fixedStepSeconds: 0.125,
    gravity: { x: 0, y: 0, z: 0 },
    drag: 0,
    iterations: 1,
    stiffness: { structural: 0, shear: 0, bend: 0 },
    referenceSpeed: 1,
    maxSteps: 4,
  },
  rest: [0, 1, 0, 0, 0.5, 0],
  mass: [1, 1],
  anchors: [
    {
      id: "shoulder",
      particle: 0,
      position: null,
      binding: {
        kind: "actor-bone",
        actor: "actor",
        bone: "leftShoulder",
        offset: { x: 0, y: 0, z: 0 },
      },
    },
  ],
  states: [],
  colliders: [
    {
      kind: "body-capsule",
      id: "torso",
      actor: "actor",
      capsule: { from: "hips", to: "head", radius: 0.25 },
    },
  ],
  wind: null,
  selfCollision: false,
});

const bone = (
  name: IAutoMovieResolvedBone["bone"],
  x: number,
  y: number,
): IAutoMovieResolvedBone => ({
  bone: name,
  localRotation: { x: 0, y: 0, z: 0, w: 1 },
  worldPosition: { x, y, z: 0 },
  worldRotation: { x: 0, y: 0, z: 0, w: 1 },
});

const actorFrame = (step: number, shoulderX: number) => ({
  step,
  nodes: [],
  actors: [
    {
      actor: "actor",
      bones: [
        bone("leftShoulder", shoulderX, 1),
        bone("hips", 0, 0),
        bone("head", 0, 1),
      ],
    },
  ],
});

/** Moving attachments and shared capsules follow one fixed-step pose snapshot. */
export const test_engine_wearable_soft_body = (): void => {
  const solved = simulateAutoMovieWearableSoftBody({
    domain: domain(),
    step: 1,
    frames: [actorFrame(0, 0), actorFrame(1, 1)],
    subjectIndex: 0,
    maxSubjects: 1,
  });
  const again = simulateAutoMovieWearableSoftBody({
    domain: domain(),
    step: 1,
    frames: [actorFrame(0, 0), actorFrame(1, 1)],
    subjectIndex: 0,
    maxSubjects: 1,
  });
  TestValidator.equals(
    "wearable cloth follows its current bone, leaves the current capsule, and reports cost",
    {
      anchorX: solved.state.positions[0],
      capsuleDistance: nclose(Math.abs(solved.state.positions[5]!), 0.25),
      contacts: solved.state.contacts,
      budget: solved.budget,
      deterministic:
        JSON.stringify(solved.state) === JSON.stringify(again.state),
    },
    {
      anchorX: 1,
      capsuleDistance: true,
      contacts: 1,
      budget: {
        subjectIndex: 0,
        maxSubjects: 1,
        anchorsPerStep: 1,
        capsulesPerStep: 1,
        boundaryRecords: 4,
      },
      deterministic: true,
    },
  );

  const coupledDomain: IAutoMovieSoftBodyDomain = {
    ...domain(),
    solver: {
      ...domain().solver,
      stiffness: { structural: 1, shear: 0, bend: 0 },
    },
    colliders: [],
  };
  const coupled = simulateAutoMovieWearableSoftBody({
    domain: coupledDomain,
    step: 1,
    frames: [actorFrame(0, 0), actorFrame(1, 1)],
    subjectIndex: 0,
    maxSubjects: 1,
  });
  TestValidator.equals(
    "nonzero structural stiffness transfers a moving anchor to the free particle",
    {
      anchorX: coupled.state.positions[0],
      freeParticleMoved: coupled.state.positions[3]! > 0.5,
      freeParticleX: nclose(coupled.state.positions[3]!, 0.5527864045000421),
    },
    { anchorX: 1, freeParticleMoved: true, freeParticleX: true },
  );

  const staticDomain: IAutoMovieSoftBodyDomain = {
    ...domain(),
    id: "curtain",
    anchors: [{ id: "rail", particle: 0, position: { x: 0, y: 1, z: 0 } }],
    colliders: [],
  };
  TestValidator.equals(
    "the legacy static path retains its exact rest state",
    simulateSoftBody(staticDomain, 1).positions,
    staticDomain.rest,
  );

  const invalidAnchor: IAutoMovieSoftBodyDomain = {
    ...domain(),
    anchors: domain().anchors.map((anchor) => ({
      ...anchor,
      position: { x: 0, y: 1, z: 0 },
    })),
  };
  const invalidCapsule: IAutoMovieSoftBodyDomain = {
    ...domain(),
    colliders: [
      {
        kind: "body-capsule",
        id: "bad",
        actor: "",
        capsule: { from: "hips", to: "head", radius: 0 },
      },
    ],
  };
  const embeddedMovingCapsule = validateSoftBodyDomain({ domain: domain() });
  TestValidator.equals(
    "validation refuses contradictory bindings but never invents an origin capsule",
    {
      anchorPosition: hasViolation(
        validateSoftBodyDomain({ domain: invalidAnchor }),
        "type",
        "anchors[0].position",
      ),
      blankActor: hasViolation(
        validateSoftBodyDomain({ domain: invalidCapsule }),
        "type",
        "colliders[0].actor",
      ),
      radius: hasViolation(
        validateSoftBodyDomain({ domain: invalidCapsule }),
        "range",
        "colliders[0].capsule.radius",
      ),
      distinctEndpoints: hasViolation(
        validateSoftBodyDomain({
          domain: {
            ...invalidCapsule,
            colliders: [
              {
                kind: "body-capsule",
                id: "same-endpoint",
                actor: "soloist",
                capsule: { from: "hips", to: "hips", radius: 0.25 },
              },
            ],
          },
        }),
        "range",
        "colliders[0].capsule.to",
      ),
      unresolvedDoesNotEmbed: clean(embeddedMovingCapsule),
    },
    {
      anchorPosition: true,
      blankActor: true,
      radius: true,
      distinctEndpoints: true,
      unresolvedDoesNotEmbed: true,
    },
  );

  TestValidator.equals(
    "missing moving facts and admission overflow are explicit failures",
    {
      budget: throwsError(
        () =>
          simulateAutoMovieWearableSoftBody({
            domain: domain(),
            step: 1,
            frames: [actorFrame(0, 0), actorFrame(1, 1)],
            subjectIndex: 1,
            maxSubjects: 1,
          }),
        "budget",
      ),
      actor: throwsError(
        () =>
          simulateAutoMovieWearableSoftBody({
            domain: domain(),
            step: 0,
            frames: [{ step: 0, nodes: [], actors: [] }],
            subjectIndex: 0,
            maxSubjects: 1,
          }),
        'missing actor "actor"',
      ),
      rotation: throwsError(
        () =>
          simulateAutoMovieWearableSoftBody({
            domain: domain(),
            step: 0,
            frames: [
              {
                ...actorFrame(0, 0),
                actors: [
                  {
                    actor: "actor",
                    bones: [
                      {
                        ...bone("leftShoulder", 0, 1),
                        worldRotation: { x: 0, y: 0, z: 0, w: 2 },
                      },
                      bone("hips", 0, 0),
                      bone("head", 0, 1),
                    ],
                  },
                ],
              },
            ],
            subjectIndex: 0,
            maxSubjects: 1,
          }),
        "unit length",
      ),
      unresolvedStatic: throwsError(
        () => simulateSoftBody(domain(), 1),
        "resolved moving boundaries",
      ),
      missingAnchorBoundary: throwsError(
        () =>
          simulateSoftBodyWithBoundaries(domain(), 0, [
            {
              step: 0,
              anchors: [],
              capsules: [
                {
                  id: "torso",
                  from: { x: 0, y: 0, z: 0 },
                  to: { x: 0, y: 1, z: 0 },
                  radius: 0.25,
                },
              ],
            },
          ]),
        "missing authored moving anchor",
      ),
      missingCapsuleBoundary: throwsError(
        () =>
          simulateSoftBodyWithBoundaries(domain(), 0, [
            {
              step: 0,
              anchors: [{ particle: 0, position: { x: 0, y: 1, z: 0 } }],
              capsules: [],
            },
          ]),
        "missing authored body capsule",
      ),
    },
    {
      budget: true,
      actor: true,
      rotation: true,
      unresolvedStatic: true,
      missingAnchorBoundary: true,
      missingCapsuleBoundary: true,
    },
  );

  const nodeDomain: IAutoMovieSoftBodyDomain = {
    ...domain(),
    id: "flag",
    anchors: [
      {
        id: "pole",
        particle: 0,
        position: null,
        binding: {
          kind: "node",
          node: "pole",
          offset: { x: 0.25, y: 0, z: 0 },
        },
      },
    ],
    colliders: [],
  };
  const nodeFrame = {
    step: 0,
    nodes: [
      {
        node: "pole",
        worldPosition: { x: 1, y: 1, z: 0 },
        worldRotation: { x: 0, y: 0, z: 0, w: 1 },
      },
    ],
    actors: [],
  };
  const capsuleOnly: IAutoMovieSoftBodyDomain = {
    ...domain(),
    anchors: [],
  };
  const farCapsuleFrame = actorFrame(0, 0);
  farCapsuleFrame.actors[0]!.bones = [
    bone("leftShoulder", 0, 1),
    bone("hips", 10, 0),
    bone("head", 10, 1),
  ];
  const farCapsule = simulateAutoMovieWearableSoftBody({
    domain: capsuleOnly,
    step: 0,
    frames: [farCapsuleFrame],
    subjectIndex: 0,
    maxSubjects: 1,
  });
  TestValidator.equals(
    "node anchors, capsule-only boundaries, and named state inputs remain explicit",
    {
      nodeAnchor: simulateAutoMovieWearableSoftBody({
        domain: nodeDomain,
        step: 0,
        frames: [nodeFrame],
        subjectIndex: 0,
        maxSubjects: 1,
      }).state.positions[0],
      capsuleOnly: simulateAutoMovieWearableSoftBody({
        domain: capsuleOnly,
        step: 0,
        frames: [actorFrame(0, 0)],
        subjectIndex: 0,
        maxSubjects: 1,
      }).budget,
      namedState: simulateAutoMovieWearableSoftBody({
        domain: {
          ...domain(),
          states: [{ id: "draped", anchors: [] }],
        },
        step: 0,
        frames: [actorFrame(0, 0)],
        subjectIndex: 0,
        maxSubjects: 1,
        state: "draped",
      }).state.step,
      farCapsuleContacts: farCapsule.state.contacts,
      farCapsulePositionsUnchanged:
        JSON.stringify(farCapsule.state.positions) ===
        JSON.stringify(capsuleOnly.rest),
    },
    {
      nodeAnchor: 1.25,
      capsuleOnly: {
        subjectIndex: 0,
        maxSubjects: 1,
        anchorsPerStep: 0,
        capsulesPerStep: 1,
        boundaryRecords: 1,
      },
      namedState: 0,
      farCapsuleContacts: 0,
      farCapsulePositionsUnchanged: true,
    },
  );

  TestValidator.equals(
    "wearable admission, frame identity, lookup, and transform failures are closed",
    {
      fractionalStep: throwsError(
        () =>
          simulateAutoMovieWearableSoftBody({
            domain: domain(),
            step: 0.5,
            frames: [],
            subjectIndex: 0,
            maxSubjects: 1,
          }),
        "non-negative integer",
      ),
      missingFrame: throwsError(
        () =>
          simulateAutoMovieWearableSoftBody({
            domain: domain(),
            step: 1,
            frames: [actorFrame(0, 0)],
            subjectIndex: 0,
            maxSubjects: 1,
          }),
        "frames 0 through 1",
      ),
      noMovingBoundary: throwsError(
        () =>
          simulateAutoMovieWearableSoftBody({
            domain: staticDomain,
            step: 0,
            frames: [{ step: 0, nodes: [], actors: [] }],
            subjectIndex: 0,
            maxSubjects: 1,
          }),
        "declares no moving boundary",
      ),
      wrongFrameStep: throwsError(
        () =>
          simulateAutoMovieWearableSoftBody({
            domain: domain(),
            step: 0,
            frames: [actorFrame(1, 0)],
            subjectIndex: 0,
            maxSubjects: 1,
          }),
        "must name absolute step 0",
      ),
      missingNode: throwsError(
        () =>
          simulateAutoMovieWearableSoftBody({
            domain: nodeDomain,
            step: 0,
            frames: [{ step: 0, nodes: [], actors: [] }],
            subjectIndex: 0,
            maxSubjects: 1,
          }),
        'missing node "pole"',
      ),
      missingCapsuleActor: throwsError(
        () =>
          simulateAutoMovieWearableSoftBody({
            domain: capsuleOnly,
            step: 0,
            frames: [{ step: 0, nodes: [], actors: [] }],
            subjectIndex: 0,
            maxSubjects: 1,
          }),
        "missing capsule actor",
      ),
      duplicateActor: throwsError(() => {
        const frame = actorFrame(0, 0);
        simulateAutoMovieWearableSoftBody({
          domain: domain(),
          step: 0,
          frames: [{ ...frame, actors: [...frame.actors, frame.actors[0]!] }],
          subjectIndex: 0,
          maxSubjects: 1,
        });
      }, "ids must be non-blank and unique"),
      blankNodeIdentity: throwsError(
        () =>
          simulateAutoMovieWearableSoftBody({
            domain: nodeDomain,
            step: 0,
            frames: [
              {
                ...nodeFrame,
                nodes: [{ ...nodeFrame.nodes[0]!, node: " " }],
              },
            ],
            subjectIndex: 0,
            maxSubjects: 1,
          }),
        "ids must be non-blank and unique",
      ),
      missingBone: throwsError(() => {
        const frame = actorFrame(0, 0);
        simulateAutoMovieWearableSoftBody({
          domain: domain(),
          step: 0,
          frames: [
            {
              ...frame,
              actors: [
                {
                  actor: "actor",
                  bones: frame.actors[0]!.bones.filter(
                    (entry) => entry.bone !== "leftShoulder",
                  ),
                },
              ],
            },
          ],
          subjectIndex: 0,
          maxSubjects: 1,
        });
      }, "missing bone"),
      duplicateBone: throwsError(() => {
        const frame = actorFrame(0, 0);
        simulateAutoMovieWearableSoftBody({
          domain: domain(),
          step: 0,
          frames: [
            {
              ...frame,
              actors: [
                {
                  actor: "actor",
                  bones: [
                    ...frame.actors[0]!.bones,
                    frame.actors[0]!.bones[0]!,
                  ],
                },
              ],
            },
          ],
          subjectIndex: 0,
          maxSubjects: 1,
        });
      }, "repeats bone"),
      nonfinitePosition: throwsError(() => {
        const frame = actorFrame(0, 0);
        frame.actors[0]!.bones[0]!.worldPosition.x = NaN;
        simulateAutoMovieWearableSoftBody({
          domain: domain(),
          step: 0,
          frames: [frame],
          subjectIndex: 0,
          maxSubjects: 1,
        });
      }, "finite coordinates"),
      nonfiniteOffset: throwsError(() => {
        const invalid = domain();
        invalid.anchors[0]!.binding!.offset.x = NaN;
        simulateAutoMovieWearableSoftBody({
          domain: invalid,
          step: 0,
          frames: [actorFrame(0, 0)],
          subjectIndex: 0,
          maxSubjects: 1,
        });
      }, "finite coordinates"),
      nonfiniteRotation: throwsError(() => {
        const frame = actorFrame(0, 0);
        frame.actors[0]!.bones[0]!.worldRotation.x = NaN;
        simulateAutoMovieWearableSoftBody({
          domain: domain(),
          step: 0,
          frames: [frame],
          subjectIndex: 0,
          maxSubjects: 1,
        });
      }, "finite coordinates"),
      invalidMaxSubjects: throwsError(
        () =>
          simulateAutoMovieWearableSoftBody({
            domain: domain(),
            step: 0,
            frames: [actorFrame(0, 0)],
            subjectIndex: 0,
            maxSubjects: -1,
          }),
        "max subjects",
      ),
      invalidSubjectIndex: throwsError(
        () =>
          simulateAutoMovieWearableSoftBody({
            domain: domain(),
            step: 0,
            frames: [actorFrame(0, 0)],
            subjectIndex: -1,
            maxSubjects: 1,
          }),
        "subject index must",
      ),
    },
    {
      fractionalStep: true,
      missingFrame: true,
      noMovingBoundary: true,
      wrongFrameStep: true,
      missingNode: true,
      missingCapsuleActor: true,
      duplicateActor: true,
      blankNodeIdentity: true,
      missingBone: true,
      duplicateBone: true,
      nonfinitePosition: true,
      nonfiniteOffset: true,
      nonfiniteRotation: true,
      invalidMaxSubjects: true,
      invalidSubjectIndex: true,
    },
  );

  const validBoundary = () => ({
    step: 0,
    anchors: [{ particle: 0, position: { x: 0, y: 1, z: 0 } }],
    capsules: [
      {
        id: "torso",
        from: { x: 0, y: 0, z: 0 },
        to: { x: 0, y: 1, z: 0 },
        radius: 0.25,
      },
    ],
  });
  TestValidator.equals(
    "the lower moving-boundary solver refuses incomplete and foreign records",
    {
      missingSequence: throwsError(
        () => simulateSoftBodyWithBoundaries(domain(), 0, []),
        "one moving boundary",
      ),
      wrongBoundaryStep: throwsError(
        () =>
          simulateSoftBodyWithBoundaries(domain(), 0, [
            { ...validBoundary(), step: 1 },
          ]),
        "must name absolute step 0",
      ),
      fractionalParticle: throwsError(
        () =>
          simulateSoftBodyWithBoundaries(domain(), 0, [
            {
              ...validBoundary(),
              anchors: [{ particle: 0.5, position: { x: 0, y: 1, z: 0 } }],
            },
          ]),
        "invalid anchor particle",
      ),
      negativeParticle: throwsError(
        () =>
          simulateSoftBodyWithBoundaries(domain(), 0, [
            {
              ...validBoundary(),
              anchors: [{ particle: -1, position: { x: 0, y: 1, z: 0 } }],
            },
          ]),
        "invalid anchor particle",
      ),
      outOfRangeParticle: throwsError(
        () =>
          simulateSoftBodyWithBoundaries(domain(), 0, [
            {
              ...validBoundary(),
              anchors: [{ particle: 2, position: { x: 0, y: 1, z: 0 } }],
            },
          ]),
        "invalid anchor particle",
      ),
      staticAnchorOverride: throwsError(
        () =>
          simulateSoftBodyWithBoundaries(
            { ...domain(), anchors: staticDomain.anchors },
            0,
            [validBoundary()],
          ),
        "not an authored moving anchor",
      ),
      duplicateAnchor: throwsError(() => {
        const boundary = validBoundary();
        simulateSoftBodyWithBoundaries(domain(), 0, [
          {
            ...boundary,
            anchors: [...boundary.anchors, boundary.anchors[0]!],
          },
        ]);
      }, "repeats anchor particle"),
      nonfiniteAnchor: throwsError(
        () =>
          simulateSoftBodyWithBoundaries(domain(), 0, [
            {
              ...validBoundary(),
              anchors: [{ particle: 0, position: { x: NaN, y: 1, z: 0 } }],
            },
          ]),
        "finite coordinates",
      ),
      blankCapsule: throwsError(() => {
        const boundary = validBoundary();
        simulateSoftBodyWithBoundaries(domain(), 0, [
          {
            ...boundary,
            capsules: [{ ...boundary.capsules[0]!, id: " " }],
          },
        ]);
      }, "id must not be blank"),
      duplicateCapsule: throwsError(() => {
        const boundary = validBoundary();
        simulateSoftBodyWithBoundaries(domain(), 0, [
          {
            ...boundary,
            capsules: [...boundary.capsules, boundary.capsules[0]!],
          },
        ]);
      }, "repeats capsule"),
      foreignCapsule: throwsError(() => {
        const boundary = validBoundary();
        simulateSoftBodyWithBoundaries(domain(), 0, [
          {
            ...boundary,
            capsules: [{ ...boundary.capsules[0]!, id: "foreign" }],
          },
        ]);
      }, "not an authored body capsule"),
      nonfiniteCapsuleFrom: throwsError(() => {
        const boundary = validBoundary();
        simulateSoftBodyWithBoundaries(domain(), 0, [
          {
            ...boundary,
            capsules: [
              {
                ...boundary.capsules[0]!,
                from: { x: NaN, y: 0, z: 0 },
              },
            ],
          },
        ]);
      }, "finite coordinates"),
      nonfiniteCapsuleTo: throwsError(() => {
        const boundary = validBoundary();
        simulateSoftBodyWithBoundaries(domain(), 0, [
          {
            ...boundary,
            capsules: [
              {
                ...boundary.capsules[0]!,
                to: { x: 0, y: NaN, z: 0 },
              },
            ],
          },
        ]);
      }, "finite coordinates"),
      nonfiniteRadius: throwsError(() => {
        const boundary = validBoundary();
        simulateSoftBodyWithBoundaries(domain(), 0, [
          {
            ...boundary,
            capsules: [{ ...boundary.capsules[0]!, radius: NaN }],
          },
        ]);
      }, "radius must be finite"),
      zeroRadius: throwsError(() => {
        const boundary = validBoundary();
        simulateSoftBodyWithBoundaries(domain(), 0, [
          {
            ...boundary,
            capsules: [{ ...boundary.capsules[0]!, radius: 0 }],
          },
        ]);
      }, "radius must be finite"),
    },
    {
      missingSequence: true,
      wrongBoundaryStep: true,
      fractionalParticle: true,
      negativeParticle: true,
      outOfRangeParticle: true,
      staticAnchorOverride: true,
      duplicateAnchor: true,
      nonfiniteAnchor: true,
      blankCapsule: true,
      duplicateCapsule: true,
      foreignCapsule: true,
      nonfiniteCapsuleFrom: true,
      nonfiniteCapsuleTo: true,
      nonfiniteRadius: true,
      zeroRadius: true,
    },
  );

  const capsuleEscape = (
    from: { x: number; y: number; z: number },
    to: { x: number; y: number; z: number },
  ): number[] => {
    const moving = capsuleOnly;
    moving.rest = [0, 0, 0, 5, 5, 5];
    const boundary = {
      step: 0,
      anchors: [],
      capsules: [{ id: "torso", from, to, radius: 0.25 }],
    };
    return simulateSoftBodyWithBoundaries(moving, 1, [
      boundary,
      { ...boundary, step: 1 },
    ]).positions;
  };
  TestValidator.equals(
    "coincident particles leave degenerate and differently oriented capsules deterministically",
    {
      point: capsuleEscape({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }).every(
        Number.isFinite,
      ),
      xAxis: capsuleEscape({ x: -1, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }).every(
        Number.isFinite,
      ),
      diagonal: capsuleEscape(
        { x: -1, y: -1, z: 0 },
        { x: 1, y: 1, z: 0 },
      ).every(Number.isFinite),
    },
    { point: true, xAxis: true, diagonal: true },
  );
};

const clean = (validation: IAutoMovieValidation): boolean =>
  validation.success === true;
