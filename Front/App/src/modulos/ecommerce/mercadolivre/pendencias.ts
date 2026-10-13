// Junta as pendências repetidas por item ("X: sem foto" em 25 itens vira uma linha com os 25 SKUs).
import type { Pendencia } from './mercadoLivreApi';

export interface PendenciaAgrupada {
  nivel: Pendencia['nivel'];
  area: Pendencia['area'];
  texto: string;
  skus: string[];
  idItens: number[];
  atributo?: string;
}

export const agruparPendencias = (pendencias: Pendencia[], skuDoItem: Map<number, string>): PendenciaAgrupada[] => {
  const grupos = new Map<string, PendenciaAgrupada>();
  for (const p of pendencias) {
    const sku = p.idItem !== undefined ? skuDoItem.get(p.idItem) : undefined;
    const prefixo = sku ? `${sku}: ` : null;
    const texto = prefixo && p.texto.startsWith(prefixo) ? p.texto.slice(prefixo.length) : p.texto;
    const chave = `${p.nivel}|${p.area}|${texto}`;
    const g = grupos.get(chave) || { nivel: p.nivel, area: p.area, texto, skus: [], idItens: [], atributo: p.atributo };
    if (sku && texto !== p.texto) { g.skus.push(sku); g.idItens.push(p.idItem!); }
    grupos.set(chave, g);
  }
  // erros primeiro; dentro do nível, o que atinge mais itens antes
  return [...grupos.values()].sort((a, b) => Number(a.nivel === 'aviso') - Number(b.nivel === 'aviso') || b.skus.length - a.skus.length);
};

export const textoComPrimeiraMaiuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
