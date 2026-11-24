// Obras de poços › custos reais da obra além dos materiais (tabela modulo_hidraulica_pocos_obras_custos): horas da
// equipe e km rodados (quantidade × custo congelado no lançamento) e lançamentos só em R$ (diesel da sonda, desgaste
// de broca/martelo, despesas, transporte das máquinas, visita técnica, terceiros). Regras puras, com teste.
import { ErroObra } from './obras';

export const TIPOS_CUSTO = ['EQUIPE', 'KM', 'COMBUSTIVEL', 'DESGASTE', 'DESPESA', 'TRANSPORTE', 'VISITA', 'TERCEIRO', 'OUTRO'] as const;
export type TipoCusto = typeof TIPOS_CUSTO[number];
/** Tipos lançados por quantidade (horas ou km) × custo unitário. */
export const POR_QUANTIDADE: TipoCusto[] = ['EQUIPE', 'KM'];

const r2 = (v: number) => Math.round(v * 100) / 100;
const num = (v: unknown, nome: string, max = 1e9) => {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(String(v).replace(',', '.'));
  if (!Number.isFinite(n) || n < 0 || n > max) throw new ErroObra(`${nome}: número inválido.`);
  return Math.round(n * 10000) / 10000;
};

export interface CustoReal { data: string; tipo: TipoCusto; descricao: string | null; quantidade: number | null; valorUnitario: number | null; valor: number }

/** Horas e km: quantidade × custo (o valor sai da conta). Os demais: só o valor em R$. */
export const validarCustoReal = (b: any): CustoReal => {
  const tipo = String(b?.tipo || '').toUpperCase() as TipoCusto;
  if (!TIPOS_CUSTO.includes(tipo)) throw new ErroObra(`Tipo de custo inválido: ${b?.tipo || 'vazio'}.`);
  const data = String(b?.data || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || Number.isNaN(new Date(`${data}T12:00:00`).getTime())) throw new ErroObra('Data inválida.');
  const descricao = String(b?.descricao ?? '').replace(/\s+/g, ' ').trim().slice(0, 150) || null;
  if (POR_QUANTIDADE.includes(tipo)) {
    const quantidade = num(b?.quantidade, tipo === 'EQUIPE' ? 'Horas' : 'Km', 100000);
    const valorUnitario = num(b?.valorUnitario, tipo === 'EQUIPE' ? 'Custo da hora' : 'Custo do km', 1e6);
    if (!quantidade) throw new ErroObra(tipo === 'EQUIPE' ? 'Informe as horas.' : 'Informe os km.');
    if (valorUnitario === null) throw new ErroObra(tipo === 'EQUIPE' ? 'Informe o custo da hora.' : 'Informe o custo do km.');
    return { data, tipo, descricao, quantidade, valorUnitario, valor: r2(quantidade * valorUnitario) };
  }
  const valor = num(b?.valor, 'Valor');
  if (!valor) throw new ErroObra('Informe o valor.');
  if (tipo === 'OUTRO' && !descricao) throw new ErroObra('Diga o que foi o custo.');
  return { data, tipo, descricao, quantidade: null, valorUnitario: null, valor: r2(valor) };
};
