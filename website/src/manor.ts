// The manor showcase page: build the textured manor in the browser, then let
// the visitor fly through it or jump between its authored views.
//
// The flight model is the one every generated project's source preview uses,
// yaw/pitch mouse look with world-up height and a lens zoom, so a view seen
// here is the view its author framed. The page adds the featured shortlist, a
// `?view=` deep link, and a loading card; it owns no scene, light, or camera.
import { mountViewer } from "@automovie/viewer";
import {
  type IManorScene,
  createTexturedManorScene,
} from "medieval-baron-manor/src/instances/manor-textured.js";
import { flightSpeedReadout } from "medieval-baron-manor/viewer/src/flightSpeedReadout";
import { mountPreviewNavigation } from "medieval-baron-manor/viewer/src/previewNavigation";
import * as THREE from "three";

import { bakeManor } from "./bakeManor";

const VIEW_PARAMETER = "view";

/** Authored view ids worth one click, in the order the panel lists them. */
const FEATURED: readonly { id: string; label: string }[] = [
  { id: "01-whole-south-east", label: "Whole manor" },
  { id: "reference-exterior", label: "Exterior" },
  { id: "reference-courtyard", label: "Courtyard" },
  { id: "garden-south", label: "Garden" },
  { id: "hall--corner-b", label: "Great hall" },
  { id: "kitchen--corner-b", label: "Kitchen" },
  { id: "entrance--corner-a", label: "Entrance" },
  { id: "master--corner-a", label: "Master chamber" },
  { id: "stair-turn", label: "Stair" },
  { id: "corridor-west-to-east", label: "Upper corridor" },
  { id: "ground-plan", label: "Ground plan" },
  { id: "upper-plan", label: "Upper plan" },
  { id: "frame-axonometric", label: "Timber frame" },
  { id: "roof-overhead", label: "Roof" },
];

const element = <T extends Element>(selector: string): T => {
  const found = document.querySelector<T>(selector);
  if (found === null)
    throw new Error(`The manor page is missing its ${selector} element.`);
  return found;
};

const canvas = element<HTMLCanvasElement>("#view");
const status = element<HTMLDivElement>("#status");
const loading = element<HTMLDivElement>("#loading");
const phase = element<HTMLDivElement>("#phase");
const featured = element<HTMLDivElement>("#featured");
const panel = element<HTMLElement>("#panel");
const sceneReadout = element<HTMLDivElement>("#scene");
const panelToggle = element<HTMLButtonElement>("#panel-toggle");

// A phone screen cannot hold the scene and the whole panel; it opens folded.
const setPanelCollapsed = (collapsed: boolean): void => {
  panel.classList.toggle("collapsed", collapsed);
  panelToggle.textContent = collapsed ? "Show" : "Hide";
  panelToggle.setAttribute("aria-expanded", String(!collapsed));
};
setPanelCollapsed(window.matchMedia("(max-width: 720px)").matches);
panelToggle.addEventListener("click", () =>
  setPanelCollapsed(!panel.classList.contains("collapsed")),
);

const fail = (error: unknown): void => {
  loading.hidden = false;
  loading.classList.add("failed");
  phase.textContent =
    "The manor could not be built.\n" +
    (error instanceof Error ? error.message : String(error));
};

/** Let the browser paint the phase message before synchronous geometry work. */
const paint = (): Promise<void> =>
  new Promise((resolve) => {
    requestAnimationFrame(() => setTimeout(resolve, 0));
  });

const requestedView = (): string | null =>
  new URLSearchParams(window.location.search).get(VIEW_PARAMETER);

const rememberView = (id: string): void => {
  const url = new URL(window.location.href);
  url.searchParams.set(VIEW_PARAMETER, id);
  window.history.replaceState(null, "", url);
};

