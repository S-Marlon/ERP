// import React, { useState, ChangeEvent, useMemo } from 'react';
// import Typography from '../../../components/ui/Typography/Typography';
// import Button from '../../../components/ui/Button/Button';
// import Badge from '../../../components/ui/Badge/Badge';
// import './SearchDashboard.css'; // Presume-se que você tenha o estilo
// import Card from '../../../components/ui/Card/Card';
// import FormControl from '../../../components/ui/FormControl/FormControl';
// import TypeSwitch from '../../../components/ui/TypeSwitch';
// import TabButton from '../../../components/ui/TabButton/TabButton';
// import Fieldset from '../../../components/ui/Fieldset/Fieldset';

// // ----------------- TIPOS E DADOS MOCKADOS -----------------

// export interface ResultadoBusca {
//     id: string; // ID único do item
//     idr: string;
//     tipo: 'Cliente' | 'Contrato' | 'Poco';
//     titulo: string;
//     subDetalhe: string;
//     // Campos para simular o relacionamento (usados pela lógica abaixo)
//     fk_cliente_id?: string;
//     fk_contrato_id?: string;
// }

// // Dados mockados focados em um cliente e seus relacionamentos
// const DADOS_MOCK: ResultadoBusca[] = [
//     // 1. O Cliente Principal
//     { id: 'cli-001', idr: '000.111.222-33', tipo: 'Cliente', titulo: 'João da Silva (PF)', subDetalhe: '000.111.222-33' },

//     // 2. Contrato (Relacionado ao Cliente 1)
//     {
//         id: 'cont-005', idr: 'C-005', tipo: 'Contrato', titulo: 'Poço Novo - Fazenda Esperança',
//         subDetalhe: 'Cliente ID: cli-001', fk_cliente_id: 'cli-001'
//     },

//     // 3. Poço (Relacionado ao Contrato 5, que por sua vez se relaciona ao Cliente 1)
//     {
//         id: 'poco-101', idr: 'P-101', tipo: 'Poco', titulo: 'Poço Principal - Fazenda Esperança',
//         subDetalhe: 'Contrato ID: cont-005 | Vazão: 5.8 m³/h', fk_contrato_id: 'cont-005', fk_cliente_id: 'cli-001'
//     },
// ];

// type FiltroTipo = 'Todos' | 'Cliente' | 'Contrato' | 'Poço';
// type ContextoTipo = 'Cliente' | 'Contrato' | 'Poco';

// // ----------------- FUNÇÕES AUXILIARES DE RELACIONAMENTO (MOCK) -----------------

// /**
//  * Simula a busca de dados relacionados a um item específico (o contexto atual).
//  * * @param contextType O tipo do item que estamos vendo (Contrato ou Poço)
//  * @param data O array completo de dados
//  * @returns Um objeto com os dados de Cliente, Contrato e Poço relacionados.
//  */
// const getRelatedData = (contextType: ContextoTipo, data: ResultadoBusca[]) => {
//     let cliente: ResultadoBusca | undefined;
//     let contrato: ResultadoBusca | undefined;
//     let poco: ResultadoBusca | undefined;

//     // Supondo que o item de contexto seja o primeiro item daquele tipo nos mocks
//     const contextItem = data.find(item => item.tipo === mapFiltroToDataType(contextType));

//     if (contextType === 'Contrato' && contextItem) {
//         // Se o contexto é CONTRATO, buscamos o CLIENTE e o POÇO
//         const clienteId = contextItem.fk_cliente_id;
//         cliente = data.find(item => item.id === clienteId && item.tipo === 'Cliente');
//         poco = data.find(item => item.fk_contrato_id === contextItem.id && item.tipo === 'Poco');
//         contrato = contextItem;

