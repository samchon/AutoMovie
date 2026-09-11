import { resolveProductionFrameRate } from "@automovie/engine";
import type { IAutoMovieProductionFrameRate } from "@automovie/interface";

import { assertProductionVideoProfile } from "../delivery/assertProductionVideoProfile";
import { resolveProductionVideoProfile } from "../delivery/resolveProductionVideoProfile";
import { parseProductionRenditionClip } from "./parseProductionRenditionClip";

/**
 * Refuse repaint bytes that cannot be conformed without decoding or changing
 * their reviewed presentation.
 */
export const assertProductionRenditionClipDelivery = (props: {
  bytes: Uint8Array;
  shot: string;
  width: number;
  height: number;
  fps: number;
  frameRate?: IAutoMovieProductionFrameRate;
  frameCount: number;
  runtimeSeconds: number;
}): void => {
  const clip = parseProductionRenditionClip(
    props.bytes,
    `Repaint clip "${props.shot}"`,
  );
  const frameRate = resolveProductionFrameRate(props);
  // The shot's own contract is judged first and by name, so a raster, clock,
  // count, or runtime drift is attributed to the clip before the generic
  // delivery profile speaks.
  if (
    clip.probe.width !== props.width ||
    clip.probe.height !== props.height ||
    clip.probe.frameCount !== props.frameCount ||
    props.runtimeSeconds !==
      (props.frameCount * frameRate.denominator) / frameRate.numerator ||
    BigInt(clip.probe.presentation.movieDuration) *
      BigInt(frameRate.numerator) !==
      BigInt(props.frameCount) *
        BigInt(frameRate.denominator) *
        BigInt(clip.probe.presentation.movieTimescale)
  )
    throw new Error(
      `Repaint clip "${props.shot}" does not match its exact raster, rational frame clock, frame count, and runtime contract.`,
    );
  assertProductionVideoProfile({
    expected: resolveProductionVideoProfile({
      width: props.width,
      height: props.height,
      frameRate,
    }),
    actual: clip.probe,
  });
};
