// Obras de poços › materiais da obra (etapa 4): regras puras. Cadastro próprio do módulo (não usa o catálogo nem o
// estoque da loja); cada obra tem o previsto e o usado, com o custo congelado na linha (o custo real da obra). Material
// cobrado à parte vira adicional da obra (aprovado pelo cliente como os outros).
import { ErroObra } from './obras';

export const CATEGORIAS_MATERIAL = ['TUBO', 'FILTRO', 'BOMBA', 'CABO', 'CONEXAO', 'PRE_FILTRO', 'QUIMICO', 'OUTRO'] as const;
export const UNIDADES_MATERIAL = ['m', 'un', 'kg', 'sc', 'L'] as const;

const c = (v: number) => Math.round((Number(v) || 0) * 100);
const r = (v: number) => v / 100;
const texto = (v: unknown, max: number) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max) || null;
const naoNegativo = (v: unknown, nome: string, vazio: number | null = 0) => {
  if (v === undefined || v === null || v === '') return vazio;
  const n = Number(String(v).replace(',', '.'));
  if (!Number.isFinite(n) || n < 0) throw new ErroObra(`${nome}: número inválido.`);
  return Math.round(n * 10000) / 10000;
};
const unidade = (v: unknown) => {
  const u = String(v ?? '').trim();
  const achada = UNIDADES_MATERIAL.find(x => x.toLowerCase() === u.toLowerCase());
  if (u && !achada) throw new ErroObra(`Unidade inválida: ${u} (use ${UNIDADES_MATERIAL.join(', ')}).`);
  return achada || 'un';
};

export const validarMaterial = (b: any) => {
  const nome = texto(b?.nome, 120);
  if (!nome) throw new ErroObra('Dê um nome ao material (ex.: Tubo geomecânico 6").');
  const categoria = String(b?.categoria || 'OUTRO').toUpperCase();
  if (!(CATEGORIAS_MATERIAL as readonly string[]).includes(categoria)) throw new ErroObra(`Categoria inválida: ${b?.categoria}.`);
  const cor = String(b?.cor ?? '').trim();
  if (cor && !/^#[0-9a-f]{6}$/i.test(cor)) throw new ErroObra('Cor inválida (use #RRGGBB).');
  const comprimentoM = naoNegativo(b?.comprimentoM, 'Comprimento da barra', null);
  if (comprimentoM !== null && comprimentoM > 100) throw new ErroObra('Comprimento da barra: no máximo 100 m.');
  return {
    nome, categoria, unidade: unidade(b?.unidade), custo: naoNegativo(b?.custo, 'Custo') as number,
    precoVenda: naoNegativo(b?.precoVenda, 'Preço de venda', null), observacao: texto(b?.observacao, 255), ativo: b?.ativo === false || b?.ativo === 0 ? 0 : 1,
    // dados técnicos (desenho do poço e contas de barras)
    diametro: texto(b?.diametro, 20), comprimentoM: comprimentoM || null, marca: texto(b?.marca, 60), classe: texto(b?.classe, 20), cor: cor ? cor.toLowerCase() : null,
  };
};

/** Linha de material da obra: do cadastro (idMaterial) ou avulsa (descrição); usada vazia = ainda não conferida. */
export const validarLinha = (b: any) => {
  const idMaterial = Number(b?.idMaterial) > 0 ? Number(b.idMaterial) : null;
  const descricao = texto(b?.descricao, 120);
  if (!idMaterial && !descricao) throw new ErroObra('Escolha o material ou descreva o item avulso.');
  return {
    idMaterial, descricao, unidade: b?.unidade ? unidade(b.unidade) : null,
    qtdPrevista: naoNegativo(b?.qtdPrevista, 'Quantidade prevista') as number, qtdUsada: naoNegativo(b?.qtdUsada, 'Quantidade usada', null),
    custoUnitario: naoNegativo(b?.custoUnitario, 'Custo', null), observacao: texto(b?.observacao, 255),
  };
};

export interface LinhaMaterial { qtdPrevista: number; qtdUsada: number | null; custoUnitario: number }

/** Total de uma quantidade × custo (o custo tem 4 casas), arredondado nos centavos só no total da linha, antes de somar. */
export const totalLinha = (qtd: number | null, custo: number) => (qtd === null ? null : r(Math.round(Number(qtd) * Number(custo) * 100)));

/**
 * Previsto × real: o custo previsto soma todas as linhas; o real soma só as conferidas (com a quantidade usada). Enquanto
 * houver linha não conferida, o real é parcial.
 */
export const resumoMateriais = (linhas: LinhaMaterial[]) => {
  const prev = linhas.reduce((s, l) => s + c(totalLinha(l.qtdPrevista, l.custoUnitario) ?? 0), 0);
  const conferidas = linhas.filter(l => l.qtdUsada !== null);
  const real = conferidas.reduce((s, l) => s + c(totalLinha(l.qtdUsada, l.custoUnitario) ?? 0), 0);
  return {
    linhas: linhas.length, conferidas: conferidas.length, custoPrevisto: r(prev), custoReal: r(real),
    completo: linhas.length > 0 && conferidas.length === linhas.length, diferenca: conferidas.length === linhas.length ? r(real - prev) : null,
  };
};

/**
 * O adicional de um material cobrado à parte: a quantidade usada (ou a prevista, se ainda não conferido) × o preço.
 * O preço vem do pedido ou do preço de venda do cadastro.
 */
export const adicionalDoMaterial = (l: { descricao: string; unidade: string; qtdPrevista: number; qtdUsada: number | null }, preco: number | null) => {
  const quantidade = l.qtdUsada ?? l.qtdPrevista;
  if (!(quantidade > 0)) throw new ErroObra('Informe a quantidade do material antes de cobrar.');
  if (preco === null || !(preco > 0)) throw new ErroObra('Informe o preço para cobrar o material (ou o preço de venda no cadastro).');
  return { tipo: 'MATERIAL' as const, descricao: `${l.descricao} (${String(quantidade).replace('.', ',')} ${l.unidade})`.slice(0, 150), quantidade, valorUnitario: r(c(preco)) };
};