//     } else if (contextType === 'Poco' && contextItem) {
//         // Se o contexto é POÇO, buscamos o CLIENTE e o CONTRATO
//         const contratoId = contextItem.fk_contrato_id;
//         contrato = data.find(item => item.id === contratoId && item.tipo === 'Contrato');
//         const clienteId = contrato?.fk_cliente_id; // Pega o cliente a partir do contrato relacionado
//         cliente = data.find(item => item.id === clienteId && item.tipo === 'Cliente');
//         poco = contextItem;
//     } else if (contextType === 'Cliente' && contextItem) {
//         // No contexto Cliente, o cliente é o item principal. Contrato e Poço são os relacionados
//         cliente = contextItem;
//         contrato = data.find(item => item.fk_cliente_id === contextItem.id && item.tipo === 'Contrato');
//         // Este mock só suporta 1:1, em uma aplicação real faria-se um filter para 1:N
//         poco = data.find(item => item.fk_cliente_id === contextItem.id && item.tipo === 'Poco');
//     }

//     return { cliente, contrato, poco };
// };

// // Função auxiliar para mapear o FiltroTipo (com 'Poço') para o tipo de dado (com 'Poco')
// const mapFiltroToDataType = (filtro: FiltroTipo | ContextoTipo): ResultadoBusca['tipo'] | null => {
//     if (filtro === 'Todos') return null;
//     return filtro === 'Poço' || filtro === 'Poco' ? 'Poco' : filtro as Exclude<FiltroTipo, 'Todos' | 'Poço'>;
// };


// // ----------------- PROPS DO COMPONENTE -----------------

// interface SearchDashboardProps {
//     initialData?: ResultadoBusca[];
//     onItemClick?: (item: ResultadoBusca) => void;
//     loading?: boolean;
//     error?: string | null;
// }

// // ----------------- COMPONENTE -----------------

// const SearchDashboard: React.FC<SearchDashboardProps> = ({
//     initialData = DADOS_MOCK,
//     onItemClick,
//     loading = false,
//     error = null,
// }) => {
//     const [contextType, setContextType] = useState<ContextoTipo>('Cliente');
//     const [searchTerm, setSearchTerm] = useState('');
//     const [filterType, setFilterType] = useState<FiltroTipo>('Todos');

//     const sourceResults = initialData;

//     const handleSearchChange = (e: ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value);
//     const handleFilterChange = (tipo: FiltroTipo) => setFilterType(tipo);

//     const handleItemClick = (item: ResultadoBusca) => {
//         if (onItemClick) {
//             onItemClick(item);
//         } else {
//             alert(`Navegando para: ${item.tipo} - ${item.titulo}`);
//         }
//     };

//     // ----------------- LÓGICA DE FILTROS DINÂMICOS (Botões de Filtro) -----------------

//     const availableFilters = useMemo<FiltroTipo[]>(() => {
//         // Não mostra botões se for Contrato ou Poço
//         if (contextType !== 'Cliente') return [];

//         // Se for Cliente, mostra Contrato e Poço
//         const todosTipos = ['Todos', 'Cliente', 'Contrato', 'Poço'] as const;
//         const typeToExclude = contextType === 'Poco' ? 'Poço' : contextType;

//         // Remove o botão 'Cliente' (o próprio contexto)
//         return todosTipos.filter(tipo => tipo === 'Todos' || tipo !== typeToExclude);

//     }, [contextType]);

//     // ----------------- LÓGICA DE FILTRAGEM DE DADOS (Modo Cliente) -----------------

//     const resultadosFiltrados = useMemo(() => {
//         // Esta lógica só é usada se o contextType for 'Cliente'
//         if (contextType !== 'Cliente') return [];

//         let resultados = sourceResults;

//         // 1. FILTRO DE CONTEXTO (Exclui o Cliente principal da lista de resultados, 
//         //    pois o foco são os itens relacionados, Contrato e Poço)
//         resultados = resultados.filter(item => item.tipo !== 'Cliente');

//         // 2. FILTRO DE TIPO (Quando o usuário clica nos botões 'Contrato' ou 'Poço')
//         if (filterType !== 'Todos') {
//             const tipoBusca = mapFiltroToDataType(filterType);
//             if (tipoBusca) {
//                 resultados = resultados.filter(item => item.tipo === tipoBusca);
//             }
//         }

