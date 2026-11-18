// These tests drive the browser's own history, because the marker only matters if the entry
// keeps it across back and forward. The router's memory source drops state entirely, so the
// tests use the real one.
import { afterEach, describe, expect, it } from 'vitest'
import { render } from 'solid-js/web'
import { Route, Router, useLocation, useNavigate } from '@solidjs/router'
import type { DetailEntry } from './detailTrail'

// The mounted probe hands its router out to the tests.
let hop!: (path: string, state?: DetailEntry) => void
let go!: (delta: number) => void

function Probe() {
  const location = useLocation<DetailEntry>()
  const navigate = useNavigate()
  hop = (path, state) => navigate(path, { scroll: false, state })
  go = (delta) => history.go(delta)
  return (
    <>
      <span id="path">{location.pathname}</span>
      <span id="from">{location.state?.fromDetail ?? ''}</span>
    </>
  )
}

const text = (id: string) => document.getElementById(id)?.textContent ?? null
// happy-dom moves through the entries on a later task, so a test reads after one turn.
const settle = () => new Promise<void>((done) => setTimeout(done, 0))

let dispose: (() => void) | undefined
let host: HTMLDivElement | undefined

function mount(): void {
  // The entry a card in the grid leaves behind: a detail with no marker at all.
  history.replaceState(null, '', '/detail/7')
  host = document.createElement('div')
  document.body.appendChild(host)
  dispose = render(
    () => (
      <Router base="" root={() => <Probe />}>
        <Route path="*" component={() => null} />
      </Router>
    ),
    host,
  )
}

afterEach(() => {
  dispose?.()
  host?.remove()
})

describe('the marker a detail entry carries', () => {
  it('lands on the entry the hop pushed', async () => {
    mount()
    const before = history.length
    hop('/detail/1', { fromDetail: 7 })
    await settle()
    expect(text('path')).toBe('/detail/1')
    expect(text('from')).toBe('7')
    // Pushed, not replaced: without a new entry, back has nothing to return to.
    expect(history.length).toBe(before + 1)
    // The router writes its own bookkeeping into the same object and keeps our field.
    expect((history.state as DetailEntry).fromDetail).toBe(7)
  })

  it('hands back the marker of the entry below', async () => {
    mount()
    hop('/detail/1', { fromDetail: 7 })
    await settle()
    hop('/detail/2', { fromDetail: 1 })
    await settle()
    go(-1)
    await settle()
    expect(text('path')).toBe('/detail/1')
    expect(text('from')).toBe('7')
  })

  it('brings the marker back on forward', async () => {
    mount()
    hop('/detail/1', { fromDetail: 7 })
    await settle()
    hop('/detail/2', { fromDetail: 1 })
    await settle()
    go(-1)
    await settle()
    go(1)
    await settle()
    expect(text('path')).toBe('/detail/2')
    expect(text('from')).toBe('1')
  })

  it('is absent on the rung the grid opened', async () => {
    mount()
    expect(text('path')).toBe('/detail/7')
    expect(text('from')).toBe('')
    hop('/detail/3') // the grid, a link, or the notification center: no state at all
    await settle()
    expect(text('from')).toBe('')
  })
})
