import {
  CHROME_BAND, CHROME_BAR_BOX, CHROME_CORNER, CHROME_LINE, CHROME_TAB_BAR, SK_FILL,
} from '../ui/boxes'

/** The boxes are the real ones, so the cards do not move when the chrome is replaced. */
export function ChromeSkeleton() {
  return (
    <>
      <div class={CHROME_BAND}>
        <div class={CHROME_BAR_BOX}>
          <div class={CHROME_LINE}>
            <div class={`${SK_FILL} w-[var(--fab-size)] h-[var(--fab-size)] rounded-full`} />
            <div class={CHROME_CORNER}>
              <div class={`${SK_FILL} w-[var(--fab-size)] h-[var(--fab-size)] rounded-full`} />
              <div class={`${SK_FILL} w-[var(--fab-size)] h-[var(--fab-size)] rounded-full`} />
            </div>
          </div>
        </div>
      </div>

      {/* The pill's width belongs to the four labels, so the placeholder is a guess. */}
      <div class={CHROME_TAB_BAR}>
        <div class={`${SK_FILL} w-[240px] h-[var(--seg-h-glass)] rounded-full`} />
      </div>
    </>
  )
}
