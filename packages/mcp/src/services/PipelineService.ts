import {
  IAutoMovieActorContext,
  IAutoMoviePerformedShot,
  IAutoMovieStagedSet,
  blockBeat,
  cutSequence,
  forgeCast,
  forgeProp,
  makeActorSynthesizer,
  performShot,
  stageScene,
} from "@automovie/engine";
import {
  IAutoMovieAssembleApplication,
  IAutoMovieBlockingApplication,
  IAutoMovieForgeApplication,
  IAutoMovieGait,
  IAutoMoviePerformanceApplication,
  IAutoMovieScriptApplication,
  IAutoMovieShot,
  IAutoMovieStagingApplication,
} from "@automovie/interface";

import { toEnginePropSpec, toMcpMotion } from "../convert";
import {
  IAutoMovieBlockOutput,
  IAutoMovieCutOutput,
  IAutoMovieForgeOutput,
  IAutoMovieForgePropOutput,
  IAutoMovieMcpActorContext,
  IAutoMovieMcpPerformedShot,
  IAutoMovieMcpPropSpec,
  IAutoMoviePerformOutput,
  IAutoMovieStageOutput,
} from "../dto";

/**
 * The film pipeline compute — the stage/block/perform/cut/forge ladder over the
 * engine's deterministic consumers. `perform` assembles the default synthesizer
 * from JSON actor contexts so the MCP contract stays tuple-free. The MCP
 * contract lives on the {@link AutoMovieApplication} facade.
 */
export class PipelineService {
  public stage(props: {
    script: IAutoMovieScriptApplication.IWrite;
    staging: IAutoMovieStagingApplication.IWrite;
  }): IAutoMovieStageOutput {
    return { staged: stageScene(props.script, props.staging) };
  }

  public block(props: {
    script: IAutoMovieScriptApplication.IWrite;
    staged: IAutoMovieStagedSet.ISuccess;
    blocking: IAutoMovieBlockingApplication.IWrite;
  }): IAutoMovieBlockOutput {
    return { blocked: blockBeat(props.script, props.staged, props.blocking) };
  }

  public perform(props: {
    script: IAutoMovieScriptApplication.IWrite;
    staged: IAutoMovieStagedSet.ISuccess;
    performance: IAutoMoviePerformanceApplication.IWrite;
    actors: Record<string, IAutoMovieMcpActorContext>;
    blocking?: IAutoMovieBlockingApplication.IWrite;
  }): IAutoMoviePerformOutput {
    const contexts = new Map<string, IAutoMovieActorContext>(
      Object.entries(props.actors).map(([node, context]) => [
        node,
        toActorContext(context),
      ]),
    );
    const nodes = new Map(
      props.staged.scene.nodes.map((node) => [
        node.id,
        node.transform.translation,
      ]),
    );
    const synthesize = makeActorSynthesizer(contexts, nodes);
    const performed = performShot({
      script: props.script,
      staged: props.staged,
      performance: props.performance,
      synthesize,
      skeleton: (node) => contexts.get(node)?.rig ?? null,
      restFrames: (node) => contexts.get(node)?.restFrames,
      blocking: props.blocking,
    });
    return { performed: toMcpPerformedShot(performed) };
  }

  public cut(props: {
    assemble: IAutoMovieAssembleApplication.IWrite;
    shots: IAutoMovieShot[];
  }): IAutoMovieCutOutput {
    return { cut: cutSequence(props.assemble, props.shots) };
  }

  public forge(props: {
    script: IAutoMovieScriptApplication.IWrite;
    forge: IAutoMovieForgeApplication.IWrite;
  }): IAutoMovieForgeOutput {
    return { forged: forgeCast(props.script, props.forge) };
  }

  public forgeProp(props: {
    spec: IAutoMovieMcpPropSpec;
  }): IAutoMovieForgePropOutput {
    const forged = forgeProp(toEnginePropSpec(props.spec));
    return {
      forged:
        forged.success === true ? { success: true, prop: props.spec } : forged,
    };
  }
}

const toActorContext = (
  context: IAutoMovieMcpActorContext,
): IAutoMovieActorContext => ({
  ...context,
  gaits: context.gaits.map((gait): IAutoMovieGait => ({ ...gait })),
});

const toMcpPerformedShot = (
  performed: IAutoMoviePerformedShot,
): IAutoMovieMcpPerformedShot =>
  performed.success === false
    ? performed
    : {
        ...performed,
        motions: Object.fromEntries(
          Object.entries(performed.motions).map(([node, motion]) => [
            node,
            toMcpMotion(motion),
          ]),
        ),
      };
