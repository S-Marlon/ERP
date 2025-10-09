// src/modules/Obras/ObraDetalhes.tsx
import React, { useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { TabItem } from '../../../types/tabs';

import { mockObras, mockClientes, mockAtividades, mockRegistrosTempo, Obra } from '../../../types/Obras';
import TabsContainer from '../../../components/TabsContainer';
import DadosGeraisForm from '../../../components/forms/DadosGeraisForm';
import DadosPerfuracaoForm from '../../../components/forms/DadosPerfuracaoForm';
import DadosRevestimentoForm from '../../../components/forms/DadosPerfuracaoForm';
import ChecklistOcorrenciasForm from '../../../components/forms/ChecklistOcorrenciasForm';


// Supondo que você tenha os componentes de conteúdo para cada aba
const AbaGeralContent: React.FC = () => <DadosGeraisForm />; // Usando o formulário existente
const AbaAtividadesContent: React.FC = () => <DadosPerfuracaoForm />; // Exemplo de outro formulário
const AbaRegistrosTempoContent: React.FC = () => <DadosRevestimentoForm />; // Exemplo de outro formulário
const AbaLocalizacaoContent: React.FC = () => <ChecklistOcorrenciasForm />; // Exemplo de outro formulário



const obraTabs: TabItem[] = [
       {
           id: 'geral',
           label: 'Geral',
           content: <AbaGeralContent />
       },
       {
           id: 'atividades',
           label: 'Atividades/Tarefas',
           content: <AbaAtividadesContent />
       },
       {
           id: 'registros',
           label: 'Registros de Tempo',
           content: <AbaRegistrosTempoContent />
       },
       {
           id: 'localizacao',
           label: 'Localização',
           content: <AbaLocalizacaoContent />
       },
       {
           id: 'servicos',
           label: 'Serviços Futuros',
           content: <AbaLocalizacaoContent />
       },
       {
           id: 'galeria',
           label: 'galeria',
           content: <AbaLocalizacaoContent />
       },
   ];
// Componentes das Abas (implementação simplificada)
const AbaGeral: React.FC<{ obra: Obra, clienteNome: string }> = ({ obra, clienteNome }) => (
    <div>
        <h3>Informações Gerais</h3>
        <p><strong>Cliente:</strong> {clienteNome}</p>
        <p><strong>Status:</strong> {obra.status}</p>
        <p><strong>Data Início:</strong> {obra.dataInicio}</p>
        <p><strong>Data Fim Prevista:</strong> {obra.dataFimPrevista}</p>
        <p><strong>Endereço:</strong> {obra.endereco}</p>
    </div>
);

const AbaAtividades: React.FC<{ obraId: string }> = ({ obraId }) => {
    const atividades = mockAtividades.filter(a => a.obraId === obraId);
    return (
        <div>
            <h3>Atividades/Tarefas</h3>
            <ul>
                {atividades.map(atv => (
                    <li key={atv.id} style={{ textDecoration: atv.concluida ? 'line-through' : 'none' }}>
                        {atv.descricao} - **{atv.concluida ? 'Concluída' : 'Pendente'}**
                    </li>
                ))}
            </ul>
        </div>
    );
};

const AbaRegistrosTempo: React.FC<{ obraId: string }> = ({ obraId }) => {
    const registros = mockRegistrosTempo.filter(r => r.obraId === obraId);
    return (
        <div>
            <h3>Registros de Tempo</h3>
            <table>
                <thead>
                    <tr>
                        <th>Data</th>
                        <th>Horas</th>
                        <th>Descrição</th>
                    </tr>
                </thead>
                <tbody>
                    {registros.map(reg => (
                        <tr key={reg.id}>
                            <td>{reg.data}</td>
                            <td>{reg.horas}h</td>
                            <td>{reg.descricao}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

// **NOTA:** O componente Mapa (Leaflet/Google Maps) seria uma dependência externa complexa.
// Para simulação, exibiremos apenas as coordenadas.
const AbaLocalizacao: React.FC<{ obra: Obra }> = ({ obra }) => (
    <div>
        <h3>Localização (Mapa)</h3>
        <p>Aqui você teria um componente de mapa (e.g., Leaflet, Google Maps) com o pin da obra.</p>
        <p><strong>Latitude:</strong> {obra.latitude}</p>
        <p><strong>Longitude:</strong> {obra.longitude}</p>
    </div>
);


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
        return null;
    }
  };

  return (
    <div>
      <h1>Detalhes da Obra: </h1> <h2>{obra.titulo}</h2>
      <div className="flex-row" style={{justifyContent:'space-between', alignItems:'center'}}>
        <h2>P001-0825 - João vicente</h2>
        <h2 style={{textAlign:'right', background: 'orange', borderRadius:'8px', padding: '5px' }}>Em Andamento</h2>

        </div>

                <div className="action-buttons-container">

    <button className="action-button edit-button" >
        Editar
    </button>
    <button className="action-button time-log-button">
        Novo Registro de Tempo
    </button>
    <select className="dropdown">
        <option className="action-button dropdown-toggle">
            Ações
        </option>
            <option>Finalizar Obra</option>
            <option>Pausar Obra</option>
            <option>Gerar Relatório</option>
        
    </select>
</div>
      <Link to={`/obras/${obra.id = 'obra-1'}/editar`}>Editar Obra</Link>

      {/* Navegação por Abas */}
      <div style={{ display: 'flex', gap: '10px', borderBottom: '1px solid #ccc', marginBottom: '15px' }}>
        <button onClick={() => setAbaAtiva('Geral')} style={{ fontWeight: abaAtiva === 'Geral' ? 'bold' : 'normal' }}>Geral</button>
        <button onClick={() => setAbaAtiva('Atividades')} style={{ fontWeight: abaAtiva === 'Atividades' ? 'bold' : 'normal' }}>Atividades/Tarefas</button>
        <button onClick={() => setAbaAtiva('Registros')} style={{ fontWeight: abaAtiva === 'Registros' ? 'bold' : 'normal' }}>Registros de Tempo</button>
        <button onClick={() => setAbaAtiva('Localizacao')} style={{ fontWeight: abaAtiva === 'Localizacao' ? 'bold' : 'normal' }}>Localização</button>
        <button onClick={() => setAbaAtiva('Imagens')} style={{ fontWeight: abaAtiva === 'Imagens' ? 'bold' : 'normal' }}>Imagens</button>
      </div>

      {/* Conteúdo da Aba Ativa */}
      <div style={{ border: '1px solid #eee', padding: '15px' }}>
        {renderizarAba()}
      </div>

      <TabsContainer tabs={obraTabs} />
      
    </div>
  );
};