import { API_URL } from '../../../shared/api/config';
import { 
  IAtributoGlobal, 
  CreateAttributePayload, 
  UpdateAttributePayload, 
  GenericAttributeAPIResponse, 
  UnidadeAPIResponse, 
  GrupoVisualAPIResponse 
} from './GlobalAttributeManager.types';

// Centraliza a base apontando para o novo módulo criado no backend
const API_BASE_URL = `${API_URL}/api/catalogo`;
const DEFAULT_HEADERS = { 'Content-Type': 'application/json' };

/**
 * 🛡️ CENTRALIZADOR DE ERROS E RESPOSTAS HTTP
 */
const handleResponse = async <T>(response: Response, defaultError: string): Promise<T> => {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || errorData.message || defaultError);
  }
  return response.json();
};

// =========================================================================
// 📁 CRUD: GRUPOS VISUAIS (AGRUPADORES DA TELA ESQUERDA)
// =========================================================================

/**
 * 🔍 Listar Grupos de Atributos
 */
export const getGruposAtributos = async (tenantId: number): Promise<GrupoVisualAPIResponse[]> => {
  // 🟢 Corrigido de '/grupos' para '/atributos-grupos'
  const response = await fetch(`${API_BASE_URL}/atributos-grupos?tenant_id=${tenantId}`, {
    method: 'GET',
    headers: DEFAULT_HEADERS,
  });
  
  const dadosDoBanco = await handleResponse<any[]>(response, 'Erro ao carregar os grupos de atributos.');
  
  return dadosDoBanco.map((grupo: any) => ({
    id: String(grupo.id),
    nome: grupo.nome,
    descricao: grupo.descricao
  }));
};

/**
 * ➕ Criar novo Grupo Semântico
 */
export const createGrupoAtributo = async (data: { nome: string; descricao?: string }, tenantId: number = 1): Promise<any> => {
  // 🟢 Corrigido de '/grupos' para '/atributos-grupos'
  const response = await fetch(`${API_BASE_URL}/atributos-grupos`, {
    method: 'POST',
    headers: {
      ...DEFAULT_HEADERS,
      'x-tenant-id': String(tenantId),
    },
    body: JSON.stringify(data),
  });

  return handleResponse<any>(response, 'Erro ao criar o grupo semântico.');
};

/**
 * ✏️ Atualizar Grupo Semântico
 */
export const updateGrupoAtributo = async (idGrupo: string, data: { nome: string; descricao?: string }, tenantId: number = 1): Promise<any> => {
  // 🟢 Corrigido de '/grupos/:id' para '/atributos-grupos/:id'
  const response = await fetch(`${API_BASE_URL}/atributos-grupos/${idGrupo}`, {
    method: 'PUT',
    headers: {
      ...DEFAULT_HEADERS,
      'x-tenant-id': String(tenantId),
    },
    body: JSON.stringify(data),
  });

  return handleResponse<any>(response, 'Erro ao atualizar o grupo semântico.');
};

/**
 * 🗑️ Deletar Grupo Semântico
 */
export const deleteGrupoAtributo = async (idGrupo: string, tenantId: number = 1): Promise<any> => {
  // 🟢 Corrigido de '/grupos/:id' para '/atributos-grupos/:id'
  const response = await fetch(`${API_BASE_URL}/atributos-grupos/${idGrupo}`, {
    method: 'DELETE',
    headers: {
      ...DEFAULT_HEADERS,
      'x-tenant-id': String(tenantId),
    },
  });

  return handleResponse<any>(response, 'Erro ao remover o grupo semântico.');
};
// =========================================================================
// 📏 AUXILIARES: UNIDADES DE MEDIDA
// =========================================================================

/**
 * 📏 Listar Dicionário de Unidades Globais (ex: mm, pol, bar)
 */
export const getUnidadesMedida = async (tenantId: number = 1): Promise<UnidadeAPIResponse[]> => {
  const response = await fetch(`${API_BASE_URL}/unidades?tenant_id=${tenantId}`, {
    method: 'GET',
    headers: DEFAULT_HEADERS,
  });

  const dados = await handleResponse<any[]>(response, 'Erro ao carregar as unidades de medida.');

  return dados.map((uni: any) => ({
    id: String(uni.id),
    nome: uni.nome || '',
    simbolo: uni.simbolo || '',
    tipo: uni.tipo || 'outro'
  }));
};

// =========================================================================
// 🚀 CRUD PRINCIPAL: ATRIBUTOS GLOBAIS (POOL DO PIM)
// =========================================================================

