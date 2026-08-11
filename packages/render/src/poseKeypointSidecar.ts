import { IAutoMoviePoseKeypoint } from "@automovie/interface";

/**
 * One actor's projected keypoints in a single output frame: the node id plus
 * its named-joint screen positions (see {@link IAutoMoviePoseKeypoint}).
 *
 * @evidence requirements/repaint/source-frames-and-reference-locking.md#repaint-control-alignment `IAutoMoviePoseKeypointActor` preserves frame-aligned structural guidance as a separate render product.
 * @evidence specifications/editorial-render-and-delivery/render-products-visibility-and-color.md#spec-render-pass-products `IAutoMoviePoseKeypointActor` exposes that responsibility through the package-independent system contract.
 * @author Samchon
 */
export interface IAutoMoviePoseKeypointActor {
  /**
   * The scene-node id of the performing actor.
   *
   * @evidence requirements/repaint/source-frames-and-reference-locking.md#repaint-control-alignment `IAutoMoviePoseKeypointActor.node` preserves frame-aligned structural guidance as a separate render product.
   * @evidence specifications/editorial-render-and-delivery/render-products-visibility-and-color.md#spec-render-pass-products `IAutoMoviePoseKeypointActor.node` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
  node: string;

  /**
   * The actor's named joints, projected to the frame.
   *
   * @evidence requirements/repaint/source-frames-and-reference-locking.md#repaint-control-alignment `IAutoMoviePoseKeypointActor.keypoints` preserves frame-aligned structural guidance as a separate render product.
   * @evidence specifications/editorial-render-and-delivery/render-products-visibility-and-color.md#spec-render-pass-products `IAutoMoviePoseKeypointActor.keypoints` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
  keypoints: IAutoMoviePoseKeypoint[];

  /**
   * How much of this actor's own color survives the scene's atmosphere at its
   * camera depth: {@link sceneFogTransmittance} over the scene's
   * {@link IAutoMovieFog}, one at the lens and falling toward zero with
   * distance.
   *
   * This is the offline half of the fog contract. A pose-conditioned host
   * reading this sidecar drives generation from screen coordinates alone, and
   * screen coordinates say nothing about whether the subject standing there is
   * fully visible or a shape barely separable from the haze. The number is the
   * SAME derivation the viewer's shader applies to the same declaration, not a
   * renderer-local estimate of it, so the sidecar and the encoded frame agree
   * about the film.
   *
   * Present only when the scene declares fog. A scene that declares none omits
   * the field entirely, so its sidecar is byte-identical to one written before
   * atmosphere existed.
   *
   * @evidence requirements/repaint/source-frames-and-reference-locking.md#repaint-control-alignment `IAutoMoviePoseKeypointActor.atmosphere` preserves frame-aligned structural guidance as a separate render product.
   * @evidence specifications/editorial-render-and-delivery/render-products-visibility-and-color.md#spec-render-pass-products `IAutoMoviePoseKeypointActor.atmosphere` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
  atmosphere?: number;
}

/**
 * One output frame's pose keypoints: which beat is live and every performing
 * actor's projected joints. Unlike the caption sidecar (run-length spans, since
 * a caption is constant across a shot), the pose sidecar is genuinely
 * per-frame: poses change every frame.
 *
 * @evidence requirements/repaint/source-frames-and-reference-locking.md#repaint-control-alignment `IAutoMoviePoseKeypointFrame` preserves frame-aligned structural guidance as a separate render product.
 * @evidence specifications/editorial-render-and-delivery/render-products-visibility-and-color.md#spec-render-pass-products `IAutoMoviePoseKeypointFrame` exposes that responsibility through the package-independent system contract.
 * @author Samchon
 */
export interface IAutoMoviePoseKeypointFrame {
  /**
   * Global output frame index.
   *
   * @evidence requirements/repaint/source-frames-and-reference-locking.md#repaint-control-alignment `IAutoMoviePoseKeypointFrame.frame` preserves frame-aligned structural guidance as a separate render product.
   * @evidence specifications/editorial-render-and-delivery/render-products-visibility-and-color.md#spec-render-pass-products `IAutoMoviePoseKeypointFrame.frame` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
  frame: number;

  /**
   * The beat whose shot is live on this frame.
   *
   * @evidence requirements/repaint/source-frames-and-reference-locking.md#repaint-control-alignment `IAutoMoviePoseKeypointFrame.beat` preserves frame-aligned structural guidance as a separate render product.
   * @evidence specifications/editorial-render-and-delivery/render-products-visibility-and-color.md#spec-render-pass-products `IAutoMoviePoseKeypointFrame.beat` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
  beat: string;

  /**
   * Every performing actor's keypoints on this frame.
   *
   * @evidence requirements/repaint/source-frames-and-reference-locking.md#repaint-control-alignment `IAutoMoviePoseKeypointFrame.actors` preserves frame-aligned structural guidance as a separate render product.
   * @evidence specifications/editorial-render-and-delivery/render-products-visibility-and-color.md#spec-render-pass-products `IAutoMoviePoseKeypointFrame.actors` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
  actors: IAutoMoviePoseKeypointActor[];
}

/**
 * The per-frame pose-keypoint sidecar for a sequence render (#1168): the
 * machine-readable OpenPose-style companion to the rendered `pose` guide pass,
 * exactly as the caption sidecar companions the beauty frames. A diffusion host
 * reads it frame-for-frame to drive pose-conditioned (ControlNet) generation.
 *
 * @evidence requirements/repaint/source-frames-and-reference-locking.md#repaint-control-alignment `IAutoMoviePoseKeypointSidecar` preserves frame-aligned structural guidance as a separate render product.
 * @evidence specifications/editorial-render-and-delivery/render-products-visibility-and-color.md#spec-render-pass-products `IAutoMoviePoseKeypointSidecar` exposes that responsibility through the package-independent system contract.
 * @author Samchon
 */
export interface IAutoMoviePoseKeypointSidecar {
  /**
   * The sequence this sidecar tracks.
   *
   * @evidence requirements/repaint/source-frames-and-reference-locking.md#repaint-control-alignment `IAutoMoviePoseKeypointSidecar.target` preserves frame-aligned structural guidance as a separate render product.
   * @evidence specifications/editorial-render-and-delivery/render-products-visibility-and-color.md#spec-render-pass-products `IAutoMoviePoseKeypointSidecar.target` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
  target: string;

  /**
   * Output frames per second the frames are addressed in.
   *
   * @evidence requirements/repaint/source-frames-and-reference-locking.md#repaint-control-alignment `IAutoMoviePoseKeypointSidecar.fps` preserves frame-aligned structural guidance as a separate render product.
   * @evidence specifications/editorial-render-and-delivery/render-products-visibility-and-color.md#spec-render-pass-products `IAutoMoviePoseKeypointSidecar.fps` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
  fps: number;

  /**
   * Total output frames (`round(runtime × fps)`, the frame-atomic clock).
   *
   * @evidence requirements/repaint/source-frames-and-reference-locking.md#repaint-control-alignment `IAutoMoviePoseKeypointSidecar.frameCount` preserves frame-aligned structural guidance as a separate render product.
   * @evidence specifications/editorial-render-and-delivery/render-products-visibility-and-color.md#spec-render-pass-products `IAutoMoviePoseKeypointSidecar.frameCount` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
  frameCount: number;

  /**
   * One entry per output frame, in play order.
   *
   * @evidence requirements/repaint/source-frames-and-reference-locking.md#repaint-control-alignment `IAutoMoviePoseKeypointSidecar.frames` preserves frame-aligned structural guidance as a separate render product.
   * @evidence specifications/editorial-render-and-delivery/render-products-visibility-and-color.md#spec-render-pass-products `IAutoMoviePoseKeypointSidecar.frames` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
  frames: IAutoMoviePoseKeypointFrame[];
}

/**
 * Serialize the sidecar for the host to write: pretty JSON, declared order.
 *
 * @evidence requirements/repaint/source-frames-and-reference-locking.md#repaint-control-alignment `renderPoseKeypointSidecar` preserves frame-aligned structural guidance as a separate render product.
 * @evidence specifications/editorial-render-and-delivery/render-products-visibility-and-color.md#spec-render-pass-products `renderPoseKeypointSidecar` exposes that responsibility through the package-independent system contract.
 * @author Samchon
 */
export const renderPoseKeypointSidecar = (
  sidecar: IAutoMoviePoseKeypointSidecar,
): string => `${JSON.stringify(sidecar, null, 2)}\n`;
