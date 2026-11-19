// The words on screen, in the language the reader picked.
//
// `tr` takes a dotted key from the dictionary tree: `tr('filter.colors')`. A key that carries a
// number is a function in the dictionary, and `tr` calls it: `tr('filter.socialNote', 41)`. The
// keys are checked against 简体中文, so a typo is a compile error and a missing translation in
// another language is a test failure.
//
// `tr` reads a signal, so a component that calls it updates when the language changes. locale.ts
// holds that signal, and says why it is a module value and not a component context.
import { createMemo, createRoot } from 'solid-js'
import { flatten, resolveTemplate, translator } from '@solid-primitives/i18n'
import { DICTIONARIES } from './dict'
import { locale } from './locale'

export {
  apiLanguage, applyDocumentLocale, browserLocale, locale, requestedLocale,
  setLocale, storedLocale,
} from './locale'
export {
  API_LANGUAGE, DEFAULT_LOCALE, DETECT_LOCALE_SCRIPT, LOCALE_KEY, LOCALE_NAME, LOCALES,
  DOC_LANG, asLocale, localeFromTag, resolveApiLanguage,
  type Locale,
} from './apiLanguage'

// The flat table is rebuilt when the language changes, which is the only moment it can be wrong.
const flat = createRoot(() => createMemo(() => flatten(DICTIONARIES[locale()])))

/** Words for the language on screen. */
export const tr = translator(() => flat(), resolveTemplate)
