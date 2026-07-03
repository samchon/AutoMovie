import {
  AutoFilmHumanoidBone,
  IAutoFilmJointPose,
  IAutoFilmKeyframe,
  IAutoFilmMotion,
  IAutoFilmPose,
} from "@autofilm/interface";

/** The postural/expressive gestures the reference synthesiser can author. */
export type AutoFilmGenericGesture =
  | "bow"
  | "nod"
  | "shake"
  | "crouch"
  | "kick"
  | "wave"
  | "celebrate";

const GENERIC = new Set<string>([
  "bow",
  "nod",
  "shake",
  "crouch",
  "kick",
  "wave",
  "celebrate",
]);

// A joint stop across the three articulation axes (unset axes stay null). The
// arm gestures (wave/celebrate) abduct; raising an arm overhead is −abduction on
// the left and +abduction on the right (the shared axis, mirrored ROM per side).
const j = (
  bone: AutoFilmHumanoidBone,
  axes: Partial<Pick<IAutoFilmJointPose, "flexion" | "abduction" | "twist">>,
): IAutoFilmJointPose => ({
  bone,
  flexion: axes.flexion ?? null,
  abduction: axes.abduction ?? null,
  twist: axes.twist ?? null,
});

/**
 * Each generic gesture as a list of `[fraction, joints]` stops over the beat —
 * every angle hand-kept inside the humanoid ROM (bow bends the spine forward, a
 * nod dips the head, a shake twists it, a crouch folds hips and knees). The
 * fractions are of the action's `duration`, so the same shape stretches to
 * whatever length the beat asks for.
 */
const SHAPES: Record<AutoFilmGenericGesture, [number, IAutoFilmJointPose[]][]> =
  {
    bow: [
      [0, [j("spine", { flexion: 0 }), j("head", { flexion: 0 })]],
      [0.35, [j("spine", { flexion: 50 }), j("head", { flexion: 15 })]],
      [0.7, [j("spine", { flexion: 50 }), j("head", { flexion: 15 })]],
      [1, [j("spine", { flexion: 0 }), j("head", { flexion: 0 })]],
    ],
    nod: [
      [0, [j("head", { flexion: 0 })]],
      [0.25, [j("head", { flexion: 22 })]],
      [0.5, [j("head", { flexion: 2 })]],
      [0.75, [j("head", { flexion: 22 })]],
      [1, [j("head", { flexion: 0 })]],
    ],
    shake: [
      [0, [j("head", { twist: 0 })]],
      [0.25, [j("head", { twist: 30 })]],
      [0.5, [j("head", { twist: -30 })]],
      [0.75, [j("head", { twist: 30 })]],
      [1, [j("head", { twist: 0 })]],
    ],
    crouch: [
      [0, crouchPose(0)],
      [0.3, crouchPose(1)],
      [0.7, crouchPose(1)],
      [1, crouchPose(0)],
    ],
    // A front kick with the right leg: chamber the knee up, snap the shin out,
    // re-chamber, lower. Hip flexion raises the leg (no abduction, so no mirror
    // issue); the small spine extension counter-balances. All within humanoid
    // ROM (upperLeg flexion ≤120, knee ≤150, spine ≥−30).
    kick: [
      [0, []],
      [
        0.22,
        [
          j("rightUpperLeg", { flexion: 55 }),
          j("rightLowerLeg", { flexion: 75 }),
          j("spine", { flexion: -6 }),
        ],
      ],
      [
        0.42,
        [
          j("rightUpperLeg", { flexion: 68 }),
          j("rightLowerLeg", { flexion: 6 }),
          j("spine", { flexion: -8 }),
        ],
      ],
      [
        0.62,
        [
          j("rightUpperLeg", { flexion: 52 }),
          j("rightLowerLeg", { flexion: 72 }),
          j("spine", { flexion: -5 }),
        ],
      ],
      [1, []],
    ],
    // A one-arm wave: raise the right arm overhead (+abduction) and swing the
    // forearm side to side at the elbow.
    wave: [
      [0, []],
      [0.15, [j("rightUpperArm", { abduction: 112, flexion: 6 })]],
      [
        0.4,
        [
          j("rightUpperArm", { abduction: 112, flexion: 6 }),
          j("rightLowerArm", { flexion: 55 }),
        ],
      ],
      [
        0.65,
        [
          j("rightUpperArm", { abduction: 112, flexion: 6 }),
          j("rightLowerArm", { flexion: 12 }),
        ],
      ],
      [
        0.85,
        [
          j("rightUpperArm", { abduction: 112, flexion: 6 }),
          j("rightLowerArm", { flexion: 55 }),
        ],
      ],
      [1, []],
    ],
    // A two-arm celebration: both arms thrown up in a V and pumped. The raise is
    // −abduction on the left, +abduction on the right (mirrored per side).
    celebrate: [
      [0, []],
      [0.22, celebratePose(1)],
      [0.45, celebratePose(1.1)],
      [0.7, celebratePose(1)],
      [1, []],
    ],
  };

