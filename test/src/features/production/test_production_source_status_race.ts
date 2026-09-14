import { TestValidator } from "@nestia/e2e";

import {
  SCREENPLAY_DOCUMENT,
  createSourceStatusWorld,
  runsPerCall,
  textDigest,
} from "./sourceStatusFixtures";

/** Gate runs at two boundaries after one arrangement applied to a fresh world. */
const runsAfter = (
  arrange: (world: ReturnType<typeof createSourceStatusWorld>) => void,
): number[] => {
  const world = createSourceStatusWorld();
  arrange(world);
  return runsPerCall(world, world.status(), 2).runs;
};

/**
 * A success is reused only when it is provably the answer for one snapshot.
 *
 * The gate reads its inputs at different moments of one run, and a concurrent
 * edit can land between them. The snapshot read before the run and the one read
 * after it must agree on every input except documents, every document the run
 * read must still read the same afterwards, and the answer must name the same
 * revision and input identity as that snapshot, which the resident generated
 * manifest must record too. Otherwise the success may describe a state that
 * never existed at once, so it is returned but not reused.
 *
 * Scenarios:
 *
 * 1. A run with no concurrent edit is reused at the next boundary.
 * 2. A screenplay index, generated output or revision that moves after the gate
 *    answered is not reused, and neither is an answer whose later snapshot
 *    cannot be read.
 * 3. A document edited after the gate read it is not reused, and neither is a
 *    document the gate read twice with different text even when it is restored
 *    before the run ends.
 * 4. An answer whose revision or input fingerprint differs from the snapshot read
 *    after it is not reused, and neither is a snapshot whose generated manifest
 *    records another compile's fingerprint.
 */
export const test_production_source_status_race = (): void => {
  TestValidator.equals(
    "a run with no concurrent edit is reused",
    runsAfter(() => undefined),
    [1, 0],
  );

  TestValidator.equals(
    "inputs that move while the gate runs block reuse",
    {
      screenplay: runsAfter((world) => {
        world.hooks.afterAnswer = () => {
          world.state.screenplay = "treatment and scene index v2";
          world.hooks.afterAnswer = () => undefined;
        };
      }),
      generated: runsAfter((world) => {
        world.hooks.afterAnswer = () => {
          world.state.generated = "compiled by a concurrent run";
          world.hooks.afterAnswer = () => undefined;
        };
      }),
      revision: runsAfter((world) => {
        world.hooks.afterAnswer = () => {
          world.state.revision += 1;
          world.hooks.afterAnswer = () => undefined;
        };
      }),
      unreadableAfter: runsAfter((world) => {
        world.hooks.afterAnswer = () => {
          world.state.incomplete = true;
          world.hooks.afterAnswer = () => undefined;
          world.hooks.beforeRead = () => {
            world.state.incomplete = false;
          };
        };
      }),
    },
    {
      screenplay: [1, 1],
      generated: [1, 1],
      revision: [1, 1],
      unreadableAfter: [1, 1],
    },
  );

  TestValidator.equals(
    "a document that moved around the gate's read blocks reuse",
    {
      editedAfterRead: runsAfter((world) => {
        world.hooks.afterRead = () => {
          world.state.documents.set(SCREENPLAY_DOCUMENT, "EXT. PIER - DAWN");
          world.hooks.afterRead = () => undefined;
        };
      }),
      readTwiceDifferently: runsAfter((world) => {
        const original = world.state.documents.get(SCREENPLAY_DOCUMENT)!;
        world.state.read = [SCREENPLAY_DOCUMENT, SCREENPLAY_DOCUMENT];
        world.hooks.read = (index) => {
          if (index === 1)
            world.state.documents.set(SCREENPLAY_DOCUMENT, "EXT. PIER - DAWN");
        };
        world.hooks.afterRead = () => {
          world.state.documents.set(SCREENPLAY_DOCUMENT, original);
          world.hooks.read = () => undefined;
          world.hooks.afterRead = () => undefined;
        };
      }),
    },
    { editedAfterRead: [1, 1], readTwiceDifferently: [1, 1] },
  );

  TestValidator.equals(
    "an answer that names another snapshot is not reused",
    {
      revision: runsAfter((world) => {
        world.hooks.output = (output) => {
          output.revision -= 1;
        };
      }),
      inputFingerprint: runsAfter((world) => {
        world.hooks.output = (output) => {
          output.builder.inputFingerprint = textDigest("initial evidence");
        };
      }),
      generatedManifest: runsAfter((world) => {
        world.hooks.snapshot = (snapshot) => {
          snapshot.generated.inputFingerprint = textDigest("another compile");
        };
      }),
    },
    { revision: [1, 1], inputFingerprint: [1, 1], generatedManifest: [1, 1] },
  );
};
