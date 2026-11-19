// The four dictionaries, in one table keyed the way the rest of the i18n layer keys a language.
import type { Locale } from '../apiLanguage'
import type { Dict } from './shape'
import { en } from './en'
import { ja } from './ja'
import { zh } from './zh'
import { zh_tw } from './zh_tw'

export const DICTIONARIES: Record<Locale, Dict> = { zh, zh_tw, ja, en }

export type { Dict } from './shape'
