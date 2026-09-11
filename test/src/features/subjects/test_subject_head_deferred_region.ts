import type { IAutoMovieModelPart } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { referenceControlNet } from "../../subjects/generated-korean-girl-01/controlNet";
import { buildPortraitHead } from "../../subjects/generated-korean-girl-01/head";

/**
 * The actual head assembler installs a sampled part after refining its socket.
 *
 * Scenarios:
 * 1. One reserved triangle gains six boundary segments after one Loop round.
 *    A late centre fan replaces it with six triangles and seven resident points,
 *    proving that the component consumes the refined rather than coarse socket.
 */
export const test_subject_head_deferred_region = (): void => {
  let boundaryCount = 0;
  const head = buildPortraitHead(
    referenceControlNet,
    [
      {
        id: "late-surface",
        fit: () => ({
          constraints: [],
          cutFaces: [],
          attach: (cage, _adapted, region) => {
            const group = region("late-surface", "skin");
            cage.groups[0] = group;
            return {
              openings: [],
              replacements: [
                {
                  group,
                  append: (refined, boundary) => {
                    boundaryCount = boundary.length;
                    const centre = refined.positions.length;
                    refined.positions.push(
                      [0, 1, 2].map((axis) =>
                        boundary.reduce(
                          (s, id) =>
                            s + refined.positions[id][axis] / boundary.length,
                          0,
                        ),
                      ),
                    );
                    for (let i = 0; i < boundary.length; i++) {
                      refined.indices.push(
                        boundary[i],
                        boundary[(i + 1) % boundary.length],
                        centre,
                      );
                      refined.groups.push(group);
                    }
                  },
                },
              ],
              finish: () => [],
            };
          },
        }),
      },
    ],
    1,
  );
  TestValidator.equals("refined socket has six edges", boundaryCount, 6);
  const part = head.parts.find((p) => p.id === "late-surface")!;
  TestValidator.predicate(
    "late surface is a mesh",
    part.geometry.type === "mesh",
  );
  const mesh = (
    part.geometry as Extract<IAutoMovieModelPart["geometry"], { type: "mesh" }>
  ).mesh;
  TestValidator.equals("late triangle count", mesh.indices!.length / 3, 6);
  TestValidator.equals("late point count", mesh.positions.length / 3, 7);
};
