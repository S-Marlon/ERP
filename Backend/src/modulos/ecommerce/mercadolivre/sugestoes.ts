// Central de sugestões do ML: o que dá para mudar em cada anúncio para custar menos ou lucrar mais (frete grátis abaixo
// de R$ 79, caixa que paga por volume, peso perto de uma faixa mais barata, kit que passa de R$ 79, preço abaixo do alvo,
// peso e medidas do cadastro). Regras puras; os valores de frete vêm da mesma conta conferida com o painel do ML.

export type TipoSugestao = 'FRETE_GRATIS' | 'CAIXA' | 'PESO' | 'KIT' | 'PRECO' | 'CADASTRO';

export interface Sugestao {
  tipo: TipoSugestao;
  idAnuncio: number;
  idLinha: number;
  sku: string;
  titulo: string;
  texto: string;
  economia: number | null;       // R$ a mais por venda (menos custo ou mais lucro); null = sem valor (ex.: cadastro)
  acao: { aba: 'preco' | 'itens'; secao?: 'formas' | 'cenarios' | 'conta' };
}

const r2 = (v: number) => Math.round((Number(v) + Number.EPSILON) * 100) / 100;
const moeda = (v: number) => `R$ ${r2(v).toFixed(2).replace('.', ',')}`;
const LIMITE = 79;
/** Abaixo disto não vale a pena sugerir (diferença de centavos). */
export const ECONOMIA_MINIMA = 0.3;

export interface Caixa { altura: number; largura: number; comprimento: number }

/** Peso volumétrico do ML em gramas (cm³ ÷ 6000 kg = cm³ ÷ 6 g). */
export const pesoVolumetrico = (c: Caixa) => Math.round((c.altura * c.largura * c.comprimento) / 6);

/** Lê "33 cm", "400 g", "0,4 kg" do atributo do ML. Devolve cm ou g. */
export const lerMedidaMl = (texto: string | null | undefined): number | null => {
  const m = String(texto || '').replace(',', '.').match(/([\d.]+)\s*(mm|cm|m|g|kg)?/i);
  if (!m) return null;
  const v = Number(m[1]);
  if (!(v > 0)) return null;
  const u = (m[2] || '').toLowerCase();
  return u === 'mm' ? v / 10 : u === 'm' ? v * 100 : u === 'kg' ? v * 1000 : v;
};

/** Caixa que cobra pelo peso (volumétrico até o peso real): encolhe o lado maior, mantendo os outros dois. */
export const caixaQueCobraPeloPeso = (c: Caixa, pesoRealG: number): Caixa | null => {
  if (pesoVolumetrico(c) <= pesoRealG) return null;
  const lados = [c.comprimento, c.largura, c.altura].sort((a, b) => b - a);
  const maior = Math.floor((pesoRealG * 6) / (lados[1] * lados[2]));
  if (maior < lados[1]) return null;   // só cabe mudando mais de um lado: fica para o operador
  return { comprimento: maior, largura: lados[1], altura: lados[2] };
};

/** Pesos abaixo do cobrado onde costuma mudar a faixa de frete do ML (para testar se ficaria mais barato). */
export const faixasAbaixo = (pesoG: number) => [250, 300, 500, 1000, 2000, 3000, 5000].filter(t => t < pesoG && t >= pesoG * 0.5);

/** Quantas unidades num kit para passar de R$ 79 (frete com o desconto maior); null se passaria de 12. */
export const unidadesParaPassar79 = (preco: number) => {
  if (!(preco > 0) || preco >= LIMITE) return null;
  const n = Math.ceil(LIMITE / preco);
  return n >= 2 && n <= 12 ? n : null;
};

type Base = Pick<Sugestao, 'idAnuncio' | 'idLinha' | 'sku'>;

export const sugestaoFreteGratis = (b: Base, p: { preco: number; freteComGratis: number | null; freteSemGratis: number | null }): Sugestao | null => {
  if (p.preco >= LIMITE || p.freteComGratis === null || p.freteSemGratis === null) return null;
  const economia = r2(p.freteComGratis - p.freteSemGratis);
  if (economia < ECONOMIA_MINIMA) return null;
  return {
    ...b, tipo: 'FRETE_GRATIS', economia, acao: { aba: 'preco', secao: 'cenarios' },
    titulo: 'Frete grátis abaixo de R$ 79 está saindo caro',
    texto: `Com frete grátis você paga ${moeda(p.freteComGratis)} por venda (o frete cheio). Desligando, paga ${moeda(p.freteSemGratis)} (a tarifa de envio do item barato) e o comprador paga o envio. Veja em Clássico × Premium se compensa (pode vender menos).`,
  };
};

export const sugestaoCaixa = (b: Base, p: { caixa: Caixa; pesoRealG: number; freteNoVolume: number | null; freteNoPeso: number | null }): Sugestao | null => {
  const vol = pesoVolumetrico(p.caixa);
  if (vol <= p.pesoRealG || p.freteNoVolume === null || p.freteNoPeso === null) return null;
  const economia = r2(p.freteNoVolume - p.freteNoPeso);
  if (economia < ECONOMIA_MINIMA) return null;
  const nova = caixaQueCobraPeloPeso(p.caixa, p.pesoRealG);
  const { altura: a, largura: l, comprimento: c } = p.caixa;
  return {
    ...b, tipo: 'CAIXA', economia, acao: { aba: 'itens' },
    titulo: 'A embalagem paga por volume, não pelo peso',
    texto: `A caixa de ${c}×${l}×${a} cm conta ${vol} g de volume e o pacote pesa ${Math.round(p.pesoRealG)} g. `
      + (nova ? `Com até ${nova.comprimento}×${nova.largura}×${nova.altura} cm` : 'Numa embalagem menor')
      + ` o ML cobra pelo peso: ${moeda(p.freteNoPeso)} em vez de ${moeda(p.freteNoVolume)}. Só vale se o pacote for mesmo desse tamanho (produto flexível: dobrar ou enrolar).`,
  };
};

