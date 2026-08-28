import {
  AutoMovieProductionContext,
  AutoMovieProductionRepaintService,
} from "@automovie/production";

import type { IAutoMovieProductionConfiguration } from "./productionConfiguration";
import {
  readProductionRepaintShotArgument,
  selectProductionRepaintRequest,
} from "./productionConfiguration";
import type { repaintProductionShot } from "./repaintAdapter";

type RepaintOutput = Awaited<
  ReturnType<AutoMovieProductionRepaintService["serve"]>
>;

export interface IProductionRepaintInvocation {
  generator: NonNullable<
    IAutoMovieProductionConfiguration["visual"]["repaint"]
  >["generator"];
  productionId: string;
  request: NonNullable<
    IAutoMovieProductionConfiguration["visual"]["repaint"]
  >["requests"][number];
}

export interface IProductionRepaintHost {
  closeCapture: (failure: { error: unknown } | undefined) => Promise<void>;
  serve: (invocation: IProductionRepaintInvocation) => Promise<RepaintOutput>;
  setExitCode: (value: number) => void;
  stdout: (value: string) => void;
}

/** Execute one reviewed shot request and preserve cleanup failure semantics. */
export const runProductionRepaintCommand = async (
  args: readonly string[],
  config: IAutoMovieProductionConfiguration,
  createHost: () => IProductionRepaintHost,
): Promise<void> => {
  const shot = readProductionRepaintShotArgument(args);
  const selected = selectProductionRepaintRequest(config.visual.repaint, shot);
  const host = createHost();
  let failure: { error: unknown } | undefined;
  try {
    const output = await host.serve({
      generator: selected.generator,
      productionId: config.productionId,
      request: selected.request,
    });
    host.stdout(`${JSON.stringify(output, null, 2)}\n`);
    if (output.repainted === false) host.setExitCode(1);
  } catch (error) {
    failure = { error };
    throw error;
  } finally {
    await host.closeCapture(failure);
  }
};

/** Bind the generated adapter and actual production service to the command. */
export const createNodeProductionRepaintHost = (props: {
  adapter: typeof repaintProductionShot;
  capture: ConstructorParameters<typeof AutoMovieProductionContext>[0];
  closeCapture: IProductionRepaintHost["closeCapture"];
  root: string;
  setExitCode: IProductionRepaintHost["setExitCode"];
  stdout: IProductionRepaintHost["stdout"];
}): IProductionRepaintHost => ({
  closeCapture: props.closeCapture,
  serve: async (invocation) =>
    new AutoMovieProductionRepaintService(
      props.adapter,
      invocation.generator,
    ).serve(
      new AutoMovieProductionContext(
        props.capture,
        props.root,
        invocation.productionId,
      ),
      {
        parameters: invocation.request.parameters,
        productionId: invocation.productionId,
        references: [...invocation.request.references],
        shot: invocation.request.shot,
      },
    ),
  setExitCode: props.setExitCode,
  stdout: props.stdout,
});
