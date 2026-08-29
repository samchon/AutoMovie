import Module from "node:module";
import path from "node:path";

interface ITransform {
  set: (...values: number[]) => void;
}

interface IHostGlobals {
  __afPass: (pass: string) => void;
  __afSeek: (seconds: number) => void;
  __afSeekSequenceFrame: (frame: unknown) => void;
  __afSeekSequenceShot: (frame: unknown) => void;
  __automovie: { ready?: boolean };
  __mountCallback: (seconds: number) => void;
  __renderer: { render: () => void };
  __scenario: string;
  document: { querySelector: () => Record<string, never> };
  location: { search: string };
  window: typeof globalThis;
}

interface IPerformanceProps {
  skeleton: (node: string) => unknown;
}

export type PlaygroundFilmScenario =
  | "block-fail"
  | "cut-fail"
  | "perform-fail"
  | "rig-fail"
  | "stage-fail"
  | "success";

const ROOT = path.resolve(__dirname, "../../..");
const host = globalThis as unknown as IHostGlobals;
host.__scenario = "";
host.location = { search: "" };
host.document = { querySelector: () => ({}) };
host.window = globalThis;
host.__renderer = { render: () => undefined };

const register = (request: string, exports: Record<string, unknown>): void => {
  const filename = require.resolve(request, { paths: [ROOT] });
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.loaded = true;
  loaded.exports = exports;
  require.cache[filename] = loaded;
};

const transform = () => ({
  translation: { x: 0, y: 0, z: 0 },
  rotation: { x: 0, y: 0, z: 0, w: 1 },
  scale: { x: 1, y: 1, z: 1 },
});

let performed = 0;
register("@automovie/archetypes", { HUMANOID_GAITS: { walk: {} } });
register("@automovie/engine", {
  DEFAULT_HUMANOID_ROM: {},
  HUMANOID_JOINT_AXES: {},
  aimRotation: () => ({ x: 0, y: 0, z: 0, w: 1 }),
  stageScene: () => {
    if (host.__scenario === "stage-fail") return { success: false };
    const nodes = [
      { id: "walker", model: "stickman", transform: transform() },
      { id: "waiter", model: "stickman", transform: transform() },
      { id: "floor-slab", model: "block", transform: transform() },
    ];
    if (host.__scenario === "rig-fail")
      nodes.push({ id: "ghost", model: "stickman", transform: transform() });
    return {
      success: true,
      scene: {
        nodes,
        space: {},
        fog: null,
        cameras: [
          {
            fovY: 40,
            near: 0.1,
            far: 1000,
            transform: transform(),
            depthPrecision: {},
          },
        ],
        lights: [{}],
      },
    };
  },
  makeActorSynthesizer: () => () => ({}),
  blockBeat: () =>
    host.__scenario === "block-fail"
      ? { success: false, violations: ["blocked"] }
      : { success: true, blocking: {} },
  performShot: (props: IPerformanceProps) => {
    if (host.__scenario === "perform-fail")
      return { success: false, violations: ["performed"] };
    const index = performed++;
    const node = index === 0 ? "walker" : "waiter";
    props.skeleton(node);
    return {
      success: true,
      shot: {
        id: `shot${index}`,
        performances: [{ node }],
        objectMotions: { "floor-slab": {} },
        cameraMotion: index === 0 ? null : {},
      },
      motions: { [node]: {} },
    };
  },
  cutSequence: () =>
    host.__scenario === "cut-fail"
      ? { success: false }
      : { success: true, runtime: 5.5, sequence: { id: "sequence" } },
  resolveSequencePlayback: (
    _sequence: unknown,
    _shots: unknown,
    seconds: number,
  ) => {
    if (seconds < 0) return null;
    if (seconds < 1) return { shot: "shot0", time: seconds, blend: null };
    return {
      shot: "shot1",
      time: seconds,
      blend: { shot: "shot0", time: seconds - 1, alpha: 0.5 },
    };
  },
});
register("@automovie/interface", {});
register("@automovie/render", {});
register("@automovie/viewer", {
  AutoMoviePlayer: class {
    public update(): void {}
  },
  applyCaptureCanvasSize: () => undefined,
  applyObjectMotion: (
    _motion: unknown,
    _time: number,
    resolve: (node: string) => unknown,
  ) => resolve("floor-slab"),
  applyObjectMotions: (
    _motions: unknown,
    _time: number,
    resolve: (node: string) => unknown,
  ) => resolve("floor-slab"),
  applyPose: () => undefined,
  applyRenderMode: () => ({ restore: () => undefined }),
  applySceneFog: () => undefined,
  assertAutoMovieViewerCameraDepthPrecision: () => ({ valid: true }),
  buildLight: () => ({}),
  buildModel: () => ({ object: {} }),
  buildSpaceObject: () => ({}),
  mountViewer: (
    _canvas: unknown,
    _scene: unknown,
    _camera: unknown,
    callback: (seconds: number) => void,
  ) => {
    host.__mountCallback = callback;
    return { renderer: host.__renderer };
  },
  renderCrossDissolve: (
    renderer: { render: () => void },
    _scene: unknown,
    _camera: unknown,
    outgoing: () => void,
    incoming: () => void,
    _alpha: number,
    withPass?: (render: () => void) => void,
  ) => {
    const render = (): void => {
      outgoing();
      renderer.render();
      incoming();
      renderer.render();
    };
    if (withPass === undefined) render();
    else withPass(render);
  },
});

