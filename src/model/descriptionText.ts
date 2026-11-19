/**
 * Decide whether the 详细描述 on screen wants translating into the language of the interface.
 *
 * The official site translates this field along with the rest of the answer, so an English screen
 * usually arrives in English. What is left is the text the site left alone, translated halfway, or
 * bilingual to begin with. The test is a majority: the request goes out when most of the letters
 * are not in the language on screen, and bilingual text passes through. Digits, punctuation and
 * spaces are not counted, so a line like `(数字 30 和 1/7 都不算字)` is still a Chinese description.
 *
 * Unicode unified the Han characters, so one codepoint serves 简体中文, 繁體中文 and 日本語 alike
 * and a range of codepoints cannot tell the three apart. The letterform can: kana means Japanese, a
 * traditional-only letterform means 繁體中文, and the rest is settled by the counts.
 */

import { hasTraditionalForm } from '../i18n/traditionalForms'

/** Hiragana, katakana, the katakana extension block, and half-width katakana. */
const KANA = /[\u3040-\u30ff\u31f0-\u31ff\uff66-\uff9d]/
const HAN = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/
const HANGUL = /[\uac00-\ud7af]/
const LATIN = /[a-z]/i

/** Below this many letters a request is not worth sending: a name or two is not a sample. */
const MIN_LETTERS = 8

/**
 * Enough kana to look like Japanese. A Chinese description that quotes a Japanese title carries
 * three or five kana, and that is not enough. Japanese writing carries kana and Han characters at
 * about even weight, so the kana has to reach 3 and half of the Han count.
 */
function readsAsJapanese(kana: number, han: number): boolean {
  return kana >= 3 && kana * 2 >= han
}

/** A 简体中文 screen needs nothing: the reader reads the shelf's own words, and 简体中文 is what the
 *  shelf sends for that request. */
export function needsTranslation(text: string | undefined, locale: string): boolean {
  if (!text || locale === 'zh') return false
  let han = 0
  let kana = 0
  let hangul = 0
  let latin = 0
  for (const ch of text) {
    if (KANA.test(ch)) kana++
    else if (HAN.test(ch)) han++
    else if (HANGUL.test(ch)) hangul++
    else if (LATIN.test(ch)) latin++
  }
  if (han + kana + hangul + latin < MIN_LETTERS) return false
  // 繁體中文: no traditional-only letterform means the text is simplified, so translate it. Simplified
  // writing never uses a letterform from that table, so a miss is not possible here.
  if (locale === 'zh_tw') return han >= MIN_LETTERS && !hasTraditionalForm(text)
  // 日本語: leave what reads as Japanese, and translate the rest.
  if (locale === 'ja') return !readsAsJapanese(kana, han)
  // English: translate while the Latin letters do not outnumber the Japanese, Chinese and Korean ones.
  return han + kana + hangul >= latin
}
