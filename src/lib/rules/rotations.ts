import { Coord } from './index';

export type BlockShape = Coord[];

// The block is a 3D L-shape of 3 cubes.
// We define the elbow as the pivot (0,0,0) and the two legs as orthogonal unit vectors.
// There are exactly 12 unique rotations (6 directions for leg 1, 4 directions for leg 2, divided by 2).
export const BLOCK_ROTATIONS: BlockShape[] = [
  // 1. Flat in XY plane
  [
    { x: 0, y: 0, z: 0 },
    { x: 1, y: 0, z: 0 },
    { x: 0, y: 1, z: 0 },
  ],
  [
    { x: 0, y: 0, z: 0 },
    { x: 1, y: 0, z: 0 },
    { x: 0, y: -1, z: 0 },
  ],
  [
    { x: 0, y: 0, z: 0 },
    { x: -1, y: 0, z: 0 },
    { x: 0, y: 1, z: 0 },
  ],
  [
    { x: 0, y: 0, z: 0 },
    { x: -1, y: 0, z: 0 },
    { x: 0, y: -1, z: 0 },
  ],

  // 2. Vertical in XZ plane (one leg along X, one along Z)
  [
    { x: 0, y: 0, z: 0 },
    { x: 1, y: 0, z: 0 },
    { x: 0, y: 0, z: 1 },
  ],
  [
    { x: 0, y: 0, z: 0 },
    { x: 1, y: 0, z: 0 },
    { x: 0, y: 0, z: -1 },
  ],
  [
    { x: 0, y: 0, z: 0 },
    { x: -1, y: 0, z: 0 },
    { x: 0, y: 0, z: 1 },
  ],
  [
    { x: 0, y: 0, z: 0 },
    { x: -1, y: 0, z: 0 },
    { x: 0, y: 0, z: -1 },
  ],

  // 3. Vertical in YZ plane (one leg along Y, one along Z)
  [
    { x: 0, y: 0, z: 0 },
    { x: 0, y: 1, z: 0 },
    { x: 0, y: 0, z: 1 },
  ],
  [
    { x: 0, y: 0, z: 0 },
    { x: 0, y: 1, z: 0 },
    { x: 0, y: 0, z: -1 },
  ],
  [
    { x: 0, y: 0, z: 0 },
    { x: 0, y: -1, z: 0 },
    { x: 0, y: 0, z: 1 },
  ],
  [
    { x: 0, y: 0, z: 0 },
    { x: 0, y: -1, z: 0 },
    { x: 0, y: 0, z: -1 },
  ],
];
