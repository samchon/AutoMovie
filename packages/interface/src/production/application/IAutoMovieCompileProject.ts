import {
  IAutoMovieCompileProjectInput,
  IAutoMovieCompileProjectOutput,
} from "../IAutoMovieProductionCompiler";

/** Result of compiling through one requested production gate. */
export interface IAutoMovieCompileProject extends IAutoMovieCompileProjectOutput {}

export namespace IAutoMovieCompileProject {
  /** Select the highest production gate to enforce atomically. */
  export interface IProps extends IAutoMovieCompileProjectInput {}
}
