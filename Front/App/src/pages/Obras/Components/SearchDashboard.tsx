import React, { useState, ChangeEvent, useMemo } from 'react';
import Typography from '../../../components/ui/Typography';
import Button from '../../../components/ui/Button';
import Badge from '../../../components/ui/Badge';
import './SearchDashboard.css'; // Presume-se que você tenha o estilo
import Card from '../../../components/ui/Card';
import FormControl from '../../../components/ui/FormControl';
import TypeSwitch from '../../../components/ui/TypeSwitch';
import TabButton from '../../../components/ui/TabButton';

// ----------------- TIPOS E DADOS MOCKADOS -----------------

export interface ResultadoBusca {
  id: string; // ID único do item
  idr: string; 
  tipo: 'Cliente' | 'Contrato' | 'Poco';
  titulo: string;
  subDetalhe: string;
  // Campos para simular o relacionamento (usados pela lógica abaixo)
  fk_cliente_id?: string;
  fk_contrato_id?: string;
}

// Dados mockados focados em um cliente e seus relacionamentos
const DADOS_MOCK: ResultadoBusca[] = [
  // 1. O Cliente Principal
  { id: 'cli-001', idr: '000.111.222-33', tipo: 'Cliente', titulo: 'João da Silva (PF)', subDetalhe: '000.111.222-33' },
  
  // 2. Contrato (Relacionado ao Cliente 1)
  { 
    id: 'cont-005', idr: 'C-005', tipo: 'Contrato', titulo: 'Poço Novo - Fazenda Esperança', 
    subDetalhe: 'Cliente ID: cli-001', fk_cliente_id: 'cli-001' 
  },
  
  // 3. Poço (Relacionado ao Contrato 5, que por sua vez se relaciona ao Cliente 1)
  { 
    id: 'poco-101', idr: 'P-101', tipo: 'Poco', titulo: 'Poço Principal - Fazenda Esperança', 
    subDetalhe: 'Contrato ID: cont-005 | Vazão: 5.8 m³/h', fk_contrato_id: 'cont-005', fk_cliente_id: 'cli-001' 
  },
];

type FiltroTipo = 'Todos' | 'Cliente' | 'Contrato' | 'Poço';
type ContextoTipo = 'Cliente' | 'Contrato' | 'Poco';

// ----------------- FUNÇÕES AUXILIARES DE RELACIONAMENTO (MOCK) -----------------

/**
 * Simula a busca de dados relacionados a um item específico (o contexto atual).
 * * @param contextType O tipo do item que estamos vendo (Contrato ou Poço)
 * @param data O array completo de dados
 * @returns Um objeto com os dados de Cliente, Contrato e Poço relacionados.
 */
const getRelatedData = (contextType: ContextoTipo, data: ResultadoBusca[]) => {
    let cliente: ResultadoBusca | undefined;
    let contrato: ResultadoBusca | undefined;
    let poco: ResultadoBusca | undefined;
    
    // Supondo que o item de contexto seja o primeiro item daquele tipo nos mocks
    const contextItem = data.find(item => item.tipo === mapFiltroToDataType(contextType));

    if (contextType === 'Contrato' && contextItem) {
        // Se o contexto é CONTRATO, buscamos o CLIENTE e o POÇO
        const clienteId = contextItem.fk_cliente_id;
        cliente = data.find(item => item.id === clienteId && item.tipo === 'Cliente');
        poco = data.find(item => item.fk_contrato_id === contextItem.id && item.tipo === 'Poco');
        contrato = contextItem;

    } else if (contextType === 'Poco' && contextItem) {
        // Se o contexto é POÇO, buscamos o CLIENTE e o CONTRATO
        const contratoId = contextItem.fk_contrato_id;
        contrato = data.find(item => item.id === contratoId && item.tipo === 'Contrato');
        const clienteId = contrato?.fk_cliente_id; // Pega o cliente a partir do contrato relacionado
        cliente = data.find(item => item.id === clienteId && item.tipo === 'Cliente');
        poco = contextItem;
    } else if (contextType === 'Cliente' && contextItem) {
        // No contexto Cliente, o cliente é o item principal. Contrato e Poço são os relacionados
        cliente = contextItem;
        contrato = data.find(item => item.fk_cliente_id === contextItem.id && item.tipo === 'Contrato');
        // Este mock só suporta 1:1, em uma aplicação real faria-se um filter para 1:N
        poco = data.find(item => item.fk_cliente_id === contextItem.id && item.tipo === 'Poco'); 
    }

    return { cliente, contrato, poco };
};

// Função auxiliar para mapear o FiltroTipo (com 'Poço') para o tipo de dado (com 'Poco')
const mapFiltroToDataType = (filtro: FiltroTipo | ContextoTipo): ResultadoBusca['tipo'] | null => {
    if (filtro === 'Todos') return null;
    return filtro === 'Poço' || filtro === 'Poco' ? 'Poco' : filtro as Exclude<FiltroTipo, 'Todos' | 'Poço'>;
};


