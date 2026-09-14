import {
  materializeCompiledFormation,
  materializeCompiledInstanceSet,
} from "@automovie/engine";
import {
  AutoMovieContentDigest,
  IAutoMovieCompiledShotSource,
  IAutoMovieFilmTimeline,
  IAutoMovieShotContract,
} from "@automovie/interface";

/**
 * The one sound film every spatial-sound scenario plans from.
 *
 * These were one scenario's private fixtures until its runtime crossed the
 * per-scenario budget: it drove four mixes, six plans and two raster rasters
 * behind sixteen assertions, and CI measured 510 ms against a limit of 500. The
 * fixtures are shared rather than copied per split so the three scenarios still
 * describe the same film, and so a change to the film is a change in one place.
 */
export const productionSoundDigest =
  "sha256:0000000000000000000000000000000000000000000000000000000000000000" as AutoMovieContentDigest;

/** One node placement with an identity rotation and unit scale. */
export const productionSoundTransform = (x: number, y: number, z: number) => ({
  translation: { x, y, z },
  rotation: { x: 0, y: 0, z: 0, w: 1 },
  scale: { x: 1, y: 1, z: 1 },
});

/** Whether the closure refused, and its message named the stated cause. */
export const productionSoundRefused = (
  closure: () => unknown,
  message: string,
): boolean => {
  try {
    closure();
    return false;
  } catch (error) {
    return error instanceof Error && error.message.includes(message);
  }
};

/**
 * Seven declared events over an actor, a formation and an instance set.
 *
 * `trimmed` samples past the film's own cut, which is what lets a scenario see
 * that planning omits it rather than rounding it into range.
 */
export const productionSoundContract = (): IAutoMovieShotContract =>
  ({
    id: "sound-shot",
    events: [
      ["contact", "actor"],
      ["arrival", "formation"],
      ["impact", "instances"],
      ["break", "actor"],
      ["reveal", "formation"],
      ["transition", "actor"],
      ["trimmed", "actor"],
    ].map(([id, subject], index) => ({
      id,
      kind: id === "trimmed" ? "transition" : id === "impact" ? "contact" : id,
      window: { from: index * 0.25, to: index * 0.25 + 0.2 },
      subjects: id === "transition" ? ["actor", "formation"] : [subject],
      predicates: [{}],
    })),
  }) as IAutoMovieShotContract;

/**
 * The compiled shot those events resolve against.
 *
 * The actor flies from `x = 4` to `x = 6` while the formation advances from the
 * origin to `x = 10`, so the same event id lands on a different side of the lens
 * depending on when it is sampled -- which is how a pan sign becomes a fact
 * about the scene rather than about arithmetic.
 */
export const productionSoundCompiled = (): IAutoMovieCompiledShotSource =>
  ({
    eventSamples: [
      { id: "contact", time: 0.2 },
      { id: "arrival", time: 0.45 },
      { id: "impact", time: 0.7 },
      { id: "break", time: 0.95 },
      { id: "reveal", time: 1.2 },
      { id: "transition", time: 1.45 },
      { id: "trimmed", time: 2.8 },
    ],
    scene: {
      id: "scene",
      name: null,
      nodes: [
        {
          id: "actor",
          model: "actor-model",
          transform: productionSoundTransform(2, 0, -3),
          motion: null,
          pose: null,
        },
      ],
      cameras: [
        {
          id: "camera",
          transform: productionSoundTransform(0, 1, 0),
          fovY: 50,
          near: 0.1,
          far: 100,
          depthPrecision: { minimumDepthBits: 24, maximumStepMeters: 100 },
        },
      ],
      lights: [],
    },
    motions: [],
    formationMotions: [
      {
        id: "formation-advance",
        formation: "formation",
        action: "advance",
        start: 0,
        end: 2,
        from: {
          translation: { x: 0, y: 0, z: 0 },
          facingOffsetDeg: 0,
          spacingScale: { lateral: 1, depth: 1 },
        },
        to: {
          translation: { x: 10, y: 0, z: 0 },
          facingOffsetDeg: 0,
          spacingScale: { lateral: 1, depth: 1 },
        },
        easing: "linear",
      },
    ],
    formationSlotMotions: [],
    effectCues: [],
    shot: {
      id: "sound-shot",
      name: null,
      scene: "scene",
      duration: 3,
      camera: "camera",
      cameraMotion: null,
      performances: [],
      objectMotions: [
        {
          id: "actor-flight",
          name: null,
          duration: 3,
          loop: false,
          tracks: [
            {
              channel: {
                kind: "node",
                node: "actor",
                path: "translation",
              },
              times: [0, 3],
              values: [4, 0, -3, 6, 0, -3],
              interpolation: "linear",
            },
          ],
        },
      ],
    },
    models: [],
    formations: [
      materializeCompiledFormation({
        formation: {
          id: "formation",
          modelRecipe: "formation-model",
          count: 1,
          layout: {
            kind: "line",
            ranks: 1,
            files: 1,
            spacing: { lateral: 1, depth: 1 },
          },
          anchor: { x: -4, y: 0, z: -6 },
          facingDeg: 0,
          seed: 1,
          capabilities: ["advance"],
          heroOverrides: [],
        },
      }),
    ],
    instanceSets: [
      materializeCompiledInstanceSet({
        instanceSet: {
          id: "instances",
          modelRecipe: "instance-model",
          count: 1,
          layout: {
            kind: "grid",
            rows: 1,
            columns: 1,
            spacing: { x: 1, z: 1 },
          },
          anchor: { x: 0, y: 0, z: -8 },
          facingDeg: 0,
          seed: 1,
          variation: {
            scale: { min: 1, max: 1 },
            palette: ["#ffffff"],
            traits: [],
          },
        },
        world: { routes: [] },
      }),
    ],
    effects: [],
  }) satisfies IAutoMovieCompiledShotSource;

/**
 * The film that cues five buses and one caption over that shot.
 *
 * Every cue starts after the shot's own forty frames, so a cue's source clock
 * and the film clock are deliberately out of phase; `muted` carries zero gain on
 * the music bus, which is what makes a silent contributor distinguishable from
 * an absent one.
 */
export const productionSoundTimeline = (): IAutoMovieFilmTimeline =>
  ({
    version: 1,
    builder: "test",
    inputFingerprint: productionSoundDigest,
    sourceDigest: productionSoundDigest,
    id: "film",
    fps: 20,
    totalFrames: 60,
    segments: [
      {
        shot: "sound-shot",
        sourceInFrame: 0,
        sourceOutFrame: 40,
        startFrame: 0,
        endFrame: 40,
        headHandleFrames: 0,
        tailHandleFrames: 0,
        transitionIn: { kind: "cut" },
        transitionOut: { kind: "cut" },
      },
    ],
    omissions: [],
    tracks: {
      audio: ["music", "ambience", "effects", "dialogue", "muted"].map(
        (bus, index) => ({
          id: `${bus}-cue`,
          asset: `public/${bus}.json`,
          sourceDurationFrames: 10,
          sourceOffsetFrame: 0,
          startFrame: 40 + index,
          durationFrames: 8,
          gain: bus === "muted" ? 0 : 0.25,
          fadeInFrames: 1,
          fadeOutFrames: 1,
          bus: bus === "muted" ? "music" : bus,
        }),
      ),
      captions: [
        {
          id: "line",
          text: "Advance.",
          language: "en-US",
          speaker: "captain",
          startFrame: 52,
          endFrame: 60,
        },
      ],
      effects: [],
    },
  }) as IAutoMovieFilmTimeline;
