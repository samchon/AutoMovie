import type {
  AutoMovieContentDigest,
  IAutoMovieRepaintExecutionPolicy,
  IAutoMovieRepaintReceipt,
} from "@automovie/interface";
import {
  AutoMovieProductionContext,
  AutoMovieProductionRepaintService,
  AutoMovieRepaintAttemptError,
  type IAutoMovieProductionServices,
  canonicalAutoMovieRepaintRuntimeIdentity,
  executeAutoMovieRepaintRequest,
} from "@automovie/production";
import { TestValidator } from "@nestia/e2e";

const digest = (value: string): AutoMovieContentDigest =>
  `sha256:${Buffer.from(value).toString("hex").padEnd(64, "0").slice(0, 64)}`;

const nonError = (message: string): Error => message as unknown as Error;

const selection = {
  productionId: "boundary-production",
  shot: "opening",
  attemptId: "20000000-0000-4000-8000-000000000001",
  kind: "selection" as const,
  reason: "The reviewed rendition preserves the authored staging.",
  structuralReview: "Depth and mask controls preserve the source geometry.",
  continuityReview: null,
};

const contextWith = (
  forProduction: (productionId: string) => IAutoMovieProductionServices,
): AutoMovieProductionContext =>
  ({ forProduction }) as unknown as AutoMovieProductionContext;

const diagnosticCode = (
  result: ReturnType<AutoMovieProductionRepaintService["select"]>,
): string | undefined => result.diagnostics[0]?.code;

/**
 * Public repaint boundaries contain hostile input, lookup, and observer code.
 *
 * Scenarios:
 *
 * 1. Selection validation rejects non-objects, hidden fields, and hostile or
 *    unclonable proxies before consulting the production context.
 * 2. Registered-project lookup and selection failures remain structured
 *    repaint diagnostics, while a valid selection preserves its receipt.
 * 3. A throwing attempt observer stops successful, failed, and over-budget
 *    provider outcomes with exactly one immutable terminal attempt.
 */
