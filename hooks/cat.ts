// Port de reference/draw_cat2.py : le chat noir sur son tas de 100 pieces, 96x64 px.
import { Canvas, pyRound, rgba, seeded, type Color } from './pixels'

export const W = 40
export const H = 66
const GROUND = 62
const PX = 20

const T = (r: number, g: number, b: number): Color => rgba(r, g, b)
const OUT = T(18, 14, 26)
const CAT = T(42, 36, 58)
const CAT_L = T(78, 68, 106)
const SMEAR = T(120, 110, 150)
const EYE = T(196, 232, 92)
const PINK = T(236, 142, 164)
const COLLAR = T(240, 140, 52)
const GOLD = T(242, 194, 66)
const GOLD_L = T(255, 236, 150)
const GOLD_D = T(206, 148, 40)
const SEP = T(160, 100, 30)
const WHITE = T(255, 255, 255)
const ZZ = T(150, 160, 210)
const DUST = T(214, 206, 196)
const SHADOW = rgba(18, 14, 26, 60)

// ---------------------------------------------------------------- couche sparse
const OFF = 256
const key = (x: number, y: number) => (y + OFF) * 1024 + (x + OFF)
const kx = (k: number) => (k % 1024) - OFF
const ky = (k: number) => Math.floor(k / 1024) - OFF

class Layer {
  readonly m = new Map<number, Color>()
  set(x: number, y: number, c: Color) { this.m.set(key(x, y), c) }
  get(x: number, y: number) { return this.m.get(key(x, y)) }
  has(x: number, y: number) { return this.m.has(key(x, y)) }
}

const NEIGHBORS = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const

const SIT = [
  '..b.......b..',
  '..bb.....bb..',
  '..bpb...bpb..',
  '..bbbbbbbbb..',
  '.bbbbbbbbbbb.',
  '.bbEKbbbKEbb.',
  '.bbEEbbbEEbb.',
  '.bbbbbpbbbbb.',
  '..bbbbbbbbb..',
  '...ccccccc...',
  '..bbbbbbbbb..',
  '.bbbbbbbbbbb.',
  '.bbbbbbbbbbb.',
  '.bbbbbbbbbbb.',
  '.bbbbbbbbbbb.',
]
const HEAD = SIT.slice(0, 9)
const SWAY = [0, 1, 1, 0, -1, -1, 0, 1]
// Tour de 14 rangees de 7 pieces + 2 au sommet = 100 pieces.
const ROWS = [...Array<number>(14).fill(7), 2]

type Coin = { x: number; y: number; row: number; v: string }

function buildCoins(): Coin[] {
  const coins: Coin[] = []
  const rnd = seeded(5)
  const variants = ['n', 'n', 'n', 's', 'l', 'l', 'd']
  ROWS.forEach((cnt, r) => {
    const width = 4 * cnt + 1
    const xFirst = PX - Math.floor(width / 2) + 1
    const y = GROUND - 2 - 3 * r
    const xs = Array.from({ length: cnt }, (_, i) => xFirst + 4 * i)
    const mid = (cnt - 1) / 2
    // du centre vers l'exterieur ; egalite : x croissant
    xs.sort((a, b) => Math.abs((a - xFirst) / 4 - mid) - Math.abs((b - xFirst) / 4 - mid) || a - b)
    for (const x of xs) coins.push({ x, y, row: r, v: rnd.choice(variants) })
  })
  return coins
}
const COINS = buildCoins()

function coinFill(px: Layer, x: number, y: number, v = 'n', w = 3): void {
  const x0 = x + Math.floor((3 - w) / 2)
  for (let yy = y - 1; yy < y + 3; yy++) for (let xx = x0 - 1; xx < x0 + w + 1; xx++) px.set(xx, yy, SEP)
  const tops: Record<string, Color[]> = {
    n: [GOLD_L, GOLD, GOLD], s: [GOLD_L, GOLD_L, GOLD], l: [GOLD, GOLD, GOLD], d: [GOLD, GOLD_D, GOLD_D],
  }
  const top = tops[v]!
  for (let i = 0; i < w; i++) {
    px.set(x0 + i, y, w === 3 ? top[i]! : i === 0 ? GOLD_L : GOLD)
    px.set(x0 + i, y + 1, GOLD_D)
  }
}

