import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';

// IMPORTAÇÕES DE UI (Manter o estilo e layout)
import Button from './ui/Button/Button';
import FlexGridContainer from './Layout/FlexGridContainer/FlexGridContainer';
import Typography from './ui/Typography/Typography';
import Card from './ui/Card/Card';
import SelectionBox from './ui/SelectionBox';
import SearchDropdown from './ui/SearchDropdown';
import TypeSwitch from './ui/TypeSwitch';
import TabButton from './ui/TabButton/TabButton';
import ResultsList from './ui/ResultsList';
import ResultItem from './ui/ResultItem';
import Badge from './ui/Badge/Badge';
import Fieldset from './ui/Fieldset/Fieldset';
import FormControl from './ui/FormControl/FormControl';

// ----------------------------------------------------
// 1. DEFINIÇÕES GENÉRICAS DE TIPOS
// ----------------------------------------------------

/**
 * TEntity: Tipo da Entidade (Cliente, Contrato, Poço). Deve ter 'id' e ser indexável.
 * TSearchKey: Tipos das chaves de busca (nome, documento, etc.).
 * TFilterKey: Tipos das chaves de filtro de Tipo (CPF/CNPJ, Serviço/Obra, etc.).
 */
export interface EntitySelectProps<TEntity extends { id: string | number }, TSearchKey extends string, TFilterKey extends string> {
  // Dados obrigatórios
  entitySelecionada: TEntity | null;
  onEntitySelecionadaChange: (entity: TEntity | null) => void;
  title: string;
  newEntityLink: string;
  newEntityLabel: string;
  
  // Lógica de Busca e Filtro
  tabLabels: Record<TSearchKey, string>;
  fetchEntities: (query: string, tab: TSearchKey, typeFilter: TFilterKey) => Promise<TEntity[]>;
  
  // Filtro de Tipo (Ex: PF/PJ, Serviço/Obra, etc.)
  typeFilterOptions?: { key: TFilterKey; label: string; }[];
  defaultTypeFilter: TFilterKey;

  // Renderização Específica
  renderSelectedEntity: (entity: TEntity, handleClear: () => void, isLoading: boolean) => React.ReactNode;
  renderResultItem: (entity: TEntity, isSelected: boolean, handleSelect: (entity: TEntity) => void) => React.ReactNode;

  // Opcionais de UI/Estado
  isLoading?: boolean;
}

// ----------------------------------------------------
// 2. COMPONENTE PRINCIPAL GENÉRICO
// ----------------------------------------------------

