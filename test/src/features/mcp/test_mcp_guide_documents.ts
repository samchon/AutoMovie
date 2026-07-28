import { compareCodeUnits } from "@automovie/engine";
import {
  AUTOMOVIE_GUIDE_NAMES,
  AutoMovieGuideName,
  AutoMovieLegacyApplication,
} from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import path from "node:path";

import { throwsError } from "../internal/predicates";

const app = new AutoMovieLegacyApplication();

/** Repository root, four levels above `test/src/features/mcp`. */
const ROOT = path.resolve(__dirname, "..", "..", "..", "..");

/**
 * The markdown file the generator refuses to serve, restated here so the
 * exclusion is asserted rather than assumed. `packages/mcp/build/prompt.mjs`
 * skips it because it documents the corpus itself.
 */
const UNSERVED = "README.md";

/** Every guide stem on disk, in the order the parity assertion compares. */
const promptStems = (): string[] =>
  fs
    .readdirSync(path.join(ROOT, "packages", "mcp", "prompts"))
    .filter((file) => file.endsWith(".md") && file !== UNSERVED)
    .map((file) => file.slice(0, -".md".length))
    .sort(compareCodeUnits);

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
  // it, so a narrow authored region could hide a retargeted quadruped's front
  // legs (which ride the ARM chains). The refusal and non-biped consequence are
  // pinned so the corpus cannot drop them again.
  ["PERFORMANCE", "a channel outside it is **refused**, not dropped"],
  ["PERFORMANCE", "a quadruped's FRONT legs ride the arm chains"],
  // The shipped gaits use the full default and retain contralateral arm swing.
  ["PERFORMANCE", "A stock biped gait uses the whole default."],
  ["PERFORMANCE", "compares the root, exact bones, and expression channel"],
  // The clip payload contract (#1353). The gate had learned one of the
  // sampler's rules, so an uneven `values` stride committed clean and threw
  // while the film was being played; the corpus now states the whole shape an
  // author must emit, since a guide that names only the channel teaches half of
  // what a track is.
  ["PERFORMANCE", "checked to the depth the sampler reads it"],
  // The light-time axis (#1348). Two sessions were told outright that a light
  // could not change and encoded the change as English prose in a caption
  // instead, so the corpus now teaches the field, the pointer grammar, and the
  // one thing an agent cannot guess: lights are named by id, not by index.
  ["STAGING", "re-lighting a beat never discards the performances already"],
  ["PERFORMANCE", "lights are addressed by their staged id, never by position"],
  ["PERFORMANCE", "no two tracks in the whole field may drive the same light"],
  // The gaze chain (#1360). A steep `lookAt` used to break the head's ROM with
  // the neck idle, and the recovery an agent reached for was widening the head
  // bone until one joint carried the whole cervical range. The corpus now names
  // both halves an author cannot infer: the chain absorbs the aim, and it does
  // so only for a context that supplies a `rig`.
  ["PERFORMANCE", "spreads its solved aim over `neck` and `head`"],
  ["PERFORMANCE", "without one the whole angle sits on the head"],
  // The declared-span rule (#1366). `locomote` sized its walk from distance and
  // speed and discarded an explicit `duration`, and no guide said which of the
  // two an author was writing.
  ["PERFORMANCE", "A declared `duration` is the span, on every verb."],
  // The fine facial axis (#1363). `blendshapes` ships on every keyframe
  // expression and the corpus never named it, so seven sessions across three
  // scenarios approximated every emotion with the nearest of six presets and
  // three of them committed a different emotion than the brief asked for. Both
  // halves are pinned: that the axis exists, and the one thing an author cannot
  // guess, that `emote` is not where it is written.
  ["PERFORMANCE", "ARKit 52-channel overlay"],
  ["PERFORMANCE", "The `emote` verb takes preset and intensity only"],
  ["AUTOMOVIE_OVERALL", "The Face Has Two Resolutions"],
  // Coding-agent-first production contracts. Each new bounded design, compile,
  // oracle and evidence-review guide must remain reachable through the one
  // guide tool; otherwise a compact MCP surface would strand its own doctrine.
  ["PRODUCTION_DESIGN", "stores global invariants"],
  ["MODEL_RECIPE", "stores a bounded primitive recipe"],
  ["MODEL_RECIPE", "only `stickman` accepts `signal`"],
  ["WORLD_DESIGN", "stores queryable space"],
  ["WORLD_DESIGN", "bounded deterministic fog, smoke, or dust billboards"],
  ["FORMATION_DESIGN", "represents a unit, not thousands"],
  ["SHOT_CONTRACT", "says what a shot must accomplish"],
  ["ACCEPTANCE", "makes an observable contract addressable"],
  ["SOURCE_OWNERSHIP", "The compiler alone owns `generated`"],
  ["COMPILATION", "an atomic fence with four scopes"],
  ["GEOMETRY", "measures the current compiled production"],
  ["PRODUCTION_REVIEW", "The server never calls an LLM"],
  ["PRODUCTION_RENDER", "the MCP visual oracle"],
];

/**
 * The guide corpus carries the film-authoring doctrine outside the MCP JSDoc
 * caps: getGuideDocument serves each prompts/*.md stem by exact name, generated
 * into the constant at build time. Guides teach the method; tool returns decide
 * correctness.
 *
 * Scenarios:
 *
 * 0. The three lists are one set: the prompts directory minus the file the
 *    generator refuses to serve, the names the server actually serves, and the
 *    corpus this scenario exercises. They used to be three hand-kept lists with
 *    nothing comparing them, under a sentence claiming they could not drift
 *    (#1399). The remaining side, a declared name with no markdown behind it,
 *    is a build error now: `GuideService` indexes the generated object with the
 *    union key and no cast.
 * 1. Every declared guide name resolves to non-empty markdown carrying its
 *    distinctive doctrine phrase. Phrases match case-folded, because a pin
 *    holds doctrine, not capitalization: a corpus-wide punctuation pass
 *    (#1298's em-dash ban) re-cased two sentence-initial words and must not
 *    read as dropped doctrine.
 * 2. An unknown name (reachable through direct API misuse) throws an error that
 *    lists every valid name, instead of returning undefined content.
 * 3. Malformed name fields reject before guide lookup so bad input is not confused
 *    with an unknown guide key.
 * 4. A malformed request root rejects before the guide lookup dereferences request
 *    fields.
 */
export const test_mcp_guide_documents = (): void => {
  // 0. the served corpus, the directory, and this scenario's list are one set
  const served: string[] = [...AUTOMOVIE_GUIDE_NAMES].sort(compareCodeUnits);
  const exercised: string[] = [...new Set(CORPUS.map(([name]) => name))].sort(
    compareCodeUnits,
  );
  TestValidator.equals(
    "the served guide names are exactly the prompts the generator keeps",
    served,
    promptStems(),
  );
  TestValidator.equals(
    "this scenario exercises every served guide",
    exercised,
    served,
  );
  TestValidator.equals(
    "the unserved corpus document is present, and is not served",
    [
      fs.existsSync(path.join(ROOT, "packages", "mcp", "prompts", UNSERVED)),
      AUTOMOVIE_GUIDE_NAMES.includes(
        UNSERVED.slice(0, -".md".length) as AutoMovieGuideName,
      ),
    ],
    [true, false],
  );

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