export const test_production_repaint_public_boundary_containment =
  async (): Promise<void> => {
    const service = new AutoMovieProductionRepaintService();
    let lookups = 0;
    const forbiddenContext = contextWith(() => {
      ++lookups;
      throw new Error("selection validation performed a project lookup");
    });
    const hostileInput = new Proxy(selection, {
      get: (_target, key, receiver) => {
        if (key === "productionId") throw new Error("hostile production id");
        return Reflect.get(selection, key, receiver);
      },
    });
    const unclonableInput = new Proxy(selection, {});
    const invalidResults = [
      service.select(forbiddenContext, null as never),
      service.select(forbiddenContext, { ...selection, hidden: true } as never),
      service.select(forbiddenContext, hostileInput),
      service.select(forbiddenContext, unclonableInput),
    ];
    TestValidator.equals(
      "invalid and hostile selection inputs fail before project lookup",
      {
        codes: invalidResults.map(diagnosticCode),
        identities: invalidResults.map((result) => ({
          productionId: result.productionId,
          shot: result.shot,
        })),
        lookups,
      },
      {
        codes: Array.from({ length: 4 }, () => "repaint-input-invalid"),
        identities: [
          { productionId: "", shot: "" },
          { productionId: "boundary-production", shot: "opening" },
          { productionId: "", shot: "opening" },
          { productionId: "boundary-production", shot: "opening" },
        ],
        lookups: 0,
      },
    );

    const unregistered = [
      service.select(
        contextWith(() => {
          throw new Error("production is not registered");
        }),
        selection,
      ),
      service.select(
        contextWith(() => {
          throw nonError("non-error production lookup");
        }),
        selection,
      ),
    ];
    TestValidator.equals(
      "unregistered production lookups remain structured diagnostics",
      unregistered.map((result) => ({
        code: diagnosticCode(result),
        productionId: result.productionId,
        shot: result.shot,
      })),
      Array.from({ length: 2 }, () => ({
        code: "repaint-production-unregistered",
        productionId: selection.productionId,
        shot: selection.shot,
      })),
    );

    const receipt = {
      requestId: "10000000-0000-4000-8000-000000000001",
    } as unknown as IAutoMovieRepaintReceipt;
    const selected = service.select(
      contextWith(
        () =>
          ({
            project: {
              selectRepaintCandidate: () => receipt,
            },
          }) as unknown as IAutoMovieProductionServices,
      ),
      selection,
    );
    const commitFailures = [
      service.select(
        contextWith(
          () =>
            ({
              project: {
                selectRepaintCandidate: () => {
                  throw new Error("selection commit refused");
                },
              },
            }) as unknown as IAutoMovieProductionServices,
        ),
        selection,
      ),
      new AutoMovieProductionRepaintService(undefined, undefined, {
        policy: executionPolicy(),
        evidence: {
          prompt: "prompt.md#repaint",
          continuity: null,
          settings: "settings/world.md#appearance",
          design: "design/characters.md#lead",
          screenplayOrBrief: "screenplays/final.md#opening",
          shot: "shots/opening.ts#shot",
        },
        now: () => {
          throw new Error("selection clock unavailable");
        },
      }).select(
        contextWith(
          () =>
            ({
              project: {
                selectRepaintCandidate: () => receipt,
              },
            }) as unknown as IAutoMovieProductionServices,
        ),
        selection,
      ),
    ];
    TestValidator.equals(
      "selection success and commit failures retain their public result contract",
      {
        selected: {
          selected: selected.selected,
          requestId: selected.requestId,
          receipt: selected.receipt === receipt,
        },
        failures: commitFailures.map(diagnosticCode),
      },
      {
        selected: {
          selected: true,
          requestId: "10000000-0000-4000-8000-000000000001",
          receipt: true,
        },
        failures: ["repaint-commit-refused", "repaint-commit-refused"],
      },
    );

    const adapterIdentity = canonicalAutoMovieRepaintRuntimeIdentity({
      protocolVersion: "automovie.repaint-runtime.v1",
      provider: "boundary-provider",
      model: "boundary-model",
      version: "1",
      execution: "local",
    });
    const execute = async (props: {
      maximumCostUnits: number;
      outcome: () => Promise<{
        value: string;
        costUnits: number;
        availableOutput: {
          digest: AutoMovieContentDigest;
          bytes: number;
        } | null;
      }>;
    }) =>
      executeAutoMovieRepaintRequest({
        productionId: selection.productionId,
        shot: selection.shot,
        requestId: "10000000-0000-4000-8000-000000000001",
        requestFingerprint: digest("request"),
        compileFingerprint: digest("compile"),
        sourceRenderFingerprint: digest("source"),
        adapterIdentity,
        seed: 17,
        policy: executionPolicy({ maximumCostUnits: props.maximumCostUnits }),
        runtime: {
          now: () => new Date("2026-08-28T10:00:00.000Z"),
          attemptId: () => "20000000-0000-4000-8000-000000000001",
          wait: async () => undefined,
        },
        execute: props.outcome,
        onAttempt: () => {
          throw new Error("attempt observer unavailable");
        },
      });
    const observed = await Promise.all([
      execute({
        maximumCostUnits: 5,
        outcome: async () => ({
          value: "accepted",
          costUnits: 1,
          availableOutput: { digest: digest("accepted"), bytes: 8 },
        }),
      }),
      execute({
        maximumCostUnits: 5,
        outcome: async () => {
          throw new AutoMovieRepaintAttemptError(
            "provider-refusal",
            "provider declined the request",
            1,
          );
        },
      }),
      execute({
        maximumCostUnits: 0.5,
        outcome: async () => ({
          value: "over-budget",
          costUnits: 1,
          availableOutput: { digest: digest("over-budget"), bytes: 9 },
        }),
      }),
    ]);
    TestValidator.equals(
      "throwing observers preserve one terminal record and never accept",
      observed.map((result) => ({
        stop: result.stop,
        accepted: result.accepted,
        attempts: result.attempts.length,
        status: result.attempts[0]?.status,
        failure: result.attempts[0]?.failure?.class ?? null,
        costUnits: result.attempts[0]?.costUnits,
      })),
      [
        {
          stop: "observer-failed",
          accepted: null,
          attempts: 1,
          status: "succeeded",
          failure: null,
          costUnits: 1,
        },
        {
          stop: "observer-failed",
          accepted: null,
          attempts: 1,
          status: "failed",
          failure: "provider-refusal",
          costUnits: 1,
        },
        {
          stop: "observer-failed",
          accepted: null,
          attempts: 1,
          status: "failed",
          failure: "budget-exhausted",
          costUnits: 1,
        },
      ],
    );
  };

const executionPolicy = (
  override: Partial<IAutoMovieRepaintExecutionPolicy> = {},
): IAutoMovieRepaintExecutionPolicy => ({
  maximumAttempts: 1,
  attemptTimeoutMs: 1_000,
  maximumElapsedMs: 10_000,
  maximumCostUnits: 5,
  backoffMs: [],
  retryableFailures: ["timeout", "rate-limit", "transport"],
  ...override,
});
