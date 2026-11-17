/* @refresh reload */
import { render } from 'solid-js/web'
import './index.css'
import App from './App.tsx'

// Disable iOS Safari Double-Tap to Zoom
document.ondblclick = (e) => e.preventDefault()

// The spinner in index.html sits outside #root, so render() cannot clear it. Home removes it
// once the screen has something to show.
render(() => <App />, document.getElementById('root')!)

// Rollup keeps a file separate only when something imports it dynamically. Starting the detail
// body here means it downloads beside the first screen, so a card opens with no wait. Stats
// stays behind a real tap: a reader who never opens the statistics screen never needs charts.
void import('./routes/Detail')
