/**
 * Free flight over one compiled shot, for looking at it from angles nobody
 * authored: `/viewer/inspect.html?shot=<id>`.
 *
 * **This is an inspection tool and not a delivery path.** The eye is wherever a
 * hand flew it, so a frame it draws belongs to no authored camera and is not
 * capture evidence. The page writes nothing : no file, no receipt : and it
 * deliberately installs no `window.__automovieCapture` hook, so the capture
 * host cannot drive it even if it is pointed here: preview and render frames
 * keep coming from `/viewer/`, composed by a shot's own camera.
 *
 * Two things a reviewer reads off this page are the flight's and not the
 * shot's. The level of detail every population shows is the one this eye's
 * distance selects, so a tier seen here is the tier this flight asked for
 * rather than the tier the authored camera would have. And the scene holds the
 * shot's opening second for as long as the page is open, because a moving eye
 * and a running clock are separate controls and this pass gives the eye.
 */
import type { IAutoMovieCompiledShotSource } from "@automovie/interface";
import { applyRendererEnvironment, mountViewer } from "@automovie/viewer";
import * as THREE from "three";

import type { IAutoMovieProductionViewerRuntime } from "../../scripts/productionRuntimeState";
import { flightSpeedReadout } from "./flightSpeedReadout";
import { createCompiledShotRuntime } from "./shotRuntime";
import { VIEWER_BACKGROUND, viewerDocument } from "./viewerDocument";

// The eye's own clip range, deliberately wider than any authored camera's: an
// inspection eye is put against a moulding one minute and outside the whole set
// the next. Opening it further costs depth precision, which reads as two
// surfaces fighting over one distant pixel and looks like a modelling defect.
const NEAR_PLANE = 0.05;
const FAR_PLANE = 2000;

// Field of view the wheel travels between. Narrower than the low end is a lens
// no hand can aim; wider than the high end is a fisheye nobody can judge a
// proportion from, which is the whole reason to open this page.
const MIN_FOV = 5;
const MAX_FOV = 110;

/** Radians of look per pixel of pointer-locked mouse travel. */
const LOOK_PER_PIXEL = 0.0025;

/** Pitch stops short of straight up, where a yaw-pitch eye rolls its horizon. */
const MAX_PITCH = THREE.MathUtils.degToRad(89);

// Flight speed in metres per second: a brisk walk to start, a factor per press,
// and a ceiling that still lets an eye stop where it meant to.
const DEFAULT_SPEED = 4;
const SPEED_STEP = 1.5;
const MIN_SPEED = 0.1;
const MAX_SPEED = 100;

/** Seconds of travel one frame may integrate; see {@link frame}. */
const MAX_FRAME_SECONDS = 0.1;

/**
 * Frames the speed line measures the eye's real pace over; see
 * {@link flightSpeedReadout}.
 *
 * The window is counted in frames rather than in seconds so that one enormous
 * interval can be dropped from a known population rather than from however many
 * happened to land in a period. Fifteen is a quarter of a second on a set that
 * draws at sixty frames a second and about five seconds on one that draws at
 * three, which is the right way round: a light scene changes pace often and a
 * heavy one holds whatever pace its geometry imposes.
 */
const FLIGHT_SAMPLE_FRAMES = 15;

/** Height is world-up, never the eye's own up. */
const WORLD_UP = new THREE.Vector3(0, 1, 0);

const { canvas, status } = viewerDocument();
const parameters = new URLSearchParams(window.location.search);
const shotId = parameters.get("shot")?.trim();
if (shotId === undefined || shotId === "")
  throw new Error(
    "No shot was selected. Open this page with ?shot=<authored-shot-id>.",
  );
const response = await fetch(
  `/__automovie/shots/${encodeURIComponent(shotId)}.json`,
);
if (response.ok === false)
  throw new Error(
    `Compiled shot "${shotId}" is unavailable (${response.status}). Run npm run compile.`,
  );
const compiled = (await response.json()) as IAutoMovieCompiledShotSource;
const productionRuntimeResponse = await fetch(
  "/__automovie/production-runtime.json",
);
if (productionRuntimeResponse.ok === false)
  throw new Error(
    `Production runtime is unavailable (${productionRuntimeResponse.status}).`,
  );
const productionRuntime =
  (await productionRuntimeResponse.json()) as IAutoMovieProductionViewerRuntime;
