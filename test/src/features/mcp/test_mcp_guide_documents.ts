import { AutoMovieApplication, AutoMovieGuideName } from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";

import { throwsError } from "../internal/predicates";

const app = new AutoMovieApplication();

/** Every corpus key, with a distinctive phrase its content must carry. */
const CORPUS: ReadonlyArray<readonly [AutoMovieGuideName, string]> = [
  ["AUTOMOVIE_OVERALL", "engine enforces, model creates"],
  ["AUTOMOVIE_OVERALL", "surgical, not a reset"],
  ["AUTOMOVIE_OVERALL", "an accepted spec also writes through as"],
  ["AUTOMOVIE_OVERALL", "tool-specific result field"],
  ["AUTOMOVIE_OVERALL", "Render and resident mutation tools carry"],
  ["STAGING", "coherence, not craft"],
  ["BLOCKING", "causal order"],
  ["PERFORMANCE", "One take, one live camera"],
  ["PERFORMANCE", "Motions Are Derived, Not Stored"],
  ["REVIEW", "advice, not gates"],
  ["REVIEW", "ancestors nearest-first"],
  ["REVIEW", "plausibility versus possibility"],
  ["AUTOMOVIE_OVERALL", "an *implausible* one is a suppressible warning"],
  ["AUTOMOVIE_OVERALL", "semantic Euler degrees"],
  ["PROPS", "crude proxy, rich meaning"],
  ["PERFORMANCE", "the whole staged scene stops travelling per beat"],
  ["PERFORMANCE", "resumes exactly where it stopped"],
  ["PERFORMANCE", "resumes mid-stride instead of stuttering"],
  ["STAGING", "The stage does not have to be a void"],
  ["STAGING", "the world the feet obey is the world the passes draw"],
  ["PROPS", "a room IS a few boxes"],
  ["BLOCKING", "stops re-sending the staged scene every beat"],
  ["BLOCKING", "pass it as `block`'s `previous`"],
  ["FORGE", "an actor with no body"],
  ["FORGE", "silhouette reads as this character"],
  ["FORGE", "a boneless model is a prop, not a castable actor"],
  ["FORGE", "not** written through to the resident project"],
  ["PROPS", "that re-forge is refused"],
  ["PROJECT_MEMORY", "cleared slice's file is removed"],
  ["PROJECT_MEMORY", "still places is refused"],
  ["PROJECT_MEMORY", "sibling beats' files stay byte-identical"],
  ["PROJECT_MEMORY", "byte-writing stays the host adapter's job"],
  ["PROJECT_MEMORY", "lowers the angles to a quaternion"],
  ["PROJECT_MEMORY", "supply an actor's rig once"],
  ["PERFORMANCE", "the registry itself stops travelling"],
  ["PROJECT_MEMORY", "forge a prop once"],
  ["PROJECT_MEMORY", "Compiled motions are not a slice"],
  ["RENDER_GUIDES", "no-capture-adapter"],
  ["RENDER_GUIDES", "omit `slate`"],
  ["RENDER_GUIDES", "planChunkedRender"],
  ["RENDER_GUIDES", "planCaptions"],
  // The three tools taught in #1232/#1241 and corrected in #1253, pinned so the
  // corpus cannot silently drop or contradict them again (the #1241 miss).
  ["PROJECT_MEMORY", "read companion to the commit ladder"],
  ["PROJECT_MEMORY", "prefer the per-slice reads over pulling the whole slate"],
  ["REVIEW", "it is not resident, and it reads no committed film"],
  ["RENDER_GUIDES", "OpenPose-style sidecar"],
  // The even-dimension gate (#1251), pinned so the corpus keeps teaching the
  // new hard authoring rule the render/keypoint validators now enforce.
  ["RENDER_GUIDES", "can only encode even axes"],
  ["RENDER_GUIDES", "reuse that exact value"],
  ["AUTOMOVIE_OVERALL", "no re-commit needed"],
  // The perform surface corrected in #1294/#1295, pinned so the corpus keeps
  // teaching the rules that actually ship: a camera is a legal positional
  // target (but never a performer), a first beat opens on its staged
  // placement, and commitBeatEnd is the remedy for exactly one refusal.
  ["PERFORMANCE", "a place to point at, not a performer"],
  ["PERFORMANCE", "a first beat opens on the staged placement"],
  ["PERFORMANCE", "the only case that hint fits"],
  ["PROJECT_MEMORY", "a first beat opens on the staged placement"],
  // Multi-camera coverage (#1187), pinned in all three guides that teach a half
  // of it: staging places the extra angles, blocking names them, and the render
  // guides read the compiled alternates.
  ["STAGING", "covered by several staged cameras"],
  ["BLOCKING", "cut between angles of one performed beat"],
  ["RENDER_GUIDES", "one entry per alternate camera take of the beat"],
  // The aim-height axis. #1294's "same table" sentence was true of WHICH ids
  // resolve and silent about WHERE on the subject each verb aims, so an agent
  // could not predict why pointing at a nearby actor breaks the ROM gate while
  // looking at the same actor passes. Pinned in both guides that teach a half:
  // performance owns the per-verb rule, blocking owns what a camera may favour.
  ["PERFORMANCE", "the same table does not mean the same aim height"],
  ["PERFORMANCE", "an actor placement lifted by that actor's `eyeHeight`"],
  ["BLOCKING", "an actor, a set piece, or another camera"],
  // The write discriminator (#1347): optional on the authoring payloads,
  // absent from the commit artifacts. Five sessions lost a round to a token no
  // guide named, so the corpus now names it in both directions.
  ["AUTOMOVIE_OVERALL", 'optional** `"type": "write"` discriminator'],
  // The body-region axis (#1349). The mask was always there and no guide named
  // it, so a retargeted quadruped's front legs (which ride the ARM chains) fell
  // outside `locomote`'s `lowerBody` default and vanished from a shot the
  // engine still called successful. The per-verb defaults and the non-biped
  // consequence are pinned so the corpus cannot drop them again.
  ["PERFORMANCE", "a channel outside it is **refused**, not dropped"],
  ["PERFORMANCE", "a quadruped's FRONT legs ride the arm chains"],
  // The clip payload contract (#1353). The gate had learned one of the
  // sampler's rules, so an uneven `values` stride committed clean and threw
  // while the film was being played; the corpus now states the whole shape an
  // author must emit, since a guide that names only the channel teaches half of
  // what a track is.
  ["PERFORMANCE", "checked to the depth the sampler reads it"],
];

