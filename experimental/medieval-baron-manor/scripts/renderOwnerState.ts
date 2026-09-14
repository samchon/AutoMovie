import {
  type AutoMovieLocalProcessOwnerObservation,
  type IAutoMovieLocalProcessOwner,
  isAutoMovieLocalProcessOwner,
} from "@automovie/production";

/** Two independent owner observations authorizing or preserving one record. */
export type RenderOwnerRecoveryDecision =
  | {
      /** Both observations proved the recorded local process absent. */
      state: "reclaimable";
      /** Owner generation both observations addressed. */
      owner: IAutoMovieLocalProcessOwner;
    }
  | {
      /** Recovery lacks two affirmative absence observations. */
      state: "preserved";
      /** The observation that denied recovery. */
      observation: AutoMovieLocalProcessOwnerObservation;
    };

/** Require two independent absence observations before render recovery. */
export const observeRenderOwnerRecovery = (props: {
  /** Optional exact-snapshot fence run between the two observations. */
  between?: () => void;
  observe: (owner: unknown) => AutoMovieLocalProcessOwnerObservation;
  owner: unknown;
}): RenderOwnerRecoveryDecision => {
  const first = props.observe(props.owner);
  if (first.state !== "absent")
    return { state: "preserved", observation: first };
  props.between?.();
  const second = props.observe(props.owner);
  return second.state === "absent" &&
    isAutoMovieLocalProcessOwner(props.owner) &&
    sameRenderOwner(first.owner, props.owner) &&
    sameRenderOwner(second.owner, props.owner)
    ? { state: "reclaimable", owner: second.owner }
    : { state: "preserved", observation: second };
};

const sameRenderOwner = (
  left: IAutoMovieLocalProcessOwner,
  right: IAutoMovieLocalProcessOwner,
): boolean =>
  left.host === right.host &&
  left.pid === right.pid &&
  left.generation === right.generation;
