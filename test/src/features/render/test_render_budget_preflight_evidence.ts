import {
  IAutoMovieRenderBudgetAssessment,
  assessAutoMovieRenderBudget,
  autoMovieRenderBudgetEvidence,
  autoMovieRenderBudgetRefusal,
  autoMovieRenderTargetRendererOfGraphics,
  autoMovieRenderTargetSettingsOfShot,
  selectAutoMovieRenderBudget,
} from "@automovie/render";
import { TestValidator } from "@nestia/e2e";

import {
  GRAPHICS_FIXTURE,
  RENDER_BUDGET_ASSETS,
  compiledShotFixture,
  renderBudgetFixture,
} from "../internal/renderBudgetFixtures";
import { BOX_TRIANGLES } from "../internal/renderFixtures";

/**
 * The render job publishes one verdict per tier, and never dresses an
 * unmeasured cost as a cleared one.
 *
 * The evidence exists to be acted on: a job refuses on `over` and publishes
 * `incomplete` and `not-run` exactly as they are. Getting that precedence wrong
 * in either direction is a real failure — a job that refused on `incomplete`
 * would make the honest report the one nobody dares emit, and a job that passed
 * on it would clear a cost nobody measured.
 *
 * Scenarios:
 *
 * 1. A job selects the budget of the tier it targets, ignores the others, and
 *    resolves a duplicated tier to its first declaration.
 * 2. A production declaring no budget at all, and one declaring budgets for other
 *    tiers only, both report `unbudgeted` with the declared tiers named.
 * 3. Five staged boxes measured against a triangle limit they fit inside clear the
 *    tier; the same shot one triangle under its own cost goes `over` and names
 *    the owner to edit.
 * 4. Withholding the texture dimensions of a bound asset makes the tier
 *    `incomplete`, and `incomplete` does not refuse the render.
 * 5. The worst outcome wins: `over` beats `not-run` beats `incomplete` beats
 *    `within`, whichever order the shots arrive in, and a document over no
 *    shots at all is `not-run` rather than a verdict over an empty set.
 * 6. The evidence digest is a property of the verdicts, not of shot order, and
 *    changes when a verdict does.
 * 7. An over verdict carrying no finding still refuses and still names the shot,
 *    rather than dropping the only thing an operator could act on.
 */
