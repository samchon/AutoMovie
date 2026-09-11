import { TestValidator } from "@nestia/e2e";

import { createPortraitWebBuildGate } from "../../../scripts/face-review/web/logic.mjs";

/**
 * Source writes coalesce while the exporter has exclusive ownership of its run.
 * Scenarios:
 * 1. An empty queue cannot start; repeated requests produce one build.
 * 2. Requests during that build cannot overlap it and require one follow-up.
 * 3. Completing the follow-up empties the queue and admits a later new request.
 */
export const test_subject_face_web_rebuild = (): void => {
  const gate = createPortraitWebBuildGate();
  TestValidator.equals("empty queue", gate.start(), false);
  gate.request();
  gate.request();
  TestValidator.equals("coalesced start", gate.start(), true);
  TestValidator.equals("no concurrent exporter", gate.start(), false);
  gate.request();
  gate.request();
  TestValidator.equals("write cannot overlap", gate.start(), false);
  TestValidator.equals("follow-up owed", gate.finish(), true);
  TestValidator.equals("follow-up start", gate.start(), true);
  TestValidator.equals("follow-up complete", gate.finish(), false);
  TestValidator.equals("queue is empty", gate.start(), false);
  gate.request();
  TestValidator.equals("new later run", gate.start(), true);
  TestValidator.equals("later run complete", gate.finish(), false);
};
