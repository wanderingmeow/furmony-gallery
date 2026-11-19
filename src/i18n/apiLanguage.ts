// The four languages the app offers, and the code the furmony API uses for each.
//
// This file imports no Solid and touches no document: the language switcher, the list requests, and
// the script the document pastes into `index.html` all need the answer, and the last one runs before
// the app exists.
//
// The API codes are the site's own. Its switcher sends `Target-Language` with one of these four, and
// every ordinary tag answers `{"msg":null,"code":500}`: `en`, `ja`, `zh-TW` and `zh-CN` all fail,
// while `us` and `pa` return the shelf. `us` is English and `pa` is 日本語.

/** The languages the app offers, in the order the switcher shows them. */
export const LOCALES = ['zh', 'zh_tw', 'ja', 'en'] as const

export type Locale = (typeof LOCALES)[number]

/** The value for the `Target-Language` header. */
export const API_LANGUAGE: Record<Locale, string> = {
  zh: 'zh',
  zh_tw: 'zh_tw',
  ja: 'pa',
  en: 'us',
}

/** Where the reader's choice is kept. The document's own script reads the same key. */
export const LOCALE_KEY = 'furmony_lang'

/** Each language's name in its own script, which is how a reader who cannot read the language on
 *  screen finds the one they can. */
export const LOCALE_NAME: Record<Locale, string> = {
  zh: '简体中文',
  zh_tw: '繁體中文',
  ja: '日本語',
  en: 'English',
}

/** The value for `<html lang>`, which screen readers and browser translation tools read. */
export const DOC_LANG: Record<Locale, string> = {
  zh: 'zh-Hans',
  zh_tw: 'zh-Hant',
  ja: 'ja',
  en: 'en',
}

/** The language the data is written in. A browser that matches none of our four lands here. */
export const DEFAULT_LOCALE: Locale = 'zh'

/** A stored value, or null when it is not one of ours. */
export function asLocale(value: unknown): Locale | null {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value) ? (value as Locale) : null
}

/** A browser language tag, or null when it matches none of our four. */
export function localeFromTag(tag: string): Locale | null {
  const t = tag.toLowerCase()
  if (t.startsWith('zh')) return /tw|hant|hk|mo/.test(t) ? 'zh_tw' : 'zh'
  if (t.startsWith('ja')) return 'ja'
  if (t.startsWith('en')) return 'en'
  return null
}

/**
 * The same rule, as an expression the document can run: `prefetch.ts` pastes this into the inline
 * script, and `localeFromTag` is the version the app runs. The two have to agree, or the first list
 * arrives in one language and the retry in another. `i18n.test.tsx` runs both over the same tags.
 */
export const DETECT_LOCALE_SCRIPT =
  `(function(t){t=(t||'').toLowerCase();` +
  `if(t.indexOf('zh')===0)return /tw|hant|hk|mo/.test(t)?'zh_tw':'zh';` +
  `if(t.indexOf('ja')===0)return 'ja';` +
  `if(t.indexOf('en')===0)return 'en';return ${JSON.stringify(DEFAULT_LOCALE)}})`

/** The API code for a stored choice and a browser tag, which is what both sides need. */
export function resolveApiLanguage(stored: unknown, tag: string): string {
  return API_LANGUAGE[asLocale(stored) ?? localeFromTag(tag) ?? DEFAULT_LOCALE]
}
