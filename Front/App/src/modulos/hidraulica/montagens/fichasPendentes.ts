// Fichas das montagens feitas na hora, aguardando a venda: o PDV avisa "erp:venda-concluida" (com o número)
// e elas são gravadas ligadas à venda; "erp:venda-nova" (carrinho descartado/suspenso) as descarta.
import { message } from 'antd';
import { FichaMangueira, montagensApi } from './montagensApi';

const CHAVE = 'modulo-hidraulica-montagens:fichas-pendentes';

export const lerPendentes = (): FichaMangueira[] => {
  try { return JSON.parse(localStorage.getItem(CHAVE) || '[]'); } catch { return []; }
};
const gravar = (lista: FichaMangueira[]) => {
  try { localStorage.setItem(CHAVE, JSON.stringify(lista)); } catch { /* armazenamento indisponível */ }
};

export const adicionarPendente = (f: FichaMangueira) => gravar([...lerPendentes(), f]);
export const limparPendentes = () => gravar([]);

let instalado = false;
/** Liga os ouvintes uma vez (chamado pelo botão do módulo no PDV). */
export const instalarOuvintesDaVenda = () => {
  if (instalado) return;
  instalado = true;
  window.addEventListener('erp:venda-concluida', (e: Event) => {
    const idVenda = Number((e as CustomEvent).detail?.idVenda);
    const fichas = lerPendentes();
    limparPendentes();
    if (!idVenda || fichas.length === 0) return;
    montagensApi.salvarFichasDaVenda(idVenda, fichas)
      .then(() => message.success(`${fichas.length} ficha(s) de montagem guardada(s) na venda ${idVenda}.`))
      .catch(err => message.warning(`Venda gravada, mas as fichas de montagem não: ${err instanceof Error ? err.message : err}`));
  });
  window.addEventListener('erp:venda-nova', () => limparPendentes());
};
