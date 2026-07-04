import {
  AutoMovieHumanoidBone,
  IAutoMovieJointPose,
  IAutoMovieKeyframe,
  IAutoMovieMotion,
  IAutoMoviePose,
} from "@automovie/interface";

/** The postural/expressive gestures the reference synthesiser can author. */
export type AutoMovieGenericGesture =
  | "bow"
  | "nod"
  | "shake"
  | "crouch"
  | "kick"
  | "stagger"
  | "wave"
  | "celebrate"
  | "draw"
  | "throw";

const GENERIC = new Set<string>([
  "bow",
  "nod",
  "shake",
  "crouch",
  "kick",
  "stagger",
  "wave",
  "celebrate",
  "draw",
  "throw",
]);

// A joint stop across the three articulation axes (unset axes stay null). The
// arm gestures are authored in **clinical** space (abduction 0 = arm down, 90 =
// horizontal, 180 = overhead — the same value raises either arm); the per-side
// rest-frame remap that fits it to a rig lives in the render, not these angles.
const j = (
  bone: AutoMovieHumanoidBone,
  axes: Partial<Pick<IAutoMovieJointPose, "flexion" | "abduction" | "twist">>,
): IAutoMovieJointPose => ({
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
const SHAPES: Record<
  AutoMovieGenericGesture,
  [number, IAutoMovieJointPose[]][]
> = {
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
  // A stagger: the trunk lurches off balance (spine bends and leans to one
  // side), a leg braces, then overcorrects the other way and settles — a
  // trunk/leg loss of balance, no arm abduction. All within humanoid ROM
  // (spine flexion ≤80/extension ≥−30, abduction ±35).
  stagger: [
    [0, []],
    [
      0.2,
      [
        j("spine", { flexion: 18, abduction: 24 }),
        j("rightUpperLeg", { flexion: 30 }),
        j("rightLowerLeg", { flexion: 22 }),
      ],
    ],
    [
      0.5,
      [
        j("spine", { flexion: 6, abduction: -20 }),
        j("leftUpperLeg", { flexion: 24 }),
        j("leftLowerLeg", { flexion: 16 }),
      ],
    ],
    [0.75, [j("spine", { flexion: 8, abduction: 6 })]],
    [1, []],
  ],
  // A one-arm wave: raise the right arm (clinical +abduction, read up through
  // the rest frame) and swing the forearm side to side at the elbow, the idle
  // left arm resting down at the side (not left in the T-pose rest).
  wave: [
    [0, []],
    [0.15, wavePose(0)],
    [0.4, wavePose(55)],
    [0.65, wavePose(12)],
    [0.85, wavePose(55)],
    [1, []],
  ],
  // A two-arm celebration: both arms thrown up in a V and pumped. In clinical
  // space the raise is +abduction on both arms alike — no per-side mirror.
  celebrate: [
    [0, []],
    [0.22, celebratePose(1)],
    [0.45, celebratePose(1.1)],
    [0.7, celebratePose(1)],
    [1, []],
  ],
  // Draw a bow (right-handed): the left arm reaches forward to hold the bow
  // (clinical flexion raises it to the horizontal, elbow near-straight), the
  // right hand draws the string back to the cheek (shoulder abducted to
  // shoulder height, elbow folded hard) and holds, then the loose springs the
  // draw hand forward.
  draw: [
    [0, []],
    [0.3, drawPose()],
    [0.62, drawPose()],
    [
      0.82,
      [
        j("leftUpperArm", { flexion: 86, abduction: 8 }),
        j("rightUpperArm", { abduction: 70, flexion: 34 }),
        j("rightLowerArm", { flexion: 30 }),
      ],
    ],
    [1, []],
  ],
  // An overhand throw (right-handed): the throwing arm cocks up-and-back with
  // the elbow loaded while the trunk coils away and the lead (left) arm points
  // out for aim; then the arm whips forward and down as the trunk uncoils and
  // the lead arm pulls in. A stylised sagittal throw, all inside the humanoid
  // ROM. Both arms are posed so the off arm never hangs in the T-pose rest.
  throw: [
    [0, []],
    [
      0.3,
      [
        j("rightUpperArm", { abduction: 92, flexion: -46 }),
        j("rightLowerArm", { flexion: 108 }),
        j("leftUpperArm", { abduction: 18, flexion: 62 }),
        j("leftLowerArm", { flexion: 16 }),
        j("spine", { flexion: -8, twist: -22 }),
      ],
    ],
    [
      0.52,
      [
        j("rightUpperArm", { abduction: 104, flexion: 60 }),
        j("rightLowerArm", { flexion: 16 }),
        j("leftUpperArm", { abduction: 24, flexion: -22 }),
        j("leftLowerArm", { flexion: 24 }),
        j("spine", { flexion: 16, twist: 16 }),
      ],
    ],
    [
      0.74,
      [
        j("rightUpperArm", { abduction: 62, flexion: 30 }),
        j("rightLowerArm", { flexion: 36 }),
        j("leftUpperArm", { abduction: 20, flexion: -10 }),
        j("spine", { flexion: 12, twist: 4 }),
      ],
    ],
    [1, []],
  ],
};

/**
 * Both arms thrown up in a V, scaled by `s` (a pump raises them higher). The
 * clinical abduction raises either arm alike, so both sides carry the same
 * positive angle — no per-side mirror.
 */
function celebratePose(s: number): IAutoMovieJointPose[] {
  return [
    j("leftUpperArm", { abduction: 150 * s, flexion: 10 }),
    j("rightUpperArm", { abduction: 150 * s, flexion: 10 }),
  ];
}

/** The held draw stance: bow arm forward, string hand back at the cheek. */
function drawPose(): IAutoMovieJointPose[] {
  return [
    j("leftUpperArm", { flexion: 88, abduction: 8 }),
    j("leftLowerArm", { flexion: 8 }),
    j("rightUpperArm", { abduction: 84, flexion: 24 }),
    j("rightLowerArm", { flexion: 118 }),
    j("head", { twist: 12 }),
  ];
}

/** A raised right arm with the forearm at `fore`; the idle left arm hangs down. */
function wavePose(fore: number): IAutoMovieJointPose[] {
  return [
    j("rightUpperArm", { abduction: 132, flexion: 6 }),
    j("rightLowerArm", { flexion: fore }),
    j("leftUpperArm", { abduction: 14 }),
  ];
}

function crouchPose(depth: number): IAutoMovieJointPose[] {
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
): IAutoMoviePose {
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
 * snap, `stagger` lurches the trunk off balance and catches it, `wave` raises
 * the right arm and swings the forearm, `celebrate` throws both arms up in a V,
 * `draw` pulls a bow, `throw` whips an overhand throw, and `jump` is a
 * whole-body coil-and-leap carrying root translation. The arm gestures are
 * authored in clinical space (abduction 0 = down, 90 = horizontal, 180 =
 * overhead — the same value raises either arm), read up through the rig's rest
 * frame at render. `strike` (a targeted jab) needs reach content and returns
 * `null` here, left to the richer synthesiser.
 *
 * @author Samchon
 */
export const gestureMotion = (
  id: string,
  skeleton: string,
  kind: string,
  duration: number,
): IAutoMovieMotion | null => {
  if (kind === "jump") {
    const keyframes: IAutoMovieKeyframe[] = JUMP_STOPS.map(
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
  const shape = SHAPES[kind as AutoMovieGenericGesture];
  const keyframes: IAutoMovieKeyframe[] = shape.map(([fraction, joints]) => {
    const pose: IAutoMoviePose = { skeleton, root: null, joints };
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
