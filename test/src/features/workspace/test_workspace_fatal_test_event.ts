import { TestValidator } from "@nestia/e2e";

import {
  type FatalTestEventKind,
  type IFatalTestEvent,
  createFatalTestEventHandler,
} from "../../integrity/fatalTestEvent";

const capture = (kind: FatalTestEventKind, value: unknown): IFatalTestEvent => {
  let captured: IFatalTestEvent | undefined;
  createFatalTestEventHandler({
    report: (event) => {
      captured = event;
    },
    writeStatus: () => undefined,
  })(kind, value);
  return captured!;
};

export const test_workspace_fatal_test_event = (): void => {
  const events: IFatalTestEvent[] = [];
  const statuses: number[] = [];
  const fatal = createFatalTestEventHandler({
    report: (event) => events.push(event),
    writeStatus: (status) => statuses.push(status),
  });
  const exception = new Error("boom");
  fatal("uncaught exception", exception);
  fatal("unhandled rejection", "rejected");
  fatal("critical error", { reason: "late" });
  TestValidator.equals(
    "every fatal boundary writes failure status",
    statuses,
    [1, 1, 1],
  );
  TestValidator.equals(
    "the first fatal event is reported exactly once",
    events,
    [
      {
        kind: "uncaught exception",
        diagnostic: exception.stack!,
      },
    ],
  );

  const stackless = new Error("stackless");
  stackless.stack = undefined;
  const hostileError = new Error("hostile");
  Object.defineProperty(hostileError, "stack", {
    get: () => {
      throw new Error("stack unavailable");
    },
  });
  TestValidator.equals(
    "every fatal kind has a normalized diagnostic",
    [
      capture("unhandled rejection", "rejected"),
      capture("critical error", { answer: 42 }),
      capture("uncaught exception", stackless),
      capture("uncaught exception", hostileError),
      capture("critical error", undefined),
    ],
    [
      { kind: "unhandled rejection", diagnostic: "rejected" },
      { kind: "critical error", diagnostic: '{"answer":42}' },
      { kind: "uncaught exception", diagnostic: "Error: stackless" },
      {
        kind: "uncaught exception",
        diagnostic: "[unprintable fatal value]",
      },
      { kind: "critical error", diagnostic: "undefined" },
    ],
  );

  const circular: { self?: unknown } = {};
  circular.self = circular;
  TestValidator.equals(
    "a circular rejection falls back to safe string coercion",
    capture("unhandled rejection", circular),
    { kind: "unhandled rejection", diagnostic: "[object Object]" },
  );

  const unprintable: IFatalTestEvent[] = [];
  const hostile = {
    toJSON: (): never => {
      throw new Error("no json");
    },
    toString: (): never => {
      throw new Error("no string");
    },
  };
  unprintable.push(capture("critical error", hostile));
  TestValidator.equals("hostile values retain a safe diagnostic", unprintable, [
    { kind: "critical error", diagnostic: "[unprintable fatal value]" },
  ]);
};
