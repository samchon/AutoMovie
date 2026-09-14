import {
  type IAutoMovieHumanFaceDocument,
  resolveHumanFaceDocument,
} from "@automovie/human";
import { mountHumanFacePanel } from "@automovie/playground/src/human/panel";
import { JSDOM } from "jsdom";

import { humanFaceFixture } from "./humanFaceFixture";

/** In-memory DOM and numerical preview ports; no renderer, files, child process or network is started. */
export function createHumanPanelFixture(
  props: {
    face?: IAutoMovieHumanFaceDocument;
    read?: () => Promise<string>;
    build?: (
      document: IAutoMovieHumanFaceDocument,
    ) => Promise<ReturnType<typeof humanPanelAsset>>;
    cancel?: () => void;
  } = {},
) {
  const face = props.face ?? humanFaceFixture("first");
  const dom = new JSDOM("<!doctype html><main id='app'></main>");
  const app = dom.window.document.querySelector<HTMLElement>("#app")!;
  const downloads: { name: string; bytes: BlobPart; mime: string }[] = [];
  const published: string[] = [],
    disposed: string[] = [],
    views: number[] = [],
    clays: boolean[] = [];
  let fits = 0,
    cancellations = 0;
  const panel = mountHumanFacePanel(app, {
    initialSubjectId: face.id,
    subjects: [
      { id: face.id, read: props.read ?? (async () => JSON.stringify(face)) },
      {
        id: "second",
        read: async () =>
          JSON.stringify({ ...face, id: "second", name: "Second face" }),
      },
    ],
    viewport: () => ({
      build:
        props.build ??
        (async (document) => {
          resolveHumanFaceDocument(document);
          return humanPanelAsset(document.id);
        }),
      cancel: () => {
        ++cancellations;
        props.cancel?.();
      },
      publish: (model) => {
        published.push(model.id);
      },
      dispose: (model) => {
        disposed.push(model.id);
      },
      fitView: () => {
        ++fits;
      },
      cameraView: (degrees) => {
        views.push(degrees);
      },
      setClay: (enabled) => {
        clays.push(enabled);
      },
    }),
    download: (name, bytes, mime) => {
      downloads.push({ name, bytes, mime });
    },
  });
  const element = <T extends HTMLElement = HTMLElement>(id: string): T =>
    app.querySelector<T>(`#${id}`)!;
  // jsdom 26 emits MouseEvent for click; the DOM library now types onclick as
  // PointerEvent. These handlers consume no pointer-specific fields.
  const clickEvent = (): PointerEvent =>
    new dom.window.MouseEvent("click") as PointerEvent;
  const click = async (id: string): Promise<void> => {
    const node = element(id);
    await node.onclick!.call(node, clickEvent());
  };
  const change = async (id: string, value: string): Promise<void> => {
    const node = element<HTMLInputElement>(id);
    node.value = value;
    await node.onchange!.call(node, {
      currentTarget: node,
    } as unknown as Event);
  };
  return {
    dom,
    app,
    panel,
    element,
    click,
    clickEvent,
    change,
    downloads,
    published,
    disposed,
    views,
    clays,
    fits: () => fits,
    cancellations: () => cancellations,
  };
}

/** An opaque preview receipt with independently chosen byte payloads for download routing tests. */
export const humanPanelAsset = (id: string) => ({
  id,
  parts: 3,
  glb: new Uint8Array([1, 2, 3]),
  gltf: {
    json: { asset: { version: "2.0" } },
    resources: { "mesh.bin": new Uint8Array([4, 5]) },
  },
});
