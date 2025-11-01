import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';

// IMPORTAÇÕES DE MOCKS E INTERFACES
import { CLIENTES_MOCK, ClienteMock } from '../../../data/entities/clients';

// IMPORTAÇÕES DE UI (Assumindo que estão corretas)
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

// ----------------------------------------------------
// DEFINIÇÕES E LÓGICA DE DADOS
// ----------------------------------------------------

// 1. Tipos de Cliente (PF/PJ)
type ClienteTipo = 'CPF' | 'CNPJ';
type ClienteTypeFilter = ClienteTipo | 'AMBOS';

// 2. A interface Cliente já é importada como ClienteMock. Vamos usá-la.
export type Cliente = ClienteMock; // Alias para simplificar o uso em outros componentes.

// 3. Props para o componente ClienteSelect - Usando o tipo Cliente (alias de ClienteMock)
export interface ClienteSelectProps {
  clienteSelecionado: Cliente | null;
  onClienteSelecionadoChange: (cliente: Cliente | null) => void;
  isLoading?: boolean;
}

// 4. Tipos de Abas de Busca
type TabKey = 'nome' | 'documento' | 'telefone' | 'email' | 'cep';

// Mapeamento para exibir os labels
const tabLabels: Record<TabKey, string> = {
  nome: 'Nome',
  documento: 'Documento',
  telefone: 'Telefone',
  email: 'E-mail',
  cep: 'CEP',
};

/**
 * SIMULAÇÃO DE SERVIÇO: Função para buscar clientes.
 * Agora utiliza o CLIENTES_MOCK importado.
 */
const fetchClientes = async (): Promise<ClienteMock[]> => {
  return new Promise((resolve) => {
    // Simula um delay de rede
    setTimeout(() => {
      resolve(CLIENTES_MOCK);
    }, 300);
  });
};


// ----------------------------------------------------
// COMPONENTE PRINCIPAL
// ----------------------------------------------------

