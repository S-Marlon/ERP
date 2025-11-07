// src/types/Cliente.ts (Novo arquivo ou ajustado)

/** Estrutura básica do Cliente que virá da sua API */
export interface ClienteAPI {
    id_cliente: number;
    nome: string;
    cpf_cnpj: string;
    tipo_cliente: 'PF' | 'PJ'; // Mapeia para ClienteTypeFilter
    data_nascimento: string | null;
    fk_endereco_principal: number | null;
    // Você precisará de rotas adicionais (ou um JOIN na API) para pegar contatos e endereços.
    // Para simplificar a exibição:
    contatos?: { tipo: 'Email' | 'Telefone', valor: string, nome: string }[];
    enderecos?: { cep: string, logradouro: string, cidade: string, estado: string }[];
}

// Tipo usado no Frontend para o componente (usa o tipo da API)
type Cliente = ClienteAPI;