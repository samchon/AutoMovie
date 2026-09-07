import { mountViewer } from "@automovie/viewer";
import * as THREE from "three";

import { flightSpeedReadout } from "./flightSpeedReadout";
import { VIEWER_BACKGROUND, viewerDocument } from "./viewerDocument";

const { canvas, status } = viewerDocument();
let failed = false;
let disposed = false;
let disconnected = false;
let cleanup: () => void = () => undefined;
const stop = (): void => {
  if (disposed) return;
  disposed = true;
  cleanup();
};
const fail = (message: string): void => {
  failed = true;
  stop();
  canvas.style.visibility = "hidden";
  status.textContent = `Source preview is unavailable.\n${message}`;
};
window.addEventListener("automovie:source-unavailable", (event) =>
  fail(String((event as CustomEvent<unknown>).detail)),
);
window.addEventListener("pagehide", stop);
import.meta.hot?.dispose(stop);
import.meta.hot?.on("vite:beforeUpdate", () =>
  fail("Reloading changed source..."),
);
import.meta.hot?.on("vite:beforeFullReload", () =>
  fail("Reloading changed source..."),
);
import.meta.hot?.on("vite:error", ({ err }) => fail(err.message));
import.meta.hot?.on("vite:ws:disconnect", () => {
  disconnected = true;
  fail("Viewer connection lost. Waiting to reload current source...");
});
import.meta.hot?.on("vite:ws:connect", () => {
  if (disconnected) window.location.reload();
});
window.addEventListener("error", (event) => fail(event.message));
window.addEventListener("unhandledrejection", (event: PromiseRejectionEvent) =>
  fail(
    event.reason instanceof Error ? event.reason.message : String(event.reason),
  ),
);

