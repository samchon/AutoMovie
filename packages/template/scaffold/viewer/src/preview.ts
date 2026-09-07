import { mountViewer } from "@automovie/viewer";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

import { VIEWER_BACKGROUND, viewerDocument } from "./viewerDocument";

const { canvas, status } = viewerDocument();
let failed = false;
let disconnected = false;
const fail = (message: string): void => {
  failed = true;
  canvas.style.visibility = "hidden";
  status.textContent = `Source preview is unavailable.\n${message}`;
};
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
  // Dynamic import makes a missing, invalid or throwing producer visible on
  // this page. Vite tracks the literal import and all its source dependencies.
  const { createPreview } = await import("../preview");
  const preview = await createPreview();
  const { scene, camera } = preview;
  const controls = new OrbitControls(camera, canvas);
  // Share the target so production-owned view selectors can move the same eye.
  controls.target =
    preview.target ??
    camera.position.clone().add(camera.getWorldDirection(new THREE.Vector3()));
  controls.update();
  const held = new Set<string>();
  let previous = 0;
  let speed = 4;
  let width = 0;
  let height = 0;
  const mounted = mountViewer(canvas, scene, camera, (elapsed) => {
    if (failed) return true;
    const delta = Math.min(Math.max(elapsed - previous, 0), 0.1);
    previous = elapsed;
    if (canvas.clientWidth !== width || canvas.clientHeight !== height) {
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      mounted.renderer.setSize(Math.max(width, 1), Math.max(height, 1), false);
      camera.aspect = Math.max(width, 1) / Math.max(height, 1);
      camera.updateProjectionMatrix();
    }
    const forward = camera.getWorldDirection(new THREE.Vector3());
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
    const axis = (positive: string, negative: string): number =>
      Number(held.has(positive)) - Number(held.has(negative));
    const travel = new THREE.Vector3()
      .addScaledVector(forward, axis("KeyW", "KeyS"))
      .addScaledVector(right, axis("KeyD", "KeyA"))
      .addScaledVector(new THREE.Vector3(0, 1, 0), axis("Space", "KeyC"));
    const fast = held.has("ShiftLeft") || held.has("ShiftRight");
    travel.normalize().multiplyScalar(speed * delta * (fast ? 4 : 1));
    camera.position.add(travel);
    controls.target.add(travel);
    controls.update();
    preview.update?.(elapsed, camera, canvas.height);
    status.textContent =
      `Working source · x=${camera.position.x.toFixed(2)}` +
      ` y=${camera.position.y.toFixed(2)} z=${camera.position.z.toFixed(2)}` +
      ` · speed=${speed.toFixed(2)} m/s`;
    return false;
  });
  mounted.renderer.setClearColor(VIEWER_BACKGROUND, 1);
  preview.configureRenderer?.(mounted.renderer);
  window.addEventListener("keydown", (event) => {
    if (
      event.defaultPrevented ||
      (event.target instanceof Element &&
        event.target.closest(
          "input, textarea, select, button, [contenteditable]",
        ) !== null)
    ) {
      held.clear();
      return;
    }
    if (event.code === "KeyQ" || event.code === "KeyE") {
      speed = THREE.MathUtils.clamp(
        event.code === "KeyQ" ? speed / 1.5 : speed * 1.5,
        0.05,
        1000,
      );
      return;
    }
    held.add(event.code);
    if (event.code === "Space") event.preventDefault();
  });
  window.addEventListener("keyup", (event) => held.delete(event.code));
  window.addEventListener("focusin", () => held.clear());
  window.addEventListener("blur", () => held.clear());
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}
