// The words the API keeps in Chinese: species and colors.
//
// A third list, what a commission covers, holds one value (全装) and nothing on screen shows it, so
// it has no table here.
//
// The shelf translates the names and descriptions it wrote, and leaves these fields in Chinese in
// every language, so `Target-Language` alone leaves the chips, the filter panel and the detail table
// Chinese. Both are fixed sets, so they are written here by hand, keyed the way the data keys them.
// Species are keyed by `raceId` because the Chinese name alone is not reliable: id 5 is 狗 and id 7
// is 犬, and both appear on the shelf.
import { locale } from './locale'
import type { Locale } from './apiLanguage'

/** One word, in each language the app offers. `zh` is the one the API answers with. */
export type Term = Record<Locale, string>

/** The species list, by `raceId`. The ids are the API's and match the table in `model/domain.ts`. */
export const RACES: Record<number, Term> = {
  1: { zh: '狼', zh_tw: '狼', ja: 'オオカミ', en: 'Wolf' },
  2: { zh: '龙', zh_tw: '龍', ja: 'ドラゴン', en: 'Dragon' },
  3: { zh: '羊', zh_tw: '羊', ja: 'ヒツジ', en: 'Sheep' },
  4: { zh: '虎', zh_tw: '虎', ja: 'トラ', en: 'Tiger' },
  5: { zh: '狗', zh_tw: '狗', ja: 'イヌ', en: 'Dog' },
  6: { zh: '熊', zh_tw: '熊', ja: 'クマ', en: 'Bear' },
  7: { zh: '犬', zh_tw: '犬', ja: '犬', en: 'Hound' },
  8: { zh: '猫', zh_tw: '貓', ja: 'ネコ', en: 'Cat' },
  10: { zh: '狐狸', zh_tw: '狐狸', ja: 'キツネ', en: 'Fox' },
  12: { zh: '神兽', zh_tw: '神獸', ja: '神獣', en: 'Divine beast' },
  13: { zh: '兵器', zh_tw: '兵器', ja: '兵器', en: 'Weapon' },
  14: { zh: '鱼', zh_tw: '魚', ja: '魚', en: 'Fish' },
  15: { zh: '昆虫', zh_tw: '昆蟲', ja: '昆虫', en: 'Insect' },
  16: { zh: '豹', zh_tw: '豹', ja: 'ヒョウ', en: 'Leopard' },
  17: { zh: '植物', zh_tw: '植物', ja: '植物', en: 'Plant' },
  18: { zh: '蛇', zh_tw: '蛇', ja: '蛇', en: 'Snake' },
  19: { zh: '神话', zh_tw: '神話', ja: '神話', en: 'Mythical' },
  20: { zh: '鸟', zh_tw: '鳥', ja: '鳥', en: 'Bird' },
  21: { zh: '兔', zh_tw: '兔', ja: 'ウサギ', en: 'Rabbit' },
  22: { zh: '龙犬', zh_tw: '龍犬', ja: '龍犬', en: 'Dragon hound' },
  23: { zh: '蝙蝠', zh_tw: '蝙蝠', ja: 'コウモリ', en: 'Bat' },
  24: { zh: '狮', zh_tw: '獅', ja: 'ライオン', en: 'Lion' },
  25: { zh: '东方龙', zh_tw: '東方龍', ja: '東方龍', en: 'Eastern dragon' },
  26: { zh: '神秘生物', zh_tw: '神秘生物', ja: '神秘生物', en: 'Mysterious creature' },
  27: { zh: '神', zh_tw: '神', ja: '神', en: 'Deity' },
  28: { zh: '鹿', zh_tw: '鹿', ja: '鹿', en: 'Deer' },
}

