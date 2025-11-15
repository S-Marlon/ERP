// src/types/cliente.ts

/** * Estrutura do Cliente Retornado pela rota '/clientes/search'.
 * Deve espelhar a estrutura do SELECT no backend (incluindo JOINs).
 */
export interface ClienteAPI {
    id: number; // Renomeado id_cliente para id para compatibilidade com EntitySelectTabs
    nome: string;
    cpf_cnpj: string;
    tipo_cliente: 'PF' | 'PJ'; // Corresponde ao ENUM do DB
    data_nascimento: string | null;
    fk_endereco_principal: number | null;
    cep: string | null;
    logradouro: string | null;
    cidade: string | null;
    estado: string | null;
    num_contratos: number; // Campo agregado (COUNT)
}

// Tipo de Cliente usado no componente (pode ser um alias para ClienteAPI ou ter campos adicionais de UI)
export type Cliente = ClienteAPI;
export type ClienteSearchKey = 'nome' | 'documento' | 'cep'; // 'telefone' e 'email' requerem JOINs mais complexos
export type ClienteTypeFilter = 'PF' | 'PJ' | 'AMBOS';