import React, { useState, useEffect } from 'react';

// ----------------- TIPOS DE DADOS MOCK (Simplificados) -----------------

interface DetalhesPoco {
  id: string;
  nomeIdentificacao: string;
  profundidadeTotal: number;
  vazaoMaxima: number;
  dataConclusao: string;
  
  // Relações
  clienteNome: string;
  clienteId: string;
  contratoTitulo: string;
  contratoId: string;
  
  // Status dos Sub-Cadastros
  perfilGeologico: 'Pendente' | 'Concluído';
  conjuntoBombeamento: 'Pendente' | 'Concluído';
  testeHidraulico: 'Pendente' | 'Concluído';
  testeAceitacao: 'Pendente' | 'Concluído';
  complementosContrato: number; // Número de complementos
}

// ----------------- DADOS MOCK DE EXEMPLO -----------------

const MOCK_DATA: DetalhesPoco = {
  id: 'poco-101',
  nomeIdentificacao: 'Poço Principal - Fazenda Esperança',
  profundidadeTotal: 152.5,
  vazaoMaxima: 5.8,
  dataConclusao: '2025-09-15',
  clienteNome: 'Empresa Alpha Ltda (PJ)',
  clienteId: 'cli-002',
  contratoTitulo: 'Contrato Poço Novo - FAZ-ESP',
  contratoId: 'cont-005',
  
  perfilGeologico: 'Concluído',
  conjuntoBombeamento: 'Concluído',
  testeHidraulico: 'Pendente',
  testeAceitacao: 'Pendente',
  complementosContrato: 2,
};

// ----------------- COMPONENTE PRINCIPAL -----------------

interface PainelProps {
    pocoId: string; // ID do poço a ser carregado
}

const PainelDetalhePoco: React.FC<PainelProps> = ({ pocoId }) => {
  const [detalhes, setDetalhes] = useState<DetalhesPoco | null>(null);
  const [loading, setLoading] = useState(true);

  // Simulação do carregamento de dados (API call)
  useEffect(() => {
    // Em um app real, faríamos um fetch( `/api/poco/${pocoId}` )
    setTimeout(() => {
      setDetalhes(MOCK_DATA);
      setLoading(false);
    }, 500);
  }, [pocoId]);

  if (loading) {
    return <div className="loading-container">Carregando detalhes do poço...</div>;
  }
  
  if (!detalhes) {
    return <div className="error-container">Poço não encontrado.</div>;
  }
  
  // Função que simula a abertura do formulário
  const handleAction = (acao: string, targetId: string) => {
    alert(`Ação: ${acao} \nAbrindo formulário para: ${targetId}`);
    // Aqui você faria a navegação (React Router) ou abriria um modal
    // Ex: navigate('/cadastro/perfil-geologico', { state: { pocoId: detalhes.id } });
  };

  const getStatusClass = (status: 'Pendente' | 'Concluído') => 
    status === 'Concluído' ? 'status-concluido' : 'status-pendente';

  // ----------------- RENDERIZAÇÃO -----------------

  return (
    <div className="dashboard-container">
      <h1>Painel do Poço: {detalhes.nomeIdentificacao}</h1>
      <p className="path-info">
          Cliente: 
          <span className="link-info" onClick={() => handleAction('Visualizar Cliente', detalhes.clienteId)}>
              {detalhes.clienteNome}
          </span>
          {' | '} 
          Contrato: 
          <span className="link-info" onClick={() => handleAction('Visualizar Contrato', detalhes.contratoId)}>
              {detalhes.contratoTitulo}
          </span>
      </p>

      {/* ----------------- VISUALIZAÇÃO BÁSICA ----------------- */}
      <section className="info-cards">
        <div className="card">
            <h3>Profundidade</h3>
            <p>{detalhes.profundidadeTotal} m</p>
        </div>
        <div className="card">
            <h3>Vazão Máxima</h3>
            <p>{detalhes.vazaoMaxima} m³/h</p>
        </div>
        <div className="card">
            <h3>Data Conclusão</h3>
            <p>{detalhes.dataConclusao}</p>
        </div>
      </section>
      
      {/* ----------------- SEÇÃO: CADASTROS E STATUS ----------------- */}
      <div className="section-grid">
          <fieldset className="cadastro-section">
            <legend>Cadastros e Relatórios Técnicos</legend>
            
            <div className="action-row">
                <span>Perfil Geológico</span>
                <span className={getStatusClass(detalhes.perfilGeologico)}>{detalhes.perfilGeologico}</span>
                <button 
                    onClick={() => handleAction('Cadastro Perfil Geológico', detalhes.id)} 
                    className="action-button primary"
                >
                    {detalhes.perfilGeologico === 'Pendente' ? 'Cadastrar' : 'Visualizar/Editar'}
                </button>
            </div>

            <div className="action-row">
                <span>Conjunto de Bombeamento</span>
                <span className={getStatusClass(detalhes.conjuntoBombeamento)}>{detalhes.conjuntoBombeamento}</span>
                <button 
                    onClick={() => handleAction('Cadastro Conjunto de Bombeamento', detalhes.id)} 
                    className="action-button primary"
                >
                    {detalhes.conjuntoBombeamento === 'Pendente' ? 'Cadastrar' : 'Visualizar/Editar'}
                </button>
            </div>

            <div className="action-row">
                <span>Teste Hidráulico</span>
                <span className={getStatusClass(detalhes.testeHidraulico)}>{detalhes.testeHidraulico}</span>
                <button 
                    onClick={() => handleAction('Cadastro Teste Hidráulico', detalhes.id)} 
                    className="action-button primary"
                >
                    {detalhes.testeHidraulico === 'Pendente' ? 'Cadastrar' : 'Visualizar/Editar'}
                </button>
            </div>

            <div className="action-row">
                <span>Teste de Aceitação</span>
                <span className={getStatusClass(detalhes.testeAceitacao)}>{detalhes.testeAceitacao}</span>
                <button 
                    onClick={() => handleAction('Marcar Teste de Aceitação', detalhes.id)} 
                    className="action-button secondary"
                >
                    {detalhes.testeAceitacao === 'Pendente' ? 'Marcar como Aceito' : 'Visualizar Status'}
                </button>
            </div>
            
          </fieldset>
          
          <fieldset className="complemento-section">
            <legend>Documentação e Ações</legend>
            
            {/* Cadastro de Complementos de Contrato */}
            <button 
                onClick={() => handleAction('Cadastrar Complemento de Contrato', detalhes.contratoId)} 
                className="full-button complement"
            >
                ➕ Cadastrar Complemento de Contrato ({detalhes.complementosContrato} Registrados)
            </button>
            
            <hr/>
            
            {/* Ação: Gerar Relatório */}
            <button 
                onClick={() => handleAction('Gerar Relatório Completo', detalhes.id)} 
                className="full-button report"
            >
                📄 Gerar Relatório Completo do Poço (PDF)
            </button>

            {/* Ação: Visualizar Histórico */}
            <button 
                onClick={() => handleAction('Visualizar Histórico de Serviços', detalhes.id)} 
                className="full-button history"
            >
                ⏱️ Visualizar Histórico de Serviços
            </button>
          </fieldset>
      </div>
    </div>
  );
};

