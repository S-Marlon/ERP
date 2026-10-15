// Junta as pendências repetidas por item ("X: sem foto" em 25 itens vira uma linha com os 25 SKUs).
import type { Pendencia } from './mercadoLivreApi';

export interface PendenciaAgrupada {
  nivel: Pendencia['nivel'];
  area: Pendencia['area'];
  texto: string;
  skus: string[];
  idLinhas: number[];          // linhas do anúncio (item + unidade) que a pendência atinge
  atributo?: string;
}

export const agruparPendencias = (pendencias: Pendencia[], skuDaLinha: Map<number, string>): PendenciaAgrupada[] => {
  const grupos = new Map<string, PendenciaAgrupada>();
  for (const p of pendencias) {
    const linha = p.idLinha ?? p.idItem;
    const sku = linha !== undefined ? skuDaLinha.get(linha) : undefined;
    const prefixo = sku ? `${sku}: ` : null;
    const texto = prefixo && p.texto.startsWith(prefixo) ? p.texto.slice(prefixo.length) : p.texto;
    const chave = `${p.nivel}|${p.area}|${texto}`;
    const g = grupos.get(chave) || { nivel: p.nivel, area: p.area, texto, skus: [], idLinhas: [], atributo: p.atributo };
    if (sku && texto !== p.texto) { g.skus.push(sku); g.idLinhas.push(linha!); }
    grupos.set(chave, g);
  }
  // erros primeiro; dentro do nível, o que atinge mais itens antes
  return [...grupos.values()].sort((a, b) => Number(a.nivel === 'aviso') - Number(b.nivel === 'aviso') || b.skus.length - a.skus.length);
};

export const textoComPrimeiraMaiuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
