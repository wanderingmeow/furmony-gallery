// The panel the funnel opens: what is in the list. Every row here hides listings, which is what the
// number on the funnel counts.
import { createSignal, For, Show, untrack } from "solid-js";
import type { JSXElement } from "solid-js";
import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  BgColorsOutlined,
  CameraOutlined,
  ClockCircleOutlined,
  DollarOutlined,
  ExperimentOutlined,
  SortAscendingOutlined,
  UserOutlined,
} from "@ant-design/icons-svg";
import type { IconDefinition } from "@ant-design/icons-svg/lib/types";
import {
  availableColors,
  availableRaces,
  debutCount,
  debutFilterOn,
  debutsReady,
  filtersChanged,
  resetFilters,
  socialCount,
  socialFilterOn,
  socialsReady,
} from "../../stores/derivedStore";
import {
  selectedColors,
  setSelectedColors,
  selectedRaces,
  setSelectedRaces,
  setSocialOnly,
  setDebutOnly,
  setSortMode,
  sortMode,
} from "../../stores/filterStore";
import { semanticActive } from "../../stores/semanticStore";
import {
  relevanceLabel,
  sortModeLabel,
  type SortMode,
} from "../../model/filter";
import { AntIcon } from "../ui/AntIcon";
import { CHEVRON } from "../ui/icons";
import { Switch } from "../ui/Switch";
import { SORT_BTN } from "../ui/boxes";
import { tr } from "../../i18n";
import { colorLabel, raceLabelByName } from "../../i18n/glossary";
import {
  PANEL_BLOCK,
  PanelHeader,
  ResetRow,
  UNDER_NOTE,
  UNDER_TEXT,
} from "./panelParts";
import { PriceRangeBlock } from "../priceRange";

const COLOR_DOT: Record<string, string> = {
  红: "bg-red-500",
  橙: "bg-orange-500",
  黄: "bg-yellow-500",
  绿: "bg-green-600",
  蓝: "bg-blue-600",
  紫: "bg-purple-600",
  黑: "bg-black",
  白: "bg-white",
  灰: "bg-gray-500",
  棕: "bg-amber-800",
  褐: "bg-[#59331a]",
  粉: "bg-pink-500",
  青: "bg-cyan-500",
};
const RACE_ICON: Record<string, string> = {
  狼: "🐺",
  龙: "🐉",
  东方龙: "🐉",
  羊: "🐑",
  虎: "🐯",
  狮: "🦁",
  豹: "🐆",
  狗: "🐕",
  犬: "🐕",
  龙犬: "🐕",
  熊: "🐻",
  猫: "🐱",
  狐狸: "🦊",
  神兽: "✨",
  神话: "✨",
  兵器: "🗡️",
  鱼: "🐟",
  昆虫: "🦋",
  植物: "🌿",
  蛇: "🐍",
  鸟: "🐦",
  兔: "🐰",
  鹿: "🦌",
  蝙蝠: "🦇",
  神: "👑",
  神秘生物: "❓",
};

