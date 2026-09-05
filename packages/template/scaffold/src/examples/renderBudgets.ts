import {
  AUTOMOVIE_RENDER_METRICS,
  type IAutoMovieRenderSubject,
  deriveAutoMovieSemanticMask,
  evaluateAutoMovieRenderBudget,
  measureAutoMovieRenderInventory,
  sealAutoMovieRenderTarget,
} from "@automovie/engine";
import type {
  IAutoMovieMaterial,
  IAutoMovieRenderBudget,
  IAutoMovieRenderReport,
  IAutoMovieRenderTarget,
} from "@automovie/interface";

/**
 * Declaring what a frame is allowed to cost, and reading the honest answer.
 *
 * ## The one rule this example exists to teach
 *
 * A budget is a **decision**, never a measurement. It is authored beside the
 * production it constrains, and nothing here is ever inferred from what the
 * scene currently happens to cost : a limit derived from the present would
 * ratify every regression the moment it landed. A production that declares no
 * budget is reported as unbudgeted rather than quietly given one.
 *
 * The other half is what makes the report evidence instead of a rubber stamp:
 * every metric is answered for, always, with one of five outcomes, and four of
 * them are not "pass".
 *
 * - `within` : measured, budgeted, at or below the limit;
 * - `over` : measured, budgeted, above it, with the dominant owners named;
 * - `unbudgeted` : measured, but nobody agreed what large means;
 * - `unsupported` : no analysis exists for what the design declares;
 * - `not-run` : the analysis exists, but its input was not supplied.
 *
 * The last two make the whole report `incomplete`, and that is the point of
 * them. An artifact whose fluid cost was never computed has not been cleared
 * for fluid cost, and a report that said `within` would be exactly the false
 * capability claim this evidence exists to prevent.
 *
 * ## The subject below is rigged to be incomplete on purpose
 *
 * It declares a water body no solver has priced and a material binding a
 * texture whose dimensions nobody supplied. Both are ordinary situations in a
 * production in progress, and both are things a naive counter would report as
 * zero. Run the report and read which metrics refuse to pass: that refusal, not
 * the numbers beside it, is the technique worth copying.
 */
/**
 * The one asset both halves of this example name.
 *
 * The subject binds it as a material's base colour and the target fingerprints
 * its bytes, and nothing in the engine holds those two lists against each
 * other: a report is measured against whatever target it was handed. So the
 * pairing is the author's to keep, which is why it is one constant here and why
 * {@link checkExampleRenderBudget} asserts it rather than trusting it.
 */
export const EXAMPLE_RENDER_TEXTURE = "public/assets/panel-basecolor.png";