//         // 3. FILTRO DE TEXTO
//         if (searchTerm.trim() === '') return resultados;
//         const term = searchTerm.toLowerCase();

//         // Filtra por título, subDetalhe ou ID de referência
//         return resultados.filter(item =>
//             item.titulo.toLowerCase().includes(term) ||
//             item.subDetalhe.toLowerCase().includes(term) ||
//             item.idr.toLowerCase().includes(term)
//         );
//     }, [searchTerm, filterType, sourceResults, contextType]); // contextType é uma dependência crucial

//     // ----------------- DADOS RELACIONADOS (Modo Contrato/Poço) -----------------

//     const { cliente, contrato, poco } = useMemo(() => {
//         // Busca os dados relacionados para Contrato/Poço ou o próprio Cliente
//         return getRelatedData(contextType, sourceResults);
//     }, [contextType, sourceResults]);


//     // ----------------- RENDERIZAÇÃO CONDICIONAL -----------------

//     const renderRelatedItem = (item: ResultadoBusca | undefined, label: string) => {
//         if (!item) {
//             return (
//                 <fieldset className="related-fieldset no-data">
//                     <legend><Typography variant="p">{label}</Typography></legend>
//                     <Typography variant="pMuted">Nenhum {label.toLowerCase()} relacionado encontrado.</Typography>
//                 </fieldset>
//             );
//         }
//         return (
//             <Fieldset legend={<Badge color="poco">{item.tipo}</Badge>}
//                 className={`related-fieldset related-fieldset-${item.tipo.toLowerCase()}`}
//                 onClick={() => handleItemClick(item)}
//             >


//                 <div className='flex-column'>
//                     <Typography variant="strong" className="item-title">{item.titulo}</Typography>
//                     <Typography variant="small" className="item-detail">{item.subDetalhe}</Typography>
//                 </div>
//                 <div className='flex-column'>
//                     <Typography variant="strong" className="item-title">{item.titulo}</Typography>
//                     <Typography variant="small" className="item-detail">{item.subDetalhe}</Typography>
//                 </div>

//             </Fieldset>
//         );
//     };

//     const renderResultsArea = () => {
//         if (contextType === 'Cliente') {
//             // Lógica de Busca Global e Filtragem para itens RELACIONADOS (Contrato/Poço)
//             return (
//                 <>
//                     <div>





//                         <FormControl label=''
//                             type="text"
//                             placeholder="Digite para buscar Contratos ou Poços relacionados..."
//                             value={searchTerm}
//                             onChange={handleSearchChange}
//                             className="search-input"
//                         />

//                         <Typography variant="small">Resultados Relacionados ({resultadosFiltrados.length})</Typography>





//                         <br />
//                         <Typography variant="strong">Filtrar Por:</Typography>

//                        <TypeSwitch>
//     {availableFilters.map((tipo) => (
//         <TabButton
//             key={tipo}
//             label={tipo}
//             // 🐛 CORRIGIDO: O filtro ativo é 'filterType', e a prop 'isActive' deve ser booleana.
//             isActive={filterType === tipo} 
            
//             // A cor/variante do botão é controlada pelo 'variant="switch"'
//             // O componente TabButton deve aplicar o estilo 'primary' quando isActive é true.
            
//             onClick={() => handleFilterChange(tipo)}
//             disabled={false}
            
//             // Configurações para que o TabButton atue como um switch/filtro:
//             isTab={false} 
//             variant="switch" 
//         />
//     ))}
// </TypeSwitch>


//                         {resultadosFiltrados.length > 0 ? (
//                             resultadosFiltrados.map(item => (


//                                 <Fieldset legend={<Badge color="poco">{item.tipo}</Badge>}
//                                     className={`related-fieldset related-fieldset-${item.tipo.toLowerCase()}`}
//                                     onClick={() => handleItemClick(item)}
//                                 >


//                                     <div className='flex-column'>
//                                         <Typography variant="strong" className="item-title">{item.titulo}</Typography>
//                                         <Typography variant="small" className="item-id">{item.idr}</Typography>

