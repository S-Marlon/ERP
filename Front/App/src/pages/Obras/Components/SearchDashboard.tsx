import React, { useState, ChangeEvent, useMemo } from 'react';

// Tipos para os resultados de busca
interface ResultadoBusca {
    id: string;
    tipo: 'Cliente' | 'Contrato' | 'Poco';
    titulo: string; // Nome do Cliente, Título do Contrato, Nome do Poço
    subDetalhe: string; // CPF/CNPJ, Cliente associado, Vazão do Poço
}

// Dados mockados para simular a base de dados
const DADOS_MOCK: ResultadoBusca[] = [
    { id: 'cli-001', tipo: 'Cliente', titulo: 'João da Silva (PF)', subDetalhe: '000.111.222-33' },
    { id: 'cli-002', tipo: 'Cliente', titulo: 'Empresa Alpha Ltda (PJ)', subDetalhe: '11.222.333/0001-44' },
    { id: 'cont-005', tipo: 'Contrato', titulo: 'Poço Novo - Fazenda Esperança', subDetalhe: 'Cliente: João da Silva' },
    { id: 'cont-008', tipo: 'Contrato', titulo: 'Aprofundamento - Sítio da Pedra', subDetalhe: 'Cliente: Empresa Alpha' },
    { id: 'poco-101', tipo: 'Poco', titulo: 'Poço Principal - Fazenda Esperança', subDetalhe: 'Vazão: 5.8 m³/h' },
    { id: 'poco-102', tipo: 'Poco', titulo: 'Poço Secundário - Construtora Beta', subDetalhe: 'Vazão: 0 m³/h (Pendente)' },
];

// Tipos para o estado de filtros
type FiltroTipo = 'Todos' | 'Cliente' | 'Contrato' | 'Poço';

