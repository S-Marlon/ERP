import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import Button from '../../ui/Button';
import FlexGridContainer from '../../Layout/FlexGridContainer/FlexGridContainer';
import Typography from '../../ui/Typography';
import Card from '../../ui/Card';
import SelectionBox from '../../ui/SelectionBox';
import SearchDropdown from '../../ui/SearchDropdown';
import TypeSwitch from '../../ui/TypeSwitch';
import TabButton from '../../ui/TabButton';
import ResultsList from '../../ui/ResultsList';
import ResultItem from '../../ui/ResultItem';
import Badge from '../../ui/Badge';
import Fieldset from '../../ui/Fieldset';
import FormControl from '../../ui/FormControl';

// 🚨 IMPORTAÇÃO DO MOCK CENTRALIZADO
// Ajuste o caminho conforme a estrutura real do seu projeto!
import { CONTRATOS_MOCK, ContratoMock } from '../../../data/entities/clients'; 

// ----------------- TIPOS E DADOS -----------------

// Tipos de Contrato (Ajustado para bater com o mock e a lógica de filtro)
type ContratoTipo = 'Serviço' | 'Obra' | 'Fornecimento'; // Mantido para o filtro de Tipo (se não vier do mock, injetamos)
type ContratoTypeFilter = ContratoTipo | 'TODOS';

// Definição da interface que o COMPONENTE ESPERA (fazemos o mapeamento do mock para esta interface)
interface Contrato {
    id: string; // Vem de ContratoMock.id
    numero: string; // Campo obrigatório para a aba 'numero'. Mapeado de titulo, ou simulado.
    titulo: string; // Vem de ContratoMock.titulo
    dataAssinatura: string; // Vem de ContratoMock.dataAssinatura
    valor: number; // Mapeado de ContratoMock.valorTotal
    tipo: ContratoTipo; // Simulado, já que o mock não tem este campo.
    status: 'Ativo' | 'Concluido' | 'Cancelado' | 'Pendente'; // Mapeado de ContratoMock.status
    fk_cliente_id: number; // Mapeado/convertido de ContratoMock.clienteId
}

// Props para o componente ContratoSelect
interface ContratoSelectProps {
    contratoSelecionado: Contrato | null;
    onContratoSelecionadoChange: (contrato: Contrato | null) => void;
    isLoading?: boolean;
}

// Tipos de Abas de Busca para Contrato
type ContratoTabKey = 'numero' | 'titulo' | 'fk_cliente_id' | 'status';

// Mapeamento para exibir os labels
const contratoTabLabels: Record<ContratoTabKey, string> = {
    numero: 'Número', // Será mapeado para o ID do contrato ou um valor simulado
    titulo: 'Título',
    fk_cliente_id: 'ID Cliente',
    status: 'Status',
};

// 🚨 FUNÇÃO DE ADAPTAÇÃO: Usa o mock importado e o transforma na interface Contrato
const fetchContratos = async (): Promise<Contrato[]> => {
    return new Promise((resolve) => {
        setTimeout(() => {
            const mappedContratos: Contrato[] = CONTRATOS_MOCK.map((mock, index) => {
                // Simulação dos campos que faltam no mock: 'numero' e 'tipo'
                const tipoSimulado: ContratoTipo = index % 3 === 0 ? 'Serviço' : index % 3 === 1 ? 'Obra' : 'Fornecimento';
                
                // Conversão de 'cli-001' para 1. Usamos 0 se for undefined/null.
                const clienteIdNumber = mock.clienteId 
                    ? Number(mock.clienteId.replace('cli-', '')) 
                    : 0; 

                // Usamos o ID do mock como 'numero' para busca.
                const numeroSimulado = mock.id.replace('cont-', 'C-2024/');
                
                return {
                    id: mock.id,
                    numero: numeroSimulado, // Mapeado/Simulado
                    titulo: mock.titulo,
                    dataAssinatura: mock.dataAssinatura || 'N/A',
                    valor: mock.valorTotal ?? 0, // Usa 0 se for undefined
                    tipo: tipoSimulado, // Simulado
                    status: mock.status ?? 'Pendente', // Usa 'Pendente' se for undefined
                    fk_cliente_id: clienteIdNumber, // Mapeado/Convertido
                } as Contrato; 
            });

            resolve(mappedContratos);
        }, 300);
    });
};

// ----------------- COMPONENTE -----------------