/** Les separateurs au bord de la silhouette deviennent le contour sombre. */
function seal(px: Layer): Layer {
  for (const [k, c] of [...px.m]) {
    if (c !== SEP) continue
    const x = kx(k), y = ky(k)
    if (NEIGHBORS.some(([dx, dy]) => !px.has(x + dx, y + dy))) px.m.set(k, OUT)
  }
  const add = new Set<number>()
  for (const [k, c] of [...px.m]) {
    if (c === OUT) continue
    const x = kx(k), y = ky(k)
    for (const [dx, dy] of NEIGHBORS) if (!px.has(x + dx, y + dy)) add.add(key(x + dx, y + dy))
  }
  for (const k of add) px.m.set(k, OUT)
  return px
}

function pileLayer(n: number, f = 0, glint: number | null = null): Layer {
  const px = new Layer()
  for (const c of COINS.slice(0, n)) coinFill(px, c.x, c.y, c.v)
  if (n) {
    const tw = COINS[(f * 37 + n) % n]!
    const cur = px.get(tw.x, tw.y)
    if (cur !== undefined && cur !== OUT) px.set(tw.x, tw.y, WHITE)
  }
  seal(px)
  if (glint !== null) {
    const c = COINS[glint]!
    px.set(c.x + 1, c.y, WHITE)
    px.set(c.x + 2, c.y, WHITE)
  }
  return px
}

/** y de la ligne de contour du haut et x central des pieces les plus hautes. */
function pileTop(n: number): [number, number] {
  if (n === 0) return [GROUND, PX]
  const r = COINS[n - 1]!.row
  const row = COINS.slice(0, n).filter(c => c.row === r)
  const cx = pyRound(row.reduce((s, c) => s + c.x + 1, 0) / row.length)
  return [row[0]!.y - 1, cx]
}

// ---------------------------------------------------------------- pieces au sol
// 20 emplacements : deux petites colonnes de 10 pieces de part et d'autre de la tour,
// couche du bas d'abord, une a gauche puis une a droite.
const SPOTS: Array<[number, number]> = (() => {
  const out: Array<[number, number]> = []
  for (let layer = 0; layer < 10; layer++) {
    const y = GROUND - 2 - 3 * layer
    out.push([2, y], [W - 4, y])
  }
  return out
})()

const lands = (k: number) => k % 5 === 0

function floorLayer(thrown: number): Layer {
  const px = new Layer()
  const idx: number[] = []
  for (let k = 0; k < thrown; k++) if (lands(k)) idx.push(Math.floor(k / 5))
  idx.sort((a, b) => -SPOTS[a]![1] + SPOTS[b]![1])
  for (const i of idx) coinFill(px, SPOTS[i]![0], SPOTS[i]![1], 'n')
  return seal(px)
}

// ---------------------------------------------------------------- chat
const inBounds = (x: number, y: number) => x >= 0 && x < W && y >= 0 && y < H
const put = (px: Layer, x: number, y: number, c: Color) => { if (inBounds(x, y)) px.set(x, y, c) }

function outline(px: Layer): void {
  const add = new Set<number>()
  for (const k of px.m.keys()) {
    const x = kx(k), y = ky(k)
    for (const [dx, dy] of NEIGHBORS) {
      if (!px.has(x + dx, y + dy) && inBounds(x + dx, y + dy)) add.add(key(x + dx, y + dy))
    }
  }
  for (const k of add) px.m.set(k, OUT)
}

function rim(px: Layer): void {
  for (const [k, c] of [...px.m]) {
    if (c !== CAT) continue
    const x = kx(k), y = ky(k)
    if (!px.has(x, y - 1) || !px.has(x - 1, y)) px.m.set(k, CAT_L)
  }
}

type Eyes = 'open' | 'happy' | 'blink' | 'sleep' | 'bored'

function setEyes(px: Layer, ox: number, oy: number, mode: Eyes): void {
  if (mode === 'open') return
  for (const x0 of [3, 8]) for (const dx of [0, 1]) {
    put(px, ox + x0 + dx, oy + 5, CAT)
    put(px, ox + x0 + dx, oy + 6, CAT)
  }
  for (const x0 of [3, 8]) {
    if (mode === 'happy') {
      put(px, ox + x0, oy + 6, EYE); put(px, ox + x0 + 1, oy + 5, EYE); put(px, ox + x0 + 2, oy + 6, EYE)
    } else if (mode === 'blink' || mode === 'sleep') {
      put(px, ox + x0, oy + 6, CAT_L); put(px, ox + x0 + 1, oy + 6, CAT_L)
    } else if (mode === 'bored') {
      put(px, ox + x0, oy + 6, EYE); put(px, ox + x0 + 1, oy + 6, EYE)
      put(px, ox + x0 + (x0 === 3 ? 1 : 0), oy + 6, OUT)
    }
  }
}

const CMAP: Record<string, Color> = { b: CAT, p: PINK, E: EYE, K: OUT, c: COLLAR }

