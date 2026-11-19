// Port de reference/draw_witch.py : la sorcière (contexte), 40x66 px.
import { Canvas, pyRound, rgba, seeded, type Color } from './pixels'

export const W = 40
export const H = 66
const GROUND = 62
const CX = 20

const T = (r: number, g: number, b: number): Color => rgba(r, g, b)
const OUT = T(40, 26, 44)
const HAIR = T(198, 78, 60)
const HAIR_L = T(236, 128, 86)
const HAIR_D = T(146, 50, 46)
const RIBBON = T(250, 210, 90)
const SKIN = T(250, 210, 170)
const BLUSH = T(242, 140, 140)
const EYE = T(70, 120, 196)
const WHITE = T(255, 255, 255)
const JACKET = T(104, 66, 160)
const JACKET_D = T(74, 44, 120)
const TRIM = T(240, 196, 92)
const SCARF = T(240, 140, 52)
const SCARF_D = T(196, 100, 36)
const SKIRT = T(46, 36, 70)
const SKIRT_D = T(34, 26, 54)
const LEG = T(44, 34, 60)
const LEG_S = T(236, 230, 244)
const HAT = T(62, 46, 100)
const HAT_D = T(44, 32, 74)
const HAT_L = T(88, 68, 132)
const BOOT = T(70, 44, 52)
const BOOT_L = T(104, 66, 76)
const SWEAT = T(150, 206, 244)
const STAR = T(250, 220, 100)
const DUST = T(204, 196, 186)
const SHADOW = rgba(40, 26, 44, 70)
const PAGES = T(246, 238, 212)
const MOUTH_RED = T(170, 60, 70)
const BOOKS: Array<[Color, Color]> = [
  [T(120, 44, 68), T(88, 28, 50)],
  [T(44, 96, 80), T(28, 70, 58)],
  [T(70, 60, 140), T(48, 40, 104)],
  [T(140, 84, 50), T(104, 58, 34)],
  [T(36, 74, 120), T(24, 52, 90)],
  [T(96, 50, 120), T(70, 32, 92)],
]

type Pose = 'down' | 'up' | 'crouch' | 'flat'
type Face = 'calm' | 'focus' | 'effort' | 'strain' | 'panic' | 'crushed'
type State = {
  books: number; legs: number; top: number; skirt: number
  head: number; hw: number; pose: Pose; face: Face
}

const S = (
  books: number, legs: number, top: number, skirt: number,
  head: number, hw: number, pose: Pose, face: Face,
): State => ({ books, legs, top, skirt, head, hw, pose, face })

// 11 paliers : 0 %, 10 %, ... 100 %
export const STATES: State[] = [
  S(0, 5, 4, 3, 10, 10, 'down', 'calm'),
  S(1, 5, 4, 3, 10, 10, 'up', 'calm'),
  S(2, 5, 4, 3, 10, 10, 'up', 'calm'),
  S(3, 5, 4, 3, 10, 10, 'up', 'focus'),
  S(4, 5, 4, 3, 10, 10, 'up', 'focus'),
  S(6, 5, 4, 3, 10, 10, 'up', 'effort'),
  S(7, 4, 4, 3, 10, 10, 'up', 'effort'),
  S(9, 4, 3, 3, 10, 10, 'crouch', 'strain'),
  S(10, 3, 3, 2, 10, 10, 'crouch', 'strain'),
  S(12, 2, 3, 2, 9, 11, 'crouch', 'panic'),
  S(14, 1, 2, 2, 7, 12, 'flat', 'crushed'),
]
export const NF = 6
const BOB = [0, 0, 1, 1, 1, 0]
const SWAY = [0, 1, 1, 0, -1, -1]
const JIT: Record<number, number[]> = {
  7: [0, 0, 0, 0, 0, 0],
  8: [0, 0, 1, 0, 0, -1],
  9: [0, 1, 0, -1, 0, 1],
}

type Geo = { ht: number; hx0: number; hx1: number; bodyTop: number; hatTop: number; hands: number | null }

