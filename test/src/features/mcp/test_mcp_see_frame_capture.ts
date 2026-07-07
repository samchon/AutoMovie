import { IAutoMovieRenderSpec, IAutoMovieScene } from "@automovie/interface";
import {
  AutoMovieApplication,
  IAutoMovieMcpCaptureRequest,
  IAutoMovieMcpWritableSlate,
} from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";

import { IDENTITY_TRANSFORM } from "../internal/fixtures";
import { nclose } from "../internal/predicates";

const scene: IAutoMovieScene = {
  id: "scene-1",
  name: null,
  nodes: [],
  cameras: [
    {
      id: "camera",
      transform: IDENTITY_TRANSFORM,
      fovY: 45,
      near: 0.1,
      far: 100,
    },
  ],
  lights: [],
};

const slate: IAutoMovieMcpWritableSlate = {
  script: null,
  scene,
  shots: [
    {
      id: "shot:beat-1",
      name: null,
      scene: scene.id,
      camera: "camera",
      cameraMotion: null,
      performances: [],
      objectMotions: [],
      duration: 1,
    },
  ],
  beatEnds: [],
  notes: [],
  film: null,
};

const spec: IAutoMovieRenderSpec = {
  target: "shot:beat-1",
  fps: 10,
  width: 640,
  height: 360,
  toneMapping: "none",
  codec: "h264",
  pixelFormat: "yuv420p",
  crf: 20,
};

/**
 * `seeFrame` closes the render/see loop through a host-injected capture
 * adapter: the server plans the frame and the pass, the adapter owns the
 * renderer and returns the pixels, and the tool reports `captured` with the
 * image — while validation still runs before any capture, and a capture fault
 * propagates as a real error rather than a fake success.
 *
 * Scenarios:
 *
 * 1. With an injected adapter, `seeFrame` hands it the planned request (frame,
 *    time, pass-tagged path, spec dimensions) and returns status `captured`
 *    with the adapter's image.
 * 2. The requested guide pass rides the request and tags the frame path.
 * 3. An unknown pass fails validation before the adapter is ever called.
 * 4. An adapter failure rejects the call — a host runtime fault is not wrapped as
 *    a validation result.
 */
export const test_mcp_see_frame_capture = async (): Promise<void> => {
  const requests: IAutoMovieMcpCaptureRequest[] = [];
  const app = new AutoMovieApplication({
    capture: async (request) => {
      requests.push(request);
      return {
        framePath: request.framePath,
        mimeType: "image/png",
        dataUrl: "data:image/png;base64,AAAA",
      };
    },
  });

  const captured = (await app.seeFrame({ slate, spec, frame: 3, pass: "pose" }))
    .preview;
  if (captured === null) throw new Error("captured preview must succeed");
  TestValidator.equals("captured status", captured.status, "captured");
  TestValidator.equals("adapter received one request", requests.length, 1);
  TestValidator.equals("request frame", requests[0]!.frame, 3);
  TestValidator.predicate("request time", nclose(requests[0]!.time, 0.3));
  TestValidator.equals("request pass", requests[0]!.pass, "pose");
  TestValidator.equals(
    "request path is pass-tagged",
    requests[0]!.framePath,
    "frames/shot_beat-1/frame_00003.pose.png",
  );
  TestValidator.equals("request width", requests[0]!.width, 640);
  TestValidator.equals("captured image rides the preview", captured.image, {
    framePath: "frames/shot_beat-1/frame_00003.pose.png",
    mimeType: "image/png",
    dataUrl: "data:image/png;base64,AAAA",
  });

  const invalid = await app.seeFrame({ slate, spec, pass: "sketch" });
  TestValidator.equals("unknown pass fails", invalid.validation.success, false);
  TestValidator.equals(
    "adapter is not called on validation failure",
    requests.length,
    1,
  );

  const failing = new AutoMovieApplication({
    capture: async () => {
      throw new Error("browser lost");
    },
  });
  const rejected = await (async () => {
    try {
      await failing.seeFrame({ slate, spec });
      return false;
    } catch (error) {
      return error instanceof Error && error.message.includes("browser lost");
    }
  })();
  TestValidator.predicate("adapter failure rejects the call", rejected);
};