// The same compiled shot the shot page builds, admitting the same live soft
// bodies, so what is inspected here is what the shot draws rather than a
// lookalike assembled with different runtime choices. No delivery tone is
// passed: this page stands in for no delivery, so the scene's own environment
// owns the curve.
const runtime = await createCompiledShotRuntime(compiled, undefined, {
  dialogue: productionRuntime.dialogue,
  liveWearableSoftBodies: productionRuntime.liveWearableSoftBodies,
});
const eye = new THREE.PerspectiveCamera(
  runtime.camera.fov,
  1,
  NEAR_PLANE,
  FAR_PLANE,
);
// No capture options: the shot page pins antialiasing off and preserves the
// drawing buffer so a readback is byte-stable. Nothing reads bytes back here,
// so the eye gets the smoother picture instead. Mounting this early is what
// gives the next few statements a renderer; the loop it starts does not run
// until the next animation frame, so everything below is in place first.
const mounted = mountViewer(canvas, runtime.scene, eye, (elapsed) =>
  frame(elapsed),
);
mounted.renderer.setClearColor(VIEWER_BACKGROUND, 1);
// One draw through the shot's own camera lowers the scene to its opening
// second. `render` is what applies poses, prop articulation, object motion and
// light motion, and nothing else does, so an eye flown over an unprimed graph
// would survey actors standing in the rest pose their model was imported in.
runtime.render(mounted.renderer, 0, "beauty");
// Applied once and kept. `render` restores the renderer environment after each
// draw because a capture shares one renderer across guide passes; this page
// draws one beauty pass for as long as it is open.
applyRendererEnvironment(
  mounted.renderer,
  compiled.scene.environment,
  "beauty",
);
// The flight starts from the shot's own eye, so the first thing on screen is
// the authored frame and every departure from it is one the operator made.
runtime.camera.updateMatrixWorld(true);
eye.position.copy(runtime.camera.getWorldPosition(new THREE.Vector3()));
const opening = new THREE.Euler().setFromQuaternion(
  runtime.camera.getWorldQuaternion(new THREE.Quaternion()),
  "YXZ",
);
let yaw = opening.y;
let pitch = THREE.MathUtils.clamp(opening.x, -MAX_PITCH, MAX_PITCH);
let speed = DEFAULT_SPEED;
let lastElapsed = 0;
/** Real seconds each of the last {@link FLIGHT_SAMPLE_FRAMES} frames cost. */
const frameSeconds: number[] = [];
let viewWidth = 0;
let viewHeight = 0;

// That authored eye is the only viewpoint this page derives, on purpose. How a
// viewpoint should be derived from a declared space is still open
// (samchon/automovie#1920): a room is declared as a convex cell, and a stair
// tower standing in one corner of it leaves most of that cell facing a wall, so
// a jump-to-a-space control added here would settle a question the product has
// not settled. Until it has, the eye goes only where it is flown.

const held = new Set<string>();
/** Keys the browser would otherwise scroll the document with. */
const SCROLLING_KEYS = new Set([
  "Space",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
]);

window.addEventListener("keydown", (event) => {
  if (event.code === "KeyQ" || event.code === "KeyE") {
    // A step per press rather than a ramp while held: an operator picks a speed
    // for the room being inspected and it stays picked.
    speed = THREE.MathUtils.clamp(
      event.code === "KeyE" ? speed * SPEED_STEP : speed / SPEED_STEP,
      MIN_SPEED,
      MAX_SPEED,
    );
    return;
  }
  held.add(event.code);
  if (SCROLLING_KEYS.has(event.code)) event.preventDefault();
});
window.addEventListener("keyup", (event) => held.delete(event.code));
// A key let go while the page is not focused never reports its release, and the
// eye would go on travelling that way forever.
window.addEventListener("blur", () => held.clear());
canvas.addEventListener("click", () => void canvas.requestPointerLock());
window.addEventListener("mousemove", (event) => {
  if (document.pointerLockElement !== canvas) return;
  yaw -= event.movementX * LOOK_PER_PIXEL;
  pitch = THREE.MathUtils.clamp(
    pitch - event.movementY * LOOK_PER_PIXEL,
    -MAX_PITCH,
    MAX_PITCH,
  );
});
canvas.addEventListener(
  "wheel",
  (event) => {
    event.preventDefault();
    // The wheel narrows the lens instead of dollying the eye. Dollying toward a
    // surface to read it walks the eye through the wall, and what gets inspected
    // is the far side of the room.
    eye.fov = THREE.MathUtils.clamp(
      eye.fov * Math.exp(event.deltaY * 0.001),
      MIN_FOV,
      MAX_FOV,
    );
    eye.updateProjectionMatrix();
  },
  // The page owns the wheel, so the listener must be able to refuse the scroll.
  { passive: false },
);

