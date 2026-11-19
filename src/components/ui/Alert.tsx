import { Show, type JSXElement } from 'solid-js'
import { AntIcon } from './AntIcon'
import { tr } from '../../i18n'
import { CloseOutlined, WarningOutlined } from '@ant-design/icons-svg'

/**
 * A line the reader has to be told before they read anything else: what failed, in one sentence,
 * with the way out under it.
 *
 * The shape follows shadcn/ui's `Alert`: an icon in a narrow first column, the title and the line
 * under it in the second column, and the actions against the right edge.
 *
 * The caller brings the actions and the way to dismiss, because a load that failed shows a retry
 * and another kind of failure would show something else.
 */
export function Alert(props: {
  title: string
  line: string
  onClose: () => void
  children?: JSXElement
  class?: string
}) {
  return (
    <div
      role="alert"
      class={`relative rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 shadow-lg dark:border-red-900 dark:bg-red-950 dark:text-red-300 ${props.class ?? ''}`}
    >
      <div class="grid grid-cols-[1rem_1fr] gap-x-3 gap-y-1">
        <AntIcon icon={WarningOutlined} size={16} class="translate-y-0.5" />
        <div class="col-start-2 min-h-4 font-medium tracking-tight">{props.title}</div>
        <div class="col-start-2 text-[13px] leading-relaxed opacity-90">{props.line}</div>
      </div>
      {/* Beside the line it would sit in front of a sentence that the reader is still reading. */}
      <Show when={props.children}>
        <div class="mt-3 flex items-center justify-end gap-2">{props.children}</div>
      </Show>
      <button
        class="absolute top-1 right-1 rounded-md p-2 text-red-700/70 active:bg-red-100 active:text-red-700 dark:text-red-300/70 dark:active:bg-red-900"
        aria-label={tr('common.close')}
        onClick={props.onClose}
      >
        <AntIcon icon={CloseOutlined} size={12} />
      </button>
    </div>
  )
}
