import React from 'react';

// Importa o componente genérico e seus tipos
// 🚨 Ajuste o caminho conforme onde você salvou o EntitySelectTabs.tsx
import EntitySelectTabs, { EntitySelectProps } from '../../EntitySelectTabs'; 

// Importações de UI necessárias para as funções de renderização
import Button from '../../ui/Button/Button';
import FlexGridContainer from '../../Layout/FlexGridContainer/FlexGridContainer';
import Typography from '../../ui/Typography/Typography';
import ResultItem from '../../ui/ResultItem';
import Badge from '../../ui/Badge/Badge';
import Fieldset from '../../ui/Fieldset/Fieldset';

// 🚨 IMPORTAÇÃO DO MOCK CENTRALIZADO
import { POCOS_MOCK, PocoMock } from '../../../data/entities/clients';

// ----------------- 1. TIPOS ESPECÍFICOS DE POÇO -----------------

type PocoUso = 'Industrial' | 'Residencial' | 'Irrigação';
type PocoStatus = 'Operacional' | 'Manutenção' | 'Inativo';
type PocoTypeFilter = PocoUso | 'TODOS';

// Interface Poco (A estrutura final que o componente deve manipular)
interface Poco {
    id: string; 
    codigo: string;
    localizacao: string;
    vazao: number;
    uso: PocoUso;
    status: PocoStatus;
    fk_cliente_id: number;
}

type PocoSearchKey = 'codigo' | 'localizacao' | 'fk_cliente_id' | 'status';


// ----------------- 2. FUNÇÕES AUXILIARES DE POÇO -----------------

/**
 * Função auxiliar para mapeamento de cores (extraída do componente original).
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
 * Função de Adaptação e Busca (Baseada no seu componente original)
 * Mapeia os dados do mock e filtra de acordo com a query, aba e filtro de tipo.
 */
const fetchPocos = async (query: string, tab: PocoSearchKey, typeFilter: PocoTypeFilter): Promise<Poco[]> => {
    return new Promise((resolve) => {
        setTimeout(() => {
            // 1. Adaptação dos dados Mock para a interface Poco
            const allData: Poco[] = POCOS_MOCK.map((pocoMock, index) => {
                // Simulação dos campos
                const usoSimulado: PocoUso = pocoMock.nomeIdentificacao.includes('Fazenda')
                    ? 'Irrigação'
                    : pocoMock.nomeIdentificacao.includes('Secundário')
                    ? 'Industrial'
                    : 'Residencial';

                const statusSimulado: PocoStatus = pocoMock.contratoId ? 'Operacional' : 'Inativo';
                
                return {
                    id: pocoMock.id,
                    codigo: pocoMock.nomeIdentificacao.split(' - ')[0] || pocoMock.nomeIdentificacao,
                    localizacao: pocoMock.nomeIdentificacao.split(' - ')[1] || 'Localização Indefinida',
                    vazao: pocoMock.vazao ?? 0,
                    fk_cliente_id: Number(pocoMock.clienteId?.replace(/\D/g, '') ?? index + 1), // Transforma 'cli-001' em 1
                    uso: usoSimulado,
                    status: statusSimulado,
                } as Poco; 
            });

            // 2. Lógica de Filtragem (Baseada no seu componente original)
            const lowerQuery = query.toLowerCase().replace(/[^a-z0-9]/g, '');

            const filteredData = allData.filter(poco => {
                // Filtro 1: Tipo de Uso
                if (typeFilter !== 'TODOS' && poco.uso !== typeFilter) {
                    return false;
                }

                // Filtro 2: Termo de Busca
                if (!query) return true;

                let valueToSearch: string | number;

                if (tab === 'fk_cliente_id') {
                    valueToSearch = String(poco.fk_cliente_id);
                } else if (tab === 'status') {
                    // Status não remove caracteres especiais/espaços
                    valueToSearch = poco.status;
                    return valueToSearch.toLowerCase().includes(query.toLowerCase());
                } else {
                    // Busca por Código ou Localização
                    valueToSearch = poco[tab as keyof Poco];
                }

                if (typeof valueToSearch === 'string' || typeof valueToSearch === 'number') {
                    const stringValue = String(valueToSearch);
                    const cleanedValue = stringValue.toLowerCase().replace(/[^a-z0-9]/g, '');
                    return cleanedValue.includes(lowerQuery);
                }
                return false;
            });

            resolve(filteredData);
        }, 300);
    });
};