/** The color list, keyed by the Chinese name the API answers with. */
export const COLORS: Record<string, Term> = {
  红: { zh: '红', zh_tw: '紅', ja: '赤', en: 'Red' },
  橙: { zh: '橙', zh_tw: '橙', ja: '橙', en: 'Orange' },
  黄: { zh: '黄', zh_tw: '黃', ja: '黄色', en: 'Yellow' },
  绿: { zh: '绿', zh_tw: '綠', ja: '緑', en: 'Green' },
  蓝: { zh: '蓝', zh_tw: '藍', ja: '青', en: 'Blue' },
  紫: { zh: '紫', zh_tw: '紫', ja: '紫', en: 'Purple' },
  黑: { zh: '黑', zh_tw: '黑', ja: '黒', en: 'Black' },
  白: { zh: '白', zh_tw: '白', ja: '白', en: 'White' },
  灰: { zh: '灰', zh_tw: '灰', ja: '灰', en: 'Gray' },
  棕: { zh: '棕', zh_tw: '棕', ja: '茶色', en: 'Brown' },
  褐: { zh: '褐', zh_tw: '褐', ja: '褐色', en: 'Auburn' },
  粉: { zh: '粉', zh_tw: '粉', ja: 'ピンク', en: 'Pink' },
  青: { zh: '青', zh_tw: '青', ja: '水色', en: 'Cyan' },
}

/** The order the 颜色 block lists colors in: around the wheel from red, then the neutrals, so the
 *  neighbor of the color a reader is hunting sits beside it. */
export const COLOR_ORDER = ['红', '粉', '橙', '棕', '褐', '黄', '绿', '青', '蓝', '紫', '灰', '黑', '白']

/** The order the 物种 block lists species in: packs that read as neighbors - the dog family, the cat
 *  family, the other mammals, the small ones and the wild things, then dragons and myth. */
export const RACE_ORDER = [
  '狼', '犬', '狗', '狐狸', '龙犬',
  '猫', '虎', '狮', '豹',
  '熊', '兔', '鹿', '羊', '蝙蝠',
  '鸟', '蛇', '鱼', '昆虫', '植物',
  '龙', '东方龙', '神兽', '神话', '神', '神秘生物', '兵器',
]

/** Put words in one of those two orders. A name neither list has, such as a species the API starts
 *  sending before we have a word for it, goes to the end of the block. */
export const inOrder = (order: readonly string[]) => (a: string, b: string): number => {
  const rank = (w: string) => {
    const i = order.indexOf(w)
    return i < 0 ? order.length : i
  }
  return rank(a) - rank(b) || a.localeCompare(b)
}

/** The word for a term in the language on screen. A word we do not have stays as the API wrote it. */
export function termLabel(term: Term | undefined, asWritten: string): string {
  if (!term) return asWritten
  return term[locale()] || asWritten
}

export const raceLabel = (raceId: number | undefined, asWritten: string): string =>
  termLabel(raceId === undefined ? undefined : RACES[raceId], asWritten)

export const colorLabel = (asWritten: string): string => termLabel(COLORS[asWritten], asWritten)

/** The `raceId` a Chinese species name belongs to. The panel lists species by the name the API
 *  wrote, because that name is what a saved filter holds. */
export const raceIdOfName = (asWritten: string): number | undefined =>
  RACE_ID_BY_NAME[asWritten]

const RACE_ID_BY_NAME: Record<string, number> = {}
for (const id of Object.keys(RACES)) RACE_ID_BY_NAME[RACES[Number(id)].zh] = Number(id)

export const raceLabelByName = (asWritten: string): string =>
  termLabel(RACES[raceIdOfName(asWritten) ?? -1], asWritten)

/** The species a listing with no `raceId` is counted as: 神秘生物. The chart bars and the 物种 filter
 *  both hand those rows to this species, although their cards show no species tag. */
export const MYSTERY_RACE_ID = 26
export const MYSTERY_RACE_NAME = RACES[MYSTERY_RACE_ID].zh
export const mysteryRaceLabel = (): string => RACES[MYSTERY_RACE_ID][locale()]

const owns = (table: Record<string, unknown>, name: string): boolean =>
  Object.prototype.hasOwnProperty.call(table, name)

/** Whether the shelf sends this color name at all. A stored filter can hold a name from an older
 *  day, and a pick with no chip would hide cards with nothing left to tap. */
export const isKnownColor = (asWritten: string): boolean => owns(COLORS, asWritten)

/** Whether the shelf sends this species name at all. */
export const isKnownRaceName = (asWritten: string): boolean => raceIdOfName(asWritten) !== undefined