//                                     </div>
//                                     <div className='flex-column'>
//                                         <Typography variant="strong" className="item-title">{item.titulo}</Typography>
//                                         <Typography variant="small" className="item-detail">{item.subDetalhe}</Typography>
//                                     </div>

//                                 </Fieldset>






//                             ))
//                         ) : (
//                             <div className="no-results">
//                                 <Typography variant="p">
//                                     Nenhum resultado encontrado.
//                                 </Typography>
//                             </div>
//                         )}
//                     </div>
//                 </>
//             );
//         } else if (contextType === 'Contrato') {
//             // Lógica para Contrato: mostra Cliente e Poço relacionados
//             return (
//                 <div className="related-data-display">
//                     <Typography variant="em">Relacionamentos para o Contrato:  <br /><strong>{contrato?.titulo || contrato?.idr}</strong></Typography>
//                     {renderRelatedItem(cliente, 'Cliente')}
//                     {renderRelatedItem(poco, 'Poço')}
//                 </div>
//             );
//         } else if (contextType === 'Poco') {
//             // Lógica para Poço: mostra Cliente e Contrato relacionados
//             return (
//                 <div className="related-data-display">
//                     <Typography variant="em">Relacionamentos para o Poço: <br /><strong>{poco?.titulo || poco?.idr}</strong></Typography>
//                     {renderRelatedItem(cliente, 'Cliente')}
//                     {renderRelatedItem(contrato, 'Contrato')}
//                 </div>
//             );
//         }
//     };


//     // ----------------- RENDERIZAÇÃO -----------------

//     return (
//         <Card variant="highlight" className="search-dashboard-container">
//             <Typography variant="h2Alt" className="main-title">Itens Relacionados</Typography>

//             {/* ----------------- SELETOR DE CONTEXTO TEMPORÁRIO ----------------- */}
//             <div style={{ padding: '15px 0', borderBottom: '1px solid #ccc', marginBottom: '15px', background: '#f5f5f5' }}>
//                 <Typography variant="strong" >
//                     Simular Contexto Atual:
//                 </Typography>
//                 {(['Cliente', 'Contrato', 'Poco'] as const).map((tipo) => (
//                     <Button
//                         key={tipo}
//                         variant={contextType === tipo ? "primary" : "outline"}
//                         style={{ marginLeft: 8 }}
//                         onClick={() => {
//                             setContextType(tipo);
//                             setFilterType('Todos'); // Resetar filtro
//                             setSearchTerm(''); // Limpar busca
//                         }}
//                     >
//                         {tipo}
//                     </Button>
//                 ))}
//                 <Typography variant="pMuted">
//                     *Contexto Simulado: {contextType}*
//                 </Typography>
//             </div>
//             {/* ----------------- FIM DO SELETOR DE CONTEXTO TEMPORÁRIO ----------------- */}

//             {/* Exibe erro ou loading (vindo do componente pai) */}
//             {loading && <Typography variant="pMuted">Carregando resultados...</Typography>}
//             {error && <Typography variant="pMuted">Erro: {error}</Typography>}
//             {/* Fim da exibição de erro/loading */}

//             <div className="content-area">
//                 {renderResultsArea()}
//             </div>
//         </Card>
//     );
// };

// export default SearchDashboard;
import React, { useState, ChangeEvent, useMemo } from 'react';
// IMPORTAÇÕES DE COMPONENTES DE UI (Presumidos)
import Typography from '../../../components/ui/Typography/Typography';
import Badge from '../../../components/ui/Badge/Badge';
import './SearchDashboard.css'; // Presume-se que você tenha o estilo
import Card from '../../../components/ui/Card/Card';
import FormControl from '../../../components/ui/FormControl/FormControl';
import TypeSwitch from '../../../components/ui/TypeSwitch';
import TabButton from '../../../components/ui/TabButton/TabButton';
import Fieldset from '../../../components/ui/Fieldset/Fieldset';
import FlexGridContainer from '../../../components/Layout/FlexGridContainer/FlexGridContainer';

