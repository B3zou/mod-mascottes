import { expect, test } from 'claude-code/testing'

import { drawCatIdle, drawCatThrow, H as CAT_H, W as CAT_W } from '../hooks/cat'
import { createCatMachine, MAX_QUEUED_THROWS, THROW_FRAMES } from '../hooks/catmachine'
import { Canvas, downscale2, downscaleV2, pyRound, rgba, toQuadrantWords, toRasterWords } from '../hooks/pixels'
import { booksFor, drawWitch, drawWitchPct, H as WITCH_H, levelFor, NF, STATES, W as WITCH_W, witchSig } from '../hooks/witch'

const filled = (cv: Canvas) => cv.px.reduce((n, c) => n + (c !== 0 ? 1 : 0), 0)
const same = (a: Canvas, b: Canvas) => a.px.every((c, i) => c === b.px[i])

// ---------------------------------------------------------------- pixels
test('pyRound arrondit comme Python (au pair sur les .5)', () => {
  expect([0.5, 1.5, 2.5, -0.5, -1.5, 0.4, 0.6].map(pyRound)).toEqual([0, 2, 2, 0, -2, 0, 1])
})

test('outline entoure les pixels pleins sans toucher ceux deja de la couleur du contour', () => {
  const OUT = rgba(0, 0, 0)
  const cv = new Canvas(5, 5)
  cv.set(2, 2, rgba(255, 0, 0))
  cv.outline(OUT)
  expect([cv.get(1, 2), cv.get(3, 2), cv.get(2, 1), cv.get(2, 3)]).toEqual([OUT, OUT, OUT, OUT])
  expect(cv.get(1, 1)).toBe(0) // pas de diagonale
  expect(cv.get(2, 2)).toBe(rgba(255, 0, 0))
  expect(filled(cv)).toBe(5)
})

test('toRasterWords : un pixel haut, un bas, les deux, aucun', () => {
  const cv = new Canvas(4, 2)
  cv.set(0, 0, rgba(255, 0, 0)) // haut seul
  cv.set(1, 1, rgba(0, 255, 0)) // bas seul
  cv.set(2, 0, rgba(0, 0, 255)); cv.set(2, 1, rgba(255, 255, 0)) // les deux
  const w = toRasterWords(cv)
  const cell = (x: number) => [w[x * 3], w[x * 3 + 1], w[x * 3 + 2]]
  expect(cell(0)).toEqual([0x2580, 0xff0000, 0x01000000])
  expect(cell(1)).toEqual([0x2584, 0x00ff00, 0x01000000])
  expect(cell(2)).toEqual([0x2580, 0x0000ff, 0xffff00])
  expect(cell(3)).toEqual([0x20, 0x01000000, 0x01000000])
})

test('toRasterWords fond les pixels semi-transparents sur le fond du terminal', () => {
  const cv = new Canvas(1, 2)
  cv.set(0, 0, rgba(255, 255, 255, 128)) // blanc a 50 % sur un fond noir : gris
  const w = toRasterWords(cv, 0x000000)
  expect(w[0]).toBe(0x2580)
  expect(w[1]).toBe(0x808080)
  expect(w[2]).toBe(0x01000000)
})

test('downscale2 : moitie de taille, les pixels isoles disparaissent, le sombre gagne les egalites', () => {
  const dark = rgba(10, 10, 10)
  const light = rgba(200, 200, 200)
  const cv = new Canvas(4, 4)
  cv.set(0, 0, dark); cv.set(1, 0, light) // bloc 0,0 : egalite 1-1, le sombre gagne
  cv.set(2, 2, light) // bloc 1,1 : un seul pixel, vide
  const out = downscale2(cv)
  expect([out.w, out.h]).toEqual([2, 2])
  expect(out.get(0, 0)).toBe(dark)
  expect(out.get(1, 1)).toBe(0)
})

test('downscaleV2 : moitie en hauteur seulement, le plein bat le vide, le sombre gagne', () => {
  const dark = rgba(10, 10, 10)
  const light = rgba(200, 200, 200)
  const cv = new Canvas(3, 4)
  cv.set(0, 0, light); cv.set(0, 1, dark) // deux couleurs : la sombre
  cv.set(1, 1, light) // un seul plein : garde
  const out = downscaleV2(cv)
  expect([out.w, out.h]).toEqual([3, 2])
  expect([out.get(0, 0), out.get(1, 0), out.get(2, 0), out.get(0, 1)]).toEqual([dark, light, 0, 0])
})

