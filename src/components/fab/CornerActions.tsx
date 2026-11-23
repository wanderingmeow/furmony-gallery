// The corner's two circles. The funnel owns the list - what is in it and in what order; … owns how
// the list reads. The number on the funnel counts only what hides a listing.
import {
  ClockCircleOutlined,
  DollarOutlined,
  EllipsisOutlined,
  FilterFilled,
  FilterOutlined,
} from "@ant-design/icons-svg";
import type { IconDefinition } from "@ant-design/icons-svg/lib/types";
import { filtersOnCount } from "../../stores/derivedStore";
import { semanticActive } from "../../stores/semanticStore";
import { sortMode } from "../../stores/filterStore";
import {
  relevanceLabel,
  SORT_UP,
  sortModeLabel,
  type SortMode,
} from "../../model/filter";
import { SortMark } from "../ui/SortMark";
import { tr } from "../../i18n";
import { FabMenu } from "./FabMenu";
import { FilterPanel } from "./FilterPanel";
import { SettingsPanel } from "./SettingsPanel";

const SORT_GLYPH: Record<SortMode, IconDefinition> = {
  priceAsc: DollarOutlined,
  priceDesc: DollarOutlined,
  timeAsc: ClockCircleOutlined,
  timeDesc: ClockCircleOutlined,
};

export function CornerActions() {
  // A search answer is ranked by the service, so the order is not the circle's to show: the face
  // gives way to the funnel, which is the other half of what the panel holds.
  const orderFace = () =>
    semanticActive() ? null : (
      <SortMark what={SORT_GLYPH[sortMode()]} up={SORT_UP[sortMode()]} />
    );
  const orderLabel = () =>
    tr(
      "sort.title",
      semanticActive() ? relevanceLabel() : sortModeLabel(sortMode()),
    );

  return (
    <>
      {/* A search and a filter are one question, so the funnel stays whichever way the edge goes. */}
      <FabMenu
        drop
        label={orderLabel()}
        icon={() => (filtersOnCount() > 0 ? FilterFilled : FilterOutlined)}
        face={orderFace}
        badge={filtersOnCount}
        panelClass="w-72"
      >
        <FilterPanel />
      </FabMenu>
      {/* The rows behind … hide no listing, so an open search box takes this circle's room where the
          edge is too narrow for both: see `[data-chrome='more']` in index.css. */}
      <div data-chrome="more">
        <FabMenu
          drop
          label={tr("filter.more")}
          icon={() => EllipsisOutlined}
          panelClass="w-72"
        >
          <SettingsPanel />
        </FabMenu>
      </div>
    </>
  );
}
