/** A clockwise inner square and counterclockwise outer square joined by +Z skin. */
export const portraitOralLiningFixture = () => ({
  positions: [
    [-1, 1, 0],
    [1, 1, 0],
    [1, -1, 0],
    [-1, -1, 0],
    [-2, 2, 0],
    [2, 2, 0],
    [2, -2, 0],
    [-2, -2, 0],
  ],
  indices: [
    0, 1, 4, 1, 5, 4, 1, 2, 5, 2, 6, 5, 2, 3, 6, 3, 7, 6, 3, 0, 7, 0, 4, 7,
  ],
});