/** One held direction pair as -1, 0, or 1. */
function axis(
  positive: readonly string[],
  negative: readonly string[],
): number {
  return (
    (positive.some((code) => held.has(code)) ? 1 : 0) -
    (negative.some((code) => held.has(code)) ? 1 : 0)
  );
}

/** Degrees in (-180, 180], so a heading reads the same after ten turns. */
function heading(radians: number): number {
  return (
    THREE.MathUtils.euclideanModulo(
      THREE.MathUtils.radToDeg(radians) + 180,
      360,
    ) - 180
  );
}

function frame(elapsed: number): boolean {
  // Clamped because a backgrounded tab comes back with one enormous delta,
  // which would fling the eye across the set before it drew again. What the
  // clamp costs is charged to the readout rather than absorbed silently:
  // `flightSpeedReadout` receives the same budget and the same frames, so the
  // speed it prints is the speed this line integrates.
  const real = Math.max(elapsed - lastElapsed, 0);
  const delta = Math.min(real, MAX_FRAME_SECONDS);
  lastElapsed = elapsed;
  if (frameSeconds.push(real) > FLIGHT_SAMPLE_FRAMES) frameSeconds.shift();
  // The canvas is sized once when the viewer is mounted, which is enough for a
  // capture at a fixed viewport and not for a page somebody keeps open while
  // dragging the window. Following the element here keeps the picture
  // unstretched and keeps the height the populations resolve against the height
  // actually being drawn.
  const width = canvas.clientWidth || 1;
  const height = canvas.clientHeight || 1;
  if (width !== viewWidth || height !== viewHeight) {
    viewWidth = width;
    viewHeight = height;
    mounted.renderer.setSize(width, height, false);
    eye.aspect = width / height;
    eye.updateProjectionMatrix();
  }
  eye.quaternion.setFromEuler(new THREE.Euler(pitch, yaw, 0, "YXZ"));
  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(eye.quaternion);
  const right = new THREE.Vector3(1, 0, 0).applyQuaternion(eye.quaternion);
  const travel = new THREE.Vector3()
    .addScaledVector(forward, axis(["KeyW", "ArrowUp"], ["KeyS", "ArrowDown"]))
    .addScaledVector(right, axis(["KeyD", "ArrowRight"], ["KeyA", "ArrowLeft"]))
    // Rising is world-up rather than the eye's own up, so an eye looking down at
    // a floor still climbs off it instead of backing away from it.
    .addScaledVector(WORLD_UP, axis(["Space"], ["KeyC"]));
  if (travel.lengthSq() !== 0)
    eye.position.addScaledVector(travel.normalize(), speed * delta);
  // The scene is not renderable until the populations have been told where the
  // eye is: each instance set and formation builds its levels of detail hidden
  // and reveals one only here. A frame drawn without this call keeps the
  // ordinary meshes and silently drops every instanced population, which reads
  // as a roof laid only at its edges rather than as a missing call.
  runtime.resolveForCamera(eye, canvas.height);
  mounted.renderer.render(runtime.scene, eye);
  // Coordinates so whoever finds something strange can say where it is, and the
  // lens beside them because a proportion means nothing without it.
  status.textContent =
    `${runtime.id} inspection` +
    `  x=${eye.position.x.toFixed(2)} y=${eye.position.y.toFixed(2)}` +
    ` z=${eye.position.z.toFixed(2)}` +
    `  yaw=${heading(yaw).toFixed(1)}°` +
    ` pitch=${THREE.MathUtils.radToDeg(pitch).toFixed(1)}°` +
    `  fov=${eye.fov.toFixed(1)}°` +
    `  speed=${flightSpeedReadout(speed, frameSeconds, MAX_FRAME_SECONDS)}`;
  return true;
}
