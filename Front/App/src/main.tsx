import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './app/App.tsx'
import { ProductProvider } from "./shared/context/ProductContext";
import { ServiceProductProvider } from "./shared/context/ServiceProductContext"; // <-- importe aqui
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