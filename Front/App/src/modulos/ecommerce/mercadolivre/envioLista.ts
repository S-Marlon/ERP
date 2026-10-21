// Filtros e contagens da aba Envio do ML.
import type { LinhaEnvio } from './mercadoLivreApi';

export type FiltroEnvio = 'todos' | 'diferente' | 'semErp' | 'prejuizo' | 'falta';

/** Com a embalagem na conta, a linha que dá lucro hoje passaria a dar prejuízo. */
export const cairiaEmPrejuizo = (l: LinhaEnvio) => l.lucro !== null && l.lucro >= 0 && l.lucroComEmbalagem !== null && l.lucroComEmbalagem < 0;
/** Dá para mandar o pacote do ERP ao anúncio (publicado e diferente ou faltando lá). */
export const podeEnviarPacote = (l: LinhaEnvio) => l.publicado && (l.situacaoPacote === 'DIFERENTE' || l.situacaoPacote === 'FALTA_NO_ML');

export const passaNoFiltroEnvio = (l: LinhaEnvio, f: FiltroEnvio) =>
  f === 'todos' ? true
    : f === 'diferente' ? podeEnviarPacote(l)
      : f === 'semErp' ? l.situacaoPacote === 'SEM_ERP'
        : f === 'prejuizo' ? cairiaEmPrejuizo(l)
          : l.faltas.length > 0;

export const contarEnvio = (linhas: LinhaEnvio[]) => ({
  todos: linhas.length,
  diferente: linhas.filter(podeEnviarPacote).length,
  semErp: linhas.filter(l => l.situacaoPacote === 'SEM_ERP').length,
  prejuizo: linhas.filter(cairiaEmPrejuizo).length,
  falta: linhas.filter(l => l.faltas.length > 0).length,
});
