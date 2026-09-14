import { createHumanPreviewBuilder } from "@automovie/playground/src/human/previewBuilder";
import { TestValidator } from "@nestia/e2e";

import {
  createHumanPanelFixture,
  humanPanelAsset,
} from "./createHumanPanelFixture";

type PreviewWorker = ReturnType<
  Parameters<
    typeof createHumanPreviewBuilder<ReturnType<typeof humanPanelAsset>>
  >[0]["worker"]
>;

/** Exercise refusal through the real panel and decoder-generation owner using in-memory worker ports. */
export async function assertHumanPanelRefusal(
  refuse: (
    fixture: ReturnType<typeof createHumanPanelFixture>,
  ) => Promise<void>,
): Promise<void> {
  let decoding!: () => void;
  const started = new Promise<undefined>((resolve) => {
    decoding = () => resolve(undefined);
  });
  let finish!: (model: ReturnType<typeof humanPanelAsset>) => void;
  let count = 0;
  const disposed: string[] = [];
  const builder = createHumanPreviewBuilder({
    worker: () => {
      const worker: PreviewWorker = {
        onError: (_message: string): void => {},
        onReply: (): void => {},
        send: (): void => {
          worker.onReply({ success: true, ...humanPanelAsset("worker") });
        },
        terminate: (): void => {},
      };
      return worker;
    },
    decode: async () => {
      if (++count === 2) {
        decoding();
        return new Promise<ReturnType<typeof humanPanelAsset>>((resolve) => {
          finish = resolve;
        });
      }
      return humanPanelAsset("current");
    },
    dispose: (model) => {
      disposed.push(model.id);
    },
  });
  const f = createHumanPanelFixture({
    build: builder.build,
    cancel: builder.cancel,
  });
  try {
    await f.panel.ready;
    const before = f.panel.snapshot()!;
    const pending = f.change("trait-eyeWidth", "0.3");
    await started;
    TestValidator.equals(
      "decoder is genuinely pending",
      f.panel.snapshot()!.status,
      "building",
    );
    await refuse(f);
    const message = f.element("face-status").textContent;
    TestValidator.equals(
      "refusal visible",
      f.element("face-status").dataset.state,
      "error",
    );
    TestValidator.equals(
      "pending authority withdrawn",
      f.panel.snapshot()!.status,
      "ready",
    );
    finish(humanPanelAsset("obsolete"));
    await pending;
    TestValidator.equals("obsolete decoder released", disposed, ["obsolete"]);
    TestValidator.equals(
      "last committed pair and history survive",
      f.panel.snapshot(),
      before,
    );
    TestValidator.equals("obsolete edit is not published", f.published, [
      "current",
    ]);
    TestValidator.equals(
      "late completion retains refusal",
      f.element("face-status").textContent,
      message,
    );
    TestValidator.equals("refusal cancelled active work", f.cancellations(), 2);
    await f.change("trait-eyeHeight", "0.2");
    const expected = structuredClone(before.document);
    expected.controls = { eyeHeight: 0.2 };
    TestValidator.equals(
      "retry does not inherit abandoned draft",
      f.panel.snapshot()!.document,
      expected,
    );
    TestValidator.equals(
      "retry clears visible failure",
      f.element("face-status").dataset.state,
      "ready",
    );
  } finally {
    f.dom.window.close();
  }
}
