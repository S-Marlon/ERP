// ClienteSelect.tsx (Com Integração Real com a API)
import React from 'react';
import EntitySelectTabs, { EntitySelectProps } from '../../EntitySelectTabs'; 
// Substituímos CLIENTES_MOCK e ClienteMock pela lógica de API
// import { CLIENTES_MOCK, ClienteMock } from '../../../data/entities/clients'; 
// Importações de UI necessárias
import FlexGridContainer from '../../Layout/FlexGridContainer/FlexGridContainer';
import Fieldset from '../../ui/Fieldset/Fieldset';
import Button from '../../ui/Button/Button';
import Typography from '../../ui/Typography/Typography';
import ResultItem from '../../ui/ResultItem';
import Badge from '../../ui/Badge/Badge';

// Endpoint da sua API
const API_URL = 'http://localhost:3001'; 

// ----------------- TIPOS ESPECÍFICOS DE CLIENTE (Baseados no Retorno da API) -----------------

/** * Estrutura do Cliente Retornado pela rota '/clientes/search'.
 * Deve espelhar a estrutura do SELECT no backend (incluindo JOINs).
 */
export interface ClienteAPI {
    id_cliente: number;
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

// Tipo de Cliente usado no componente
type Cliente = ClienteAPI;
type ClienteSearchKey = 'nome' | 'documento' | 'cep'; // 'telefone' e 'email' requerem JOINs mais complexos
type ClienteTypeFilter = 'PF' | 'PJ' | 'AMBOS';


// ----------------- FUNÇÃO DE BUSCA REAL COM API -----------------

/**
 * Busca clientes na API do backend usando os filtros fornecidos.
 * Esta função substitui a lógica de mock/setTimeout.
 */
const fetchClientes = async (
    query: string, 
    tab: ClienteSearchKey, 
    typeFilter: ClienteTypeFilter
): Promise<Cliente[]> => {
    
    // Se não houver termo de busca E o filtro for "AMBOS",
    // não faz a requisição para evitar sobrecarregar o DB.
    if (!query && typeFilter === 'AMBOS') {
        return [];
    }

    const tipo = typeFilter === 'AMBOS' ? '' : typeFilter;
    
    // Prepara os parâmetros da query para o endpoint do backend
    const searchParams = new URLSearchParams({
        query: query,
        searchKey: tab,
        typeFilter: tipo
    });
    
    try {
        const response = await fetch(`${API_URL}/clientes/search?${searchParams.toString()}`);
        
        if (!response.ok) {
            console.error(`Status HTTP: ${response.status}`);
            const errorData = await response.json().catch(() => ({ message: 'Erro desconhecido.' }));
            throw new Error(errorData.message || 'Falha ao buscar clientes na API.');
        }
        
        const result = await response.json();
        
        // Assegura que o retorno é um array de ClienteAPI
        return result.data as Cliente[];

    } catch (error) {
        console.error("Erro na busca de clientes:", (error as Error).message);
        // Em caso de falha de rede/servidor, retorna vazio
        return [];
    }
};


// ----------------- RENDERIZAÇÕES ESPECÍFICAS DE CLIENTE -----------------

// 1. Renderização do Item Selecionado
const renderSelectedCliente = (cliente: Cliente, handleClear: () => void, isLoading: boolean) => (
    <FlexGridContainer layout='flex' template='column' gap='10px'>
        <FlexGridContainer layout='flex' justifyContent='space-between' alignItems='flex-start' >
            {/* Usamos 'tipo_cliente' do DB */}
            <Fieldset legend={`Cliente Selecionado (${cliente.tipo_cliente}):`} variant='basic'>
                <Typography variant="strong">{cliente.nome}</Typography>
            </Fieldset>
            <Button variant='danger' onClick={handleClear} disabled={isLoading}>Limpar Seleção</Button>
        </FlexGridContainer>
        {/* Detalhes do Cliente Selecionado (Exibindo dados que vêm do SELECT com JOIN) */}
        <FlexGridContainer layout='grid' template='2-col' gap='10px'>
            <Typography variant="small">**Documento:** {cliente.cpf_cnpj}</Typography>
            <Typography variant="small">**CEP Principal:** {cliente.cep}</Typography>
            <Typography variant="small">**Endereço:** {cliente.logradouro}, {cliente.cidade} - {cliente.estado}</Typography>
            {cliente.data_nascimento && (
                <Typography variant="small">**Nascimento:** {cliente.data_nascimento}</Typography>
            )}
        </FlexGridContainer>
    </FlexGridContainer>
);

// 2. Renderização de um Item na Lista de Resultados
const renderClienteResult = (cliente: Cliente, isSelected: boolean, handleSelect: (c: Cliente) => void) => (
    <ResultItem
        key={cliente.id_cliente} // Usamos a PK do DB
        onClick={() => handleSelect(cliente)}
        selected={isSelected}
    >
        <div className='flex-row' style={{ justifyContent: 'space-between' }}>
            {/* Usamos 'tipo_cliente' do DB */}
            <Typography variant="strong">**{cliente.nome}** ({cliente.tipo_cliente})</Typography>
            <Typography variant="pMuted">{cliente.cpf_cnpj}</Typography>
        </div>
        <FlexGridContainer layout='flex' justifyContent="space-between" style={{ marginTop: '5px' }}>
            <Typography variant="small">Endereço Principal: {cliente.cidade} - {cliente.estado}</Typography>
            {/* Usamos o campo 'num_contratos' retornado pelo SELECT */}
            <Badge color='paper'><Typography variant='strong'>{cliente.num_contratos} Contratos</Typography></Badge>
        </FlexGridContainer>
    </ResultItem>
);


// ----------------- DEFINIÇÃO DAS PROPS PADRÃO -----------------
const defaultClientProps = {
    title: "**Busca de Cliente**",
    newEntityLink: "/clientes/novo",
    newEntityLabel: "Novo Cliente",
    defaultTypeFilter: 'AMBOS' as ClienteTypeFilter,
    
    // Mapeamento das abas (Ajustei para o que o backend suporta facilmente)
    tabLabels: {
        nome: 'Nome',
        documento: 'Documento',
        cep: 'CEP',
        // 'telefone' e 'email' foram removidas por exigirem JOINs na rota de busca
        // A chave 'documento' já cuida de CPF/CNPJ
    } as Record<ClienteSearchKey, string>,

    // Opções para o filtro de Tipo
    typeFilterOptions: [
        { key: 'PF', label: 'Pessoa Física (CPF)' },
        { key: 'PJ', label: 'Pessoa Jurídica (CNPJ)' },
        { key: 'AMBOS', label: 'Ambos' },
    ] as { key: ClienteTypeFilter, label: string }[],
    
    // Funções específicas (passadas como props)
    fetchEntities: fetchClientes,
    renderSelectedEntity: renderSelectedCliente,
    renderResultItem: renderClienteResult,
};

// Define o tipo das props que o componente ClienteSelect VAI RECEBER
type ClienteSelectProps = Omit<
    EntitySelectProps<Cliente, ClienteSearchKey, ClienteTypeFilter>, 
    keyof typeof defaultClientProps
>;

// ----------------- COMPONENTE WRAPPER -----------------
const ClienteSelect: React.FC<ClienteSelectProps> = (props) => {
    // Combina as default props e as props recebidas antes de passar para o EntitySelectTabs
    return <EntitySelectTabs {...defaultClientProps} {...props} />;;
};

export default ClienteSelect;