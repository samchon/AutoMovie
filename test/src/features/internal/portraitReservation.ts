/** Three nested diamond rings over a closed back; all dimensions are mm. */
export function createPortraitReservationHost() {
  const positions = [[0, 0, 0]];
  for (const radius of [1, 3, 6])
    positions.push(
      [radius, 0, 0],
      [0, radius, 0],
      [-radius, 0, 0],
      [0, -radius, 0],
    );
  const indices: number[] = [];
  for (let i = 0; i < 4; i++) indices.push(0, 1 + i, 1 + ((i + 1) % 4));
  for (let ring = 0; ring < 2; ring++)
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4,
        inside = 1 + 4 * ring,
        outside = inside + 4;
      indices.push(
        outside + i,
        outside + j,
        inside + i,
        outside + j,
        inside + j,
        inside + i,
      );
    }
  const back = positions.push([0, 0, -2]) - 1;
  for (let i = 0; i < 4; i++) indices.push(back, 9 + ((i + 1) % 4), 9 + i);
  return { positions, indices, viewRay: [0, 0, 1] };
}
