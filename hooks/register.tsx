import { atom, read, update } from 'claude-code'
import type { ElementTable, Register } from 'claude-code'

import { drawCatIdle } from './cat'
import { createCatMachine } from './catmachine'
import { downscale2, downscaleV2, encodeCells, toQuadrantWords, toRasterWords, type Canvas } from './pixels'
import { drawWitchPct, witchSig } from './witch'

const PANE = 'mascottes'

const contextPct = atom({ plugin: 'mod-mascottes', key: 'contextPct' } as const, 0, {
  shape: 'num-1',
})
const remainingPct = atom({ plugin: 'mod-mascottes', key: 'remainingPct' } as const, 100, {
  shape: 'num-1',
})

const TICK_MS = 100 // 10 images par seconde (lancer) ; l'idle avance a 6 par seconde

// Demo : un cycle de 0 a 100 % (une piece toutes les 0,9 s d'horloge de demo, le
// temps d'un lancer), puis 6 s de pause avec le chat endormi, puis on repart.
const DEMO_STEP_S = 0.9
const DEMO_PAUSE_S = 6
const DEMO_CYCLE_S = 100 * DEMO_STEP_S + DEMO_PAUSE_S

type Demo = { startedAt: number; speed: number }

// Les variables du module repartent a zero a un rechargement.
let tick = 0
let lastKey = ''
let demo: Demo | null = null
let real = { ctx: 0, rem: 100 } // vraies valeurs, gardees pendant une demo
const cat = createCatMachine()

const idleFrame = () => Math.floor((tick * TICK_MS) / 166) % 6

export const register: Register = (on, options) => {
  // Option `size`, cellules par mascotte :
  //   full    40 x 33, demi-blocs, tous les pixels ;
  //   compact 20 x 17, quadrants sur l'image reduite en hauteur seulement ;
  //   half    20 x 17, demi-blocs sur l'image reduite de moitie.
  const mode = options.size === 'half' || options.size === 'compact' ? options.size : 'full'
  const size = mode === 'full' ? { columns: 40, rows: 33 } : { columns: 20, rows: 17 }
  const toCells = (cv: Canvas): string =>
    encodeCells(
      mode === 'compact' ? toQuadrantWords(downscaleV2(cv))
        : toRasterWords(mode === 'half' ? downscale2(cv) : cv),
    )

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'mascottes',
      description: 'Ouvre le pane des mascottes (contexte et usage restant)',
    })
    await $.command.register({
      name: 'mascottes-demo',
      description: 'Simule le cycle complet des mascottes, sans appeler le modele (stop pour arreter)',
    })
    void $.ui.open({ id: PANE, title: 'Mascottes' })

    $.clock.every(TICK_MS, async () => {
      tick++
      let ctx = await read($, contextPct)
      let rem = await read($, remainingPct)

      if (demo) {
        const eff = (((await $.clock.now()) - demo.startedAt) / 1000) * demo.speed
        const step = Math.min(100, Math.floor((eff % DEMO_CYCLE_S) / DEMO_STEP_S))
        if (ctx !== step) await update($, contextPct, () => step)
        if (rem !== 100 - step) await update($, remainingPct, () => 100 - step)
        ctx = step
        rem = 100 - step
      }

      const target = Math.max(0, Math.min(100, Math.floor(rem)))
      const catStep = cat.step(target, idleFrame())
      const witch = drawWitchPct(ctx, idleFrame())
      // On ne repeint que si l'image a change.
      const key = `${catStep.coins}/${catStep.throwFrame}/${idleFrame()}/${witchSig(ctx)}`
      if (key === lastKey) return
      lastKey = key
      await $.ui.blit({ requestId: PANE, key: 'cat', cells: toCells(catStep.canvas) })
      await $.ui.blit({ requestId: PANE, key: 'witch', cells: toCells(witch) })
    })

    return next(e)
  })

  on('command.run', { command: 'mascottes' }, async $ => {
    await $.ui.open({ id: PANE, title: 'Mascottes' })

    return { text: 'Pane des mascottes ouvert.' }
  })

  // /mascottes-demo            lance (ou arrete) la demo a vitesse normale
  // /mascottes-demo 3          la lance 3 fois plus vite (0,5 a 20)
  // /mascottes-demo stop       l'arrete et remet les vraies valeurs
  on('command.run', { command: 'mascottes-demo' }, async ($, e) => {
    const arg = e.args.trim().toLowerCase()
    const stop = async () => {
      demo = null
      await update($, contextPct, () => real.ctx)
      await update($, remainingPct, () => real.rem)
      return { text: 'Demo arretee, vraies valeurs remises.' }
    }
    if (arg === 'stop' || (arg === '' && demo)) return stop()

    const speed = arg === '' || arg === 'start' ? 1 : Number(arg)
    if (!Number.isFinite(speed) || speed < 0.5 || speed > 20) {
      return { text: 'Usage : /mascottes-demo [stop | vitesse entre 0.5 et 20]' }
    }
    real = { ctx: await read($, contextPct), rem: await read($, remainingPct) }
    demo = { startedAt: await $.clock.now(), speed }
    await $.ui.open({ id: PANE, title: 'Mascottes' })

    const secs = Math.round(DEMO_CYCLE_S / speed)
    return { text: `Demo lancee (x${speed}, un cycle dure ${secs} s). /mascottes-demo stop pour arreter. Aucun appel au modele.` }
  })

  on('session.measure', async ($, e, next) => {
    if (typeof e.context.percent === 'number') {
      const pct = e.context.percent
      real = { ...real, ctx: pct }
      if (!demo) await update($, contextPct, () => pct)
    }
    const five = e.rateLimits.find(r => r.kind === 'five_hour')
    if (five) {
      const remaining = Math.max(0, Math.min(100, 100 - five.percentUsed))
      real = { ...real, rem: remaining }
      if (!demo) await update($, remainingPct, () => remaining)
    }

    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const ctx = await read($, contextPct)
    const rem = await read($, remainingPct)
    const coins = cat.coins() ?? Math.max(0, Math.min(100, Math.floor(rem)))

    if (e.surface !== 'terminal') {
      // Raster n'existe que dans le terminal : ailleurs, du texte.
      const { Box, Text } = $.ui.resolve(e)
      return (
        <Box flexDirection="column">
          <Text>Usage restant (5 h) : {rem.toFixed(1)} %</Text>
          <Text>Contexte utilisé : {String(ctx)} %</Text>
        </Box>
      )
    }
    const { Box, Text, Raster } = $.ui.resolve(e) as ElementTable<'terminal'>

    return (
      <Box flexDirection="row" flexWrap="wrap" columnGap={2}>
        <Box flexDirection="column">
          <Text>Contexte : {String(ctx)} %{demo ? ' (demo)' : ''}</Text>
          <Raster key="witch" {...size} cells={toCells(drawWitchPct(ctx, 0))} />
        </Box>
        <Box flexDirection="column">
          <Text>Usage 5 h : {rem.toFixed(0)} %{demo ? ' (demo)' : ''}</Text>
          <Raster key="cat" {...size} cells={toCells(drawCatIdle(coins, 0))} />
        </Box>
      </Box>
    )
  })
}
