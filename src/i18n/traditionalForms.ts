/**
 * Letterforms that only 繁體中文 uses, the 350 most frequent ones in the shelf's own 繁體中文
 * descriptions.
 *
 * Unicode unified the Han characters, so 简体中文 and 繁體中文 share most codepoints and a range of
 * codepoints cannot tell the two apart. A traditional-only letterform is its own codepoint, though:
 * 龍, 門, 個, 們, 為, 東 never appear in simplified writing. This table is the difference between the
 * shelf's 简体中文 dump and its 繁體中文 dump, keeping the letterforms the simplified one never uses
 * and ordering them by how often the traditional one meets them.
 *
 * The letterforms left out change nothing: the full table sorts the shelf's descriptions the same
 * way. The few descriptions that hold none of these are written in a literary register, and a
 * translation they did not need does them no harm. A simplified description cannot be missed here,
 * because simplified writing never uses one of these letterforms.
 */
export const TRADITIONAL_FORMS =
  "價製對過個後長靈實體隻這飾購戰從發現開惡處獸種頭氣經讓邊並說獨爾傳藍卻將還滿沒樣類誕變遊點機夢遠獵擊驗陽學內態紅離場數脈隨異" +
  "鬥魚裏條險難維雖電結聲飛傷員閃術師視賦則觀雙終兩獄尋麼隱號黃轉關話練萬調貓劍習稱識據殺霧際隊嚴堅漸門認裝徵區綠滅圍頂織聽細觸" +
  "養願陰狀衝單歷穩園應業產屬臉試遺衛潑團盡顯絕緣嚇斷復懷葉藥聞劇許節義圖喚憑厭髮殘標樹壞設腳脫毀閒燈導務亂論僅獲絲鬆燼奧顆聖歸" +
  "驅資幾連線軍計鬧創歲盜戲藉執賽繞華鋒纏掛爍國響棄漁眾囙較組舊夠納廢跡臨選陸積煙燒災諾畫誤亞劃夥蒼驚鮮淨煉寧虛訓釋棲紀擾討項鱗" +
  "畢軟墜鳥煩藝塊櫻絨凜蹤費層淺魯顏飄貪測網鯊銀縷書換漿鏡幹餘優躍羅報憶確敗庫達厲齒儀緊曬楓縱綴預誠潛銳鑄緒擔賜兇撿鈴聯該權補騎" +
  "榮軀渾遞邏嘗懶擺膽揚萊縮殼專帥蝕繪題擇係螢貝盤輪編訊惱輩禮恆闖參碼溝錯兒簡詛興審";

const FORMS = new Set(TRADITIONAL_FORMS);

/** Whether the text holds one of these letterforms. None of them means the text is not 繁體中文. */
export function hasTraditionalForm(text: string): boolean {
  for (const ch of text) if (FORMS.has(ch)) return true;
  return false;
}
