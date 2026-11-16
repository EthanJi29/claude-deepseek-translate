export type TranslationEntry = { source: string; text: string }

declare module 'claude-code' {
  interface PluginState {
    'deepseek-translate': { translations: TranslationEntry[] }
  }
}