function drawHeroine(si: number, f: number, booksOverride?: number): { c: Canvas; g: Geo } {
  const { books: stateBooks, legs, top, skirt, head, hw, pose, face } = STATES[si]!
  const books = booksOverride ?? stateBooks
  const c = new Canvas(W, H)
  const sway = SWAY[f]!

  // jambes
  const legTop = GROUND - legs + 1
  const lx: Array<[number, number]> =
    pose === 'crouch' ? [[CX - 5, CX - 3], [CX + 2, CX + 4]]
    : pose === 'flat' ? [[CX - 6, CX - 3], [CX + 2, CX + 5]]
    : [[CX - 3, CX - 2], [CX + 1, CX + 2]]
  for (const [x0, x1] of lx) {
    c.rect(x0, legTop, x1, GROUND, LEG)
    for (let yy = legTop; yy <= GROUND; yy++) if ((GROUND - yy) % 2 === 0) c.rect(x0, yy, x1, yy, LEG_S)
    const bh = legs >= 3 ? 2 : 1
    c.rect(x0, GROUND - bh + 1, x1, GROUND, BOOT)
    c.set(x0, GROUND - bh + 1, BOOT_L)
    if (pose === 'down' || pose === 'up') c.set(x0 > CX ? x1 + 1 : x0 - 1, GROUND, BOOT)
  }

  // jupe
  const skBot = legTop - 1
  const skTop = skBot - skirt + 1
  for (let i = 0, y = skTop; y <= skBot; i++, y++) {
    const spread = pose !== 'flat' ? 4 + i : 6 + i
    c.rect(CX - spread, y, CX + spread - 1, y, SKIRT)
  }
  c.rect(CX - 4 - (skirt - 1), skBot, CX + 3 + (skirt - 1), skBot, SKIRT_D)
  if (pose === 'flat') c.rect(CX - 6 - (skirt - 1), skBot, CX + 5 + (skirt - 1), skBot, SKIRT_D)

  // veste
  const jb = skTop - 1
  const jt = jb - top + 1
  const [jx0, jx1] = pose !== 'flat' ? [CX - 4, CX + 3] : [CX - 5, CX + 4]
  c.rect(jx0, jt, jx1, jb, JACKET)
  c.rect(jx0, jt, jx0, jb, JACKET_D)
  c.rect(jx1, jt, jx1, jb, JACKET_D)
  for (let y = jt + 1; y < jb; y += 2) c.set(CX - 1, y, TRIM)
  c.rect(jx0, jb, jx1, jb, TRIM)
  const bodyTop = jt

  // tete
  const hx0 = CX - Math.floor(hw / 2)
  const hx1 = hx0 + hw - 1
  const hb = bodyTop - 1
  const ht = hb - head + 1

  // queue de cheval
  if (pose !== 'flat') {
    const baseX = hx1
    const baseY = ht + 1
    const tail: Array<[number, number, number]> = [
      [1, 0, 2], [1, 1, 3], [2, 2, 3], [2, 3, 3], [2, 4, 3], [2, 5, 3], [2, 6, 2], [2, 7, 2], [1, 8, 2], [1, 9, 1],
    ]
    const n = tail.length
    tail.forEach(([tx, ty, tw], k) => {
      const s = pyRound(sway * (k / n) * 1.8)
      for (let w = 0; w < tw; w++) {
        let col = w === tw - 1 && tw > 1 ? HAIR_D : HAIR
        if ((k === 2 || k === 3) && w === 0) col = HAIR_L
        c.set(baseX + tx + w + s, baseY + ty, col)
      }
    })
  } else {
    for (let k = 0; k < 7; k++) {
      c.set(hx1 + 1 + k, hb - (k < 2 ? 1 : 0), HAIR)
      c.set(hx1 + 1 + k, hb - (k < 2 ? 2 : 1), k > 1 ? HAIR_D : HAIR)
    }
  }

  c.rect(hx0, ht, hx1, hb, SKIN)
  for (const [x, y] of [[hx0, ht], [hx1, ht], [hx0, hb], [hx1, hb]] as const) c.clear(x, y)
  // calotte et reflet
  c.rect(hx0 + 1, ht, hx1 - 1, ht, HAIR)
  c.rect(hx0, ht + 1, hx1, ht + 2, HAIR)
  c.set(hx0 + 2, ht + 1, HAIR_L); c.set(hx0 + 3, ht + 1, HAIR_L); c.set(hx0 + 4, ht + 1, HAIR_L)
  // frange
  const bangY = ht + 3
  for (let x = hx0; x <= hx1; x++) if (x !== hx0 + 3 && x !== hx1 - 2) c.set(x, bangY, HAIR)
  c.set(hx0 + 1, bangY + 1, HAIR)
  c.set(hx1 - 1, bangY + 1, HAIR)
  // meches laterales
  const lock = head >= 9 ? 4 : 2
  c.rect(hx0, ht + 3, hx0, ht + 3 + lock, HAIR)
  c.rect(hx1, ht + 3, hx1, ht + 3 + lock, HAIR)
  c.set(hx0, ht + 3 + lock, HAIR_D); c.set(hx1, ht + 3 + lock, HAIR_D)
  // ruban
  if (pose !== 'flat') {
    c.set(hx1, ht, RIBBON); c.set(hx1 + 1, ht, RIBBON); c.set(hx1 + 1, ht + 1, RIBBON)
  }

  // chapeau
  const crown = pose !== 'flat' ? (books === 0 ? 9 : Math.max(2, 5 - books)) : 1
  const brimY = ht + 1
  const bw = pose !== 'flat' ? 3 : 4
  c.rect(hx0 - bw, brimY, hx1 + bw, brimY, HAT)
  if (crown === 9) {
    const widths = [8, 8, 7, 6, 5, 4, 3, 2, 2]
    const shifts = [0, 0, 0, 1, 1, 2, 3, 4, 5]
    for (let k = 0; k < 9; k++) {
      const y = brimY - 1 - k
      const w = widths[k]!
      const sh = shifts[k]! + (k >= 6 ? pyRound(SWAY[f]! * 0.6) : 0)
      const x0 = CX - 4 + Math.floor((8 - w) / 2) + sh
      c.rect(x0, y, x0 + w - 1, y, HAT)
      c.set(x0, y, HAT_L)
    }
    c.rect(CX - 4, brimY - 1, CX + 3, brimY - 1, SCARF)
    c.set(CX - 1, brimY - 1, TRIM); c.set(CX, brimY - 1, TRIM)
  } else {
    const rnd = seeded(books)
    for (let k = 0; k < crown; k++) {
      const y = brimY - 1 - k
      const half = Math.max(3, 5 - k)
      c.rect(CX - half, y, CX + half - 1, y, HAT)
      if (half > 3) c.set(CX - half + rnd.randint(1, 2 * half - 2), y, HAT_D)
      c.set(CX - half, y, HAT_L)
    }
    c.rect(CX - 5, brimY - 1, CX + 4, brimY - 1, SCARF)
    c.set(CX - 1, brimY - 1, TRIM)
  }
  const hatTop = brimY - crown

  // echarpe
  c.rect(jx0 + 1, bodyTop, jx1 - 1, bodyTop, SCARF)
  if (pose !== 'flat') {
    const ends: Array<[number, number]> = sway >= 0 ? [[-1, 1], [-2, 2], [-2, 3]] : [[-1, 1], [-1, 2], [-2, 2]]
    for (const [ex, ey] of ends) c.set(jx0 + ex + 1, bodyTop + ey, SCARF_D)
  }

  // bras
  let hands: number | null = null
  if (pose === 'down') {
    for (const ax of [jx0 - 2, jx1 + 1]) {
      c.rect(ax, bodyTop + 1, ax + 1, bodyTop + 3, JACKET_D)
      c.rect(ax, bodyTop + 4, ax + 1, bodyTop + 4, SKIN)
    }
  } else if (pose === 'up' || pose === 'crouch') {
    hands = hatTop - 1
    for (const ax of [hx0 - 2, hx1 + 1]) {
      c.rect(ax, hands, ax + 1, bodyTop + 1, SKIN)
      c.rect(ax, ht + 4, ax + 1, bodyTop + 1, JACKET_D)
      c.rect(ax, ht + 4, ax + 1, ht + 4, TRIM)
    }
  } else {
    const tw = f % 2 ? 1 : 0
    c.rect(hx0 - 5, bodyTop + 1, jx0 - 1, bodyTop + 2, JACKET_D)
    c.rect(jx1 + 1, bodyTop + 1, hx1 + 5, bodyTop + 2, JACKET_D)
    c.rect(hx0 - 7, bodyTop + 1 - tw, hx0 - 6, bodyTop + 2 - tw, SKIN)
    c.rect(hx1 + 6, bodyTop + 1 - (1 - tw), hx1 + 7, bodyTop + 2 - (1 - tw), SKIN)
  }

  c.outline(OUT)

  // visage (apres le contour)
  const ey = ht + (head >= 9 ? 5 : 3)
  const exs: [number, number] = [hx0 + 2, hx1 - 3]
  const blink = (face === 'calm' || face === 'focus') && f === 4 && si <= 4
  const mouthY = head >= 9 ? ey + 3 : ey + 2

  const bigEyes = () => {
    exs.forEach((x, i) => {
      c.rect(x, ey, x + 1, ey, OUT)
      c.set(i === 0 ? x - 1 : x + 2, ey - 1, OUT)
      c.set(x, ey + 1, EYE)
      if (i === 0) c.set(x + 1, ey + 1, WHITE)
      else { c.set(x, ey + 1, WHITE); c.set(x + 1, ey + 1, EYE) }
      c.rect(x, ey + 2, x + 1, ey + 2, EYE)
    })
  }

  if (blink) {
    for (const x of exs) c.rect(x, ey + 2, x + 1, ey + 2, OUT)
  } else if (face === 'calm') {
    bigEyes()
  } else if (face === 'focus') {
    bigEyes()
    exs.forEach((x, i) => c.set(x + (i === 0 ? 1 : 0), ey - 1, OUT))
  } else if (face === 'effort') {
    exs.forEach((x, i) => {
      c.rect(x, ey + 1, x + 1, ey + 1, OUT)
      c.rect(x, ey + 2, x + 1, ey + 2, EYE)
      c.set(x + (i === 0 ? 1 : 0), ey - 1, OUT)
    })
  } else if (face === 'strain' || face === 'panic') {
    const [a, b] = exs
    c.set(a, ey, OUT); c.set(a + 1, ey + 1, OUT); c.set(a, ey + 2, OUT)
    c.set(b + 1, ey, OUT); c.set(b, ey + 1, OUT); c.set(b + 1, ey + 2, OUT)
  } else if (face === 'crushed') {
    for (const x of exs) {
      c.set(x, ey - 1, OUT); c.set(x + 1, ey, OUT); c.set(x, ey + 1, OUT)
      c.set(x + 1, ey - 1, OUT); c.set(x + 1, ey + 1, OUT)
    }
  }

  if (face === 'calm') {
    c.set(CX - 1, mouthY, OUT); c.set(CX, mouthY, OUT)
    c.set(CX - 2, mouthY - 1, OUT); c.set(CX + 1, mouthY - 1, OUT)
  } else if (face === 'focus') {
    c.rect(CX - 1, mouthY, CX, mouthY, OUT)
  } else if (face === 'effort') {
    c.rect(CX - 2, mouthY, CX + 1, mouthY, OUT)
  } else if (face === 'strain') {
    c.rect(CX - 2, mouthY, CX + 1, mouthY, OUT)
    c.set(CX - 1, mouthY + 1, WHITE); c.set(CX, mouthY + 1, WHITE)
    const yy = head >= 10 ? mouthY + 2 : mouthY + 1
    c.rect(CX - 2, yy, CX + 1, yy, OUT)
  } else if (face === 'panic') {
    c.rect(CX - 1, mouthY - 1, CX, mouthY - 1, OUT)
    c.set(CX - 2, mouthY, OUT); c.set(CX + 1, mouthY, OUT)
    c.rect(CX - 1, mouthY, CX, mouthY, MOUTH_RED)
  } else if (face === 'crushed') {
    for (let k = 0; k < 4; k++) c.set(CX - 2 + k, mouthY + (k % 2), OUT)
  }
  if (face !== 'crushed') {
    c.set(exs[0] - 1, ey + 3, BLUSH)
    c.set(exs[1] + 2, ey + 3, BLUSH)
  }

  return { c, g: { ht, hx0, hx1, bodyTop, hatTop, hands } }
}

