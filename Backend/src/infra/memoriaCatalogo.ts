// Memória de leituras pesadas do catálogo (lista do PDV, lista de produtos do catálogo): o resultado fica guardado e só é
// montado de novo quando alguma das tabelas de que ele depende muda. A conferência é um CHECKSUM TABLE (uma ida ao banco,
// ~20 ms, sem trazer dados), bem mais barata que reler milhares de linhas do banco remoto a cada tela aberta.
import pool from './db';

/** Carimbo das tabelas: muda quando qualquer linha delas muda. */
export const carimboDasTabelas = async (tabelas: string[]) => {
  const [r]: any = await pool.query(`CHECKSUM TABLE ${tabelas.join(', ')}`);
  return r.map((x: any) => `${x.Checksum}`).join('.');
};

/**
 * Cria uma memória que depende das `tabelas`. `obter(chave, montar)` devolve o guardado se o carimbo não mudou; senão
 * monta (uma vez só, mesmo com várias telas pedindo ao mesmo tempo). `forcar` monta de novo de qualquer jeito.
 */
export const memoriaPorCarimbo = <T>(tabelas: string[]) => {
  const guardado = new Map<string, { carimbo: string; valor: T }>();
  const montando = new Map<string, Promise<T>>();
  return async (chave: string, montar: () => Promise<T>, forcar = false): Promise<T> => {
    const carimbo = await carimboDasTabelas(tabelas);
    const atual = guardado.get(chave);
    if (atual && atual.carimbo === carimbo && !forcar) return atual.valor;
    let p = montando.get(chave);
    if (!p) {
      p = montar().then(valor => { guardado.set(chave, { carimbo, valor }); return valor; }).finally(() => montando.delete(chave));
      montando.set(chave, p);
    }
    return p;
  };
};
