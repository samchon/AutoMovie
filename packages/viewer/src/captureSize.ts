/**
 * Pin a capture canvas to an exact pixel size, so a headless screenshot of it is
 * the requested frame size regardless of the host browser window.
 *
 * Without this the capture canvas is CSS `100vw/100vh`, so `#view`'s rendered
 * (and screenshotted) size is whatever viewport the host happened to open —
 * making the encoded aspect a convention the pose-keypoint sidecar's `width/height`
 * aspect (#1231) could not rely on. The render plan now pins the encoded size with
 * ffmpeg `-s` (#1251); pinning the CANVAS to the same `width`/`height` here means
 * that `-s` re-encodes an already-correct frame instead of rescaling a
 * wrong-aspect capture. A non-positive or non-finite dimension is ignored, so
 * interactive viewing (no capture dimensions) keeps the responsive CSS size.
 *
 * @author Samchon
 */
export const applyCaptureCanvasSize = (
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
): void => {
  if (
    !Number.isFinite(width) ||
    width <= 0 ||
    !Number.isFinite(height) ||
    height <= 0
  )
    return;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
};
