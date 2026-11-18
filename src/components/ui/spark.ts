import type { IconDefinition } from '@ant-design/icons-svg/lib/types'

/**
 * The four-point sparkle that stands for the enhanced search. The installed
 * @ant-design/icons-svg has no sparkle, so we draw the glyph here and pass it to AntIcon like
 * any other. One color, so it does not read as another company's mark.
 */
export const SPARK: IconDefinition = {
  name: 'spark',
  theme: 'filled',
  icon: {
    tag: 'svg',
    attrs: { viewBox: '0 0 24 24' },
    children: [
      {
        tag: 'path',
        attrs: {
          d: 'M12 2C12.9 8.1 15.9 11.1 22 12 15.9 12.9 12.9 15.9 12 22 11.1 15.9 8.1 12.9 2 12 8.1 11.1 11.1 8.1 12 2Z',
        },
      },
    ],
  },
}

/** The class on a sparkle while it is working. The keyframes hold the accent, and both ends of
 *  the cycle are the resting gray, so the mark stops on the color it already has. One place, so
 *  the search box and the picture row always match. */
export const SPARK_WORKING = 'spark-pulse'
