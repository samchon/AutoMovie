import {
  AUTOMOVIE_ANALYSIS_DOMAINS,
  AUTO_MOVIE_LIGHT_TYPES,
  performShot,
  stageScene,
  summarizeAutoMovieAnalysis,
} from "@automovie/engine";
import {
  IAutoMovieActionCall,
  IAutoMovieStageLight,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import {
  makePerformanceWrite,
  makeScriptWrite,
  makeStagingWrite,
  validSynthesizer,
} from "../internal/filmFixtures";
import { createSkeleton } from "../internal/fixtures";
import { namedFacts } from "../internal/predicates";

/**
 * A diagnostic agrees with the value it interpolates, for every value.
 *
 * The messages here name a member of a closed union — a light type, an analysis
 * domain, a schedule subject, an action verb — and every one of those unions is
 * something this project keeps extending. A message that spells its article
 * beside the interpolation instead of deriving it reads correctly until the day
 * a vowel-initial member is added, and then reads `a opening` forever, in the
 * gap and violation text an author consults to decide what is wrong. That is
 * where it was found: `a opening row states type, size and count but no place`,
 * in a benchmark sandbox's `building.log`, in two separate rounds.
 *
 * So the property under test is not the wording of any one message. It is that
 * a union can grow without producing broken prose, and the cases are built to
 * fail when it cannot:
 *
 * - The light and domain tables are keyed by the runtime union constants, so a
 *   new member leaves the table incomplete and the case says so.
 * - The verb table is `satisfies Record<IAutoMovieActionCall["verb"], string>`,
 *   so a new verb fails the compile instead — the verbs have no runtime
 *   constant to enumerate, and the type checker enumerates them.
 * - Each table states its article as a literal rather than calling the helper
 *   the product uses, so a case cannot agree with a broken helper.
 *
 * Scenarios:
 *
 * 1. Every light type, staged so it trips the parameter refusals that name the
 *    type. `area` is the vowel-initial member and the reason this case exists;
 *    the other three are the counter-case a blanket `an` would fail.
 * 2. Every analysis domain, required with nothing submitted, in both the gap's
 *    reason and its remedy. Three of the six begin with a vowel.
 * 3. Both schedule subjects that owe a location, and the third subject that
 *    does not, because the article and that guard sit on one statement.
 * 4. The two vowel-initial action verbs against a camera actor, with a
 *    consonant-initial verb as the counter-case.
 */
export const test_text_diagnostic_article = (): void => {
  TestValidator.equals(
    "every light type is named with its own article",
    namedFacts([
      [
        "the table covers the union",
        () =>
          [...AUTO_MOVIE_LIGHT_TYPES].every(
            (type) => LIGHT_ARTICLE[type] !== undefined,
          ) &&
          Object.keys(LIGHT_ARTICLE).length === AUTO_MOVIE_LIGHT_TYPES.size,
      ],
      ...[...AUTO_MOVIE_LIGHT_TYPES].map((type): [string, () => boolean] => [
        lightFact(type),
        () => {
          const messages = lightMessages(type);
          return (
            messages.length > 0 &&
            messages.every((message) =>
              message.includes(`${LIGHT_ARTICLE[type]} light`),
            )
          );
        },
      ]),
    ]),
    {
      "the table covers the union": true,
      ...Object.fromEntries(
        [...AUTO_MOVIE_LIGHT_TYPES].map((type) => [lightFact(type), true]),
      ),
    },
  );

  TestValidator.equals(
    "every analysis domain is asked for with its own article",
    namedFacts([
      [
        "the table covers the union",
        () =>
          AUTOMOVIE_ANALYSIS_DOMAINS.every(
            (domain) => DOMAIN_ARTICLE[domain] !== undefined,
          ) &&
          Object.keys(DOMAIN_ARTICLE).length ===
            AUTOMOVIE_ANALYSIS_DOMAINS.length,
      ],
      ...AUTOMOVIE_ANALYSIS_DOMAINS.map((domain): [string, () => boolean] => [
        domainFact(domain),
        () => {
          const gap = summarizeAutoMovieAnalysis({
            runs: [],
            revision: "revision-1",
            required: [domain],
          }).gaps.find((entry) => entry.domain === domain);
          return (
            gap !== undefined &&
            gap.reason.includes(
              `the production requires ${DOMAIN_ARTICLE[domain]} answer`,
            ) &&
            gap.remedy.includes(`run ${DOMAIN_ARTICLE[domain]} analysis`)
          );
        },
      ]),
    ]),
    {
      "the table covers the union": true,
      ...Object.fromEntries(
        AUTOMOVIE_ANALYSIS_DOMAINS.map((domain) => [domainFact(domain), true]),
      ),
    },
  );

  TestValidator.equals(
    "an action aimed through a camera is named with its verb's article",
    namedFacts([
      [
        "an emote action",
        () =>
          cameraActorRefusal({
            verb: "emote",
            actor: CAMERA,
            start: 0,
            duration: 1,
            preset: "happy",
            intensity: 0.5,
          })?.startsWith(`${VERB_ARTICLE.emote} action's actor`) === true,
      ],
      [
        "an enact action",
        () =>
          cameraActorRefusal({
            verb: "enact",
            actor: CAMERA,
            start: 0,
            duration: 1,
            clip: "bow",
          })?.startsWith(`${VERB_ARTICLE.enact} action's actor`) === true,
      ],
      [
        "a gesture action",
        () =>
          cameraActorRefusal({
            verb: "gesture",
            actor: CAMERA,
            start: 0,
            duration: 1,
            kind: "strike",
            at: { kind: "node", node: "knightB" },
          })?.startsWith(`${VERB_ARTICLE.gesture} action's actor`) === true,
      ],
    ]),
    {
      "an emote action": true,
      "an enact action": true,
      "a gesture action": true,
    },
  );
};

/** The staged camera every verb case aims through. */
const CAMERA = "cam-main";

/** The fact name a light type is reported under, spelled once. */
const lightFact = (type: string): string =>
  `${type} is refused as "${LIGHT_ARTICLE[type]} light"`;

/** The fact name an analysis domain is reported under. */
const domainFact = (domain: string): string =>
  `${domain} reads as "${DOMAIN_ARTICLE[domain]}"`;

/**
 * The refusals a light of `type` draws that name the type.
 *
 * One light carrying a `range` and a `coneAngle` and neither a direction nor a
 * position trips whichever of the four parameter rules apply to its own type,
 * so the same probe covers all of them without a per-type fixture.
 */
const lightMessages = (type: string): string[] => {
  const staged = stageScene(makeScriptWrite(), {
    ...makeStagingWrite(),
    lights: [
      {
        node: "probe",
        type,
        intensity: 1,
        range: 8,
        coneAngle: 30,
      } as unknown as IAutoMovieStageLight,
    ],
  });
  if (staged.success === true) return [];
  return staged.violations
    .map((violation) => violation.expected)
    .filter((message) => message.includes(` ${type} light`));
};

/** The refusal an action draws for naming a camera as its actor. */
const cameraActorRefusal = (action: IAutoMovieActionCall): string | null => {
  const staged = stageScene(makeScriptWrite(), makeStagingWrite());
  if (staged.success !== true)
    throw new Error("the staging fixture must succeed");
  const performed = performShot({
    script: makeScriptWrite(),
    staged,
    performance: makePerformanceWrite({ draft: [action] }),
    synthesize: validSynthesizer,
    skeleton: () => createSkeleton(),
  });
  if (performed.success === true) return null;
  return (
    performed.violations.find((violation) =>
      violation.expected.includes("is a camera"),
    )?.expected ?? null
  );
};

/**
 * The article each light type is named with, keyed by the runtime union.
 *
 * Spelled out rather than derived, so a helper that started answering `a area`
 * would fail here instead of agreeing with itself.
 */
const LIGHT_ARTICLE: Record<string, string> = {
  area: "an area",
  directional: "a directional",
  point: "a point",
  spot: "a spot",
};

/** The article each analysis domain is named with. */
const DOMAIN_ARTICLE: Record<string, string> = {
  daylight: "a daylight",
  "artificial-light": "an artificial-light",
  thermal: "a thermal",
  moisture: "a moisture",
  air: "an air",
  acoustic: "an acoustic",
};

/**
 * The article each action verb is named with.
 *
 * `satisfies` rather than a runtime enumeration: the verbs are a discriminated
 * union with no constant to iterate, so the compiler is what refuses a new verb
 * nobody has stated an article for. The three cases above read from it, so it
 * is a checked constant rather than dead weight.
 */
const VERB_ARTICLE = {
  attachTo: "an attachTo",
  emote: "an emote",
  enact: "an enact",
  frame: "a frame",
  gesture: "a gesture",
  hold: "a hold",
  launch: "a launch",
  locomote: "a locomote",
  lookAt: "a lookAt",
  reach: "a reach",
  react: "a react",
} satisfies Record<IAutoMovieActionCall["verb"], string>;