/**
 * 🔍 Listar todos os atributos cadastrados no pool global
 */
export const getAtributosGlobais = async (tenantId: number): Promise<IAtributoGlobal[]> => {
  const response = await fetch(`${API_BASE_URL}/atributos-globais`, {
    method: 'GET',
    headers: {
      ...DEFAULT_HEADERS,
      'x-tenant-id': String(tenantId),
    },
  });
  
  const dadosDoBanco = await handleResponse<any[]>(response, 'Erro ao carregar os atributos globais.');
  
  return dadosDoBanco.map((attr: any) => ({
    id: attr.id,
    grupoId: attr.grupoId || attr.grupo_id || '',
    unidadeId: attr.unidadeId || attr.unidade_id || undefined,
    nome: attr.nome,
    codigo: attr.codigo,
    tipo: attr.tipo,
    escopoPadrao: attr.escopoPadrao,
    sufixo: attr.sufixo,
    obrigatorioPadrao: attr.obrigatorioPadrao,
    pesquisavel: attr.pesquisavel,
    valoresSugeridos: attr.valoresSugeridos,
    ajudaContextual: attr.descricao || undefined,
    opcoes: Array.isArray(attr.opcoes) ? attr.opcoes : [],
    qtdItens: Number(attr.qtdItens || 0),
    qtdVinculos: Number(attr.qtdVinculos || 0),
    emUso: Boolean(attr.emUso),
  }));
};

/**
 * ➕ Criar novo Atributo Global
 */
export const createAtributoGlobal = async (data: CreateAttributePayload, tenantId: number = 1): Promise<GenericAttributeAPIResponse> => {
  const response = await fetch(`${API_BASE_URL}/atributos-globais`, {
    method: 'POST',
    headers: {
      ...DEFAULT_HEADERS,
      'x-tenant-id': String(tenantId),
    },
    body: JSON.stringify(data),
  });

  return handleResponse<GenericAttributeAPIResponse>(response, 'Erro ao criar o atributo global.');
};

/**
 * ✏️ Atualizar Atributo Global
 */
export const updateAtributoGlobal = async (idAtributo: string, data: UpdateAttributePayload, tenantId: number = 1): Promise<GenericAttributeAPIResponse> => {
  const response = await fetch(`${API_BASE_URL}/atributos-globais/${idAtributo}`, {
    method: 'PUT',
    headers: {
      ...DEFAULT_HEADERS,
      'x-tenant-id': String(tenantId),
    },
    body: JSON.stringify(data),
  });

  return handleResponse<GenericAttributeAPIResponse>(response, 'Erro ao atualizar o atributo global.');
};

/**
 * 🔀 Mesclar atributo duplicado (origem) em outro (destino): valores, vínculos e templates vão para o destino
 */
export const mesclarAtributoGlobal = async (idOrigem: string, idDestino: string, tenantId: number = 1): Promise<GenericAttributeAPIResponse> => {
  const response = await fetch(`${API_BASE_URL}/atributos-globais/${idOrigem}/mesclar`, {
    method: 'POST',
    headers: { ...DEFAULT_HEADERS, 'x-tenant-id': String(tenantId) },
    body: JSON.stringify({ destinoId: idDestino }),
  });
  return handleResponse<GenericAttributeAPIResponse>(response, 'Erro ao mesclar os atributos.');
};

/**
 * 🗑️ Excluir Atributo Global (Soft Delete / Hard Delete dependendo da Constraint)
 */
export const deleteAtributoGlobal = async (idAtributo: string, tenantId: number = 1): Promise<GenericAttributeAPIResponse> => {
  const response = await fetch(`${API_BASE_URL}/atributos-globais/${idAtributo}`, {
    method: 'DELETE',
    headers: {
      ...DEFAULT_HEADERS,
      'x-tenant-id': String(tenantId),
    },
  });

  return handleResponse<GenericAttributeAPIResponse>(response, 'Erro ao remover o atributo global selecionado.');
};
// =========================================================================
// ✏️ EDIÇÃO DETALHADA: uso, travas, opções no lugar, texto → lista, correções
// =========================================================================

