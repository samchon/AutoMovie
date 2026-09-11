/** Pure inspection choices shared by the browser and its unit scenarios. */
export const portraitWebModes = ["colour", "clay", "wireframe"];

/** Reset the subject frame before a close camera reads child world bounds. */
export function resetPortraitWebSubject(subject) {
  subject.matrixAutoUpdate = false;
  subject.matrix.identity();
  // Box3.expandByObject updates the child without recomputing its parent.
  // A reference-pose matrix must therefore be propagated away before focus.
  subject.updateMatrixWorld(true);
}

/** Refuse a mixed export rather than labeling old geometry with a new basis. */
export function verifyPortraitWebBasis(expected, actual) {
  for (const key of ["model", "gltf", "profile", "configuration", "input"])
    if (!expected[key] || expected[key] !== actual[key])
      throw new Error(
        `Export is incomplete or changed: ${key}. Reload after export completes.`,
      );
}

/** Camera positions use the export's Y-up metre frame and positive-Z front. */
export function portraitWebCamera(target, distance, yaw, pitch) {
  const azimuth = (yaw * Math.PI) / 180;
  const elevation = (pitch * Math.PI) / 180;
  return [
    target[0] + distance * Math.cos(elevation) * Math.sin(azimuth),
    target[1] + distance * Math.sin(elevation),
    target[2] + distance * Math.cos(elevation) * Math.cos(azimuth),
  ];
}

/** Select anatomical camera targets by resident part ids without changing meshes. */
export function portraitWebFocusIds(ids, focus) {
  const patterns = {
    eyes: /eyelids$/,
    nose: /^(nose$|nose-|nasal-|nostril-)/,
    mouth: /^(lips$|oral-cavity$|tooth-)/,
  };
  const pattern = patterns[focus];
  if (pattern === undefined) throw new Error(`Unknown close view: ${focus}`);
  const selected = ids.filter((id) => pattern.test(id));
  if (selected.length === 0)
    throw new Error(`No resident parts for close view: ${focus}`);
  return selected;
}

/** Identify software rasterizers explicitly; an unmasked device name is required. */
export function portraitWebHardwareRenderer(renderer) {
  return (
    renderer.trim().length > 0 &&
    !/swiftshader|llvmpipe|softpipe|software|microsoft basic|warp|unknown/i.test(
      renderer,
    )
  );
}

/** A label is a single directory name, never an arbitrary capture destination. */
export function portraitWebCaptureLabel(label) {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/.test(label))
    throw new Error(
      "Capture label must be 1-80 letters, digits, hyphens or underscores.",
    );
  return label;
}

/**
 * Enclose the complete subject box in camera-space depth with a 5% diagonal
 * margin. Recompute after orbit/pan/zoom; a close target must not clip nearby
 * context. The near floor scales with this subject, never with a world unit.
 */
export function portraitWebClip(min, max, eye, forward) {
  if (
    [min, max, eye, forward].some(
      (v) => v.length !== 3 || v.some((n) => !Number.isFinite(n)),
    ) ||
    min.some((n, i) => n > max[i])
  )
    throw new Error(
      "Clip input requires finite ordered XYZ bounds and camera vectors.",
    );
  const length = Math.hypot(...forward);
  if (length === 0 || !Number.isFinite(length))
    throw new Error("Clip camera direction must be finite and nonzero.");
  const extent = Math.max(Math.hypot(...max.map((n, i) => n - min[i])), 1e-6);
  let closest = Infinity;
  let furthest = -Infinity;
  for (let corner = 0; corner < 8; corner++) {
    let depth = 0;
    for (let axis = 0; axis < 3; axis++)
      depth +=
        (((corner & (1 << axis)) === 0 ? min[axis] : max[axis]) - eye[axis]) *
        (forward[axis] / length);
    closest = Math.min(closest, depth);
    furthest = Math.max(furthest, depth);
  }
  const near = Math.max(closest - extent * 0.05, extent / 100000);
  const far = Math.max(furthest + extent * 0.05, near + extent / 1000);
  if (!Number.isFinite(near) || !Number.isFinite(far) || far <= near)
    throw new Error("Clip range must remain representable.");
  return { near, far };
}

/** Coalesce source writes while ensuring at most one exporter can be active. */
export function createPortraitWebBuildGate() {
  let running = false;
  let pending = false;
  return {
    request: () => {
      pending = true;
    },
    start: () => {
      if (running || !pending) return false;
      running = true;
      pending = false;
      return true;
    },
    finish: () => {
      running = false;
      return pending;
    },
  };
}

/** Reproduce render-blender.py's recorded image pose and orthographic crop. */
export function portraitWebReferenceFrame(profile) {
  const { rotation, origin, millimetersPerPixel } = profile.measurement;
  const crop = profile.reference.crop;
  if (
    rotation.length !== 9 ||
    origin.length !== 3 ||
    ![
      ...rotation,
      ...origin,
      millimetersPerPixel,
      crop.x,
      crop.y,
      crop.size,
    ].every(Number.isFinite) ||
    millimetersPerPixel <= 0 ||
    crop.size <= 0
  )
    throw new Error(
      "Reference view requires a finite recorded rotation, origin, scale and crop.",
    );
  const scale = millimetersPerPixel / 1000;
  const x =
    (crop.x + crop.size / 2 - origin[0]) * scale +
    rotation[1] * 0.028 +
    rotation[2] * 0.06;
  const y =
    (-crop.y - crop.size / 2 - origin[1]) * scale +
    rotation[4] * 0.028 +
    rotation[5] * 0.06;
  return {
    target: [x, y, 0],
    position: [x, y, 1],
    span: crop.size * scale,
    matrix: [
      rotation[0],
      rotation[1],
      rotation[2],
      0,
      rotation[3],
      rotation[4],
      rotation[5],
      0,
      rotation[6],
      rotation[7],
      rotation[8],
      0,
      0,
      0,
      0,
      1,
    ],
  };
}
