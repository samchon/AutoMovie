import {
  isAutoMovieEvidenceIdentityFile,
  readAutoMovieProductionPackageIdentity,
} from "@automovie/evidence";
import { TestValidator } from "@nestia/e2e";

import { throwsError } from "../internal/predicates";

interface IStatEntry {
  isFile(): boolean;
  isSymbolicLink(): boolean;
  nlink: bigint;
}

const statEntry = (props: {
  file?: boolean;
  link?: boolean;
  nlink?: bigint;
}): IStatEntry => ({
  isFile: () => props.file ?? true,
  isSymbolicLink: () => props.link ?? false,
  nlink: props.nlink ?? 1n,
});

const manifest = '{"name":"film","description":"a blocking pass"}';

/**
 * The project identity manifest is admitted by its own decision: one regular,
 * non-symlink file at a fixed path, with no directory-entry count.
 *
 * The contract states why the count is absent rather than merely relaxed. The
 * manifest is read once from a fixed path, so it can never be enumerated as a
 * second owner of one set of bytes, and an alias whose bytes are identical
 * yields the same name and description. A symbolic link stays refused because
 * it would admit a manifest from outside the project root, and an entry that is
 * not a regular file carries no manifest bytes at all.
 *
 * Scenarios:
 *
 * 1. A manifest named by a second directory entry is admitted and yields the
 *    identical result as a single-entry manifest. This is the exact input the
 *    shared population predicate refused.
 * 2. A symbolic link is refused, naming the regular non-symlink requirement.
 * 3. An entry that is not a regular file is refused the same way.
 * 4. The predicate answers both sides of each of its two conditions.
 * 5. A host observation failure propagates unchanged instead of becoming a
 *    named admission refusal.
 * 6. Manifest diagnostics are unchanged: invalid JSON throws, an absent or
 *    blank name is refused, and a description is trimmed or absent.
 */
export const test_evidence_package_identity_admission = (): void => {
  const linked = readAutoMovieProductionPackageIdentity("/project", {
    read: () => manifest,
    stat: () => statEntry({ nlink: 2n }),
  });
  TestValidator.equals(
    "a second directory entry does not change package identity",
    linked,
    { packageName: "film", description: "a blocking pass" },
  );
  TestValidator.equals(
    "one directory entry yields the identical identity",
    readAutoMovieProductionPackageIdentity("/project", {
      read: () => manifest,
      stat: () => statEntry({ nlink: 1n }),
    }),
    linked,
  );

  for (const entry of [
    statEntry({ link: true }),
    statEntry({ file: false }),
    statEntry({ file: false, link: true }),
  ])
    TestValidator.predicate(
      "only a regular non-symlink manifest is admitted",
      throwsError(
        () =>
          readAutoMovieProductionPackageIdentity("/project", {
            read: () => manifest,
            stat: () => entry,
          }),
        ["package identity must be one regular, non-symlink file"],
      ),
    );

  TestValidator.equals(
    "a regular non-symlink entry is admitted",
    isAutoMovieEvidenceIdentityFile(statEntry({})),
    true,
  );
  TestValidator.equals(
    "a symbolic link is not an identity manifest",
    isAutoMovieEvidenceIdentityFile(statEntry({ link: true })),
    false,
  );
  TestValidator.equals(
    "a non-regular entry is not an identity manifest",
    isAutoMovieEvidenceIdentityFile(statEntry({ file: false })),
    false,
  );

  const denied = Object.assign(new Error("denied"), { code: "EACCES" });
  let observed: unknown = "not thrown";
  try {
    readAutoMovieProductionPackageIdentity("/project", {
      read: () => manifest,
      stat: () => {
        throw denied;
      },
    });
  } catch (error) {
    observed = error;
  }
  TestValidator.predicate(
    "a host observation failure is not an admission refusal",
    observed === denied,
  );

  TestValidator.predicate(
    "invalid manifest bytes are not a package identity",
    throwsError(() =>
      readAutoMovieProductionPackageIdentity("/project", {
        read: () => "{",
        stat: () => statEntry({}),
      }),
    ),
  );
  for (const absent of ["{}", '{"name":"   "}', '{"name":7}'])
    TestValidator.predicate(
      "a manifest without a usable name is refused",
      throwsError(
        () =>
          readAutoMovieProductionPackageIdentity("/project", {
            read: () => absent,
            stat: () => statEntry({}),
          }),
        ["package.json declares no package name"],
      ),
    );
  TestValidator.equals(
    "a description is trimmed and an absent one is empty",
    [
      readAutoMovieProductionPackageIdentity("/project", {
        read: () => '{"name":"film","description":"  spaced  "}',
        stat: () => statEntry({}),
      }).description,
      readAutoMovieProductionPackageIdentity("/project", {
        read: () => '{"name":"film"}',
        stat: () => statEntry({}),
      }).description,
      readAutoMovieProductionPackageIdentity("/project", {
        read: () => '{"name":"film","description":7}',
        stat: () => statEntry({}),
      }).description,
    ],
    ["spaced", "", ""],
  );
};
