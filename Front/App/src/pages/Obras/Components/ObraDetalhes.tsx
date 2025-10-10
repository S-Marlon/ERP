// src/modules/Obras/ObraDetalhes.tsx
import React, { useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
// import { TabItem } from '../../../types/tabs'; // Mantido, mas não usado na implementação manual de Abas

import { mockObras, mockClientes, mockAtividades, mockRegistrosTempo, Obra } from '../../../types/Obras';
// import TabsContainer from '../../../components/TabsContainer'; // Removido ou ignorado para focar na estilização manual
import DadosGeraisForm from '../../../components/forms/-DadosGeraisForm';
import DadosPerfuracaoForm from '../../../components/forms/DadosPerfuracaoForm';
import DadosRevestimentoForm from '../../../components/forms/DadosPerfuracaoForm';
import ChecklistOcorrenciasForm from '../../../components/forms/ChecklistOcorrenciasForm';


// Componentes de Conteúdo das Abas (Exemplo - mantive os componentes originais)
const AbaGeralContent: React.FC = () => <DadosGeraisForm />; 
const AbaAtividadesContent: React.FC = () => <DadosPerfuracaoForm />; 
const AbaRegistrosTempoContent: React.FC = () => <DadosRevestimentoForm />; 
const AbaLocalizacaoContent: React.FC = () => <ChecklistOcorrenciasForm />; 


// Componentes das Abas (Implementação SIMPLIFICADA e ESTILIZADA)

// 1. Aba Geral: Estrutura em duas colunas para campos
const AbaGeral: React.FC<{ obra: Obra, clienteNome: string }> = ({ obra, clienteNome }) => (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        <div className="info-group">
            <h4 style={{ margin: '0 0 10px 0', borderBottom: '1px solid #eee', paddingBottom: '5px' }}>Detalhes Principais</h4>
            <p><strong>Cliente:</strong> {clienteNome}</p>
            <p><strong>Status:</strong> {obra.status}</p>
            <p><strong>Endereço:</strong> {obra.endereco}</p>
        </div>
        <div className="info-group">
            <h4 style={{ margin: '0 0 10px 0', borderBottom: '1px solid #eee', paddingBottom: '5px' }}>Prazos</h4>
            <p><strong>Data Início:</strong> {obra.dataInicio}</p>
            <p><strong>Data Fim Prevista:</strong> {obra.dataFimPrevista}</p>
        </div>
        {/* Aqui você pode renderizar o DadosGeraisForm, se necessário */}
        {/* <DadosGeraisForm /> */}
    </div>
);

// 2. Aba Atividades: Ícone para status
const AbaAtividades: React.FC<{ obraId: string }> = ({ obraId }) => {
    const atividades = mockAtividades.filter(a => a.obraId === obraId);
    return (
        <div>
            <h3 style={{ borderBottom: '1px solid #eee', paddingBottom: '10px' }}>Atividades/Tarefas</h3>
            <ul style={{ listStyleType: 'none', padding: 0 }}>
                {atividades.map(atv => (
                    <li key={atv.id} style={{ marginBottom: '8px', display: 'flex', alignItems: 'center', color: atv.concluida ? '#888' : '#333' }}>
                        <span 
                            style={{ 
                                marginRight: '10px', 
                                color: atv.concluida ? 'green' : 'orange', 
                                fontSize: '1.2em' 
                            }}
                        >
                            {atv.concluida ? '✔️' : '⏳'}
                        </span>
                        <span style={{ textDecoration: atv.concluida ? 'line-through' : 'none' }}>
                             {atv.descricao}
                        </span>
                    </li>
                ))}
            </ul>
        </div>
    );
};

// 3. Aba Registros Tempo: Estilização de tabela simples (linhas zebradas)
const AbaRegistrosTempo: React.FC<{ obraId: string }> = ({ obraId }) => {
    const registros = mockRegistrosTempo.filter(r => r.obraId === obraId);
    return (
        <div>
            <h3 style={{ borderBottom: '1px solid #eee', paddingBottom: '10px' }}>Registros de Tempo</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                    <tr style={{ background: '#581919ff' }}>
                        <th style={tableHeaderStyle}>Data</th>
                        <th style={tableHeaderStyle}>Horas</th>
                        <th style={tableHeaderStyle}>Descrição</th>
                    </tr>
                </thead>
                <tbody>
                    {registros.map((reg, index) => (
                        <tr 
                            key={reg.id} 
                            style={{ background: index % 2 === 0 ? 'white' : '#581919ff' }}
                        >
                            <td style={tableCellStyle}>{reg.data}</td>
                            <td style={tableCellStyle}>{reg.horas}h</td>
                            <td style={tableCellStyle}>{reg.descricao}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

// Estilos de célula e cabeçalho para a tabela
const tableHeaderStyle = { 
    padding: '10px', 
    textAlign: 'left' as const, 
    borderBottom: '2px solid #ddd' 
};
const tableCellStyle = { 
    padding: '10px', 
    borderBottom: '1px solid #eee' 
};


// 4. Aba Localizacao: Mantida, mas com título estilizado
const AbaLocalizacao: React.FC<{ obra: Obra }> = ({ obra }) => (
    <div>
        <h3 style={{ borderBottom: '1px solid #eee', paddingBottom: '10px' }}>Localização (Mapa)</h3>
        <p>Aqui você teria um componente de mapa (e.g., Leaflet, Google Maps) com o pin da obra.</p>
        <p><strong>Latitude:</strong> {obra.latitude}</p>
        <p><strong>Longitude:</strong> {obra.longitude}</p>
    </div>
);


// -----------------------------------------------------------
// Componente Principal
// -----------------------------------------------------------

export const ObraDetalhes: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const [abaAtiva, setAbaAtiva] = useState<'Geral' | 'Atividades' | 'Registros' | 'Localizacao'| 'Imagens'>('Geral');
    
    // Buscar Obra e Cliente
    const obra = useMemo(() => mockObras.find(o => o.id === 'obra-1'), [id]);
    const cliente = useMemo(() => mockClientes.find(c => c.id === obra?.clienteId), [obra]);

    if (!obra) {
        return <h2>Obra não encontrada!</h2>;
    }

    const renderizarAba = () => {
        switch (abaAtiva) {
            case 'Geral':
                return <AbaGeral obra={obra} clienteNome={cliente?.nome || 'N/A'} />;
            case 'Atividades':
                return <AbaAtividades obraId={obra.id} />;
            case 'Registros':
                return <AbaRegistrosTempo obraId={obra.id} />;
            case 'Localizacao':
                return <AbaLocalizacao obra={obra} />;
            default:
                return <p>Conteúdo da aba {abaAtiva}</p>;
        }
    };

    // Estilo para a aba ativa (destaque com borda inferior)
    const getTabStyle = (tabName: string) => ({
        padding: '10px 15px',
        border: 'none',
        background: 'transparent',
        cursor: 'pointer',
        fontWeight: abaAtiva === tabName ? 'bold' : 'normal',
        borderBottom: abaAtiva === tabName ? '3px solid #007bff' : '3px solid transparent', // Cor de destaque azul
        color: abaAtiva === tabName ? '#007bff' : '#333',
        marginRight: '5px',
        transition: 'all 0.2s'
    });
    
    // Estilo para o Badge de Status (exemplo de cor verde para "Em Andamento")
    const statusBadgeStyle = {
        background: '#28a745', // Verde
        color: 'white',
        padding: '5px 10px',
        borderRadius: '4px',
        fontSize: '14px',
        fontWeight: 'bold',
        alignSelf: 'center' // Alinha verticalmente ao centro no cabeçalho
    };

    return (
        <div style={{ padding: '20px' }}>

            {/* 1. CABEÇALHO OTIMIZADO (Título, Subtítulo e Status Badge) */}
            <header className="header-container" style={{ marginBottom: '20px', paddingBottom: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                        {/* Título Principal */}
                        <h1 style={{ margin: '0', fontSize: '2em' }}>{obra.titulo}</h1>
                        {/* Subtítulo (Código e Cliente) */}
                        <p style={{ color: '#666', marginTop: '5px', fontSize: '1.1em' }}>P001-0825 - João Vicente</p>
                    </div>
                    {/* Badge de Status */}
                    <span className='status-badge' style={statusBadgeStyle}>Em Andamento</span>
                </div>
            </header>

            {/* 2. BARRA DE AÇÕES ESTILIZADA */}
            <div className="action-buttons-container" style={{ marginBottom: '30px', display: 'flex', gap: '10px' }}>

                <button className="action-button edit-button" style={{ padding: '8px 15px', border: '1px solid #1f4e62ff', background: '#1e4974ff', borderRadius: '4px', cursor: 'pointer' }}>
                    Editar
                </button>
                <button className="action-button time-log-button" style={{ padding: '8px 15px', border: 'none', background: '#007bff', color: 'white', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>
                    Novo Registro de Tempo
                </button>
                
                {/* O Select nativo é difícil de estilizar, mas ajustamos o padding */}
                <select className="dropdown" style={{ padding: '8px 15px', border: '1px solid #ccc', background: '#007bff', borderRadius: '4px', cursor: 'pointer' }}>
                    <option className="action-button dropdown-toggle">
                        Ações
                    </option>
                    <option>Finalizar Obra</option>
                    <option>Pausar Obra</option>
                    <option>Gerar Relatório</option>
                </select>
            </div>
            
            {/* 3. NAVEGAÇÃO POR ABAS ESTILIZADA */}
            <div 
                className="tab-navigation" 
                style={{ 
                    display: 'flex', 
                    borderBottom: '1px solid #ccc', 
                    marginBottom: '20px', 
                    overflowX: 'auto' 
                }}
            >
                <button onClick={() => setAbaAtiva('Geral')} style={getTabStyle('Geral')}>Geral</button>
                <button onClick={() => setAbaAtiva('Atividades')} style={getTabStyle('Atividades')}>Atividades/Tarefas</button>
                <button onClick={() => setAbaAtiva('Registros')} style={getTabStyle('Registros')}>Registros de Tempo</button>
                <button onClick={() => setAbaAtiva('Localizacao')} style={getTabStyle('Localizacao')}>Localização</button>
                <button onClick={() => setAbaAtiva('Imagens')} style={getTabStyle('Imagens')}>Imagens</button>
                {/* Adicionando as abas adicionais para consistência */}
                <button onClick={() => setAbaAtiva('Serviços')} style={getTabStyle('Serviços')}>Serviços Futuros</button>
                <button onClick={() => setAbaAtiva('Galeria')} style={getTabStyle('Galeria')}>Galeria</button>

            </div>

            {/* 4. CONTEÚDO DA ABA ATIVA */}
            <div className="tab-content" style={{ padding: '15px 0' }}>
                {renderizarAba()}
            </div>
        </div>
    );
};