// // src/pages/Dashboard.tsx

// import React, { useMemo, useState } from 'react';
// import IndicadorCard from './IndicadorCard';
// import AlertaList from './AlertaList';
// import { AlertaEstoque, MovimentacaoFormData, Produto } from '../../types/estoque';

// const mockProdutos: Produto[] = [
//   { id: 1, nome: 'Teclado Mecânico', sku: 'TM001', quantidadeAtual: 15, estoqueMinimo: 10, precoCusto: 150.00 },
//   { id: 2, nome: 'Mouse Óptico', sku: 'MO002', quantidadeAtual: 4, estoqueMinimo: 5, precoCusto: 50.00 }, // ALERTA
//   { id: 3, nome: 'Monitor 24"', sku: 'MN003', quantidadeAtual: 2, estoqueMinimo: 3, precoCusto: 700.00 }, // ALERTA
//   { id: 4, nome: 'Webcam HD', sku: 'WH004', quantidadeAtual: 25, estoqueMinimo: 5, precoCusto: 80.00 },
// ];


// const EstoqueDashboard: React.FC = () => {
//   const [produtos, setProdutos] = useState<Produto[]>(mockProdutos);
  
//   // --- FUNÇÃO PARA MANIPULAR O ENVIO DO FORMULÁRIO DE MOVIMENTAÇÃO ---
//   const handleMovimentacaoSubmit = (data: MovimentacaoFormData) => {
//     // 1. Encontre o produto a ser atualizado
//     const produtoIndex = produtos.findIndex(p => p.id === data.produtoId);

//     if (produtoIndex !== -1) {
//       const produtoAntigo = produtos[produtoIndex];
//       let novaQuantidade = produtoAntigo.quantidadeAtual;

//       // 2. Calcule a nova quantidade
//       const quantidade = data.quantidade as number; 

//       if (data.tipoMovimento === 'ENTRADA') {
//         novaQuantidade += quantidade;
//       } else if (data.tipoMovimento === 'SAIDA' || data.tipoMovimento === 'AJUSTE') {
//         // Garante que o estoque não fique negativo, a menos que seja um ajuste de inventário
//         if (data.tipoMovimento === 'SAIDA' && novaQuantidade - quantidade < 0) {
//           console.error("Erro: Saída não pode deixar o estoque negativo.");
//           alert(`Erro: A saída de ${quantidade} itens faria o estoque de ${produtoAntigo.nome} ficar negativo.`);
//           return; // Aborta a atualização
//         }
//         novaQuantidade -= quantidade;
//       }
      
//       // 3. Crie o novo produto atualizado
//       const produtoAtualizado: Produto = {
//         ...produtoAntigo,
//         quantidadeAtual: novaQuantidade,
//       };

//       // 4. Atualize o estado da lista de produtos (Imutabilidade do estado)
//       const novaLista = [...produtos];
//       novaLista[produtoIndex] = produtoAtualizado;
      
//       setProdutos(novaLista);

//       console.log('Movimentação Registrada:', data); 
//       console.log('Novo Estoque do Produto:', produtoAtualizado.nome, novaQuantidade);
//     }
//   };
  
//   // --- LÓGICA DE CÁLCULO DOS INDICADORES (KPIs) ---

//   const valorTotalEstoque = useMemo(() => {
//     return produtos.reduce((total, p) => total + (p.quantidadeAtual * p.precoCusto), 0);
//   }, [produtos]);

//   const totalProdutos = produtos.length;

//   const alertasEstoqueBaixo: AlertaEstoque[] = useMemo(() => {
//     return produtos
//       .filter(p => p.quantidadeAtual <= p.estoqueMinimo)
//       .map(p => ({
//         id: p.id,
//         nomeProduto: p.nome,
//         quantidadeAtual: p.quantidadeAtual,
//         estoqueMinimo: p.estoqueMinimo,
//       }));
//   }, [produtos]);
  
//   // --- RENDERIZAÇÃO ---

//   return (
//     <div className="dashboard-container">
      

//       {/* 1. Indicadores-Chave de Desempenho (KPIs) */}
//       <div className="indicadores-grid">
//         <IndicadorCard 
//           titulo="Total de Produtos " 
//           valor={totalProdutos} 
//           unidade="itens" 
//         />
//         <IndicadorCard 
//           titulo="Valor Total do Estoque" 
//           valor={valorTotalEstoque.toFixed(2).replace('.', ',')} 
//           unidade="BRL" 
//         />
//         <IndicadorCard 
//           titulo="Produtos em Alerta" 
//           valor={alertasEstoqueBaixo.length} 
//           unidade="itens" 
//           // Opcional: Adicionar classe de destaque se houver alertas
//           className={alertasEstoqueBaixo.length > 0 ? 'alerta-kpi' : ''} 
//         />

//         <IndicadorCard 
//           titulo="Giro de Vendas (Top 3) 📈" 
//           valor={alertasEstoqueBaixo.length} 
//           unidade="itens" 
//           // Opcional: Adicionar classe de destaque se houver alertas
//           className={alertasEstoqueBaixo.length > 0 ? 'alerta-kpi' : ''} 
//         />

//         <IndicadorCard 
//           titulo="Variação de Custo Pendente (Inflação Interna) 💸" 
//           valor={alertasEstoqueBaixo.length} 
//           unidade="itens" 
//           // Opcional: Adicionar classe de destaque se houver alertas
//           className={alertasEstoqueBaixo.length > 0 ? 'alerta-kpi' : ''} 
//         />

