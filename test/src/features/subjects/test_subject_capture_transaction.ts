import { TestValidator } from "@nestia/e2e";
import { createHash } from "node:crypto";

import { runPortraitCaptureDiagnostic } from "../../subjects/portraitCaptureDiagnostic";
import { createPortraitCaptureFixture } from "../internal/createPortraitCaptureFixture";
import { rejectsError } from "../internal/predicates";

/**
 * Capture publication owns one lease from initial reads through final writes.
 * This tests typed transaction ports in memory, without filesystem semantics.
 *
 * Scenarios:
 * 1. A coherent generation publishes only while its lease is held.
 * 2. Same-GLB recapture with another renderer or reference image refuses output.
 * 3. Acquire/read/inference/write failures release only an acquired lease.
 */
export const test_subject_capture_transaction = async (): Promise<void> => {
  for (const failure of [
    "none",
    "renderer",
    "pixels",
    "recapture",
    "acquire",
    "read",
    "observe",
    "publish",
  ] as const) {
    const fixture = createPortraitCaptureFixture();
    let held = false,
      releases = 0,
      writes = 0,
      reads = 0;
    const events: string[] = [];
    const run = () =>
      runPortraitCaptureDiagnostic({
        expected: fixture.expected,
        acquire: async () => {
          events.push("acquire");
          if (failure === "acquire") throw new Error("lease unavailable");
          held = true;
          return async () => {
            held = false;
            releases++;
            events.push("release");
          };
        },
        read: async () => {
          TestValidator.equals("read while leased", held, true);
          reads++;
          events.push("read");
          if (failure === "read") throw new Error("read failed");
          return structuredClone(fixture.bytes);
        },
        observe: async () => {
          TestValidator.equals("observe while leased", held, true);
          events.push("observe");
          if (failure === "observe") throw new Error("observation failed");
          if (failure === "renderer") fixture.receipt.renderer.version = "two";
          if (failure === "pixels")
            fixture.bytes.reference = Buffer.from(
              "new pixels without new receipt",
            );
          if (failure === "recapture") {
            fixture.bytes.reference = Buffer.from(
              "new coherently captured pixels",
            );
            fixture.receipt.captures.find(
              (frame) => frame.name === "reference",
            )!.sha256 = createHash("sha256")
              .update(fixture.bytes.reference)
              .digest("hex");
          }
          fixture.seal();
          return "observation";
        },
        publish: async (result, generation) => {
          TestValidator.equals("write while leased", held, true);
          TestValidator.equals("result retained", result, "observation");
          TestValidator.equals(
            "generation digest supplied",
            generation.length,
            64,
          );
          events.push("publish");
          if (failure === "publish") throw new Error("write failed");
          writes++;
        },
      });
    if (failure === "none") {
      TestValidator.equals("returned observation", await run(), "observation");
      TestValidator.equals("whole transaction order", events, [
        "acquire",
        "read",
        "observe",
        "read",
        "publish",
        "release",
      ]);
    } else
      TestValidator.predicate("refuse " + failure, await rejectsError(run));
    TestValidator.equals("lease no longer held", held, false);
    TestValidator.equals(
      "only owner releases",
      releases,
      failure === "acquire" ? 0 : 1,
    );
    TestValidator.equals(
      "no stale successful write",
      writes,
      failure === "none" ? 1 : 0,
    );
    TestValidator.equals(
      "read population",
      reads,
      failure === "acquire"
        ? 0
        : failure === "read" || failure === "observe"
          ? 1
          : 2,
    );
  }
};