/** Mount the view shortlist and the searchable list of every authored view. */
const mountViews = (
  manor: IManorScene,
  select: (id: string) => void,
): { removeNavigation: () => void; highlight: (id: string) => void } => {
  const indices = new Map(manor.views.map((view, index) => [view.id, index]));
  const buttons = new Map<string, HTMLButtonElement>();
  for (const item of FEATURED) {
    if (!indices.has(item.id)) continue;
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = item.label;
    button.addEventListener("click", () => select(item.id));
    buttons.set(item.id, button);
    featured.append(button);
  }
  const roomNames = new Map(
    manor.manifest.rooms.map((room) => [room.id, room.label]),
  );
  const removeNavigation = mountPreviewNavigation({
    items: manor.views.map((view) => ({
      id: view.id,
      label: view.id,
      group: roomNames.get(view.room ?? "") ?? view.object ?? "Views",
      keywords: [view.room ?? "", view.object ?? ""],
    })),
    apply: select,
  });
  // The navigator appends itself to the body; the showcase keeps one panel.
  panel.insertBefore(element("#preview-navigation"), element("#keys"));
  return {
    removeNavigation,
    highlight: (id) => {
      for (const [viewId, button] of buttons)
        button.setAttribute("aria-current", String(viewId === id));
    },
  };
};