function toggleIn(cur: Set<string>, value: string): Set<string> {
  const next = new Set(cur);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

/**
 * A foldable list of choices. It starts shut when nothing is picked, and open when something is: the
 * color and species blocks hold enough chips to push the row below past the panel's edge.
 */
function Section(props: {
  title: string;
  icon: JSXElement;
  items: string[];
  selected: Set<string>;
  onToggle: (value: string) => void;
  mark: (value: string) => JSXElement;
  /** The word for a value in the language on screen. */
  label?: (value: string) => string;
}) {
  // The fold is set once, from the picks at the moment the panel opens, and only the user moves
  // it after that. Following the picks live would close the section the instant its last pick is
  // cleared, under the finger that cleared it.
  const [open, setOpen] = createSignal(untrack(() => props.selected.size) > 0);
  const fold = () => setOpen((o) => !o);
  return (
    <div class={PANEL_BLOCK}>
      {/* One button for the whole row, so the name, the count and the chevron all fold. The count
          sits where a thumb lands when the row already shows a pick, so it has to answer. */}
      <button
        class="w-full min-h-9 flex items-center gap-2 px-1.5 text-xs font-semibold"
        aria-expanded={open()}
        onClick={fold}
      >
        {props.icon} {props.title}
        {/* Inside the button, so a screen reader says the count with the row it describes. */}
        <span class="ml-auto text-[10px] font-normal text-faint">
          {props.selected.size}/{props.items.length}
        </span>
        <span
          class="w-7 flex items-center justify-center text-faint"
          aria-hidden="true"
        >
          {/* Set by eye: the arrow shares no baseline with the digit count beside it. */}
          <span class="relative top-[1px] flex items-center">
            <AntIcon
              icon={CHEVRON}
              size={10}
              class={`transition-transform ${open() ? "rotate-180" : ""}`}
            />
          </span>
        </span>
      </button>

      <Show when={open()}>
        <div class={`mt-1 ${UNDER_TEXT} flex flex-wrap gap-1`}>
          <For each={props.items}>
            {(v) => {
              const on = () => props.selected.has(v);
              return (
                <button
                  class="flex items-center gap-1 rounded-lg border px-2 py-1.5 text-xs"
                  classList={{
                    "bg-accent/15 border-accent/40 text-accent-soft font-medium":
                      on(),
                    "bg-surface border-border": !on(),
                  }}
                  aria-pressed={on()}
                  onClick={() => props.onToggle(v)}
                >
                  {props.mark(v)}
                  <span>{props.label ? props.label(v) : v}</span>
                </button>
              );
            }}
          </For>
        </div>
      </Show>
    </div>
  );
}

// Each button flips between its own two directions and never cancels back to the other group.
const togglePrice = (current: SortMode): SortMode =>
  current === "priceAsc" ? "priceDesc" : "priceAsc";
const toggleTime = (current: SortMode): SortMode =>
  current === "timeDesc" ? "timeAsc" : "timeDesc";
const inGroup = (group: "price" | "time") => sortMode().startsWith(group);
// A search answer holds the order, so the ¥ stays and its arrow goes.
export const priceIcon = (): IconDefinition =>
  inGroup("price") && !semanticActive()
    ? sortMode() === "priceAsc"
      ? ArrowUpOutlined
      : ArrowDownOutlined
    : DollarOutlined;
export const timeIcon = (): IconDefinition =>
  inGroup("time") && !semanticActive()
    ? sortMode() === "timeDesc"
      ? ArrowDownOutlined
      : ArrowUpOutlined
    : ClockCircleOutlined;

function SortBtn(props: {
  label: string;
  /** The direction this button stands for, read against the mode the panel is showing. */
  on: () => boolean;
  icon: IconDefinition | (() => IconDefinition);
  /** The order is not the user's to set, so the button has nothing to do. */
  dead?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      class={`${SORT_BTN} flex-1 px-2 text-sm flex items-center justify-center gap-1`}
      classList={{
        "bg-accent/35 text-accent-soft": props.on() && !props.dead,
        "bg-surface-2 text-ink": !props.on() && !props.dead,
        "bg-surface-2 text-faint": !!props.dead,
      }}
      aria-pressed={props.dead ? undefined : props.on()}
      disabled={!!props.dead}
      onClick={() => props.onClick?.()}
    >
      <AntIcon icon={props.icon} /> {props.label}
    </button>
  );
}

function SortBlock() {
  return (
    <>
      {/* `sort.title` is the whole line, 排序：时间从新到旧: the order on screen is named here now
          that no circle wears it. */}
      <PanelHeader icon={<AntIcon icon={SortAscendingOutlined} />}>
        {tr(
          "sort.title",
          semanticActive() ? relevanceLabel() : sortModeLabel(sortMode()),
        )}
      </PanelHeader>
      {/* One row whether there are two buttons or one: a lone `<button>` resolves `width: auto` to
          its own content, so the sharing has to happen in the row. */}
      <Show
        when={semanticActive()}
        fallback={
          <div class={`mt-1 mb-2 ${UNDER_TEXT} flex gap-2`}>
            <SortBtn
              label={tr("sort.price")}
              on={() => inGroup("price")}
              icon={priceIcon}
              onClick={() => setSortMode(togglePrice(sortMode()))}
            />
            <SortBtn
              label={tr("sort.time")}
              on={() => inGroup("time")}
              icon={timeIcon}
              onClick={() => setSortMode(toggleTime(sortMode()))}
            />
          </div>
        }
      >
        <div class={`mt-1 mb-2 ${UNDER_TEXT} flex`}>
          {/* A search answer is ordered by the service, so one dead button names that order: no
              aria-pressed, because nothing here is on or off. */}
          <SortBtn
            label={tr("sort.relevance")}
            on={() => true}
            icon={ArrowDownOutlined}
            dead
          />
        </div>
      </Show>
    </>
  );
}

/** The owner-account switch: only a small share of listings have one, so the line names the count
 *  before the user cuts the list down to it. The switch reads `socialFilterOn` and writes `socialOnly`
 *  - with socials.json missing the row is gray, the list unfiltered, and a switch left on is kept. */
function OwnerBlock() {
  const note = () =>
    socialsReady()
      ? tr("filter.socialNote", socialCount())
      : tr("filter.socialMissing");
  return (
    <div class={PANEL_BLOCK}>
      <PanelHeader icon={<AntIcon icon={UserOutlined} />}>
        {tr("filter.socialOnly")}
        <div class="ml-auto">
          <Switch
            on={socialFilterOn()}
            onChange={setSocialOnly}
            label={tr("filter.socialOnly")}
            disabled={!socialsReady()}
          />
        </div>
      </PanelHeader>
      <div class={UNDER_NOTE}>
        <span class="block">{note()}</span>
      </div>
    </div>
  );
}

/** The debut-picture switch. The album of the day a listing first appeared comes from the studio's
 *  Bilibili post, which the build reads into `debuts.json`: a listing without one may simply have
 *  had no album posted, so the line names how many the build found. With the file missing the row
 *  is gray, the list unfiltered, and a switch left on is kept. */
function DebutBlock() {
  const note = () =>
    debutsReady()
      ? tr("filter.debutNote", debutCount())
      : tr("filter.debutMissing");
  return (
    <div class={PANEL_BLOCK}>
      <PanelHeader icon={<AntIcon icon={CameraOutlined} />}>
        {tr("filter.debutOnly")}
        <div class="ml-auto">
          <Switch
            on={debutFilterOn()}
            onChange={setDebutOnly}
            label={tr("filter.debutOnly")}
            disabled={!debutsReady()}
          />
        </div>
      </PanelHeader>
      <div class={UNDER_NOTE}>
        <span class="block">{note()}</span>
      </div>
    </div>
  );
}

// It owns the padding and the scrolling, so the blocks run to the glass edge and `FabMenu` only has
// to draw the box.
export function FilterPanel() {
  return (
    <div class="no-pick min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
      <SortBlock />
      <Section
        title={tr("filter.colors")}
        icon={<AntIcon icon={BgColorsOutlined} />}
        items={availableColors()}
        label={colorLabel}
        selected={selectedColors()}
        onToggle={(v) => setSelectedColors(toggleIn(selectedColors(), v))}
        mark={(v) => (
          <span
            class={`w-2.5 h-2.5 rounded-full shrink-0 border border-border/50 ${COLOR_DOT[v] ?? "bg-gray-400"}`}
          />
        )}
      />
      <Section
        title={tr("filter.races")}
        icon={<AntIcon icon={ExperimentOutlined} />}
        items={availableRaces()}
        label={raceLabelByName}
        selected={selectedRaces()}
        onToggle={(v) => setSelectedRaces(toggleIn(selectedRaces(), v))}
        mark={(v) => (
          <span class="w-4 text-center">{RACE_ICON[v] ?? "❔"}</span>
        )}
      />
      <OwnerBlock />
      <DebutBlock />
      <PriceRangeBlock />
      <ResetRow changed={filtersChanged} onReset={resetFilters} />
    </div>
  );
}
