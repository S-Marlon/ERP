// Depósitos de estoque (mesma regra do backend: EstoqueItens/depositos.ts) — sem dependência de tela.
export type Deposito = 'VENDA' | 'ALMOXARIFADO' | 'PATRIMONIO';
export interface DestinoLinha { deposito: Deposito; quantidade: number }

export const DEPOSITOS: Record<Deposito, { label: string; color: string; ajuda: string }> = {
  VENDA: { label: 'Venda', color: 'green', ajuda: 'Disponível no PDV' },
  ALMOXARIFADO: { label: 'Almoxarifado', color: 'orange', ajuda: 'Uso e consumo interno (não aparece no PDV)' },
  PATRIMONIO: { label: 'Patrimônio', color: 'purple', ajuda: 'Ativo da empresa (não aparece no PDV)' },
};

export const depositoPadraoDoTipo = (tipo?: string | null): Deposito => {
  const t = String(tipo || '').toUpperCase();
  if (t === 'CONSUMO' || t === 'INSUMO') return 'ALMOXARIFADO';
  if (t === 'ATIVO') return 'PATRIMONIO';
  return 'VENDA';
};

// Depósitos que combinam com o tipo (mesma regra do backend: staging/destinos.ts):
// produto de venda vai para VENDA e pode separar parte para o ALMOXARIFADO; consumo/insumo só ALMOXARIFADO; ativo só PATRIMONIO
export const depositosPermitidos = (tipo?: string | null): Deposito[] => {
  const padrao = depositoPadraoDoTipo(tipo);
  return padrao === 'VENDA' ? ['VENDA', 'ALMOXARIFADO'] : [padrao];
};
export const podeSepararUsoInterno = (tipo?: string | null) => depositoPadraoDoTipo(tipo) === 'VENDA';

// Destino salvo que não combina mais com o tipo (ex.: tipo trocado depois da divisão)
export const destinoIncompativel = (destinos: DestinoLinha[] | null | undefined, tipo?: string | null): boolean => {
  if (!destinos || destinos.length === 0) return false;
  const permitidos = depositosPermitidos(tipo);
  if (destinos.some(d => !permitidos.includes(d.deposito))) return true;
  return permitidos.includes('VENDA') && !destinos.some(d => d.deposito === 'VENDA' && d.quantidade > 0);
};

// Destinos efetivos da linha (os salvos ou o padrão do tipo com a quantidade recebida)
export const destinosEfetivos = (destinos: DestinoLinha[] | null | undefined, recebida: number, tipo?: string | null): DestinoLinha[] =>
  destinos && destinos.length > 0 ? destinos : [{ deposito: depositoPadraoDoTipo(tipo), quantidade: recebida }];
