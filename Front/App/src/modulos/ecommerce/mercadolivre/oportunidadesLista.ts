// Filtros e contagens da aba Oportunidades (itens do catálogo que ainda não estão no ML).
import type { Oportunidade } from './mercadoLivreApi';

export type FiltroOportunidade = 'todos' | 'balcao' | 'prontos' | 'familia';

const normalizar = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export const passaNaOportunidade = (o: Oportunidade, f: { filtro: FiltroOportunidade; somenteEstoque: boolean; busca: string }) => {
  if (f.somenteEstoque && !(o.estoque > 0)) return false;
  if (f.filtro === 'balcao' && !(o.vendidos90 > 0)) return false;
  if (f.filtro === 'prontos' && o.situacao !== 'PRONTO') return false;
  if (f.filtro === 'familia' && !o.familiaNoMl) return false;
  const termos = normalizar(f.busca.trim()).split(/\s+/).filter(Boolean);
  if (!termos.length) return true;
  const texto = normalizar(`${o.sku} ${o.nome} ${o.familia || ''} ${o.marca || ''}`);
  return termos.every(t => texto.includes(t));
};

/** Contagens dos filtros (respeitam o "só com estoque"). */
export const contarOportunidades = (lista: Oportunidade[], somenteEstoque: boolean) => {
  const base = somenteEstoque ? lista.filter(o => o.estoque > 0) : lista;
  return {
    todos: base.length,
    balcao: base.filter(o => o.vendidos90 > 0).length,
    prontos: base.filter(o => o.situacao === 'PRONTO').length,
    familia: base.filter(o => !!o.familiaNoMl).length,
    semFoto: base.filter(o => o.faltas.some(f => f.texto === 'sem foto')).length,
    semPeso: base.filter(o => !o.pesoKg || !o.medidas).length,
  };
};