// Define o componente usando Generics
const EntitySelectTabs = <TEntity extends { id: string | number }, TSearchKey extends string, TFilterKey extends string>({
  entitySelecionada,
  onEntitySelecionadaChange,
  title,
  newEntityLink,
  newEntityLabel,
  tabLabels,
  fetchEntities,
  typeFilterOptions,
  defaultTypeFilter,
  renderSelectedEntity,
  renderResultItem,
  isLoading: propIsLoading = false,
}: EntitySelectProps<TEntity, TSearchKey, TFilterKey>): React.ReactElement => {

  const [activeTab, setActiveTab] = useState<TSearchKey>(Object.keys(tabLabels)[0] as TSearchKey);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<TEntity[]>([]);
  const [internalLoading, setInternalLoading] = useState(false);
  const [typeFilter, setTypeFilter] = useState<TFilterKey>(defaultTypeFilter);
  const [isSearchVisible, setIsSearchVisible] = useState(false);

  const isLoading = propIsLoading || internalLoading;
  const tabKeys = useMemo(() => Object.keys(tabLabels) as TSearchKey[], [tabLabels]);
  
  const toggleSearchVisibility = () => {
    setIsSearchVisible(prev => !prev);
  };

  const handleEntitySelect = useCallback((entity: TEntity) => {
    onEntitySelecionadaChange(entity);
    setIsSearchVisible(false);
  }, [onEntitySelecionadaChange]);

  const handleClearSelection = useCallback(() => {
    onEntitySelecionadaChange(null);
    // Se não houver entidade selecionada, abre a busca automaticamente
    setIsSearchVisible(true);
  }, [onEntitySelecionadaChange]);

  /**
   * Executa a busca através da prop fetchEntities
   */
  const executeSearch = useCallback(async (query: string, tab: TSearchKey, filter: TFilterKey) => {
    // Regra mínima de 3 caracteres (a menos que não haja query para buscar por filtro)
    if (query.length < 3 && query.length !== 0) {
      setSearchResults([]);
      return;
    }

    setInternalLoading(true);
    try {
      // Chama a função de busca específica da entidade
      const results = await fetchEntities(query, tab, filter);
      setSearchResults(results);
    } catch (error) {
      console.error(`Erro ao buscar ${title}:`, error);
      setSearchResults([]);
    } finally {
      setInternalLoading(false);
    }
  }, [fetchEntities, title]);

  // debounce effect para busca
  useEffect(() => {
    const handler = setTimeout(() => {
      // Executa a busca se a área estiver visível E (tiver query válida OU filtro de tipo aplicado)
      if (isSearchVisible && (searchTerm.length >= 3 || searchTerm.length === 0) || typeFilter !== defaultTypeFilter) {
        executeSearch(searchTerm, activeTab, typeFilter);
      }
    }, 400); // 400ms de debounce

    return () => clearTimeout(handler);
  }, [searchTerm, activeTab, typeFilter, executeSearch, isSearchVisible, defaultTypeFilter]);

  // Handlers simples
  const handleTabChange = (tab: TSearchKey) => {
    setActiveTab(tab);
    setSearchTerm('');
  };

  const handleTypeFilterChange = (key: TFilterKey) => {
    setTypeFilter(key);
    setSearchTerm('');
  };

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
  };

  // ----------------------------------------------------
  // 3. RENDERIZAÇÃO
  // ----------------------------------------------------
  
  return (
    <Card className="entity-select-card">
      <FlexGridContainer layout='flex' justifyContent='space-between' alignItems='center'>
        <Typography variant="h3" >** {title}**</Typography>
        <Link to={newEntityLink} className='new-action-link'><Button variant='primary'>+ {newEntityLabel}</Button></Link>
      </FlexGridContainer>
      
      <hr style={{margin: '10px 0'}} />

      <SelectionBox
        onClick={toggleSearchVisibility}
        status={entitySelecionada ? "selected" : "placeholder"}
        isSearchVisible={isSearchVisible}
      >
        {entitySelecionada ? (
          // Renderiza o conteúdo específico da entidade selecionada
          renderSelectedEntity(entitySelecionada, handleClearSelection, isLoading)
        ) : (
          <FlexGridContainer layout='flex' template='row' justifyContent='space-between' alignItems='center' >
            <span>{isSearchVisible ? 'Clique para fechar' : `Clique para buscar ou selecionar um(a) ${title.toLowerCase().replace('busca de ', '')}...`}</span>
            <button style={{ fontSize: '1.2em' }}>{isSearchVisible ? '⬆️' : '⬇️'}</button>
          </FlexGridContainer>
        )}
      </SelectionBox>

      {isSearchVisible && (
        <SearchDropdown>
          
          {/* 🔍 Filtro de Tipo (Opcional) */}
          {typeFilterOptions && typeFilterOptions.length > 1 && (
            <Fieldset variant='basic' legend='Tipo'>
              <TypeSwitch>
                {typeFilterOptions.map(({ key, label }) => (
                  <Button
                    key={key}
                    variant="switch"
                    active={typeFilter === key}
                    onClick={() => handleTypeFilterChange(key)}
                    disabled={isLoading}
                  >
                    {label}
                  </Button>
                ))}
              </TypeSwitch>
            </Fieldset>
          )}

          {/* 🔍 Abas de Busca */}
          <Fieldset variant='basic' legend='Buscar por:' style={{ display: 'flex', justifyContent: 'space-between' }}>
            {tabKeys.map(tab => (
              <TabButton
                key={tab}
                label={tabLabels[tab]}
                isActive={activeTab === tab}
                onClick={() => handleTabChange(tab)}
                disabled={isLoading}
                variant='tab'
              />
            ))}
          </Fieldset>

          {/* 🔍 Input de Busca */}
          <FormControl
            label=''
            type="text"
            placeholder={`Buscar por ${tabLabels[activeTab]}...`}
            value={searchTerm}
            onChange={handleSearchChange}
            disabled={isLoading}
          />

          <br />
          
          {/* 🔍 Resultados */}
          <ResultsList>
            {isLoading ? (
              <Typography variant="pMuted">Carregando resultados...</Typography>
            ) : searchResults.length > 0 ? (
              searchResults.map((entity) => 
                // Renderiza o item de resultado específico da entidade
                renderResultItem(
                  entity, 
                  entity.id === entitySelecionada?.id, 
                  handleEntitySelect
                )
              )
            ) : (
              <Typography variant="pMuted">Nenhum resultado encontrado...</Typography>
            )}
          </ResultsList>
        </SearchDropdown>
      )}
    </Card>
  );
};

export default EntitySelectTabs;