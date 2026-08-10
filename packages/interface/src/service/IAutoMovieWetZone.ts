/**
 * One wet or waterproofed region, bound to a logical space of the served
 * environment.
 *
 * A shower room, a plant room with a floor gully, a fountain surround and a
 * roof terrace are the same record at different grades. The point of stating it
 * is that "there is a drain in the render" and "the water has somewhere to go"
 * are different claims: a zone names the membrane that holds the water in, how
 * far it turns up the walls, which way the floor falls, which drains it falls
 * to, and where it hands over to a drier region. Those are the facts a leak is
 * found in, and none of them are visible in a still frame.
 *
 * The zone is the architecture-facing half of the drainage graph and cites both
 * halves by stable id: boundaries come from the built environment, drains come
 * from the service network. It carries no geometry of its own, so it can never
 * disagree with either.
 *
 * @author Samchon
 */
export interface IAutoMovieWetZone {
  /** Stable zone identity within the network. */
  id: string;

  /** Id of the logical space of the served environment this zone covers. */
  space: string;

  /** How much water the region is expected to see. */
  grade: AutoMovieWetGrade;

  /**
   * Ids of the boundaries the waterproof membrane covers. A `wet` or `immersed`
   * zone is expected to have every boundary of its space covered; anything left
   * out is a surface the water can reach and the membrane cannot.
   */
  membrane: string[];

  /**
   * Height in metres the membrane turns up beyond the floor plane; a finite
   * number `>= 0`. `0` states a floor-only membrane, which is a decision rather
   * than an omission.
   */
  upturn: number;

  /**
   * Fall of the floor toward the drains as a dimensionless rise-over-run ratio;
   * a finite number `>= 0`. A `wet` or `immersed` zone needs it greater than
   * `0` or the water stands where it lands.
   */
  slope: number;

  /**
   * Ids of the network nodes the floor falls to. Each is expected to carry an
   * outgoing waste-water port and to stand inside {@link space}.
   */
  drains: string[];

  /**
   * Ids of the boundaries where this zone hands over to a drier region: the
   * upstand at a shower door, the step at a terrace threshold. Every boundary
   * joining a `wet` or `immersed` zone to a drier space is expected to appear.
   */
  thresholds: string[];
}

/**
 * How much water a region is expected to see.
 *
 * The grades are ordered, and the order is what a threshold is checked against:
 * a boundary between two regions of the same grade is not a wet/dry boundary,
 * and one between different grades is.
 */
export type AutoMovieWetGrade = "dry" | "damp" | "wet" | "immersed";
