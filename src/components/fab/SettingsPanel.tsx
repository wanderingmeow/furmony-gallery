// The panel the … circle opens: how the list reads, as opposed to what is in it. Every row here
// hides no listing, which is why none of them counts toward the number on the funnel, and none of
// them takes the funnel's 重置: the picks here are worth keeping as they are.
import { For, Show } from "solid-js";
import {
  BellOutlined,
  BulbOutlined,
  DollarOutlined,
  GlobalOutlined,
} from "@ant-design/icons-svg";
import {
  setPriceMode,
  setSemanticSearch,
  priceMode,
} from "../../stores/displayStore";
import { searchConfigured, semanticOn } from "../../stores/semanticStore";
import {
  PRICE_MODES,
  priceModeLabel,
  type PriceMode,
} from "../../model/domain";
import { SegmentedControl, type Segment } from "../ui/SegmentedControl";
import { ChoiceGrid } from "../ui/ChoiceGrid";
import { AntIcon } from "../ui/AntIcon";
import { Switch } from "../ui/Switch";
import { wishlist } from "../../stores/wishlistStore";
import { promptsSilenced, restorePrompts } from "../../stores/persistenceStore";
import { tr } from "../../i18n";
import {
  LOCALES,
  LOCALE_NAME,
  requestedLocale,
  setLocale,
} from "../../i18n/locale";
import { PANEL_BLOCK, PanelHeader, UNDER_NOTE, UNDER_TEXT } from "./panelParts";
import { PUSH_CATEGORIES } from "../../data/pushApi";
import {
  installHelpUrl,
  pushBusy,
  pushHidden,
  pushHint,
  pushLine,
  pushOn,
  pushRows,
  pushPicks,
  pushSwitchHeld,
  setPick,
  turn,
} from "../../stores/pushStore";

const priceItems = (): Segment<PriceMode>[] =>
  PRICE_MODES.map((m) => ({ value: m, label: priceModeLabel(m) }));

function PriceModeBlock() {
  return (
    <div class={PANEL_BLOCK}>
      <PanelHeader icon={<AntIcon icon={DollarOutlined} />}>
        {tr("filter.priceMode")}
      </PanelHeader>
      {/* The indent lives outside the bordered box: that box has an edge, and the edge is
          what lines up with the header's first letter. */}
      <div class={`mt-1 mb-2 ${UNDER_TEXT}`}>
        <SegmentedControl
          label={tr("filter.priceMode")}
          fill
          value={priceMode}
          onChange={setPriceMode}
          items={priceItems()}
        />
      </div>
    </div>
  );
}

function SemanticBlock() {
  return (
    <div class={PANEL_BLOCK}>
      <PanelHeader icon={<AntIcon icon={BulbOutlined} />}>
        {tr("filter.enhance")}{" "}
        <span class="text-[10px] px-1 rounded bg-blue-500/15 text-blue-600 dark:text-blue-300">
          Beta
        </span>
        <div class="ml-auto">
          <Switch
            on={semanticOn()}
            onChange={setSemanticSearch}
            label={tr("filter.enhance")}
          />
        </div>
      </PanelHeader>
      {/* Where what the user sends goes, said once at the switch: a tooltip does not
          exist on a touch screen, and repeating it under every query would be noise. Every
          clause is true of the service, so none of it is softened. */}
      <div class={UNDER_NOTE}>
        {/* One line, kept on one source line: JSX turns a break between Chinese characters into
            a visible space, and there is no space to spare before （ZDR）. */}
        <span class="block">{tr("filter.enhanceNote")}</span>
      </div>
    </div>
  );
}

/**
 * The language of the interface and of the words the API returns translated. Four names in four
 * scripts have no room side by side, so they take two rows of two.
 */
function LanguageBlock() {
  const items = LOCALES.map((code) => ({
    value: code,
    label: LOCALE_NAME[code],
  }));
  return (
    <div class={PANEL_BLOCK}>
      <PanelHeader icon={<AntIcon icon={GlobalOutlined} />}>
        {tr("filter.language")}
      </PanelHeader>
      <div class={`mt-1 mb-2 ${UNDER_TEXT}`}>
        {/* The tick follows the pick, not the page: the user just chose this, and the translated
            words arrive a moment later. */}
        <ChoiceGrid
          label={tr("filter.language")}
          columns={2}
          value={requestedLocale}
          onChange={setLocale}
          items={items}
        />
      </div>
    </div>
  );
}

