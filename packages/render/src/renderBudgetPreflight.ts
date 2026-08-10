import {
  IAutoMovieRenderPlanting,
  IAutoMovieRenderSoftPanel,
  IAutoMovieRenderSubject,
  IAutoMovieRenderTextureSource,
  IAutoMovieRenderWaterBody,
  autoMovieRenderDigest,
  compareAutoMovieRenderIds,
  deriveAutoMovieSemanticMask,
  evaluateAutoMovieRenderBudget,
  measureAutoMovieRenderInventory,
  sealAutoMovieRenderTarget,
} from "@automovie/engine";
import {
  AutoMovieContentDigest,
  IAutoMovieCompiledShotSource,
  IAutoMovieRenderBudget,
  IAutoMovieRenderInventory,
  IAutoMovieRenderReport,
  IAutoMovieRenderTarget,
  IAutoMovieRenderTargetAsset,
  IAutoMovieRenderTargetRenderer,
  IAutoMovieRenderTargetSettings,
  IAutoMovieSemanticMask,
} from "@automovie/interface";

/**
 * What a capture host reports about the graphics context it drew through.
 *
 * The shape a Playwright/WebGL probe answers with, not a renderer identity:
 * `renderer` is WebGL's own spelling of the device string, and the render
 * target calls the same field `device`. Naming both here is what keeps the
 * translation in one place instead of at every call site.
 */
export interface IAutoMovieRenderGraphicsIdentity {
  /** Graphics API family the context reported, such as `webgl2`. */
  api: string;

  /** `UNMASKED_VENDOR_WEBGL`, or the plain `VENDOR` when it is masked. */
  vendor: string;

  /** `UNMASKED_RENDERER_WEBGL`, or the plain `RENDERER` when it is masked. */
  renderer: string;
}

/**
 * Read a capture host's graphics probe as a render-target renderer identity, or
 * `null` when no probe ran.
 *
 * `null` is the whole point of the return type. A render job that could not ask
 * the browser what it is drawing with has not measured its target, and a
 * fabricated `"unknown/unknown/unknown"` identity would fingerprint every such
 * host identically, so two different GPUs would produce one digest and a stale
 * report would read as fresh. A host that answered but withheld a field is a
 * different case and keeps the `unknown` the target contract documents.
 *
 * @author Samchon
 */
export const autoMovieRenderTargetRendererOfGraphics = (
  graphics: IAutoMovieRenderGraphicsIdentity | null | undefined,
): IAutoMovieRenderTargetRenderer | null =>
  graphics === null || graphics === undefined
    ? null
    : {
        api: blankAs(graphics.api, "unknown"),
        vendor: blankAs(graphics.vendor, "unknown"),
        device: blankAs(graphics.renderer, "unknown"),
      };

const blankAs = (value: string, fallback: string): string =>
  value.trim().length === 0 ? fallback : value;

/**
 * The renderer settings one compiled shot is drawn under.
 *
 * Precedence is the viewer's, restated nowhere: a scene that declares an
 * `environment` owns the curve, the exposure and the shadow policy of its own
 * beauty pass, and a scene that declares none keeps the delivery's tone mapping
 * at the renderer's untouched exposure with no shadow map. Deriving it here
 * rather than guessing is what makes the sealed target the settings a frame was
 * actually drawn with; a target that claimed shadows a scene switched off would
 * price a cost nobody pays and call a fresh report stale.
 *
 * `shadowType` is `none` exactly when shadows are off, which is the render
 * target's own invariant: an environment naming a filter family it never
 * renders states what it WOULD use, and recording that as the drawn setting
 * would be a claim about a map that does not exist.
 *
 * @author Samchon
 */
export const autoMovieRenderTargetSettingsOfShot = (props: {
  /** Fully compiler-owned shot artifact. */
  compiled: IAutoMovieCompiledShotSource;
  /** Drawing-buffer width in pixels. */
  width: number;
  /** Drawing-buffer height in pixels. */
  height: number;
  /** Device pixel ratio the capture host pins. */
  pixelRatio: number;
  /** The delivery's own tone mapping, for a scene that declares none. */
  delivery: IAutoMovieRenderTargetSettings["toneMapping"];
}): IAutoMovieRenderTargetSettings => {
  const environment = props.compiled.scene.environment ?? null;
  const shadows =
    environment !== null && environment.shadows.enabled
      ? environment.shadows
      : null;
  return {
    width: props.width,
    height: props.height,
    pixelRatio: props.pixelRatio,
    shadows: shadows !== null,
    shadowType: shadows === null ? "none" : shadows.type,
    toneMapping: environment?.toneMapping ?? props.delivery,
    exposure: environment?.exposure ?? 1,
  };
};

