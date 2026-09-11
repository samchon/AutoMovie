import * as THREE from "three";

import { OrbitControls } from "/OrbitControls.js";
import {
  portraitWebCamera,
  portraitWebClip,
  portraitWebFocusIds,
  portraitWebHardwareRenderer,
  portraitWebModes,
  portraitWebReferenceFrame,
  resetPortraitWebSubject,
} from "/logic.mjs";

const $ = (id) => document.getElementById(id);
const renderer = new THREE.WebGLRenderer({
  antialias: true,
  preserveDrawingBuffer: true,
});
renderer.setPixelRatio(1);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1;
$("canvas-slot").append(renderer.domElement);
const gl = renderer.getContext();
const debug = gl.getExtension("WEBGL_debug_renderer_info");
const device = debug
  ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL)
  : "unknown";
const hardware = portraitWebHardwareRenderer(device);
console.log("RENDERER", device);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0.025, 0.033, 0.047);
const perspective = new THREE.PerspectiveCamera(30, 0.9, 0.001, 10);
const orthographic = new THREE.OrthographicCamera(
  -0.1,
  0.1,
  0.1,
  -0.1,
  0.001,
  10,
);
let camera = perspective;
const controls = new OrbitControls(camera, renderer.domElement);
controls.minDistance = 0.02;
controls.maxDistance = 3;
const lights = new THREE.Group();
scene.add(lights);
const calibration = new THREE.Group();
const cube = new THREE.Mesh(
  new THREE.BoxGeometry(0.015, 0.015, 0.015),
  new THREE.MeshBasicMaterial({ color: 0xff4025 }),
);
cube.position.set(0.115, 0.035, 0.08);
calibration.add(cube);
const origin = new THREE.Vector3(0.095, 0.01, 0.08);
for (const [direction, color] of [
  [new THREE.Vector3(1, 0, 0), 0xff4025],
  [new THREE.Vector3(0, 1, 0), 0x45ee75],
  [new THREE.Vector3(0, 0, 1), 0x458bff],
])
  calibration.add(
    new THREE.ArrowHelper(direction, origin, 0.025, color, 0.006, 0.003),
  );
scene.add(calibration);
const clay = new THREE.MeshStandardMaterial({
  color: new THREE.Color(0.35, 0.35, 0.35),
  roughness: 0.72,
  side: THREE.DoubleSide,
});
const wire = new THREE.MeshBasicMaterial({
  color: 0xb9d3e8,
  wireframe: true,
  side: THREE.DoubleSide,
});
let subject = new THREE.Group();
let meshes = new Map();
let snapshot;
let mode = "colour";
let view = "front";
let loading = false;
let failure = null;
let buildStatus = { state: "idle", message: "Reading exported artifact." };
let subjectBounds = new THREE.Box3();
let runtimeIdentity;
let referenceCropShown = false;
scene.add(subject);

function identity() {
  return {
    schema: "automovie-face-web-capture-v1",
    artifact: snapshot.artifact,
    basisSha256: snapshot.basisSha256,
    model: {
      id: snapshot.model.id,
      source: snapshot.source,
      parts: meshes.size,
    },
    runtime: {
      three: THREE.REVISION,
      files: runtimeIdentity,
      renderer: device,
      hardware,
      colourSpace: renderer.outputColorSpace,
      toneMapping: "ACESFilmic",
      exposure: renderer.toneMappingExposure,
      depth: {
        bits: gl.getParameter(gl.DEPTH_BITS),
        projection: "standard",
        clipRule: "complete subject bounds in camera space, 5% diagonal margin",
      },
    },
    lighting: {
      kind: "WebGL inspection",
      ambient: 0.6,
      directional: snapshot.profile.cycles.lights.map((light) => ({
        position: light.position,
        colour: light.color,
        intensity: light.power / 10,
      })),
      castsShadows: false,
    },
    camera: {
      view,
      projection: camera.isOrthographicCamera ? "orthographic" : "perspective",
      position: camera.position.toArray(),
      quaternion: camera.quaternion.toArray(),
      target: controls.target.toArray(),
      verticalFov: camera.isPerspectiveCamera ? camera.fov : null,
      orthographic: camera.isOrthographicCamera
        ? {
            left: camera.left,
            right: camera.right,
            top: camera.top,
            bottom: camera.bottom,
            zoom: camera.zoom,
          }
        : null,
      near: camera.near,
      far: camera.far,
      aspect: renderer.domElement.width / renderer.domElement.height,
    },
    modelTransform: {
      matrix: subject.matrix.toArray(),
      storage: "column-major",
      units: "metres",
    },
    image: {
      width: renderer.domElement.width,
      height: renderer.domElement.height,
    },
    mode,
    visibleParts: [...meshes]
      .filter(([, mesh]) => mesh.visible)
      .map(([id]) => id),
    calibration: calibration.visible
      ? {
          cubeSizeMetres: 0.015,
          cubePosition: [0.115, 0.035, 0.08],
          axesOrigin: [0.095, 0.01, 0.08],
          axesLengthMetres: 0.025,
          colours: { x: "red", y: "green", z: "blue" },
          geometry: "independent native Three.js primitives",
        }
      : null,
    review: "diagnostic capture; no automatic visual acceptance",
    sourceBuild: buildStatus,
  };
}

