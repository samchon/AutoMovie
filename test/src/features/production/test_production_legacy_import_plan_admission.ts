import { IAutoMovieLegacyImportPlan } from "@automovie/interface";
import {
  AutoMovieLegacyImportPlanError,
  assertAutoMovieLegacyImportPlan,
  fingerprintAutoMovieLegacyImportPlan,
  isAutoMovieLegacyImportPlan,
} from "@automovie/production";
import { TestValidator } from "@nestia/e2e";

const plan = (): IAutoMovieLegacyImportPlan => {
  const value: IAutoMovieLegacyImportPlan = {
    version: 1,
    fingerprint: "sha256:pending",
    legacyRevision: 0,
    inventory: [
      {
        path: "assets/missing.bin",
        bytes: 0,
        digest: null,
        kind: "asset",
      },
      {
        path: "automovie.json",
        bytes: 2,
        digest:
          "sha256:44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a",
        kind: "project",
      },
    ],
    rollbackBaseline: [
      {
        path: "src",
        existed: true,
        directories: ["src/nested"],
        files: [
          {
            path: "src/file.ts",
            bytes: 0,
            digest:
              "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
            kind: "project",
          },
        ],
      },
      { path: "generated", existed: false, directories: [], files: [] },
      { path: "renders", existed: false, directories: [], files: [] },
    ],
    productionDraft: {
      id: "legacy",
      title: "Legacy",
      logline: "A recovered production.",
      targetRuntimeSeconds: 1,
      visualDelivery: "deterministic",
      frameFormat: {
        width: 1280,
        height: 720,
        fps: 24,
        colorSpace: "srgb",
      },
      artDirection: {
        style: "primitive-3d",
        palette: ["#808080"],
        silhouettePriority: "Preserve the recovered silhouette.",
        scaleGrammar: "Preserve the recovered scale.",
      },
      deliverables: [],
    },
    shotContractDrafts: [],
    sourceTodos: [],
    diagnostics: [],
  };
  value.fingerprint = fingerprintAutoMovieLegacyImportPlan(value);
  return value;
};

const clone = (): IAutoMovieLegacyImportPlan => structuredClone(plan());

const rejected = (
  mutate: (value: IAutoMovieLegacyImportPlan) => void,
): boolean => {
  const value = clone();
  mutate(value);
  try {
    assertAutoMovieLegacyImportPlan(value);
    return false;
  } catch (error) {
    return error instanceof AutoMovieLegacyImportPlanError;
  }
};

const refingerprint = (value: IAutoMovieLegacyImportPlan): void => {
  value.fingerprint = fingerprintAutoMovieLegacyImportPlan(value);
};

/** Apply and reopen share complete legacy-plan semantic admission. */
export const test_production_legacy_import_plan_admission = (): void => {
  const current = plan();
  const missingFingerprint: Partial<IAutoMovieLegacyImportPlan> = clone();
  delete missingFingerprint.fingerprint;
  TestValidator.equals(
    "the current exact plan is admitted by assertion and predicate",
    [
      assertAutoMovieLegacyImportPlan(current) === current,
      isAutoMovieLegacyImportPlan(current),
    ],
    [true, true],
  );
  TestValidator.equals(
    "revision boundaries and stale content are refused",
    [
      rejected((value) => {
        value.legacyRevision = -1;
        refingerprint(value);
      }),
      rejected((value) => {
        value.legacyRevision = 0.5;
        refingerprint(value);
      }),
      rejected((value) => {
        value.legacyRevision = Number.MAX_SAFE_INTEGER + 1;
        refingerprint(value);
      }),
      rejected((value) => {
        value.productionDraft.title = "changed";
      }),
    ],
    [true, true, true, true],
  );
  TestValidator.equals(
    "schema and runtime-only refinements remain part of one decision",
    [
      isAutoMovieLegacyImportPlan({ ...clone(), version: 2 }),
      isAutoMovieLegacyImportPlan({ ...clone(), extra: true }),
      isAutoMovieLegacyImportPlan(missingFingerprint),
      rejected((value) => {
        value.rollbackBaseline[0]!.path = "generated";
        refingerprint(value);
      }),
      rejected((value) => {
        value.rollbackBaseline[0]!.existed = false;
        value.rollbackBaseline[0]!.directories.push("src/nested");
        refingerprint(value);
      }),
      rejected((value) => {
        value.inventory[1]!.bytes = -1;
        refingerprint(value);
      }),
      rejected((value) => {
        value.inventory[1]!.digest = null;
        value.inventory[1]!.bytes = 0;
        refingerprint(value);
      }),
      rejected((value) => {
        value.inventory[1]!.digest = "sha256:not-a-digest";
        refingerprint(value);
      }),
      rejected((value) => {
        value.inventory[1]!.path = "C:automovie.json";
        refingerprint(value);
      }),
      rejected((value) => {
        value.inventory.reverse();
        refingerprint(value);
      }),
      rejected((value) => {
        const first = { ...value.inventory[1]!, path: "A.json" };
        value.inventory = [first, { ...first, path: "a.json" }];
        refingerprint(value);
      }),
      rejected((value) => {
        value.rollbackBaseline[0]!.files[0]!.path = "src/nested";
        refingerprint(value);
      }),
    ],
    [false, false, false, true, true, true, true, true, true, true, true, true],
  );
  const changed = clone();
  changed.productionDraft.title = "Re-derived";
  refingerprint(changed);
  TestValidator.predicate(
    "a changed plan is admitted only with its recomputed complete identity",
    isAutoMovieLegacyImportPlan(changed),
  );
};
