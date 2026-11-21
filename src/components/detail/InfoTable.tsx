import { tr } from "../../i18n";
import {
  listingDescription,
  listingName,
  listingPainterName,
  wordsPending,
} from "../../model/translatedText";
import { createMemo, For, Show, type JSXElement } from "solid-js";
import type { AdoptListing } from "../../model/types";
import { AntIcon } from "../ui/AntIcon";
import { FlowText, FLOW_OVER_MS } from "./FlowText";
import { useTranslation } from "../../hooks/useTranslation";
import { TranslationOutlined } from "@ant-design/icons-svg";
import {
  MISSING_PRICE,
  colorDisplay,
  colorNames,
  formatPrice,
  isAdopted,
  isLocked,
  painterAvatar,
  priceParts,
  raceDisplay,
  type InstallmentPrice,
  type OncePrice,
} from "../../model/domain";
import { sizedUrl, stableImageUrl } from "../../data/image";
import { SkelImg } from "../ui/SkelImg";
import { SkelText } from "../ui/SkelText";
import { priceMode } from "../../stores/displayStore";
import { socials } from "../../stores/socialsStore";
import { StatusBadge } from "../ui/StatusBadge";

// The first column is the head picture's width (w-15 is 60px), so values start under the title
const GRID = "grid grid-cols-[60px_1fr] gap-3";

// 首付 and 月供 share this width, which is what lines their numbers up
const LABEL = "min-w-8 whitespace-nowrap";

function Row(props: { label: string; children: JSXElement }) {
  return (
    // The 24px minimum, one line of body text, keeps a row of badges as tall as a row of words.
    // It belongs on the label: Safari keeps a grid column's minimum from the first layout, and
    // the label is the one box in the row whose height never changes.
    <div class={`${GRID} border-t border-border mt-1.5 pt-1.5`}>
      <dt class="text-xs text-muted pt-1 min-h-6">{props.label}</dt>
      {/* items-center keeps a 20.5px badge in the middle of the line. The grid cell lets the child
          fill the width, so the color chips can wrap. The margin is preflight's to take, and this
          says so in case the row is ever drawn outside the app sheet. */}
      <dd class="m-0 min-w-0 grid items-center">{props.children}</dd>
    </div>
  );
}

function OptRow(props: { label: string; when: boolean; children: JSXElement }) {
  return (
    <Show when={props.when}>
      <Row label={props.label}>{props.children}</Row>
    </Show>
  );
}

/** Three lines of their own length, so the space reads as a paragraph on its way. One rule across
 *  the row would read as an empty field. A line of this paragraph is 24px tall, so 14px bars with
 *  10px between them and 5px above and below fill exactly three lines, and the row does not move
 *  when the words arrive. */
function DescSkel() {
  return (
    <div class="flex flex-col gap-2.5 py-[5px]">
      <SkelText class="h-3.5 w-full" />
      <SkelText class="h-3.5 w-[82%]" />
      <SkelText class="h-3.5 w-[38%]" />
    </div>
  );
}

/** The 详细描述 row: the words, the placeholder while a request is on its way, and the button that
 *  turns the translation down. The request itself is in `hooks/useTranslation`. */
function Description(props: { listing: () => AdoptListing }) {
  const t = useTranslation({
    text: () => listingDescription(props.listing()) ?? "",
    id: () => props.listing().adoptId,
    arrivalMs: FLOW_OVER_MS,
  });
  return (
    <>
      {/* The placeholder stays while the answer is on its way. The words it gives way to blur in
          once, when they land, and plainly every other time they are on the screen. */}
      <Show
        when={t.busy()}
        fallback={
          <FlowText text={t.shownText()} flow={t.arriving() && t.showing()} />
        }
      >
        <DescSkel />
      </Show>
      <Show when={t.offer()}>
        {/* A row of its own under the text. Pinned to the corner it would sit on the last line. The
            note takes the left end, so the row still holds one button. */}
        <div class="mt-1.5 flex items-center justify-end gap-2">
          <Show when={t.showing()}>
            <span class="mr-auto text-[11px] text-faint">
              {tr("detail.translatedNote")}
            </span>
          </Show>
          <button
            type="button"
            onClick={t.toggle}
            title={t.label()}
            aria-label={t.label()}
            class={[
              "grid h-7 w-7 place-items-center rounded-lg border transition-colors",
              // `ink` flips with the theme, so an ink wash darkens the button in light mode and
              // lights it in dark mode: one hover state for both.
              t.lit()
                ? "border-accent/40 bg-accent/15 text-accent-soft hover:bg-accent/25 active:bg-accent/30"
                : "border-border bg-surface-2 text-ink-faint hover:border-ink/30 hover:bg-ink/10 active:bg-ink/20",
            ].join(" ")}
          >
            <AntIcon icon={TranslationOutlined} size={15} />
          </button>
        </div>
      </Show>
    </>
  );
}

