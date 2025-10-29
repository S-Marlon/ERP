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

// Tipos de Uso do Poço (Ex: Industrial, Residencial, Irrigação)
type PocoUso = 'Industrial' | 'Residencial' | 'Irrigação';
type PocoTypeFilter = PocoUso | 'TODOS';

// Definição da interface do Poço
export interface Poco {
    id: number;
    codigo: string; // Código/Identificador do poço (ex: P-001/ATB)
    localizacao: string; // Endereço ou referência geográfica
    vazao: number; // Vazão em m³/h (simulada)
    uso: PocoUso;
    status: 'Operacional' | 'Manutenção' | 'Inativo';
    fk_cliente_id: number; // Chave estrangeira para o Cliente proprietário
}

// Props para o componente PocoSelect
interface PocoSelectProps {
    pocoSelecionado: Poco | null;
    onPocoSelecionadoChange: (poco: Poco | null) => void;
    isLoading?: boolean;
}

// Tipos de Abas de Busca para Poço
type PocoTabKey = 'codigo' | 'localizacao' | 'fk_cliente_id' | 'status';

// Mapeamento para exibir os labels
const pocoTabLabels: Record<PocoTabKey, string> = {
    codigo: 'Código',
    localizacao: 'Localização',
    fk_cliente_id: 'ID Cliente',
    status: 'Status',
};

// Simulação de um banco de dados local (Poços)
const pocosMockData: Poco[] = [
    { id: 201, codigo: 'P-001/ATB', localizacao: 'Rua das Flores, 100 - Atibaia', vazao: 15.2, uso: 'Residencial', status: 'Operacional', fk_cliente_id: 1 }, // Cliente ID 1
    { id: 202, codigo: 'P-002/SP', localizacao: 'Av. Paulista, 1000 - São Paulo', vazao: 50.0, uso: 'Industrial', status: 'Manutenção', fk_cliente_id: 3 }, // Cliente ID 3
    { id: 203, codigo: 'P-003/IRR', localizacao: 'Fazenda Oeste - Bragança', vazao: 120.5, uso: 'Irrigação', status: 'Operacional', fk_cliente_id: 5 }, // Cliente ID 5
    { id: 204, codigo: 'P-004/ATB', localizacao: 'Estrada Velha, 50 - Atibaia', vazao: 10.0, uso: 'Residencial', status: 'Inativo', fk_cliente_id: 1 }, // Cliente ID 1
];

/**
 * Função de busca no "banco de dados" (simulada)
 */
const fetchPocos = async (): Promise<Poco[]> => {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve(pocosMockData);
        }, 300);
    });
};

// ----------------- COMPONENTE -----------------

