import type { IconDefinition } from "@ant-design/icons-svg/lib/types";
import { ArrowDownOutlined, ArrowUpOutlined } from "@ant-design/icons-svg";
import { AntIcon } from "../ui/AntIcon";

/**
 * The order in one mark: the arrow in front, the icon it sorts by behind it.
 *
 * The glyph fades through a mask, so it thins toward the arrow with no hard edge. Two glyphs side
 * by side read as two icons; a solid arrow with a soft shape behind it reads as one order.
 */
export function SortMark(props: { what: IconDefinition; up: boolean }) {
  return (
    // box = the glyph, so centering the box centers the glyph in the circle
    <span class="relative block w-[20px] h-[20px]" aria-hidden="true">
      <span
        class="absolute inset-0 flex"
        style={{
          // mask = a diagonal away from the arrow, so the corner farthest from it stays solid
          "mask-image":
            "linear-gradient(to top right, transparent 24%, black 58%)",
          "-webkit-mask-image":
            "linear-gradient(to top right, transparent 24%, black 58%)",
        }}
      >
        <AntIcon icon={() => props.what} size={20} />
      </span>
      {/* offset = halfway between the two alignments: 3px inside the glyph's corner on each axis,
          and the arrow's box reaches outside it.
          flex keeps the glyph in its box: as an inline-block it would sit on the button's own
          line, which drops it a few pixels. */}
      <span class="absolute -left-[3px] top-[11px] flex">
        <AntIcon
          icon={() => (props.up ? ArrowUpOutlined : ArrowDownOutlined)}
          size={12}
        />
      </span>
    </span>
  );
}
