export interface Sprite {
  /** Maps a pixel character to a CSS color. '.' is always transparent and is not listed. */
  palette: Record<string, string>
  /** 16 rows of exactly 16 characters each. */
  pixels: string[]
}

// Colors shared by many sprites.
export const OUTLINE = '#1a1410'
export const SKIN = '#e0b088'
export const STEEL = '#b8c0c8'
export const DARK_STEEL = '#6a7480'
export const WOOD = '#8a5a2b'
export const BOOTS = '#4a3424'
export const BONE = '#e8e0c8'
export const BONE_SHADOW = '#a89c80'
export const GOLD = '#f0c040'