type Paw = 'up' | 'swipe' | 'back' | null

function sittingCat(cx: number, bottom: number, f: number, eyes: Eyes = 'open', paw: Paw = null, side = -1): Layer {
  const px = new Layer()
  const ox = cx - 6
  const oy = bottom - SIT.length + 1
  SIT.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) if (row[i] !== '.') put(px, ox + i, oy + j, CMAP[row[i]!]!)
  })
  // queue du cote oppose au coup de patte
  const ts = paw ? -side : 1
  const baseX = ox + (ts > 0 ? 12 : 0)
  const pts: Array<[number, number]> = [[1, -1], [2, -2], [3, -3], [3, -4], [3, -5], [3, -6], [2, -7], [2, -8]]
  pts.forEach(([dx, dy], k) => {
    const s = pyRound(SWAY[f]! * (k / pts.length) * 2)
    const x = baseX + ts * dx + s
    put(px, x, bottom + dy + 1, CAT)
    put(px, x + ts, bottom + dy + 1, CAT)
  })
  const sx = side < 0 ? ox : ox + 12
  if (paw === 'up') {
    for (let dy = 6; dy < 10; dy++) { put(px, sx + side, oy + dy, CAT); put(px, sx + side * 2, oy + dy, CAT) }
    put(px, sx + side * 3, oy + 6, CAT); put(px, sx + side * 3, oy + 7, CAT)
  } else if (paw === 'swipe') {
    for (let i = 1; i < 6; i++) { put(px, sx + side * i, oy + 11, CAT); put(px, sx + side * i, oy + 12, CAT) }
    put(px, sx + side * 6, oy + 12, CAT); put(px, sx + side * 6, oy + 13, CAT)
    put(px, sx + side * 5, oy + 13, CAT)
  } else if (paw === 'back') {
    for (let i = 1; i < 4; i++) { put(px, sx + side * i, oy + 10, CAT); put(px, sx + side * i, oy + 11, CAT) }
  }
  rim(px)
  outline(px)
  setEyes(px, ox, oy, eyes)
  if (paw === 'swipe') {
    for (const [i, dy] of [[1, 6], [2, 7], [3, 7], [4, 8], [5, 9], [6, 10], [7, 11], [8, 12]] as const) {
      if (!px.has(sx + side * i, oy + dy)) put(px, sx + side * i, oy + dy, SMEAR)
    }
  }
  return px
}

function loafCat(cx: number, bottom: number, f: number, eyes: Eyes): [Layer, number] {
  const px = new Layer()
  const ox = cx - 6
  const oy = bottom - 11
  for (let y = oy + 6; y <= bottom; y++) {
    for (let x = ox - 1; x < ox + 14; x++) {
      if ((y === oy + 6 || y === bottom) && (x === ox - 1 || x === ox + 13)) continue
      put(px, x, y, CAT)
    }
  }
  HEAD.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) if (row[i] !== '.') put(px, ox + i, oy + j, CMAP[row[i]!]!)
  })
  const tail: Array<[number, number]> = [[14, -1], [15, -2], [16, -3], [16, -4], [15, -5]]
  tail.forEach(([dx, dy], k) => {
    const s = pyRound(SWAY[f]! * (k / 5) * 2)
    put(px, ox + dx + s, bottom + dy, CAT); put(px, ox + dx + 1 + s, bottom + dy, CAT)
  })
  rim(px)
  outline(px)
  put(px, ox + 5, bottom, OUT); put(px, ox + 7, bottom, OUT)
  setEyes(px, ox, oy, eyes)
  return [px, oy]
}

// ---------------------------------------------------------------- composition
function render(layers: Layer[]): Canvas {
  const im = new Canvas(W, H)
  for (const px of layers) {
    for (const [k, c] of px.m) {
      const x = kx(k), y = ky(k)
      if (!inBounds(x, y)) continue
      if (c >>> 24 < 255) {
        if (im.get(x, y) === 0) im.set(x, y, c)
      } else {
        im.set(x, y, c)
      }
    }
  }
  return im
}

function shadow(x0: number, x1: number): Layer {
  const px = new Layer()
  for (let x = x0; x <= x1; x++) px.set(x, GROUND + 1, SHADOW)
  for (let x = x0 + 3; x < x1 - 2; x++) px.set(x, GROUND + 2, SHADOW)
  return px
}

function idleEyes(n: number, f: number): Eyes {
  if (n >= 95) return 'happy'
  if (f === 4) return 'blink'
  if (n < 15) return 'bored'
  return 'open'
}

