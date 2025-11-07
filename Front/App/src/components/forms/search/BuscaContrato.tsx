// BuscaContrato.tsx (Com Filtro por Tipo Implementado)
import React from 'react';
import FlexGridContainer from '../../Layout/FlexGridContainer/FlexGridContainer';
import Fieldset from '../../ui/Fieldset/Fieldset';
import Typography from '../../ui/Typography/Typography';
import ResultItem from '../../ui/ResultItem';
import Badge from '../../ui/Badge/Badge';
import EntitySelectTabs, { EntitySelectProps } from '../../EntitySelectTabs';

// ... (Importações)

const API_URL = 'http://localhost:3001'; 

// ----------------- 1. TIPOS ESPECÍFICOS DE CONTRATO (BASEADOS NO DB) -----------------

type ContratoTipo = 'Serviço' | 'Obra' | 'Fornecimento';
export type Contrato = { 
    id_contrato: number; // PK
    codigo_contrato: string; // Mapeia para 'numero'
    descricao: string; // Mapeia para 'titulo' (ou parte dele)
    data_inicio: string; // Usaremos como dataAssinatura
    valor_total: number; // Mapeia para 'valor'
    status: 'Ativo' | 'Concluido' | 'Cancelado' | 'Pendente'; 
    fk_cliente: number;
    nome_cliente: string; 
    // 🚨 CAMPO ADICIONADO: O backend DEVE retornar esta coluna (via JOIN/Simulação)
    tipo: ContratoTipo; 
};

// ... (ContratoSearchKey mantido)
type ContratoSearchKey = 'codigo_contrato' | 'descricao' | 'fk_cliente'; 
type ContratoTypeFilter = ContratoTipo | 'TODOS'; // Filtro de tipo de volta
// ----------------- 2. FUNÇÕES AUXILIARES E DE BUSCA (Ajustadas) -----------------

// ... (formatCurrency e getStatusColor mantidos)

/**
 * Função de Busca Real (fetchContratos)
 * Agora envia o typeFilter para o backend.
 */
const fetchContratos = async (query: string, tab: ContratoSearchKey, typeFilter: ContratoTypeFilter): Promise<Contrato[]> => {
    
    // Se não houver query E o filtro for TODOS, retorna vazio
    if (!query && typeFilter === 'TODOS') {
        return [];
    }

    // Prepara os parâmetros da query.
    const searchParams = new URLSearchParams({
        query: query,
        searchKey: tab, 
        typeFilter: typeFilter // 🚨 ENVIANDO O FILTRO DE TIPO
    });
    
    try {
        const response = await fetch(`${API_URL}/contratos/search?${searchParams.toString()}`);
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: 'Erro desconhecido.' }));
            throw new Error(errorData.message || 'Falha ao buscar contratos na API.');
        }
        
        const result = await response.json();
        
        return result.data as Contrato[];

    } catch (error) {
        console.error("Erro na busca de contratos:", (error as Error).message);
        return [];
    }
};

// ----------------- 3. RENDERIZAÇÕES ESPECÍFICAS (Ajustadas) -----------------

const renderSelectedContrato = (contrato: Contrato, ) => (
    <FlexGridContainer layout='flex' template='column' gap='10px'>
        <FlexGridContainer layout='flex' justifyContent='space-between' alignItems='flex-start' >
            {/* 🚨 EXIBINDO O TIPO */}
            <Fieldset legend={`Contrato Selecionado (${contrato.tipo}):`} variant='basic'> 
                <Typography variant="strong">{contrato.descricao}</Typography>
            </Fieldset>
            {/* ... */}
        </FlexGridContainer>

        <FlexGridContainer layout='flex' justifyContent='space-between'>
            {/* ... Campos de Número, Valor, Status mantidos ... */}
        </FlexGridContainer>
        <Typography variant="pMuted">**Cliente:** {contrato.nome_cliente} (ID: {contrato.fk_cliente})</Typography>
    </FlexGridContainer>
);

const renderContratoResult = (contrato: Contrato, isSelected: boolean, handleSelect: (c: Contrato) => void) => (
    <ResultItem
        key={contrato.id_contrato}
        onClick={() => handleSelect(contrato)}
        selected={isSelected}
    >
        <div className='flex-row' style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="strong">**{contrato.codigo_contrato}** - {contrato.descricao}</Typography>
            <Badge color='danger'><Typography variant='strong'>{contrato.status}</Typography></Badge>
        </div>
        <FlexGridContainer layout='flex' justifyContent="space-between" style={{ marginTop: '5px' }}>
            {/* 🚨 EXIBINDO O TIPO */}
            <Typography variant="small">Tipo: {contrato.tipo}</Typography> 
            <Typography variant="small">Valor: {(contrato.valor_total)}</Typography>
            <Typography variant="small">Início: {contrato.data_inicio}</Typography>
        </FlexGridContainer>
    </ResultItem>
);

// ----------------- 4. COMPONENTE WRAPPER PRINCIPAL (CORRIGIDO) -----------------

// Definições fixas e específicas da entidade Contrato (Ajustadas as chaves)
const defaultContratoProps = {
    title: "**Busca de Contrato**",
    newEntityLink: "/contratos/novo",
    newEntityLabel: "Novo Contrato",
    defaultTypeFilter: 'TODOS' as ContratoTypeFilter,
    
    tabLabels: {
        codigo_contrato: 'Número', 
        descricao: 'Descrição/Título', 
        fk_cliente: 'ID Cliente', 
    } as Record<ContratoSearchKey, string>,

    // 🚨 OPÇÕES DE TIPO REINTRODUZIDAS
    typeFilterOptions: [
        { key: 'Serviço', label: 'Serviço' },
        { key: 'Obra', label: 'Obra' },
        { key: 'Fornecimento', label: 'Fornecimento' },
        { key: 'TODOS', label: 'Todos' },
    ] as { key: ContratoTypeFilter, label: string }[],
    
    fetchEntities: fetchContratos,
    renderSelectedEntity: renderSelectedContrato,
    renderResultItem: renderContratoResult,
};

// ... (ContratoSelect wrapper mantido)
type ContratoSelectProps = Omit<
    EntitySelectProps<Contrato, ContratoSearchKey, ContratoTypeFilter>, 
    keyof typeof defaultContratoProps
>;

const ContratoSelect: React.FC<ContratoSelectProps> = (props) => {
    return <EntitySelectTabs {...defaultContratoProps} {...props} />;
};

export default ContratoSelect;