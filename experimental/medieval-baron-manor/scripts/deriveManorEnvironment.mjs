import { readFileSync } from 'node:fs';
import { generateAutoMovieDerivedArtifact } from '@automovie/production';
import { deriveManorSpatialArtifact } from './manorSpatialState.ts';
import { createManorScene } from '../src/models/manor.js';

const input = 'automovie/derived/manor/instances-v23-critical.json';
const helper = 'scripts/manorSpatialState.ts';
const sourceFiles = [
  'src/models/manor.js', 'src/models/manor-craft.js',
  'src/models/manor-garden.js', 'src/materials/manor.js',
];
const initial = Object.fromEntries([helper, ...sourceFiles].map(file => [file, readFileSync(file)]));
let census;
const result = generateAutoMovieDerivedArtifact({
  root: process.cwd(),
  generator: 'scripts/deriveManorEnvironment.mjs',
  inputs: [input, helper, ...sourceFiles, 'package-lock.json'],
  output: 'automovie/derived/manor/environment-v24-critical.json',
  encoding: 'utf8',
  generate(inputs) {
    for (const [file, bytes] of Object.entries(initial))
      if (!Buffer.from(inputs[file]).equals(bytes))
        throw new Error('Spatial derivation input changed: ' + file);
    // Regenerate the authored geometry here; the viewer inventory contains no
    // serialized copy of the complete house.
    const source = createManorScene({ geometryOnly: true });
    const built = deriveManorSpatialArtifact(new TextDecoder().decode(inputs[input]), source);
    const environment = built.environments[0];
    census = {
      models: environment.models.length, elements: environment.elements.length,
      populations: environment.populations.length,
      instances: environment.populations.reduce((n, p) => n + p.set.count, 0),
      spaces: environment.spaces.length, boundaries: environment.boundaries.length,
      openings: environment.openings.length, surfaces: environment.surfaces.length,
      connectors: environment.connectors.length,
    };
    return new TextEncoder().encode(JSON.stringify(built));
  },
});
console.log(JSON.stringify({ record: result.record, census }));
