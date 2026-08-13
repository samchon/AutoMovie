/**
 * The host instrument behind the `inspectSubject` MCP tool:
 * `/viewer/inspection.html?shot=<id>&subject=<id>&revision=<digest>`.
 *
 * `subject.html` is the same look with a person at the keyboard; this page is
 * the same look with nobody there. The split is deliberate and it is the whole
 * design decision of this file. `subject.html` states, in its own notice and in
 * its own documentation, that it writes nothing and installs no capture hook,
 * so the capture host cannot drive it even when pointed at it. Bolting a
 * drawing hook onto that page to serve the tool would retract that promise for
 * every generated project, and it would put an instrument that answers a
 * machine on the page whose refusals are written for a reader. So the promise
 * stands and the machine gets its own entry point.
 *
 * What that costs is one page of duplication and what it buys is two separable
 * disciplines. This page installs `window.__automovieInspect`, never
 * `window.__automovieCapture`: the delivery capture host looks for the second
 * name and finds nothing here, so an inspection page can never be mistaken for
 * a page that produces a delivered frame, and the two hooks cannot be wired to
 * each other by accident.
 *
 * **Nothing here is delivery evidence.** The eye is one the inspection chose
 * from the subject's own content extent rather than one the film composed, the
 * frame carries no renderer identity, no target fingerprint and no render
 * bundle, and the page writes no file at all: it hands the bytes back over the
 * page hook and the MCP surface publishes them outside the render root.
 */
import {
  type IAutoMovieSectionPlane,
  describeAutoMovieSubject,
} from "@automovie/engine";
import type {
  IAutoMovieCompiledShotSource,
  IAutoMovieSubjectDescription,
} from "@automovie/interface";
import {
  type IAutoMovieViewerSubjectBounds,
  applyAutoMovieSectionPlanes,
  applyRendererEnvironment,
  captureAutoMovieViewerSubjectView,
  mountViewer,
  parseAutoMovieViewerSubjectKey,
} from "@automovie/viewer";
import * as THREE from "three";

import type { IAutoMovieProductionViewerRuntime } from "../../scripts/productionRuntimeState";
import { createCompiledShotRuntime } from "./shotRuntime";
import { viewerDocument } from "./viewerDocument";

/**
 * One camera state the inspection asks this page to draw through.
 *
 * It mirrors `IAutoMovieSubjectInspectionPose` in `@automovie/mcp` field for
 * field. The page derives no part of it: the tool owns the viewpoint plan and
 * the projection, and a page that recomputed either would be a second opinion
 * about where the eye was, which is exactly what a shared subject id exists to
 * make impossible.
 */
export interface IAutoMovieInspectionPose {
  /** Basis both {@link position} and {@link target} are stated in. */
  coordinateSpace: "model" | "world";
  /** Eye position in metres. */
  position: { x: number; y: number; z: number };
  /** Point the eye looks at, in metres. */
  target: { x: number; y: number; z: number };
  /** Vertical field of view in degrees. */
  fovDeg: number;
  /** Viewport width divided by height. */
  aspect: number;
  /** Near clip distance in metres. */
  near: number;
  /** Far clip distance in metres. */
  far: number;
}

/** One drawn observation, as the page hands it back to the host adapter. */
export interface IAutoMovieInspectionImage {
  /** `data:image/png;base64,...` read straight off the canvas. */
  dataUrl: string;
  /** Canvas pixel width the frame was actually drawn at. */
  width: number;
  /** Canvas pixel height the frame was actually drawn at. */
  height: number;
}

/**
 * The one entry point the host adapter drives.
 *
 * Deliberately not `window.__automovieCapture`. That name belongs to pages
 * that draw a shot through its own camera for delivery, and keeping the two
 * apart is what stops an inspection frame from ever travelling a delivery path.
 */
export interface IAutoMovieInspectionHook {
  /** True once the compiled shot is staged and the subject resolved. */
  ready: boolean;
  /** Draw one pose and read the canvas back. */
  view: (
    pose: IAutoMovieInspectionPose,
    viewpoint: string,
  ) => IAutoMovieInspectionImage;
}

declare global {
  interface Window {
    __automovieInspect?: IAutoMovieInspectionHook;
  }
}

const { canvas, status } = viewerDocument();
const parameters = new URLSearchParams(window.location.search);
const shotId = parameters.get("shot") ?? "opening";
const requestedSubject = parameters.get("subject");
if (requestedSubject === null)
  throw new Error(
    "The inspection host requires ?subject=<id>; it opens exactly one named subject.",
  );
