import { createRoot } from 'octane'
import App from './App.btsx'
import './style.css'
import '@fontsource/ibm-plex-mono/latin-400.css'

const container = document.getElementById('app')
if (container === null) throw new Error('Missing #app container.')

createRoot(container).render(App, {})