//         <IndicadorCard 
//           titulo="Curva ABC por Categoria (Onde está seu dinheiro?) 📊" 
//           valor={alertasEstoqueBaixo.length} 
//           unidade="itens" 
//           // Opcional: Adicionar classe de destaque se houver alertas
//           className={alertasEstoqueBaixo.length > 0 ? 'alerta-kpi' : ''} 
//         />

//         <IndicadorCard 
//           titulo="Produtos Sem Giro (Estoque Parado) 😴" 
//           valor={alertasEstoqueBaixo.length} 
//           unidade="itens" 
//           // Opcional: Adicionar classe de destaque se houver alertas
//           className={alertasEstoqueBaixo.length > 0 ? 'alerta-kpi' : ''} 
//         />
        
         
        


//       </div>

//       {/* <hr /> */}

//       {/* 2. Ações Rápidas / Gerenciamento de Movimentação */}
//       {/* <div className="acoes-rapidas-section">
//         <h3>✍️ Ações Rápidas: Registrar Movimentação</h3>
        
//       </div> */}
      
//       <hr />

//       {/* 3. Alertas e Notificações */}
//       1. Dashboard (Visão Geral)

// Esta deve ser a página de entrada no módulo de estoque.

//     Finalidade: Oferecer um panorama imediato da saúde do estoque.

//     Conteúdo Essencial:

       
//         <br></br>

//         Gráfico de Movimentação: Visualização das entradas vs. saídas nos últimos 7/30 dias.
//         <br></br>

//         Acesso Rápido: Botões para as operações mais comuns (Ex: Registrar Entrada, Novo Produto, Inventário).



//         {/* --- Coluna de Alerta de Estoque Baixo --- */}
//         <div className="panel alerts-panel">

//           <div className="alertas-section">
//         <AlertaList alertas={alertasEstoqueBaixo} />
//       </div>

          
//         </div>

       
      

//     </div>
//   );
// };

// export default EstoqueDashboard;


import React, { useState, useEffect } from 'react';
import IndicadorCard from './IndicadorCard';
import AlertaList from './AlertaList';
import { getDashboardStats, DashboardStats } from '../../api/DashboardApi';

const EstoqueDashboard: React.FC = () => {
  // 1. TODOS OS STATES NO TOPO
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 2. TODOS OS EFFECTS
  useEffect(() => {
    getDashboardStats()
      .then(data => {
        setStats(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  // 3. RENDERS CONDICIONAIS (Sempre após os hooks)
  if (loading) {
    return <div className="loading-container p-4">Carregando indicadores do banco...</div>;
  }

  if (error || !stats) {
    return (
      <div className="error-container p-4 text-red-500">
        <h3>Erro ao carregar Dashboard</h3>
        <p>{error || 'Não foi possível conectar à API.'}</p>
        <button onClick={() => window.location.reload()}>Tentar Novamente</button>
      </div>
    );
  }

  // 4. RENDERIZAÇÃO FINAL (Dados já garantidos aqui)
  return (
    <div className="dashboard-container">
      <header>
        {/* <h1>📊 Dashboard de Estoque</h1>         */}
      </header>

      {/* 1. Indicadores-Chave (KPIs) */}
      <div className="indicadores-grid">
  <IndicadorCard 
    titulo="Total de Produtos" 
    valor={stats.totalProdutos} 
    unidade="itens" 
  />

  <IndicadorCard 
    titulo="Valor Total do Estoque" 
    valor={stats.valorTotalEstoque.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} 
    unidade="BRL" 
  />

  <IndicadorCard 
    titulo="Produtos em Alerta" 
    valor={stats.produtosEmAlerta} 
    unidade="crítico" 
    className={stats.produtosEmAlerta > 0 ? 'alerta-kpi' : ''} 
  />

  <IndicadorCard 
    titulo="Giro de Vendas (30d) 📈" 
    valor={stats.giroVendas} 
    unidade="produtos" 
    className={stats.giroVendas > 0 ? 'sucesso-kpi' : ''} 
  />

  <IndicadorCard 
    titulo="Variação de Custo 💸" 
    valor={stats.variacaoCusto} 
    unidade="pendentes" 
    className={stats.variacaoCusto > 0 ? 'alerta-kpi' : ''} 
  />

  <IndicadorCard 
    titulo="Principal Categoria (ABC) 📊" 
    valor={stats.categoriaTopABC} 
    unidade="" 
  />

  <IndicadorCard 
    titulo="Produtos Sem Giro 😴" 
    valor={stats.estoqueParado} 
    unidade="parados" 
    className={stats.estoqueParado > 10 ? 'alerta-kpi' : ''} 
  />
</div>

      <hr />

      <div className="dashboard-content-layout">
        {/* 2. Gráficos e Ações */}
        <section className="main-content">
          <div className="panel">
            <h3>📈 Movimentação (Últimos 30 dias)</h3>
            <div className="placeholder-chart" style={{ height: '200px', background: '#f4f4f4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
               Gráfico de barras/linhas será implementado aqui
            </div>
          </div>
          
          <div className="acoes-rapidas" style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
             <button className="btn-primary">📦 Registrar Entrada</button>
             <button className="btn-secondary">📤 Nova Saída</button>
          </div>
        </section>

        {/* 3. Coluna de Alertas Lateral */}
        <aside className="alerts-sidebar">
          <div className="panel alerts-panel">
            <h3>⚠️ Alertas de Reposição</h3>
            {/* Passamos uma lista vazia por enquanto ou filtramos os produtos em alerta se a API retornar a lista completa */}
            <p style={{ fontSize: '0.8rem', color: '#666' }}>Consulte a página de produtos para detalhes dos {stats.produtosEmAlerta} itens críticos.</p>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default EstoqueDashboard;