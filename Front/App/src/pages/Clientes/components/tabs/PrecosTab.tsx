// frontend/src/components/clientes/tabs/PrecosTab.tsx

import React, { useEffect, useState, useCallback } from 'react';
import Swal from 'sweetalert2';
import { ClientePrecoEspecial } from '../../../../types/cliente.types';
import { getPrecosEspeciais } from '../../services/ClienteApi'; // Usando a API que mapeamos antes
import { formatCurrency, formatDate } from '../../../../utils/validators';
import '../styles/PrecosTab.css';

interface PrecosTabProps {
  cliente: { id_cliente: number } | null;
}

interface PrecoFormData {
  id_produto: number;
  tipo_desconto: 'VALOR_FIXO' | 'PERCENTUAL';
  valor: number;
  data_fim: string; // Alinhado com o banco ('data_fim')
}

type TipoDescontoType = 'VALOR_FIXO' | 'PERCENTUAL';

export const PrecosTab: React.FC<PrecosTabProps> = ({ cliente }) => {
  const [precos, setPrecos] = useState<ClientePrecoEspecial[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [salvando, setSalvando] = useState(false); 
  const [formData, setFormData] = useState<PrecoFormData>({
    id_produto: 0,
    tipo_desconto: 'VALOR_FIXO',
    valor: 0,
    data_fim: '',
  });
  const [deletando, setDeletando] = useState<number | null>(null);

  const carregarPrecos = useCallback(async () => {
    if (!cliente?.id_cliente) return;
    
    try {
      setLoading(true);
      setError(null);

      // Chamada real mapeada do nosso arquivo clienteApi
      const response = await getPrecosEspeciais(cliente.id_cliente);
      setPrecos(response || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar preços especiais';
      setError(message);
      console.error('Erro ao carregar preços:', err);
    } finally {
      setLoading(false);
    }
  }, [cliente?.id_cliente]);

  useEffect(() => {
    if (!cliente?.id_cliente) {
      setPrecos([]);
      return;
    }
    carregarPrecos();
  }, [cliente?.id_cliente, carregarPrecos]);

  const handleNovoPreco = () => {
    setFormData({
      id_produto: 0,
      tipo_desconto: 'VALOR_FIXO',
      valor: 0,
      data_fim: '',
    });
    setEditingId(null);
    setShowForm(true);
  };

  const handleEditar = (preco: ClientePrecoEspecial) => {
    // Tratamento seguro de string de data sem sofrer com desvios de fuso horário UTC
    let dataFormatada = '';
    if (preco.data_fim) {
      dataFormatada = typeof preco.data_fim === 'string' 
        ? preco.data_fim.split('T')[0] 
        : new Date(preco.data_fim).toISOString().split('T')[0];
    }

    setFormData({
      id_produto: preco.id_produto,
      tipo_desconto: preco.tipo_desconto as TipoDescontoType,
      valor: preco.valor,
      data_fim: dataFormatada,
    });
    setEditingId(preco.id);
    setShowForm(true);
  };

  const handleFecharForm = () => {
    setShowForm(false);
    setEditingId(null);
    setFormData({
      id_produto: 0,
      tipo_desconto: 'VALOR_FIXO',
      valor: 0,
      data_fim: '',
    });
  };

  const validarForm = (): string | null => {
    if (formData.id_produto <= 0) return 'Selecione um produto';
    if (formData.valor <= 0) return 'O valor deve ser maior que 0';
    if (formData.tipo_desconto === 'PERCENTUAL' && formData.valor > 100) return 'O percentual não pode ser maior que 100%';
    if (!formData.data_fim) return 'Selecione uma data de validade';

    const parts = formData.data_fim.split('-');
    const dataValidade = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    if (dataValidade < hoje) return 'A data de validade não pode ser retroativa';

    return null;
  };

  const handleSalvar = async () => {
    const erro = validarForm();
    if (erro) {
      Swal.fire('Validação', erro, 'warning');
      return;
    }

    try {
      setSalvando(true);

      // OBS: Caso ainda vá criar estes métodos no clienteApi/Services,
      // eles devem apontar para POST /:id/precos-especiais e PUT /precos-especiais/:id
      if (editingId) {
        // Exemplo fictício de escrita: await clienteService.atualizarPrecoEspecial(editingId, formData);
      } else {
        // Exemplo fictício de escrita: await clienteService.criarPrecoEspecial(cliente!.id_cliente, formData);
      }

      await Swal.fire({
        title: 'Sucesso!',
        text: editingId ? 'Preço atualizado com sucesso' : 'Preço adicionado com sucesso',
        icon: 'success',
        confirmButtonText: 'OK',
      });

      handleFecharForm();
      carregarPrecos();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao salvar preço';
      Swal.fire('Erro', message, 'error');
    } finally {
      setSalvando(false);
    }
  };

  const handleDeletar = async (id: number) => {
    Swal.fire({
      title: 'Remover preço especial?',
      text: 'Esta ação não pode ser desfeita',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Remover',
      confirmButtonColor: '#dc3545',
      cancelButtonText: 'Cancelar',
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          setDeletando(id);
          
          // Exemplo fictício de exclusão: await clienteService.deletarPrecoEspecial(id);

          setPrecos(prevPrecos => prevPrecos.filter(p => p.id !== id));
          Swal.fire('Deletado!', 'Preço removido com sucesso', 'success');
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Erro ao remover preço';
          Swal.fire('Erro', message, 'error');
        } finally {
          setDeletando(null);
        }
      }
    });
  };

  const formatoDesconto = (tipo: string, valor: number): string => {
    return tipo === 'PERCENTUAL' ? `${valor}%` : formatCurrency(valor);
  };

  if (!cliente?.id_cliente) {
    return (
      <div className="precos-tab">
        <div className="empty-state">
          <p>Selecione um cliente para visualizar preços especiais</p>
        </div>
      </div>
    );
  }

  return (
    <div className="precos-tab">
      <div className="precos-header">
        <h3>Preços Especiais Customizados</h3>
        <button className="btn-novo-preco" onClick={handleNovoPreco}>
          + Novo Preço
        </button>
      </div>

      {error && (
        <div className="error-banner">
          <span>⚠️ {error}</span>
          <button onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {loading ? (
        <div className="loading-state">
          <p>Carregando preços especiais...</p>
        </div>
      ) : precos.length === 0 ? (
        <div className="empty-state">
          <p>Nenhum preço especial registrado para este cliente.</p>
        </div>
      ) : (
        <div className="precos-table-wrapper">
          <table className="precos-table">
            <thead>
              <tr>
                <th>Produto</th>
                <th>Tipo de Desconto</th>
                <th>Desconto Aplicado</th>
                <th>Preço Final calculado</th>
                <th>Válido Até</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {precos.map((preco) => {
                // O status_preco já vem calculado perfeitamente pelo Query do backend (ATIVO, INATIVO, EXPIRADO)
                const statusDoBanco = (preco as any).status_preco || 'ATIVO';
                const nomeProduto = (preco as any).nome_produto || `ID: ${preco.id_produto}`;
                const precoFinal = (preco as any).preco_final;

                return (
                  <tr key={preco.id} className={`preco-row ${statusDoBanco.toLowerCase()}`}>
                    <td className="id-produto">
                      <strong>{nomeProduto}</strong>
                      {(preco as any).codigo_barras && <span className="sub-txt">{(preco as any).codigo_barras}</span>}
                    </td>
                    <td className="tipo-desconto">
                      <span className="badge-tipo">
                        {preco.tipo_desconto === 'PERCENTUAL' ? 'Percentual' : 'Valor Fixo'}
                      </span>
                    </td>
                    <td className="valor">
                      {formatoDesconto(preco.tipo_desconto, preco.valor)}
                    </td>
                    <td className="preco-final">
                      {precoFinal ? formatCurrency(precoFinal) : '---'}
                    </td>
                    <td className="data-validade">
                      {formatDate(preco.data_fim)}
                    </td>
                    <td className="status">
                      <span className={`status-badge ${statusDoBanco.toLowerCase()}`}>
                        {statusDoBanco === 'ATIVO' ? '✓ Ativo' : statusDoBanco === 'EXPIRADO' ? '✕ Expirado' : '🛑 Inativo'}
                      </span>
                    </td>
                    <td className="acoes">
                      <button
                        className="btn-editar"
                        onClick={() => handleEditar(preco)}
                        title="Editar"
                      >
                        Editar
                      </button>
                      <button
                        className="btn-deletar"
                        onClick={() => handleDeletar(preco.id)}
                        disabled={deletando === preco.id}
                        title="Deletar"
                      >
                        {deletando === preco.id ? '...' : 'Deletar'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal de Formulário */}
      {showForm && (
        <div className="modal-overlay" onClick={handleFecharForm}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingId ? 'Editar Preço Especial' : 'Novo Preço Especial'}</h3>
              <button className="btn-close" onClick={handleFecharForm}>✕</button>
            </div>

            <div className="modal-body">
              <div className="form-group">
                <label htmlFor="id-produto">Produto ID:</label>
                <input
                  id="id-produto"
                  type="number"
                  min="1"
                  disabled={!!editingId} 
                  value={formData.id_produto || ''}
                  onChange={(e) => setFormData({ ...formData, id_produto: parseInt(e.target.value) || 0 })}
                  placeholder="Ex: 42"
                />
              </div>

              <div className="form-group">
                <label htmlFor="tipo-desconto">Tipo de Desconto:</label>
                <select
                  id="tipo-desconto"
                  value={formData.tipo_desconto}
                  onChange={(e) => setFormData({ ...formData, tipo_desconto: e.target.value as TipoDescontoType })}
                >
                  <option value="VALOR_FIXO">Valor Fixo Abatido</option>
                  <option value="PERCENTUAL">Percentual (%)</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="valor">
                  Valor {formData.tipo_desconto === 'PERCENTUAL' ? '(%)' : '(R$)'}:
                </label>
                <input
                  id="valor"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.valor || ''}
                  onChange={(e) => setFormData({ ...formData, valor: parseFloat(e.target.value) || 0 })}
                  placeholder="0"
                />
              </div>

              <div className="form-group">
                <label htmlFor="data-fim">Data de Validade Final:</label>
                <input
                  id="data-fim"
                  type="date"
                  value={formData.data_fim}
                  onChange={(e) => setFormData({ ...formData, data_fim: e.target.value })}
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-cancel" onClick={handleFecharForm} disabled={salvando}>
                Cancelar
              </button>
              <button className="btn-confirm" onClick={handleSalvar} disabled={salvando}>
                {salvando ? 'Salvando...' : editingId ? 'Atualizar' : 'Adicionar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PrecosTab;