/** Both arms thrown up in a V, scaled by `s` (a pump raises them higher). */
function celebratePose(s: number): IAutoFilmJointPose[] {
  return [
    j("leftUpperArm", { abduction: -106 * s, flexion: 10 }),
    j("rightUpperArm", { abduction: 106 * s, flexion: 10 }),
  ];
}

function crouchPose(depth: number): IAutoFilmJointPose[] {
  return [
    j("leftUpperLeg", { flexion: 55 * depth }),
    j("rightUpperLeg", { flexion: 55 * depth }),
    j("leftLowerLeg", { flexion: 65 * depth }),
    j("rightLowerLeg", { flexion: 65 * depth }),
    j("spine", { flexion: 15 * depth }),
  ];
}

/**
 * A **jump** as `[fraction, rootY, legFlex]` stops: the body coils (knees bend,
 * hips dip), pushes off, arcs up with the legs tucked, and absorbs the landing
 * — a whole-body verb, so unlike the postural gestures it carries **root**
 * translation (the ballistic rise on Y). Every leg angle stays inside the same
 * ROM the crouch uses, so no arm/abduction is involved and it needs no
 * left/right mirror.
 */
const JUMP_STOPS: [number, number, number][] = [
  [0, 0, 0], // rest
  [0.2, -0.05, 40], // coil — dip and bend
  [0.36, 0.03, 6], // push off — extend
  [0.58, 0.34, 24], // apex — peak, legs tucked
  [0.8, 0, 46], // land — absorb
  [1, 0, 0], // recover
];

/** The pose at a jump stop: symmetric leg bend + a root risen to `rootY`. */
function jumpPose(
  skeleton: string,
  rootY: number,
  legFlex: number,
): IAutoFilmPose {
  const knee = Math.min(legFlex * 1.4, 62);
  return {
    skeleton,
    root: {
      translation: { x: 0, y: rootY, z: 0 },
      rotation: { x: 0, y: 0, z: 0, w: 1 },
      scale: { x: 1, y: 1, z: 1 },
    },
    joints: [
      j("leftUpperLeg", { flexion: legFlex }),
      j("rightUpperLeg", { flexion: legFlex }),
      j("leftLowerLeg", { flexion: knee }),
      j("rightLowerLeg", { flexion: knee }),
      j("spine", { flexion: legFlex * 0.12 }),
    ],
  };
}

/**
 * Synthesise a **postural or whole-body gesture** — the trunk/leg half of the
 * harness `gesture` verb — into a short ROM-safe clip. `bow`/`nod`/`shake`/
 * `crouch` are single-axis trunk/head oscillations, `kick` is a right-leg front
 * snap, `wave` raises the right arm and swings the forearm, `celebrate` throws
 * both arms up in a V, and `jump` is a whole-body coil-and-leap carrying root
 * translation. The arm gestures abduct (the raise is −abduction on the left,
 * +abduction on the right — the shared axis, mirrored ROM per side). The
 * remaining combat gestures (`strike`, `draw`, `throw`, …) need reach or
 * rig-specific content and return `null`, left to a richer synthesiser.
 *
 * @author Samchon
 */
export const gestureMotion = (
  id: string,
  skeleton: string,
  kind: string,
  duration: number,
): IAutoFilmMotion | null => {
  if (kind === "jump") {
    const keyframes: IAutoFilmKeyframe[] = JUMP_STOPS.map(
      ([fraction, rootY, legFlex]) => ({
        time: fraction * duration,
        pose: jumpPose(skeleton, rootY, legFlex),
        expression: null,
        easing: "easeInOut",
        bezier: null,
      }),
    );
    return { id, skeleton, duration, loop: false, keyframes };
  }
  if (!GENERIC.has(kind)) return null;
  const shape = SHAPES[kind as AutoFilmGenericGesture];
  const keyframes: IAutoFilmKeyframe[] = shape.map(([fraction, joints]) => {
    const pose: IAutoFilmPose = { skeleton, root: null, joints };
    return {
      time: fraction * duration,
      pose,
      expression: null,
      easing: "easeInOut",
      bezier: null,
    };
  });
  return { id, skeleton, duration, loop: false, keyframes };
};
