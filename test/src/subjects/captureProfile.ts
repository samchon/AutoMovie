/**
 * Fixed inspection conditions for the reference face study. Cameras use the
 * same Y-up metre frame as the exported AutoMovie model. The Blender checker
 * converts that frame to Z-up when importing the unmodified GLTF.
 *
 * The area lights reveal form and allow real occlusion. These are inspection
 * conditions, not a recovered lighting solution for the outdoor photograph.
 * Changing this profile requires new captures and a new visual review.
 */
export const portraitCaptureProfile = {
  image: { width: 900, height: 1000 },
  // The rough hair mass helps the colour silhouette but must not conceal the
  // cranial and facial surfaces during geometry-only inspection.
  clayHideMaterials: ["hair"],
  camera: { verticalFov: 30, distance: 0.63, target: [0, -0.008, 0] },
  reference: { width: 896, height: 1000, crop: { x: 250, y: 240, size: 430 } },
  views: [
    { name: "front", yaw: 0 },
    { name: "left-oblique", yaw: 45 },
    { name: "right-oblique", yaw: -45 },
    { name: "left-profile", yaw: 90 },
    { name: "right-profile", yaw: -90 },
    { name: "back", yaw: 180 },
    { name: "top", yaw: 0, pitch: 75 },
    { name: "bottom", yaw: 0, pitch: -75 },
    { name: "rear-oblique", yaw: -135 },
  ],
  cycles: {
    // Current review judges broad facial form. Brows and hair are coarse context,
    // so filtering their subpixel detail is acceptable at this inspection stage.
    // Fine-strand review requires a separately declared unfiltered capture.
    denoising: true,
    samples: 64,
    exposure: -1.5,
    world: { color: [0.7, 0.75, 0.8], strength: 0.35 },
    background: { color: [0.035, 0.042, 0.055], strength: 0.7 },
    lights: [
      {
        name: "Key",
        position: [-0.3, 0.35, 0.45],
        power: 25,
        size: 0.3,
        color: [1, 0.88, 0.8],
      },
      {
        name: "Fill",
        position: [0.35, 0.1, 0.3],
        power: 8,
        size: 0.45,
        color: [0.78, 0.86, 1],
      },
      {
        name: "Rim",
        position: [0.1, 0.3, -0.25],
        power: 18,
        size: 0.25,
        color: [1, 0.92, 0.82],
      },
    ],
  },
};
