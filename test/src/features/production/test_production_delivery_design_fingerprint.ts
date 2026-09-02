import {
  AutoMovieProductionProject,
  currentAutoMovieProductionCompilerInputFingerprint,
} from "@automovie/production";
import { TestValidator } from "@nestia/e2e";

import { namedFacts } from "../internal/predicates";
import { productionFixture } from "./productionFixtures";

/**
 * A changed delivery decision stales the compile that consumed it.
 *
 * This is the property the retired central configuration file was carrying, and
 * it was carrying it by accident: the file was named in the project layout's
 * `contentFiles`, so its bytes joined the compile input fingerprint the way
 * `vite.config.ts` does. Take the entry out while the file still holds a render
 * tier or a repaint request, and editing one of those stops staling the compile
 * that consumed it, which is a real regression rather than a tidy-up.
 *
 * Moving those decisions onto the production design record is what licenses the
 * entry's removal. The compiler already folds every design record into the
 * input fingerprint by canonical JSON, so a delivery decision that lives there
 * is covered by the same rule as the frame clock beside it, and covered because
 * it is design rather than because someone remembered to list a file.
 *
 * Scenarios:
 *
 * 1. Declaring a proxy tier the production had not declared changes the compile
 *    input fingerprint.
 * 2. Changing that tier's frame decimation changes it again.
 * 3. Admitting one live soft-body domain changes it.
 * 4. Adding a speaker binding changes it.
 * 5. Writing the same record back leaves the fingerprint exactly as it was, so
 *    the previous four differences are the edits and not the writes.
 */
export const test_production_delivery_design_fingerprint = (): void => {
  const fixture = productionFixture();
  try {
    const project = AutoMovieProductionProject.open(
      fixture.root,
      "fixture-film",
    );
    const fingerprint = (): string => {
      const value = currentAutoMovieProductionCompilerInputFingerprint(
        project,
        "design",
      );
      if (value === null)
        throw new Error(
          "The fixture must produce a current compile input fingerprint.",
        );
      return value;
    };
    const design = project.graph().production;
    if (design === null)
      throw new Error("The fixture must carry a production design record.");

    const publish = (
      next: typeof design,
    ): { accepted: boolean; fingerprint: string } => {
      const output = project.setProductionDesign(next);
      return { accepted: output.accepted, fingerprint: fingerprint() };
    };

    const base = fingerprint();
    const proxyDeclared = publish({
      ...design,
      renderTiers: {
        proxy: { kind: "proxy", resolutionScale: 0.5, frameStep: 2 },
        final: { kind: "final", resolutionScale: 1, frameStep: 1 },
      },
    });
    const proxyRetimed = publish({
      ...design,
      renderTiers: {
        proxy: { kind: "proxy", resolutionScale: 0.5, frameStep: 3 },
        final: { kind: "final", resolutionScale: 1, frameStep: 1 },
      },
    });
    const softAdmitted = publish({
      ...design,
      renderTiers: {
        proxy: { kind: "proxy", resolutionScale: 0.5, frameStep: 3 },
        final: { kind: "final", resolutionScale: 1, frameStep: 1 },
      },
      simulation: { liveWearableSoftBodies: ["cloak"] },
    });
    const speakerBound = publish({
      ...design,
      renderTiers: {
        proxy: { kind: "proxy", resolutionScale: 0.5, frameStep: 3 },
        final: { kind: "final", resolutionScale: 1, frameStep: 1 },
      },
      simulation: { liveWearableSoftBodies: ["cloak"] },
      sound: { speakerBindings: [{ speaker: "soloist", actor: "soloist" }] },
    });
    const rewritten = publish({
      ...design,
      renderTiers: {
        proxy: { kind: "proxy", resolutionScale: 0.5, frameStep: 3 },
        final: { kind: "final", resolutionScale: 1, frameStep: 1 },
      },
      simulation: { liveWearableSoftBodies: ["cloak"] },
      sound: { speakerBindings: [{ speaker: "soloist", actor: "soloist" }] },
    });

    TestValidator.equals(
      "each authored delivery decision moves the compile input fingerprint",
      namedFacts([
        [
          "everyPublicationWasAccepted",
          () =>
            [
              proxyDeclared,
              proxyRetimed,
              softAdmitted,
              speakerBound,
              rewritten,
            ].every((step) => step.accepted),
        ],
        [
          "declaringRenderTiersStalesTheCompile",
          () => proxyDeclared.fingerprint !== base,
        ],
        [
          "changingFrameDecimationStalesTheCompile",
          () => proxyRetimed.fingerprint !== proxyDeclared.fingerprint,
        ],
        [
          "admittingALiveSoftBodyStalesTheCompile",
          () => softAdmitted.fingerprint !== proxyRetimed.fingerprint,
        ],
        [
          "bindingASpeakerStalesTheCompile",
          () => speakerBound.fingerprint !== softAdmitted.fingerprint,
        ],
        [
          "anUnchangedRecordLeavesTheFingerprintAlone",
          () => rewritten.fingerprint === speakerBound.fingerprint,
        ],
      ]),
      {
        everyPublicationWasAccepted: true,
        declaringRenderTiersStalesTheCompile: true,
        changingFrameDecimationStalesTheCompile: true,
        admittingALiveSoftBodyStalesTheCompile: true,
        bindingASpeakerStalesTheCompile: true,
        anUnchangedRecordLeavesTheFingerprintAlone: true,
      },
    );
  } finally {
    fixture.dispose();
  }
};
