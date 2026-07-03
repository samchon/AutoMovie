import {
  AutoFilmHumanoidBone,
  IAutoFilmJointPose,
  IAutoFilmKeyframe,
  IAutoFilmMotion,
  IAutoFilmPose,
} from "@autofilm/interface";

/** The postural/expressive gestures the reference synthesiser can author. */
export type AutoFilmGenericGesture = "bow" | "nod" | "shake" | "crouch";

const GENERIC = new Set<string>(["bow", "nod", "shake", "crouch"]);

// The postural gestures are single-axis (spine/head flexion, head twist, knee
// flexion) — none abduct — so the helper carries only the two axes they use.
const j = (
  bone: AutoFilmHumanoidBone,
  axes: Partial<Pick<IAutoFilmJointPose, "flexion" | "twist">>,
): IAutoFilmJointPose => ({
  bone,
  flexion: axes.flexion ?? null,
  abduction: null,
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
  };

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
 * `crouch` are single-axis trunk/head oscillations, and `jump` is a whole-body
 * coil-and-leap that carries root translation (the ballistic rise); all are
 * authored from any humanoid rig with no arm abduction, so none need a left/
 * right mirror. The arm/combat gestures (`strike`, `wave`, `celebrate`, …) need
 * reach or rig-specific content and return `null`, left to a richer
 * synthesiser.
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
