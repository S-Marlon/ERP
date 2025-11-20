// src/pages/Dashboard.tsx

import React, { useMemo, useState, useEffect } from 'react';
import './Dashboard.css'; // Estilos
import IndicadorCard from './Components/IndicadorCard';
import AlertaList from './Components/AlertaList';
import { AlertaEstoque, MovimentacaoFormData, Produto } from './types/estoque';
import MovimentacaoForm from './Components/MovimentacaoForm';

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
        const quantidade = data.quantidade as number; // Já validamos que não é string/null
  
        if (data.tipoMovimento === 'ENTRADA') {
          novaQuantidade += quantidade;
        } else if (data.tipoMovimento === 'SAIDA' || data.tipoMovimento === 'AJUSTE') {
          novaQuantidade -= quantidade;
        }
        
        // 3. Crie o novo produto atualizado
        const produtoAtualizado: Produto = {
          ...produtoAntigo,
          quantidadeAtual: novaQuantidade,
        };
  
        // 4. Atualize o estado da lista de produtos (importante para o React renderizar)
        const novaLista = [...produtos];
        novaLista[produtoIndex] = produtoAtualizado;
        
        setProdutos(novaLista);
  
        // (Aqui você faria a chamada à API para salvar a transação e o produto atualizado)
        console.log('Movimentação Registrada:', data); 
        console.log('Novo Estoque do Produto:', produtoAtualizado.nome, novaQuantidade);
      }
  
    };
  // --- LÓGICA DE CÁLCULO DOS INDICADORES ---

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
      <h1 className="dashboard-header">📈 Visão Geral do Estoque</h1>
      <div className="indicadores-grid">
        <IndicadorCard 
          titulo="Total de Produtos" 
          valor={totalProdutos} 
          unidade="itens" 
        />
        <IndicadorCard 
          titulo="Valor Total do Estoque" 
          valor={valorTotalEstoque.toFixed(2).replace('.', ',')} // Formatação
          unidade="BRL" 
        />
        <IndicadorCard 
          titulo="Produtos em Alerta" 
          valor={alertasEstoqueBaixo.length} 
          unidade="itens" 
        />
      </div>

      <div className="alertas-section">
        <AlertaList alertas={alertasEstoqueBaixo} />
      </div>

      <MovimentacaoForm 
          listaProdutos={produtos} 
          onSubmitMovimentacao={handleMovimentacaoSubmit} 
        />

    </div>
  );
};

export default EstoqueDashboard;