/**
 * The guide corpus carries the film-authoring doctrine outside the MCP JSDoc
 * caps: getGuideDocument serves each prompts/*.md stem by exact name, generated
 * into the constant at build time. Guides teach the method; tool returns decide
 * correctness.
 *
 * Scenarios:
 *
 * 1. Every declared guide name resolves to non-empty markdown carrying its
 *    distinctive doctrine phrase: the union, the prompts directory, and the
 *    generated constant cannot drift apart silently. Phrases match case-folded,
 *    because a pin holds doctrine, not capitalization: a corpus-wide
 *    punctuation pass (#1298's em-dash ban) re-cased two sentence-initial words
 *    and must not read as dropped doctrine.
 * 2. An unknown name (reachable through direct API misuse) throws an error that
 *    lists every valid name, instead of returning undefined content.
 * 3. Malformed name fields reject before guide lookup so bad input is not confused
 *    with an unknown guide key.
 * 4. A malformed request root rejects before the guide lookup dereferences request
 *    fields.
 */
export const test_mcp_guide_documents = (): void => {
  const folded = (s: string): string => s.toLowerCase();
  for (const [name, phrase] of CORPUS) {
    const output = app.getGuideDocument({ name });
    TestValidator.predicate(
      `${name} resolves with substance ("${phrase}")`,
      output.content.length > 200 &&
        folded(output.content).includes(folded(phrase)),
    );
  }

  TestValidator.predicate(
    "unknown name throws listing valid names",
    throwsError(
      () =>
        app.getGuideDocument({
          name: "NOT_A_GUIDE" as AutoMovieGuideName,
        }),
      ["unknown guide document", "AUTOMOVIE_OVERALL", "RENDER_GUIDES"],
    ),
  );

  TestValidator.predicate(
    "malformed name field rejects",
    throwsError(
      () =>
        app.getGuideDocument({
          name: null as unknown as AutoMovieGuideName,
        }),
      ["$input.name", "non-empty string"],
    ) &&
      throwsError(
        () =>
          app.getGuideDocument({
            name: "" as AutoMovieGuideName,
          }),
        ["$input.name", "non-empty string"],
      ),
  );

  TestValidator.predicate(
    "malformed request root rejects",
    throwsError(
      () => app.getGuideDocument(null as never),
      ["$input", "JSON object"],
    ),
  );
};
