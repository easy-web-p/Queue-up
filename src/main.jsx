import 'bootstrap-icons/font/bootstrap-icons.css';
import './index.css';
// Loaded AFTER index.css on purpose, because that is where Bootstrap was.
//
// main.jsx imported Bootstrap first, but Vite put it in the vendor-ui chunk and
// dist/index.html links index.css before vendor-ui.css — so Bootstrap actually
// loaded last and won every collision at equal specificity. Around a hundred
// class names exist in both stylesheets (p-4, gap-2, text-center, border), and
// the app has been getting Bootstrap's values for all of them. Importing the
// replacement any earlier silently hands those to Tailwind instead, which
// changes spacing and typography across every page.
//
// Generated from Bootstrap's own rules and verified against them class by
// class: npm run test:bootstrap-shim
import './styles/bootstrap-compat.css';
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'
import { store } from './store/store'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Provider store={store}>
      <App />
    </Provider>
  </StrictMode>,
)