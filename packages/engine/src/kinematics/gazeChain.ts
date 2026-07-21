import {
  AutoMovieHumanoidBone,
  IAutoMovieAngleRange,
  IAutoMovieJointPose,
  IAutoMovieSkeleton,
} from "@automovie/interface";

import { getConstraint } from "../rom/humanoidRom";

/** The bone a gaze is expressed on: the last link, and the one the eyes ride. */
const HEAD: AutoMovieHumanoidBone = "head";

/** The bone that carries whatever the head cannot hold legally. */
const NECK: AutoMovieHumanoidBone = "neck";

/**
 * How much of `need` one joint may legally take on one axis.
 *
 * A `null` range is **immobile**, not unconstrained: `validateJointRom` refuses
 * any non-zero value on an axis whose range is null ("does not move in twist;
 * this axis must be null or 0"), so such a joint's capacity is exactly zero.
 *
 * The share never overshoots and never flips sign, so a range that excludes
 * zero (a rig whose neck rests bent) cannot inject rotation the aim did not ask
 * for: a zero need always yields a zero share.
 */
const shareOf = (need: number, range: IAutoMovieAngleRange | null): number => {
  if (range === null) return 0;
  return need >= 0
    ? Math.min(need, Math.max(range.max, 0))
    : Math.max(need, Math.min(range.min, 0));
};

/**
 * Distribute one aim over the **gaze chain** (`neck` → `head`) as the joints
 * the rig declares can legally hold it.
 *
 * `lookAt` used to put the entire solved angle on `head` alone, so a gaze the
 * chain could easily reach came out breaking the rig's own ROM: 47.7 degrees of
 * flexion on a `head` declared `[-30, 30]` while the `neck` declared `[-50,
 * 60]` sat at zero, with a legal split available in every direction (#1360).
 * The author cannot correct that by authoring differently, because the gaze
 * angle is engine-solved from the target and the rig; the only recovery left
 * was widening the head bone until one joint carried the whole cervical range,
 * which makes the rig lie about the body. This is #1345's fix for the arm
 * chain, one joint up: a solver must not emit a pose the declared chain forbids
 * when the declared chain admits one.
 *
 * **Head first, neck for the remainder.** The head's own rotation is what
 * points the eyes, so it takes as much as its declared range legally holds and
 * the neck is recruited only for what is left. That makes the distribution a
 * strict extension of the single-bone aim: every gaze the head could already
 * hold compiles to exactly the pose it compiled to before, and the neck appears
 * in the pose only when it actually carries something.
 *
 * The two joints' clinical angles ADD along the chain: neither bone is in
 * {@link HUMANOID_JOINT_AXES}, so both use the default basis, and the canonical
 * humanoid rests with the cervical chain straight, which is what makes 17.7
 * degrees of neck flexion plus 30 of head flexion aim the head exactly where
 * 47.7 degrees on the head alone aimed it.
 *
 * **A chain that genuinely cannot span the aim keeps failing, unclamped.** What
 * neither joint can take stays on the head, so the shot's ROM gate reports it
 * with the head's overshoot equal to the amount by which the whole declared
 * chain falls short. That is the `reach` precedent exactly ("an impossible
 * reach fails the shot's ROM gate rather than being quietly bent into range"):
 * bending the aim into range instead would silently point the actor somewhere
 * it was never told to look.
 *
 * Without a rig (`null`), or on a rig that declares no `neck` bone, the pose is
 * the single `head` joint this always emitted. A rig-less actor context runs no
 * ROM gate at all in {@link performShot} (its `skeleton` lookup returns null),
 * so there is nothing to distribute for, and naming a bone the skeleton does
 * not declare would trade one violation for another.
 *
 * @author Samchon
 * @param props.rig The actor's resolved skeleton, or `null` when it has none.
 * @param props.flexionDeg Sagittal aim (tilt): `+` down, matching the pose
 *   axis.
 * @param props.twistDeg Transverse aim (turn) about the chain's long axis.
 * @returns The joints of the aim pose, parent first.
 */
export const gazeChainJoints = (props: {
  rig: IAutoMovieSkeleton | null;
  flexionDeg: number;
  twistDeg: number;
}): IAutoMovieJointPose[] => {
  const declared = (bone: AutoMovieHumanoidBone) =>
    props.rig?.bones.find((entry) => entry.bone === bone) ?? null;
  const headBone = declared(HEAD);
  const neckBone = declared(NECK);
  const onlyHead = (flexion: number, twist: number): IAutoMovieJointPose[] => [
    { bone: HEAD, flexion, abduction: null, twist },
  ];
  if (headBone === null || neckBone === null)
    return onlyHead(props.flexionDeg, props.twistDeg);

  // Both cervical bones sit in `DEFAULT_HUMANOID_ROM`, so a declared bone
  // always resolves to a constraint: the override when the rig states one, the
  // canonical table otherwise, which is the same fallback the ROM gate applies.
  const headRom = getConstraint(HEAD, headBone.constraint)!;
  const neckRom = getConstraint(NECK, neckBone.constraint)!;
  const split = (
    need: number,
    axis: "flexion" | "twist",
  ): { head: number; neck: number } => {
    const onHead = shareOf(need, headRom[axis]);
    const onNeck = shareOf(need - onHead, neckRom[axis]);
    // The residual rides the head: see the unclamped-failure note above.
    return { head: need - onNeck, neck: onNeck };
  };
  const flexion = split(props.flexionDeg, "flexion");
  const twist = split(props.twistDeg, "twist");

  return [
    // The neck joins the pose only when it carries something, so an aim the
    // head holds on its own is byte-identical to the single-bone pose.
    ...(flexion.neck !== 0 || twist.neck !== 0
      ? [
          {
            bone: NECK,
            flexion: flexion.neck === 0 ? null : flexion.neck,
            abduction: null,
            twist: twist.neck === 0 ? null : twist.neck,
          },
        ]
      : []),
    { bone: HEAD, flexion: flexion.head, abduction: null, twist: twist.head },
  ];
};