const SearchDashboard: React.FC = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState<FiltroTipo>('Todos');

    // Handler para a barra de pesquisa principal
    const handleSearchChange = (e: ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
    };

    // Handler para os botões de filtro
    const handleFilterChange = (tipo: FiltroTipo) => {
        setFilterType(tipo);
    };

    // 3. Lógica de Filtragem e Busca (usando useMemo para performance)
    const resultadosFiltrados = useMemo(() => {
        let resultados = DADOS_MOCK;

        // 1. Filtrar por Tipo
        if (filterType !== 'Todos') {
            resultados = resultados.filter(item => item.tipo === filterType);
        }

        // 2. Filtrar por Termo de Busca (case insensitive)
        if (searchTerm.trim() === '') {
            return resultados; // Retorna todos os filtrados por tipo se a busca for vazia
        }

        const term = searchTerm.toLowerCase();

        return resultados.filter(item =>
            item.titulo.toLowerCase().includes(term) ||
            item.subDetalhe.toLowerCase().includes(term)
        );
    }, [searchTerm, filterType]);

    // Função para simular a navegação (levar para o painel de detalhe)
    const handleItemClick = (item: ResultadoBusca) => {
        alert(`Navegando para o Painel de Detalhes de: ${item.tipo} - ${item.titulo}`);
        // Em um app real: navigate(`/detalhe/${item.tipo.toLowerCase()}/${item.id}`);
    }

    // ----------------- RENDERIZAÇÃO -----------------

    return (
        <div>
            <h1 className="main-title">Busca Global</h1>

            <div style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
                   {/* Busca por Título */}
                   <input
                     type="text"
                     placeholder="Buscar por Título..."
                    //  value={busca}
                    //  onChange={(e) => setBusca(e.target.value)}
                   />
           
                   {/* Filtro por Status */}
                   <select
                    //  value={filtroStatus}
                    //  onChange={(e) => setFiltroStatus(e.target.value as StatusObra | 'Todos')}
                   >
                     <option value="Todos">Filtrar por Status (Todos)</option>
                     {/* {statusOptions.map(status => (
                       <option key={status} value={status}>{status}</option>
                     ))} */}
                   </select>
           
                   {/* Filtro por Cliente */}
                   <select
                    //  value={filtroClienteId}
                    //  onChange={(e) => setFiltroClienteId(e.target.value)}
                   >
                     <option value="Todos">Filtrar por Cliente (Todos)</option>
                     {/* {mockClientes.map(cliente => (
                       <option key={cliente.id} value={cliente.id}>{cliente.nome}</option>
                     ))} */}
                   </select>
                 </div>

            {/* Barra de Pesquisa Principal */}



            <div className="content-area">


                {/* Lista de Resultados */}
                <div className="results-list">

                    <div className=" flex-row results-header" style={{ justifyContent: 'space-between' }}>

                        <h3>

                            Resultados ({resultadosFiltrados.length})
                        </h3>

                        <div>
                            <label > Filtrar Por: </label>
                            {['Todos', 'Cliente', 'Contrato', 'Poço'].map((tipo) => (
                                <button
                                    key={tipo}
                                    className={`filter-button ${filterType === tipo ? 'active' : ''}`}

                                    onClick={() => handleFilterChange(tipo as FiltroTipo)}
                                >
                                    {tipo}
                                </button>
                            ))}
                        </div>

                    </div>

                    {resultadosFiltrados.length > 0 ? (
                        resultadosFiltrados.map(item => (
                            <div
                                key={item.id}
                                className={`result-item result-item-${item.tipo.toLowerCase()}`}
                                onClick={() => handleItemClick(item)}
                            >

                                <div className='innertable'>
                                <div className="flex-column">
                                     <div  className="item-type">{item.tipo}</div>
                                     <div className="item-detail">{item.subDetalhe} Lorem ipsum dolor, sit amet consectetur adipisicing elit. Repellat fugit eum illo aspernatur! Magnam facere beatae officiis dolor quidem. Maiores eaque harum quisquam culpa totam! Facilis nisi expedita harum rerum.</div>
                                </div>
                                <div className="flex-column">
                                     <div  className="item-type">{item.tipo}</div>
                                     <div className="item-detail">{item.subDetalhe}Lorem ipsum dolor, sit amet consectetur adipisicing elit. Repellat fugit eum illo aspernatur! Magnam facere beatae officiis dolor quidem. Maiores eaque harum quisquam culpa totam! Facilis nisi expedita harum rerum.</div>
                                </div><div className="flex-column">
                                     <div  className="item-type">{item.tipo}</div>
                                     <div className="item-detail">{item.subDetalhe}Lorem ipsum dolor, sit amet consectetur adipisicing elit. Repellat fugit eum illo aspernatur! Magnam facere beatae officiis dolor quidem. Maiores eaque harum quisquam culpa totam! Facilis nisi expedita harum rerum.</div>
                                </div><div className="flex-column">
                                     <div  className="item-type">{item.tipo}</div>
                                     <div className="item-detail">{item.subDetalhe}Lorem ipsum dolor, sit amet consectetur adipisicing elit. Repellat fugit eum illo aspernatur! Magnam facere beatae officiis dolor quidem. Maiores eaque harum quisquam culpa totam! Facilis nisi expedita harum rerum.</div>
                                </div>

                                </div>
                                
                                
                                {/* <table>
                                    <tr>
                                        <th  className="item-type">{item.tipo}</th>
                                        <th >Cliente</th>
                                        <th>Status</th>
                                        <th>Ações/detalhes</th>
                                    </tr>
                                    <tr>

                                        <td><span className="item-detail">{item.subDetalhe}</span></td>
                                        <td><span className="item-title">{item.titulo}</span></td>
                                        <td><span style={{ textAlign: 'center', background: 'orange', borderRadius: '4px', padding: '2px' }}>Em andamento</span></td>
                                        <td><span className="item-detail">{item.subDetalhe}</span></td>
                                    </tr>
                                </table> */}

                            </div>
                        ))
                    ) : (
                        <div className="no-results">
                            Nenhum resultado encontrado para "{searchTerm}" no filtro de {filterType}.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// ----------------- ESTILOS (CSS) -----------------
const style = `


.innertable {
    display: grid;
    /* Define as colunas: 1 parte fracionada para a sidebar, 2 partes para o conteúdo */
    grid-template-columns: 1fr 2fr 2fr 1fr;
    /* Ajuste de altura para que a área de conteúdo preencha a tela */
}


.main-title {
    text-align: center;
    color: #333;
    margin-bottom: 25px;
}
.search {
   max-width:150px;
}

.content-area {
    display: flex;
    gap: 30px;
}

/* Filtros Laterais */
.filter-sidebar {
    flex: 0 0 200px; /* Largura fixa */
    padding: 15px;
    background-color: #f8f9fa;
    border-radius: 8px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.05);
}
.filter-sidebar h3 {
    margin-top: 0;
    color: #333;
    border-bottom: 1px solid #ddd;
    padding-bottom: 10px;
}
.filter-button {
    
    color:black;
   
    padding: 10px;
    margin-bottom: 8px;
    text-align: left;
    border: none;
    background-color: transparent;
    cursor: pointer;
    font-size: 1em;
    border-radius: 4px;
    transition: background-color 0.2s;
}
.filter-button:hover {
    background-color: #e9ecef;
}
.filter-button.active {
    background-color: #007bff;
    color: white;
    font-weight: bold;
}
.filter-button.active:hover {
    background-color: #0056b3;
}

/* Lista de Resultados */
.results-list {
    flex: 1;
}
.results-header {

display flex;
flex-direction: row;
    color: #007bff;
    border-bottom: 2px solid #eee;
    padding-bottom: 10px;
    margin-bottom: 15px;
}
.result-item {
    display: flex;
    align-items: center;
    padding: 10px;
    margin-bottom: 10px;
    border: 1px solid #ddd;
    border-radius: 6px;
    cursor: pointer;
    transition: transform 0.2s, box-shadow 0.2s;
}
.result-item:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 10px rgba(0, 123, 255, 0.2);
}

.item-title {
    font-weight: bold;
    font-size: 1.1em;
}
.item-type {
    font-size: 0.85em;
    font-weight: bold;
    text-align: center;
    padding: 5px 10px;
    border-radius: 3px;
    color: white;
    width: fit-content;
}
.item-detail {
    color: #6c757d;
    text-align: right;
    font-size: 0.9em;
}

/* Estilos por Tipo de Item */
.result-item-cliente .item-type { background-color: #28a745; }
.result-item-contrato .item-type { background-color: #ffc107; color: #333; }
.result-item-poco .item-type { background-color: #17a2b8; }

.no-results {
    padding: 20px;
    text-align: center;
    color: #dc3545;
    background-color: #f8d7da;
    border: 1px solid #f5c6cb;
    border-radius: 6px;
}
`;

// Opcional: Adicionar estilos ao DOM para visualização
if (typeof document !== 'undefined') {
    const styleTag = document.createElement('style');
    styleTag.textContent = style;
    document.head.appendChild(styleTag);
}

export default SearchDashboard;