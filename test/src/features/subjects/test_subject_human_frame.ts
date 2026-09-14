import { resolveHumanFaceDocument } from "@automovie/human";
import { TestValidator } from "@nestia/e2e";

import { humanFaceFixture } from "../internal/humanFaceFixture";
import { nclose, throwsError } from "../internal/predicates";

/**
 * Facial proportions and downstream cranial/hinge attachments share one basis.
 *
 * Scenarios:
 * 1. Intermediate width/length change the resolved frame and common host together.
 * 2. Exact detail takes precedence and is independent of interaction order.
 * 3. Jaw hinges receive the same frame; original observations are unchanged.
 * 4. Invalid combined dimensions refuse rather than clamp or fall back.
 */
export const test_subject_human_frame = (): void => {
  const document = humanFaceFixture();
  document.basis.bindings.jawHinge = { x: 0, y: 0, z: -45 };
  document.controls = { faceWidth: 0.1, faceLength: 0.1 };
  const original = structuredClone(document),
    face = resolveHumanFaceDocument(document);
  TestValidator.predicate(
    "trait reaches detailed width",
    nclose(face.recipe.frame!.widthScale!, 1.1),
  );
  TestValidator.predicate(
    "trait reaches detailed length",
    nclose(face.recipe.frame!.lengthScale!, 1.1),
  );
  TestValidator.predicate(
    "host changed",
    face.host.positions[152][1] !== document.basis.host.positions[152][1],
  );
  TestValidator.predicate(
    "hinge shares frame",
    nclose(
      face.bindings.jawHinge!.y,
      -document.basis.host.positions[168][1] * 0.1,
    ),
  );
  TestValidator.equals("source preserved", document, original);
  document.detail = { frame: { widthScale: 1, lengthScale: 1 } };
  const overridden = resolveHumanFaceDocument(document);
  TestValidator.equals(
    "details restore exact observations",
    overridden.host,
    document.basis.host,
  );
  TestValidator.equals(
    "hinge restores",
    overridden.bindings,
    document.basis.bindings,
  );
  document.basis.recipe.frame = { widthScale: 1.3 };
  delete document.detail;
  TestValidator.predicate(
    "combined width refuses",
    throwsError(() => resolveHumanFaceDocument(document)),
  );
};
