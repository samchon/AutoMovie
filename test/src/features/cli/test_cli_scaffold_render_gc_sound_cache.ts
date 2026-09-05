import { TestValidator } from "@nestia/e2e";
import path from "node:path";

import { loadSourceModule } from "../internal/loadSourceModule";
import { throwsError } from "../internal/predicates";
import {
  type IRenderGcCandidateFixture,
  type IRenderGcSnapshotFixture,
  renderGcDigest,
  renderGcSnapshot,
} from "../internal/renderGcFixtures";

interface ISoundCacheModule {
  inventoryProductionSoundCaches: (props: {
    productionStateRoot: string;
    seams: {
      assertCaptured: (snapshot: IRenderGcSnapshotFixture) => void;
      captureTarget: (base: string, target: string) => IRenderGcSnapshotFixture;
    };
  }) => Array<{
    candidate: IRenderGcCandidateFixture;
    snapshot: IRenderGcSnapshotFixture;
  }>;
}

const unit = loadSourceModule<ISoundCacheModule>(
  path.resolve(
    __dirname,
    "../../../../packages/template/scaffold/scripts/soundCacheSnapshot.ts",
  ),
);

const stateRoot = path.join("production");
const dialogueRoot = path.join(stateRoot, "audio-cache", "kokoro");
const modelRoot = path.join(stateRoot, "model-cache", "kokoro");
const missing = (code: string): Error =>
  Object.assign(new Error(`${code}: no such cache root`), { code });

/**
 * The sound cache inventory reads each cache root as one GC ownership root:
 * every direct child is a generation except GC's own preserved directories,
 * and a root that is absent contributes nothing while a root that fails any
 * other way refuses the inventory.
 *
 * Scenarios:
 *
 * 1. A dialogue root missing with ENOENT and a model root missing with ENOTDIR
 *    both yield no candidates.
 * 2. Any other capture failure of a root is rethrown, and a root that captured
 *    as a file is refused as not a directory.
 * 3. Direct children become typed candidates whose digest, bytes, generation,
 *    and fingerprint come from their own capture; the root entry, nested
 *    entries, and the removal staging GC wrote beside the generations are not
 *    candidates; the root is revalidated after its children were captured.
 */
export const test_cli_scaffold_render_gc_sound_cache = (): void => {
  const inventory = (
    captureTarget: (base: string, target: string) => IRenderGcSnapshotFixture,
  ) => {
    const revalidated: string[] = [];
    const entries = unit.inventoryProductionSoundCaches({
      productionStateRoot: stateRoot,
      seams: {
        assertCaptured: (snapshot) => revalidated.push(snapshot.target),
        captureTarget,
      },
    });
    return { entries, revalidated };
  };

  TestValidator.equals(
    "absent cache roots contribute nothing",
    inventory((_base, target) => {
      throw missing(target === dialogueRoot ? "ENOENT" : "ENOTDIR");
    }),
    { entries: [], revalidated: [] },
  );

  TestValidator.equals(
    "any other root failure refuses the inventory",
    {
      unreadable: throwsError(
        () =>
          inventory(() => {
            throw missing("EACCES");
          }),
        "EACCES",
      ),
      file: throwsError(
        () =>
          inventory((base, target) =>
            renderGcSnapshot(base, target, { kind: "file" }),
          ),
        'Sound cache root "audio-cache/kokoro" is not a directory.',
      ),
    },
    { unreadable: true, file: true },
  );

  const generation = renderGcSnapshot(
    dialogueRoot,
    path.join(dialogueRoot, "gen-a"),
    {
      bytes: 7,
      contentFingerprint: renderGcDigest("a"),
      kind: "directory",
      targetIdentity: "dev\0gen-a",
    },
  );
  TestValidator.equals(
    "direct generations are candidates and GC's own staging is not",
    inventory((base, target) => {
      if (target === modelRoot) throw missing("ENOENT");
      if (target === dialogueRoot)
        return renderGcSnapshot(base, target, {
          entries: [
            { identity: "root", kind: "directory", path: "" },
            { identity: "gen-a", kind: "directory", path: "gen-a" },
            { identity: "nested", kind: "file", path: "gen-a/voice.wav" },
            {
              identity: "staging",
              kind: "directory",
              path: ".gc-preserved-removal-staging",
            },
          ],
          kind: "directory",
        });
      if (target === generation.target) return generation;
      throw new Error(`fixture cannot capture "${target}"`);
    }),
    {
      entries: [
        {
          candidate: {
            path: "audio-cache/kokoro/gen-a",
            kind: "dialogue-cache",
            digest: renderGcDigest("a"),
            bytes: 7,
            generation: "dev\0gen-a",
            fingerprint: renderGcDigest("a"),
            observation: null,
          },
          snapshot: generation,
        },
      ],
      revalidated: [dialogueRoot],
    },
  );
};
