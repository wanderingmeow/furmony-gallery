import { Show } from 'solid-js'
import { Portal } from 'solid-js/web'
import type { AdoptListing } from '../../model/types'
import {
  BOX,
  DETAIL_PAD_X,
  detailBodyHeight,
  detailPictureHeight,
  PANEL_GRID,
  shapeAt,
  sheetCardBox,
} from '../../draw/layout'
import type { Shape } from '../../draw/layout'
import { watchViewport } from '../ui/viewport'
import { useSheetFooter } from '../ui/boxes'
import { AnimatedHeight } from '../ui/AnimatedHeight'
import { DetailToolbar } from './DetailToolbar'
import { Gallery } from './Gallery'
import { InfoTable } from './InfoTable'
import { RelatedRow } from './RelatedRow'

/**
 * The detail's content, in whichever shape its screen gets: a sheet's one column under the pictures,
 * or a panel's picture beside the table. The action bar belongs here too, because which box it sits
 * in is a shape decision.
 */
export function DetailBody(props: {
  listing: AdoptListing
  /** The resized detail pictures; the head picture is already in this list. */
  images: string[]
  index: () => number
  setIndex: (i: number) => void
  onOpenFull: () => void
}) {
  const { viewportW, viewportH } = watchViewport()
  const shape = (): Shape => shapeAt(viewportW(), viewportH())
  const panel = () => shape() === 'panel'
  const box = () => BOX[shape()]
  const cardBox = () => sheetCardBox(viewportW(), viewportH())
  const picMaxH = () => detailPictureHeight(cardBox(), shape())
  const footerHost = useSheetFooter()

  return (
    <>
      {/* The body's own padding comes from BOX: a sheet pads all four sides here, a panel the sides
          only and leaves the top and the bottom to each column. */}
      <div
        class={`flex-1 min-h-0 ${box().bodyPad}`}
        style={{ 'padding-left': `${DETAIL_PAD_X}px`, 'padding-right': `${DETAIL_PAD_X}px` }}
      >
        <div
          class={panel() ? PANEL_GRID : undefined}
          style={panel() ? { height: `${detailBodyHeight(cardBox(), shape())}px` } : undefined}
        >
          <div class={panel() ? `col-start-1 row-start-1 ${box().colPad}` : undefined}>
            <Gallery
              images={props.images}
              index={props.index}
              setIndex={props.setIndex}
              onOpenFull={props.onOpenFull}
              maxH={picMaxH()}
              fillH={panel() ? picMaxH() : undefined}
            />
          </div>
          <div class={panel() ? 'col-start-2 row-start-1 flex flex-col min-h-0' : 'mt-4'}>
            {/* The column scrolls on its own and the bar sits under it, so the picture stays put
                while the table moves. The marker only exists here: the scroll lock reads it, and a
                sheet has one scroller, its own. */}
            <div
              data-sheet-col-scroll={panel() ? '' : undefined}
              class={panel() ? `min-h-0 flex-1 overflow-y-auto overscroll-contain ${box().colPad}` : undefined}
            >
              <AnimatedHeight>
                <InfoTable listing={props.listing} />
              </AnimatedHeight>
              <RelatedRow item={props.listing} shape={shape()} />
            </div>
            {panel() && <DetailToolbar item={props.listing} shape="panel" />}
          </div>
        </div>
      </div>

      {/* The bar belongs to this screen, so it travels in this chunk. A sheet puts it in the box the
          shell keeps outside the scroller, where it cannot cover the scrollbar; a panel keeps it in
          the right column. */}
      {footerHost && (
        <Show when={!panel()}>
          <Portal mount={footerHost} useShadow={false}>
            <DetailToolbar item={props.listing} shape="sheet" />
          </Portal>
        </Show>
      )}
    </>
  )
}
