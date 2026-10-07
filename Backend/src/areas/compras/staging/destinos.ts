// Destino de cada linha da NF no estoque: um ou mais depósitos (ex.: 30 graxas = 20 VENDA + 10 ALMOXARIFADO).
// Quantidades na unidade da NF (a mesma da quantidade recebida); a aprovação converte pelo fator de compra.
import { Deposito, depositoPorTipoRecurso, ehDeposito } from '../../estoque/depositos';

export interface DestinoLinha {
  deposito: Deposito;
  quantidade: number;
}

const TOLERANCIA = 0.0001;

/**
 * Destinos gravados no mapeamento (mapeamento_json.destinos); sem eles, tudo vai para o depósito
 * do tipo do item (produto -> VENDA, consumo -> ALMOXARIFADO, ativo -> PATRIMONIO).
 */
export const lerDestinos = (
  destinosSalvos: unknown,
  quantidadeRecebida: number,
  tipoRecurso: string | null | undefined
): DestinoLinha[] => {
  const lista = Array.isArray(destinosSalvos) ? destinosSalvos : [];
  const validos = lista
    .map((d: any) => ({ deposito: String(d?.deposito || '').toUpperCase(), quantidade: Number(d?.quantidade) }))
    .filter(d => ehDeposito(d.deposito) && Number.isFinite(d.quantidade) && d.quantidade > 0) as DestinoLinha[];
  if (validos.length === 0) {
    const q = Number(quantidadeRecebida) || 0;
    return q > 0 ? [{ deposito: depositoPorTipoRecurso(tipoRecurso), quantidade: q }] : [];
  }
  // Mesmo depósito repetido soma
  const porDeposito = new Map<Deposito, number>();
  for (const d of validos) porDeposito.set(d.deposito, (porDeposito.get(d.deposito) || 0) + d.quantidade);
  return [...porDeposito.entries()].map(([deposito, quantidade]) => ({ deposito, quantidade: Number(quantidade.toFixed(4)) }));
};

/** Problema na divisão (null = ok): a soma precisa ser a quantidade recebida; depósitos e quantidades válidos. */
export const validarDestinos = (destinosSalvos: unknown, quantidadeRecebida: number): string | null => {
  if (destinosSalvos === undefined || destinosSalvos === null) return null;
  if (!Array.isArray(destinosSalvos)) return 'Destinos em formato inválido.';
  if (destinosSalvos.length === 0) return null;
  for (const d of destinosSalvos as any[]) {
    if (!ehDeposito(d?.deposito)) return `Depósito inválido: ${d?.deposito}.`;
    const q = Number(d?.quantidade);
    if (!Number.isFinite(q) || q < 0) return 'Quantidade inválida na divisão.';
  }
  const soma = (destinosSalvos as any[]).reduce((a, d) => a + Number(d.quantidade || 0), 0);
  const recebida = Number(quantidadeRecebida) || 0;
  if (Math.abs(soma - recebida) > TOLERANCIA) {
    return `A divisão soma ${Number(soma.toFixed(4))}, mas foram recebidos ${Number(recebida.toFixed(4))}.`;
  }
  return null;
};

export const vaiParaVenda = (destinos: DestinoLinha[]) => destinos.some(d => d.deposito === 'VENDA');

/**
 * Depósitos que combinam com o tipo de entrada: produto de venda vai para VENDA e pode separar parte
 * para o ALMOXARIFADO (uso interno); consumo/insumo só ALMOXARIFADO; ativo só PATRIMONIO.
 */
export const depositosPermitidos = (tipoRecurso: unknown): Deposito[] => {
  const padrao = depositoPorTipoRecurso(tipoRecurso);
  return padrao === 'VENDA' ? ['VENDA', 'ALMOXARIFADO'] : [padrao];
};

/** Destino incompatível com o tipo (null = ok). Produto de venda precisa mandar algo para VENDA. */
export const destinoIncompativel = (destinosSalvos: unknown, quantidadeRecebida: number, tipoRecurso: unknown): string | null => {
  const destinos = lerDestinos(destinosSalvos, quantidadeRecebida, tipoRecurso as string);
  if (destinos.length === 0) return null;
  const permitidos = depositosPermitidos(tipoRecurso);
  const fora = destinos.find(d => !permitidos.includes(d.deposito));
  if (fora) return `${fora.deposito} não combina com o tipo ${String(tipoRecurso || 'PRODUTO').toUpperCase()}.`;
  if (permitidos.includes('VENDA') && !vaiParaVenda(destinos)) {
    return 'Produto de venda inteiro no almoxarifado: mude o tipo para Consumo ou deixe parte para venda.';
  }
  return null;
};
