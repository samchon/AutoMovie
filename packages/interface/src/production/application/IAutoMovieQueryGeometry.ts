import {
  IAutoMovieQueryGeometryInput,
  IAutoMovieQueryGeometryOutput,
} from "../IAutoMovieProductionOracle";

/** Result of one current deterministic geometry query. */
export interface IAutoMovieQueryGeometry extends IAutoMovieQueryGeometryOutput {}

export namespace IAutoMovieQueryGeometry {
  /** One compact geometry request over the current production. */
  export interface IProps extends IAutoMovieQueryGeometryInput {}
}