function render() {
  showNotice();
  $("reference-note").textContent = referenceCropShown
    ? view === "reference"
      ? "Exact profile crop and recorded image pose. WebGL inspection lighting."
      : "Profile crop. The current orbit camera is not registered to it."
    : "Original image. The orbit camera is not registered to this photograph.";
  if (snapshot) {
    const bounds = subjectBounds.clone();
    if (calibration.visible)
      bounds.union(new THREE.Box3().setFromObject(calibration));
    const clip = portraitWebClip(
      bounds.min.toArray(),
      bounds.max.toArray(),
      camera.position.toArray(),
      camera.getWorldDirection(new THREE.Vector3()).toArray(),
    );
    camera.near = clip.near;
    camera.far = clip.far;
    camera.updateProjectionMatrix();
  }
  renderer.render(scene, camera);
  gl.finish();
  if (snapshot) {
    $("identity").textContent = JSON.stringify(identity(), null, 2);
    $("status").textContent =
      failure ??
      `${view} · ${mode} · ${meshes.size} parts · model ${snapshot.artifact.model.slice(0, 12)} · ${device}${buildStatus.state === "building" ? " · ttsx rebuilding…" : ""}`;
    $("status").classList.toggle("error", failure !== null || !hardware);
  }
}
controls.addEventListener("change", () => {
  view = "custom";
  render();
});

function setCamera(name) {
  referenceCropShown = name === "reference";
  resetPortraitWebSubject(subject);
  camera = name === "reference" || name === "nose" ? orthographic : perspective;
  controls.object = camera;
  const square = camera.isOrthographicCamera;
  const width = snapshot.profile.image.width;
  const height = square ? width : snapshot.profile.image.height;
  renderer.setSize(width, height, false);
  $("canvas-slot").style.aspectRatio = `${width}/${height}`;
  if ($("canvas-slot").style.position === "fixed") prepareScreenshot();
  perspective.aspect = width / height;
  perspective.fov = snapshot.profile.camera.verticalFov;
  camera.zoom = 1;
  $("reference-frame").style.aspectRatio = name === "reference" ? "1" : "";
  const photo = $("reference-image");
  const crop = snapshot.profile.reference.crop;
  photo.style.width =
    name === "reference"
      ? `${(snapshot.profile.reference.width / crop.size) * 100}%`
      : "100%";
  photo.style.maxWidth = name === "reference" ? "none" : "";
  photo.style.transform =
    name === "reference"
      ? `translate(${(-crop.x / snapshot.profile.reference.width) * 100}%, ${(-crop.y / snapshot.profile.reference.height) * 100}%)`
      : "none";
  $("reference-note").textContent =
    name === "reference"
      ? "Exact profile crop and recorded image pose. WebGL inspection lighting."
      : "Original image. The orbit camera is not registered to this photograph.";
  const preset = snapshot.profile.views.find(
    (candidate) => candidate.name === name,
  );
  let target, distance, yaw, pitch;
  if (preset) {
    target = snapshot.profile.camera.target;
    distance = snapshot.profile.camera.distance;
    yaw = preset.yaw;
    pitch = preset.pitch ?? 0;
  } else if (name === "reference") {
    const frame = portraitWebReferenceFrame(snapshot.profile);
    subject.matrix.set(...frame.matrix);
    target = frame.target;
    distance = 1;
    yaw = 0;
    pitch = 0;
    orthographic.left = -frame.span / 2;
    orthographic.right = frame.span / 2;
    orthographic.top = frame.span / 2;
    orthographic.bottom = -frame.span / 2;
  } else if (name === "nose") {
    // Authored inspection camera shared with .shots/face-experiment/render-close.py.
    target = [0, -0.01, 0.074];
    distance = 0.4;
    yaw = 0;
    pitch = 0;
    orthographic.left = -0.034;
    orthographic.right = 0.034;
    orthographic.top = 0.034;
    orthographic.bottom = -0.034;
  } else {
    const ids = portraitWebFocusIds([...meshes.keys()], name);
    const bounds = new THREE.Box3();
    for (const id of ids) bounds.expandByObject(meshes.get(id));
    target = bounds.getCenter(new THREE.Vector3()).toArray();
    const size = bounds.getSize(new THREE.Vector3());
    distance =
      (Math.max(size.y, size.x / camera.aspect) * 0.65) /
        Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) +
      size.z / 2;
    yaw = 0;
    pitch = 0;
  }
  subject.updateMatrixWorld(true);
  subjectBounds = new THREE.Box3().setFromObject(subject);
  camera.updateProjectionMatrix();
  controls.target.fromArray(target);
  camera.position.fromArray(portraitWebCamera(target, distance, yaw, pitch));
  controls.update();
  view = name;
  render();
}

