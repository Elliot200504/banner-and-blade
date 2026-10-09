import { describe, expect, it } from 'vitest'
import { chordSize, chordTone, noteNumber, parseBar, SONGS } from './songs'

describe('songs', () => {
  it('knows its notes and chords', () => {
    expect(noteNumber('A4')).toBe(69)
    expect(noteNumber('C#5')).toBe(73)
    expect(noteNumber('Bb3')).toBe(58)
    expect([0, 1, 2, 3].map((tone) => chordTone('F#m', 3, tone))).toEqual([54, 57, 61, 66])
  })

  for (const [id, song] of Object.entries(SONGS)) {
    it(`${id} is written correctly`, () => {
      for (const chord of song.chords) {
        expect(chordSize(chord), chord).toBeGreaterThan(0)
      }

      for (const track of song.tracks) {
        for (const pass of track.passes ?? []) {
          expect(pass).toBeLessThan(song.passes)
        }

        if (track.type === 'melody') {
          // Each melody covers whole passes through the progression.
          expect(track.bars.length % song.chords.length).toBe(0)

          for (const bar of track.bars) {
            expect(parseBar(bar).steps, bar).toBe(song.stepsPerBar)
          }
        } else {
          expect(track.pattern.length, track.pattern).toBe(song.stepsPerBar)
        }
      }
    })
  }
})
