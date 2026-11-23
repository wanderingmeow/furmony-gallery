// The panel the … circle opens: how the list reads, as opposed to what is in it. Every row here
// hides no listing, which is why none of them counts toward the number on the funnel, and none of
// them takes a 重置: nothing here needs undoing after the fact.
import { Show } from "solid-js";
import {
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
import { tr } from "../../i18n";
import {
  LOCALES,
  LOCALE_NAME,
  requestedLocale,
  setLocale,
} from "../../i18n/locale";
import { PANEL_BLOCK, PanelHeader, UNDER_NOTE, UNDER_TEXT } from "./panelParts";

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
      <LanguageBlock />
    </div>
  );
}