function setMode(next) {
  if (!portraitWebModes.includes(next))
    throw new Error(`Unknown surface mode: ${next}`);
  mode = next;
  for (const mesh of meshes.values())
    mesh.material =
      mode === "colour" ? mesh.userData.colour : mode === "clay" ? clay : wire;
  for (const button of $("modes").children)
    button.classList.toggle("active", button.textContent === mode);
  render();
}

function setVisible(ids, visible) {
  for (const id of ids)
    if (!meshes.has(id)) throw new Error(`Unknown part: ${id}`);
  for (const id of ids) meshes.get(id).visible = visible;
  for (const input of $("parts").querySelectorAll("input"))
    input.checked = meshes.get(input.value).visible;
  render();
}

function button(parent, label, action) {
  const element = document.createElement("button");
  element.textContent = label;
  element.addEventListener("click", () => {
    try {
      action();
    } catch (error) {
      showError(error);
    }
  });
  parent.append(element);
}

function showError(error) {
  failure = error.message;
  $("status").textContent = failure;
  $("status").classList.add("error");
  showNotice();
  console.error(error);
}

function showNotice() {
  $("build-notice").hidden = failure === null;
  $("build-summary").textContent =
    failure === null ? "" : failure.split("\n")[0].slice(0, 220);
  $("build-output").textContent = failure ?? "";
}

function dispose(group) {
  for (const mesh of group.children) mesh.geometry.dispose();
  for (const material of group.userData.materials ?? []) material.dispose();
}

