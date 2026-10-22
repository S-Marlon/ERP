// Obras de poços › orçamento, sinal e cobrança (etapa 3): regras puras. O sinal pode ser pago ANTES (libera o início
// da obra) ou NO_ATO da perfuração; adicionais só entram no saldo depois de aprovados pelo cliente (meio e data
// registrados); o saldo vira parcelas (com ou sem vencimento) a receber no próprio módulo, porque os clientes de poço
// não estão no cadastro geral. Parcelas, baixa e estorno usam as mesmas regras do contas a receber da loja.
import { ErroObra } from './obras';

const c = (v: number) => Math.round((Number(v) || 0) * 100);
const r = (v: number) => v / 100;

export const TIPOS_ADICIONAL = ['METRO_EXCEDENTE', 'MATERIAL', 'SERVICO', 'OUTRO'] as const;
export const SITUACOES_ADICIONAL = ['PENDENTE', 'APROVADO', 'RECUSADO', 'CANCELADO'] as const;
export const MEIOS_APROVACAO = ['MENSAGEM', 'ASSINATURA', 'PRESENCIAL', 'TELEFONE'] as const;
export const SINAL_QUANDO = ['ANTES', 'NO_ATO'] as const;
export type SituacaoAdicional = typeof SITUACOES_ADICIONAL[number];

const texto = (v: unknown, max: number) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max) || null;
const positivo = (v: unknown, nome: string) => {
  const n = Number(String(v ?? '').replace(',', '.'));
  if (!Number.isFinite(n) || n <= 0) throw new ErroObra(`${nome}: informe um número maior que zero.`);
  return n;
};

/** Adicional: quantidade × valor unitário (arredondado nos centavos). */
export const validarAdicional = (b: any) => {
  const tipo = String(b?.tipo || 'SERVICO').toUpperCase();
  if (!(TIPOS_ADICIONAL as readonly string[]).includes(tipo)) throw new ErroObra(`Tipo de adicional inválido: ${b?.tipo}.`);
  const descricao = texto(b?.descricao, 150);
  if (!descricao) throw new ErroObra('Descreva o adicional (ex.: 12 m excedentes, conexão extra).');
  const quantidade = Math.round(positivo(b?.quantidade ?? 1, 'Quantidade') * 10000) / 10000;
  const valorUnitario = r(c(positivo(b?.valorUnitario, 'Valor')));
  return { tipo, descricao, quantidade, valorUnitario, valor: r(Math.round(quantidade * c(valorUnitario))) };
};

/** A aprovação do cliente: o meio é obrigatório (é a prova de que ele concordou). */
export const validarAprovacao = (b: any) => {
  const meio = String(b?.meio || '').toUpperCase();
  if (!(MEIOS_APROVACAO as readonly string[]).includes(meio)) throw new ErroObra('Diga como o cliente aprovou: mensagem, assinatura, presencial ou telefone.');
  return { meio, observacao: texto(b?.observacao, 255) };
};

/** Quem pode ir para onde (o aprovado ainda pode ser cancelado; recusado/cancelado voltam a pendente para rever). */
const PASSAGENS_ADICIONAL: Record<SituacaoAdicional, SituacaoAdicional[]> = {
  PENDENTE: ['APROVADO', 'RECUSADO', 'CANCELADO'],
  APROVADO: ['CANCELADO'],
  RECUSADO: ['PENDENTE'],
  CANCELADO: ['PENDENTE'],
};
export const adicionalPodeIr = (de: SituacaoAdicional, para: SituacaoAdicional) => PASSAGENS_ADICIONAL[de]?.includes(para) ?? false;

export interface ParcelaObra { tipo: 'SINAL' | 'SALDO'; valor: number; valorPago: number; status: 'ABERTO' | 'PAGO' | 'CANCELADO' }

/**
 * A conta da obra: contratado + adicionais aprovados = total; o que já foi recebido; o que está em parcelas e o que
 * ainda não foi parcelado (o saldo que falta lançar). Valores em reais, somados em centavos.
 */
