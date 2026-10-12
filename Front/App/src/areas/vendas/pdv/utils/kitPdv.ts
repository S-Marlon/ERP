// Kit configurável no PDV: o cliente troca a variação (ex.: bomba 1 CV → 2 CV) ou a quantidade (metros de fio)
// das posições que o kit permite. Preço = preço do kit + diferença (mesma conta do servidor, que confere tudo).

export interface OpcaoKit {
  idItem: number;
  sku: string;
  nome: string;
  grade: string;
  unidade: string;
  preco: number; // por 1 unidade base
  saldo: number;
  servico: boolean;
  podeVenderSemEstoque: boolean;
}

export interface PosicaoKit {
  slot: number;
  quantidadePadrao: number;
  permiteTrocar: boolean;
  permiteAlterarQtd: boolean;
  familia: string;
  padrao: OpcaoKit;
  opcoes: OpcaoKit[];
}

export interface EscolhaKitPdv {
  slot: number;
  idItem: number;
  quantidade: number;
}

const arred4 = (v: number) => Math.round((Number(v) || 0) * 10000) / 10000;
const arred2 = (v: number) => Math.round((Number(v) || 0) * 100) / 100;

export const escolhasPadrao = (posicoes: PosicaoKit[]): EscolhaKitPdv[] =>
  posicoes.map(p => ({ slot: p.slot, idItem: p.padrao.idItem, quantidade: p.quantidadePadrao }));

/** Assinatura igual à do servidor (identifica a configuração da linha). */
export const assinaturaKit = (escolhas: EscolhaKitPdv[]) =>
  escolhas.map(e => `${e.slot}:${e.idItem}:${arred4(e.quantidade)}`).sort().join('|');

/** Chave da linha no carrinho: o mesmo kit com escolhas diferentes vira outra linha. */
export const chaveLinhaKit = (idKit: number, escolhas: EscolhaKitPdv[]) => `kit:${idKit}:${assinaturaKit(escolhas)}`;

/** Diferença de preço por 1 kit, quantos kits dá para montar com as escolhas e o resumo das trocas. */
export const calcularKit = (posicoes: PosicaoKit[], escolhas: EscolhaKitPdv[]) => {
  let ajuste = 0;
  let estoque: number | null = null;
  const trocas: string[] = [];
  for (const p of posicoes) {
    const e = escolhas.find(x => x.slot === p.slot) || { slot: p.slot, idItem: p.padrao.idItem, quantidade: p.quantidadePadrao };
    const escolhida = p.opcoes.find(o => o.idItem === e.idItem) || p.padrao;
    const quantidade = arred4(e.quantidade);
    const igual = escolhida.idItem === p.padrao.idItem && quantidade === p.quantidadePadrao;
    if (!igual) {
      ajuste += arred2(escolhida.preco * quantidade - p.padrao.preco * p.quantidadePadrao);
      trocas.push(quantidade !== p.quantidadePadrao ? `${escolhida.sku} x${String(quantidade).replace('.', ',')}` : escolhida.sku);
    }
    if (!escolhida.servico && !escolhida.podeVenderSemEstoque && quantidade > 0) {
      const n = Math.max(0, Math.floor(arred4(escolhida.saldo / quantidade)));
      estoque = estoque === null ? n : Math.min(estoque, n);
    }
  }
  return { ajuste: arred2(ajuste), estoque, resumo: trocas.join('; '), alterado: trocas.length > 0 };
};