try {
  const { createPreview } = await import("../preview");
  const preview = await Promise.resolve(createPreview());
  if (failed || disposed)
    throw new Error("Preview loading was superseded by a source change.");
  const { scene, camera } = preview;
  const input = new AbortController();
  const held = new Set<string>();
  const directions = new Set([
    "KeyW",
    "KeyA",
    "KeyS",
    "KeyD",
    "ArrowUp",
    "ArrowLeft",
    "ArrowDown",
    "ArrowRight",
    "Space",
    "KeyC",
    "ShiftLeft",
    "ShiftRight",
  ]);
  const isForm = (target: EventTarget | null): boolean =>
    target instanceof Element &&
    target.closest("input, textarea, select, button, [contenteditable]") !==
      null;
  // Match inspect.html's flight: yaw/pitch mouse look, world-up height and a
  // lens zoom. No orbit controller can translate the camera during mouse look.
  const maxPitch = THREE.MathUtils.degToRad(89);
  const orientation = new THREE.Euler(0, 0, 0, "YXZ");
  const forward = new THREE.Vector3();
  const right = new THREE.Vector3();
  const worldUp = new THREE.Vector3(0, 1, 0);
  const travel = new THREE.Vector3();
  if (preview.target !== undefined) camera.lookAt(preview.target);
  let aimDistance = Math.max(
    preview.target?.distanceTo(camera.position) ?? 1,
    0.001,
  );
  const lastTarget = preview.target?.clone();
  const lastPosition = camera.position.clone();
  const lastQuaternion = camera.quaternion.clone();
  const rememberPose = (): void => {
    lastPosition.copy(camera.position);
    lastQuaternion.copy(camera.quaternion);
    if (preview.target !== undefined) lastTarget!.copy(preview.target);
  };
  const adoptAuthoredPose = (): void => {
    const targetChanged =
      preview.target !== undefined && !preview.target.equals(lastTarget!);
    if (
      !targetChanged &&
      camera.position.equals(lastPosition) &&
      camera.quaternion.equals(lastQuaternion)
    )
      return;
    held.clear();
    if (targetChanged) camera.lookAt(preview.target!);
    if (preview.target !== undefined)
      aimDistance = Math.max(preview.target.distanceTo(camera.position), 0.001);
    rememberPose();
  };
  const followEye = (): void => {
    // A producer may use the shared target for its inspection light. It follows
    // this eye; it is never an orbit pivot. Preset changes are adopted above.
    if (preview.target !== undefined)
      preview.target
        .copy(camera.position)
        .addScaledVector(camera.getWorldDirection(forward), aimDistance);
    rememberPose();
  };
  const axis = (
    positive: readonly string[],
    negative: readonly string[],
  ): number =>
    Number(positive.some((key) => held.has(key))) -
    Number(negative.some((key) => held.has(key)));
  let previous = 0;
  let speed = 4;
  let width = 0;
  let height = 0;
  let requestingLock = false;
  let inputNotice = "";
  const frameSeconds: number[] = [];
  const mounted = mountViewer(canvas, scene, camera, (elapsed) => {
    if (failed || disposed) return true;
    const real = Math.max(elapsed - previous, 0);
    const delta = Math.min(real, 0.1);
    previous = elapsed;
    if (frameSeconds.push(real) > 15) frameSeconds.shift();
    if (canvas.clientWidth !== width || canvas.clientHeight !== height) {
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      mounted.renderer.setSize(Math.max(width, 1), Math.max(height, 1), false);
      camera.aspect = Math.max(width, 1) / Math.max(height, 1);
      camera.updateProjectionMatrix();
    }
    adoptAuthoredPose();
    const locked = document.pointerLockElement === canvas;
    const fast = held.has("ShiftLeft") || held.has("ShiftRight");
    const pace = speed * (fast ? 4 : 1);
    if (locked) {
      camera.getWorldDirection(forward);
      right.set(1, 0, 0).applyQuaternion(camera.quaternion);
      travel
        .set(0, 0, 0)
        .addScaledVector(
          forward,
          axis(["KeyW", "ArrowUp"], ["KeyS", "ArrowDown"]),
        )
        .addScaledVector(
          right,
          axis(["KeyD", "ArrowRight"], ["KeyA", "ArrowLeft"]),
        )
        .addScaledVector(worldUp, axis(["Space"], ["KeyC"]));
      if (travel.lengthSq() !== 0)
        camera.position.addScaledVector(travel.normalize(), pace * delta);
    }
    followEye();
    preview.update?.(elapsed, camera, canvas.height);
    orientation.setFromQuaternion(camera.quaternion, "YXZ");
    status.textContent =
      `Working source · x=${camera.position.x.toFixed(2)}` +
      ` y=${camera.position.y.toFixed(2)} z=${camera.position.z.toFixed(2)}` +
      ` · yaw=${THREE.MathUtils.radToDeg(orientation.y).toFixed(1)}°` +
      ` pitch=${THREE.MathUtils.radToDeg(orientation.x).toFixed(1)}°` +
      ` · fov=${camera.fov.toFixed(1)}°` +
      ` · speed=${flightSpeedReadout(pace, frameSeconds, 0.1)}\n` +
      (locked
        ? "Mouse look · Esc releases"
        : inputNotice || "Click the view to fly");
    return false;
  });
  cleanup = () => {
    held.clear();
    input.abort();
    if (document.pointerLockElement === canvas) document.exitPointerLock();
    mounted.stop();
  };
  mounted.renderer.setClearColor(VIEWER_BACKGROUND, 1);
  preview.configureRenderer?.(mounted.renderer);
  if (!failed) canvas.style.visibility = "visible";

  window.addEventListener(
    "keydown",
    (event) => {
      if (event.code === "Escape") {
        held.clear();
        if (document.pointerLockElement === canvas) document.exitPointerLock();
        return;
      }
      if (
        event.defaultPrevented ||
        document.pointerLockElement !== canvas ||
        isForm(event.target)
      ) {
        held.clear();
        return;
      }
      if (event.code === "KeyQ" || event.code === "KeyE") {
        if (!event.repeat)
          speed = THREE.MathUtils.clamp(
            event.code === "KeyQ" ? speed / 1.5 : speed * 1.5,
            0.1,
            100,
          );
        event.preventDefault();
      } else if (directions.has(event.code)) {
        held.add(event.code);
        event.preventDefault();
      }
    },
    { signal: input.signal },
  );
  window.addEventListener("keyup", (event) => held.delete(event.code), {
    signal: input.signal,
  });
  window.addEventListener(
    "focusin",
    (event) => {
      held.clear();
      if (isForm(event.target) && document.pointerLockElement === canvas)
        document.exitPointerLock();
    },
    { signal: input.signal },
  );
  window.addEventListener(
    "blur",
    () => {
      held.clear();
      if (document.pointerLockElement === canvas) document.exitPointerLock();
    },
    { signal: input.signal },
  );
  document.addEventListener(
    "pointerlockchange",
    () => {
      held.clear();
      inputNotice = "";
    },
    { signal: input.signal },
  );
  const lockRefused = (error: unknown): void => {
    requestingLock = false;
    inputNotice =
      "Mouse look was not acquired. Click to retry. " +
      (error instanceof Error ? error.message : String(error));
  };
  canvas.addEventListener(
    "click",
    () => {
      if (requestingLock || document.pointerLockElement === canvas) return;
      canvas.focus();
      requestingLock = true;
      try {
        void Promise.resolve(canvas.requestPointerLock()).then(() => {
          requestingLock = false;
          if (disposed && document.pointerLockElement === canvas)
            document.exitPointerLock();
        }, lockRefused);
      } catch (error) {
        lockRefused(error);
      }
    },
    { signal: input.signal },
  );
  document.addEventListener(
    "pointerlockerror",
    () => {
      lockRefused("The browser refused pointer lock.");
    },
    { signal: input.signal },
  );
  window.addEventListener(
    "mousemove",
    (event) => {
      if (document.pointerLockElement !== canvas) return;
      adoptAuthoredPose();
      // Read the actual quaternion each time so a selected authored view cannot
      // be overwritten by yaw/pitch retained from the previous view.
      orientation.setFromQuaternion(camera.quaternion, "YXZ");
      orientation.y -= event.movementX * 0.0025;
      orientation.x = THREE.MathUtils.clamp(
        orientation.x - event.movementY * 0.0025,
        -maxPitch,
        maxPitch,
      );
      orientation.z = 0;
      camera.up.copy(worldUp);
      camera.quaternion.setFromEuler(orientation);
      followEye();
    },
    { signal: input.signal },
  );
  canvas.addEventListener(
    "wheel",
    (event) => {
      event.preventDefault();
      camera.fov = THREE.MathUtils.clamp(
        camera.fov * Math.exp(event.deltaY * 0.001),
        5,
        110,
      );
      camera.updateProjectionMatrix();
    },
    { passive: false, signal: input.signal },
  );
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}
