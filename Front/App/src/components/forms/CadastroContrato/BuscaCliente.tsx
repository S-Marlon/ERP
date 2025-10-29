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

// 1. Tipos de Cliente (PF/PJ)
type ClienteTipo = 'CPF' | 'CNPJ';
type ClienteTypeFilter = ClienteTipo | 'AMBOS';

// 2. Definição da interface do Cliente
interface Cliente {
  id: number;
  nome: string;
  documento: string; // CPF ou CNPJ
  telefone: string;
  email: string;
  cep: string;
  tipo: ClienteTipo; // Novo campo para o tipo de cliente
}

// 3. Props para o componente ClienteSelect
interface ClienteSelectProps {
  clienteSelecionado: Cliente | null;
  onClienteSelecionadoChange: (cliente: Cliente | null) => void;
  isLoading?: boolean;
}

// 4. Tipos de Abas de Busca
type TabKey = 'nome' | 'documento' | 'telefone' | 'email' | 'cep';

// Mapeamento para exibir os labels (Ajustado para 'Documento' genérico)
const tabLabels: Record<TabKey, string> = {
  nome: 'Nome',
  documento: 'Documento', // Valor base, será sobrescrito
  telefone: 'Telefone',
  email: 'E-mail',
  cep: 'CEP',
};

// 5. Simulação de um banco de dados local (mantido como está)
const clientesMockData: Cliente[] = [
  { id: 1, nome: 'João da Silva', documento: '111.222.333-44', telefone: '11988887777', email: 'joao.silva@exemplo.com', cep: '01000-000', tipo: 'CPF' },
  { id: 2, nome: 'Maria Oliveira', documento: '555.666.777-88', telefone: '21977776666', email: 'maria.o@exemplo.com', cep: '20000-000', tipo: 'CPF' },
  { id: 3, nome: 'Tech Solutions LTDA', documento: '00.111.222/0001-33', telefone: '31966665555', email: 'contato@tech.com', cep: '30000-000', tipo: 'CNPJ' },
  { id: 4, nome: 'Comércio ABC S.A.', documento: '99.888.777/0001-66', telefone: '41955554444', email: 'adm@comercioabc.com', cep: '40000-000', tipo: 'CNPJ' },
  { id: 5, nome: 'Ana Costa', documento: '999.888.777-66', telefone: '41955554444', email: 'ana.c@exemplo.com', cep: '40000-000', tipo: 'CPF' },
];

/**
    * 6. Função de busca no "banco de dados" (simulada)
    */
const fetchClientes = async (): Promise<Cliente[]> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(clientesMockData);
    }, 300);
  });
};