function drawBooks(n: number, bottomY: number, f: number, seed = 11): Canvas {
  const c = new Canvas(W, H)
  const rnd = seeded(seed)
  const amp = n <= 3 ? 0 : n <= 7 ? 1 : 2
  let y = bottomY
  for (let i = 0; i < n; i++) {
    const [col, dark] = BOOKS[(i * 5 + 2) % BOOKS.length]!
    const w = rnd.choice([12, 13, 14, 15, 16])
    const off = rnd.choice([-1, 0, 0, 1])
    const wob = pyRound(amp * Math.pow(i / Math.max(1, n - 1), 1.5) * SWAY[f]!)
    const x0 = CX - Math.floor(w / 2) + off + wob
    const x1 = x0 + w - 1
    c.rect(x0, y - 3, x1, y, OUT)
    c.rect(x0 + 1, y - 2, x1 - 1, y - 1, col)
    c.rect(x0 + 1, y - 1, x1 - 1, y - 1, dark)
    c.rect(x1 - 3, y - 2, x1 - 1, y - 1, PAGES)
    c.set(x0 + 2, y - 2, TRIM); c.set(x0 + 3, y - 1, TRIM)
    y -= 3
  }
  return c
}

/** Une image de la sorcière pour le palier `si` (0 a 10) et la frame `f` (0 a 5). */
export function drawWitch(si: number, f: number, booksOverride?: number): Canvas {
  const { books: stateBooks, legs, pose, face } = STATES[si]!
  const books = booksOverride ?? stateBooks
  const { c: hero, g } = drawHeroine(si, f, booksOverride)
  const dy = pose === 'down' || pose === 'up' ? BOB[f]! : si < 9 ? BOB[f]! : 0
  const dx = JIT[si]?.[f] ?? 0
  const out = new Canvas(W, H)
  const sw = pose !== 'flat' ? 8 : 12
  out.rect(CX - sw, GROUND + 1, CX + sw - 1, GROUND + 1, SHADOW)
  out.rect(CX - sw + 2, GROUND + 2, CX + sw - 3, GROUND + 2, SHADOW)

  // respiration : le haut du corps descend, les pieds restent
  const upper = new Canvas(W, H)
  const lower = new Canvas(W, H)
  const split = GROUND - legs
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const v = hero.px[y * W + x]!
      if (v === 0) continue
      ;(y <= split ? upper : lower).px[y * W + x] = v
    }
  }
  out.over(lower, dx, 0)
  out.over(upper, dx, dy)
  if (books) {
    const bt = g.hands !== null ? g.hatTop - 2 : g.hatTop - 1
    out.over(drawBooks(books, bt, f), dx, dy)
    if (g.hands !== null) {
      for (const ax of [g.hx0 - 2, g.hx1 + 1]) {
        out.rect(ax + dx, g.hands - 1 + dy, ax + 1 + dx, g.hands - 1 + dy, SKIN)
      }
    }
  }

  const hx0 = g.hx0 + dx
  const hx1 = g.hx1 + dx
  const ht = g.ht + dy
  if (face === 'effort' || face === 'strain' || face === 'panic') {
    const sy = ht + 2 + (f % 3)
    out.set(hx0 - 3, sy, SWEAT); out.set(hx0 - 3, sy + 1, SWEAT)
  }
  if (face === 'strain' || face === 'panic') {
    const sy = ht + 4 + ((f + 1) % 3)
    out.set(hx1 + 6, sy, SWEAT); out.set(hx1 + 6, sy + 1, SWEAT)
  }
  if (face === 'panic') {
    ;([[hx0 - 5, ht - 1], [hx1 + 5, ht - 1]] as const).forEach(([sx, sy], k) => {
      if ((f + k) % 2 === 0) {
        out.set(sx, sy, OUT)
        out.set(sx + (k ? 1 : -1), sy - 1, OUT)
      }
    })
  }
  if (face === 'crushed') {
    const p = f % 3
    for (const sx of [3 + p, W - 4 - p]) {
      out.rect(sx - 1, GROUND - p, sx, GROUND - p, DUST)
      out.set(sx, GROUND - p - 1, DUST)
    }
    const stars: Array<[number, number]> = [[-9, -2], [-11, 1], [11, -2], [13, 1]]
    stars.forEach(([sx, sy], k) => {
      if ((f + k) % 2 === 0) {
        const x = CX + sx
        const y = g.ht + 3 + sy
        out.set(x, y, STAR); out.set(x - 1, y, STAR); out.set(x + 1, y, STAR)
        out.set(x, y - 1, STAR); out.set(x, y + 1, STAR)
      }
    })
  }
  return out
}

