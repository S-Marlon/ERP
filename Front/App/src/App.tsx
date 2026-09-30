import { BrowserRouter } from "react-router-dom";
import { UIProvider } from './context/UIContext';
import { ListaTrabalhoProvider } from './core/listaTrabalho/ListaTrabalhoContext';
import AppLayout from './AppLayout';

export default function App() {
  return (
    <UIProvider>
      {/* Lista de trabalho global (etiquetar, comprar, conferir...): vale em todas as telas */}
      <ListaTrabalhoProvider>
        <BrowserRouter>
          <AppLayout />
        </BrowserRouter>
      </ListaTrabalhoProvider>
    </UIProvider>
  );
}