test('toQuadrantWords : 2x2 pixels par cellule, le vide devient le fond par defaut', () => {
  const red = rgba(255, 0, 0)
  const blue = rgba(0, 0, 255)
  const cv = new Canvas(6, 2)
  cv.set(0, 0, red) // haut-gauche seul
  cv.set(2, 0, red); cv.set(3, 1, blue) // diagonale, deux couleurs
  const w = toQuadrantWords(cv)
  const cell = (x: number) => [w[x * 3], w[x * 3 + 1], w[x * 3 + 2]]
  expect(w.length).toBe(3 * 3)
  expect(cell(0)).toEqual([0x2598, 0xff0000, 0x01000000])
  const c1 = cell(1)
  expect(c1[0] === 0x2598 || c1[0] === 0x259d || c1[0] === 0x2597 || c1[0] === 0x259a).toBe(true)
  expect(cell(2)).toEqual([0x20, 0x01000000, 0x01000000])
})

test('toQuadrantWords : avec 3 couleurs, garde les 2 qui s ecartent le moins', () => {
  const black = rgba(0, 0, 0)
  const white = rgba(255, 255, 255)
  const nearWhite = rgba(250, 250, 250)
  const cv = new Canvas(2, 2)
  cv.set(0, 0, black); cv.set(1, 0, white); cv.set(0, 1, nearWhite); cv.set(1, 1, white)
  const [cp, fg, bg] = toQuadrantWords(cv, 0x000000)
  expect(new Set([fg, bg])).toEqual(new Set([0x000000, 0xffffff]))
  // le noir seul d'un cote, les trois clairs de l'autre
  expect(cp).toBe(fg === 0x000000 ? 0x2598 : 0x259f)
})

test('toutes les tailles tiennent dans leur Raster', () => {
  for (const cv of [drawCatIdle(100, 0), drawWitchPct(50, 0)]) {
    expect(toRasterWords(cv).length).toBe(40 * 33 * 3)
    expect(toRasterWords(downscale2(cv)).length).toBe(20 * 17 * 3)
    expect(toQuadrantWords(downscaleV2(cv)).length).toBe(20 * 17 * 3)
  }
})

// ---------------------------------------------------------------- sorciere
test('grimoires : 0 a 0 %, 14 a 100 %, croissant, et egal aux paliers du dessin tous les 10 %', () => {
  expect(booksFor(0)).toBe(0)
  expect(booksFor(100)).toBe(14)
  let prev = 0
  for (let p = 0; p <= 100; p++) {
    const b = booksFor(p)
    expect(b >= prev).toBe(true)
    prev = b
  }
  STATES.forEach((s, i) => expect(booksFor(i * 10)).toBe(s.books))
})

test('niveau de la sorciere : debout sans grimoire, au moins le palier 1 avec, 10 a 100 %', () => {
  expect(levelFor(0)).toBe(0)
  expect(levelFor(2)).toBe(0)
  for (let p = 0; p <= 100; p++) {
    if (booksFor(p) > 0) expect(levelFor(p) >= 1).toBe(true)
    expect(levelFor(p) <= 10).toBe(true)
  }
  expect(levelFor(100)).toBe(10)
  expect(witchSig(100)).toBe('10/14')
})

test('la sorciere se dessine pour tous les paliers et toutes les frames, dans le cadre', () => {
  for (let si = 0; si < STATES.length; si++) {
    for (let f = 0; f < NF; f++) {
      const cv = drawWitch(si, f)
      expect([cv.w, cv.h]).toEqual([WITCH_W, WITCH_H])
      expect(filled(cv) > 200).toBe(true)
    }
  }
})

test('la sorciere est deterministe, et son animation boucle sur 6 frames qui different', () => {
  expect(same(drawWitchPct(35, 2), drawWitchPct(35, 2))).toBe(true)
  const frames = Array.from({ length: NF }, (_, f) => drawWitchPct(35, f))
  expect(frames.some((cv, i) => i > 0 && !same(cv, frames[0]!))).toBe(true)
})