const ContratoSelectTabs: React.FC<ContratoSelectProps> = ({
    contratoSelecionado,
    onContratoSelecionadoChange,
    isLoading: propIsLoading = false,
}) => {
    const [activeTab, setActiveTab] = useState<ContratoTabKey>('numero');
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState<Contrato[]>([]);
    const [internalLoading, setInternalLoading] = useState(false);

    // Estado: Filtro por tipo de contrato (Serviço, Obra, etc.)
    const [contractTypeFilter, setContractTypeFilter] = useState<ContratoTypeFilter>('TODOS');

    // Estado Crucial: Controle de visibilidade do dropdown de busca
    const [isSearchVisible, setIsSearchVisible] = useState(false);

    const isLoading = propIsLoading || internalLoading;

    // Handler para mostrar/ocultar a área de busca
    const toggleSearchVisibility = () => {
        setIsSearchVisible(prev => !prev);
    };

    /**
     * Função de busca e filtragem para Contratos
     */
    const executeSearch = useCallback(async (query: string, tab: ContratoTabKey, typeFilter: ContratoTypeFilter) => {
        // Limita a busca se a query for muito curta, exceto para busca por status
        if (query.length < 3 && query.length !== 0 && tab !== 'status') {
            setSearchResults([]);
            return;
        }

        setInternalLoading(true);
        try {
            // 🚀 Chama a função que simula o fetch e ADAPTA OS DADOS
            const allData = await fetchContratos(); 

            const lowerQuery = query.toLowerCase().replace(/[^a-z0-9]/g, '');

            const filteredData = allData.filter(contrato => {
                // Filtro 1: Tipo de Contrato (Serviço/Obra/Fornecimento)
                if (typeFilter !== 'TODOS' && contrato.tipo !== typeFilter) {
                    return false;
                }

                // Filtro 2: Termo de Busca (depende da aba ativa)
                if (!query) return true;

                let valueToSearch: string | number;

                if (tab === 'fk_cliente_id') {
                    // Busca por ID do Cliente
                    valueToSearch = String(contrato.fk_cliente_id);
                } else if (tab === 'status') {
                    // Busca por Status (não remove caracteres especiais/espaços)
                    valueToSearch = contrato.status;
                    return valueToSearch.toLowerCase().includes(query.toLowerCase());
                } else {
                    // Busca por Número ou Título
                    valueToSearch = contrato[tab];
                }

                if (typeof valueToSearch === 'string' || typeof valueToSearch === 'number') {
                    const stringValue = String(valueToSearch);
                    const cleanedValue = stringValue.toLowerCase().replace(/[^a-z0-9]/g, '');
                    return cleanedValue.includes(lowerQuery);
                }
                return false;
            });

            setSearchResults(filteredData);
        } catch (error) {
            console.error('Erro ao buscar contratos:', error);
            setSearchResults([]);
        } finally {
            setInternalLoading(false);
        }
    }, []);

    // Hook para executar a busca com debounce (500ms)
    useEffect(() => {
        const handler = setTimeout(() => {
            if (isSearchVisible && (searchTerm || contractTypeFilter !== 'TODOS')) {
                executeSearch(searchTerm, activeTab, contractTypeFilter);
            }
        }, 500);

        return () => {
            clearTimeout(handler);
        };
    }, [searchTerm, activeTab, contractTypeFilter, executeSearch, isSearchVisible]);

    // Handlers
    const handleTabChange = (tab: ContratoTabKey) => {
        setActiveTab(tab);
        setSearchTerm(''); 
    };

    const handleTypeFilterChange = (type: ContratoTypeFilter) => {
        setContractTypeFilter(type);
        setSearchTerm(''); 
    };

    const handleContratoSelect = useCallback((contrato: Contrato) => {
        onContratoSelecionadoChange(contrato);
        setIsSearchVisible(false);
    }, [onContratoSelecionadoChange]);

    const handleClearSelection = useCallback(() => {
        onContratoSelecionadoChange(null);
        setIsSearchVisible(true);
    }, [onContratoSelecionadoChange]);

    const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(event.target.value);
    };

    // ----------------- FUNÇÕES DE AUXÍLIO NA RENDERIZAÇÃO -----------------

    const formatCurrency = (value: number) => 
        new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    
    // Mapeamento de cor para status do NOVO MOCK
    const getStatusColor = (status: Contrato['status']): string => {
        switch (status) {
            case 'Ativo': return 'success';
            case 'Pendente': return 'warning';
            case 'Concluido': return 'default';
            case 'Cancelado': return 'danger';
            default: return 'default';
        }
    }

    // ----------------- RENDERIZAÇÃO -----------------

    return (
        <Card className="contrato-select-card">
            <FlexGridContainer layout='flex' justifyContent='space-between' alignItems='center'>
                <Typography variant="h3" >** Busca de Contrato**</Typography>
                <Link to="/contratos/novo" className='new-action-link'><Button variant='primary'>+ Novo Contrato</Button></Link>
            </FlexGridContainer>

            ---
            
            {/* --- SELEÇÃO/DISPLAY DO CONTRATO --- */}
            <SelectionBox
                onClick={toggleSearchVisibility}
                status={contratoSelecionado ? "selected" : "placeholder"}
                isSearchVisible={isSearchVisible}
            > 
                {contratoSelecionado ? (
                    <FlexGridContainer layout='flex' template='column'>
                        <FlexGridContainer layout='flex' justifyContent='space-between' alignItems='flex-start' >
                            <Fieldset legend={`Contrato Selecionado (${contratoSelecionado.tipo}):`} variant='basic'>
                                <Typography variant="strong">{contratoSelecionado.titulo}</Typography>
                            </Fieldset>
                            <Button
                                variant='danger'
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleClearSelection();
                                }}
                                disabled={isLoading}
                            >
                                Limpar Seleção
                            </Button>
                        </FlexGridContainer>

                        <FlexGridContainer layout='flex' justifyContent='space-between' style={{marginTop: '10px'}}>
                            <Fieldset legend='Número/ID' variant='basic'>
                                <Typography variant="strong">{contratoSelecionado.numero}</Typography>
                            </Fieldset>
                            <Fieldset legend='Valor Estimado' variant='basic'>
                                <Typography variant="strong">{formatCurrency(contratoSelecionado.valor)}</Typography>
                            </Fieldset>
                            <Fieldset legend='Status' variant='basic'>
                                <Badge color={getStatusColor(contratoSelecionado.status)}><Typography variant='strong'>{contratoSelecionado.status}</Typography></Badge>
                            </Fieldset>
                        </FlexGridContainer>
                    </FlexGridContainer>
                ) : (
                    <FlexGridContainer layout='flex' template='row' justifyContent='space-between'>
                        <span>{isSearchVisible ? 'Clique para fechar' : 'Clique para buscar ou selecionar um contrato...'}</span>
                        <button>{isSearchVisible ? '⬆️' : '⬇️'}</button>
                    </FlexGridContainer>
                )}
            </SelectionBox>

            {/* --- DROPDOWN/ÁREA DE BUSCA CONDICIONAL --- */}
            {isSearchVisible && (
                <SearchDropdown>
                    {/* Switch Tipo de Contrato */}
                    <Fieldset variant='basic' legend='Tipo de Contrato'>
                        <TypeSwitch>
                            {(['Serviço', 'Obra', 'Fornecimento', 'TODOS'] as ContratoTypeFilter[]).map(type => (
                                <Button
                                    key={type}
                                    variant="switch"
                                    active={contractTypeFilter === type}
                                    onClick={() => handleTypeFilterChange(type)}
                                    disabled={isLoading}
                                >
                                    {type}
                                </Button>
                            ))}
                        </TypeSwitch>
                    </Fieldset>

                    {/* Abas de Busca */}
                    <Fieldset variant='basic' legend='Buscar Contrato por:' style={{ display: 'flex', justifyContent: 'space-between' }}>
                        {(Object.keys(contratoTabLabels) as ContratoTabKey[]).map(tab => (
                            <TabButton
                                key={tab}
                                label={contratoTabLabels[tab]}
                                isActive={activeTab === tab}
                                onClick={() => handleTabChange(tab)}
                                disabled={isLoading}
                                variant='tab'
                            />
                        ))}
                    </Fieldset>
                    
                    {/* Input de Busca */}
                    <FormControl label=''
                        type="text"
                        placeholder={`Buscar Contrato por ${contratoTabLabels[activeTab]}...`}
                        value={searchTerm}
                        onChange={handleSearchChange}
                        disabled={isLoading} 
                    />

                    <br />

                    {/* Lista de Resultados */}
                    <ResultsList>
                        {isLoading ? (
                            <Typography variant="p">Carregando resultados...</Typography>
                        ) : searchResults.length > 0 ? (
                            searchResults.map((contrato) => (
                                <ResultItem
                                    key={contrato.id}
                                    onClick={() => handleContratoSelect(contrato)}
                                    selected={contrato.id === contratoSelecionado?.id}
                                >
                                    <div className='flex-row' style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                                        <Typography variant="strong">**{contrato.numero}** - {contrato.titulo}</Typography>
                                        <Badge color={getStatusColor(contrato.status)}><Typography variant='strong'>{contrato.status}</Typography></Badge>
                                    </div>
                                    <FlexGridContainer layout='flex' justifyContent="space-between" style={{ marginTop: '5px' }}>
                                        <Typography variant="small">Tipo: {contrato.tipo}</Typography>
                                        <Typography variant="small">Valor: {formatCurrency(contrato.valor)}</Typography>
                                        <Typography variant="small">Cliente ID: {contrato.fk_cliente_id}</Typography>
                                    </FlexGridContainer>
                                </ResultItem>
                            ))
                        ) : (
                            <Typography variant="pMuted">Nenhum contrato encontrado com este filtro...</Typography>
                        )}
                    </ResultsList>
                </SearchDropdown>
            )}
        </Card>
    );
};

export default ContratoSelectTabs;