function HeadImg(props: { url?: string }) {
  const box = "w-15 h-15 rounded-lg shrink-0";
  return (
    <Show when={props.url} fallback={<span class={`bg-surface-2 ${box}`} />}>
      {(url) => (
        <SkelImg
          url={url()}
          box={box}
          imgClass="rounded-lg border-2 border-border shadow"
        />
      )}
    </Show>
  );
}

function OncePriceLine(props: { parts: OncePrice }) {
  return (
    <div class="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 tabular-nums">
      <span class="text-lg font-bold text-accent-ink">
        {formatPrice(props.parts.main)}
      </span>
      <Show when={props.parts.secondary}>
        {(total) => (
          // Struck in a way a reader can say out loud: the number alone would read as a second price.
          <s class="text-sm text-faint">
            <span class="sr-only">{tr("info.original")}</span>
            {formatPrice(total())}
          </s>
        )}
      </Show>
      <Show when={props.parts.discount > 0}>
        <span class="px-1.5 py-0.5 rounded-md bg-red-600 text-white text-[11px] font-bold">
          {tr("info.discount", props.parts.discount)}
        </span>
      </Show>
    </div>
  );
}

/**
 * Only 首付 is highlighted: a reader decides whether to keep looking based on it. The
 * pay-at-once comparison stays out of here, because readers take the two numbers and
 * subtract them by hand.
 */
function InstallmentPlan(props: { parts: InstallmentPrice }) {
  return (
    // One grid for both rows, so the label column is as wide as the longest label: `Per month` is
    // 70px and 月供 is 28px.
    <div class="mb-1.5 grid grid-cols-[max-content_1fr] items-baseline gap-x-1 gap-y-0.5">
      <Show when={props.parts.down}>
        {(down) => (
          <>
            {/* CJK glyphs sit 1~2px lower than digits on the same baseline. The lift is in
              em, so it follows the label's size. */}
            <span
              class={`${LABEL} text-sm font-medium text-accent-ink relative -top-[0.1em]`}
            >
              {tr("info.downPayment")}
            </span>
            <span class="text-xl font-bold text-accent-ink tabular-nums">
              {formatPrice(down())}
            </span>
          </>
        )}
      </Show>
      <Show when={props.parts.main}>
        {(main) => (
          <>
            <span class={`${LABEL} text-xs text-muted`}>
              {props.parts.mainLabel}
            </span>
            <span class="flex flex-wrap items-baseline gap-x-2 text-xs text-muted tabular-nums">
              <span>{formatPrice(main())}</span>
              <Show when={props.parts.note}>
                {(note) => <span class="text-faint">{note()}</span>}
              </Show>
              <Show when={props.parts.total}>
                {(total) => (
                  <span>{tr("info.total", formatPrice(total()))}</span>
                )}
              </Show>
            </span>
          </>
        )}
      </Show>
      {/* A listing with no price has neither, so the rows above would sit empty. */}
      <Show when={!props.parts.down && !props.parts.main}>
        <span class="col-span-2 text-lg font-bold text-accent-ink tabular-nums">
          {MISSING_PRICE}
        </span>
      </Show>
    </div>
  );
}

