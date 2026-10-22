// API do Gestor de frotas (/api/modulos/logistica/frota).
import { API_URL } from '../../../shared/api/config';

const API = `${API_URL}/api/modulos/logistica/frota`;

export type TipoVeiculo = 'CARRO' | 'UTILITARIO' | 'CAMINHAO' | 'MOTO' | 'OUTRO';
export type Combustivel = 'GASOLINA' | 'ETANOL' | 'FLEX' | 'DIESEL' | 'GNV' | 'ELETRICO';
export type SituacaoVeiculo = 'EM_USO' | 'MANUTENCAO' | 'PARADO' | 'VENDIDO';

export interface VeiculoForm {
  placa: string; apelido: string | null; tipo: TipoVeiculo; marca: string | null; modelo: string | null;
  anoFabricacao: number | null; anoModelo: number | null; cor: string | null; renavam: string | null; chassi: string | null;
  combustivel: Combustivel; tanqueLitros: number | null; cargaKg: number | null; situacao: SituacaoVeiculo; observacao: string | null;
}
export interface Veiculo extends VeiculoForm { idVeiculo: number; placaFormatada: string; kmAtual: number; kmAtualizadoEm: string | null }

export const TIPOS: Record<TipoVeiculo, string> = { CARRO: 'Carro', UTILITARIO: 'Utilitário', CAMINHAO: 'Caminhão', MOTO: 'Moto', OUTRO: 'Outro' };
export const COMBUSTIVEIS: Record<Combustivel, string> = { GASOLINA: 'Gasolina', ETANOL: 'Etanol', FLEX: 'Flex', DIESEL: 'Diesel', GNV: 'GNV', ELETRICO: 'Elétrico' };
export const SITUACOES: Record<SituacaoVeiculo, { texto: string; cor: string }> = {
  EM_USO: { texto: 'Em uso', cor: 'green' }, MANUTENCAO: { texto: 'Em manutenção', cor: 'orange' },
  PARADO: { texto: 'Parado', cor: 'default' }, VENDIDO: { texto: 'Vendido', cor: 'default' },
};

const pedir = async <T,>(url: string, init: RequestInit | undefined, padrao: string): Promise<T> => {
  const r = await fetch(url, init);
  const d = await r.json().catch(() => ({}));
  if (r.status === 404 && !d.error) throw new Error('Rota não encontrada: reinicie o backend.');
  if (!r.ok) throw new Error(d.error || padrao);
  return d as T;
};
const corpo = (method: string, dados: unknown): RequestInit => ({ method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dados) });

export const frotaApi = {
  veiculos: (f: { situacao?: string; busca?: string } = {}) => {
    const q = new URLSearchParams({ tenant_id: '1' });
    if (f.situacao) q.set('situacao', f.situacao);
    if (f.busca?.trim()) q.set('busca', f.busca.trim());
    return pedir<Veiculo[]>(`${API}/veiculos?${q}`, undefined, 'Erro ao listar os veículos.');
  },
  criarVeiculo: (v: VeiculoForm & { kmAtual: number | null }) => pedir<Veiculo>(`${API}/veiculos?tenant_id=1`, corpo('POST', v), 'Erro ao cadastrar o veículo.'),
  salvarVeiculo: (id: number, v: VeiculoForm) => pedir<Veiculo>(`${API}/veiculos/${id}?tenant_id=1`, corpo('PUT', v), 'Erro ao salvar o veículo.'),
  ajustarKm: (id: number, km: number, corrigir: boolean) => pedir<Veiculo>(`${API}/veiculos/${id}/km?tenant_id=1`, corpo('POST', { km, corrigir }), 'Erro ao ajustar o km.'),
};

/** Contagem da frota por situação (os vendidos ficam fora do total). */
export const resumoFrota = (v: Veiculo[]) => ({
  total: v.filter(x => x.situacao !== 'VENDIDO').length,
  emUso: v.filter(x => x.situacao === 'EM_USO').length,
  manutencao: v.filter(x => x.situacao === 'MANUTENCAO').length,
  parados: v.filter(x => x.situacao === 'PARADO').length,
  kmTotal: v.filter(x => x.situacao !== 'VENDIDO').reduce((a, x) => a + x.kmAtual, 0),
});
