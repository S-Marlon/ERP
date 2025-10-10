import React, { useState, ChangeEvent, useMemo } from 'react';
import './SearchDashboard.css'; // Importa o CSS

// ----------------- TIPOS E DADOS MOCKADOS -----------------

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

// Opções de filtro que serão mapeadas no JSX

// ----------------- COMPONENTE -----------------

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

    // Lógica de Filtragem e Busca (usando useMemo para performance)
    const resultadosFiltrados = useMemo(() => {
        let resultados = DADOS_MOCK;

        // 1. Filtrar por Tipo
        if (filterType !== 'Todos') {
            // Mapeia 'Poço' do filtro para 'Poco' no dado mockado
            const tipoBusca = filterType === 'Poço' ? 'Poco' : filterType; 
            resultados = resultados.filter(item => item.tipo === tipoBusca);
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
        <div className="search-dashboard-container">
            <h1 className="main-title">Busca Global</h1>
           

            <div className="content-area">
                <div className="results-list">
                   

 <div className=" results-header" >

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
                                    {/* Coluna 1: Tipo */}
                                    <div className="flex-column item-column-type">
                                        <div className="item-type">{item.tipo}</div>
                                        <div className="item-id">{item.id}</div>
                                    </div>
                                    
                                    {/* Coluna 2: Título Principal */}
                                    <div className="flex-column item-column-title">
                                        <div className="item-label">Nome</div>
                                        <div className="item-title">{item.titulo}</div>
                                    </div>
                                    
                                    {/* Coluna 3: Subdetalhe/CNPJ/Cliente Associado */}
                                    <div className="flex-column item-column-detail">
                                        <div className="item-label">Detalhe Secundário</div>
                                        <div className="item-detail">Lorem ipsum dolor sit amet consectetur, adipisicing elit. Dolorum, deserunt incidunt. Alias quam minima molestias, velit officiis consectetur sapiente corporis saepe ut dolorum voluptatem ipsa animi nulla voluptates repudiandae dicta.</div>
                                    </div>
                                    
                                    {/* Coluna 4: Status (Exemplo fixo) */}
                                    <div className="flex-column item-column-status">
                                        <h5 className="item-status">Em Andamento</h5>
                                    </div>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="no-results">
                            Nenhum resultado encontrado para **"{searchTerm}"** no filtro de **{filterType}**.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SearchDashboard;