/** Clears the month that keeps the prompt hidden. Red because it takes a choice away, the way the
 *  filter row's reset does; a browser that never mutes notifications never shows this row.
 */
function PromptRow() {
  return (
    <Show when={promptsSilenced()}>
      <div class={PANEL_BLOCK}>
        <button
          class="w-full min-h-7 px-1.5 text-right text-xs font-semibold
                 text-red-500 dark:text-red-400"
          onClick={() => restorePrompts(wishlist().size > 0)}
        >
          {tr("filter.restorePrompts")}
        </button>
      </div>
    </Show>
  );
}

const NEWS_LABEL = { new: "push.news", lock: "push.lock" } as const;

/** Two switches, because a reader who wants 新设定 and none of the 锁定状态 changes is an ordinary
 *  reader, and one switch cannot say that.
 */
function NewsRows() {
  return (
    <div class={`mt-1 ${UNDER_TEXT}`}>
      <For each={PUSH_CATEGORIES}>
        {(which) => (
          <div class="flex items-center gap-2 py-1">
            <span class="text-xs">{tr(NEWS_LABEL[which])}</span>
            <div class="ml-auto">
              <Switch
                on={pushPicks()[which]}
                // Held with the master switch: the body being sent carries both picks, so a second
                // flip mid-send would be answered by a request that already left without it.
                disabled={pushSwitchHeld()}
                onChange={(v) => setPick(which, v)}
                label={tr(NEWS_LABEL[which])}
              />
            </div>
          </div>
        )}
      </For>
    </div>
  );
}

/** The note says the endpoint goes to the push service and is kept nowhere here: the one thing worth
 *  reading before the reader says yes.
 */
function PushBlock() {
  return (
    <div class={PANEL_BLOCK}>
      <PanelHeader icon={<AntIcon icon={BellOutlined} />}>
        {tr("push.title")}
        <div class="ml-auto">
          <Switch
            on={pushOn()}
            disabled={pushSwitchHeld()}
            onChange={(v) => void turn(v)}
            label={tr("push.title")}
          />
        </div>
      </PanelHeader>
      <div class={UNDER_NOTE}>
        <span class="block">{tr("push.note")}</span>
      </div>
      <Show when={pushRows()}>
        <NewsRows />
      </Show>
      <Show when={pushLine()}>
        <div class={UNDER_NOTE}>{pushLine()}</div>
      </Show>
      {/* The standing line, and a detected fault takes its place while it lasts. The switch cannot
          promise delivery: a device can refuse a notification for reasons no page is shown, the
          system's own settings among them, so the line says what the switch is instead. */}
      <Show when={!pushLine() && pushRows()}>
        <div class={UNDER_NOTE}>{tr("push.meaning")}</div>
      </Show>
      {/* One line at a time: an answer that just arrived out-ranks the standing guidance, and
          drawing both can put the same sentence on the screen twice. */}
      <Show when={!pushLine() && !pushOn() && !pushBusy() && pushHint()}>
        <div class={UNDER_NOTE}>{pushHint()}</div>
      </Show>
      {/* The menu item differs by device, and Apple's page is the one that keeps up with it. */}
      <Show when={installHelpUrl()}>
        <div class={UNDER_NOTE}>
          <a
            class="text-accent underline decoration-2 underline-offset-4"
            href={installHelpUrl()}
            target="_blank"
            rel="noopener noreferrer"
          >
            {tr("push.installHelp")}
          </a>
        </div>
      </Show>
    </div>
  );
}

// It owns the padding and the scrolling, so the blocks run to the glass edge and `FabMenu` only has
// to draw the box.
export function SettingsPanel() {
  return (
    <div class="no-pick min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
      <PriceModeBlock />
      {/* A build without a search address hides the switch rather than offering a search that
          quietly does nothing. */}
      <Show when={searchConfigured}>
        <SemanticBlock />
      </Show>
      {/* A build with no service, or no key to open a subscription with, leaves the row out rather
          than offering a switch that cannot be answered. */}
      <Show when={!pushHidden()}>
        <PushBlock />
      </Show>
      <LanguageBlock />
      <PromptRow />
    </div>
  );
}
