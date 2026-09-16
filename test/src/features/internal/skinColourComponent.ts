import type {
  IPortraitComponent,
  IPortraitComponentPlan,
} from "@automovie/human";

/** A typed no-cut component for independent assembly-correspondence probes. */
export const skinColourComponent = (
  attach: IPortraitComponentPlan["attach"],
  id = "colour-probe",
): IPortraitComponent => ({
  id,
  fit: () => ({ constraints: [], cutFaces: [], attach }),
});

/** An empty interior lets probes inspect the common skin directly. */
export const skinColourFinisher = () => ({
  openings: [] as number[][],
  finish: () => [],
});
