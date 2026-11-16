# deepseek-translate

A Claude Code plugin that puts a DeepSeek translation layer around the conversation:

- **Prompt, Chinese → English.** When a prompt you submit contains Chinese, it is translated to English by the DeepSeek API and the English text is what the model reads (and what the transcript records).
- **Reply, English → Chinese.** When a turn ends with an English-only answer, the answer is translated to Simplified Chinese and appended to it as Markdown beneath a rule — headings, bold, tables and code blocks keep their formatting, while the original English stays above, so you read bilingually.

Nothing changes when the text is already in the target language, when there is no API key, or when the API call fails: the prompt or reply simply goes through untouched.

## Install

In a Claude Code session:

```
/plugin install deepseek-translate --marketplace ethanji29/claude-deepseek-translate
```

From a shell:

```
claude plugin install deepseek-translate --marketplace ethanji29/claude-deepseek-translate
```

Then restart Claude Code (or run `/reload-plugins`).

## Setup

1. Get an API key from <https://platform.deepseek.com>.
2. Give the plugin the key, one of two ways:
   - Run `/plugin configure deepseek-translate` (or `claude plugin configure deepseek-translate`) and enter it — it is stored in the OS secure storage.
   - Or export `DEEPSEEK_API_KEY` in your shell profile and restart Claude Code.
3. Optional: set `model` (default `deepseek-chat`) and `baseUrl` (default `https://api.deepseek.com`) in the same configuration, or point them at any OpenAI-compatible endpoint.

To pause translation without touching the key: set the `enabled` option (or its row, `deepseek-translate.enabled`, in `/config`) to `false`.

## Notes

- Only the main conversation is translated; subagent turns and slash commands are left alone.
- Code, file paths, commands and technical terms are kept as written by the translation instructions.
- The translation calls are extra requests billed by your DeepSeek account.

## Development

```sh
claude plugin validate .   # static check of the manifest and hooks module
claude plugin test .       # runs tests/translate.test.ts against the engine
```

The plugin is a function-hooks module: `hooks/register.ts` hooks `prompt.submit`
and `turn.complete`, and calls the DeepSeek chat-completions API through
`$.http.fetch`.
