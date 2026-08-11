import { AutoMovieApplication } from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { namedFacts } from "../internal/predicates";

/** The shipped knowledge surface preserves author choice and honest scope. */
export const test_mcp_issue_contract_guides = (): void => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "automovie-guides-"));
  fs.writeFileSync(
    path.join(root, "automovie.config.ts"),
    "export default {};\n",
  );
  try {
    inspectGuides(new AutoMovieApplication({ projectRoot: root }));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
};

const inspectGuides = (application: AutoMovieApplication): void => {
  const guide = (
    name: Parameters<typeof application.getGuideDocument>[0]["name"],
  ) => application.getGuideDocument({ name }).content;

  const overall = guide("AUTOMOVIE_OVERALL");
  const world = guide("WORLD_BUILDING");
  const compilation = guide("COMPILATION");
  const motion = guide("MOTION");
  const sound = guide("SOUND_DESIGN");
  const sourcing = guide("ASSET_SOURCING");

  TestValidator.equals(
    "public guides describe the prototype and keep source decisions with the author",
    namedFacts([
      [
        "prototypeBoundary",
        () =>
          overall.includes("deterministic prototype") &&
          overall.includes("blocking pass") &&
          overall.includes("not a finished photoreal shot"),
      ],
      [
        "noProcurementPromise",
        () =>
          world.includes(
            "not a bill of materials, a procurement take-off, or an instruction to order anything",
          ),
      ],
      [
        "externalMotionChoice",
        () =>
          motion.includes("user or delegated authoring agent chooses") &&
          motion.includes("direct or humanoid-retarget mode") &&
          motion.includes("without choosing a motion library, provider, take"),
      ],
      [
        "voiceChoiceAndEmission",
        () =>
          motion.includes("no guide supplies a provider default") &&
          motion.includes("emission interval") &&
          motion.includes(
            "missing alignment remains `unsupported` or `not-run`",
          ),
      ],
      [
        "providerIndependentContentIdentity",
        () =>
          sourcing.includes("provider- and package-independent") &&
          sourcing.includes("interpretation metadata") &&
          sourcing.includes("never merges source identity, acquisition event"),
      ],
    ]),
    {
      prototypeBoundary: true,
      noProcurementPromise: true,
      externalMotionChoice: true,
      voiceChoiceAndEmission: true,
      providerIndependentContentIdentity: true,
    },
  );

  TestValidator.equals(
    "public guides expose bounded audio and measure-only caption behavior",
    namedFacts([
      [
        "propagationBoundary",
        () =>
          sound.includes("visual `emissionFrame`") &&
          sound.includes("derived `arrivalFrame`") &&
          sound.includes(
            "Do not infer temperature, humidity, weather, or a provider",
          ),
      ],
      [
        "roomResponseBoundary",
        () =>
          sound.includes(
            "same-room sound may consume one bounded room response",
          ) &&
          sound.includes("Never derive acoustic absorption from a texture") &&
          sound.includes("does not claim full wave acoustics"),
      ],
      [
        "providerNeutralVoice",
        () =>
          sound.includes("user or delegated authoring agent choose") &&
          sound.includes("requires no particular provider, model, or voice"),
      ],
      [
        "captionProfileAuthority",
        () =>
          sound.includes("production-selected, versioned profile") &&
          sound.includes("do not invent a default threshold") &&
          compilation.includes(
            "instead of applying hidden default thresholds",
          ) &&
          compilation.includes("stays `not-run` as unsupported") &&
          compilation.includes("never evaluated through a fallback"),
      ],
    ]),
    {
      propagationBoundary: true,
      roomResponseBoundary: true,
      providerNeutralVoice: true,
      captionProfileAuthority: true,
    },
  );
};