const ClienteSelectTabs: React.FC<ClienteSelectProps> = ({
  clienteSelecionado,
  onClienteSelecionadoChange,
  isLoading: propIsLoading = false,
}) => {
  const [activeTab, setActiveTab] = useState<TabKey>('nome');
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<Cliente[]>([]);
  const [internalLoading, setInternalLoading] = useState(false);
  const [clientTypeFilter, setClientTypeFilter] = useState<ClienteTypeFilter>('AMBOS');
  const [isSearchVisible, setIsSearchVisible] = useState(false);

  // Usa ClienteMock[]
  const [allClients, setAllClients] = useState<ClienteMock[]>([]);

  const isLoading = propIsLoading || internalLoading;

  // Carregar clientes centralizados ao montar
  useEffect(() => {
    let mounted = true;
    setInternalLoading(true);

    (async () => {
      try {
        // Agora, fetchClientes está definido
        const data = await fetchClientes();
        if (mounted) setAllClients(data);
      } catch (err) {
        console.error("Falha ao carregar mock de clientes:", err);
        if (mounted) setAllClients([]);
      } finally {
        if (mounted) setInternalLoading(false);
      }
    })();

    return () => { mounted = false; };
  }, []);

  const toggleSearchVisibility = () => {
    setIsSearchVisible(prev => !prev);
  };

  /**
   * Função de busca e filtragem (usa allClients carregados)
   */
  const executeSearch = useCallback(async (query: string, tab: TabKey, typeFilter: ClienteTypeFilter) => {
    if (query.length < 3 && query.length !== 0) {
      setSearchResults([]);
      return;
    }

    setInternalLoading(true);
    try {
      const data = allClients;

      const lowerQuery = query.toLowerCase().replace(/[^a-z0-9]/g, '');

      const filteredData = (data ?? []).filter(cliente => {
        // Filtro 1: Tipo de Cliente
        if (typeFilter !== 'AMBOS' && cliente.tipo !== typeFilter) {
          return false;
        }

        // Filtro 2: Termo de Busca
        if (!query) return true;

        const valueToSearch = (cliente as any)[tab];

        if (typeof valueToSearch === 'string' || typeof valueToSearch === 'number') {
            const stringValue = String(valueToSearch);
            const cleanedValue = stringValue.toLowerCase().replace(/[^a-z0-9]/g, '');
            return cleanedValue.includes(lowerQuery);
        }
        return false;
      });

      setSearchResults(filteredData);
    } catch (error) {
      console.error('Erro ao buscar clientes:', error);
      setSearchResults([]);
    } finally {
      setInternalLoading(false);
    }
  }, [allClients]);

  // debounce-like effect para busca
  useEffect(() => {
    const handler = setTimeout(() => {
      // Garante que a busca só é executada se houver termo OU se o filtro de tipo mudar
      if (isSearchVisible && (searchTerm.length >= 3 || searchTerm.length === 0) || clientTypeFilter !== 'AMBOS') {
        executeSearch(searchTerm, activeTab, clientTypeFilter);
      }
    }, 300);

    return () => clearTimeout(handler);
  }, [searchTerm, activeTab, clientTypeFilter, executeSearch, isSearchVisible]);

  // Handlers simples
  const handleTabChange = (tab: TabKey) => {
    setActiveTab(tab);
    setSearchTerm('');
  };

  const handleTypeFilterChange = (type: ClienteTypeFilter) => {
    setClientTypeFilter(type);
    setSearchTerm('');
  };

  const handleClienteSelect = useCallback((cliente: Cliente) => {
    onClienteSelecionadoChange(cliente);
    setIsSearchVisible(false);
  }, [onClienteSelecionadoChange]);

  const handleClearSelection = useCallback(() => {
    onClienteSelecionadoChange(null);
    setIsSearchVisible(true);
  }, [onClienteSelecionadoChange]);

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
  };

  // ----------------------------------------------------
  // RENDERIZAÇÃO
  // ----------------------------------------------------

  return (
    <Card className="cliente-select-card">
      <FlexGridContainer layout='flex' justifyContent='space-between' alignItems='center'>
        <Typography variant="h3" >** Busca de Cliente**</Typography>
        <Link to="/clientes/novo" className='new-action-link'><Button variant='primary'>+ Novo Cliente</Button></Link>
      </FlexGridContainer>
      
      <hr style={{margin: '10px 0'}} />

      <SelectionBox
        onClick={toggleSearchVisibility}
        status={clienteSelecionado ? "selected" : "placeholder"}
        isSearchVisible={isSearchVisible}
      >
        {clienteSelecionado ? (
          <FlexGridContainer layout='flex' template='column' gap='10px'>
            <FlexGridContainer layout='flex' justifyContent='space-between' alignItems='flex-start' >
              <Fieldset legend={`Cliente Selecionado (${clienteSelecionado.tipo}):`} variant='basic'>
                <Typography variant="strong">{clienteSelecionado.nome}</Typography>
              </Fieldset>
              <Button
                variant='danger'
                onClick={(e) => { e.stopPropagation(); handleClearSelection(); }}
                disabled={isLoading}
              >
                 Limpar Seleção
              </Button>
            </FlexGridContainer>

            {/* Detalhes do Cliente Selecionado */}
            <FlexGridContainer layout='flex' justifyContent='space-between' gap='15px'>
                <Fieldset legend='Documento' variant='basic'>
                  <Typography variant="strong">{clienteSelecionado.documento}</Typography>
                </Fieldset>
                <Fieldset legend='Telefone' variant='basic'>
                  <Typography variant="strong">{clienteSelecionado.telefone || 'N/A'}</Typography>
                </Fieldset>
                <Fieldset legend='CEP' variant='basic'>
                  <Typography variant="strong">{clienteSelecionado.cep || 'N/A'}</Typography>
                </Fieldset>
            </FlexGridContainer>
            
            {/* O campo 'Cidade' não existe no mock, remova ou insira um placeholder */}
            <Fieldset legend='E-mail' variant='basic'>
              <Typography variant="small">{clienteSelecionado.email || 'N/A'}</Typography>
            </Fieldset>

          </FlexGridContainer>
        ) : (
          <FlexGridContainer layout='flex' template='row' justifyContent='space-between' alignItems='center' >
            <span>{isSearchVisible ? 'Clique para fechar' : 'Clique para buscar ou selecionar um cliente...'}</span>
            <button style={{ fontSize: '1.2em' }}>{isSearchVisible ? '⬆️' : '⬇️'}</button>
          </FlexGridContainer>
        )}
      </SelectionBox>

      {isSearchVisible && (
        <SearchDropdown>
          {/* Filtro de Tipo de Cliente */}
          <Fieldset variant='basic' legend='Tipo de Cliente'>
            <TypeSwitch>
              {(['CPF', 'CNPJ', 'AMBOS'] as ClienteTypeFilter[]).map(type => (
                <Button
                  key={type}
                  variant="switch"
                  active={clientTypeFilter === type}
                  onClick={() => handleTypeFilterChange(type)}
                  disabled={isLoading}
                >
                  {type === 'AMBOS' ? 'Ambos' : type}
                </Button>
              ))}
            </TypeSwitch>
          </Fieldset>
          
          {/* Abas de Busca */}
          <Fieldset variant='basic' legend='Buscar Cliente por:' style={{ display: 'flex', justifyContent: 'space-between' }}>
            {(Object.keys(tabLabels) as TabKey[]).map(tab => {
              const conditionalLabel =
                tab === 'documento'
                  ? (clientTypeFilter === 'AMBOS' ? 'CPF/CNPJ' : clientTypeFilter)
                  : tabLabels[tab];

              return (
                <TabButton
                  key={tab}
                  label={conditionalLabel}
                  isActive={activeTab === tab}
                  onClick={() => handleTabChange(tab)}
                  disabled={isLoading}
                  variant='tab'
                />
              );
            })}
          </Fieldset>

          {/* Input de Busca */}
          <FormControl
            label=''
            type="text"
            placeholder={`Buscar ${clientTypeFilter === 'AMBOS' ? 'CPF/CNPJ' : clientTypeFilter} por ${tabLabels[activeTab]}...`}
            value={searchTerm}
            onChange={handleSearchChange}
            disabled={isLoading}
          />

          <br />
          
          {/* Resultados */}
          <ResultsList>
            {isLoading ? (
              <Typography variant="pMuted">Carregando resultados...</Typography>
            ) : searchResults.length > 0 ? (
              searchResults.map((cliente) => (
                <ResultItem
                  key={cliente.id}
                  onClick={() => handleClienteSelect(cliente)}
                  selected={cliente.id === clienteSelecionado?.id}
                >
                  <div className='flex-row' style={{ justifyContent: 'space-between' }}>
                    <Typography variant="strong">**{cliente.nome}** ({cliente.tipo})</Typography>
                    <Typography variant="pMuted">{cliente.documento}</Typography>
                  </div>
                  <FlexGridContainer layout='flex' justifyContent="space-between" style={{ marginTop: '5px' }}>
                    <Typography variant="small">E-mail: {cliente.email}</Typography>
                    <Typography variant="small">Tel: {cliente.telefone}</Typography>
                    <div>
                      {/* Placeholders visuais para Contrato e Poço (Ajustei as cores) */}
                      <Badge color='info'><Typography variant='strong'>1 Contrato</Typography></Badge>
                      <Badge color='warning' style={{ marginLeft: 6 }}><Typography variant='strong'>2 Poços</Typography></Badge>
                    </div>
                  </FlexGridContainer>
                </ResultItem>
              ))
            ) : (
              <Typography variant="pMuted">Nenhum cliente encontrado com este filtro...</Typography>
            )}
          </ResultsList>
        </SearchDropdown>
      )}
    </Card>
  );
};

export default ClienteSelectTabs;
