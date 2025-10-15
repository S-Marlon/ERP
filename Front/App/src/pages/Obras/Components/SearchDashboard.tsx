import React, { useState, ChangeEvent, useMemo } from 'react';
import Typography from '../../../components/ui/Typography';
import Button from '../../../components/ui/Button';
import Badge from '../../../components/ui/Badge';
import './SearchDashboard.css'; // Importa o CSS
import Card from '../../../components/ui/Card';

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
        <Card variant='highlight' className="search-dashboard-container">
            <Typography variant="h1Alt" className="main-title">Busca Global</Typography>
            <div className="content-area">
                <div className="results-list">
                    <div className="results-header">
                        <Typography variant="h3">Resultados ({resultadosFiltrados.length})</Typography>
                        <div>
                            <Typography variant="strong" as="label">Filtrar Por:</Typography>
                            {['Todos', 'Cliente', 'Contrato', 'Poço'].map((tipo) => (
                                <Button
                                    key={tipo}
                                    variant={filterType === tipo ? "primary" : "outline"}
                                    style={{ marginLeft: 8 }}
                                    onClick={() => handleFilterChange(tipo as FiltroTipo)}
                                >
                                    {tipo}
                                </Button>
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
                                        <Typography variant="strong" className="item-type">{item.tipo}</Typography>
                                        <Typography variant="small" className="item-id">{item.id}</Typography>
                                    </div>
                                    
                                    {/* Coluna 2: Título Principal */}
                                    <div className="flex-column item-column-title">
                                        <Typography variant="small" className="item-label">Nome</Typography>
                                        <Typography variant="p" className="item-title">{item.titulo}</Typography>
                                    </div>
                                    
                                    {/* Coluna 3: Subdetalhe/CNPJ/Cliente Associado */}
                                    <div className="flex-column item-column-detail">
                                        <Typography variant="small" className="item-label">Detalhe Secundário</Typography>
                                        <Typography variant="p" className="item-detail">{item.subDetalhe}</Typography>
                                    </div>
                                    
                                    {/* Coluna 4: Status */}
                                    <div className="flex-column item-column-status">
                                        <Badge color="warning">Em Andamento</Badge>
                                    </div>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="no-results">
                            <Typography variant="p">
                                Nenhum resultado encontrado para <strong>"{searchTerm}"</strong> no filtro de <strong>{filterType}</strong>.
                            </Typography>
                        </div>
                    )}
                </div>
            </div>
        </Card>
    );
};

export default SearchDashboard;