/**
 * Read a compiled shot as the complete drawable world one frame commits to.
 *
 * `autoMovieRenderSubjectOfShot` deliberately leaves the simulated drawables to
 * its caller, because the engine cannot know whether a domain a shot declares
 * is one the production actually hangs, floods or plants. A compiled shot does
 * know: it carries the domains beside the bindings that place them, and this is
 * the one conversion that reads both. Doing it anywhere else would leave a
 * render report that cleared a room the curtain, the pond and the fern bed are
 * missing from.
 *
 * Every declared domain becomes one drawable, bound or not. A fluid domain with
 * no water feature is still a solved free surface somebody staged, so pricing
 * only the bound ones would make an unowned pond free; what the binding adds is
 * the owning space, which is what lets a cost in the report and a colour in the
 * mask name the same room.
 *
 * Branch and leaf prototype costs are `null` on purpose. The solid a renderer
 * sweeps along a branch is the renderer's choice and is in no compiled record,
 * so the geometry metrics report `not-run` rather than approve a triangle count
 * this repository invented.
 *
 * @author Samchon
 */
export const autoMovieRenderSubjectOfCompiledShot = (props: {
  /** Fully compiler-owned shot artifact. */
  compiled: IAutoMovieCompiledShotSource;
  /** Known texture dimensions, if the caller resolved the assets. */
  textures?: readonly IAutoMovieRenderTextureSource[];
}): IAutoMovieRenderSubject => {
  const { compiled } = props;
  const waterOwner = binding(
    compiled.waterFeatures ?? [],
    (feature) => feature.domain,
  );
  const softOwner = binding(
    compiled.softFurnishings ?? [],
    (furnishing) => furnishing.domain,
  );
  const plantingOwner = binding(
    compiled.plantingInstallations ?? [],
    (installation) => installation.cluster,
  );
  const recipes = new Map(
    (compiled.plantingDomains ?? []).map((domain) => [domain.id, domain]),
  );

  const waterBodies: IAutoMovieRenderWaterBody[] = (
    compiled.fluidDomains ?? []
  ).map((domain) => {
    const feature = waterOwner.get(domain.id);
    return {
      id: domain.id,
      owner: space(feature),
      // The bound domain draws its own free surface, which the mask joins by
      // the viewer's name for it. Naming a scene node here as well would bill
      // the same water twice.
      nodes: [],
      domain,
      cells: null,
      particles: null,
      material: feature?.material ?? null,
    };
  });
  const softBodies: IAutoMovieRenderSoftPanel[] = (
    compiled.softBodyDomains ?? []
  ).map((domain) => {
    const furnishing = softOwner.get(domain.id);
    return {
      domain,
      owner: space(furnishing),
      material: furnishing?.material ?? null,
    };
  });
  const plantings: IAutoMovieRenderPlanting[] = (
    compiled.plantingClusters ?? []
  ).map((cluster) => {
    const domain = recipes.get(cluster.domain);
    if (domain === undefined)
      throw new Error(
        `render subject cannot stage planting cluster "${cluster.id}": recipe "${cluster.domain}" is absent from the compiled shot`,
      );
    const installation = plantingOwner.get(cluster.id);
    return {
      domain,
      cluster,
      owner: space(installation),
      branchMaterial: installation?.branchMaterial ?? null,
      leafMaterial: installation?.leafMaterial ?? null,
      branch: null,
      leaf: null,
    };
  });
  return {
    scene: compiled.scene,
    models: compiled.models,
    environments: compiled.builtEnvironments ?? [],
    instanceSets: compiled.instanceSets,
    waterBodies,
    softBodies,
    plantings,
    textures: props.textures ?? [],
  };
};

/**
 * Index one binding list by the drawable it places, keeping the smallest id.
 *
 * Two bindings naming one drawable is an authoring contradiction the compiler
 * refuses, but the subject still has to be a function of the design rather than
 * of array order, or two runs of the same shot would attribute one pond to two
 * rooms and produce two report digests.
 */
const binding = <Entry extends { id: string }>(
  entries: readonly Entry[],
  drawable: (entry: Entry) => string,
): Map<string, Entry> => {
  const index = new Map<string, Entry>();
  for (const entry of [...entries].sort((left, right) =>
    compareAutoMovieRenderIds(left.id, right.id),
  ))
    if (!index.has(drawable(entry))) index.set(drawable(entry), entry);
  return index;
};

