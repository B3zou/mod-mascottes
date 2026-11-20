// Moteur de pixels : un tableau 0xAARRGGBB (0 = vide), les memes primitives que
// les scripts Python de reference (rect, contour automatique, over).

export type Color = number

export const rgba = (r: number, g: number, b: number, a = 255): Color =>
  ((a << 24) | (r << 16) | (g << 8) | b) >>> 0

/** round() de Python : arrondi au pair le plus proche sur les .5. */
export const pyRound = (x: number): number => {
  const f = Math.floor(x)
  const d = x - f
  if (d < 0.5) return f
  if (d > 0.5) return f + 1
  return f % 2 === 0 ? f : f + 1
}

/** Petit PRNG deterministe (mulberry32), pour remplacer random.Random(seed). */
export const seeded = (seed: number) => {
  let a = seed >>> 0
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  return {
    randint: (lo: number, hi: number) => lo + Math.floor(next() * (hi - lo + 1)),
    choice: <T,>(xs: T[]): T => xs[Math.floor(next() * xs.length)]!,
  }
}

export class Canvas {
  readonly px: Uint32Array
  constructor(readonly w: number, readonly h: number) {
    this.px = new Uint32Array(w * h)
  }

  set(x: number, y: number, c: Color): void {
    if (x >= 0 && x < this.w && y >= 0 && y < this.h) this.px[y * this.w + x] = c
  }

  get(x: number, y: number): Color {
    return x >= 0 && x < this.w && y >= 0 && y < this.h ? this.px[y * this.w + x]! : 0
  }

  clear(x: number, y: number): void {
    this.set(x, y, 0)
  }

  rect(x0: number, y0: number, x1: number, y1: number, c: Color): void {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) this.set(x, y, c)
  }

  /** Tout pixel vide voisin (4 directions) d'un pixel plein autre que `out` devient `out`. */
  outline(out: Color): void {
    const add: number[] = []
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (this.px[y * this.w + x] !== 0) continue
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          const v = this.get(x + dx!, y + dy!)
          if (v !== 0 && v !== out) {
            add.push(y * this.w + x)
            break
          }
        }
      }
    }
    for (const i of add) this.px[i] = out
  }

  over(other: Canvas, ox = 0, oy = 0): void {
    for (let y = 0; y < other.h; y++) {
      for (let x = 0; x < other.w; x++) {
        const v = other.px[y * other.w + x]!
        if (v !== 0) this.set(x + ox, y + oy, v)
      }
    }
  }
}

const lum = (c: Color) => ((c >> 16) & 255) * 3 + ((c >> 8) & 255) * 6 + (c & 255)

/**
 * Reduit de moitie : chaque bloc 2x2 donne un pixel. Vide s'il a moins de 2
 * pixels pleins ; sinon la couleur majoritaire, a egalite la plus sombre
 * (pour que les contours survivent).
 */
export const downscale2 = (cv: Canvas): Canvas => {
  const out = new Canvas(Math.ceil(cv.w / 2), Math.ceil(cv.h / 2))
  for (let y = 0; y < out.h; y++) {
    for (let x = 0; x < out.w; x++) {
      const cs = [cv.get(2 * x, 2 * y), cv.get(2 * x + 1, 2 * y), cv.get(2 * x, 2 * y + 1), cv.get(2 * x + 1, 2 * y + 1)]
        .filter(c => c !== 0)
      if (cs.length < 2) continue
      let best = cs[0]!
      let bestN = 0
      for (const c of cs) {
        const n = cs.filter(d => d === c).length
        if (n > bestN || (n === bestN && lum(c) < lum(best))) {
          best = c
          bestN = n
        }
      }
      out.set(x, y, best)
    }
  }
  return out
}

/**
 * Reduit de moitie en hauteur seulement : chaque paire verticale donne un pixel.
 * Un pixel plein l'emporte sur le vide ; deux couleurs : la plus sombre (les
 * contours survivent).
 */
export const downscaleV2 = (cv: Canvas): Canvas => {
  const out = new Canvas(cv.w, Math.ceil(cv.h / 2))
  for (let y = 0; y < out.h; y++) {
    for (let x = 0; x < out.w; x++) {
      const a = cv.get(x, 2 * y)
      const b = cv.get(x, 2 * y + 1)
      out.set(x, y, a === 0 ? b : b === 0 ? a : lum(b) < lum(a) ? b : a)
    }
  }
  return out
}

const DEFAULT = 0x01000000

/** Melange une couleur a alpha sur un fond opaque, rend 0x00RRGGBB. */
const flatten = (c: Color, bg: number): number => {
  const a = c >>> 24
  if (a === 255) return c & 0xffffff
  const mix = (s: number, d: number) => Math.round((s * a + d * (255 - a)) / 255)
  const r = mix((c >> 16) & 255, (bg >> 16) & 255)
  const g = mix((c >> 8) & 255, (bg >> 8) & 255)
  const b = mix(c & 255, bg & 255)
  return (r << 16) | (g << 8) | b
}