async function reload() {
  if (loading) throw new Error("Reload is already running.");
  loading = true;
  $("reload").disabled = true;
  $("save").disabled = true;
  const next = new THREE.Group();
  try {
    const response = await fetch("/snapshot", { cache: "no-store" });
    if (!response.ok) throw new Error(await response.text());
    const loaded = await response.json();
    if (
      runtimeIdentity !== undefined &&
      JSON.stringify(runtimeIdentity) !== JSON.stringify(loaded.runtime)
    ) {
      location.reload();
      throw new Error(
        "Viewer runtime changed; refreshing the page before loading its artifact.",
      );
    }
    if (loaded.model.skeleton !== null)
      throw new Error("This direct workbench accepts static exported meshes.");
    for (const finish of loaded.model.materials)
      for (const [key, value] of Object.entries(finish))
        if (key.endsWith("Texture") && value != null)
          throw new Error("Texture bindings need a viewer resolver.");
    const materials = new Map(
      loaded.model.materials.map((finish) => {
        const alpha =
          finish.alphaMode ?? (finish.opacity < 1 ? "blend" : "opaque");
        return [
          finish.id,
          new THREE.MeshPhysicalMaterial({
            color: new THREE.Color(
              finish.baseColor.r,
              finish.baseColor.g,
              finish.baseColor.b,
            ),
            roughness: finish.roughness,
            metalness: finish.metallic,
            opacity: alpha === "opaque" ? 1 : finish.opacity,
            transparent: alpha === "blend",
            alphaTest: alpha === "mask" ? (finish.alphaCutoff ?? 0.5) : 0,
            emissive:
              finish.emissive === null
                ? new THREE.Color(0, 0, 0)
                : new THREE.Color(
                    finish.emissive.r,
                    finish.emissive.g,
                    finish.emissive.b,
                  ),
            side: finish.doubleSided ? THREE.DoubleSide : THREE.FrontSide,
            transmission: finish.transmission ?? 0,
            ior: finish.ior ?? 1.5,
            thickness: finish.thickness ?? 0,
            clearcoat: finish.clearcoat ?? 0,
          }),
        ];
      }),
    );
    next.userData.materials = [...materials.values()];
    const nextMeshes = new Map();
    for (const part of loaded.model.parts) {
      if (
        part.geometry.type !== "mesh" ||
        part.attachedBone !== null ||
        part.transform !== null ||
        part.geometry.mesh.skin !== null
      )
        throw new Error(
          `Part ${part.id} must be an exported untransformed static mesh.`,
        );
      if (!materials.has(part.material) || nextMeshes.has(part.id))
        throw new Error(`Invalid part identity/material: ${part.id}`);
      const data = part.geometry.mesh;
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(data.positions, 3),
      );
      if (data.indices !== null) geometry.setIndex(data.indices);
      if (data.normals !== null)
        geometry.setAttribute(
          "normal",
          new THREE.Float32BufferAttribute(data.normals, 3),
        );
      else geometry.computeVertexNormals();
      const mesh = new THREE.Mesh(geometry, materials.get(part.material));
      mesh.name = part.id;
      mesh.userData.colour = mesh.material;
      mesh.userData.materialId = part.material;
      mesh.visible = meshes.get(part.id)?.visible ?? true;
      next.add(mesh);
      nextMeshes.set(part.id, mesh);
    }
    const previousMatrix = subject.matrix.clone();
    scene.remove(subject);
    dispose(subject);
    subject = next;
    subject.matrixAutoUpdate = false;
    subject.matrix.copy(previousMatrix);
    if (snapshot !== undefined && view === "reference")
      subject.matrix.set(...portraitWebReferenceFrame(loaded.profile).matrix);
    scene.add(subject);
    subjectBounds = new THREE.Box3().setFromObject(subject);
    meshes = nextMeshes;
    const first = snapshot === undefined;
    snapshot = loaded;
    runtimeIdentity = loaded.runtime;
    failure = null;
    lights.clear();
    lights.add(new THREE.AmbientLight(0xffffff, 0.6));
    for (const spec of snapshot.profile.cycles.lights) {
      const light = new THREE.DirectionalLight(
        new THREE.Color(...spec.color),
        spec.power / 10,
      );
      light.position.fromArray(spec.position);
      lights.add(light);
    }
    $("views").replaceChildren();
    for (const name of [
      ...snapshot.profile.views.map((preset) => preset.name),
      "eyes",
      "nose",
      "mouth",
      "reference",
    ])
      button($("views"), name, () => setCamera(name));
    $("parts").replaceChildren();
    for (const [id, mesh] of meshes) {
      const label = document.createElement("label");
      const input = document.createElement("input");
      input.type = "checkbox";
      input.value = id;
      input.checked = mesh.visible;
      input.addEventListener("change", () => setVisible([id], input.checked));
      label.append(input, document.createTextNode(id));
      $("parts").append(label);
    }
    filterParts();
    setMode(mode);
    if (first) setCamera("front");
    else if (view !== "custom") setCamera(view);
    else render();
    return identity();
  } catch (error) {
    if (subject !== next) dispose(next);
    showError(error);
    throw error;
  } finally {
    loading = false;
    $("reload").disabled = false;
    $("save").disabled = snapshot === undefined;
  }
}

