import { AutoMovieLegacyApplication } from "./AutoMovieLegacyApplication";
import { AutoMovieMcpFrameCapture } from "./dto";

/** Public operations routed through the compact execution gateway. */
export type AutoMovieExecutionOperation = Exclude<
  keyof AutoMovieLegacyApplication,
  "getGuideDocument" | "nextSteps" | "openProject"
>;

/** One strictly typed operation request accepted by {@link execute}. */
export type IAutoMovieExecutionCall = {
  [Operation in AutoMovieExecutionOperation]: {
    /** Exact {@link AutoMovieLegacyApplication} operation to run. */
    operation: Operation;
    /** That operation's validated input object. */
    input: Parameters<AutoMovieLegacyApplication[Operation]>[0];
  };
}[AutoMovieExecutionOperation];

/** Operation-tagged result returned by {@link execute}. */
export type IAutoMovieExecutionResult = {
  [Operation in AutoMovieExecutionOperation]: {
    /** Operation that produced this result. */
    operation: Operation;
    /** That operation's structured output. */
    output: Awaited<ReturnType<AutoMovieLegacyApplication[Operation]>>;
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
  private readonly application: AutoMovieLegacyApplication;

  public constructor(props?: {
    /** Host-owned frame capture used by the `seeFrame` operation. */
    capture?: AutoMovieMcpFrameCapture;
    /** Project root to activate at startup; `openProject` may replace it. */
    projectRoot?: string;
  }) {
    this.application = new AutoMovieLegacyApplication(props);
  }

  /**
   * Fetch one exact package-versioned film-authoring guide. Read
   * `AUTOMOVIE_OVERALL` first, then the topic named by `nextSteps` or a refused
   * operation before retrying it. Guides define ownership, prerequisite and
   * correction conventions that do not fit safely in one tool description; they
   * are not creative output and do not replace inspection of the resident
   * project. An unknown name fails instead of returning an approximate
   * document. Use this direct entry point rather than routing guide retrieval
   * through `execute`.
   *
   * @param props Exact guide document name.
   * @returns Markdown guide content.
   */
  public getGuideDocument(
    props: Parameters<AutoMovieLegacyApplication["getGuideDocument"]>[0],
  ): ReturnType<AutoMovieLegacyApplication["getGuideDocument"]> {
    return this.application.getGuideDocument(props);
  }

  /**
   * Open or create one resident project directory as the durable memory used by
   * later calls. Its manifest, human-readable slate slices and registered
   * assets let the external agent resume without replaying an entire film graph
   * into context. Call it after the overall guide and before `nextSteps` or any
   * resident operation. Opening does not stage, perform, render or validate a
   * film, and it never turns unregistered external files into trusted assets.
   * Use this direct entry point rather than routing activation through
   * `execute`.
   *
   * @param props Project root directory.
   * @returns The activated project's summary.
   */
  public openProject(
    props: Parameters<AutoMovieLegacyApplication["openProject"]>[0],
  ): ReturnType<AutoMovieLegacyApplication["openProject"]> {
    return this.application.openProject(props);
  }

  /**
   * Ask the active resident project for its current ladder status and ordered
   * concrete calls. This is the authoritative recovery path after a
   * prerequisite refusal: follow its missing rungs in order instead of guessing
   * state from prior chat. The call is read-only and does not create, repair,
   * validate or commit the returned artifacts. Route every returned operation
   * name other than the three direct entry points through `execute`, preserving
   * the exact input branch it names.
   *
   * @returns Missing prerequisites and next actions.
   */
  public nextSteps(): ReturnType<AutoMovieLegacyApplication["nextSteps"]> {
    return this.application.nextSteps();
  }

  /**
   * Execute one strictly typed AutoMovie operation. Select the `operation`
   * discriminator, then supply its matching `input`; the server validates the
   * selected branch with exact-property semantics. Results repeat the operation
   * beside its structured output so a client cannot confuse two union branches.
   * Use it for the operation explicitly chosen from the guide and current
   * ladder, inspect violations instead of retrying unchanged, and keep
   * code-native dense motion in ordinary code or direct engine linking. The
   * gateway does not skip validation, prerequisites, resident writes or
   * downstream invalidation; it changes schema advertisement, not engine
   * behavior. Use `getGuideDocument`, `openProject`, and `nextSteps` directly.
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
