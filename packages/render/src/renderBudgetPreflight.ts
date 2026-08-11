import {
  IAutoMovieRenderTextureSource,
  autoMovieRenderDigest,
  autoMovieRenderSubjectOfCompiledShot,
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
 *
 * @evidence requirements/rendering/budgets.md#rendering-budget-decision `IAutoMovieRenderGraphicsIdentity` carries the conservative measurement basis and deterministic budget decision.
 * @evidence specifications/editorial-render-and-delivery/render-budget-identity-and-recovery.md#spec-render-budget-preflight `IAutoMovieRenderGraphicsIdentity` exposes that responsibility through the package-independent system contract.
 * @author Samchon
 */
export interface IAutoMovieRenderGraphicsIdentity {
  /**
   * Graphics API family the context reported, such as `webgl2`.
   *
   * @evidence requirements/rendering/budgets.md#rendering-budget-decision `IAutoMovieRenderGraphicsIdentity.api` carries the conservative measurement basis and deterministic budget decision.
   * @evidence specifications/editorial-render-and-delivery/render-budget-identity-and-recovery.md#spec-render-budget-preflight `IAutoMovieRenderGraphicsIdentity.api` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
  api: string;

  /**
   * `UNMASKED_VENDOR_WEBGL`, or the plain `VENDOR` when it is masked.
   *
   * @evidence requirements/rendering/budgets.md#rendering-budget-decision `IAutoMovieRenderGraphicsIdentity.vendor` carries the conservative measurement basis and deterministic budget decision.
   * @evidence specifications/editorial-render-and-delivery/render-budget-identity-and-recovery.md#spec-render-budget-preflight `IAutoMovieRenderGraphicsIdentity.vendor` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
  vendor: string;

  /**
   * `UNMASKED_RENDERER_WEBGL`, or the plain `RENDERER` when it is masked.
   *
   * @evidence requirements/rendering/budgets.md#rendering-budget-decision `IAutoMovieRenderGraphicsIdentity.renderer` carries the conservative measurement basis and deterministic budget decision.
   * @evidence specifications/editorial-render-and-delivery/render-budget-identity-and-recovery.md#spec-render-budget-preflight `IAutoMovieRenderGraphicsIdentity.renderer` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
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
 * @evidence requirements/rendering/budgets.md#rendering-budget-decision `autoMovieRenderTargetRendererOfGraphics` carries the conservative measurement basis and deterministic budget decision.
 * @evidence specifications/editorial-render-and-delivery/render-budget-identity-and-recovery.md#spec-render-budget-preflight `autoMovieRenderTargetRendererOfGraphics` exposes that responsibility through the package-independent system contract.
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
 * @evidence requirements/rendering/budgets.md#rendering-budget-decision `autoMovieRenderTargetSettingsOfShot` carries the conservative measurement basis and deterministic budget decision.
 * @evidence specifications/editorial-render-and-delivery/render-budget-identity-and-recovery.md#spec-render-budget-preflight `autoMovieRenderTargetSettingsOfShot` exposes that responsibility through the package-independent system contract.
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
 * Select the budget a render job targets, or `null` when the production
 * declared none for this tier.
 *
 * Ties resolve to the first declaration so the verdict never depends on which
 * of two identical tiers a reader happens to look at. `null` is not a pass: it
 * makes every metric `unbudgeted`, and a job that treated that as a clearance
 * would be reporting that nobody's limits were met.
 *
 * @evidence requirements/rendering/budgets.md#rendering-budget-decision `selectAutoMovieRenderBudget` carries the conservative measurement basis and deterministic budget decision.
 * @evidence requirements/rendering/budgets.md#rendering-budget-tiers Selects only the caller-requested purpose tier and preserves an undeclared tier as an explicit unbudgeted result.
 * @evidence specifications/editorial-render-and-delivery/render-budget-identity-and-recovery.md#spec-render-budget-preflight `selectAutoMovieRenderBudget` exposes that responsibility through the package-independent system contract.
 * @author Samchon
 */
export const selectAutoMovieRenderBudget = (
  budgets: readonly IAutoMovieRenderBudget[] | undefined,
  tier: string,
): IAutoMovieRenderBudget | null =>
  (budgets ?? []).find((budget) => budget.tier === tier) ?? null;

/**
 * One shot's measured cost, checked against the budget the job targets.
 *
 * @evidence requirements/rendering/budgets.md#rendering-budget-decision `IAutoMovieRenderBudgetAssessment` carries the conservative measurement basis and deterministic budget decision.
 * @evidence specifications/editorial-render-and-delivery/render-budget-identity-and-recovery.md#spec-render-budget-preflight `IAutoMovieRenderBudgetAssessment` exposes that responsibility through the package-independent system contract.
 * @author Samchon
 */
export interface IAutoMovieRenderBudgetAssessment {
  /**
   * Compiled shot the measurement belongs to.
   *
   * @evidence requirements/rendering/budgets.md#rendering-budget-decision `IAutoMovieRenderBudgetAssessment.shot` carries the conservative measurement basis and deterministic budget decision.
   * @evidence specifications/editorial-render-and-delivery/render-budget-identity-and-recovery.md#spec-render-budget-preflight `IAutoMovieRenderBudgetAssessment.shot` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
  shot: string;

  /**
   * The verdict, including the two that are not a pass.
   *
   * `not-run` is this record's own: the report's `incomplete` says an analysis
   * had no input, and `not-run` says no report exists at all because the job
   * never learned what it draws with.
   *
   * @evidence requirements/rendering/budgets.md#rendering-budget-decision `IAutoMovieRenderBudgetAssessment.status` carries the conservative measurement basis and deterministic budget decision.
   * @evidence specifications/editorial-render-and-delivery/render-budget-identity-and-recovery.md#spec-render-budget-preflight `IAutoMovieRenderBudgetAssessment.status` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
  status: IAutoMovieRenderReport["status"] | "not-run";

  /**
   * Why no report exists, or `null` when one does.
   *
   * @evidence requirements/rendering/budgets.md#rendering-budget-decision `IAutoMovieRenderBudgetAssessment.reason` carries the conservative measurement basis and deterministic budget decision.
   * @evidence specifications/editorial-render-and-delivery/render-budget-identity-and-recovery.md#spec-render-budget-preflight `IAutoMovieRenderBudgetAssessment.reason` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
  reason: string | null;

  /**
   * The bounded verdict, or `null` when the assessment did not run.
   *
   * @evidence requirements/rendering/budgets.md#rendering-budget-decision `IAutoMovieRenderBudgetAssessment.report` carries the conservative measurement basis and deterministic budget decision.
   * @evidence specifications/editorial-render-and-delivery/render-budget-identity-and-recovery.md#spec-render-budget-preflight `IAutoMovieRenderBudgetAssessment.report` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
  report: IAutoMovieRenderReport | null;

  /**
   * The measured cost, or `null` when the assessment did not run.
   *
   * @evidence requirements/rendering/budgets.md#rendering-budget-decision `IAutoMovieRenderBudgetAssessment.inventory` carries the conservative measurement basis and deterministic budget decision.
   * @evidence specifications/editorial-render-and-delivery/render-budget-identity-and-recovery.md#spec-render-budget-preflight `IAutoMovieRenderBudgetAssessment.inventory` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
  inventory: IAutoMovieRenderInventory | null;

  /**
   * The palette the report's owners resolve in, or `null` as above.
   *
   * @evidence requirements/rendering/budgets.md#rendering-budget-decision `IAutoMovieRenderBudgetAssessment.mask` carries the conservative measurement basis and deterministic budget decision.
   * @evidence specifications/editorial-render-and-delivery/render-budget-identity-and-recovery.md#spec-render-budget-preflight `IAutoMovieRenderBudgetAssessment.mask` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
  mask: IAutoMovieSemanticMask | null;

  /**
   * The sealed target, or `null` when the renderer was never identified.
   *
   * @evidence requirements/rendering/budgets.md#rendering-budget-decision `IAutoMovieRenderBudgetAssessment.target` carries the conservative measurement basis and deterministic budget decision.
   * @evidence specifications/editorial-render-and-delivery/render-budget-identity-and-recovery.md#spec-render-budget-preflight `IAutoMovieRenderBudgetAssessment.target` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
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
 * @evidence requirements/rendering/budgets.md#rendering-budget-decision `assessAutoMovieRenderBudget` carries the conservative measurement basis and deterministic budget decision.
 * @evidence requirements/rendering/budgets.md#rendering-geometry-memory-budget Measures the lowered render inventory, including expanded geometry and resident resource costs, before evaluating its limits.
 * @evidence requirements/rendering/budgets.md#rendering-expansion-bounds Measures the materialized subject inventory so bounded instances and procedural expansion are charged to the report.
 * @evidence specifications/editorial-render-and-delivery/render-budget-identity-and-recovery.md#spec-render-budget-preflight `assessAutoMovieRenderBudget` exposes that responsibility through the package-independent system contract.
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
  try {
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
  } catch (error) {
    // Every refusal below this line names a contradiction in the artifact -- two
    // claimants of one semantic id, a node citing a model the shot does not
    // carry, a setting that cannot be sealed -- and none of them names the shot,
    // because none of them knows it. A film of a hundred shots is where that
    // costs an hour, so the shot is added here and the original is preserved as
    // the cause rather than replaced by a summary of it.
    // `String(error)` rather than a narrowing on `Error`: everything thrown
    // below this line comes from the engine and is an `Error`, so the other arm
    // would be a branch no input can reach and no test could honestly cover.
    throw new Error(
      `render budget preflight could not measure shot "${props.shot}": ${String(error)}`,
      { cause: error },
    );
  }
};

/**
 * One render job's budget evidence over every shot it draws.
 *
 * @evidence requirements/rendering/budgets.md#rendering-budget-decision `IAutoMovieRenderBudgetEvidence` carries the conservative measurement basis and deterministic budget decision.
 * @evidence specifications/editorial-render-and-delivery/render-budget-identity-and-recovery.md#spec-render-budget-preflight `IAutoMovieRenderBudgetEvidence` exposes that responsibility through the package-independent system contract.
 * @author Samchon
 */
export interface IAutoMovieRenderBudgetEvidence {
  /**
   * Evidence format.
   *
   * @evidence requirements/rendering/budgets.md#rendering-budget-decision `IAutoMovieRenderBudgetEvidence.version` carries the conservative measurement basis and deterministic budget decision.
   * @evidence specifications/editorial-render-and-delivery/render-budget-identity-and-recovery.md#spec-render-budget-preflight `IAutoMovieRenderBudgetEvidence.version` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
  version: 1;

  /**
   * Versioned evidence protocol.
   *
   * @evidence requirements/rendering/budgets.md#rendering-budget-decision `IAutoMovieRenderBudgetEvidence.protocol` carries the conservative measurement basis and deterministic budget decision.
   * @evidence specifications/editorial-render-and-delivery/render-budget-identity-and-recovery.md#spec-render-budget-preflight `IAutoMovieRenderBudgetEvidence.protocol` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
  protocol: "automovie.render-budget-evidence.v1";

  /**
   * Quality tier the job targeted.
   *
   * @evidence requirements/rendering/budgets.md#rendering-budget-decision `IAutoMovieRenderBudgetEvidence.tier` carries the conservative measurement basis and deterministic budget decision.
   * @evidence specifications/editorial-render-and-delivery/render-budget-identity-and-recovery.md#spec-render-budget-preflight `IAutoMovieRenderBudgetEvidence.tier` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
  tier: string;

  /**
   * Every tier the production declared, ascending.
   *
   * A job that found no budget for its own tier reads as `unbudgeted`, and this
   * is what tells a mistyped tier apart from a production that deliberately
   * declares none.
   *
   * @evidence requirements/rendering/budgets.md#rendering-budget-decision `IAutoMovieRenderBudgetEvidence.declaredTiers` carries the conservative measurement basis and deterministic budget decision.
   * @evidence specifications/editorial-render-and-delivery/render-budget-identity-and-recovery.md#spec-render-budget-preflight `IAutoMovieRenderBudgetEvidence.declaredTiers` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
  declaredTiers: string[];

  /**
   * Whether a budget was found for {@link tier}.
   *
   * @evidence requirements/rendering/budgets.md#rendering-budget-decision `IAutoMovieRenderBudgetEvidence.budgeted` carries the conservative measurement basis and deterministic budget decision.
   * @evidence specifications/editorial-render-and-delivery/render-budget-identity-and-recovery.md#spec-render-budget-preflight `IAutoMovieRenderBudgetEvidence.budgeted` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
  budgeted: boolean;

  /**
   * The worst outcome any shot produced.
   *
   * `over` beats `not-run`, which beats `incomplete`, which beats `within`. A
   * job refuses on `over` and reports the other two as what they are, because
   * an unmeasured cost has not been cleared and saying otherwise is the exact
   * false capability claim this evidence exists to prevent.
   *
   * A document over no shots at all is `not-run`, never `within`: nothing was
   * measured, and a verdict over an empty set is the cheapest way a report ends
   * up clearing a production it never read.
   *
   * @evidence requirements/rendering/budgets.md#rendering-budget-decision `IAutoMovieRenderBudgetEvidence.status` carries the conservative measurement basis and deterministic budget decision.
   * @evidence specifications/editorial-render-and-delivery/render-budget-identity-and-recovery.md#spec-render-budget-preflight `IAutoMovieRenderBudgetEvidence.status` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
  status: IAutoMovieRenderBudgetAssessment["status"];

  /**
   * One assessment per shot, ascending by shot id.
   *
   * @evidence requirements/rendering/budgets.md#rendering-budget-decision `IAutoMovieRenderBudgetEvidence.shots` carries the conservative measurement basis and deterministic budget decision.
   * @evidence specifications/editorial-render-and-delivery/render-budget-identity-and-recovery.md#spec-render-budget-preflight `IAutoMovieRenderBudgetEvidence.shots` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
  shots: IAutoMovieRenderBudgetAssessment[];

  /**
   * Digest over the protocol, the tier, and every shot's own verdict.
   *
   * @evidence requirements/rendering/budgets.md#rendering-budget-decision `IAutoMovieRenderBudgetEvidence.digest` carries the conservative measurement basis and deterministic budget decision.
   * @evidence specifications/editorial-render-and-delivery/render-budget-identity-and-recovery.md#spec-render-budget-preflight `IAutoMovieRenderBudgetEvidence.digest` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
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
 * `budgets` is the production's whole declaration, read for `declaredTiers` and
 * for whether this tier was budgeted at all. The assessments must already have
 * been made against {@link selectAutoMovieRenderBudget}'s answer for the same
 * tier; hand them a different budget and `budgeted` describes the declaration
 * while every finding describes something else.
 *
 * @evidence requirements/rendering/budgets.md#rendering-budget-decision `autoMovieRenderBudgetEvidence` carries the conservative measurement basis and deterministic budget decision.
 * @evidence specifications/editorial-render-and-delivery/render-budget-identity-and-recovery.md#spec-render-budget-preflight `autoMovieRenderBudgetEvidence` exposes that responsibility through the package-independent system contract.
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
  const status =
    shots.length === 0
      ? "not-run"
      : shots.reduce<IAutoMovieRenderBudgetAssessment["status"]>(
          (worst, shot) =>
            STATUS_ORDER[shot.status] > STATUS_ORDER[worst]
              ? shot.status
              : worst,
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
 * @evidence requirements/rendering/budgets.md#rendering-budget-decision `autoMovieRenderBudgetRefusal` carries the conservative measurement basis and deterministic budget decision.
 * @evidence requirements/rendering/budgets.md#rendering-budget-refusal Names every over-limit shot and its recorded recoveries instead of silently degrading the requested render.
 * @evidence specifications/editorial-render-and-delivery/render-budget-identity-and-recovery.md#spec-render-budget-preflight `autoMovieRenderBudgetRefusal` exposes that responsibility through the package-independent system contract.
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
