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

// ----------------- TIPOS E DADOS -----------------

// Tipos de Contrato (Ex: Serviço, Obra, Fornecimento)
type ContratoTipo = 'Serviço' | 'Obra' | 'Fornecimento';
type ContratoTypeFilter = ContratoTipo | 'TODOS';

// Definição da interface do Contrato
interface Contrato {
    id: number;
    numero: string; // Número do contrato (ex: C-2023/001)
    titulo: string; // Título/Descrição
    dataInicio: string;
    valor: number;
    tipo: ContratoTipo;
    status: 'Ativo' | 'Inativo' | 'Pendente';
    fk_cliente_id: number; // Chave estrangeira para o Cliente
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
    numero: 'Número',
    titulo: 'Título',
    fk_cliente_id: 'ID Cliente',
    status: 'Status',
};

// Simulação de um banco de dados local (Contratos)
const contratosMockData: Contrato[] = [
    { id: 101, numero: 'C-2023/001', titulo: 'Contrato de Manutenção Anual', dataInicio: '2023-01-01', valor: 12000.50, tipo: 'Serviço', status: 'Ativo', fk_cliente_id: 1 }, // Cliente ID 1
    { id: 102, numero: 'C-2023/002', titulo: 'Obra de Expansão - Galpão Novo', dataInicio: '2023-03-15', valor: 85000.00, tipo: 'Obra', status: 'Pendente', fk_cliente_id: 3 }, // Cliente ID 3
    { id: 103, numero: 'C-2023/003', titulo: 'Fornecimento de Peças - Q2', dataInicio: '2023-07-20', valor: 3500.00, tipo: 'Fornecimento', status: 'Ativo', fk_cliente_id: 4 }, // Cliente ID 4
    { id: 104, numero: 'C-2023/004', titulo: 'Manutenção Mensal de Equipamentos', dataInicio: '2023-11-01', valor: 2500.00, tipo: 'Serviço', status: 'Ativo', fk_cliente_id: 1 }, // Cliente ID 1
];

/**
 * Função de busca no "banco de dados" (simulada)
 */
const fetchContratos = async (): Promise<Contrato[]> => {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve(contratosMockData);
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
        setSearchTerm(''); // Limpa o termo ao mudar a aba
    };

    const handleTypeFilterChange = (type: ContratoTypeFilter) => {
        setContractTypeFilter(type);
        setSearchTerm(''); // Limpa o termo ao mudar o filtro de tipo
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
    
    const getStatusColor = (status: Contrato['status']): string => {
        switch (status) {
            case 'Ativo': return 'success';
            case 'Pendente': return 'warning';
            case 'Inativo': return 'danger';
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