export function InfoTable(props: { listing: AdoptListing }) {
  // A component body runs once, so we pass accessors down: opening listing B must update
  // the rows that are already on screen.
  const l = () => props.listing;
  const parts = createMemo(() => priceParts(l(), priceMode()));
  const plan = createMemo(() => {
    const p = parts();
    return p?.mode === "installment" ? p : null;
  });
  const once = createMemo(() => {
    const p = parts();
    return p?.mode === "once" ? p : null;
  });
  const owner = createMemo(() => socials().get(l().adoptId)?.ownerName);
  const colors = createMemo(() => colorNames(l()));
  // isLock on the wire: 2 = locked, 1 = locking (deposit unpaid), 0 = free
  const lock = createMemo(() =>
    l().isLock === 1
      ? { text: tr("detail.lockedNow"), color: "amber" as const }
      : isLocked(l())
        ? { text: tr("detail.locked"), color: "red" as const }
        : { text: tr("detail.unlocked"), color: "green" as const },
  );
  const adopted = createMemo(() => isAdopted(l()));

  return (
    <div class="rounded-xl bg-surface border border-border p-3">
      <div class={`${GRID} items-start`}>
        <HeadImg
          url={sizedUrl(stableImageUrl(l().adoptHeadPicture), "badge")}
        />
        <div class="min-w-0">
          <div class="flex items-baseline gap-2">
            <h1 class="text-xl font-bold truncate">
              {wordsPending() ? (
                <SkelText class="h-6 w-28" />
              ) : (
                (listingName(l()) ?? tr("common.unknown"))
              )}
            </h1>
            <span class="text-sm text-muted shrink-0">#{l().adoptId}</span>
          </div>
          <Show when={plan()}>{(p) => <InstallmentPlan parts={p()} />}</Show>
          <Show when={once()}>{(p) => <OncePriceLine parts={p()} />}</Show>
        </div>
      </div>

      {/* A description list, so a reader takes a field and its value as one thing — "Race, Dragon"
          — and the rotor can walk the fields without the row borders getting in the way. */}
      <dl class="m-0" aria-label={tr("detail.fields")}>
        {/* We load socials per detail page, so 主人 shows only when that table has this id */}
        <OptRow label={tr("detail.owner")} when={!!owner()}>
          {owner()}
        </OptRow>

        <Show when={l().harmonyPainterVo}>
          <Row label={tr("detail.painter")}>
            <div class="flex items-center gap-1.5">
              {/* The row is already named 画师, so the face is decoration. */}
              <Show
                when={painterAvatar(l())}
                fallback={<span class="w-6 h-6 rounded-full bg-surface-2" />}
              >
                {(url) => (
                  <img
                    src={url()}
                    alt=""
                    class="w-6 h-6 rounded-full object-cover"
                  />
                )}
              </Show>
              {/* The painter's name is one of the fields the API returns translated, so the one the
                row carries belongs to the language before the reader's pick. */}
              {wordsPending() ? (
                <SkelText class="h-4 w-20" />
              ) : (
                <span>{listingPainterName(l()) ?? tr("common.unknown")}</span>
              )}
            </div>
          </Row>
        </Show>

        <OptRow label={tr("detail.race")} when={!!raceDisplay(l())}>
          {raceDisplay(l())}
        </OptRow>

        <OptRow label={tr("detail.color")} when={colors().length > 0}>
          <div class="flex flex-wrap gap-1">
            <For each={colors()}>
              {(c) => (
                <span class="px-2 py-0.5 rounded-md bg-surface-2 text-[11px] text-ink">
                  {colorDisplay(c)}
                </span>
              )}
            </For>
          </div>
        </OptRow>

        <Row label={tr("detail.status")}>
          <div class="flex gap-1.5">
            <StatusBadge text={lock().text} color={lock().color} />
            <StatusBadge
              text={adopted() ? tr("detail.adopted") : tr("detail.unadopted")}
              color={adopted() ? "purple" : "blue"}
            />
          </div>
        </Row>

        {/* In installment mode the plan above already labels this money 首付, so the row
          does not give the same amount a second name */}
        <OptRow
          label={tr("detail.deposit")}
          when={once() !== null && (l().earnest ?? 0) > 0}
        >
          {formatPrice(l().earnest ?? 0)}
        </OptRow>

        <OptRow label={tr("detail.created")} when={!!l().createTime}>
          {l().createTime}
        </OptRow>
        <OptRow label={tr("detail.updated")} when={!!l().updateTime}>
          {l().updateTime}
        </OptRow>
        <OptRow label={tr("detail.note")} when={!!l().remark}>
          <span class="whitespace-pre-wrap">{l().remark}</span>
        </OptRow>
        <OptRow
          label={tr("detail.description")}
          when={wordsPending() || !!listingDescription(l())}
        >
          <Show when={!wordsPending()} fallback={<DescSkel />}>
            <Description listing={l} />
          </Show>
        </OptRow>
      </dl>
    </div>
  );
}