// ----------------- PROPS DO COMPONENTE -----------------

interface SearchDashboardProps {
  initialData?: ResultadoBusca[];
  onItemClick?: (item: ResultadoBusca) => void;
  loading?: boolean;
  error?: string | null;
}

// ----------------- COMPONENTE -----------------

const SearchDashboard: React.FC<SearchDashboardProps> = ({
  initialData = DADOS_MOCK, 
  onItemClick,
  loading = false, 
  error = null,
}) => {
  const [contextType, setContextType] = useState<ContextoTipo>('Cliente'); 
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<FiltroTipo>('Todos');

  const sourceResults = initialData;

  const handleSearchChange = (e: ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value);
  const handleFilterChange = (tipo: FiltroTipo) => setFilterType(tipo);
  
  const handleItemClick = (item: ResultadoBusca) => {
    if (onItemClick) {
        onItemClick(item);
    } else {
        alert(`Navegando para: ${item.tipo} - ${item.titulo}`);
    }
  };

  // ----------------- LÓGICA DE FILTROS DINÂMICOS (Botões de Filtro) -----------------

  const availableFilters = useMemo<FiltroTipo[]>(() => {
    // Não mostra botões se for Contrato ou Poço
    if (contextType !== 'Cliente') return []; 
    
    // Se for Cliente, mostra Contrato e Poço
    const todosTipos = ['Todos', 'Cliente', 'Contrato', 'Poço'] as const;
    const typeToExclude = contextType === 'Poco' ? 'Poço' : contextType;

    // Remove o botão 'Cliente' (o próprio contexto)
    return todosTipos.filter(tipo => tipo === 'Todos' || tipo !== typeToExclude);

  }, [contextType]);

  // ----------------- LÓGICA DE FILTRAGEM DE DADOS (Modo Cliente) -----------------
  
  const resultadosFiltrados = useMemo(() => {
    // Esta lógica só é usada se o contextType for 'Cliente'
    if (contextType !== 'Cliente') return []; 

    let resultados = sourceResults;

    // 1. FILTRO DE CONTEXTO (Exclui o Cliente principal da lista de resultados, 
    //    pois o foco são os itens relacionados, Contrato e Poço)
    resultados = resultados.filter(item => item.tipo !== 'Cliente'); 
    
    // 2. FILTRO DE TIPO (Quando o usuário clica nos botões 'Contrato' ou 'Poço')
    if (filterType !== 'Todos') {
      const tipoBusca = mapFiltroToDataType(filterType);
      if (tipoBusca) {
        resultados = resultados.filter(item => item.tipo === tipoBusca);
      }
    }

    // 3. FILTRO DE TEXTO
    if (searchTerm.trim() === '') return resultados;
    const term = searchTerm.toLowerCase();

    // Filtra por título, subDetalhe ou ID de referência
    return resultados.filter(item =>
      item.titulo.toLowerCase().includes(term) ||
      item.subDetalhe.toLowerCase().includes(term) ||
      item.idr.toLowerCase().includes(term)
    );
  }, [searchTerm, filterType, sourceResults, contextType]); // contextType é uma dependência crucial

  // ----------------- DADOS RELACIONADOS (Modo Contrato/Poço) -----------------

  const { cliente, contrato, poco } = useMemo(() => {
      // Busca os dados relacionados para Contrato/Poço ou o próprio Cliente
      return getRelatedData(contextType, sourceResults);
  }, [contextType, sourceResults]);


  // ----------------- RENDERIZAÇÃO CONDICIONAL -----------------

  const renderRelatedItem = (item: ResultadoBusca | undefined, label: string) => {
    if (!item) {
        return (
            <fieldset className="related-fieldset no-data">
                <legend><Typography variant="p">{label}</Typography></legend>
                <Typography variant="pMuted">Nenhum {label.toLowerCase()} relacionado encontrado.</Typography>
            </fieldset>
        );
    }
    return (
        <fieldset 
            className={`related-fieldset related-fieldset-${item.tipo.toLowerCase()}`}
            onClick={() => handleItemClick(item)}
        >
            <legend><Typography variant="p">
                <Badge color='poco'>{item.tipo}</Badge>
                </Typography></legend>
            <div className='flex-content'>
                <div className='flex-column'>
                    <Typography variant="strong" className="item-title">{item.titulo}</Typography>
                    <Typography variant="small" className="item-detail">{item.subDetalhe}</Typography>
                </div>
            </div>
        </fieldset>
    );
  };
  
  const renderResultsArea = () => {
    if (contextType === 'Cliente') {
        // Lógica de Busca Global e Filtragem para itens RELACIONADOS (Contrato/Poço)
        return (
            <>
                        
                
                    <FormControl label='' 
                        type="text" 
                        placeholder="Digite para buscar Contratos ou Poços relacionados..." 
                        value={searchTerm} 
                        onChange={handleSearchChange} 
                        className="search-input"
                    />

                    <Typography variant="h3">Resultados Relacionados ({resultadosFiltrados.length})</Typography>
                
                
                
                    
                        
                            <Typography variant="strong">Filtrar Por:</Typography>
                            <br/>

                        <TypeSwitch>
                            {availableFilters.map((tipo)=> (
                                <TabButton
                                    key={tipo} 
                                    label={tipo} 
                                    isActive={true} 
                                    onClick={() => handleFilterChange(tipo)}
                                    disabled={false} // 'isLoading' agora usa 'isSaving'
                                    // CRUCIAL: Configurações para que o TabButton atue como um switch/filtro:
                                    isTab={false}    // Desativa role="tab" e aria-selected
                                    variant="switch"   // Aplica o estilo de switch/grupo
                                />
                            ))}
                        </TypeSwitch>

                            
                    {resultadosFiltrados.length > 0 ? (
                        resultadosFiltrados.map(item => (
                            <div
                                key={item.id}
                                className={`result-item result-item-${item.tipo.toLowerCase()}`} 
                                onClick={() => handleItemClick(item)}
                            >
                                <div className='innertable'>
                                    <div className="flex-column item-column-type">
                                        <Typography variant="strong" className="item-type">{item.tipo}</Typography>
                                        <Typography variant="small" className="item-id">{item.idr}</Typography>
                                    </div>
                                    <div className="flex-column item-column-title">
                                        <Typography variant="p" className="item-title">{item.titulo}</Typography>
                                    </div>
                                    <div className="flex-column item-column-detail">
                                        <Typography variant="p" className="item-detail">{item.subDetalhe}</Typography>
                                    </div>
                                    <div className="flex-column item-column-status">
                                        <Badge color="warning">Em Andamento</Badge> 
                                    </div>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="no-results">
                            <Typography variant="p">
                                Nenhum resultado encontrado.
                            </Typography>
                        </div>
                    )}
                
            </>
        );
    } else if (contextType === 'Contrato') {
        // Lógica para Contrato: mostra Cliente e Poço relacionados
        return (
            <div className="related-data-display">
                <Typography variant="em">Relacionamentos para o Contrato:  <br/><strong>{contrato?.titulo || contrato?.idr}</strong></Typography>
                {renderRelatedItem(cliente, 'Cliente')}
                {renderRelatedItem(poco, 'Poço')}
            </div>
        );
    } else if (contextType === 'Poco') {
        // Lógica para Poço: mostra Cliente e Contrato relacionados
        return (
            <div className="related-data-display">
                <Typography variant="em">Relacionamentos para o Poço: <br/><strong>{poco?.titulo || poco?.idr}</strong></Typography>
                {renderRelatedItem(cliente, 'Cliente')}
                {renderRelatedItem(contrato, 'Contrato')}
            </div>
        );
    }
  };


  // ----------------- RENDERIZAÇÃO -----------------

  return (
    <Card variant="highlight" className="search-dashboard-container">
      <Typography variant="h2Alt" className="main-title">Itens Relacionados</Typography>

      {/* ----------------- SELETOR DE CONTEXTO TEMPORÁRIO ----------------- */}
      <div style={{ padding: '15px 0', borderBottom: '1px solid #ccc', marginBottom: '15px', background: '#f5f5f5' }}>
          <Typography variant="strong" >
              Simular Contexto Atual:
          </Typography>
          {(['Cliente', 'Contrato', 'Poco'] as const).map((tipo) => (
              <Button
                  key={tipo}
                  variant={contextType === tipo ? "primary" : "outline"}
                  style={{ marginLeft: 8 }}
                  onClick={() => {
                    setContextType(tipo);
                    setFilterType('Todos'); // Resetar filtro
                    setSearchTerm(''); // Limpar busca
                  }}
              >
                  {tipo}
              </Button>
          ))}
          <Typography variant="pMuted">
              **Contexto Simulado: {contextType}**
          </Typography>
      </div>
      {/* ----------------- FIM DO SELETOR DE CONTEXTO TEMPORÁRIO ----------------- */}

      {/* Exibe erro ou loading (vindo do componente pai) */}
      {loading && <Typography variant="pMuted">Carregando resultados...</Typography>}
      {error && <Typography variant="pMuted">Erro: {error}</Typography>}
      {/* Fim da exibição de erro/loading */}

      <div className="content-area">
        {renderResultsArea()}
      </div>
    </Card>
  );
};

export default SearchDashboard;