/**
 * The semantic id of the space a binding names, or `null` when nothing bound
 * the drawable. It is the mask's own spelling, which is what lets a cost in the
 * report and a colour in the mask resolve to one room.
 */
const space = (
  bound: { environment: string; space: string } | undefined,
): string | null =>
  bound === undefined ? null : `space:${bound.environment}/${bound.space}`;

/**
 * Select the budget a render job targets, or `null` when the production
 * declared none for this tier.
 *
 * Ties resolve to the first declaration so the verdict never depends on which
 * of two identical tiers a reader happens to look at. `null` is not a pass: it
 * makes every metric `unbudgeted`, and a job that treated that as a clearance
 * would be reporting that nobody's limits were met.
 *
 * @author Samchon
 */
export const selectAutoMovieRenderBudget = (
  budgets: readonly IAutoMovieRenderBudget[] | undefined,
  tier: string,
): IAutoMovieRenderBudget | null =>
  (budgets ?? []).find((budget) => budget.tier === tier) ?? null;

/** One shot's measured cost, checked against the budget the job targets. */
export interface IAutoMovieRenderBudgetAssessment {
  /** Compiled shot the measurement belongs to. */
  shot: string;

  /**
   * The verdict, including the two that are not a pass.
   *
   * `not-run` is this record's own: the report's `incomplete` says an analysis
   * had no input, and `not-run` says no report exists at all because the job
   * never learned what it draws with.
   */
  status: IAutoMovieRenderReport["status"] | "not-run";

  /** Why no report exists, or `null` when one does. */
  reason: string | null;

  /** The bounded verdict, or `null` when the assessment did not run. */
  report: IAutoMovieRenderReport | null;

  /** The measured cost, or `null` when the assessment did not run. */
  inventory: IAutoMovieRenderInventory | null;

  /** The palette the report's owners resolve in, or `null` as above. */
  mask: IAutoMovieSemanticMask | null;

  /** The sealed target, or `null` when the renderer was never identified. */
  target: IAutoMovieRenderTarget | null;
}

/**
 * Measure one compiled shot and check it against the budget a render job
 * targets.
 *
 * The whole chain in one place, because every link has to read the same
 * artifact: the subject feeds both the mask and the inventory, so a colour in
 * the mask and a cost in the report name one owner, and the sealed target binds
 * the verdict to the renderer that produced it.
 *
 * A job with no renderer identity produces `not-run` and says so. That is the
 * honest outcome and the only safe one: a budget verdict is a claim about a
 * specific renderer drawing specific bytes, so a report measured against an
 * invented target would be a stale report nothing could detect.
 *
 * @author Samchon
 */
export const assessAutoMovieRenderBudget = (props: {
  /** Fully compiler-owned shot artifact. */
  compiled: IAutoMovieCompiledShotSource;
  /** Shot id the artifact belongs to. */
  shot: string;
  /** Limits the job targets, or `null` for a production declaring none. */
  budget: IAutoMovieRenderBudget | null;
  /** Renderer identity, or `null` when the host reported none. */
  renderer: IAutoMovieRenderTargetRenderer | null;
  /** Settings the frame is drawn under. */
  settings: IAutoMovieRenderTargetSettings;
  /** Bytes the drawn frame depends on. */
  assets: readonly IAutoMovieRenderTargetAsset[];
  /** Known texture dimensions, if the caller resolved the assets. */
  textures?: readonly IAutoMovieRenderTextureSource[];
}): IAutoMovieRenderBudgetAssessment => {
  if (props.renderer === null)
    return {
      shot: props.shot,
      status: "not-run",
      reason:
        "the capture host reported no graphics identity, so no render target could be sealed and no budget verdict is attributable to a renderer",
      report: null,
      inventory: null,
      mask: null,
      target: null,
    };
  const subject = autoMovieRenderSubjectOfCompiledShot({
    compiled: props.compiled,
    textures: props.textures,
  });
  const mask = deriveAutoMovieSemanticMask(subject);
  const inventory = measureAutoMovieRenderInventory({ subject, mask });
  const target = sealAutoMovieRenderTarget({
    renderer: props.renderer,
    settings: props.settings,
    assets: props.assets,
  });
  const report = evaluateAutoMovieRenderBudget({
    inventory,
    budget: props.budget,
    mask,
    target,
  });
  return {
    shot: props.shot,
    status: report.status,
    reason: null,
    report,
    inventory,
    mask,
    target,
  };
};

