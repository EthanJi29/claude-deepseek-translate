import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { TranslationEntry } from '../types'

const CJK = /[㐀-鿿豈-﫿]/
const LATIN = /[A-Za-z]/

const PROMPT_INSTRUCTION =
  'Translate the user message from Chinese to English. Keep code, file paths, commands, numbers and technical terms exactly as written. Reply with the translation only: no explanation, no quotes.'

const REPLY_INSTRUCTION =
  'Translate the assistant message from English to Simplified Chinese. Keep the Markdown structure; leave code blocks, inline code, file paths and commands untranslated. Reply with the translation only: no explanation.'

const NAME = 'deepseek-translate'
const MAX_ENTRIES = 20

const translations = atom(
  { plugin: 'deepseek-translate', key: 'translations' } as const,
  [] as TranslationEntry[],
)

type DeepseekConfig = {
  readonly apiKey: string
  readonly model: string
  readonly baseUrl: string
}

async function keyFor(
  $: EngineInterface,
  configuredKey: string,
  cache: { envKey?: Promise<string | undefined> },
): Promise<string | undefined> {
  if (configuredKey !== '') {
    return configuredKey
  }
  cache.envKey ??= $.env
    .get('DEEPSEEK_API_KEY')
    .then(value => {
      const trimmed = value?.trim()
      return trimmed ? trimmed : undefined
    })
    .catch(() => undefined)
  return cache.envKey
}

async function translate(
  $: EngineInterface,
  config: DeepseekConfig,
  cache: { envKey?: Promise<string | undefined> },
  instruction: string,
  text: string,
): Promise<string | undefined> {
  const key = await keyFor($, config.apiKey, cache)
  if (key === undefined) {
    return undefined
  }

  const response = await $.http.fetch(`${config.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: config.model,
      temperature: 0.2,
      stream: false,
      messages: [
        { role: 'system', content: instruction },
        { role: 'user', content: text },
      ],
    }),
  })

  if (!response.ok) {
    $.ui.log(`${NAME}: DeepSeek answered HTTP ${response.status}`)
    return undefined
  }

  const parsed = JSON.parse(response.text) as {
    choices?: Array<{ message?: { content?: unknown } }>
  }
  const content = parsed.choices?.[0]?.message?.content

  return typeof content === 'string' && content.trim() !== ''
    ? content.trim()
    : undefined
}

export const register: Register = (on, options) => {
  if (options.enabled === false) {
    return
  }

  const config: DeepseekConfig = {
    apiKey: typeof options.apiKey === 'string' ? options.apiKey.trim() : '',
    model:
      typeof options.model === 'string' && options.model.trim() !== ''
        ? options.model.trim()
        : 'deepseek-chat',
    baseUrl:
      typeof options.baseUrl === 'string' && options.baseUrl.trim() !== ''
        ? options.baseUrl.trim().replace(/\/+$/, '')
        : 'https://api.deepseek.com',
  }
  const cache: { envKey?: Promise<string | undefined> } = {}

  on('prompt.submit', async ($, e, next) => {
    if (e.command !== undefined || e.isMeta === true || !CJK.test(e.text)) {
      return next(e)
    }

    $.ui.status(`${NAME}: 翻译指令为英文…`)
    try {
      const english = await translate($, config, cache, PROMPT_INSTRUCTION, e.text)
      return next(english !== undefined && english !== e.text ? { ...e, text: english } : e)
    } catch {
      return next(e)
    } finally {
      $.ui.status(undefined)
    }
  })

  on('turn.complete', async ($, e, next) => {
    const done = await next(e)

    const isCandidate =
      e.agentId === undefined &&
      e.reason === 'answer' &&
      e.answer !== '' &&
      LATIN.test(e.answer) &&
      !CJK.test(e.answer)
    if (!isCandidate) {
      return done
    }

    try {
      const chinese = await translate($, config, cache, REPLY_INSTRUCTION, e.answer)
      if (chinese === undefined || chinese === e.answer) {
        return done
      }
      await update($, translations, entries => {
        const kept = (entries ?? []).filter(entry => entry.source !== e.answer)
        return [...kept, { source: e.answer, text: chinese }].slice(-MAX_ENTRIES)
      })
    } catch {
      // A failed translation leaves the reply as it is.
    }
    return done
  })

  on('ui.render', { component: 'AssistantMessage' }, async ($, e, next) => {
    const entries = (await read($, translations)) ?? []
    const hit = entries.find(entry => entry.source === e.props.text)
    if (hit === undefined) {
      return next(e)
    }
    return next({
      ...e,
      props: { ...e.props, text: `${e.props.text}\n\n---\n\n${hit.text}` },
    })
  })
}
