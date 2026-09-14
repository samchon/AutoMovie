import { sealPortraitContactSeams } from "@automovie/human";
import { TestValidator } from "@nestia/e2e";

import { contactSeamFixture } from "../internal/contactSeamFixture";
import { throwsError } from "../internal/predicates";

/**
 * Declared contact contracts an actual free rim and removes only its opposed commissural fold.
 *
 * Scenarios:
 * 1. Empty selection is identity; paired closure preserves input and the outside crop.
 * 2. A repeated seed is idempotent and the reversed two-face fold disappears together.
 * 3. Nonresident, non-simple, nonfinite, unpaired and partially paired boundaries refuse.
 * 4. Coincident faces with equal orientation or different material ownership refuse.
 */
export const test_subject_contact_seams = (): void => {
  const mesh = contactSeamFixture(),
    original = structuredClone(mesh);
  TestValidator.predicate(
    "empty closure is identity",
    sealPortraitContactSeams(mesh, []) === mesh,
  );
  const sealed = sealPortraitContactSeams(mesh, [6, 6]);
  TestValidator.equals("input ownership", mesh, original);
  TestValidator.equals(
    "one reversed pair removed",
    sealed.indices.length,
    mesh.indices.length - 6,
  );
  TestValidator.equals(
    "matching material population",
    sealed.groups.length * 3,
    sealed.indices.length,
  );
  TestValidator.equals(
    "original coordinates remain for anatomical finishers",
    sealed.positions,
    mesh.positions,
  );
  TestValidator.predicate(
    "outside crop untouched",
    [0, 1, 2, 3, 4, 5].every((id) => sealed.indices.includes(id)),
  );
  for (const seed of [-1, 99, NaN, 0.5])
    TestValidator.predicate(
      "seed guard",
      throwsError(() => sealPortraitContactSeams(mesh, [seed])),
    );
  const unmatched = structuredClone(mesh);
  unmatched.positions[10][1] = 1;
  unmatched.positions[11][1] = 1;
  TestValidator.predicate(
    "unpaired boundary",
    throwsError(() => sealPortraitContactSeams(unmatched, [6])),
  );
  unmatched.positions[10][1] = 0;
  TestValidator.predicate(
    "partially paired boundary",
    throwsError(() => sealPortraitContactSeams(unmatched, [6])),
  );
  const nonfinite = structuredClone(mesh);
  nonfinite.positions[6][2] = NaN;
  TestValidator.predicate(
    "finite contact",
    throwsError(() => sealPortraitContactSeams(nonfinite, [6])),
  );
  const nonsimple = structuredClone(mesh);
  nonsimple.positions.push([0, 3, 0], [1, 4, 0]);
  nonsimple.indices.push(6, 12, 13);
  nonsimple.groups.push(0);
  TestValidator.predicate(
    "boundary branching",
    throwsError(() => sealPortraitContactSeams(nonsimple, [6])),
  );
  const conflicting = structuredClone(mesh);
  conflicting.groups[conflicting.groups.length - 1] = 1;
  TestValidator.predicate(
    "contact material conflict",
    throwsError(() => sealPortraitContactSeams(conflicting, [6])),
  );
  const reversed = structuredClone(mesh);
  for (let i = 18; i < reversed.indices.length; i += 3)
    [reversed.indices[i + 1], reversed.indices[i + 2]] = [
      reversed.indices[i + 2],
      reversed.indices[i + 1],
    ];
  TestValidator.predicate(
    "equal oriented fold",
    throwsError(() => sealPortraitContactSeams(reversed, [6])),
  );
};