// ----------------- 3. RENDERIZAÇÕES ESPECÍFICAS DE POÇO -----------------

/**
 * Renderiza a visualização do Poço Selecionado (renderSelectedEntity).
 */
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
            <Fieldset legend='Vazão (m³/h)' variant='basic'>
                <Typography variant="strong">{poco.vazao.toFixed(1)}</Typography>
            </Fieldset>
            <Fieldset legend='Status' variant='basic'>
                <Badge color={getStatusColor(poco.status)}><Typography variant='strong'>{poco.status}</Typography></Badge>
            </Fieldset>
        </FlexGridContainer>
        <Fieldset legend='Cliente Proprietário ID' variant='basic' style={{marginTop: '10px'}}>
            <Typography variant="small">ID: {poco.fk_cliente_id}</Typography>
        </Fieldset>
    </FlexGridContainer>
);

/**
 * Renderiza um Poço na Lista de Resultados (renderResultItem).
 */
const renderPocoResult = (poco: Poco, isSelected: boolean, handleSelect: (p: Poco) => void) => (
    <ResultItem
        key={poco.id}
        onClick={() => handleSelect(poco)}
        selected={isSelected}
    >
        <div className='flex-row' style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="strong">**{poco.codigo}** - {poco.localizacao}</Typography>
            <Badge color={getStatusColor(poco.status)}><Typography variant='strong'>{poco.status}</Typography></Badge>
        </div>
        <FlexGridContainer layout='flex' justifyContent="space-between" style={{ marginTop: '5px' }}>
            <Typography variant="small">Uso: {poco.uso}</Typography>
            <Typography variant="small">Vazão: {poco.vazao.toFixed(1)} m³/h</Typography>
            <Typography variant="small">Cliente ID: {poco.fk_cliente_id}</Typography>
        </FlexGridContainer>
    </ResultItem>
);


// ----------------- 4. COMPONENTE WRAPPER PRINCIPAL -----------------

// Define as chaves que serão fixadas
type PocoSelectFixedProps = 'title' | 'newEntityLink' | 'newEntityLabel' | 'defaultTypeFilter' | 'tabLabels' | 'typeFilterOptions' | 'fetchEntities' | 'renderSelectedEntity' | 'renderResultItem';

// Define as props que o componente PocoSelect receberá (as únicas dinâmicas do EntitySelect)
type PocoSelectOwnProps = Omit<EntitySelectProps<Poco, PocoSearchKey, PocoTypeFilter>, PocoSelectFixedProps>;


const PocoSelect: React.FC<PocoSelectOwnProps> = (props) => {
    // Definições fixas e específicas da entidade Poço
    const defaultProps = {
        title: "**Busca de Poço**",
        newEntityLink: "/pocos/novo",
        newEntityLabel: "Novo Poço",
        defaultTypeFilter: 'TODOS' as PocoTypeFilter,
        
        tabLabels: {
            codigo: 'Código',
            localizacao: 'Localização',
            fk_cliente_id: 'ID Cliente',
            status: 'Status',
        } as Record<PocoSearchKey, string>,

        typeFilterOptions: [
            { key: 'Industrial', label: 'Industrial' },
            { key: 'Residencial', label: 'Residencial' },
            { key: 'Irrigação', label: 'Irrigação' },
            { key: 'TODOS', label: 'Todos' },
        ] as { key: PocoTypeFilter, label: string }[],
        
        // Injeta as funções específicas de Poço no componente genérico
        fetchEntities: fetchPocos,
        renderSelectedEntity: renderSelectedPoco,
        renderResultItem: renderPocoResult,
    };

    // O PocoSelect passa suas próprias props (como pocoSelecionado, onPocoSelecionadoChange, isLoading)
    // junto com as props padrões específicas da entidade.
    return <EntitySelectTabs {...defaultProps} {...props} />;
};

export default PocoSelect;