/** Chat au repos : `n` pieces restantes (0 a 100), frame `f` (0 a 5). */
export function drawCatIdle(n: number, f: number): Canvas {
  n = Math.max(0, Math.min(100, Math.floor(n)))
  const thrown = 100 - n
  const layers = [shadow(2, W - 3), floorLayer(thrown), pileLayer(n, f)]
  if (n > 0) {
    const [top, cx] = pileTop(n)
    layers.push(sittingCat(cx, top + 1, f, idleEyes(n, f)))
  } else {
    const [cat, oy] = loafCat(PX, GROUND, f, 'sleep')
    layers.push(cat)
    const z = new Layer()
    ;([[PX + 8, oy + 1], [PX + 11, oy - 4], [PX + 14, oy - 9]] as const).forEach(([x, y], k) => {
      if (Math.floor(f / 2) >= k || f >= 4) {
        const y2 = y - (f % 2)
        for (let i = 0; i < 4; i++) { z.set(x + i, y2, ZZ); z.set(x + i, y2 + 3, ZZ) }
        z.set(x + 2, y2 + 1, ZZ)
        z.set(x + 1, y2 + 2, ZZ)
      }
    })
    layers.push(z)
  }
  return render(layers)
}

const bezier = (p0: [number, number], p1: [number, number], p2: [number, number], t: number): [number, number] => [
  pyRound((1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0]),
  pyRound((1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1]),
]

/** Lancer de la piece COINS[n-1] : `n` pieces avant le lancer (1 a 100), frame `f` (0 a 7). */
export function drawCatThrow(n: number, f: number): Canvas {
  n = Math.max(1, Math.min(100, Math.floor(n)))
  const k = 100 - n
  const coin = COINS[n - 1]!
  const land = lands(k)
  let side: number, ex: number, ey: number
  if (land) {
    ;[ex, ey] = SPOTS[Math.floor(k / 5)]!
    side = ex < PX ? -1 : 1
  } else {
    side = coin.x < PX || (coin.x === PX - 1 && k % 2) ? -1 : 1
    if (coin.x >= PX - 2 && coin.x <= PX) side = k % 2 ? -1 : 1
    ex = side < 0 ? -10 : W + 7
    ey = coin.y + 12
  }

  const popped = f >= 2
  const pileN = popped ? n - 1 : n
  const floorN = land && f === 7 ? k + 1 : k
  const layers = [shadow(2, W - 3), floorLayer(floorN), pileLayer(pileN, 0, f === 0 || f === 1 ? n - 1 : null)]

  const [top, cx] = pileTop(n)
  const paw: Paw = ({ 1: 'up', 2: 'swipe', 3: 'back' } as Record<number, Paw>)[f] ?? null
  const eyes: Eyes = f === 7 ? 'happy' : 'open'
  const lean = f === 2 ? side : 0
  layers.push(sittingCat(cx + lean, top + 1, f, eyes, paw, side))

  const fly = new Layer()
  const sx = coin.x, sy = coin.y
  const p1: [number, number] = [(sx + ex) / 2, Math.max(-6, Math.min(sy, ey) - (land ? 30 : 24))]
  const ts: Record<number, number> = { 2: 0.0, 3: 0.18, 4: 0.4, 5: 0.62, 6: 0.84, 7: 1.0 }
  const widths: Record<number, number> = { 2: 3, 3: 2, 4: 1, 5: 2, 6: 3, 7: 3 }
  if (f in ts && (land || f < 7)) {
    const [x, y] = bezier([sx, sy], p1, [ex, ey], ts[f]!)
    coinFill(fly, x, y, 's', widths[f])
    seal(fly)
    if (f >= 3 && f <= 6) {
      for (const [lag, col] of [[0.07, GOLD_L], [0.14, GOLD], [0.21, GOLD_D]] as const) {
        const [qx, qy] = bezier([sx, sy], p1, [ex, ey], Math.max(0, ts[f]! - lag))
        fly.set(qx + 1, qy + 1, col)
      }
      if (f === 4) {
        fly.set(x + 1, y - 3, WHITE); fly.set(x, y - 2, WHITE); fly.set(x + 2, y - 2, WHITE)
      }
    }
    if (f === 7 && land) {
      for (const [dx, dy] of [[-3, 1], [-2, 0], [5, 1], [4, 0]] as const) fly.set(x + dx, y + dy, DUST)
    }
  }
  if (f === 7 && !land) {
    const bx = side < 0 ? 2 : W - 3
    const by = Math.max(4, Math.min(H - 8, ey - 14))
    for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]] as const) fly.set(bx + dx, by + dy, GOLD_L)
  }
  layers.push(fly)
  return render(layers)
}
