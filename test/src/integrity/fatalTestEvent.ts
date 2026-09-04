export type FatalTestEventKind =
  | "uncaught exception"
  | "unhandled rejection"
  | "critical error";

export interface IFatalTestEvent {
  kind: FatalTestEventKind;
  diagnostic: string;
}

export interface IFatalTestEventDependencies {
  report: (event: IFatalTestEvent) => void;
  writeStatus: (status: 1) => void;
}

const diagnosticOf = (value: unknown): string => {
  if (value instanceof Error)
    return value.stack ?? `${value.name}: ${value.message}`;
  if (typeof value === "string") return value;
  try {
    const encoded = JSON.stringify(value);
    return encoded === undefined ? String(value) : encoded;
  } catch {
    try {
      return String(value);
    } catch {
      return "[unprintable fatal value]";
    }
  }
};

/** Create one fail-closed reporter shared by every fatal runner boundary. */
export const createFatalTestEventHandler = (
  dependencies: IFatalTestEventDependencies,
): ((kind: FatalTestEventKind, value: unknown) => void) => {
  let reported = false;
  return (kind, value): void => {
    dependencies.writeStatus(1);
    if (reported) return;
    reported = true;
    dependencies.report({ kind, diagnostic: diagnosticOf(value) });
  };
};
