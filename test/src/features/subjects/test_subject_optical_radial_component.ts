import {
  type IPortraitEyeShape,
  createPortraitEyeComponent,
} from "@automovie/human/components/eyes";
import { portraitNormals } from "@automovie/human/geometry/geometry";
import { TestValidator } from "@nestia/e2e";

import {
  portraitEyeShape,
  portraitEyeSockets,
} from "../../subjects/generated-korean-girl-01/configuration";
import { referenceControlNet } from "../../subjects/generated-korean-girl-01/controlNet";
import { portraitEyelashEyeFixture } from "../internal/portraitEyelashFixture";
import { throwsError } from "../internal/predicates";

/**
 * The radial choice reaches the component's real corneal contact and optical
 * finishers without silently changing old documents.
 *
 * Scenarios:
 * 1. Explicit head-plane equals omission. Radial static optics have a complete
 *    globe, independent of later caller edits, and finite iris/cornea buffers.
 * 2. Half-blink and gaze retain finite resident optics. Final skin contact runs
 *    both with and without performance against the same radial shell.
 * 3. Unknown frames, aperture clipping and missing corneal contact refuse.
 */
export const test_subject_optical_radial_component = (): void => {
  const host = { ...referenceControlNet, viewRay: [0, 0, 1] };
  const base: IPortraitEyeShape = {
    ...portraitEyeShape,
    skinAttachment: undefined,
    skinBridge: undefined,
    browFibres: 0,
    upperLashes: 1,
    sampling: { eyeColumns: 8, eyeRows: 4, irisColumns: 8, irisRows: 2 },
  };
  const build = (shape: IPortraitEyeShape) =>
    portraitEyelashEyeFixture(
      createPortraitEyeComponent(portraitEyeSockets[0], shape),
      host,
    );
  const old = build(base);
  TestValidator.equals(
    "legacy frame exact",
    build({ ...base, opticalFrame: "head-plane" }),
    old,
  );
  const input: IPortraitEyeShape = { ...base, opticalFrame: "radial" };
  const component = createPortraitEyeComponent(portraitEyeSockets[0], input);
  input.opticalFrame = "head-plane";
  const radial = portraitEyelashEyeFixture(component, host);
  TestValidator.equals(
    "radial choice owned",
    radial,
    build({ ...base, opticalFrame: "radial" }),
  );
  const globe = (result: typeof old) =>
    result.parts.find((p) => p.id === "right-sclera")!.geometry;
  const a = globe(old),
    b = globe(radial);
  TestValidator.predicate(
    "static radial globe is complete",
    a.type === "mesh" &&
      b.type === "mesh" &&
      a.mesh.positions.length !== b.mesh.positions.length,
  );
  for (const performance of [
    undefined,
    { blink: 0.5, observedBlink: 0, yaw: 3, pitch: 2 },
  ]) {
    const eye = createPortraitEyeComponent(
      portraitEyeSockets[0],
      { ...base, opticalFrame: "radial" },
      performance,
    );
    const plan = eye.fit(host),
      targets = new Map(plan.constraints.map((c) => [c.vertex, c.target]));
    const positions = host.positions.map((p, i) => [...(targets.get(i) ?? p)]);
    const cage = { positions, indices: [] as number[], groups: [] as number[] };
    const attached = plan.attach(cage, positions, () => 1);
    const contacts = attached.finalSurface!({
      ...cage,
      normals: portraitNormals(cage.positions.flat(), cage.indices),
    });
    TestValidator.predicate(
      "radial contact emits finite targets",
      contacts.every((t) => t.target.every(Number.isFinite)),
    );
    const parts = attached.finish(cage);
    TestValidator.predicate(
      "radial performed optics finite",
      parts.length > 0 &&
        parts.every(
          (p) =>
            p.geometry.type === "mesh" &&
            p.geometry.mesh.positions.every(Number.isFinite),
        ),
    );
  }
  for (const patch of [
    { opticalFrame: "invalid" as "radial" },
    { opticalFrame: "radial" as const, cornealBoundary: "aperture" as const },
    { opticalFrame: "radial" as const, lidContact: undefined },
  ])
    TestValidator.predicate(
      "invalid radial mode refuses",
      throwsError(
        () =>
          createPortraitEyeComponent(portraitEyeSockets[0], {
            ...base,
            ...patch,
          }),
        "Radial optics",
      ),
    );
};
