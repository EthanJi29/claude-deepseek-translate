import { expect, test } from 'claude-code/testing'

const DEEPSEEK_OK = (content: string) => ({
  value: {
    status: 200,
    ok: true,
    headers: {},
    text: JSON.stringify({ choices: [{ message: { content } }] }),
  },
})

test('a Chinese prompt reaches the model in English', { options: { apiKey: 'test-key' } }, async ($, on) => {
  let systemSeen = ''
  let promptSeen = ''

  on('http.fetch', (_, e) => {
    const body = JSON.parse(String(e.init?.body ?? '{}'))
    systemSeen = body.messages[0].content
    promptSeen = body.messages[1].content
    return DEEPSEEK_OK('Refactor the parser into a proper state machine.')
  })
  on('ui.status', () => ({ value: undefined }))
  on('prompt.submit', (_, e) => ({ text: e.text }))

  const result = await $.prompt.submit({ text: '帮我把这个解析器重构成状态机', wait: false, origin: { kind: 'composer' } })

  expect(promptSeen).toBe('帮我把这个解析器重构成状态机')
  expect(systemSeen).toContain('English')
  expect(result.text).toBe('Refactor the parser into a proper state machine.')
})

test('a prompt already in English is left alone', { options: { apiKey: 'test-key' } }, async ($, on) => {
  on('http.fetch', () => {
    throw new Error('an English prompt needs no translation')
  })
  on('prompt.submit', (_, e) => ({ text: e.text }))

  const result = await $.prompt.submit({ text: 'Please fix the failing test.', wait: false, origin: { kind: 'composer' } })

  expect(result.text).toBe('Please fix the failing test.')
})

test('an English reply is shown with a Chinese translation beneath it', { options: { apiKey: 'test-key' } }, async ($, on) => {
  on('http.fetch', () => DEEPSEEK_OK('重构完成,所有测试通过。'))
  on('turn.complete', (_, e) => ({ text: e.answer }))

  const result = await $.turn.complete({
    answer: 'The refactor is done and all tests pass.',
    durationMs: 1200,
    isAborted: false,
    turnId: 'turn-1',
    reason: 'answer',
  })

  expect(result.text).toBe('重构完成,所有测试通过。')
})

test('a reply already in Chinese is left alone', { options: { apiKey: 'test-key' } }, async ($, on) => {
  on('http.fetch', () => {
    throw new Error('a Chinese reply needs no translation')
  })
  on('turn.complete', (_, e) => ({ text: e.answer }))

  const result = await $.turn.complete({
    answer: '重构完成,所有测试通过。',
    durationMs: 800,
    isAborted: false,
    turnId: 'turn-2',
    reason: 'answer',
  })

  expect(result.text).toBe('重构完成,所有测试通过。')
})

test('without an API key nothing is translated', {}, async ($, on) => {
  on('env.get', () => ({ value: undefined }))
  on('http.fetch', () => {
    throw new Error('no key means no request')
  })
  on('ui.status', () => ({ value: undefined }))
  on('prompt.submit', (_, e) => ({ text: e.text }))

  const result = await $.prompt.submit({ text: '你好', wait: false, origin: { kind: 'composer' } })

  expect(result.text).toBe('你好')
})

test('a failed API call leaves the prompt unchanged', { options: { apiKey: 'test-key' } }, async ($, on) => {
  on('http.fetch', () => ({ value: { status: 500, ok: false, headers: {}, text: 'oops' } }))
  on('ui.status', () => ({ value: undefined }))
  on('ui.log', () => ({ value: undefined }))
  on('prompt.submit', (_, e) => ({ text: e.text }))

  const result = await $.prompt.submit({ text: '帮我看下日志', wait: false, origin: { kind: 'composer' } })

  expect(result.text).toBe('帮我看下日志')
})
