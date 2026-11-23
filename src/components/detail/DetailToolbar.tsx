import { tr } from "../../i18n";
import { Show, For } from "solid-js";
import { BOX, type Shape } from "../../draw/layout";
import type { AdoptListing } from "../../model/types";
import type { IconDefinition } from "@ant-design/icons-svg/lib/types";
import { isWishlisted } from "../../stores/wishlistStore";
import { socials } from "../../stores/socialsStore";
import {
  XOutlined,
  BilibiliOutlined,
  TikTokOutlined,
  ExportOutlined,
} from "@ant-design/icons-svg";
import { isLocked } from "../../model/domain";
import {
  PLATFORM_ORDER,
  buildUrl,
  displayValue,
  type PlatformKey,
} from "../../data/socials";
import { AntIcon } from "../ui/AntIcon";
import { WishlistButton } from "../ui/WishlistButton";
import { XIAOHONGSHU } from "../ui/icons";

// Platform brand meta for the chips: a rounded square, the brand's ink, and its name.
type ChipMeta = {
  icon: IconDefinition;
  color: string;
  /** Read when the chip draws, so the name arrives in the language on screen. */
  label: () => string;
};
const PLATFORM_META: Record<PlatformKey, ChipMeta> = {
  x: { icon: XOutlined, color: "#000000", label: () => "X" },
  bilibili: {
    icon: BilibiliOutlined,
    color: "#fb7299",
    label: () => "Bilibili",
  },
  tiktok: { icon: TikTokOutlined, color: "#010101", label: () => "TikTok" },
  douyin: {
    icon: TikTokOutlined,
    color: "#000000",
    label: () => tr("brand.douyin"),
  },
  xiaohongshu: {
    icon: XIAOHONGSHU,
    color: "#ff2442",
    label: () => tr("brand.xiaohongshu"),
  },
};

// Social chips (rounded-square icon buttons) for a locked listing's owner. `socials()` starts empty
// and fills in when the runtime fetch resolves, so the chips never block the sheet. Each one opens
// its platform URL in a new tab, and a platform with no URL gets no chip.
function SocialChips(props: { item: AdoptListing }) {
  const chips = () => {
    const p = socials().get(props.item.adoptId)?.platforms;
    if (!p) return [];
    return PLATFORM_ORDER.flatMap((key) => {
      if (p[key] == null) return [];
      const url = buildUrl(key, p);
      if (!url) return []; // no URL → don't show the chip
      return [{ url, value: displayValue(key, p), meta: PLATFORM_META[key] }];
    });
  };
  return (
    <Show when={chips().length > 0}>
      <div class="flex items-center gap-2">
        <For each={chips()}>
          {(c) => (
            <a
              href={c.url}
              target="_blank"
              rel="noopener noreferrer"
              title={c.value}
              aria-label={c.meta.label()}
              class="press-host inline-flex"
            >
              <span
                class="press-face inline-flex items-center justify-center w-9 h-9 rounded-lg text-white"
                style={{ background: c.meta.color }}
              >
                <AntIcon icon={c.meta.icon} size={18} />
              </span>
            </a>
          )}
        </For>
      </div>
    </Show>
  );
}

// The bar at the foot of the detail: 收藏 toggle (works for locked listings too) + social chips
// (locked only) + 前往官网.
export function DetailToolbar(props: { item: AdoptListing; shape: Shape }) {
  const wishlisted = () => isWishlisted(props.item.adoptId);
  return (
    <div
      class={`border-t border-border bg-canvas pt-3 ${BOX[props.shape].barPad}`}
    >
      <div class="no-pick flex items-center gap-4">
        <WishlistButton
          item={props.item}
          size={18}
          heartClass={wishlisted() ? "text-red-500" : "text-muted"}
          class="press-host"
          faceClass="gap-1.5 h-9 px-3 rounded-lg text-sm"
          faceList={{
            "bg-red-500/15 text-red-600 dark:bg-red-500/25": wishlisted(),
            "bg-surface text-ink": !wishlisted(),
          }}
        >
          <span>{wishlisted() ? tr("card.wished") : tr("card.wish")}</span>
        </WishlistButton>
        <Show when={isLocked(props.item)}>
          <SocialChips item={props.item} />
        </Show>
        <div class="flex-1" />
        <a
          href={`https://www.furmony.com/product/detail?id=${props.item.adoptId}&type=LYWT`}
          target="_blank"
          rel="noopener noreferrer"
          class="press-host"
        >
          <span class="press-face flex items-center gap-1.5 h-9 px-4 rounded-lg bg-accent text-white text-sm font-semibold">
            {tr("detail.goOfficial")}
            <AntIcon icon={ExportOutlined} size={14} />
          </span>
        </a>
      </div>
    </div>
  );
}
