import { selectAutoMovieTriangleRegion } from "@automovie/engine";
import type {
  IAutoMovieMaterial,
  IAutoMovieModelPart,
} from "@automovie/interface";

import type { IPortraitFinalSurface } from "./portraitFinalSurface";
import type { IControlMesh } from "./subdivideControlMesh";

/**
 * A part's exact skin attachment, in the host's millimetre coordinate frame.
 * The host spreads its displacement through neighbouring skin within reach.
 *
 * @author Samchon
 */
export interface IPortraitSkinConstraint {
  /** Existing host vertex identity, retained through assembly and subdivision. */
  vertex: number;
  /** Requested XYZ position of that shared attachment vertex, in millimetres. */
  target: number[];
  /** Maximum distance along the original skin over which surrounding skin adapts. */
  reach: number;
}

/**
 * The substrate a replaceable anatomical component fits. Landmark identities
 * belong to the subject's socket binding, never to the generic host assembler.
 *
 * @author Samchon
 */
export interface IPortraitComponentHost {
  /** Original measured control positions, including any non-skin gaze markers. */
  positions: number[][];
  /** Original oriented skin triangles; their ordinals identify removable faces. */
  indices: number[];
  /** Recorded image-depth direction used to preserve measured gaze placement. */
  viewRay: number[];
}

/**
 * An anatomical part fitted to one host. Its boundary constraints drive the
 * surrounding skin, and its attach stage shares the existing host vertex IDs.
 * The returned finisher can only be obtained after attachment, so it reads the
 * actual refined boundary instead of guessing where subdivision will put it.
 *
 * @author Samchon
 */
export interface IPortraitComponentPlan {
  /** Exact boundary/control positions requested before the host blends skin. */
  constraints: IPortraitSkinConstraint[];
  /** Triangle ordinals removed from the original host before this part attaches. */
  cutFaces: number[];
  /** Attach common skin topology, then return the consumer of the refined mesh. */
  attach: (
    cage: IControlMesh,
    adapted: number[][],
    region: (id: string, material: string) => number,
  ) => {
    /** Deliberately open skin rims, such as the inner eyelid, in boundary order. */
    openings: number[][];
    /** Propose shared final positions from the immutable post-layer surface. */
    finalSurface?: IPortraitFinalSurface;
    /** Build independent interior parts against the shared refined skin. */
    finish: (refined: IControlMesh) => IAutoMovieModelPart[];
  };
}

/**
 * A swappable anatomical component. The assembler depends on this protocol,
 * rather than importing an eye or nose implementation. A new component can
 * supply different geometry while retaining the same attachment protocol.
 *
 * @author Samchon
 */
export interface IPortraitComponent {
  /** Optional component-owned finishes; scalar properties follow this part's dimensions. */
  materials?: IAutoMovieMaterial[];
  /** Stable instance identity, allowing separate left/right components. */
  id: string;
  /** Fit the component's numerical shape to this subject's declared socket. */
  fit: (host: IPortraitComponentHost) => IPortraitComponentPlan;
}

/**
 * Select the original patch bounded by the inward-oriented anatomical loop.
 * The engine owns the connectivity operation; no image-plane test is repeated
 * here, so changing a measured face cannot change which seam triangles it cuts.
 */
export function portraitFacesInsideLoop(
  host: IPortraitComponentHost,
  loop: number[],
): number[] {
  return selectAutoMovieTriangleRegion({
    indices: host.indices,
    boundary: loop,
  });
}
