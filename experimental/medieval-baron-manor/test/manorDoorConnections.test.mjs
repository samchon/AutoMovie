import assert from 'node:assert/strict';
import test from 'node:test';
import { deriveManorSpatialArtifact } from '../scripts/manorSpatialState.ts';

const room = (id, left, right) => ({
  id,
  level: 0,
  polygon: [[left, -1], [right, -1], [right, 1], [left, 1]],
});
const west = room('west-room', -2, -0.1);
const east = room('east-room', 0.1, 2);

function derive(rooms) {
  return deriveManorSpatialArtifact(
    JSON.stringify({ prototypes: [], sets: [], singletons: [], transforms: {} }),
    {
      entries: [],
      rooms,
      boundaries: [{
        id: 'partition', a: [0, -1], b: [0, 1], level: 0,
        exterior: false,
        openings: [{ id: 'connecting-door', at: 1, w: 0.8, h: 2 }],
      }],
    },
  ).environments[0];
}

test('a door preserves its two resolved room IDs and declared passage values', () => {
  const actual = derive([west, east]).connectors.find(c => c.id === 'connecting-door/passage');
  assert.deepEqual(actual, {
    id: 'connecting-door/passage', kind: 'passage',
    from: 'east-room', to: 'west-room', bidirectional: true,
    route: [{ x: 0.5, y: 0.45, z: 0 }, { x: -0.5, y: 0.45, z: 0 }],
    elements: ['partition'], width: 0.8, clearHeight: 2,
  });
});

test('an unresolved from endpoint names the door, wall and missing side', () => {
  assert.throws(() => derive([west]), {
    message: 'Unresolved manor door connection: connecting-door on partition (from=missing, to=west-room)',
  });
});

test('an unresolved to endpoint names the door, wall and missing side', () => {
  assert.throws(() => derive([east]), {
    message: 'Unresolved manor door connection: connecting-door on partition (from=east-room, to=missing)',
  });
});

test('two unresolved endpoints are both identified', () => {
  assert.throws(() => derive([]), {
    message: 'Unresolved manor door connection: connecting-door on partition (from=missing, to=missing)',
  });
});

test('two endpoints resolving to the same room are refused at their owner', () => {
  assert.throws(() => derive([room('shared-room', -2, 2)]), {
    message: 'Self-connected manor door: connecting-door on partition (room=shared-room)',
  });
});