export const resumoCobranca = (o: { valorContratado: number | null; valorSinal: number | null }, adicionais: { valor: number; situacao: string }[], parcelas: ParcelaObra[]) => {
  const soma = (xs: number[]) => xs.reduce((s, x) => s + c(x), 0);
  const aprovados = soma(adicionais.filter(a => a.situacao === 'APROVADO').map(a => a.valor));
  const pendentes = soma(adicionais.filter(a => a.situacao === 'PENDENTE').map(a => a.valor));
  const validas = parcelas.filter(p => p.status !== 'CANCELADO');
  const total = c(o.valorContratado ?? 0) + aprovados;
  const recebido = soma(validas.map(p => p.valorPago));
  const parcelado = soma(validas.map(p => p.valor));
  const sinal = validas.find(p => p.tipo === 'SINAL');
  return {
    contratado: r(c(o.valorContratado ?? 0)), adicionaisAprovados: r(aprovados), adicionaisPendentes: r(pendentes), total: r(total),
    sinal: r(c(o.valorSinal ?? 0)), sinalPago: sinal ? sinal.status === 'PAGO' : false,
    recebido: r(recebido), aReceber: r(total - recebido), parcelado: r(parcelado), semParcela: r(total - parcelado),
  };
};

/**
 * O sinal libera o início? Sem sinal ou "no ato da perfuração": libera. "Antes": só com a parcela do sinal paga.
 * Devolve a mensagem que impede o início, ou null.
 */
export const bloqueioDoSinal = (valorSinal: number | null, sinalQuando: string, parcelaSinal: Pick<ParcelaObra, 'status' | 'valor' | 'valorPago'> | null) => {
  if (!(c(valorSinal ?? 0) > 0) || sinalQuando === 'NO_ATO') return null;
  if (parcelaSinal?.status === 'PAGO') return null;
  const falta = parcelaSinal ? r(c(parcelaSinal.valor) - c(parcelaSinal.valorPago)) : r(c(valorSinal ?? 0));
  return `A obra só começa com o sinal recebido (faltam R$ ${falta.toFixed(2).replace('.', ',')}). Receba o sinal ou marque "sinal no ato da perfuração".`;
};

/**
 * O que fazer com a parcela do sinal quando a obra muda o valor do sinal: criar, atualizar o valor, cancelar ou nada.
 * Sinal com pagamento não pode baixar abaixo do que já foi pago nem ser tirado (estorne antes).
 */
export const acertoDoSinal = (valorSinal: number | null, parcela: { idParcela: number; valor: number; valorPago: number; status: string } | null):
  { acao: 'NADA' } | { acao: 'CRIAR'; valor: number } | { acao: 'ATUALIZAR'; idParcela: number; valor: number; status: 'ABERTO' | 'PAGO' } | { acao: 'CANCELAR'; idParcela: number } => {
  const novo = c(valorSinal ?? 0);
  const ativa = parcela && parcela.status !== 'CANCELADO' ? parcela : null;
  if (!ativa) return novo > 0 ? { acao: 'CRIAR', valor: r(novo) } : { acao: 'NADA' };
  const pago = c(ativa.valorPago);
  if (novo <= 0) {
    if (pago > 0) throw new ErroObra('O sinal já tem pagamento: estorne o recebimento antes de tirar o sinal.', 409);
    return { acao: 'CANCELAR', idParcela: ativa.idParcela };
  }
  if (novo === c(ativa.valor)) return { acao: 'NADA' };
  if (novo < pago) throw new ErroObra(`O sinal não pode ficar menor que o já recebido (R$ ${r(pago).toFixed(2).replace('.', ',')}).`, 409);
  return { acao: 'ATUALIZAR', idParcela: ativa.idParcela, valor: r(novo), status: novo <= pago ? 'PAGO' : 'ABERTO' };
};

/**
 * Sugestão do adicional de metro excedente: metros perfurados (relatório) além dos previstos × valor do metro.
 * null quando não passou, quando falta dado ou quando já existe um adicional de metro excedente ativo.
 */
export const sugestaoExcedente = (metrosPrevistos: number | null, metrosPerfurados: number | null, valorMetro: number | null, jaTem: boolean) => {
  if (jaTem || !metrosPrevistos || !metrosPerfurados || !valorMetro) return null;
  const excedente = Math.round((metrosPerfurados - metrosPrevistos) * 100) / 100;
  if (excedente <= 0) return null;
  return {
    tipo: 'METRO_EXCEDENTE' as const, quantidade: excedente, valorUnitario: r(c(valorMetro)), valor: r(Math.round(excedente * c(valorMetro))),
    descricao: `${String(excedente).replace('.', ',')} m excedentes (perfurado ${String(metrosPerfurados).replace('.', ',')} m, previsto ${String(metrosPrevistos).replace('.', ',')} m)`,
  };
};

/** Texto da parcela no caixa e nas listas: "Obra 12 · sinal" / "Obra 12 · saldo 2/3". */
export const descricaoParcela = (idObra: number, tipo: 'SINAL' | 'SALDO', parcela: number, total: number) =>
  `Obra ${idObra} · ${tipo === 'SINAL' ? 'sinal' : total > 1 ? `saldo ${parcela}/${total}` : 'saldo'}`;