function filterParts() {
  const query = $("filter").value.toLowerCase();
  for (const label of $("parts").children)
    label.hidden = !label.textContent.toLowerCase().includes(query);
}

function capture() {
  if (loading || !snapshot || failure || buildStatus.state === "failed")
    throw new Error("A successful current reload is required before capture.");
  if (!hardware) throw new Error(`Hardware renderer unavailable: ${device}`);
  render();
  return {
    receipt: identity(),
    png: renderer.domElement.toDataURL("image/png"),
  };
}

for (const name of portraitWebModes)
  button($("modes"), name, () => setMode(name));
for (const [name, select] of [
  ["All", () => [...meshes.keys()]],
  [
    "Hair",
    () =>
      [...meshes]
        .filter(([, mesh]) => mesh.userData.materialId === "hair")
        .map(([id]) => id),
  ],
  [
    "Head / lids",
    () =>
      [...meshes.keys()].filter(
        (id) => id === "head" || id.endsWith("eyelids"),
      ),
  ],
  ["Nasal parts", () => portraitWebFocusIds([...meshes.keys()], "nose")],
  [
    "Teeth",
    () =>
      [...meshes]
        .filter(([, mesh]) => mesh.userData.materialId === "teeth")
        .map(([id]) => id),
  ],
])
  button($("groups"), name, () => {
    const ids = select();
    setVisible(ids, !ids.every((id) => meshes.get(id).visible));
  });
$("filter").addEventListener("input", filterParts);
$("calibration").addEventListener("change", () => {
  calibration.visible = $("calibration").checked;
  render();
});
$("reload").addEventListener("click", () => {
  void reload().catch(() => {});
});
$("save").addEventListener("click", async () => {
  try {
    const result = capture();
    const bytes = await (await fetch(result.png)).arrayBuffer();
    result.receipt.pngSha256 = [
      ...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
    ]
      .map((value) => value.toString(16).padStart(2, "0"))
      .join("");
    const stem = `${result.receipt.artifact.model.slice(0, 12)}-${result.receipt.camera.view}-${result.receipt.mode}-${Date.now()}`;
    result.receipt.file = `${stem}.png`;
    for (const [suffix, href] of [
      ["png", result.png],
      [
        "json",
        `data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(result.receipt, null, 2))}`,
      ],
    ]) {
      const link = document.createElement("a");
      link.download = `${stem}.${suffix}`;
      link.href = href;
      link.click();
    }
  } catch (error) {
    showError(error);
  }
});
window.faceViewer = {
  reload,
  setView: setCamera,
  setMode,
  setVisible,
  capture,
  identity,
  setCalibration(visible) {
    calibration.visible = visible;
    $("calibration").checked = visible;
    render();
  },
  prepareScreenshot,
  readPixel(x, y) {
    render();
    const pixel = new Uint8Array(4);
    gl.readPixels(
      x,
      renderer.domElement.height - 1 - y,
      1,
      1,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      pixel,
    );
    return [...pixel];
  },
};
function prepareScreenshot() {
  Object.assign($("canvas-slot").style, {
    position: "fixed",
    left: "0px",
    top: "0px",
    zIndex: "10",
    width: `${renderer.domElement.width}px`,
    height: `${renderer.domElement.height}px`,
  });
}
let polling = false;
async function pollSource() {
  if (polling || loading) return;
  polling = true;
  try {
    const response = await fetch("/status", { cache: "no-store" });
    if (!response.ok) throw new Error(await response.text());
    const status = await response.json();
    buildStatus = status.build;
    if (snapshot === undefined || status.basisSha256 !== snapshot.basisSha256)
      await reload();
    if (buildStatus.state === "failed") {
      failure = `${buildStatus.message}\nFull log: ${buildStatus.log ?? "server output"}`;
      render();
    } else {
      if (buildStatus.state === "succeeded") failure = null;
      render();
    }
  } catch (error) {
    showError(error);
  } finally {
    polling = false;
  }
}
window.faceViewer.ready = reload().then(async () => {
  await pollSource();
  return identity();
});
window.faceViewer.ready.catch(() => {});
setInterval(() => {
  void pollSource();
}, 1500);
