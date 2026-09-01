import { TestValidator } from "@nestia/e2e";
import path from "node:path";

import { namedFacts } from "../internal/predicates";
import { requireSourceModule } from "../internal/requireSourceModule";

interface IInspectionInput {
  productionId: string;
  compileFingerprint: string;
  revision: string;
  target: { shot: string; subject: string };
  width: number;
  height: number;
}

const keys = requireSourceModule<{
  pageKey: (input: IInspectionInput) => string;
  pageSubject: (input: IInspectionInput) => string;
}>(
  path.resolve(
    __dirname,
    "../../../../packages/template/scaffold/scripts/inspectionPageKey.ts",
  ),
  ["pageKey", "pageSubject"],
);

const input = (
  overrides: Partial<IInspectionInput> & {
    shot?: string;
    subject?: string;
  } = {},
): IInspectionInput => ({
  productionId: "fixture-film",
  compileFingerprint: "sha256:aaaa",
  revision: "r1",
  target: {
    shot: overrides.shot ?? "opening",
    subject: overrides.subject ?? "space:hall-house/hall",
  },
  width: overrides.width ?? 640,
  height: overrides.height ?? 480,
  ...Object.fromEntries(
    Object.entries(overrides).filter(
      ([name]) =>
        name !== "shot" &&
        name !== "subject" &&
        name !== "width" &&
        name !== "height",
    ),
  ),
});

/**
 * One inspection page is reused across subjects and retired by a recompile.
 *
 * The reuse key decides both, and both mistakes are silent. Adding the subject
 * to it rebuilds a scene per subject -- measured at 4.3 of the 6.2 seconds one
 * observation took, and 70% of a whole production's sweep (#1956) -- and the
 * production still answers, only slowly. Leaving the compile identity out of it
 * serves a page staged from a shot that has since recompiled, and the
 * production still answers, only wrongly. Nothing in this project read either.
 *
 * Scenarios:
 *
 * 1. Two subjects of one shot share a page, because the page stages the shot
 *    and draws any subject standing in it.
 * 2. A different shot, width, or height is a different page, because each
 *    changes what the page itself stands up.
 * 3. A recompile and a new revision each retire the page, so a frame is never
 *    served from a scene that no longer exists.
 * 4. The subject key leaves out exactly the compile identity the reuse key
 *    carries, which is the difference between "the same scene" and "the same
 *    scene, still current".
 */
export const test_cli_scaffold_inspection_page_key = (): void => {
  const base = input();

  TestValidator.equals(
    "one inspection page serves every subject of a shot and no stale compile",
    namedFacts([
      [
        "twoSubjectsShareOnePage",
        () =>
          keys.pageKey(input({ subject: "space:hall-house/annex" })) ===
          keys.pageKey(base),
      ],
      [
        "anotherShotIsAnotherPage",
        () => keys.pageKey(input({ shot: "closing" })) !== keys.pageKey(base),
      ],
      [
        "anotherSizeIsAnotherPage",
        () =>
          keys.pageKey(input({ width: 800 })) !== keys.pageKey(base) &&
          keys.pageKey(input({ height: 600 })) !== keys.pageKey(base),
      ],
      [
        "aRecompileRetiresThePage",
        () =>
          keys.pageKey(input({ compileFingerprint: "sha256:bbbb" })) !==
          keys.pageKey(base),
      ],
      [
        "aNewRevisionRetiresThePage",
        () => keys.pageKey(input({ revision: "r2" })) !== keys.pageKey(base),
      ],
      [
        // The subject key names what the page stages; the reuse key names that
        // plus whether it is still current. A subject key that carried the
        // compile identity would make the two the same thing.
        "theSubjectKeyIsTheReuseKeyWithoutTheCompileIdentity",
        () =>
          keys.pageSubject(base) !== keys.pageKey(base) &&
          keys.pageSubject(input({ compileFingerprint: "sha256:bbbb" })) ===
            keys.pageSubject(base) &&
          keys.pageSubject(input({ revision: "r2" })) ===
            keys.pageSubject(base) &&
          keys.pageSubject(input({ shot: "closing" })) !==
            keys.pageSubject(base),
      ],
    ]),
    {
      twoSubjectsShareOnePage: true,
      anotherShotIsAnotherPage: true,
      anotherSizeIsAnotherPage: true,
      aRecompileRetiresThePage: true,
      aNewRevisionRetiresThePage: true,
      theSubjectKeyIsTheReuseKeyWithoutTheCompileIdentity: true,
    },
  );
};
