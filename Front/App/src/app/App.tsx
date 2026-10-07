import { BrowserRouter } from "react-router-dom";
import { UIProvider } from '../shared/context/UIContext';
import { ListaTrabalhoProvider } from '../shared/core/listaTrabalho/ListaTrabalhoContext';
import { ConfiguracoesProvider } from '../shared/core/configuracoes/ConfiguracoesContext';
import { NotificacoesProvider } from '../shared/core/notificacoes/NotificacoesContext';
import AppLayout from './AppLayout';

export default function App() {
  return (
    <UIProvider>
      {/* Lista de trabalho global (etiquetar, comprar, conferir...): vale em todas as telas */}
      <ConfiguracoesProvider>
        {/* Notificações calculadas dos dados (notas, estoque, PIM, preços) para o sino do cabeçalho */}
        <NotificacoesProvider>
          <ListaTrabalhoProvider>
            <BrowserRouter>
              <AppLayout />
            </BrowserRouter>
          </ListaTrabalhoProvider>
        </NotificacoesProvider>
      </ConfiguracoesProvider>
    </UIProvider>
  );
}
