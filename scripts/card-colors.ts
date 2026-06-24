/** CMYK tuples (0–100) tuned for Mutoh UV on cardstock. */
export type Cmyk = [number, number, number, number];

export const PURE_BLACK: Cmyk = [0, 0, 0, 100];
export const PURE_WHITE: Cmyk = [0, 0, 0, 0];
export const TEXT_BLACK: Cmyk = [0, 0, 0, 100];

export const HITSTER_CARD_COLORS: Cmyk[] = [
  [0, 12, 88, 2],
  [48, 0, 28, 10],
  [42, 0, 52, 8],
  [0, 18, 82, 4],
  [0, 82, 72, 4],
  [0, 88, 42, 8],
  [78, 38, 0, 2],
  [0, 58, 18, 0],
  [0, 42, 88, 2],
  [32, 0, 72, 6],
  [38, 0, 32, 4],
  [48, 58, 0, 6],
];

export const NEON_YELLOW: Cmyk = [0, 8, 92, 0];
export const NEON_MAGENTA: Cmyk = [0, 78, 12, 0];
export const NEON_CYAN: Cmyk = [62, 0, 6, 0];
export const NEON_RINGS: Cmyk[] = [NEON_YELLOW, NEON_MAGENTA, NEON_CYAN];

export function cardColor(index: number): Cmyk {
  return HITSTER_CARD_COLORS[index % HITSTER_CARD_COLORS.length];
}
