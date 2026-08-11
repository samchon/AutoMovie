import { IAutoMovieScreenplayIndex } from "@automovie/interface";
import {
  AutoMovieProductionCompiler,
  AutoMovieProductionProject,
} from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import path from "node:path";

import { productionFixture } from "./productionFixtures";

/**
 * One well-formed continuity claim the fixture does not otherwise carry.
 *
 * Built fresh per case so a mutation cannot leak into the next one, and valid
 * on its own so each case's defect is the single field it changes.
 */
const continuityClaim =
  (): IAutoMovieScreenplayIndex["continuity"][number] => ({
    id: "CLAIM-HANDEDNESS",
    text: "The soloist raises the signal with the same hand throughout.",
    verification: "geometry",
    proof: {
      owner: "geometry",
      shot: "opening",
      outcome: { kind: "opening", id: "neutral" },
    },
    evidence: [
      {
        reason: "The opening scene establishes which hand carries the signal.",
        scene: "SCN-001",
      },
    ],
  });

interface IScreenplayLedgerFixtureFailure {
  error: unknown;
}

class ScreenplayLedgerFixtureCleanupError extends AggregateError {}

const preserveScreenplayLedgerFixtureCleanup = (
  failure: IScreenplayLedgerFixtureFailure | undefined,
  cleanup: () => void,
): void => {
  try {
    cleanup();
  } catch (cleanupFailure) {
    if (failure === undefined) throw cleanupFailure;
    throw new ScreenplayLedgerFixtureCleanupError(
      [failure.error, cleanupFailure],
      "Screenplay-ledger fixture teardown failed after the test failed.",
    );
  }
};

/**
 * The compiler judges the screenplay ledger's own consistency.
 *
 * `typia.validateEquals` already refuses a record whose shape or enum values
 * are wrong, and it refuses at load rather than as a diagnostic, so none of
 * these cases re-state a type. What each one pins is a fact a type cannot
 * carry: an id used twice, a promise nobody covers, a tombstone still titled as
 * live prose, a lock ledger that dropped an entry it swore to keep forever.
 *
 * This is the obligation `automovie/screenplay-contract` held. It is moved
 * rather than duplicated, because two enforcers of one contract can disagree,
 * and a disagreement is worse than either alone.
 *
 * Every case mutates one field of an otherwise valid index, so a diagnostic
 * that fires is answering for the mutation and nothing else. The mutation
 * helper refuses to write an index it did not change, since a rewrite that
 * silently matched nothing would leave the case asserting against a correct
 * ledger.
 *
 * Scenarios:
 *
 * 1. The unmutated fixture is silent, which is the baseline every other case is
 *    read against: without it, a check that fires on everything would look
 *    identical to a check that works.
 * 2. Treatment defects: no sequences, a blank sequence id, a beatless sequence, a
 *    blank beat id, a repeated beat id, and two beats carrying identical prose,
 *    which verbatim coverage could not tell apart.
 * 3. Scene defects: no scenes, a repeated scene id, a non-canonical id, a blank
 *    title, a tombstone not titled OMITTED, an active scene with no location,
 *    and one citing a location the catalog never declares.
 * 4. Coverage defects: a cover with no reason, a cover quoting prose the treatment
 *    does not promise verbatim, and a promised beat no scene owns.
 * 5. Lock defects: a blank reason, a repeated ledger entry, an entry the index
 *    dropped, and a scene added after lock in numeric rather than alpha form.
 * 6. Catalog and continuity defects: an ungrounded entry, a repeated id, a
 *    citation to an absent scene, a claim whose declared verification family
 *    disagrees with the owner of the proof it selects, and a citation to a
 *    claim the index does not declare.
 */
