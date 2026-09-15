import { TestValidator } from "@nestia/e2e";

import { createHumanPanelFixture } from "../internal/createHumanPanelFixture";

/**
 * A failed initial read cannot label an absent face as a loaded catalogue subject.
 *
 * Scenarios:
 * 1. Read rejection before any committed model displays its error and clears
 *    the subject selector without creating a document or downloadable asset.
 */
export const test_subject_human_panel_initial_read_error =
  async (): Promise<void> => {
    const f = createHumanPanelFixture({
      read: async () => {
        throw new Error("source unavailable");
      },
    });
    try {
      await f.panel.ready;
      TestValidator.equals(
        "read error displayed",
        f.element("face-status").textContent,
        "source unavailable",
      );
      TestValidator.equals(
        "no falsely selected subject",
        f.element<HTMLSelectElement>("face-subject").value,
        "",
      );
      TestValidator.equals(
        "no committed document",
        f.panel.snapshot(),
        undefined,
      );
    } finally {
      f.dom.window.close();
    }
  };