// The revision the MCP surface digested from the compiled bytes it read. The
// page states it rather than recomputing one, so an observation can never be
// labelled with a state the tool did not resolve the subject against.
const requestedRevision = parameters.get("revision");
if (requestedRevision === null)
  throw new Error(
    "The inspection host requires ?revision=<digest> from the surface that read the compiled shot.",
  );

const response = await fetch(
  `/__automovie/shots/${encodeURIComponent(shotId)}.json`,
);
if (response.ok === false)
  throw new Error(
    `Compiled shot "${shotId}" is unavailable (${response.status}). Run npm run compile.`,
  );
const compiled = (await response.json()) as IAutoMovieCompiledShotSource;
const artifact = { revision: requestedRevision, compiled };

/**
 * The compiled subject ids one requested name could be spelled as, in order.
 *
 * This is the same absorption the MCP surface performs, in the same order and
 * for the same one divergence: a placed or reusable part is `part:<node>/<part>`
 * to the viewer and `element-part:`/`prototype-part:` to the compiler. First
 * match wins here because first match wins there, and the pose this page is
 * handed was derived from whichever description the surface picked. Choosing
 * differently would aim the surface's eye at a different thing under the
 * surface's own viewpoint id.
 */
const compiledSubjectSpellings = (subject: string): string[] => {
  const revisionAt = subject.lastIndexOf("@");
  const bare = revisionAt === -1 ? subject : subject.slice(0, revisionAt);
  return bare.startsWith("part:")
    ? [
        `element-part:${bare.slice("part:".length)}`,
        `prototype-part:${bare.slice("part:".length)}`,
      ]
    : [bare];
};

/** The viewer key spelling of one compiled subject id. */
const viewerKeyOf = (compiledId: string): string =>
  compiledId.replace(/^(?:element|prototype)-part:/, "part:");

const resolve = (): IAutoMovieSubjectDescription => {
  const refusals: string[] = [];
  for (const candidate of compiledSubjectSpellings(requestedSubject))
    try {
      return describeAutoMovieSubject(artifact, candidate);
    } catch (error) {
      refusals.push(error instanceof Error ? error.message : `${error}`);
    }
  throw new Error(
    `"${requestedSubject}" names nothing in shot "${shotId}": ${refusals.join(" ")}`,
  );
};

const description = resolve();
const bounds = description.bounds.content ?? description.bounds.declared;
if (bounds === null)
  throw new Error(
    `${description.id} has neither a content nor a declared extent, so there is nothing to aim at.`,
  );
if (description.bounds.coordinateSpace !== "world")
  throw new Error(
    `${description.id} is measured in ${description.bounds.coordinateSpace} space and stands nowhere in shot ` +
      `"${shotId}", so a world eye aimed at it would photograph whatever happens to occupy the origin. ` +
      "Inspect a placement of it instead.",
  );

// Resolved before anything is decoded. A subject whose compiled id the viewer
// key grammar cannot spell is refused for the price of a message rather than
// after a whole scene's worth of textures has been built to draw it.
const subject = parseAutoMovieViewerSubjectKey(viewerKeyOf(description.id));

const productionRuntimeResponse = await fetch(
  "/__automovie/production-runtime.json",
);
if (productionRuntimeResponse.ok === false)
  throw new Error(
    `Production runtime is unavailable (${productionRuntimeResponse.status}).`,
  );
const productionRuntime =
  (await productionRuntimeResponse.json()) as IAutoMovieProductionViewerRuntime;
// The same compiled shot the shot page and the hand-driven subject page build,
// with the same runtime choices, so what an agent is shown is what the film
// draws rather than a lookalike. No delivery tone is passed: this page stands
// in for no delivery, so the scene's own environment owns the curve.
const runtime = await createCompiledShotRuntime(compiled, undefined, {
  dialogue: productionRuntime.dialogue,
  liveWearableSoftBodies: productionRuntime.liveWearableSoftBodies,
});
const eye = new THREE.PerspectiveCamera(35, 1, 0.1, 1000);
// Capture options, for the same reason the shot capture page pins them: the
// frame is read back off the canvas, so the drawing buffer has to survive the
// draw and the raster must not follow the host's device pixel ratio.
// Antialiasing is off so two machines drawing one subject agree edge for edge.
const mounted = mountViewer(canvas, runtime.scene, eye, () => true, {
  antialias: false,
  pixelRatio: 1,
  preserveDrawingBuffer: true,
});
mounted.renderer.setClearColor(0x11151b, 1);
// One draw through the shot's own camera lowers the scene to its opening
// second. `render` is what applies poses, prop articulation, object motion and
// light motion, and nothing else does, so a subject drawn before this would be
// judged in the rest pose its model was imported in.
runtime.render(mounted.renderer, 0, "beauty");
// Applied once and kept: `render` restores the renderer environment after each
// draw because a capture shares one renderer across guide passes, and this page
// draws one beauty pass for as long as it is open.
applyRendererEnvironment(
  mounted.renderer,
  compiled.scene.environment,
  "beauty",
);

