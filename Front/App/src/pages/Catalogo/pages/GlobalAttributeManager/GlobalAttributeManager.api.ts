import { IAtributoGlobal, CreateAttributePayload, UpdateAttributePayload, GenericAttributeAPIResponse, UnidadeAPIResponse, GrupoVisualAPIResponse } from './GlobalAttributeManager.types';

// Centraliza a base apontando para o novo módulo criado no backend
const API_BASE_URL = 'http://localhost:3001/api/catalogo';
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
// 🧬 AUXILIARES: GRUPOS VISUAIS E UNIDADES DE MEDIDA
// =========================================================================

/**
 * 📁 Listar Grupos de Atributos (Agrupadores da tela esquerda)
 */
export const getGruposAtributos = async (tenantId: number): Promise<GrupoVisualAPIResponse[]> => {
  // 🔄 CORRIGIDO: Agora usa a URL base correta apontando para /grupos
  const response = await fetch(`${API_BASE_URL}/grupos?tenant_id=${tenantId}`, {
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
/**
 * 🔍 Listar todos os atributos cadastrados no pool global
 */
export const getAtributosGlobais = async (tenantId: number): Promise<IAtributoGlobal[]> => {
  const response = await fetch(`${API_BASE_URL}/atributos-globais`, {
    method: 'GET',
    headers: {
      ...DEFAULT_HEADERS,
      'x-tenant-id': String(tenantId), // 🎯 Alinhado com o que o seu backend espera
    },
  });
  
  const dadosDoBanco = await handleResponse<any[]>(response, 'Erro ao carregar os atributos globais.');
  
  // Como o backend JÁ FORMATA o objeto em camelCase, o map só precisa repassar ou ajustar pequenas tipagens
  return dadosDoBanco.map((attr: any) => ({
    id: attr.id,
    grupoId: attr.grupoId || '', // 🔄 Lendo a propriedade correta vinda do backend
    nome: attr.nome,
    codigo: attr.codigo,
    tipo: attr.tipo,
    escopoPadrao: attr.escopoPadrao, // 🔄 Lendo a propriedade correta vinda do backend
    unidadeId: attr.unidadeId || undefined, // 🔄 Lendo a propriedade correta vinda do backend
    sufixo: attr.sufixo,
    obrigatorioPadrao: attr.obrigatorioPadrao,
    pesquisavel: attr.pesquisavel,
    valoresSugeridos: attr.valoresSugeridos // 🔄 Lendo a propriedade correta vinda do backend
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
 * 🗑️ Excluir Atributo Global (Soft Delete)
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