// ----------------- TIPOS -----------------

export interface ResultadoBusca {
    id: string; // ID único do item (PK)
    idr: string; // ID de Referência (ex: CPF/CNPJ, Código do Contrato, Nome do Poço)
    tipo: 'Cliente' | 'Contrato' | 'Poco';
    titulo: string;
    subDetalhe: string;
    // Campos para simular o relacionamento
    fk_cliente_id?: string;
    fk_contrato_id?: string;
}

type FiltroTipo = 'Todos' | 'Contrato' | 'Poço';
type ContextoTipo = 'Cliente' | 'Contrato' | 'Poco';

// ----------------- FUNÇÕES AUXILIARES -----------------

/**
 * Função auxiliar para mapear o FiltroTipo (com 'Poço') para o tipo de dado (com 'Poco')
 */
const mapFiltroToDataType = (filtro: FiltroTipo | ContextoTipo): ResultadoBusca['tipo'] | null => {
    if (filtro === 'Todos') return null;
    return filtro === 'Poço' || filtro === 'Poco' ? 'Poco' : filtro as Exclude<FiltroTipo, 'Todos' | 'Poço'>;
};

/**
 * Busca o item ativo e seus relacionamentos (Cliente, Contrato, Poço).
 * Inclui a normalização de ID para Cliente (número -> 'cli-XXX').
 */
const getRelatedData = (contextType: ContextoTipo | null, activeId: string | null, data: ResultadoBusca[]): {
    cliente: ResultadoBusca | undefined;
    contrato: ResultadoBusca | undefined;
    poco: ResultadoBusca | undefined;
} => {
    let cliente: ResultadoBusca | undefined;
    let contrato: ResultadoBusca | undefined;
    let poco: ResultadoBusca | undefined;

    // Se contextType/activeId ausentes ou data inválido/vazio, retorna vazio.
    if (!activeId || !contextType || !data || data.length === 0) { 
        return { cliente, contrato, poco };
    }

    // --- CORREÇÃO DE ID: Ajusta o formato para a busca (Ex: '1' -> 'cli-001') ---
    let idParaBuscar = activeId;
    if (contextType === 'Cliente' && !idParaBuscar.startsWith('cli-')) {
        const num = parseInt(idParaBuscar, 10);
        if (!isNaN(num)) {
             // Adapte esta formatação para o padrão real do seu backend (cli-XXX)
             const formattedNum = num.toString().padStart(3, '0'); 
             idParaBuscar = `cli-${formattedNum}`;
        }
    }
    // -------------------------------------------------------------------------
    
    // Encontra o item ativo (principal)
    const activeItem = data.find(item => item.id === idParaBuscar && mapFiltroToDataType(contextType) === item.tipo);

    if (!activeItem) {
        return { cliente, contrato, poco };
    }

    // 1. Define o item principal
    if (activeItem.tipo === 'Cliente') cliente = activeItem;
    if (activeItem.tipo === 'Contrato') contrato = activeItem;
    if (activeItem.tipo === 'Poco') poco = activeItem;

    // 2. Busca os relacionamentos
    if (activeItem.tipo === 'Contrato' && contrato) {
        cliente = data.find(item => item.id === contrato?.fk_cliente_id && item.tipo === 'Cliente');
        // Usamos o 'id' do Contrato para buscar o Poço relacionado (1:N)
        poco = data.find(item => item.fk_contrato_id === contrato?.id && item.tipo === 'Poco'); 

    } else if (activeItem.tipo === 'Poco' && poco) {
        contrato = data.find(item => item.id === poco?.fk_contrato_id && item.tipo === 'Contrato');
        if (contrato) {
            cliente = data.find(item => item.id === contrato?.fk_cliente_id && item.tipo === 'Cliente');
        }
    }

    // 3. Se o contexto for Cliente, garante que os filhos (Contrato/Poço) também sejam encontrados
    if (activeItem.tipo === 'Cliente' && cliente) {
        contrato = contrato || data.find(item => item.fk_cliente_id === cliente?.id && item.tipo === 'Contrato');
        poco = poco || data.find(item => item.fk_cliente_id === cliente?.id && item.tipo === 'Poco');
    }

    return { cliente, contrato, poco };
};