/**
 * Demi-blocs : une cellule = 2 pixels l'un sur l'autre (haut en avant-plan,
 * bas en arriere-plan). Rend les mots [codePoint, fg, bg] de RasterProps.
 * `bg` : fond suppose du terminal, pour fondre les pixels semi-transparents.
 */
export const toRasterWords = (cv: Canvas, bg = 0x1e1e1e): Uint32Array => {
  const cols = cv.w
  const rows = Math.ceil(cv.h / 2)
  const words = new Uint32Array(cols * rows * 3)
  for (let r = 0; r < rows; r++) {
    for (let x = 0; x < cols; x++) {
      const top = cv.get(x, r * 2)
      const bot = cv.get(x, r * 2 + 1)
      let cp = 0x20
      let fg = DEFAULT
      let bgc = DEFAULT
      if (top !== 0 && bot !== 0) {
        cp = 0x2580
        fg = flatten(top, bg)
        bgc = flatten(bot, bg)
      } else if (top !== 0) {
        cp = 0x2580
        fg = flatten(top, bg)
      } else if (bot !== 0) {
        cp = 0x2584
        fg = flatten(bot, bg)
      }
      const i = (r * cols + x) * 3
      words[i] = cp
      words[i + 1] = fg
      words[i + 2] = bgc
    }
  }
  return words
}

// Quadrants : masque (1 haut-gauche, 2 haut-droite, 4 bas-gauche, 8 bas-droite) -> caractere.
const QUADRANTS = [
  0x20, 0x2598, 0x259d, 0x2580, 0x2596, 0x258c, 0x259e, 0x259b,
  0x2597, 0x259a, 0x2590, 0x259c, 0x2584, 0x2599, 0x259f, 0x2588,
]

/**
 * Quadrants : une cellule = 2x2 pixels, mais 2 couleurs seulement (avant-plan
 * et fond). Dans un bloc a 3 couleurs ou plus, garde la paire qui s'ecarte le
 * moins de l'original (le vide compte comme le fond du terminal). Les pixels
 * sont deux fois plus hauts que larges : passer une image reduite en hauteur.
 */
export const toQuadrantWords = (cv: Canvas, bg = 0x1e1e1e): Uint32Array => {
  const cols = Math.ceil(cv.w / 2)
  const rows = Math.ceil(cv.h / 2)
  const words = new Uint32Array(cols * rows * 3)
  const rgb = (c: Color) => (c === 0 ? bg : flatten(c, bg))
  const dist = (a: number, b: number) => {
    const dr = ((a >> 16) & 255) - ((b >> 16) & 255)
    const dg = ((a >> 8) & 255) - ((b >> 8) & 255)
    const db = (a & 255) - (b & 255)
    return 3 * dr * dr + 6 * dg * dg + db * db
  }
  for (let r = 0; r < rows; r++) {
    for (let x = 0; x < cols; x++) {
      const px = [cv.get(2 * x, 2 * r), cv.get(2 * x + 1, 2 * r), cv.get(2 * x, 2 * r + 1), cv.get(2 * x + 1, 2 * r + 1)]
      const uniq = [...new Set(px)]
      let a = uniq[0]!
      let b = uniq[1] ?? uniq[0]!
      if (uniq.length > 2) {
        let best = Infinity
        for (let i = 0; i < uniq.length; i++) {
          for (let j = i + 1; j < uniq.length; j++) {
            const ci = rgb(uniq[i]!), cj = rgb(uniq[j]!)
            const err = px.reduce((s, p) => s + Math.min(dist(rgb(p), ci), dist(rgb(p), cj)), 0)
            if (err < best) { best = err; a = uniq[i]!; b = uniq[j]! }
          }
        }
      }
      // a = avant-plan ; le vide ne peut etre que le fond (couleur par defaut).
      if (a === 0) [a, b] = [b, a]
      let mask = 0
      px.forEach((p, k) => {
        if (p === a || (p !== b && dist(rgb(p), rgb(a)) <= dist(rgb(p), rgb(b)))) mask |= 1 << k
      })
      const i = (r * cols + x) * 3
      words[i] = a === 0 ? 0x20 : QUADRANTS[mask]!
      words[i + 1] = a === 0 ? DEFAULT : flatten(a, bg)
      words[i + 2] = b === 0 || b === a ? DEFAULT : flatten(b, bg)
    }
  }
  return words
}

/** Base64 attendu par RasterProps.cells (toBase64 est fourni par le moteur du mod). */
export const encodeCells = (words: Uint32Array): string =>
  (new Uint8Array(words.buffer) as Uint8Array & { toBase64(): string }).toBase64()
