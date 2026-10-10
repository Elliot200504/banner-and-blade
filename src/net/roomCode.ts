/** Room codes: short, easy to read out, and checked before anyone tries to join. */

/** Letters and digits that cannot be mistaken for one another when read out (no O/0, I/1). */
const CODE_CHARACTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const CODE_LENGTH = 5

export function newRoomCode(random: () => number = Math.random): string {
  let code = ''

  for (let index = 0; index < CODE_LENGTH; index++) {
    code += CODE_CHARACTERS[Math.floor(random() * CODE_CHARACTERS.length)]
  }

  return code
}

/** A code as typed by a person: any case, with stray spaces or dashes. */
export function normalizeRoomCode(typed: string): string {
  return typed.toUpperCase().replace(/[^A-Z0-9]/g, '')
}

export const isRoomCode = (code: string) =>
  code.length === CODE_LENGTH && [...code].every((character) => CODE_CHARACTERS.includes(character))
