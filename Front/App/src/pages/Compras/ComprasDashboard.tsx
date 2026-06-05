import React from 'react';
import App from '../../App';
import { useNavigate } from 'react-router-dom';

// Simulando a estrutura de estilos. Você pode mover isso para um arquivo de CSS separado.
const styles = {
  container: {
    fontFamily: 'Arial, sans-serif',
    padding: '24px',
    backgroundColor: '#f8f9fa',
    minHeight: '100vh',
    color: '#333',
  },
  header: {
    marginBottom: '32px',
    borderBottom: '2px solid #e9ecef',
    paddingBottom: '16px',
  },
  title: {
    fontSize: '28px',
    margin: 0,
    color: '#1a202c',
  },
  subtitle: {
    fontSize: '14px',
    color: '#718096',
    marginTop: '4px',
  },
  mainActionSection: {
    backgroundColor: '#ffffff',
    borderRadius: '8px',
    padding: '24px',
    marginBottom: '32px',
    boxShadow: '0 4px 6px rgba(0,0,0,0.05)',
    borderLeft: '6px solid #2b6cb0', // Destaque azul para a ação principal
  },
  actionTitle: {
    fontSize: '18px',
    fontWeight: 'bold',
    marginBottom: '8px',
  },
  primaryButton: {
    backgroundColor: '#2b6cb0',
    color: '#fff',
    border: 'none',
    padding: '12px 24px',
    fontSize: '16px',
    fontWeight: 'bold',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
    boxShadow: '0 2px 4px rgba(43, 108, 176, 0.3)',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: '20px',
    marginBottom: '32px',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: '8px',
    padding: '20px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
    border: '1px solid #e2e8f0',
    opacity: 0.7, // Opacidade menor para indicar que são dados fictícios/futuros
  },
  cardTitle: {
    fontSize: '14px',
    color: '#4a5568',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
    marginBottom: '8px',
  },
  cardValue: {
    fontSize: '24px',
    fontWeight: 'bold',
    color: '#2d3748',
  },
  tableSection: {
    backgroundColor: '#fff',
    borderRadius: '8px',
    padding: '20px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
    border: '1px solid #e2e8f0',
    opacity: 0.7,
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    marginTop: '16px',
  },
  th: {
    textAlign: 'left' as const,
    padding: '12px',
    borderBottom: '2px solid #e2e8f0',
    color: '#4a5568',
    fontSize: '14px',
  },
  td: {
    padding: '12px',
    borderBottom: '1px solid #e2e8f0',
    color: '#718096',
    fontSize: '14px',
  },
};

export default function ComprasDashboard() {

    const navigate = useNavigate(); // Inicializa o hook
  
  // Função que será conectada à sua tela já existente
  const handleNovaNFe = () => {
    alert('Redirecionando para a tela de Entrada de NF-e...');
    // Aqui você insere a sua rota ou abertura de modal, ex:
    // history.push('/compras/entrada-nfe');
   navigate('/compras/entrada-nfe');
  };

  return (
    <div style={styles.container}>
      {/* CABEÇALHO DA TELA */}
      <header style={styles.header}>
        <h1 style={styles.title}>Módulo de Compras</h1>
        <p style={styles.subtitle}>Gestão de suprimentos, notas fiscais e fornecedores.</p>
      </header>

      {/* SEÇÃO DA AÇÃO PRINCIPAL (Destaque total para a NF-e) */}
      <section style={styles.mainActionSection}>
        <div style={{ marginBottom: '16px' }}>
          <h2 style={styles.actionTitle}>Operações Importantes</h2>
          <p style={{ color: '#4a5568', margin: 0, fontSize: '14px' }}>
            Inicie o processo de recebimento de mercadorias importando a nota fiscal.
          </p>
        </div>
        <button 
          style={styles.primaryButton} 
          onClick={handleNovaNFe}
          onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#2c5282')}
          onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#2b6cb0')}
        >
          ⚙️ Dar Entrada em NF-e
        </button>
      </section>

      {/* ACESSOS FUTUROS / INDICADORES FICTÍCIOS */}
      <h3 style={{ fontSize: '18px', marginBottom: '16px', color: '#4a5568' }}>
        Indicadores do Mês (Demonstrativo)
      </h3>
      
      <div style={styles.grid}>
        <div style={styles.card}>
          <div style={styles.cardTitle}>Pedidos em Aberto</div>
          <div style={styles.cardValue}>12</div>
          <small style={{ color: '#a0aec0' }}>Aguardando integração backend</small>
        </div>

        <div style={styles.card}>
          <div style={styles.cardTitle}>Total Comprado (Mês)</div>
          <div style={styles.cardValue}>R$ 45.200,00</div>
          <small style={{ color: '#a0aec0' }}>Aguardando integração backend</small>
        </div>

        <div style={styles.card}>
          <div style={styles.cardTitle}>Fornecedores Ativos</div>
          <div style={styles.cardValue}>84</div>
          <small style={{ color: '#a0aec0' }}>Aguardando integração backend</small>
        </div>

        <div style={styles.card}>
          <div style={styles.cardTitle}>Aguardando Entrega</div>
          <div style={styles.cardValue}>5</div>
          <small style={{ color: '#a0aec0' }}>Aguardando integração backend</small>
        </div>
      </div>

      {/* TABELA FUTURA / ÚLTIMAS MOVIMENTAÇÕES FICTÍCIAS */}
      <section style={styles.tableSection}>
        <h3 style={{ margin: 0, fontSize: '16px', color: '#2d3748' }}>Últimas Ordens de Compra</h3>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Cód.</th>
              <th style={styles.th}>Fornecedor</th>
              <th style={styles.th}>Data</th>
              <th style={styles.th}>Status</th>
              <th style={styles.th}>Valor</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={styles.td}>#00124</td>
              <td style={styles.td}>Distribuidora Fictícia Ltda</td>
              <td style={styles.td}>05/06/2026</td>
              <td style={styles.td}><span style={{ color: '#dd6b20', fontWeight: 'bold' }}>Pendente</span></td>
              <td style={styles.td}>R$ 1.250,00</td>
            </tr>
            <tr>
              <td style={styles.td}>#00123</td>
              <td style={styles.td}>Indústria de Alimentos Exemplo</td>
              <td style={styles.td}>04/06/2026</td>
              <td style={styles.td}><span style={{ color: '#38a169', fontWeight: 'bold' }}>Recebido</span></td>
              <td style={styles.td}>R$ 14.800,00</td>
            </tr>
          </tbody>
        </table>
        <p style={{ textAlign: 'center', color: '#a0aec0', fontSize: '12px', marginTop: '12px' }}>
          As informações acima são provisórias.
        </p>
      </section>
    </div>
  );
}