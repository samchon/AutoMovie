import {
  createPortraitEyeComponent,
  humanFaceDetailValue,
  parseHumanFaceDocument,
  resolveHumanFaceDocument,
  serializeHumanFaceDocument,
  setHumanFaceDetail,
} from "@automovie/human";
import { TestValidator } from "@nestia/e2e";

import { humanFaceFixture } from "../internal/humanFaceFixture";
import { throwsError } from "../internal/predicates";

/**
 * The brow-foundation slider is a retained document override, not a rewritten
 * photograph basis or a surface displacement added after eyelid construction.
 *
 * Scenarios:
 * 1. A signed detail survives JSON and changes both eyes' outer fitting targets
 *    while every original aperture point and source observation stays exact.
 * 2. Removing that detail restores the complete resolved neutral host. Its
 *    symmetric frame owner refuses an independent eye-side selector.
 * 3. Both signed limits admit, while immediately adjacent/nonfinite values refuse.
 */
export const test_subject_human_brow_foundation = (): void => {
  const document = humanFaceFixture();
  const source = structuredClone(document);
  const edited = setHumanFaceDetail(document, "frame.browProjection", -3);
  const replay = parseHumanFaceDocument(serializeHumanFaceDocument(edited));
  TestValidator.equals(
    "retained signed override",
    humanFaceDetailValue(replay, "frame.browProjection"),
    -3,
  );
  TestValidator.equals("source document unchanged", document, source);
  TestValidator.equals("observed basis unchanged", replay.basis, source.basis);
  const neutral = resolveHumanFaceDocument(document),
    changed = resolveHumanFaceDocument(replay);
  for (const side of ["right", "left"] as const) {
    const socket = changed.bindings.eyes[side];
    for (const id of [...socket.top, ...socket.bottom, socket.iris])
      TestValidator.equals(
        "optical input unchanged",
        changed.host.positions[id],
        neutral.host.positions[id],
      );
    const before = createPortraitEyeComponent(socket, neutral[side].eye).fit(
      neutral.host,
    );
    const after = createPortraitEyeComponent(socket, changed[side].eye).fit(
      changed.host,
    );
    TestValidator.predicate(
      "eyelid reads new foundation",
      socket.top
        .slice(1, -1)
        .some(
          (id) =>
            before.constraints.find((c) => c.vertex === id)!.target[2] !==
            after.constraints.find((c) => c.vertex === id)!.target[2],
        ),
    );
  }
  const restored = setHumanFaceDetail(
    replay,
    "frame.browProjection",
    undefined,
  );
  TestValidator.equals(
    "reset is exact",
    resolveHumanFaceDocument(restored).host,
    neutral.host,
  );
  TestValidator.predicate(
    "one bilateral foundation owner",
    throwsError(() =>
      setHumanFaceDetail(document, "frame.browProjection", 2, "left"),
    ),
  );
  for (const value of [-8, 8])
    setHumanFaceDetail(document, "frame.browProjection", value);
  for (const value of [-8.001, 8.001, NaN, Infinity])
    TestValidator.predicate(
      "bounded foundation input",
      throwsError(() =>
        setHumanFaceDetail(document, "frame.browProjection", value),
      ),
    );
};
