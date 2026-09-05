import { AutoMovieProductionFrameCapture } from "@automovie/interface";
import { PNG } from "pngjs";

import { testCaptureRuntimeIdentity } from "./productionFixtures";

/**
 * One decodable PNG with visible variance in every channel.
 *
 * The capture path refuses a blank frame, so a stub that returned one flat
 * colour would test the refusal instead of the case that arranged it.
 */
export const capturedPng = (width: number, height: number): Uint8Array => {
  const image = new PNG({ width, height });
  for (let offset = 0; offset < image.data.length; offset += 4) {
    image.data[offset] = offset % 251;
    image.data[offset + 1] = (offset * 7) % 241;
    image.data[offset + 2] = (offset * 13) % 239;
    image.data[offset + 3] = 255;
  }
  return PNG.sync.write(image);
};

/**
 * Answer every requested view, and record what the host was asked for.
 *
 * The recorded calls are how a case proves the request reached the host as
 * stated rather than being rewritten on the way, which is the half a returned
 * receipt cannot show.
 */
export const recordingCapture = (): {
  adapter: AutoMovieProductionFrameCapture;
  calls: Array<Parameters<AutoMovieProductionFrameCapture>[0]>;
} => {
  const calls: Array<Parameters<AutoMovieProductionFrameCapture>[0]> = [];
  return {
    calls,
    adapter: (input) => {
      calls.push(input);
      const width = input.width ?? 0;
      const height = input.height ?? 0;
      return Promise.resolve({
        bytes: capturedPng(width, height),
        dialogueRuntimeIdentity: null,
        runtimeIdentity: testCaptureRuntimeIdentity(),
        width,
        height,
        observation: {
          status: "not-run" as const,
          reason: "The capture stub draws no shot scene graph.",
        },
        semanticMask: {
          status: "not-run" as const,
          reason: "The capture stub derives no semantic mask.",
        },
      });
    },
  };
};
