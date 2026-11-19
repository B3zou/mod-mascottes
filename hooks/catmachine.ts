// Machine a etats du chat : idle, puis un lancer joue une fois a chaque baisse d'1 %.
import { drawCatIdle, drawCatThrow } from './cat'
import type { Canvas } from './pixels'

/** Au plus ce nombre de lancers sont rejoues quand l'usage chute d'un coup. */
export const MAX_QUEUED_THROWS = 3
export const THROW_FRAMES = 8

export type CatStep = {
  canvas: Canvas
  /** Pieces affichees dans le tas pendant cette image. */
  coins: number
  /** Image du lancer en cours (0 a 7), ou -1 a l'idle. */
  throwFrame: number
}

export function createCatMachine() {
  let shown: number | null = null
  let throwFrame = -1

  /**
   * Une image. `target` : pieces restantes visees (0 a 100), `idle` : image de
   * l'idle (0 a 5). Le premier appel ne lance rien : il prend `target` tel quel.
   */
  function step(target: number, idle: number): CatStep {
    if (shown === null) shown = target
    if (throwFrame < 0) {
      if (shown < target) shown = target // fenetre renouvelee : on remplit d'un coup
      if (shown > target) {
        shown = Math.min(shown, target + MAX_QUEUED_THROWS) // trop d'un coup : on saute
        throwFrame = 0
      }
    }
    if (throwFrame >= 0 && shown > 0) {
      const frame = throwFrame
      const coins = shown
      const canvas = drawCatThrow(coins, frame)
      throwFrame++
      if (throwFrame >= THROW_FRAMES) {
        throwFrame = -1
        shown--
      }
      return { canvas, coins, throwFrame: frame }
    }
    throwFrame = -1
    return { canvas: drawCatIdle(shown, idle), coins: shown, throwFrame: -1 }
  }

  return { step, coins: () => shown }
}
