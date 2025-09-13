import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { ProductProvider } from "./context/ProductContext";
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
     <ProductProvider>
      <App />
    </ProductProvider>
  </StrictMode>,
)