const PocoSelectTabs: React.FC<PocoSelectProps> = ({
    pocoSelecionado,
    onPocoSelecionadoChange,
    isLoading: propIsLoading = false,
}) => {
    const [activeTab, setActiveTab] = useState<PocoTabKey>('codigo');
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState<Poco[]>([]);
    const [internalLoading, setInternalLoading] = useState(false);

    // Estado: Filtro por tipo de uso do Poço
    const [pocoTypeFilter, setPocoTypeFilter] = useState<PocoTypeFilter>('TODOS');

    // Estado Crucial: Controle de visibilidade do dropdown de busca
    const [isSearchVisible, setIsSearchVisible] = useState(false);

    const isLoading = propIsLoading || internalLoading;

    // Handler para mostrar/ocultar a área de busca
    const toggleSearchVisibility = () => {
        setIsSearchVisible(prev => !prev);
    };

    /**
     * Função de busca e filtragem para Poços
     */
    const executeSearch = useCallback(async (query: string, tab: PocoTabKey, typeFilter: PocoTypeFilter) => {
        // Regra de busca curta, exceto para busca por status
        if (query.length < 3 && query.length !== 0 && tab !== 'status') {
            setSearchResults([]);
            return;
        }

        setInternalLoading(true);
        try {
            const allData = await fetchPocos();

            const lowerQuery = query.toLowerCase().replace(/[^a-z0-9]/g, '');

            const filteredData = allData.filter(poco => {
                // Filtro 1: Tipo de Uso
                if (typeFilter !== 'TODOS' && poco.uso !== typeFilter) {
                    return false;
                }

                // Filtro 2: Termo de Busca (depende da aba ativa)
                if (!query) return true;

                let valueToSearch: string | number;

                if (tab === 'fk_cliente_id') {
                    // Busca por ID do Cliente
                    valueToSearch = String(poco.fk_cliente_id);
                } else if (tab === 'status') {
                    // Busca por Status
                    valueToSearch = poco.status;
                    return valueToSearch.toLowerCase().includes(query.toLowerCase());
                } else {
                    // Busca por Código ou Localização
                    valueToSearch = poco[tab];
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
            console.error('Erro ao buscar poços:', error);
            setSearchResults([]);
        } finally {
            setInternalLoading(false);
        }
    }, []);

    // Hook para executar a busca com debounce (500ms)
    useEffect(() => {
        const handler = setTimeout(() => {
            if (isSearchVisible && (searchTerm || pocoTypeFilter !== 'TODOS')) {
                executeSearch(searchTerm, activeTab, pocoTypeFilter);
            }
        }, 500);

        return () => {
            clearTimeout(handler);
        };
    }, [searchTerm, activeTab, pocoTypeFilter, executeSearch, isSearchVisible]);

    // Handlers
    const handleTabChange = (tab: PocoTabKey) => {
        setActiveTab(tab);
        setSearchTerm('');
    };

    const handleTypeFilterChange = (type: PocoTypeFilter) => {
        setPocoTypeFilter(type);
        setSearchTerm('');
    };

    const handlePocoSelect = useCallback((poco: Poco) => {
        onPocoSelecionadoChange(poco);
        setIsSearchVisible(false);
    }, [onPocoSelecionadoChange]);

    const handleClearSelection = useCallback(() => {
        onPocoSelecionadoChange(null);
        setIsSearchVisible(true);
    }, [onPocoSelecionadoChange]);

    const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(event.target.value);
    };

    // ----------------- FUNÇÕES DE AUXÍLIO NA RENDERIZAÇÃO -----------------
    
    const getStatusColor = (status: Poco['status']): string => {
        switch (status) {
            case 'Operacional': return 'success';
            case 'Manutenção': return 'warning';
            case 'Inativo': return 'danger';
            default: return 'default';
        }
    }

    // ----------------- RENDERIZAÇÃO -----------------

    return (
        <Card className="poco-select-card">
            <FlexGridContainer layout='flex' justifyContent='space-between' alignItems='center'>
                <Typography variant="h3" >** Busca de Poço**</Typography>
                <Link to="/pocos/novo" className='new-action-link'><Button variant='primary'>+ Novo Poço</Button></Link>
            </FlexGridContainer>

            ---
            
            {/* --- SELEÇÃO/DISPLAY DO POÇO --- */}
            <SelectionBox
                onClick={toggleSearchVisibility}
                status={pocoSelecionado ? "selected" : "placeholder"}
                isSearchVisible={isSearchVisible}
            > 
                {pocoSelecionado ? (
                    <FlexGridContainer layout='flex' template='column'>
                        <FlexGridContainer layout='flex' justifyContent='space-between' alignItems='flex-start' >
                            <Fieldset legend={`Poço Selecionado (${pocoSelecionado.uso}):`} variant='basic'>
                                <Typography variant="strong">{pocoSelecionado.codigo}</Typography>
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
                            <Fieldset legend='Localização' variant='basic'>
                                <Typography variant="strong"> {pocoSelecionado.localizacao}</Typography>
                            </Fieldset>
                            <Fieldset legend='Vazão (m³/h)' variant='basic'>
                                <Typography variant="strong">{pocoSelecionado.vazao.toFixed(1)}</Typography>
                            </Fieldset>
                            <Fieldset legend='Status' variant='basic'>
                                <Badge color={getStatusColor(pocoSelecionado.status)}><Typography variant='strong'>{pocoSelecionado.status}</Typography></Badge>
                            </Fieldset>
                        </FlexGridContainer>
                        <Fieldset legend='Cliente Proprietário ID' variant='basic' style={{marginTop: '10px'}}>
                            <Typography variant="small">ID: {pocoSelecionado.fk_cliente_id}</Typography>
                        </Fieldset>
                    </FlexGridContainer>
                ) : (
                    <FlexGridContainer layout='flex' template='row' justifyContent='space-between'>
                        <span>{isSearchVisible ? 'Clique para fechar' : 'Clique para buscar ou selecionar um poço...'}</span>
                        <button>{isSearchVisible ? '⬆️' : '⬇️'}</button>
                    </FlexGridContainer>
                )}
            </SelectionBox>

            {/* --- DROPDOWN/ÁREA DE BUSCA CONDICIONAL --- */}
            {isSearchVisible && (
                <SearchDropdown>
                    {/* Switch Tipo de Uso */}
                    <Fieldset variant='basic' legend='Uso do Poço'>
                        <TypeSwitch>
                            {(['Industrial', 'Residencial', 'Irrigação', 'TODOS'] as PocoTypeFilter[]).map(type => (
                                <Button
                                    key={type}
                                    variant="switch"
                                    active={pocoTypeFilter === type}
                                    onClick={() => handleTypeFilterChange(type)}
                                    disabled={isLoading}
                                >
                                    {type}
                                </Button>
                            ))}
                        </TypeSwitch>
                    </Fieldset>

                    {/* Abas de Busca */}
                    <Fieldset variant='basic' legend='Buscar Poço por:' style={{ display: 'flex', justifyContent: 'space-between' }}>
                        {(Object.keys(pocoTabLabels) as PocoTabKey[]).map(tab => (
                            <TabButton
                                key={tab}
                                label={pocoTabLabels[tab]}
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
                        placeholder={`Buscar Poço por ${pocoTabLabels[activeTab]}...`}
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
                            searchResults.map((poco) => (
                                <ResultItem
                                    key={poco.id}
                                    onClick={() => handlePocoSelect(poco)}
                                    selected={poco.id === pocoSelecionado?.id}
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
                            ))
                        ) : (
                            <Typography variant="pMuted">Nenhum poço encontrado com este filtro...</Typography>
                        )}
                    </ResultsList>
                </SearchDropdown>
            )}
        </Card>
    );
};

export default PocoSelectTabs;