// ---------------------------------------------------------------- continu
const BOOKS_AT = STATES.map(s => s.books) // 0, 1, 2, 3, 4, 6, 7, 9, 10, 12, 14

/** Nombre de grimoires (entier) pour un contexte de 0 a 100 %, interpole entre les paliers. */
export function booksFor(pct: number): number {
  const p = Math.max(0, Math.min(100, pct)) / 10
  const i = Math.min(BOOKS_AT.length - 2, Math.floor(p))
  const t = p - i
  return Math.round(BOOKS_AT[i]! + (BOOKS_AT[i + 1]! - BOOKS_AT[i]!) * t)
}

/**
 * Palier de pose et de visage pour ce contexte. Sans grimoire, elle reste debout
 * (palier 0) ; des qu'elle en porte, au moins le palier 1 (bras leves).
 */
export function levelFor(pct: number): number {
  if (booksFor(pct) === 0) return 0
  return Math.max(1, Math.min(10, Math.floor(pct / 10)))
}

/** Sorciere pour un contexte continu (0 a 100 %) et la frame `f` (0 a 5). */
export function drawWitchPct(pct: number, f: number): Canvas {
  return drawWitch(levelFor(pct), f, booksFor(pct))
}

/** Signature de l'image (change quand le dessin change, hors animation). */
export const witchSig = (pct: number): string => `${levelFor(pct)}/${booksFor(pct)}`