class Transform implements ITransform {
  public set(..._values: number[]): void {}
}

class Group {
  public readonly position = new Transform();
  public readonly quaternion = new Transform();
  public readonly scale = new Transform();
  public add(): void {}
}

register("three", {
  Scene: class {
    public add(): void {}
  },
  Color: class {},
  HemisphereLight: class {},
  Group,
  PerspectiveCamera: class extends Group {
    public fov = 0;
    public updateProjectionMatrix(): void {}
  },
});
const FILM = path.join(ROOT, "packages", "playground", "src", "film-view.ts");

const loadFilm = (
  scenario: PlaygroundFilmScenario,
  search: string,
): Error | null => {
  host.__scenario = scenario;
  host.location = { search };
  host.__automovie = {};
  performed = 0;
  try {
    require(FILM);
    return null;
  } catch (error) {
    return error instanceof Error ? error : new Error(String(error));
  }
};

const REFUSAL_MESSAGES: Readonly<
  Record<Exclude<PlaygroundFilmScenario, "success">, string>
> = {
  "block-fail": "blocking failed",
  "cut-fail": "cut failed",
  "perform-fail": "perform failed",
  "rig-fail": 'node "ghost" has no rig',
  "stage-fail": "staging failed",
};

/** Runs one film boundary in a fresh process owned by the calling scenario. */
export const runPlaygroundFilmHost = (
  scenario: PlaygroundFilmScenario,
  search: string,
): void => {
  const error = loadFilm(scenario, search);
  if (scenario !== "success") {
    const message = REFUSAL_MESSAGES[scenario];
    if (error === null || error.message.includes(message) === false)
      throw new Error(
        `${scenario} did not refuse with '${message}': ${error?.message ?? "no error"}`,
      );
    return;
  }
  if (error !== null) throw error;
  host.__afPass("depth");
  host.__afPass("normal");
  host.__mountCallback(0.25);
  host.__afSeek(-1);
  host.__afSeek(0.25);
  host.__afPass("mask");
  host.__afSeek(2);
  host.__afPass("outline");
  host.__afSeekSequenceFrame({
    shot: "shot0",
    shotTimeSeconds: 0.5,
    blend: null,
  });
  host.__afSeekSequenceFrame({
    shot: "shot1",
    shotTimeSeconds: 2,
    blend: { shot: "shot0", shotTimeSeconds: 1, alpha: 0.5 },
  });
  host.__afSeekSequenceShot({ shot: "shot0", shotTimeSeconds: 0.5 });
  let refused = false;
  try {
    host.__afSeekSequenceShot({ shot: "missing", shotTimeSeconds: 0 });
  } catch {
    refused = true;
  }
  if (refused === false || host.__automovie.ready !== true)
    throw new Error(`success scenario '${search}' did not reach every probe`);
};