export const exampleRenderSubject = (
  props: {
    /** Asset path the panel's finish binds; deliberately left unmeasured. */
    texture?: string;
    /** Id of the declared water body carrying no solver-proved cost. */
    waterBody?: string;
  } = {},
): IAutoMovieRenderSubject => {
  const texture = props.texture ?? EXAMPLE_RENDER_TEXTURE;
  return {
    scene: {
      id: "example-render-scene",
      name: "one panel, one light, one unpriced pool",
      nodes: [
        {
          id: "panel",
          model: "example-panel",
          transform: {
            translation: { x: 0, y: 1, z: 0 },
            rotation: { x: 0, y: 0, z: 0, w: 1 },
            scale: { x: 1, y: 1, z: 1 },
          },
          motion: null,
          pose: null,
        },
      ],
      // No camera, deliberately. A budget is checked against what the scene
      // commits the renderer to for EVERY camera : an upper bound, never an
      // observed frame : so framing changes nothing this report measures.
      cameras: [],
      lights: [
        {
          type: "directional",
          id: "key",
          transform: {
            translation: { x: 3, y: 5, z: 3 },
            rotation: { x: 0, y: 0, z: 0, w: 1 },
            scale: { x: 1, y: 1, z: 1 },
          },
          color: { r: 1, g: 0.96, b: 0.9, a: null, hex: null },
          intensity: 3,
        },
      ],
    },
    models: [
      {
        id: "example-panel",
        name: "placeholder panel",
        origin: "generated",
        skeleton: null,
        materials: [
          {
            id: "example-panel-finish",
            name: null,
            baseColor: { r: 0.72, g: 0.7, b: 0.66, a: 1, hex: null },
            metallic: 0,
            roughness: 0.6,
            emissive: null,
            opacity: 1,
            // A material binds an asset by id; the pixels are never authored
            // here. The consequence for a budget is the whole lesson below: an
            // asset whose decoded size nobody supplied cannot be turned into
            // device bytes, and the report says so rather than guessing.
            baseColorTexture: texture,
          },
        ],
        parts: [
          {
            id: "panel",
            name: null,
            geometry: {
              type: "primitive",
              shape: { type: "box", width: 1.6, height: 2.2, depth: 0.06 },
            },
            material: "example-panel-finish",
            attachedBone: null,
            transform: null,
          },
        ],
        asset: null,
        body: null,
      },
    ],
    waterBodies: [
      {
        id: props.waterBody ?? "example-pool",
        owner: null,
        // No scene node draws it and no shallow-water domain is bound, so
        // nothing in this repository can say what it costs. A `0` here would be
        // a measurement nobody made.
        nodes: [],
        domain: null,
        cells: null,
        particles: null,
        material: null,
      },
    ],
    // Empty on purpose. Supply an entry per bound asset : decoded width, height
    // and mipmap policy : and `textureBytes` becomes a measured number instead
    // of a declared gap.
    textures: [],
  };
};

/**
 * The limits this production commits to, per quality tier.
 *
 * Limits are inclusive, and an omitted metric is unbudgeted rather than
 * unlimited. Every metric this list leaves out : the memory pair, the instance
 * counts, the fluid pair : therefore shows up in the report as a visible
 * decision rather than as silence: "nobody thought about it" reads differently
 * from "allowed to be large", and the report keeps the two apart.
 *
 * One production may declare several tiers and check an artifact against the
 * one a render job actually targets, which is why the tier is a plain label
 * rather than a closed set. The label has to be one a job asks for : `proxy`
 * and `final` are what the generated project's render job looks up : because a budget
 * filed under a name nobody queries is a limit that never runs.
 */
export const EXAMPLE_RENDER_BUDGET: IAutoMovieRenderBudget = {
  version: 1,
  tier: "proxy",
  limits: {
    triangles: 20_000,
    vertices: 20_000,
    drawCalls: 64,
    materials: 8,
    textures: 8,
    lights: 4,
    shadowMaps: 2,
    nodes: 32,
  },
};

/**
 * The renderer, settings and asset bytes the verdict is bound to.
 *
 * A budget verdict is only evidence while the thing it measured is still the
 * thing that will be drawn. Change the shadow filter, the pixel ratio or one
 * texture's bytes and the same design costs something else, so a report that
 * outlives its target is not conservative : it is wrong in an unknown
 * direction. The fingerprint is what makes that detectable instead of
 * invisible, and it is deterministic by construction: no timestamps, no
 * absolute paths, and assets ordered by code unit rather than by locale.
 */
export const exampleRenderTarget = (): IAutoMovieRenderTarget =>
  sealAutoMovieRenderTarget({
    renderer: { api: "webgl2", vendor: "unknown", device: "unknown" },
    settings: {
      width: 1_280,
      height: 720,
      pixelRatio: 1,
      shadows: true,
      shadowType: "pcfSoft",
      toneMapping: "acesFilmic",
      exposure: 1,
    },
    assets: [
      {
        path: EXAMPLE_RENDER_TEXTURE,
        digest: `sha256:${"0".repeat(64)}`,
      },
    ],
  });

/**
 * Measure the subject, check it against the declared budget, and report.
 *
 * The mask and the inventory read the same subject, which is the only reason a
 * colour in the mask and a cost in the report can name the same owner. Two
 * functions each reaching into the artifact their own way would drift the first
 * time one of them learned about a new kind of drawable, and the report's owner
 * ids would stop resolving without anything going red.
 */
