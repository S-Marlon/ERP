// src/pages/Dashboard.tsx

import React, { useMemo, useState } from 'react';
import IndicadorCard from '../Components/IndicadorCard';
import AlertaList from '../Components/AlertaList';
import { AlertaEstoque, MovimentacaoFormData, Produto } from '../types/estoque';
import MovimentacaoForm from '../Components/MovimentacaoForm'; // Componente de Ação Rápida

const mockProdutos: Produto[] = [
  { id: 1, nome: 'Teclado Mecânico', sku: 'TM001', quantidadeAtual: 15, estoqueMinimo: 10, precoCusto: 150.00 },
  { id: 2, nome: 'Mouse Óptico', sku: 'MO002', quantidadeAtual: 4, estoqueMinimo: 5, precoCusto: 50.00 }, // ALERTA
  { id: 3, nome: 'Monitor 24"', sku: 'MN003', quantidadeAtual: 2, estoqueMinimo: 3, precoCusto: 700.00 }, // ALERTA
  { id: 4, nome: 'Webcam HD', sku: 'WH004', quantidadeAtual: 25, estoqueMinimo: 5, precoCusto: 80.00 },
];


const EstoqueDashboard: React.FC = () => {
  const [produtos, setProdutos] = useState<Produto[]>(mockProdutos);
  
  // --- FUNÇÃO PARA MANIPULAR O ENVIO DO FORMULÁRIO DE MOVIMENTAÇÃO ---
  const handleMovimentacaoSubmit = (data: MovimentacaoFormData) => {
    // 1. Encontre o produto a ser atualizado
    const produtoIndex = produtos.findIndex(p => p.id === data.produtoId);

    if (produtoIndex !== -1) {
      const produtoAntigo = produtos[produtoIndex];
      let novaQuantidade = produtoAntigo.quantidadeAtual;

      // 2. Calcule a nova quantidade
      const quantidade = data.quantidade as number; 

      if (data.tipoMovimento === 'ENTRADA') {
        novaQuantidade += quantidade;
      } else if (data.tipoMovimento === 'SAIDA' || data.tipoMovimento === 'AJUSTE') {
        // Garante que o estoque não fique negativo, a menos que seja um ajuste de inventário
        if (data.tipoMovimento === 'SAIDA' && novaQuantidade - quantidade < 0) {
          console.error("Erro: Saída não pode deixar o estoque negativo.");
          alert(`Erro: A saída de ${quantidade} itens faria o estoque de ${produtoAntigo.nome} ficar negativo.`);
          return; // Aborta a atualização
        }
        novaQuantidade -= quantidade;
      }
      
      // 3. Crie o novo produto atualizado
      const produtoAtualizado: Produto = {
        ...produtoAntigo,
        quantidadeAtual: novaQuantidade,
      };

      // 4. Atualize o estado da lista de produtos (Imutabilidade do estado)
      const novaLista = [...produtos];
      novaLista[produtoIndex] = produtoAtualizado;
      
      setProdutos(novaLista);

      console.log('Movimentação Registrada:', data); 
      console.log('Novo Estoque do Produto:', produtoAtualizado.nome, novaQuantidade);
    }
  };
  
  // --- LÓGICA DE CÁLCULO DOS INDICADORES (KPIs) ---

  const valorTotalEstoque = useMemo(() => {
    return produtos.reduce((total, p) => total + (p.quantidadeAtual * p.precoCusto), 0);
  }, [produtos]);

  const totalProdutos = produtos.length;

  const alertasEstoqueBaixo: AlertaEstoque[] = useMemo(() => {
    return produtos
      .filter(p => p.quantidadeAtual <= p.estoqueMinimo)
      .map(p => ({
        id: p.id,
        nomeProduto: p.nome,
        quantidadeAtual: p.quantidadeAtual,
        estoqueMinimo: p.estoqueMinimo,
      }));
  }, [produtos]);
  
  // --- RENDERIZAÇÃO ---

  return (
    <div className="dashboard-container">
      

      {/* 1. Indicadores-Chave de Desempenho (KPIs) */}
      <div className="indicadores-grid">
        <IndicadorCard 
          titulo="Total de Produtos" 
          valor={totalProdutos} 
          unidade="itens" 
        />
        <IndicadorCard 
          titulo="Valor Total do Estoque" 
          valor={valorTotalEstoque.toFixed(2).replace('.', ',')} 
          unidade="BRL" 
        />
        <IndicadorCard 
          titulo="Produtos em Alerta" 
          valor={alertasEstoqueBaixo.length} 
          unidade="itens" 
          // Opcional: Adicionar classe de destaque se houver alertas
          className={alertasEstoqueBaixo.length > 0 ? 'alerta-kpi' : ''} 
        />

        <IndicadorCard 
          titulo="Giro de Vendas (Top 3) 📈" 
          valor={alertasEstoqueBaixo.length} 
          unidade="itens" 
          // Opcional: Adicionar classe de destaque se houver alertas
          className={alertasEstoqueBaixo.length > 0 ? 'alerta-kpi' : ''} 
        />
        
        

      </div>

      {/* <hr /> */}

      {/* 2. Ações Rápidas / Gerenciamento de Movimentação */}
      {/* <div className="acoes-rapidas-section">
        <h3>✍️ Ações Rápidas: Registrar Movimentação</h3>
        
      </div> */}
      
      <hr />

      {/* 3. Alertas e Notificações */}
      1. Dashboard (Visão Geral)

Esta deve ser a página de entrada no módulo de estoque.

    Finalidade: Oferecer um panorama imediato da saúde do estoque.

    Conteúdo Essencial:

       
        <br></br>

        Gráfico de Movimentação: Visualização das entradas vs. saídas nos últimos 7/30 dias.
        <br></br>

        Acesso Rápido: Botões para as operações mais comuns (Ex: Registrar Entrada, Novo Produto, Inventário).



        {/* --- Coluna de Alerta de Estoque Baixo --- */}
        <div className="panel alerts-panel">

          <div className="alertas-section">
        <AlertaList alertas={alertasEstoqueBaixo} />
      </div>

          
        </div>

       
      

    </div>
  );
};

export default EstoqueDashboard;