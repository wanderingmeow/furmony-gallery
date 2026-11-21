import { tr } from "../../i18n";
import {
  listingName,
  listingPainterName,
  wordsPending,
} from "../../model/translatedText";
import {
  createEffect,
  createMemo,
  createSignal,
  For,
  on,
  onCleanup,
  Show,
} from "solid-js";
import type { AdoptListing } from "../../model/types";
import {
  colorDisplay,
  colorNames,
  formatPrice,
  isLocked,
  priceParts,
  raceDisplay,
} from "../../model/domain";
import { THUMB_ASPECT } from "../../draw/layout";
import { isWishlisted } from "../../stores/wishlistStore";
import { priceMode } from "../../stores/displayStore";
import { onImageError, sizedUrl, stableImageUrl } from "../../data/image";
import { LockedIcon } from "../ui/LockedIcon";
import { SkelText } from "../ui/SkelText";
import { WishlistButton } from "../ui/WishlistButton";
import {
  CARD_ARTIST,
  CARD_BASE,
  CARD_BODY,
  CARD_COVER,
  CARD_FOOT,
  CARD_NAME,
} from "../ui/boxes";

// One row of tags, cut at the card's edge. A card's height is what the row pitch in
// draw/layout.ts counts on, so a long list of tags never pushes the card taller.
function Tags(props: { tags: string[] }) {
  return (
    <div class="flex flex-wrap items-center gap-1.5 min-w-0 overflow-hidden h-[18px]">
      {/* A chip cannot break itself across lines, so the one that does not fit would be cut
          mid-word. `max-w-full` caps it at the row and `truncate` ends it with an ellipsis, which
          says there is more to read. */}
      <For each={props.tags}>
        {(t) => (
          <span class="shrink-0 max-w-full px-1.5 h-[18px] leading-[18px] rounded-md bg-surface-2 text-[10px] text-ink truncate">
            {t}
          </span>
        )}
      </For>
    </div>
  );
}

export function ListingCard(props: {
  listing: AdoptListing;
  width: number;
  hold?: () => boolean;
}) {
  // eslint-disable-next-line solid/reactivity -- <For> keys this card by listing id, so props never change
  const l = props.listing;
  const parts = createMemo(() => priceParts(l, priceMode()));
  const id = l.adoptId;
  const locked = isLocked(l);
  const wishlisted = createMemo(() => isWishlisted(id));
  const artist = createMemo(
    () => listingPainterName(l) ?? tr("detail.painterNumbered", l.paintersId),
  );
  // The chip words come from the species and color tables, so a card that is the same object
  // still changes when the language on screen does.
  const tags = createMemo(() => [
    ...(raceDisplay(l) ? [raceDisplay(l)!] : []),
    ...colorNames(l).map(colorDisplay),
  ]);

  const [loaded, setLoaded] = createSignal(false);

  // The address waits a frame so mounting a whole tab is not spent on picture requests, and
  // hold keeps it off while the page moves fast: the DOM is built, the picture waits.
  let imgRef!: HTMLImageElement;
  createEffect(
    on(
      () => props.hold?.(),
      (held) => {
        if (held) return;
        const url = sizedUrl(stableImageUrl(l.adoptPicture), "card");
        const raf = requestAnimationFrame(() => {
          if (url) imgRef.src = url;
        });
        onCleanup(() => cancelAnimationFrame(raf));
      },
    ),
  );

  return (
    <div
      class={`${CARD_BASE} no-pick press-face`}
      style={{ width: `${props.width}px` }}
    >
      <div class={CARD_ARTIST}>
        <span class="text-[11px] text-muted truncate">
          {wordsPending() ? <SkelText class="h-3 w-10" /> : artist()}
        </span>
        <span class="ml-auto shrink-0 text-[11px] text-faint">#{id}</span>
      </div>

      <div class={CARD_COVER}>
        <div
          class="relative card-img w-full rounded-lg bg-surface overflow-hidden"
          style={{ "aspect-ratio": String(THUMB_ASPECT) }}
        >
          <img
            ref={imgRef}
            alt={
              wordsPending()
                ? tr("common.listing")
                : (listingName(l) ?? tr("common.listing"))
            }
            loading="eager"
            decoding="async"
            class="w-full h-full object-cover rounded-lg transition-opacity duration-300"
            classList={{ "opacity-0": !loaded() }}
            onLoad={() => setLoaded(true)}
            onError={(e) => {
              setLoaded(true);
              onImageError(e);
            }}
          />
        </div>
      </div>

      <div class={CARD_BODY}>
        <div class={CARD_NAME}>
          <span class="text-sm font-medium truncate">
            {wordsPending() ? (
              <SkelText class="h-3.5 w-16" />
            ) : (
              (listingName(l) ?? tr("common.unknown"))
            )}
          </span>
          {/* The group carries ml-auto rather than the lock, because a card with no lock
              still needs something to push the heart to the right edge. */}
          <div class="ml-auto shrink-0 flex items-center gap-1.5">
            <Show when={locked}>
              <LockedIcon size="16px" />
            </Show>
            <WishlistButton
              item={l}
              stop
              heartClass="tap-heart"
              class="heart-hit text-lg leading-none"
              classList={{
                "text-red-500": wishlisted(),
                "text-ink": !wishlisted(),
              }}
            />
          </div>
        </div>

        <div class={CARD_FOOT}>
          {/* min-h-5 holds the row at 20px with no price, so a card with no price is as tall
              as one with a price and the row pitch in draw/layout.ts still holds. */}
          <div class="min-w-0 flex-1">
            <Tags tags={tags()} />
          </div>
          <div class="shrink-0 flex items-center gap-1">
            {/* One number per card. In installment mode that number is the down payment; the
                monthly amount and the total are on the detail page. */}
            <Show when={parts()?.card}>
              {(card) => (
                <span class="inline-flex items-baseline gap-1 text-sm font-bold text-accent-ink tabular-nums">
                  <Show when={card().label}>
                    <span>{card().label}</span>
                  </Show>
                  <span>{formatPrice(card().value)}</span>
                </span>
              )}
            </Show>
          </div>
        </div>
      </div>
    </div>
  );
}