export const exampleRenderReport = (): IAutoMovieRenderReport => {
  const subject = exampleRenderSubject();
  const mask = deriveAutoMovieSemanticMask(subject);
  return evaluateAutoMovieRenderBudget({
    inventory: measureAutoMovieRenderInventory({ subject, mask }),
    budget: EXAMPLE_RENDER_BUDGET,
    mask,
    target: exampleRenderTarget(),
  });
};

/**
 * Every asset one material binds, across all five of its texture slots.
 *
 * Reading only the base colour would be the easy version and the wrong one: a
 * normal map or an occlusion map is bytes the frame reads just as surely, and a
 * check that missed them would pass a target fingerprinting half the inputs.
 * Each slot is either a bare asset id or the full sampling declaration, and
 * both spell the asset the same way once unwrapped.
 */
const materialAssets = (material: IAutoMovieMaterial): string[] =>
  [
    material.baseColorTexture,
    material.metallicRoughnessTexture,
    material.normalTexture,
    material.occlusionTexture,
    material.emissiveTexture,
  ]
    .filter((binding) => binding !== null && binding !== undefined)
    .map((binding) => (typeof binding === "string" ? binding : binding.asset));

/**
 * Check that the report refuses to call an unmeasured cost a pass.
 *
 * Every assertion below is about the shape of the answer rather than about a
 * number, which is what keeps this a check and not a snapshot. The report has
 * to answer for every metric there is; the water body nobody priced has to come
 * back `unsupported` with no measurement beside it; the texture nobody sized
 * has to come back `not-run`; a metric that was measured but never budgeted has
 * to say `unbudgeted` rather than pass silently; and the whole report has to
 * read `incomplete`, because a design carrying two unanswered costs has not
 * been cleared.
 *
 * The last assertion is the one no engine call makes: every asset the subject's
 * materials bind has to appear in the target the verdict is fingerprinted
 * against, or the report is evidence about bytes the frame will not read.
 */
export const checkExampleRenderBudget = (): void => {
  const subject = exampleRenderSubject();
  const target = exampleRenderTarget();
  const sealed = new Set(target.assets.map((asset) => asset.path));
  for (const model of subject.models)
    for (const material of model.materials)
      for (const asset of materialAssets(material))
        if (!sealed.has(asset))
          throw new Error(
            `material "${material.id}" binds "${asset}", which the sealed render target does not fingerprint`,
          );

  const report = exampleRenderReport();
  const finding = (metric: string) => {
    const found = report.findings.find((entry) => entry.metric === metric);
    if (found === undefined)
      throw new Error(`the report never answered for "${metric}"`);
    return found;
  };

  if (report.findings.length !== AUTOMOVIE_RENDER_METRICS.length)
    throw new Error(
      `a report answers for all ${AUTOMOVIE_RENDER_METRICS.length} metrics, but carried ${report.findings.length}`,
    );
  for (const metric of ["fluidCells", "fluidParticles"] as const) {
    const entry = finding(metric);
    if (entry.status !== "unsupported")
      throw new Error(
        `"${metric}" has no analysis behind it, so it must report unsupported, not ${entry.status}`,
      );
    if (entry.measured !== null)
      throw new Error(
        `"${metric}" reported the measurement ${entry.measured} nobody made`,
      );
  }
  if (finding("textureBytes").status !== "not-run")
    throw new Error(
      `an asset with no supplied dimensions must report not-run, not ${finding("textureBytes").status}`,
    );
  if (finding("geometryBytes").status !== "unbudgeted")
    throw new Error(
      `a measured metric this budget omits must report unbudgeted, not ${finding("geometryBytes").status}`,
    );
  if (finding("triangles").status !== "within")
    throw new Error(
      `the panel is inside its triangle limit, so it must report within, not ${finding("triangles").status}`,
    );
  if (report.status !== "incomplete")
    throw new Error(
      `two unanswered costs make a report incomplete, but it read ${report.status}`,
    );
};
