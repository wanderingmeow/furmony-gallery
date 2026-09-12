/* @refresh reload */
import { render } from 'solid-js/web'
import './index.css'
import App from './App.tsx'

// Disable iOS Safari Double-Tap to Zoom
document.ondblclick = (e) => e.preventDefault()

const root = document.getElementById('root')

render(() => <App />, root!)