const main = async (): Promise<void> => {
  const report = async (message: string): Promise<void> => {
    phase.textContent = message;
    await paint();
  };
  const manor = await createTexturedManorScene({ report });
  await report("Merging draw batches");
  const baked = bakeManor(manor.objects);
  const { scene, camera } = manor;
  const indices = new Map(manor.views.map((view, index) => [view.id, index]));
  const select = (id: string): void => {
    const index = indices.get(id);
    if (index === undefined) throw new Error(`Unknown manor view: ${id}`);
    manor.applyView(index);
    manor.target.copy(manor.inspection.target.position);
    rememberView(id);
    views.highlight(id);
  };
  const views = mountViews(manor, select);
  const initial = requestedView();
  select(
    initial !== null && indices.has(initial) ? initial : manor.views[0]!.id,
  );

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
  const maxPitch = THREE.MathUtils.degToRad(89);
  const orientation = new THREE.Euler(0, 0, 0, "YXZ");
  const forward = new THREE.Vector3();
  const right = new THREE.Vector3();
  const worldUp = new THREE.Vector3(0, 1, 0);
  const travel = new THREE.Vector3();
  camera.lookAt(manor.target);
  let aimDistance = Math.max(manor.target.distanceTo(camera.position), 0.001);
  const lastTarget = manor.target.clone();
  const lastPosition = camera.position.clone();
  const lastQuaternion = camera.quaternion.clone();
  const rememberPose = (): void => {
    lastPosition.copy(camera.position);
    lastQuaternion.copy(camera.quaternion);
    lastTarget.copy(manor.target);
  };
  // A selected authored view moves the camera outside this loop; adopt it
  // rather than overwrite it with the yaw and pitch of the previous view.
  const adoptAuthoredPose = (): void => {
    const targetChanged = !manor.target.equals(lastTarget);
    if (
      !targetChanged &&
      camera.position.equals(lastPosition) &&
      camera.quaternion.equals(lastQuaternion)
    )
      return;
    held.clear();
    if (targetChanged) camera.lookAt(manor.target);
    aimDistance = Math.max(manor.target.distanceTo(camera.position), 0.001);
    rememberPose();
  };
  // The inspection light follows this eye through its target; it is never an
  // orbit pivot.
  const followEye = (): void => {
    manor.target
      .copy(camera.position)
      .addScaledVector(camera.getWorldDirection(forward), aimDistance);
    rememberPose();
  };
  const look = (movementX: number, movementY: number): void => {
    adoptAuthoredPose();
    orientation.setFromQuaternion(camera.quaternion, "YXZ");
    orientation.y -= movementX * 0.0025;
    orientation.x = THREE.MathUtils.clamp(
      orientation.x - movementY * 0.0025,
      -maxPitch,
      maxPitch,
    );
    orientation.z = 0;
    camera.up.copy(worldUp);
    camera.quaternion.setFromEuler(orientation);
    followEye();
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
  const mounted = mountViewer(
    canvas,
    scene,
    camera,
    (elapsed) => {
      const real = Math.max(elapsed - previous, 0);
      const delta = Math.min(real, 0.1);
      previous = elapsed;
      if (frameSeconds.push(real) > 15) frameSeconds.shift();
      if (canvas.clientWidth !== width || canvas.clientHeight !== height) {
        width = canvas.clientWidth;
        height = canvas.clientHeight;
        mounted.renderer.setSize(
          Math.max(width, 1),
          Math.max(height, 1),
          false,
        );
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
      // The baked meshes replaced the instance sets, so only the light follows.
      manor.followLighting();
      orientation.setFromQuaternion(camera.quaternion, "YXZ");
      status.textContent =
        `x=${camera.position.x.toFixed(2)}` +
        ` y=${camera.position.y.toFixed(2)} z=${camera.position.z.toFixed(2)}` +
        ` · yaw=${THREE.MathUtils.radToDeg(orientation.y).toFixed(1)}°` +
        ` pitch=${THREE.MathUtils.radToDeg(orientation.x).toFixed(1)}°` +
        ` · fov=${camera.fov.toFixed(1)}°` +
        ` · speed=${flightSpeedReadout(pace, frameSeconds, 0.1)}\n` +
        (locked
          ? "Mouse look · Esc releases"
          : inputNotice || "Click the view to fly");
      return false;
    },
    { pixelRatio: Math.min(window.devicePixelRatio, 1.5) },
  );
  mounted.renderer.setClearColor(0x1c1a18, 1);
  manor.configureRenderer(mounted.renderer);
  const count = new Intl.NumberFormat("en-US");
  sceneReadout.textContent =
    `${count.format(manor.instanceState.prototypes)} shared prototypes placed ` +
    `${count.format(manor.instanceState.drawnInstances)} times · ` +
    `${count.format(baked.before)} authored meshes drawn as ` +
    `${count.format(baked.after)} · ` +
    `${count.format(manor.views.length)} authored views`;
  loading.hidden = true;
  canvas.focus();

  const stop = (): void => {
    held.clear();
    input.abort();
    views.removeNavigation();
    if (document.pointerLockElement === canvas) document.exitPointerLock();
    mounted.stop();
    void manor.disposeTextures();
  };
  window.addEventListener("pagehide", stop, { once: true });

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
    (event) => {
      // A touch has no pointer to lock; its drag already looks around.
      if ((event as Partial<PointerEvent>).pointerType === "touch") return;
      if (requestingLock || document.pointerLockElement === canvas) return;
      canvas.focus();
      requestingLock = true;
      try {
        void Promise.resolve(canvas.requestPointerLock())
          .then(() => {
            requestingLock = false;
          })
          .catch(lockRefused);
      } catch (error) {
        lockRefused(error);
      }
    },
    { signal: input.signal },
  );
  document.addEventListener(
    "pointerlockerror",
    () => lockRefused("The browser refused pointer lock."),
    { signal: input.signal },
  );
  window.addEventListener(
    "mousemove",
    (event) => {
      if (document.pointerLockElement === canvas)
        look(event.movementX, event.movementY);
    },
    { signal: input.signal },
  );
  // One finger drags the view on a touch screen, where pointer lock and the
  // keyboard flight do not exist.
  let touch: { id: number; x: number; y: number } | null = null;
  canvas.addEventListener(
    "pointerdown",
    (event) => {
      if (event.pointerType !== "touch" || touch !== null) return;
      touch = { id: event.pointerId, x: event.clientX, y: event.clientY };
    },
    { signal: input.signal },
  );
  canvas.addEventListener(
    "pointermove",
    (event) => {
      if (touch === null || event.pointerId !== touch.id) return;
      look((event.clientX - touch.x) * 2, (event.clientY - touch.y) * 2);
      touch = { id: touch.id, x: event.clientX, y: event.clientY };
    },
    { signal: input.signal },
  );
  for (const type of ["pointerup", "pointercancel"] as const)
    canvas.addEventListener(
      type,
      (event) => {
        if (touch !== null && event.pointerId === touch.id) touch = null;
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
};

main().catch(fail);
