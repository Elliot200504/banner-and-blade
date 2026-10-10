/**
 * Which screen is up. Between the menu and a battle there are short animated steps: the menu panels
 * slide away ('leaving'), then the menu's battlefield zooms down onto the real board ('to-battle').
 * Going back plays the zoom in reverse ('to-menu').
 */
export type Screen = 'start' | 'leaving' | 'to-battle' | 'battle' | 'to-menu'

/** The screens that show the battle, including the zooms into and out of it. */
export const showsBattle = (screen: Screen) => screen === 'to-battle' || screen === 'battle' || screen === 'to-menu'