export const test_mcp_production_screenplay_ledger = (): void => {
  let failure: IScreenplayLedgerFixtureFailure | undefined;
  const fixture = productionFixture();
  try {
    const reopen = (): AutoMovieProductionCompiler =>
      new AutoMovieProductionCompiler(
        AutoMovieProductionProject.open(fixture.root),
      );
    // Opening the project migrates the design tree under the production
    // segment, so the index moves out from under a path captured beforehand.
    reopen();
    const indexFile = [
      path.join(
        fixture.root,
        ".automovie/design/fixture-film/screenplay/index.json",
      ),
      path.join(fixture.root, ".automovie/design/screenplay/index.json"),
    ].find((file) => fs.existsSync(file))!;
    const original = fs.readFileSync(indexFile, "utf8");

    const codesFor = (
      mutate: (index: IAutoMovieScreenplayIndex) => void,
    ): Set<string> => {
      const index = JSON.parse(original) as IAutoMovieScreenplayIndex;
      mutate(index);
      const written = `${JSON.stringify(index, null, 2)}\n`;
      if (written === original)
        throw new Error("The ledger mutation left the index unchanged.");
      fs.writeFileSync(indexFile, written);
      return new Set(
        reopen()
          .compile({ scope: "design" })
          .diagnostics.map((item) => item.code),
      );
    };
    const fires = (
      code: string,
      mutate: (index: IAutoMovieScreenplayIndex) => void,
    ): (() => boolean) => {
      return () => codesFor(mutate).has(code);
    };
    const scene = (
      index: IAutoMovieScreenplayIndex,
      id: string,
    ): IAutoMovieScreenplayIndex["screenplay"]["scenes"][number] =>
      index.screenplay.scenes.find((entry) => entry.id === id)!;

    fs.writeFileSync(indexFile, original);
    const clean = new Set(
      reopen()
        .compile({ scope: "design" })
        .diagnostics.map((item) => item.code),
    );
    TestValidator.predicate(
      "a valid ledger raises no ledger diagnostic",
      [...clean].some((code) => code.startsWith("screenplay-")) === false,
    );

    const cases: ReadonlyArray<
      readonly [string, (index: IAutoMovieScreenplayIndex) => void]
    > = [
      // Treatment.
      [
        "screenplay-treatment-empty",
        (index) => {
          index.treatment.sequences = [];
        },
      ],
      [
        "screenplay-sequence-unnamed",
        (index) => {
          index.treatment.sequences[0]!.id = "  ";
        },
      ],
      [
        "screenplay-sequence-beatless",
        (index) => {
          index.treatment.sequences[0]!.beats = [];
        },
      ],
      [
        "screenplay-beat-unnamed",
        (index) => {
          index.treatment.sequences[0]!.beats[0]!.id = "";
        },
      ],
      [
        "screenplay-beat-id-repeated",
        (index) => {
          index.treatment.sequences[1]!.beats[0]!.id =
            index.treatment.sequences[0]!.beats[0]!.id;
        },
      ],
      [
        "screenplay-beat-prose-repeated",
        (index) => {
          index.treatment.sequences[1]!.beats[0]!.text =
            index.treatment.sequences[0]!.beats[0]!.text;
        },
      ],
      // Scenes.
      [
        "screenplay-scenes-empty",
        (index) => {
          index.screenplay.scenes = [];
        },
      ],
      [
        "screenplay-scene-id-repeated",
        (index) => {
          scene(index, "SCN-002").id = "SCN-001";
        },
      ],
      [
        "screenplay-scene-id-noncanonical",
        (index) => {
          scene(index, "SCN-002").id = "scene-two";
        },
      ],
      [
        "screenplay-scene-untitled",
        (index) => {
          scene(index, "SCN-001").title = " ";
        },
      ],
      [
        "screenplay-tombstone-titled",
        (index) => {
          const target = scene(index, "SCN-002");
          target.status = "OMITTED";
          target.covers = [];
        },
      ],
      [
        "screenplay-scene-unplaced",
        (index) => {
          scene(index, "SCN-001").location = null;
        },
      ],
      [
        "screenplay-scene-location-absent",
        (index) => {
          scene(index, "SCN-001").location = "nowhere";
        },
      ],
      // Coverage.
      [
        "screenplay-cover-unreasoned",
        (index) => {
          scene(index, "SCN-001").covers[0]!.reason = "";
        },
      ],
      [
        "screenplay-cover-unpromised",
        (index) => {
          scene(index, "SCN-001").covers[0]!.beat = "A beat nobody promised.";
        },
      ],
      [
        "screenplay-beat-uncovered",
        (index) => {
          scene(index, "SCN-001").covers = [];
        },
      ],
      // Lock.
      [
        "screenplay-lock-unreasoned",
        (index) => {
          index.screenplay.lock!.reason = "   ";
        },
      ],
      [
        "screenplay-lock-repeated",
        (index) => {
          index.screenplay.lock!.sceneIds = ["SCN-001", "SCN-001", "SCN-002"];
        },
      ],
      [
        "screenplay-lock-orphaned",
        (index) => {
          index.screenplay.lock!.sceneIds = ["SCN-001", "SCN-002", "SCN-003"];
        },
      ],
      [
        "screenplay-lock-renumbered",
        (index) => {
          index.screenplay.lock!.sceneIds = ["SCN-001"];
        },
      ],
      // Catalog and continuity.
      [
        "screenplay-catalog-unnamed",
        (index) => {
          index.catalog.characters[0]!.name = "";
        },
      ],
      [
        "screenplay-catalog-repeated",
        (index) => {
          index.catalog.characters.push({
            ...index.catalog.characters[0]!,
            name: "A second subject wearing the first one's identity",
          });
        },
      ],
      [
        "screenplay-catalog-ungrounded",
        (index) => {
          index.catalog.characters[0]!.evidence = [];
        },
      ],
      [
        "screenplay-catalog-scene-absent",
        (index) => {
          index.catalog.characters[0]!.evidence[0]!.scene = "SCN-404";
        },
      ],
      [
        "screenplay-catalog-claim-absent",
        (index) => {
          index.catalog.characters[0]!.evidence[0]!.claim = "CLAIM-404";
        },
      ],
      [
        "screenplay-claim-unfounded",
        (index) => {
          index.continuity.push({ ...continuityClaim(), text: "  " });
        },
      ],
      [
        "screenplay-claim-repeated",
        (index) => {
          index.continuity.push(continuityClaim(), continuityClaim());
        },
      ],
      [
        "screenplay-claim-scene-absent",
        (index) => {
          const claim = continuityClaim();
          claim.evidence[0]!.scene = "SCN-404";
          index.continuity.push(claim);
        },
      ],
      [
        "screenplay-claim-misowned",
        (index) => {
          index.continuity.push({
            ...continuityClaim(),
            verification: "acceptance",
          });
        },
      ],
      // Downstream citations. The shot contract the fixture keeps cites
      // SCN-001, so dropping that scene is what strands the citation.
      [
        "screenplay-citation-scene-absent",
        (index) => {
          index.screenplay.scenes = index.screenplay.scenes.filter(
            (entry) => entry.id !== "SCN-001",
          );
        },
      ],
    ];
    const observed: Record<string, boolean> = {};
    for (const [code, mutate] of cases) observed[code] = fires(code, mutate)();
    TestValidator.equals(
      "every ledger obligation refuses the record that breaks it",
      observed,
      Object.fromEntries(cases.map(([code]) => [code, true])),
    );

    // The negative twin for the whole set: restoring the record clears every
    // A claim citation lives on the downstream record rather than in the
    // index, so this one case reaches for the shot contract itself.
    fs.writeFileSync(indexFile, original);
    const contractFile = [
      path.join(
        fixture.root,
        ".automovie/design/fixture-film/shots/opening.json",
      ),
      path.join(fixture.root, ".automovie/design/shots/opening.json"),
    ].find((file) => fs.existsSync(file))!;
    const originalContract = fs.readFileSync(contractFile, "utf8");
    const contract = JSON.parse(originalContract) as {
      evidence?: Array<{ reason: string; scene: string; claim?: string }>;
    };
    contract.evidence![0]!.claim = "CLAIM-404";
    fs.writeFileSync(contractFile, `${JSON.stringify(contract, null, 2)}\n`);
    TestValidator.predicate(
      "a downstream record citing an undeclared claim is refused",
      new Set(
        reopen()
          .compile({ scope: "design" })
          .diagnostics.map((item) => item.code),
      ).has("screenplay-citation-claim-absent"),
    );
    fs.writeFileSync(contractFile, originalContract);
    const restored = new Set(
      reopen()
        .compile({ scope: "design" })
        .diagnostics.map((item) => item.code),
    );
    TestValidator.predicate(
      "restoring the ledger clears every ledger diagnostic",
      cases.every(([code]) => restored.has(code) === false),
    );
  } catch (error) {
    failure = { error };
    throw error;
  } finally {
    preserveScreenplayLedgerFixtureCleanup(failure, () => fixture.dispose());
  }
};