export const test_render_budget_preflight_evidence = (): void => {
  const review = renderBudgetFixture({
    tier: "review",
    limits: { triangles: 1_000 },
  });
  const delivery = renderBudgetFixture({
    tier: "delivery",
    limits: { triangles: 10 },
  });
  const shadow = renderBudgetFixture({
    tier: "review",
    limits: { triangles: 1 },
  });
  TestValidator.equals(
    "a job targets its own tier and resolves a duplicate to the first",
    {
      review: selectAutoMovieRenderBudget([review, delivery], "review")?.limits,
      delivery: selectAutoMovieRenderBudget([review, delivery], "delivery")
        ?.limits,
      absent: selectAutoMovieRenderBudget([review, delivery], "proxy"),
      undeclared: selectAutoMovieRenderBudget(undefined, "review"),
      duplicated: selectAutoMovieRenderBudget([review, shadow], "review")
        ?.limits,
    },
    {
      review: { triangles: 1_000 },
      delivery: { triangles: 10 },
      absent: null,
      undeclared: null,
      duplicated: { triangles: 1_000 },
    },
  );

  const assess = (props: {
    budget: Parameters<typeof assessAutoMovieRenderBudget>[0]["budget"];
    shot?: string;
    textures?: boolean;
  }): IAutoMovieRenderBudgetAssessment => {
    const compiled = compiledShotFixture();
    return assessAutoMovieRenderBudget({
      compiled,
      shot: props.shot ?? "opening",
      budget: props.budget,
      renderer: autoMovieRenderTargetRendererOfGraphics(GRAPHICS_FIXTURE),
      settings: autoMovieRenderTargetSettingsOfShot({
        compiled,
        width: 1280,
        height: 720,
        pixelRatio: 1,
        delivery: "none",
      }),
      assets: RENDER_BUDGET_ASSETS,
      textures: props.textures
        ? [
            {
              asset: "textures/stone.png",
              width: 512,
              height: 512,
              mipmapped: true,
            },
          ]
        : undefined,
    });
  };

  // Five staged boxes of twelve triangles each; the tight twin is one triangle
  // under that, which is the smallest input that must fail.
  const staged = 5 * BOX_TRIANGLES;
  const cleared = assess({
    budget: renderBudgetFixture({
      tier: "review",
      limits: { triangles: staged },
    }),
    textures: true,
  });
  const exceeded = assess({
    budget: renderBudgetFixture({
      tier: "review",
      limits: { triangles: staged - 1 },
    }),
    textures: true,
  });
  const triangles = (assessment: IAutoMovieRenderBudgetAssessment) =>
    assessment.report!.findings.find(
      (finding) => finding.metric === "triangles",
    )!;
  TestValidator.equals(
    "a limit the shot fits inside clears it, and one triangle less does not",
    {
      cleared: {
        status: cleared.status,
        finding: triangles(cleared).status,
        measured: triangles(cleared).measured,
        excess: triangles(cleared).excess,
      },
      exceeded: {
        status: exceeded.status,
        finding: triangles(exceeded).status,
        measured: triangles(exceeded).measured,
        excess: triangles(exceeded).excess,
        owner: triangles(exceeded).contributors[0]?.owner,
      },
    },
    {
      cleared: {
        status: "within",
        finding: "within",
        measured: staged,
        excess: 0,
      },
      exceeded: {
        status: "over",
        finding: "over",
        measured: staged,
        excess: 1,
        owner: "node:lantern",
      },
    },
  );

  const unmeasured = assess({
    budget: renderBudgetFixture({
      tier: "review",
      limits: { triangles: staged },
    }),
  });
  TestValidator.equals(
    "an unmeasured texture cost is `incomplete`, and `incomplete` does not refuse",
    {
      status: unmeasured.status,
      textureBytes: unmeasured.report!.findings.find(
        (finding) => finding.metric === "textureBytes",
      )!.status,
      refusal: autoMovieRenderBudgetRefusal(
        autoMovieRenderBudgetEvidence({
          tier: "review",
          budgets: [review],
          assessments: [unmeasured],
        }),
      ),
    },
    { status: "incomplete", textureBytes: "not-run", refusal: null },
  );

  const shot = (
    name: string,
    status: IAutoMovieRenderBudgetAssessment["status"],
  ): IAutoMovieRenderBudgetAssessment => ({
    ...(status === "not-run"
      ? { ...cleared, report: null, target: null }
      : cleared),
    shot: name,
    status,
    reason: status === "not-run" ? "no graphics identity" : null,
  });
  const worst = (
    statuses: readonly IAutoMovieRenderBudgetAssessment["status"][],
  ) =>
    autoMovieRenderBudgetEvidence({
      tier: "review",
      budgets: [review, delivery],
      assessments: statuses.map((status, index) =>
        shot(`shot-${index}`, status),
      ),
    }).status;
  TestValidator.equals(
    "the worst outcome any shot produced is the tier's outcome",
    {
      clean: worst(["within", "within"]),
      incomplete: worst(["within", "incomplete"]),
      unrun: worst(["incomplete", "not-run"]),
      over: worst(["not-run", "over", "within"]),
      reversed: worst(["over", "not-run"]),
      empty: worst([]),
    },
    {
      clean: "within",
      incomplete: "incomplete",
      unrun: "not-run",
      over: "over",
      reversed: "over",
      // A document over no shots measured nothing, and a verdict over an empty
      // set is the cheapest way a report ends up clearing what it never read.
      empty: "not-run",
    },
  );

  const evidence = (order: readonly IAutoMovieRenderBudgetAssessment[]) =>
    autoMovieRenderBudgetEvidence({
      tier: "review",
      budgets: [review, delivery, shadow],
      assessments: order,
    });
  const declared = evidence([shot("b", "within"), shot("a", "within")]);
  const reversed = evidence([shot("a", "within"), shot("b", "within")]);
  const changed = evidence([shot("b", "within"), shot("a", "not-run")]);
  TestValidator.equals(
    "the digest is a property of the verdicts, never of shot order",
    {
      stable: declared.digest === reversed.digest,
      changes: declared.digest !== changed.digest,
      ordered: declared.shots.map((entry) => entry.shot),
      tiers: declared.declaredTiers,
      budgeted: declared.budgeted,
      protocol: declared.protocol,
      version: declared.version,
    },
    {
      stable: true,
      changes: true,
      ordered: ["a", "b"],
      tiers: ["delivery", "review"],
      budgeted: true,
      protocol: "automovie.render-budget-evidence.v1",
      version: 1,
    },
  );

  const unbudgeted = autoMovieRenderBudgetEvidence({
    tier: "review",
    budgets: [delivery],
    assessments: [assess({ budget: null, textures: true })],
  });
  const undeclared = autoMovieRenderBudgetEvidence({
    tier: "review",
    budgets: undefined,
    assessments: [assess({ budget: null, textures: true })],
  });
  TestValidator.equals(
    "a tier nobody budgeted is reported as such, with the declared tiers named",
    {
      budgeted: unbudgeted.budgeted,
      tiers: unbudgeted.declaredTiers,
      tier: unbudgeted.shots[0]!.report!.tier,
      triangles: unbudgeted.shots[0]!.report!.findings.find(
        (finding) => finding.metric === "triangles",
      )!.status,
      status: unbudgeted.status,
      // A production that declared nothing at all is not the same record as one
      // that budgeted other tiers, and the evidence has to tell them apart.
      undeclaredTiers: undeclared.declaredTiers,
      undeclaredBudgeted: undeclared.budgeted,
    },
    {
      budgeted: false,
      tiers: ["delivery"],
      tier: "unbudgeted",
      triangles: "unbudgeted",
      status: "within",
      undeclaredTiers: [],
      undeclaredBudgeted: false,
    },
  );

  const refusal = autoMovieRenderBudgetRefusal(
    autoMovieRenderBudgetEvidence({
      tier: "review",
      budgets: [review],
      assessments: [exceeded],
    }),
  );
  TestValidator.equals(
    "an over-budget tier refuses and names the shot, the excess and the owner",
    {
      refused: refusal !== null,
      shot: refusal?.includes("opening"),
      tier: refusal?.includes('Render tier "review"'),
      owner: refusal?.includes('the largest owner is "node:lantern"'),
      excess: refusal?.includes(`${staged} against a limit of ${staged - 1}`),
    },
    { refused: true, shot: true, tier: true, owner: true, excess: true },
  );

  const findingless = autoMovieRenderBudgetRefusal(
    autoMovieRenderBudgetEvidence({
      tier: "review",
      budgets: [review],
      assessments: [{ ...shot("silent", "over"), report: null }],
    }),
  );
  TestValidator.equals(
    "an over verdict carrying no finding still names the shot it refuses for",
    {
      refused: findingless !== null,
      shot: findingless?.includes("silent"),
      recovery: findingless?.includes("recorded no over-limit finding"),
    },
    { refused: true, shot: true, recovery: true },
  );
};
