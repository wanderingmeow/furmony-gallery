import { createMemo, Show } from 'solid-js'
import { useParams } from '@solidjs/router'
import { listings } from '../../store'
import { Detail } from '../../routes/Detail'
import { DetailToolbar } from './DetailToolbar'
import { Sheet } from './Sheet'

// Puts the Detail route inside the shared Sheet. Detail paints its own ✕, so this file only
// hands the sheet its content and the toolbar along the bottom.
export function DetailSheet(props: { open: () => boolean; onDismiss: () => void }) {
  const params = useParams()
  // The toolbar needs the same row Detail shows, so it looks it up by id the way Detail
  // does. A copy kept here would go stale when the id changes.
  const listing = createMemo(() => listings().find((l) => l.adoptId === Number(params.id)))
  return (
    <Sheet
      open={props.open}
      onDismiss={props.onDismiss}
      footer={() => (
        <Show when={listing()}>
          {(l) => <DetailToolbar item={l()} />}
        </Show>
      )}
    >
      {(dismiss) => <Detail onClose={dismiss} />}
    </Sheet>
  )
}
