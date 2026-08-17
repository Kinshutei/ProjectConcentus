import ja from './locales/ja.json'
import en from './locales/en.json'
import ko from './locales/ko.json'
import zhTW from './locales/zh-TW.json'

/**
 * 現行サイトは react-i18next を使っているが、翻訳ファイルの形が単純なので
 * 依存を増やさず同じ挙動（キー参照＋{{var}}差し込み＋ja へのフォールバック）
 * だけを持たせる。
 */
export const LANGS = [
  { value: 'ja', label: '日本語' },
  { value: 'en', label: 'English' },
  { value: 'ko', label: '한국어' },
  { value: 'zh-TW', label: '繁體中文' },
] as const

type Dict = Record<string, unknown>
const DICTS: Record<string, Dict> = { ja, en, ko, 'zh-TW': zhTW }

function dig(dict: Dict, key: string): string | undefined {
  let cur: unknown = dict
  for (const part of key.split('.')) {
    if (typeof cur !== 'object' || cur === null) return undefined
    cur = (cur as Dict)[part]
  }
  return typeof cur === 'string' ? cur : undefined
}

export function translator(lang: string) {
  return (key: string, vars?: Record<string, string | number>): string => {
    const text = dig(DICTS[lang] ?? DICTS.ja, key) ?? dig(DICTS.ja, key) ?? key
    if (!vars) return text
    return text.replace(/\{\{(\w+)\}\}/g, (_, name) => String(vars[name] ?? ''))
  }
}

export const storedLang = () => {
  const v = localStorage.getItem('lang') ?? ''
  return LANGS.some((l) => l.value === v) ? v : 'ja'
}
