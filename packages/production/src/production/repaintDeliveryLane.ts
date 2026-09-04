import { AutoMovieContentDigest } from "@automovie/interface";

/** One exact delivered occurrence in the current film timeline. */
export interface IAutoMovieVisualDeliveryOccurrence {
  occurrence: string;
  shot: string;
}

/** Explicit source selected for one deterministic or repainted occurrence. */
export type IAutoMovieVisualDeliveryLane =
  | (IAutoMovieVisualDeliveryOccurrence & {
      lane: "deterministic";
      deterministic: { path: string; digest: AutoMovieContentDigest };
      repaint: null;
    })
  | (IAutoMovieVisualDeliveryOccurrence & {
      lane: "repainted";
      deterministic: null;
      repaint: {
        path: string;
        digest: AutoMovieContentDigest;
        receiptDigest: AutoMovieContentDigest;
        selectionDigest: AutoMovieContentDigest;
      };
    });

/** Reviewed transition between adjacent unlike visual lanes. */
export interface IAutoMovieVisualDeliveryTransition {
  fromOccurrence: string;
  toOccurrence: string;
  reviewDigest: AutoMovieContentDigest;
}

/** Versioned mixed-lane policy; absent for an all-one-lane film. */
export interface IAutoMovieMixedVisualDeliveryPolicy {
  version: 1;
  observationDigest: AutoMovieContentDigest;
  transitions: IAutoMovieVisualDeliveryTransition[];
}

/** Stable exact-join failures produced before any final mux side effect. */
export type AutoMovieVisualDeliveryDiagnostic =
  | "visual-lane-population-invalid"
  | "visual-lane-source-invalid"
  | "visual-lane-policy-missing"
  | "visual-lane-transition-invalid";

/** Result of resolving every current occurrence to exactly one visual source. */
export interface IAutoMovieVisualDeliveryPlan {
  segments: IAutoMovieVisualDeliveryLane[];
  diagnostics: AutoMovieVisualDeliveryDiagnostic[];
}

/**
 * Resolve an explicit visual lane for every delivered occurrence.
 *
 * @evidence requirements/repaint/sequence-continuity-and-publication.md#repaint-mixed-delivery Keeps deterministic and repainted sources explicit and refuses fallback or inference from receipt presence.
 * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-repaint-failure-publication Requires an exact timeline join and one reviewed record for every actual lane crossing before final publication.
 */
export const planAutoMovieVisualDelivery = (props: {
  timeline: readonly IAutoMovieVisualDeliveryOccurrence[];
  lanes: readonly IAutoMovieVisualDeliveryLane[];
  policy: IAutoMovieMixedVisualDeliveryPolicy | null;
}): IAutoMovieVisualDeliveryPlan => {
  const diagnostics: AutoMovieVisualDeliveryDiagnostic[] = [];
  if (
    props.timeline.length === 0 ||
    props.timeline.length !== props.lanes.length ||
    duplicateOccurrences(props.timeline) ||
    duplicateOccurrences(props.lanes) ||
    props.timeline.some(
      (occurrence, index) =>
        occurrence.occurrence !== props.lanes[index]?.occurrence ||
        occurrence.shot !== props.lanes[index]?.shot,
    )
  )
    diagnostics.push("visual-lane-population-invalid");
  if (props.lanes.some((lane) => !validLane(lane)))
    diagnostics.push("visual-lane-source-invalid");
  const mixed = new Set(props.lanes.map((lane) => lane.lane)).size > 1;
  const crossings = props.lanes.slice(1).flatMap((lane, index) => {
    const previous = props.lanes[index]!;
    return previous.lane === lane.lane
      ? []
      : [
          {
            fromOccurrence: previous.occurrence,
            toOccurrence: lane.occurrence,
          },
        ];
  });
  if (mixed && props.policy === null)
    diagnostics.push("visual-lane-policy-missing");
  else if (
    props.policy !== null &&
    (props.policy.version !== 1 ||
      !isDigest(props.policy.observationDigest) ||
      props.policy.transitions.length !== crossings.length ||
      props.policy.transitions.some(
        (transition, index) =>
          transition.fromOccurrence !== crossings[index]?.fromOccurrence ||
          transition.toOccurrence !== crossings[index]?.toOccurrence ||
          !isDigest(transition.reviewDigest),
      ))
  )
    diagnostics.push("visual-lane-transition-invalid");
  return {
    segments: diagnostics.length === 0 ? structuredClone(props.lanes) : [],
    diagnostics,
  };
};

/** Normalize an explicit legacy all-one-lane declaration without receipt inference. */
export const normalizeAutoMovieVisualDeliveryLanes = (props: {
  timeline: readonly IAutoMovieVisualDeliveryOccurrence[];
  visualDelivery: "deterministic" | "repainted";
  deterministic: (occurrence: IAutoMovieVisualDeliveryOccurrence) => {
    path: string;
    digest: AutoMovieContentDigest;
  };
  repaint: (occurrence: IAutoMovieVisualDeliveryOccurrence) => {
    path: string;
    digest: AutoMovieContentDigest;
    receiptDigest: AutoMovieContentDigest;
    selectionDigest: AutoMovieContentDigest;
  };
}): IAutoMovieVisualDeliveryLane[] =>
  props.timeline.map(
    (occurrence): IAutoMovieVisualDeliveryLane =>
      props.visualDelivery === "deterministic"
        ? {
            ...occurrence,
            lane: "deterministic",
            deterministic: props.deterministic(occurrence),
            repaint: null,
          }
        : {
            ...occurrence,
            lane: "repainted",
            deterministic: null,
            repaint: props.repaint(occurrence),
          },
  );

const duplicateOccurrences = (
  values: readonly IAutoMovieVisualDeliveryOccurrence[],
): boolean =>
  new Set(values.map((value) => value.occurrence)).size !== values.length ||
  values.some(
    (value) => !isExactText(value.occurrence) || !isExactText(value.shot),
  );

const validLane = (lane: IAutoMovieVisualDeliveryLane): boolean =>
  lane.lane === "deterministic"
    ? lane.repaint === null &&
      isExactText(lane.deterministic.path) &&
      isDigest(lane.deterministic.digest)
    : lane.deterministic === null &&
      isExactText(lane.repaint.path) &&
      isDigest(lane.repaint.digest) &&
      isDigest(lane.repaint.receiptDigest) &&
      isDigest(lane.repaint.selectionDigest);

const isDigest = (value: string): boolean =>
  /^sha256:[0-9a-f]{64}$/u.test(value);
const isExactText = (value: string): boolean =>
  typeof value === "string" &&
  value.trim().length > 0 &&
  value === value.trim();