export type NivelTrava = 'livre' | 'aviso' | 'bloqueado';
export interface Trava { nivel: NivelTrava; motivo: string }
export interface FamiliaNoModelo { id: number; nome: string; noNome: { texto: boolean; codigo: boolean }; noSku: { texto: boolean; codigo: boolean } }
export interface OpcaoDetalhe { id: number; valor: string; codigo: string; ordem: number; itens: number }
export interface DetalheAtributo {
  atributo: {
    id: string; nome: string; codigo: string; tipo: string; escopoPadrao: string; grupoId: string; unidadeId: string;
    descricao: string; obrigatorioPadrao: boolean; pesquisavel: boolean;
  };
  uso: {
    itens: number;
    vinculos: Array<{ tipo: 'familia' | 'categoria'; id: number; nome: string; escopo: string; obrigatorio: boolean }>;
    familiasTemplate: FamiliaNoModelo[];
  };
  travas: Record<'tipo' | 'nome' | 'codigo' | 'unidade' | 'escopo' | 'excluir', Trava>;
  opcoes: OpcaoDetalhe[];
  valores: Array<{ texto: string; qtd: number }>;
  inconsistencias: { valoresSemOpcao: number; textosSemOpcao: string[]; valoresDeItensApagados: number };
}

/** Erro com detalhes do servidor (ex.: CONFIRMAR com o impacto da mudança). */
export class ErroApiAtributo extends Error {
  constructor(message: string, public status: number, public detalhes?: any) { super(message); }
}

const pedir = async <T,>(url: string, init: RequestInit | undefined, padrao: string): Promise<T> => {
  const r = await fetch(url, init);
  const d = await r.json().catch(() => ({}));
  if (r.status === 404 && !d.error) throw new ErroApiAtributo('Rota não encontrada: reinicie o backend.', 404);
  if (!r.ok) throw new ErroApiAtributo(d.error || padrao, r.status, d.detalhes);
  return d as T;
};
const corpo = (method: string, body?: unknown): RequestInit => ({ method, headers: DEFAULT_HEADERS, body: body === undefined ? undefined : JSON.stringify(body) });
const urlAttr = (id: string | number, resto = '', tenantId = 1) => `${API_BASE_URL}/atributos-globais/${id}${resto}?tenant_id=${tenantId}`;

export const atributoEdicaoApi = {
  detalhe: (id: string | number) => pedir<DetalheAtributo>(urlAttr(id, '/detalhe'), undefined, 'Erro ao carregar o atributo.'),
  adicionarOpcao: (id: string | number, valor: string, codigo?: string) =>
    pedir<{ opcoes: Array<{ valor: string; codigo: string }> }>(urlAttr(id, '/opcoes'), corpo('POST', { valor, codigo }), 'Erro ao acrescentar a opção.'),
  editarOpcao: (id: string | number, idOpcao: number, dados: { valor?: string; codigo?: string; confirmar?: boolean }) =>
    pedir<{ success: boolean; impacto?: { mensagens: string[] } }>(urlAttr(id, `/opcoes/${idOpcao}`), corpo('PUT', dados), 'Erro ao editar a opção.'),
  /** Salva várias opções de uma vez (tudo ou nada; uma confirmação só se mudar nome/SKU de itens) */
  editarOpcoesLote: (id: string | number, opcoes: Array<{ id: number; valor: string; codigo: string }>, confirmar = false) =>
    pedir<{ success: boolean; alteradas: number }>(urlAttr(id, '/opcoes-lote'), corpo('PUT', { opcoes, confirmar }), 'Erro ao salvar as opções.'),
  excluirOpcao: (id: string | number, idOpcao: number) => pedir<{ success: boolean }>(urlAttr(id, `/opcoes/${idOpcao}`), corpo('DELETE'), 'Erro ao excluir a opção.'),
  mesclarOpcao: (id: string | number, idOpcao: number, destinoId: number, confirmar = false) =>
    pedir<{ movidos: number }>(urlAttr(id, `/opcoes/${idOpcao}/mesclar`), corpo('POST', { destinoId, confirmar }), 'Erro ao mesclar as opções.'),
  ordenarOpcoes: (id: string | number, ids: number[]) => pedir<{ success: boolean }>(urlAttr(id, '/opcoes-ordem'), corpo('PUT', { ids }), 'Erro ao ordenar.'),
  converterEmLista: (id: string | number, aplicar: boolean) =>
    pedir<{ aplicado: boolean; aviso: string | null; opcoes: Array<{ valor: string; codigo: string; qtd: number; variantes: string[] }> }>(
      urlAttr(id, '/converter-lista'), corpo('POST', { aplicar }), 'Erro ao converter em lista.'),
  corrigirValores: (id: string | number) =>
    pedir<{ ligados: number; opcoesCriadas: number; orfaosApagados: number }>(urlAttr(id, '/corrigir-valores'), corpo('POST', {}), 'Erro ao corrigir os valores.'),
};