// ----------------- PROPS DO COMPONENTE -----------------

interface SearchDashboardProps {
    // IDs fornecidos pelo componente pai (o contexto da página)
    clienteId?: number | null;
    contratoId?: string | null;
    pocoId?: string | null;

    initialData?: ResultadoBusca[];
    onItemClick?: (item: ResultadoBusca) => void;
    loading?: boolean;
    error?: string | null;
}

// ----------------- COMPONENTE -----------------

const SearchDashboard: React.FC<SearchDashboardProps> = (props) => {
    const {
        clienteId,
        contratoId,
        pocoId,
        // CORREÇÃO: Define initialData como array vazio por padrão para evitar erros de runtime
        initialData = [], 
        onItemClick,
        loading = false,
        error = null,
    } = props;

    // Estado local para filtros de busca
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState<FiltroTipo>('Todos');

    // ----------------- DEDUÇÃO DO CONTEXTO ATIVO -----------------

    const [contextType, activeId] = useMemo(() => {
        if (pocoId) return ['Poco', pocoId] as const;
        if (contratoId) return ['Contrato', contratoId] as const;
        // Converte clienteId (number) para string.
        if (clienteId) return ['Cliente', String(clienteId)] as const; 
        return [null, null] as const; 
    }, [clienteId, contratoId, pocoId]);

    // ----------------- DADOS RELACIONADOS (Calculado no useMemo) -----------------

    const { cliente, contrato, poco } = useMemo(() => {
        // Busca os dados relacionados usando o contexto e ID ativo
        return getRelatedData(contextType, activeId, initialData);
    }, [contextType, activeId, initialData]);

    const activeItem = useMemo(() => {
        if (contextType === 'Cliente') return cliente;
        if (contextType === 'Contrato') return contrato;
        if (contextType === 'Poco') return poco;
        return null;
    }, [contextType, cliente, contrato, poco]);

    // ----------------- HANDLERS -----------------

    const handleSearchChange = (e: ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value);
    const handleFilterChange = (tipo: FiltroTipo) => setFilterType(tipo);

    const handleItemClick = (item: ResultadoBusca) => {
        if (onItemClick) {
            onItemClick(item);
        } else {
            console.log(`Navegando para: ${item.tipo} - ${item.titulo}`);
        }
    };

    // ----------------- LÓGICA DE FILTROS DINÂMICOS (Botões de Filtro) -----------------

    const availableFilters = useMemo<FiltroTipo[]>(() => {
        // Filtros só aparecem se o contexto for 'Cliente', para buscar Contratos/Poços
        if (contextType !== 'Cliente') return [];

        const allFilters: FiltroTipo[] = ['Todos', 'Contrato', 'Poço'];
        return allFilters;

    }, [contextType]);

    // ----------------- LÓGICA DE FILTRAGEM DE DADOS (Modo Cliente: lista filhos) -----------------

    const resultadosFiltrados = useMemo(() => {
        // Esta lógica só é usada se o contextType for 'Cliente'
        if (contextType !== 'Cliente' || !cliente) return [];

        let resultados = initialData;
        const term = searchTerm.toLowerCase().trim();

        // 1. FILTRO DE CONTEXTO (Apenas Contratos e Poços relacionados ao Cliente ativo)
        resultados = resultados.filter(item =>
            (item.tipo === 'Contrato' || item.tipo === 'Poco') && item.fk_cliente_id === cliente.id
        );

        // 2. FILTRO DE TIPO (Quando o usuário clica nos botões 'Contrato' ou 'Poço')
        if (filterType !== 'Todos') {
            const tipoBusca = mapFiltroToDataType(filterType);
            if (tipoBusca) {
                resultados = resultados.filter(item => item.tipo === tipoBusca);
            }
        }

        // 3. FILTRO DE TEXTO
        if (term) {
            // Filtra por título, subDetalhe ou ID de referência
            resultados = resultados.filter(item =>
                item.titulo.toLowerCase().includes(term) ||
                item.subDetalhe.toLowerCase().includes(term) ||
                item.idr.toLowerCase().includes(term)
            );
        }

        return resultados;
    }, [searchTerm, filterType, initialData, contextType, cliente]);

    // ----------------- RENDERIZAÇÃO CONDICIONAL (Item Relacionado) -----------------

    const renderRelatedItem = (item: ResultadoBusca | undefined, label: string, type: ResultadoBusca['tipo']) => {
        if (!item) {
            return (
                <Fieldset legend='-' className="related-fieldset no-data" variant='basic'>
                    <legend><Typography variant="p">{label} (Não Encontrado)</Typography></legend>
                    <Typography variant="pMuted">Nenhum {label.toLowerCase()} relacionado encontrado.</Typography>
                </Fieldset>
            );
        }
        return (
            <Fieldset legend={<Badge color={type === 'Poco' ? "poco" : "contrato"}>{item.tipo}</Badge>}
                className={`related-fieldset related-fieldset-${item.tipo.toLowerCase()} clickable`}
                onClick={() => handleItemClick(item)}
            >
                <div className='flex-column'>
                    <Typography variant="strong" className="item-title">{item.titulo}</Typography>
                    <Typography variant="small" className="item-detail">{item.subDetalhe}</Typography>
                </div>
                <Typography variant="small" className="item-idr">{item.idr}</Typography>
            </Fieldset>
        );
    };

    // ----------------- RENDERIZAÇÃO DA ÁREA DE RESULTADOS -----------------

    const renderResultsArea = () => {
        if (!contextType || !activeItem) {
            return <Typography variant='pMuted'>Nenhum ID de contexto (Cliente, Contrato ou Poço) foi fornecido.</Typography>;
        }

        if (contextType === 'Cliente') {
            // Contexto Cliente: Exibe a busca e filtro para itens relacionados (Contrato/Poço)
            return (
                <>
                    <Typography variant="pMuted" style={{marginBottom: '10px'}}>
                        O Dashboard exibe Contratos e Poços relacionados ao Cliente: <strong>{activeItem.titulo} ({activeItem.idr})</strong>
                    </Typography>

                    <FormControl label=''
                        type="text"
                        placeholder="Digite para buscar Contratos ou Poços relacionados..."
                        value={searchTerm}
                        onChange={handleSearchChange}
                        className="search-input"
                    />

                    {availableFilters.length > 0 && (
                        <Fieldset legend="Filtrar Por Tipo:" variant='basic'>
                            <TypeSwitch>
                                {availableFilters.map((tipo) => (
                                    <TabButton
                                        key={tipo}
                                        label={tipo}
                                        isActive={filterType === tipo}
                                        onClick={() => handleFilterChange(tipo)}
                                        disabled={loading}
                                        variant="switch"
                                    />
                                ))}
                            </TypeSwitch>
                        </Fieldset>
                    )}

                    <Typography variant="small" style={{marginTop: '15px'}}>
                        Resultados Relacionados ({resultadosFiltrados.length})
                    </Typography>

                    <div className="results-list">
                        {loading ? (
                            <Typography variant="pMuted">Carregando resultados...</Typography>
                        ) : resultadosFiltrados.length > 0 ? (
                            resultadosFiltrados.map(item => (
                                <Fieldset key={item.id}
                                    legend={<Badge color={item.tipo === 'Poco' ? "poco" : "contrato"}>{item.tipo}</Badge>}
                                    className={`related-fieldset related-fieldset-${item.tipo.toLowerCase()} clickable`}
                                    onClick={() => handleItemClick(item)}
                                >
                                    <div className='flex-column'>
                                        <Typography variant="strong" className="item-title">{item.titulo}</Typography>
                                        <Typography variant="small" className="item-detail">{item.subDetalhe}</Typography>
                                    </div>
                                    <Typography variant="small" className="item-idr">{item.idr}</Typography>
                                </Fieldset>
                            ))
                        ) : (
                            <div className="no-results">
                                <Typography variant="p">Nenhum Contrato ou Poço encontrado para esta busca.</Typography>
                            </div>
                        )}
                    </div>
                </>
            );
        } else if (contextType === 'Contrato' || contextType === 'Poco') {
            // Contexto Contrato/Poço: Exibe o fluxo de itens relacionados
            const title = contextType === 'Contrato' ? 'Contrato' : 'Poço';
            const relatedTitle = activeItem?.titulo || activeItem?.idr;

            return (
                <div className="related-data-display">
                    <Typography variant="em">
                        Fluxo de Relacionamentos para o item {title}: <br />
                        <strong>{relatedTitle}</strong>
                    </Typography>
                    
                    <FlexGridContainer layout='grid' template='3-col' gap='20px' style={{marginTop: '20px'}}>
                        {/* 1. Cliente */}
                        {renderRelatedItem(cliente, 'Cliente', 'Cliente')}
                        
                        {/* 2. Contrato (Poco o mostra, Contrato o esconde) */}
                        {contextType === 'Poco' && renderRelatedItem(contrato, 'Contrato', 'Contrato')}
                        {/* 2.1 Contrato (Item Principal) */}
                        {contextType === 'Contrato' && renderRelatedItem(contrato, 'Contrato (Item Ativo)', 'Contrato')}

                        {/* 3. Poço (Contrato o mostra, Poco o esconde) */}
                        {contextType === 'Contrato' && renderRelatedItem(poco, 'Poço', 'Poco')}
                        {/* 3.1 Poço (Item Principal) */}
                        {contextType === 'Poco' && renderRelatedItem(poco, 'Poço (Item Ativo)', 'Poco')}
                    </FlexGridContainer>
                </div>
            );
        }
    };


    // ----------------- RENDERIZAÇÃO PRINCIPAL -----------------

    const mainTitle = activeItem
        ? `Itens Relacionados ao ${contextType}: ${activeItem.idr}`
        : 'Seletor de Contexto Não Definido';

    return (

        
        <Card variant="highlight" className="search-dashboard-container">
            <Typography variant="h2Alt" className="main-title">{mainTitle}</Typography>

            {/* Exibe erro ou loading (vindo do componente pai) */}
            {error && <Typography variant="pMuted">Erro: {error}</Typography>}
            
            <div className="content-area">
                 {clienteId !== null && (
                         <Fieldset legend={<Badge color="poco">poco</Badge>}
               
                
            >


                <div className='flex-column'>
                    <Typography variant="strong" className="item-title">item.titulo</Typography>
                    <Typography variant="small" className="item-detail">item.subDetalhe</Typography>
                </div>
                <div className='flex-column'>
                    <Typography variant="strong" className="item-title">item.titulo</Typography>
                    <Typography variant="small" className="item-detail">item.subDetalhe</Typography>
                </div>

            </Fieldset>
                        )}

                         {clienteId !== null && (
                         <Fieldset legend={<Badge color="paper">Contrato</Badge>}
               
                
            >


                <div className='flex-column'>
                    <Typography variant="strong" className="item-title">item.titulo</Typography>
                    <Typography variant="small" className="item-detail">item.subDetalhe</Typography>
                </div>
                <div className='flex-column'>
                    <Typography variant="strong" className="item-title">item.titulo</Typography>
                    <Typography variant="small" className="item-detail">item.subDetalhe</Typography>
                </div>

            </Fieldset>
                        )}
                {renderResultsArea()}
            </div>
            
            <div style={{ padding: '15px 0', borderTop: '1px solid #eee', marginTop: '15px' }}>
                <Typography variant="small" style={{fontSize: '0.8em', color: '#666'}}>
                    *Contexto Ativo Detectado: {contextType || 'Nenhum'} (IDs: Cliente={clienteId || 'N/A'}, Contrato={contratoId || 'N/A'}, Poço={pocoId || 'N/A'})
                </Typography>
            </div>

           

        </Card>
        
    );
};

export default SearchDashboard;