/** One render job's budget evidence over every shot it draws. */
export interface IAutoMovieRenderBudgetEvidence {
  /** Evidence format. */
  version: 1;

  /** Versioned evidence protocol. */
  protocol: "automovie.render-budget-evidence.v1";

  /** Quality tier the job targeted. */
  tier: string;

  /**
   * Every tier the production declared, ascending.
   *
   * A job that found no budget for its own tier reads as `unbudgeted`, and this
   * is what tells a mistyped tier apart from a production that deliberately
   * declares none.
   */
  declaredTiers: string[];

  /** Whether a budget was found for {@link tier}. */
  budgeted: boolean;

  /**
   * The worst outcome any shot produced.
   *
   * `over` beats `not-run`, which beats `incomplete`, which beats `within`. A
   * job refuses on `over` and reports the other two as what they are, because
   * an unmeasured cost has not been cleared and saying otherwise is the exact
   * false capability claim this evidence exists to prevent.
   */
  status: IAutoMovieRenderBudgetAssessment["status"];

  /** One assessment per shot, ascending by shot id. */
  shots: IAutoMovieRenderBudgetAssessment[];

  /** Digest over the protocol, the tier, and every shot's own verdict. */
  digest: AutoMovieContentDigest;
}

const STATUS_ORDER: Readonly<
  Record<IAutoMovieRenderBudgetAssessment["status"], number>
> = { within: 0, incomplete: 1, "not-run": 2, over: 3 };

/**
 * Fold one job's assessments into the evidence document it publishes.
 *
 * The digest covers the verdicts rather than the whole inventory, so
 * republishing the same evidence for an unchanged production lands on the same
 * content address and an immutable evidence store never fights itself.
 *
 * @author Samchon
 */
export const autoMovieRenderBudgetEvidence = (props: {
  /** Quality tier the job targeted. */
  tier: string;
  /** Budgets the production declares. */
  budgets: readonly IAutoMovieRenderBudget[] | undefined;
  /** One assessment per shot; order is normalized here. */
  assessments: readonly IAutoMovieRenderBudgetAssessment[];
}): IAutoMovieRenderBudgetEvidence => {
  const shots = [...props.assessments].sort((left, right) =>
    compareAutoMovieRenderIds(left.shot, right.shot),
  );
  const status = shots.reduce<IAutoMovieRenderBudgetAssessment["status"]>(
    (worst, shot) =>
      STATUS_ORDER[shot.status] > STATUS_ORDER[worst] ? shot.status : worst,
    "within",
  );
  const declaredTiers = [
    ...new Set((props.budgets ?? []).map((budget) => budget.tier)),
  ].sort(compareAutoMovieRenderIds);
  return {
    version: 1,
    protocol: "automovie.render-budget-evidence.v1",
    tier: props.tier,
    declaredTiers,
    budgeted: selectAutoMovieRenderBudget(props.budgets, props.tier) !== null,
    status,
    shots,
    digest: autoMovieRenderDigest(
      [
        "automovie.render-budget-evidence.v1",
        props.tier,
        declaredTiers.join(","),
        status,
        ...shots.map((shot) =>
          [
            shot.shot,
            shot.status,
            shot.report?.digest ?? "no-report",
            shot.target?.digest ?? "no-target",
          ].join("|"),
        ),
      ].join("\n"),
    ),
  };
};

/**
 * The refusal a render job raises for over-budget evidence, or `null` when
 * nothing is over.
 *
 * Only `over` refuses. `incomplete` and `not-run` are reported and never
 * disguised as a pass, but they are not a proof that anything exceeded a limit,
 * and refusing a render for an unmeasured metric would make the honest report
 * the one nobody dares emit.
 *
 * @author Samchon
 */
export const autoMovieRenderBudgetRefusal = (
  evidence: IAutoMovieRenderBudgetEvidence,
): string | null => {
  const over = evidence.shots.filter((shot) => shot.status === "over");
  if (over.length === 0) return null;
  return `Render tier "${evidence.tier}" is over budget in ${over.length} shot(s): ${over
    .map((shot) => {
      // A verdict carries the findings that produced it. One that does not is
      // a caller-built record, and the refusal still has to name the shot: a
      // message that quietly dropped it would leave an over-budget render with
      // nothing to act on.
      const recoveries = (shot.report?.findings ?? [])
        .filter((finding) => finding.status === "over")
        .map((finding) => finding.recovery);
      return `${shot.shot}: ${
        recoveries.length === 0
          ? "the assessment recorded no over-limit finding to recover from"
          : recoveries.join("; ")
      }`;
    })
    .join(" | ")}`;
};