export const sugestaoPeso = (b: Base, p: { pesoG: number; frete: number | null; faixas: { pesoG: number; frete: number | null }[] }): Sugestao | null => {
  if (p.frete === null) return null;
  const melhor = p.faixas.filter(f => f.frete !== null && p.frete! - f.frete >= ECONOMIA_MINIMA).sort((x, y) => y.pesoG - x.pesoG)[0];
  if (!melhor) return null;
  return {
    ...b, tipo: 'PESO', economia: r2(p.frete - melhor.frete!), acao: { aba: 'itens' },
    titulo: `O pacote está perto de uma faixa de frete mais barata`,
    texto: `O ML cobra ${Math.round(p.pesoG)} g (${moeda(p.frete)}). Com até ${melhor.pesoG} g o frete cai para ${moeda(melhor.frete!)}. Pese o pacote como ele vai (com a embalagem) e ajuste o peso no cadastro: peso estimado costuma sair maior que o real.`,
  };
};

export const sugestaoKit = (b: Base, p: { preco: number; unidades: number; lucroUnitario: number; lucroDoKit: number; precoKit: number }): Sugestao | null => {
  const porUnidade = r2(p.lucroDoKit / p.unidades);
  const economia = r2(porUnidade - p.lucroUnitario);
  if (economia < ECONOMIA_MINIMA) return null;
  return {
    ...b, tipo: 'KIT', economia, acao: { aba: 'preco', secao: 'formas' },
    titulo: `Kit c/${p.unidades} passa de R$ 79 e o frete fica mais barato`,
    texto: `Kit c/${p.unidades} a ${moeda(p.precoKit)}: lucro de ${moeda(porUnidade)} por unidade (hoje ${moeda(p.lucroUnitario)}). Acima de R$ 79 o frete grátis tem o desconto maior do ML. Crie em Formas de venda.`,
  };
};

export const sugestaoPreco = (b: Base, p: { preco: number; lucro: number; pct: number | null; nivel: string; precoAlvo: number | null; lucroNoAlvo: number | null; alvoPct: number }): Sugestao | null => {
  if (!['PREJUIZO', 'BAIXO'].includes(p.nivel) || p.precoAlvo === null || !(p.precoAlvo > p.preco)) return null;
  return {
    ...b, tipo: 'PRECO', economia: p.lucroNoAlvo !== null ? r2(p.lucroNoAlvo - p.lucro) : null, acao: { aba: 'preco', secao: 'conta' },
    titulo: p.nivel === 'PREJUIZO' ? 'Vendendo com prejuízo' : 'Lucro abaixo do alvo',
    texto: `A ${moeda(p.preco)} o lucro é ${moeda(p.lucro)}${p.pct !== null ? ` (${p.pct.toFixed(1).replace('.', ',')}% sobre o custo)` : ''}. Para ${p.alvoPct}% o preço mínimo é ${moeda(p.precoAlvo)}. Antes de subir, veja as sugestões de frete deste item.`,
  };
};

export const sugestaoCadastro = (b: Base, p: {
  pesoErpG: number | null; caixaErp: Caixa | null; pesoMlG: number | null; caixaMl: Caixa | null;
}): Sugestao | null => {
  const textoCaixa = (c: Caixa | null) => (c ? `${c.comprimento}×${c.largura}×${c.altura} cm` : '—');
  if (p.pesoErpG === null || p.caixaErp === null) {
    if (p.pesoMlG === null && p.caixaMl === null) return null;
    return {
      ...b, tipo: 'CADASTRO', economia: null, acao: { aba: 'itens' },
      titulo: 'Cadastro sem peso ou medidas da embalagem',
      texto: `O ERP não tem ${p.pesoErpG === null ? 'o peso' : 'as medidas'} deste item; o ML usa ${p.pesoMlG ?? '—'} g · ${textoCaixa(p.caixaMl)}. Preencha com o pacote real (coluna Cadastro em Itens e estoque) para o frete do ERP e do ML serem o mesmo.`,
    };
  }
  const difPeso = p.pesoMlG !== null && Math.abs(p.pesoErpG - p.pesoMlG) > Math.max(20, p.pesoMlG * 0.1);
  const difCaixa = !!p.caixaMl && pesoVolumetrico(p.caixaErp) !== pesoVolumetrico(p.caixaMl);
  if (!difPeso && !difCaixa) return null;
  return {
    ...b, tipo: 'CADASTRO', economia: null, acao: { aba: 'itens' },
    titulo: 'Peso ou medidas diferentes entre o ERP e o ML',
    texto: `ERP: ${p.pesoErpG} g · ${textoCaixa(p.caixaErp)}. ML: ${p.pesoMlG ?? '—'} g · ${textoCaixa(p.caixaMl)}. Confira o pacote e use "Enviar atributos, fotos e descrição" para o ML ficar com o do ERP.`,
  };
};

const ORDEM: Record<TipoSugestao, number> = { PRECO: 0, FRETE_GRATIS: 1, KIT: 2, CAIXA: 3, PESO: 4, CADASTRO: 5 };

/** Mais economia primeiro; sem valor (cadastro) no fim. */
export const ordenarSugestoes = (lista: Sugestao[]) =>
  [...lista].sort((a, b) => (b.economia ?? -1) - (a.economia ?? -1) || ORDEM[a.tipo] - ORDEM[b.tipo]);
