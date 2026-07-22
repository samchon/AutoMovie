import { AutoMovieApplication } from "./AutoMovieApplication";
import { AutoMovieMcpFrameCapture } from "./dto";

/** Public operations routed through the compact execution gateway. */
export type AutoMovieExecutionOperation = Exclude<
  keyof AutoMovieApplication,
  "getGuideDocument" | "nextSteps" | "openProject"
>;

/** One strictly typed operation request accepted by {@link execute}. */
export type IAutoMovieExecutionCall = {
  [Operation in AutoMovieExecutionOperation]: {
    /** Exact {@link AutoMovieApplication} operation to run. */
    operation: Operation;
    /** That operation's validated input object. */
    input: Parameters<AutoMovieApplication[Operation]>[0];
  };
}[AutoMovieExecutionOperation];

/** Operation-tagged result returned by {@link execute}. */
export type IAutoMovieExecutionResult = {
  [Operation in AutoMovieExecutionOperation]: {
    /** Operation that produced this result. */
    operation: Operation;
    /** That operation's structured output. */
    output: Awaited<ReturnType<AutoMovieApplication[Operation]>>;
  };
}[AutoMovieExecutionOperation];

/** Single-object tool input carrying one discriminated operation call. */
export interface IAutoMovieExecuteInput {
  /** Operation branch to validate and execute. */
  call: IAutoMovieExecutionCall;
}

/** Single-object tool output carrying one operation-tagged result. */
export interface IAutoMovieExecuteOutput {
  /** Operation branch and its structured output. */
  result: IAutoMovieExecutionResult;
}

/**
 * AutoMovie's compact MCP gateway: a deterministic film engine built on "engine
 * enforces, model creates". Start with
 * `getGuideDocument({name:"AUTOMOVIE_OVERALL"})`, open resident memory with
 * `openProject`, ask `nextSteps` for the production ladder, and route every
 * other typed operation through `execute`. The coarse gateway advertises the
 * shared film type graph once, keeping the server usable in mainstream context
 * windows without weakening validation or deleting explicit mode.
 *
 * @author Samchon
 */
export class AutoMovieGatewayApplication {
  private readonly application: AutoMovieApplication;

  public constructor(props?: {
    /** Host-owned frame capture used by the `seeFrame` operation. */
    capture?: AutoMovieMcpFrameCapture;
    /** Project root to activate at startup; `openProject` may replace it. */
    projectRoot?: string;
  }) {
    this.application = new AutoMovieApplication(props);
  }

  /**
   * Fetch a film-authoring guide by exact name. Read `AUTOMOVIE_OVERALL` first,
   * then the guide named by the current ladder stage.
   *
   * @param props Exact guide document name.
   * @returns Markdown guide content.
   */
  public getGuideDocument(
    props: Parameters<AutoMovieApplication["getGuideDocument"]>[0],
  ): ReturnType<AutoMovieApplication["getGuideDocument"]> {
    return this.application.getGuideDocument(props);
  }

  /**
   * Open or create a resident project directory, the durable memory used by
   * later calls. Call this before `nextSteps` and resident operations.
   *
   * @param props Project root directory.
   * @returns The activated project's summary.
   */
  public openProject(
    props: Parameters<AutoMovieApplication["openProject"]>[0],
  ): ReturnType<AutoMovieApplication["openProject"]> {
    return this.application.openProject(props);
  }

  /**
   * Ask the active resident project for its current ladder status and the
   * ordered concrete calls that advance the film. Route every returned tool
   * name other than the three direct entry points through `execute`.
   *
   * @returns Missing prerequisites and next actions.
   */
  public nextSteps(): ReturnType<AutoMovieApplication["nextSteps"]> {
    return this.application.nextSteps();
  }

  /**
   * Execute one strictly typed AutoMovie operation. Select the `operation`
   * discriminator, then supply its matching `input`; the server validates the
   * selected branch with exact-property semantics. Results repeat the operation
   * beside its structured output. Use `getGuideDocument`, `openProject`, and
   * `nextSteps` directly instead of routing them here.
   *
   * @param props Discriminated operation and its matching input.
   * @returns The operation tag and that operation's structured output.
   */
  public async execute(
    props: IAutoMovieExecuteInput,
  ): Promise<IAutoMovieExecuteOutput> {
    const method = this.application[props.call.operation] as unknown as (
      input: typeof props.call.input,
    ) => unknown;
    const output = await method.call(this.application, props.call.input);
    return {
      result: {
        operation: props.call.operation,
        output,
      } as IAutoMovieExecutionResult,
    };
  }
}
