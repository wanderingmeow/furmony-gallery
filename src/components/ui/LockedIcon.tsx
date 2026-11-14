import { LockFilled } from '@ant-design/icons-svg'
import { AntIcon } from './AntIcon'

/**
 * The lock that says "no longer available" — it covers both 已锁定 and 已领养.
 * Position comes from the caller's `class`; the red belongs to the meaning.
 */
export function LockedIcon(props: { class?: string; size: string }) {
  return (
    <span
      class={`flex text-red-600 ${props.class ?? ''}`}
      role="img"
      title="已锁定"
      aria-label="已锁定"
    >
      <AntIcon icon={LockFilled} size={props.size} />
    </span>
  )
}
