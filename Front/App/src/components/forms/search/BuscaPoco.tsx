// BuscaPoco.tsx (Final Integrado)
import React from 'react';

// Importa o componente genérico e seus tipos
import EntitySelectTabs, { EntitySelectProps } from '../../EntitySelectTabs'; 

// Importações de UI necessárias para as funções de renderização
import Button from '../../ui/Button/Button';
import FlexGridContainer from '../../Layout/FlexGridContainer/FlexGridContainer';
import Typography from '../../ui/Typography/Typography';
import ResultItem from '../../ui/ResultItem';
import Badge from '../../ui/Badge/Badge';
import Fieldset from '../../ui/Fieldset/Fieldset';

const API_URL = 'http://localhost:3001';

// ----------------- 1. TIPOS ESPECÍFICOS DE POÇO (Refletindo o DB e JOINs) -----------------

// Tipos de UI mantidos, assumindo que serão mapeados pelo backend
type PocoUso = 'Industrial' | 'Residencial' | 'Irrigação' | string;
type PocoStatus = 'Operacional' | 'Manutenção' | 'Inativo' | string;
type PocoTypeFilter = PocoUso | 'TODOS';

/**
 * Estrutura do Poço Retornado da API. 
 * Combina campos do DB (`pocos`) com campos obtidos por JOIN/Simulação (`nome_cliente`, `codigo`, etc.).
 */
export interface Poco {
    id_poco: number; 
    fk_cliente: number; 
    fk_contrato: number; // Adicionada a chave de contrato, essencial para a busca
    nome_cliente: string; // Vem do JOIN
    
    // Campos que o backend irá simular no SELECT (baseado na estrutura do DB)
    codigo: string; 
    localizacao: string;
    vazao_max: number; 
    uso: PocoUso; 
    status: PocoStatus;
}
// Chaves de Busca ajustadas para usar as FKs numéricas
type PocoSearchKey = 'fk_contrato' | 'fk_cliente'; 


// ----------------- 2. FUNÇÕES AUXILIARES E DE BUSCA -----------------

/**
 * Função auxiliar para mapeamento de cores.
 */
const getStatusColor = (status: Poco['status']): 'success' | 'warning' | 'danger' | 'default' => {
    switch (status) {
        case 'Operacional': return 'success';
        case 'Manutenção': return 'warning';
        case 'Inativo': return 'danger';
        default: return 'default';
    }
}

/**
 * Função de Adaptação e Busca (fetchPocos) - Mantém a lógica de API
 */
const fetchPocos = async (
    query: string, 
    tab: PocoSearchKey, 
    typeFilter: PocoTypeFilter
): Promise<Poco[]> => {
    if (!query && typeFilter === 'TODOS') {
        return [];
    }

    const tipo = typeFilter === 'TODOS' ? '' : typeFilter;

    const searchParams = new URLSearchParams({
        query: query,
        searchKey: tab,
        typeFilter: tipo
    });

    try {
        const response = await fetch(`${API_URL}/pocos/search?${searchParams.toString()}`);
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: 'Erro desconhecido.' }));
            throw new Error(errorData.message || 'Falha ao buscar poços na API.');
        }
        const result = await response.json();
        // Assume que o backend retorna os dados com a estrutura Poco
        return result.data as Poco[];
    } catch (error) {
        console.error("Erro na busca de poços:", (error as Error).message);
        return [];
    }
};


// ----------------- 3. RENDERIZAÇÕES ESPECÍFICAS (Ajustadas para a tipagem final) -----------------

const renderSelectedPoco = (poco: Poco, handleClear: () => void, isLoading: boolean) => (
    <FlexGridContainer layout='flex' template='column'>
        <FlexGridContainer layout='flex' justifyContent='space-between' alignItems='flex-start' >
            <Fieldset legend={`Poço Selecionado (${poco.uso}):`} variant='basic'>
                <Typography variant="strong">{poco.codigo}</Typography>
            </Fieldset>
            <Button variant='danger' onClick={(e) => { e.stopPropagation(); handleClear(); }} disabled={isLoading}>
                Limpar Seleção
            </Button>
        </FlexGridContainer>

        <FlexGridContainer layout='flex' justifyContent='space-between' style={{marginTop: '10px'}}>
            <Fieldset legend='Localização' variant='basic'>
                <Typography variant="strong"> {poco.localizacao}</Typography>
            </Fieldset>
            <Fieldset legend='Vazão Máx. (m³/h)' variant='basic'>
                <Typography variant="strong"></Typography>
            </Fieldset>
            <Fieldset legend='Status' variant='basic'>
                <Badge color={getStatusColor(poco.status)}><Typography variant='strong'>{poco.status}</Typography></Badge>
            </Fieldset>
        </FlexGridContainer>
        <Fieldset legend='Cliente Proprietário' variant='basic' style={{marginTop: '10px'}}>
            {/* Exibe o nome do cliente obtido via JOIN */}
            <Typography variant="small">**{poco.nome_cliente}** (ID Cliente: {poco.fk_cliente} | ID Contrato: {poco.fk_contrato})</Typography> 
        </Fieldset>
    </FlexGridContainer>
);

const renderPocoResult = (poco: Poco, isSelected: boolean, handleSelect: (p: Poco) => void) => (
    <ResultItem
        key={poco.id_poco}
        onClick={() => handleSelect(poco)}
        selected={isSelected}
    >
        <div className='flex-row' style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="strong">**{poco.codigo}** - {poco.localizacao}</Typography>
            <Badge color={getStatusColor(poco.status)}><Typography variant='strong'>{poco.status}</Typography></Badge>
        </div>
        <FlexGridContainer layout='flex' justifyContent="space-between" style={{ marginTop: '5px' }}>
            <Typography variant="small">Uso: {poco.uso}</Typography>
            <Typography variant="small">Vazão:  m³/h</Typography>
            {/* Exibe o nome do cliente na lista de resultados */}
            <Typography variant="small">Cliente: {poco.nome_cliente}</Typography> 
        </FlexGridContainer>
    </ResultItem>
);


// ----------------- 4. COMPONENTE WRAPPER PRINCIPAL -----------------

const defaultPocoProps = {
    title: "**Busca de Poço**",
    newEntityLink: "/pocos/novo",
    newEntityLabel: "Novo Poço",
    defaultTypeFilter: 'TODOS' as PocoTypeFilter,
    
    // Chaves de busca ajustadas para as FKs numéricas do DB
    tabLabels: {
        fk_contrato: 'ID Contrato', 
        fk_cliente: 'ID Cliente',
    } as Record<PocoSearchKey, string>,

    typeFilterOptions: [
        { key: 'Industrial', label: 'Industrial' },
        { key: 'Residencial', label: 'Residencial' },
        { key: 'Irrigação', label: 'Irrigação' },
        { key: 'TODOS', label: 'Todos' },
    ] as { key: PocoTypeFilter, label: string }[],
    
    fetchEntities: fetchPocos,
    renderSelectedEntity: renderSelectedPoco, 
    renderResultItem: renderPocoResult,
};

type PocoSelectProps = Omit<
    EntitySelectProps<Poco, PocoSearchKey, PocoTypeFilter>, 
    keyof typeof defaultPocoProps
>;


const PocoSelect: React.FC<PocoSelectProps> = (props) => {
    return <EntitySelectTabs {...defaultPocoProps} {...props} />;
};

export default PocoSelect;