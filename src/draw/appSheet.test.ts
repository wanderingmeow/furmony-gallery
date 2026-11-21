import { beforeEach, describe, expect, it, vi } from 'vitest'
import { appSheetReady, watchAppSheet } from './appSheet'

const link = () => {
  const el = document.createElement('link')
  el.setAttribute('data-app-sheet', '')
  document.head.append(el)
  return el
}

describe('the sheet the document waits for', () => {
  beforeEach(() => {
    sessionStorage.clear()
    document.head.querySelectorAll('link').forEach((el) => el.remove())
  })

  it('waits for the sheet the document links, and lets go when it arrives', () => {
    const el = link()
    watchAppSheet()
    expect(appSheetReady()).toBe(false)
    el.dispatchEvent(new Event('load'))
    expect(appSheetReady()).toBe(true)
  })

  it('paints however it comes out once a reload has already been spent', () => {
    sessionStorage.setItem('furmony:sheet-reloaded', '1')
    const el = link()
    watchAppSheet()
    expect(appSheetReady()).toBe(false)
    el.dispatchEvent(new Event('error'))
    expect(appSheetReady()).toBe(true)
  })

  it('counts a sheet that failed before the script ran as the same failure', () => {
    sessionStorage.setItem('furmony:sheet-reloaded', '1')
    ;(window as unknown as { __appSheetFailed: boolean }).__appSheetFailed = true
    link()
    watchAppSheet()
    expect(appSheetReady()).toBe(true)
    delete (window as unknown as { __appSheetFailed?: boolean }).__appSheetFailed
  })

  it('does not reload when storage cannot remember the reload', () => {
    const refuse = vi.spyOn(sessionStorage, 'setItem').mockImplementation(() => {
      throw new Error('quota')
    })
    const el = link()
    watchAppSheet()
    el.dispatchEvent(new Event('error'))
    expect(appSheetReady()).toBe(true)
    refuse.mockRestore()
  })
})
