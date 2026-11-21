import { FILTER_TABS, tabLabel, type FilterTab } from "../../model/filter";
import { setTab, tab } from "../../stores/filterStore";
import {
  countAll,
  countLocked,
  countUnlocked,
  wishlistCount,
} from "../../stores/derivedStore";
import { SegmentedControl, type Segment } from "../ui/SegmentedControl";
import { tr } from "../../i18n";

const COUNT_FOR: Record<FilterTab, () => number> = {
  all: countAll,
  unlocked: countUnlocked,
  locked: countLocked,
  wishlist: wishlistCount,
};

/** The label sets the segment width, so a count arriving with the data cannot shake the row.
 *  Two lines are what keep the pill inside a 320px screen. */
export function TabPill() {
  const items: Segment<FilterTab>[] = FILTER_TABS.map((t) => ({
    value: t,
    label: () => tabLabel(t),
    hint: COUNT_FOR[t],
  }));

  // the page's main switch, so it is the one row that wears the accent
  return (
    <SegmentedControl
      value={tab}
      onChange={setTab}
      items={items}
      label={tr("filter.tabGroup")}
      accent
      class="seg-glass pointer-events-auto"
    />
  );
}
