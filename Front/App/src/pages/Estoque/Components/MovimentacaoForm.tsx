// src/components/MovimentacaoForm.tsx

import React, { useState, FormEvent, ChangeEvent, useMemo } from 'react';
import { Produto, MovimentacaoFormData, TipoMovimento } from '../types/estoque';
import './MovimentacaoForm.css'; // Estilização (a ser criada)

interface MovimentacaoFormProps {
  // Simula a lista de produtos disponíveis para seleção
  listaProdutos: Produto[]; 
  // Função que será chamada ao submeter o formulário
  onSubmitMovimentacao: (data: MovimentacaoFormData) => void;
}

const MovimentacaoForm: React.FC<MovimentacaoFormProps> = ({ listaProdutos, onSubmitMovimentacao }) => {
  const [formData, setFormData] = useState<MovimentacaoFormData>({
    produtoId: null,
    tipoMovimento: '',
    quantidade: '',
    motivo: '',
  });

  const [erro, setErro] = useState<string | null>(null);

  // Encontra o produto selecionado para mostrar a quantidade atual
  const produtoSelecionado = useMemo(() => {
    return listaProdutos.find(p => p.id === formData.produtoId);
  }, [formData.produtoId, listaProdutos]);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      // Converte a quantidade para número ou mantém vazio
      [name]: name === 'quantidade' ? (value === '' ? '' : Number(value)) : value,
    }));
    setErro(null);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    const { produtoId, tipoMovimento, quantidade, motivo } = formData;

    // --- VALIDAÇÕES ---
    if (!produtoId || !tipoMovimento || quantidade === '' || quantidade <= 0 || !motivo) {
      setErro("Preencha todos os campos obrigatórios (Produto, Tipo, Quantidade > 0 e Motivo).");
      return;
    }

    if (tipoMovimento === 'SAIDA' && produtoSelecionado && (quantidade as number) > produtoSelecionado.quantidadeAtual) {
      setErro(`A saída de ${quantidade} unidades excede o estoque atual de ${produtoSelecionado.quantidadeAtual}.`);
      return;
    }

    // Se a validação passar, chama a função de envio
    onSubmitMovimentacao(formData);
    
    // Resetar o formulário
    setFormData({
      produtoId: null,
      tipoMovimento: '',
      quantidade: '',
      motivo: '',
    });
    setErro(null);
  };

  return (
    <div className="movimentacao-container">
      <h2>🔄 Registrar Movimentação de Estoque</h2>
      <form onSubmit={handleSubmit} className="movimentacao-form">

        {/* 1. SELEÇÃO DO PRODUTO */}
        <div className="form-grupo">
          <label htmlFor="produtoId">Produto:</label>
          <select
            id="produtoId"
            name="produtoId"
            value={formData.produtoId || ''}
            onChange={handleInputChange}
            required
          >
            <option value="" disabled>Selecione um Produto</option>
            {listaProdutos.map(p => (
              <option key={p.id} value={p.id}>{p.nome} ({p.sku})</option>
            ))}
          </select>
          {produtoSelecionado && (
            <p className="estoque-atual">Estoque Atual: **{produtoSelecionado.quantidadeAtual}**</p>
          )}
        </div>

        {/* 2. TIPO DE MOVIMENTO */}
        <div className="form-grupo">
          <label htmlFor="tipoMovimento">Tipo de Movimento:</label>
          <select
            id="tipoMovimento"
            name="tipoMovimento"
            value={formData.tipoMovimento}
            onChange={handleInputChange}
            required
          >
            <option value="" disabled>Selecione</option>
            <option value="ENTRADA">➕ ENTRADA (Compra, Devolução)</option>
            <option value="SAIDA">➖ SAÍDA (Venda, Perda)</option>
            <option value="AJUSTE">✏️ AJUSTE (Inventário)</option>
          </select>
        </div>

        {/* 3. QUANTIDADE */}
        <div className="form-grupo">
          <label htmlFor="quantidade">Quantidade:</label>
          <input
            type="number"
            id="quantidade"
            name="quantidade"
            value={formData.quantidade}
            onChange={handleInputChange}
            min="1"
            required
          />
        </div>

        {/* 4. MOTIVO/REFERÊNCIA */}
        <div className="form-grupo">
          <label htmlFor="motivo">Motivo/Referência:</label>
          <textarea
            id="motivo"
            name="motivo"
            value={formData.motivo}
            onChange={handleInputChange}
            placeholder="Ex: NF 1234, Venda #500, Inventário 20/10"
            rows={3}
            required
          />
        </div>

        {/* ERRO E BOTÃO DE SUBMISSÃO */}
        {erro && <p className="form-erro">❌ {erro}</p>}
        
        <button type="submit" className="botao-submit">
          Confirmar Movimentação
        </button>
      </form>
    </div>
  );
};

export default MovimentacaoForm;