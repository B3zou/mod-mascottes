declare module 'claude-code' {
  interface PluginState {
    'mod-mascottes': {
      /** Contexte utilisé, 0 à 100. */
      contextPct: Shaped<number>
      /** Usage restant sur la fenêtre five_hour, 0 à 100 (100 moins percentUsed). */
      remainingPct: Shaped<number>
    }
  }
}