/**
 * A cut at the subject's own bounding sphere that removes the half-space the
 * eye is in.
 *
 * Without it a room is a room behind its own outer wall, and an interior
 * subject is reachable and still unreadable. The hand-driven page puts this on
 * `X` because a person can press it; nobody can press anything here, so the cut
 * is unconditional. It costs nothing on an exterior subject: the plane sits one
 * half-diagonal from the centre along the eye direction, which is at or outside
 * every corner of the subject's own box, so it can only remove what stands
 * between the eye and the subject and never the subject itself.
 *
 * It mirrors `sectionAt` in `subject.ts` expression for expression, because two
 * instruments looking at one subject must cut it in one place.
 */
const sectionAt = (
  position: { x: number; y: number; z: number },
  box: IAutoMovieViewerSubjectBounds,
): IAutoMovieSectionPlane => {
  const middle = {
    x: (box.min.x + box.max.x) / 2,
    y: (box.min.y + box.max.y) / 2,
    z: (box.min.z + box.max.z) / 2,
  };
  const away = new THREE.Vector3(
    position.x - middle.x,
    position.y - middle.y,
    position.z - middle.z,
  ).normalize();
  const radius = Math.max(
    Math.hypot(
      box.max.x - box.min.x,
      box.max.y - box.min.y,
      box.max.z - box.min.z,
    ) / 2,
    0.5,
  );
  return {
    point: {
      x: middle.x + away.x * radius,
      y: middle.y + away.y * radius,
      z: middle.z + away.z * radius,
    },
    normal: { x: away.x, y: away.y, z: away.z },
  };
};

window.__automovieInspect = {
  ready: true,
  view: (pose, viewpoint) => {
    if (pose.coordinateSpace !== "world")
      throw new Error(
        `Viewpoint "${viewpoint}" states a ${pose.coordinateSpace}-space eye, and this page stages a world scene.`,
      );
    // The raster follows the element, and the host fixes the element by fixing
    // the browser viewport. Nothing is corrected to the requested size here on
    // purpose: the surface compares what it asked for against what came back
    // and refuses a mismatch, and a page that quietly rescaled would answer
    // that check with a picture of the wrong raster instead.
    mounted.renderer.setSize(
      canvas.clientWidth || 1,
      canvas.clientHeight || 1,
      false,
    );
    // The cut rides the eye, so it is rewritten for every viewpoint.
    applyAutoMovieSectionPlanes({
      renderer: mounted.renderer,
      root: runtime.scene,
      planes: [sectionAt(pose.position, bounds)],
    });
    const drawn = captureAutoMovieViewerSubjectView({
      subject,
      viewpoint,
      pose: {
        position: pose.position,
        target: pose.target,
        lens: { fovDeg: pose.fovDeg, aspect: pose.aspect },
        near: pose.near,
        far: pose.far,
      },
      scene: runtime.scene,
      camera: eye,
      renderer: mounted.renderer,
      // Every compact population builds its levels of detail hidden and reveals
      // one only here. A frame drawn without this keeps the ordinary meshes and
      // silently drops every instanced population, which reads as a roof laid
      // only at its edges rather than as a missing call.
      resolveForCamera: (camera, viewportHeight) =>
        runtime.resolveForCamera(camera, viewportHeight),
    });
    status.textContent =
      `${description.id} @${requestedRevision}\n` +
      `viewpoint ${viewpoint}  ${drawn.image.width}x${drawn.image.height}`;
    return {
      dataUrl: drawn.image.dataUrl,
      width: drawn.image.width,
      height: drawn.image.height,
    };
  },
};

status.textContent =
  `${description.id} @${requestedRevision}\n` +
  `${description.kind} · ${description.semanticKind}  awaiting viewpoints`;
