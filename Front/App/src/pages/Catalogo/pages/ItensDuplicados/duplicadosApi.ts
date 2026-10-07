import { API_URL } from '../../../../shared/api/config';
const API = `${API_URL}/api/catalogo`;

export interface ItemSuspeito {
  idItem: number;
  sku: string;
  nome: string;
  status: string;
  tipoRecurso: string;
  unidadeBase: string | null;
  familia: string | null;
  saldo: number;
  movimentos: number;
  criadoEm: string;
}

export interface GrupoSuspeito {
  chave: string;
  motivo: 'MESMO_CODIGO_FORNECEDOR' | 'NOME_IGUAL';
  descricao: string;
  itens: ItemSuspeito[];
}

export interface ResultadoUnificacao {
  simulacao: boolean;
  message: string;
  origem: ItemSuspeito;
  destino: ItemSuspeito;
  fator: number;
  movimentos: Array<{ tipo: 'ENTRADA' | 'SAIDA'; sku: string; deposito: string; quantidade: number; saldoAnterior: number; saldoPosterior: number; custoMedio: number }>;
  vinculosFornecedorMovidos: number;
  gtinsMovidos: string[];
  gtinsNaoMovidos: string[];
}

const ler = async (r: Response, padrao: string) => {
  const d = await r.json().catch(() => ({}));
  if (r.status === 404 && !d.error) throw new Error('O servidor não conhece esta função ainda: reinicie o backend (npm start).');
  if (!r.ok) throw new Error(d.error || padrao);
  return d;
};

export const getDuplicados = async (tenantId = 1): Promise<GrupoSuspeito[]> =>
  (await ler(await fetch(`${API}/itens/duplicados?tenant_id=${tenantId}`), 'Erro ao carregar os itens duplicados.')).grupos;

export const unificarItens = async (
  dados: { idOrigem: number; idDestino: number; fator: number; motivo?: string; simular?: boolean }, tenantId = 1
): Promise<ResultadoUnificacao> =>
  ler(await fetch(`${API}/itens/unificar?tenant_id=${tenantId}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dados),
  }), 'Erro ao unificar os itens.');