// ----------------- ESTILOS (CSS) -----------------
const style = `
.dashboard-container {
    max-width: 1000px;
    margin: 20px auto;
    padding: 30px;
    border: 1px solid #007bff;
    border-radius: 10px;
    box-shadow: 0 8px 16px rgba(0,0,0,0.1);
    font-family: Arial, sans-serif;
}
h1 { color: #007bff; border-bottom: 2px solid #eee; padding-bottom: 10px; margin-bottom: 5px; }
.path-info { font-size: 0.9em; color: #6c757d; margin-bottom: 25px; }
.link-info { color: #007bff; cursor: pointer; text-decoration: underline; margin-right: 5px; }
.link-info:hover { color: #0056b3; }

/* Cartões de Informação */
.info-cards {
    display: flex;
    gap: 20px;
    margin-bottom: 30px;
}
.card {
    flex: 1;
    background-color: #f8f9fa;
    padding: 15px;
    border-radius: 8px;
    text-align: center;
    border-left: 5px solid #007bff;
}
.card h3 { margin: 0 0 5px 0; font-size: 1.1em; color: #333; }
.card p { margin: 0; font-size: 1.4em; font-weight: bold; color: #007bff; }

/* Grid de Seções */
.section-grid {
    display: grid;
    grid-template-columns: 2fr 1fr; /* Cadastros e Ações */
    gap: 20px;
}
/* Linhas de Ação */
.action-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 0;
    border-bottom: 1px solid #eee;
}
.action-row:last-child { border-bottom: none; }
.action-row span { font-weight: 500; }

/* Status */
.status-concluido { color: white; background-color: #28a745; padding: 4px 8px; border-radius: 4px; font-size: 0.8em; font-weight: bold; }
.status-pendente { color: white; background-color: #ffc107; padding: 4px 8px; border-radius: 4px; font-size: 0.8em; font-weight: bold; }

/* Botões de Ação */
.action-button {
    padding: 8px 15px;
    border: none;
    border-radius: 5px;
    cursor: pointer;
    font-weight: bold;
    transition: background-color 0.2s ease;
}
.primary { background-color: #007bff; color: white; }
.primary:hover { background-color: #0056b3; }
.secondary { background-color: #6c757d; color: white; }
.secondary:hover { background-color: #5a6268; }

/* Botões Full */
.full-button {
    width: 100%;
    padding: 12px;
    margin-bottom: 10px;
    border: none;
    border-radius: 5px;
    cursor: pointer;
    font-weight: bold;
    transition: background-color 0.2s ease;
    text-align: left;
}
.complement { background-color: #17a2b8; color: white; }
.complement:hover { background-color: #117a8b; }
.report { background-color: #28a745; color: white; }
.report:hover { background-color: #1e7e34; }
.history { background-color: #ffc107; color: #333; }
.history:hover { background-color: #e0a800; }

hr { border: 0; border-top: 1px solid #eee; margin: 15px 0; }
`;

// Opcional: Adicionar estilos ao DOM para visualização
if (typeof document !== 'undefined') {
  const styleTag = document.createElement('style');
  styleTag.textContent = style;
  document.head.appendChild(styleTag);
}

export default PainelDetalhePoco;