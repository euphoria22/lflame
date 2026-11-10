import * as migration_20261110_004754_initial from './20261110_004754_initial';

export const migrations = [
  {
    up: migration_20261110_004754_initial.up,
    down: migration_20261110_004754_initial.down,
    name: '20261110_004754_initial'
  },
];