test('la pile de grimoires monte avec le contexte', () => {
  const top = (cv: Canvas) => cv.px.findIndex(c => c !== 0) // premiere ligne occupee
  let prev = Infinity
  for (const p of [10, 30, 50, 70, 90]) {
    const t = top(drawWitchPct(p, 0))
    expect(t <= prev).toBe(true)
    prev = t
  }
})

// ---------------------------------------------------------------- chat
test('le chat se dessine pour 0 a 100 pieces, toutes les frames idle', () => {
  for (let n = 0; n <= 100; n++) {
    for (let f = 0; f < 6; f++) {
      const cv = drawCatIdle(n, f)
      expect([cv.w, cv.h]).toEqual([CAT_W, CAT_H])
      expect(filled(cv) > 50).toBe(true)
    }
  }
})

test('le lancer se dessine pour 1 a 100 pieces, 8 frames', () => {
  for (let n = 1; n <= 100; n++) {
    for (let f = 0; f < 8; f++) expect(filled(drawCatThrow(n, f)) > 50).toBe(true)
  }
})

test('le chat est deterministe', () => {
  expect(same(drawCatIdle(42, 3), drawCatIdle(42, 3))).toBe(true)
  expect(same(drawCatThrow(42, 4), drawCatThrow(42, 4))).toBe(true)
})

test('le tas est plus haut avec plus de pieces', () => {
  const height = (n: number) => {
    const cv = drawCatIdle(n, 0)
    const first = cv.px.findIndex(c => c !== 0)
    return CAT_H - Math.floor(first / CAT_W)
  }
  expect(height(100) > height(50)).toBe(true)
  expect(height(50) > height(10)).toBe(true)
})

// ---------------------------------------------------------------- machine du chat
const run = (m: ReturnType<typeof createCatMachine>, target: number, times: number) =>
  Array.from({ length: times }, () => m.step(target, 0))

test('la premiere mesure ne declenche aucun lancer', () => {
  const m = createCatMachine()
  const s = m.step(86, 0)
  expect(s.throwFrame).toBe(-1)
  expect(s.coins).toBe(86)
})

test('n vers n-1 joue un lancer de 8 frames une fois, puis revient a l\'idle a n-1', () => {
  const m = createCatMachine()
  m.step(86, 0)
  const steps = run(m, 85, THROW_FRAMES + 3)
  expect(steps.slice(0, THROW_FRAMES).map(s => s.throwFrame)).toEqual([0, 1, 2, 3, 4, 5, 6, 7])
  expect(steps.slice(0, THROW_FRAMES).every(s => s.coins === 86)).toBe(true)
  expect(steps.slice(THROW_FRAMES).every(s => s.throwFrame === -1 && s.coins === 85)).toBe(true)
})

test('pas de lancer tant que l\'usage ne bouge pas', () => {
  const m = createCatMachine()
  expect(run(m, 70, 20).every(s => s.throwFrame === -1)).toBe(true)
})

test('une chute de plusieurs pourcents rejoue au plus 3 lancers puis rattrape', () => {
  const m = createCatMachine()
  m.step(80, 0)
  const steps = run(m, 50, 200)
  const starts = steps.filter(s => s.throwFrame === 0).length
  expect(starts).toBe(MAX_QUEUED_THROWS)
  expect(steps.at(-1)!.coins).toBe(50)
  expect(steps.at(-1)!.throwFrame).toBe(-1)
})

test('deux baisses d\'affilee enchainent deux lancers', () => {
  const m = createCatMachine()
  m.step(30, 0)
  const steps = run(m, 28, THROW_FRAMES * 2 + 2)
  expect(steps.filter(s => s.throwFrame === 0).length).toBe(2)
  expect(steps.at(-1)!.coins).toBe(28)
})

test('une hausse (fenetre renouvelee) remplit le tas d\'un coup, sans lancer', () => {
  const m = createCatMachine()
  m.step(4, 0)
  const s = m.step(100, 0)
  expect(s.coins).toBe(100)
  expect(s.throwFrame).toBe(-1)
})

test('a 0 piece le chat dort : jamais de lancer', () => {
  const m = createCatMachine()
  m.step(1, 0)
  const steps = run(m, 0, THROW_FRAMES + 4)
  expect(steps.at(-1)!.coins).toBe(0)
  expect(steps.at(-1)!.throwFrame).toBe(-1)
  expect(run(m, 0, 10).every(s => s.throwFrame === -1)).toBe(true)
})