const ClienteSelectTabs: React.FC<ClienteSelectProps> = ({
  clienteSelecionado,
  onClienteSelecionadoChange,
  isLoading: propIsLoading = false,
}) => {
  const [activeTab, setActiveTab] = useState<TabKey>('nome');
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<Cliente[]>([]);
  const [internalLoading, setInternalLoading] = useState(false);

  // NOVO ESTADO: Filtro por tipo de cliente (PF, PJ ou AMBOS)
  const [clientTypeFilter, setClientTypeFilter] = useState<ClienteTypeFilter>('AMBOS');

  // NOVO ESTADO CRUCIAL: Controle de visibilidade do dropdown de busca
  const [isSearchVisible, setIsSearchVisible] = useState(false);

  const isLoading = propIsLoading || internalLoading;

  // Handler para mostrar/ocultar a área de busca
  const toggleSearchVisibility = () => {
    setIsSearchVisible(prev => !prev);
  };

  // 7. Função de busca e filtragem (mantida como está)
  const executeSearch = useCallback(async (query: string, tab: TabKey, typeFilter: ClienteTypeFilter) => {
    if (query.length < 3 && query.length !== 0) {
      setSearchResults([]);
      return;
    }

    setInternalLoading(true);
    try {
      const allData = await fetchClientes();

      const lowerQuery = query.toLowerCase().replace(/[^a-z0-9]/g, '');

      const filteredData = allData.filter(cliente => {
        if (typeFilter !== 'AMBOS' && cliente.tipo !== typeFilter) {
          return false;
        }

        if (!query) return true;

        const valueToSearch = cliente[tab];

        if (typeof valueToSearch === 'string') {
          const cleanedValue = valueToSearch.toLowerCase().replace(/[^a-z0-9]/g, '');
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
  }, []);

  // 8. Hook para executar a busca (debounce - mantido como está)
  useEffect(() => {
    const handler = setTimeout(() => {
      if (isSearchVisible && (searchTerm || clientTypeFilter || searchResults.length === 0)) {
        executeSearch(searchTerm, activeTab, clientTypeFilter);
      }
    }, 500);

    return () => {
      clearTimeout(handler);
    };
  }, [searchTerm, activeTab, clientTypeFilter, executeSearch, searchResults.length, isSearchVisible]);

  // Handlers (mantidos como estão)
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

  // 9. Renderização do componente
  return (
    <Card className="cliente-select-card">
      <FlexGridContainer layout='flex' justifyContent='space-between' alignItems='center'>
        <Typography variant="h3" >Busca de Cliente</Typography>
        <Link to="/clientes/novo" className='new-action-link'><Button variant='primary'>+ Novo Cliente</Button></Link>
      </FlexGridContainer>

      {/* --- SELEÇÃO/DISPLAY DO CLIENTE --- (Mantido como está) */}
      <SelectionBox
        onClick={toggleSearchVisibility}
        status={clienteSelecionado ? "selected" : "placeholder"}
        isSearchVisible={isSearchVisible}
      > 
        {clienteSelecionado ? (
          <>
            <FlexGridContainer layout='flex' template='column'>



              <FlexGridContainer layout='flex' justifyContent='space-between' >

                <Fieldset legend={`Cliente Selecionado (${clienteSelecionado.tipo}):`} variant='basic'>

                  <Typography variant="strong">{clienteSelecionado.nome}</Typography>
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
              <FlexGridContainer layout='flex' justifyContent='space-between' >


                <Fieldset legend='Cidade' variant='basic'>
                  <Typography variant="strong"> Atibaia - SP </Typography>
                </Fieldset>


                <Fieldset legend='Documento' variant='basic'>

                  <Typography variant="strong">{clienteSelecionado.documento}</Typography>
                </Fieldset>
              </FlexGridContainer>

              <FlexGridContainer layout='flex' justifyContent='space-between' >
                <Fieldset legend='telefone' variant='basic'>

                  <Typography variant="strong">{clienteSelecionado.telefone}</Typography>
                </Fieldset>

                <Fieldset legend='cep' variant='basic'>

                  <Typography variant="strong">{clienteSelecionado.cep}</Typography>
                </Fieldset>

              </FlexGridContainer>


            </FlexGridContainer>
          </>
        ) : (
          <FlexGridContainer layout='flex' template='row' justifyContent='space-between' 
            >
            {isSearchVisible ?
              <FlexGridContainer layout='flex' template='row' justifyContent='space-between'>
                <span>Clique para fechar</span>
                <button>⬆️</button>
              </FlexGridContainer>
              :
              <FlexGridContainer layout='flex' template='row' justifyContent='space-between'>
                <span>Clique para buscar ou selecionar um cliente...</span>
                <button>⬇️</button>
              </FlexGridContainer>
            }
          </FlexGridContainer>
        )}
      </SelectionBox>

      {/* --- DROPDOWN/ÁREA DE BUSCA CONDICIONAL --- */}
      {isSearchVisible && (
        <SearchDropdown>

          {/* Switch PF/PJ/AMBOS - Mantido como está */}
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

          {/* Abas (UTILIZANDO O NOVO TabButton) - LÓGICA DE RÓTULO ADICIONADA AQUI! */}
          <Fieldset variant='basic' legend='Buscar Cliente por:' style={{ display: 'flex', justifyContent: 'space-between' }}>

            {(Object.keys(tabLabels) as TabKey[]).map(tab => {

              // 1. Determina o rótulo condicionalmente
              const conditionalLabel =
                tab === 'documento'
                  ? (clientTypeFilter === 'AMBOS' ? 'CPF/CNPJ' : clientTypeFilter) // Usa CPF, CNPJ ou Documento (se AMBOS)
                  : tabLabels[tab]; // Mantém o rótulo original para outras abas

              return (

                <TabButton
                  key={tab}
                  label={conditionalLabel} // Aplica o rótulo condicional
                  isActive={activeTab === tab}
                  onClick={() => handleTabChange(tab)}
                  disabled={isLoading}
                  variant='tab'
                >
                </TabButton>
              )
            })}


            {/* Input de Busca - Mantido como está */}

          </Fieldset>
          <FormControl label=''
            type="text"
            placeholder={`Buscar ${clientTypeFilter === 'AMBOS' ? 'CPF e CNPJ' : clientTypeFilter} por ${tabLabels[activeTab]}...`}
            value={searchTerm}
            onChange={handleSearchChange}
            disabled={isLoading} />

          <br />





          {/* Lista de Resultados - Mantida como está */}
          <ResultsList>
            {isLoading ? (
              <Typography variant="p">Carregando resultados...</Typography>
            ) : searchResults.length > 0 ? (
              searchResults.map((cliente) => (
                <ResultItem
                  key={cliente.id}
                  onClick={() => handleClienteSelect(cliente)}
                  selected={cliente.id === clienteSelecionado?.id}
                >
                  <div className='flex-row' style={{ justifyContent: 'space-between' }}>

                    <Typography variant="strong">{cliente.nome} ({cliente.tipo})</Typography> | <Typography variant="strong">{cliente.documento} </Typography>
                  </div>
                  <FlexGridContainer layout='flex' justifyContent="space-between">

                    <Typography variant="small">Tel: {cliente.telefone}</Typography>

                    <div >

                      <Badge color='paper' >
                        <Typography variant='strong' > Contrato </Typography>
                      </Badge>
                      <Badge color='poco'>
                        <Typography variant='strong' color='white'>    Poço </Typography>

                      </Badge>
                    </div>

                  </FlexGridContainer>

                  <br />
                </ResultItem>
              ))
            ) : (
              <Typography variant="p">Nenhum cliente encontrado...</Typography>
            )}
          </ResultsList>
        </SearchDropdown>
      )}
    </Card>
  );
};

export default ClienteSelectTabs;