import { AutoMovieApplication } from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

interface ISemanticExpectation {
  name: string;
  pattern: RegExp;
}

const REQUIRED: readonly ISemanticExpectation[] = [
  {
    name: "film-only route",
    pattern: /selected kind is `film`[\s\S]+A `brief`[\s\S]+a `library`/iu,
  },
  {
    name: "anchored file topology",
    pattern: /ordered files[\s\S]+H2 sequence, H3 scene, and H4 beat/iu,
  },
  {
    name: "same-identity refinement",
    pattern:
      /refines the same identity[\s\S]+without merging, splitting, reordering/iu,
  },
  {
    name: "form-flexible storyline",
    pattern:
      /Causal, relational, observational, procedural, non-human[\s\S]+formal development/iu,
  },
  {
    name: "executable scenario",
    pattern:
      /production-capable initial script[\s\S]+entry state[\s\S]+knowledge change[\s\S]+exit state/iu,
  },
  {
    name: "audiovisual screenplay ownership",
    pattern:
      /final human-readable audiovisual requirement[\s\S]+sees, reads, hears[\s\S]+intentionally does not hear/iu,
  },
  {
    name: "typed-index boundary",
    pattern:
      /typed screenplay index[\s\S]+semantic join[\s\S]+never a second abbreviated screenplay/iu,
  },
  {
    name: "format is craft rather than compiler law",
    pattern:
      /INT\.\/EXT\.[\s\S]+Typography is a craft convention, not a compiler invariant/iu,
  },
  {
    name: "voice and silence craft",
    pattern: /O\.S\. or V\.O\.[\s\S]+Author silence and pauses/iu,
  },
  {
    name: "production-intent boundary",
    pattern:
      /Preserve production intent[\s\S]+Leave lens, camera path, final blocking, shot count, source range/iu,
  },
  {
    name: "form-specific local progression",
    pattern:
      /not a universal recipe[\s\S]+observational, procedural, non-human, or formal scene/iu,
  },
  {
    name: "progressive realization boundary",
    pattern:
      /shot contracts and source, compiled shots, film edit and sound mapping, and whole-film viewer playback[\s\S]+storyboard, animatic, layout, and previs/iu,
  },
  {
    name: "production-certification refusal",
    pattern:
      /do not certify live-production cost, safety, legal clearance, vendor delivery/iu,
  },
  {
    name: "earliest-owner revision",
    pattern:
      /correct the earliest owner[\s\S]+downstream dependents stale and rebuilds them/iu,
  },
];

const RETIRED: readonly ISemanticExpectation[] = [
  { name: "four fixed rungs", pattern: /Four rungs/iu },
  { name: "one document per unit", pattern: /one document per unit/iu },
  {
    name: "universal dramatic question",
    pattern: /Each has a dramatic question/iu,
  },
  {
    name: "one-action scenario",
    pattern: /exactly one storyline as one physical action/iu,
  },
  {
    name: "shooting-script ownership collapse",
    pattern: /film as it will be shot/iu,
  },
  {
    name: "fixed scene recipe",
    pattern: /Give each scene a local want, resistance, turn, and exit value/iu,
  },
  {
    name: "mandatory ending question",
    pattern: /ending answers the dramatic question created by the beginning/iu,
  },
];

/**
 * The served screenplay handbook preserves the current film ladder and its
 * downstream ownership boundaries.
 *
 * Scenarios:
 *
 * 1. The served document teaches every current topology, prose-owner, craft,
 *    realization, and revision semantic accepted by issue #2095.
 * 2. None of the retired fixed-rung, universal-drama, one-action, or
 *    shooting-script formulations survives in the served document.
 */
export const test_mcp_screenplay_handbook_semantics = (): void => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "automovie-screenplay-"));
  fs.writeFileSync(
    path.join(root, "automovie.config.ts"),
    "export default {};\n",
  );
  try {
    const content = new AutoMovieApplication({ projectRoot: root })
      .getGuideDocument({ name: "SCREENPLAY_WRITING" })
      .content.normalize("NFC");

    TestValidator.equals(
      "served screenplay handbook teaches the current contract",
      REQUIRED.filter(({ pattern }) => pattern.test(content)).map(
        ({ name }) => name,
      ),
      REQUIRED.map(({ name }) => name),
    );
    TestValidator.equals(
      "served screenplay handbook retires stale semantics",
      RETIRED.filter(({ pattern }) => pattern.test(content)).map(
        ({ name }) => name,
      ),
      [],
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
};
