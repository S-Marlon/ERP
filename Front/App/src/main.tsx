import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { ProductProvider } from "./context/ProductContext";
import { ServiceProductProvider } from "./context/ServiceProductContext"; // <-- importe aqui
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ProductProvider>
      <ServiceProductProvider> 
        <App />
      </ServiceProductProvider>
    </ProductProvider>
  </StrictMode>,
)