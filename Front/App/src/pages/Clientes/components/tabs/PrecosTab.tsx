import React, { useEffect, useState, useCallback } from 'react';
import Swal from 'sweetalert2';
import { ClientePrecoEspecial } from '../../../../types/cliente.types';
import { clienteService } from '../../../../services/clienteService';
import { formatCurrency, formatDate } from '../../../../utils/validators';
import '../styles/PrecosTab.css';

interface PrecosTabProps {
  cliente: { id_cliente: number } | null;
}

interface PrecoFormData {
  id_produto: number;
  tipo_desconto: 'VALOR_FIXO' | 'PERCENTUAL';
  valor: number;
  data_validade: string;
}

type TipoDescontoType = 'VALOR_FIXO' | 'PERCENTUAL';

export const PrecosTab: React.FC<PrecosTabProps> = ({ cliente }) => {
  const [precos, setPrecos] = useState<ClientePrecoEspecial[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<PrecoFormData>({
    id_produto: 0,
    tipo_desconto: 'VALOR_FIXO',
    valor: 0,
    data_validade: '',
  });
  const [deletando, setDeletando] = useState<number | null>(null);

  // Carregar preços especiais
  useEffect(() => {
    if (!cliente?.id_cliente) {
      setPrecos([]);
      return;
    }

    carregarPrecos();
  }, [cliente?.id_cliente]);

  const carregarPrecos = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await clienteService.obterPrecosEspeciais(cliente!.id_cliente);
      setPrecos(response || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar preços especiais';
      setError(message);
      console.error('Erro ao carregar preços:', err);
    } finally {
      setLoading(false);
    }
  }, [cliente?.id_cliente]);

  const handleNovoPreco = () => {
    setFormData({
      id_produto: 0,
      tipo_desconto: 'VALOR_FIXO',
      valor: 0,
      data_validade: '',
    });
    setEditingId(null);
    setShowForm(true);
  };

  const handleEditar = (preco: ClientePrecoEspecial) => {
    setFormData({
      id_produto: preco.id_produto,
      tipo_desconto: preco.tipo_desconto as TipoDescontoType,
      valor: preco.valor,
      data_validade: new Date(preco.data_validade).toISOString().split('T')[0],
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
      data_validade: '',
    });
  };

  const validarForm = (): string | null => {
    if (formData.id_produto <= 0) return 'Selecione um produto';
    if (formData.valor <= 0) return 'O valor deve ser maior que 0';
    if (!formData.data_validade) return 'Selecione uma data de validade';

    const dataValidade = new Date(formData.data_validade);
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    if (dataValidade < hoje) return 'A data de validade deve ser no futuro';

    return null;
  };

  const handleSalvar = async () => {
    const erro = validarForm();
    if (erro) {
      Swal.fire('Validação', erro, 'warning');
      return;
    }

    try {
      // Aqui você chamaria a API para salvar o preço
      // if (editingId) {
      //   await clienteService.atualizarPrecoEspecial(editingId, formData);
      // } else {
      //   await clienteService.criarPrecoEspecial(cliente!.id_cliente, formData);
      // }

      Swal.fire({
        title: 'Sucesso!',
        text: editingId ? 'Preço atualizado com sucesso' : 'Preço adicionado com sucesso',
        icon: 'success',
        confirmButtonText: 'OK',
      });

      handleFecharForm();
      carregarPrecos();
    } catch (err) {
      Swal.fire('Erro', 'Erro ao salvar preço', 'error');
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
          // Aqui você chamaria a API para deletar o preço
          // await clienteService.deletarPrecoEspecial(id);

          setPrecos(precos.filter(p => p.id !== id));
          Swal.fire('Deletado!', 'Preço removido com sucesso', 'success');
        } catch (err) {
          Swal.fire('Erro', 'Erro ao remover preço', 'error');
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
      {/* Header com Botão */}
      <div className="precos-header">
        <h3>Preços Especiais</h3>
        <button className="btn-novo-preco" onClick={handleNovoPreco}>
          + Novo Preço
        </button>
      </div>

      {/* Mensagem de Erro */}
      {error && (
        <div className="error-banner">
          <span>⚠️ {error}</span>
          <button onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {/* Tabela de Preços */}
      {loading ? (
        <div className="loading-state">
          <p>Carregando preços especiais...</p>
        </div>
      ) : precos.length === 0 ? (
        <div className="empty-state">
          <p>Nenhum preço especial registrado</p>
        </div>
      ) : (
        <div className="precos-table-wrapper">
          <table className="precos-table">
            <thead>
              <tr>
                <th>Produto ID</th>
                <th>Tipo de Desconto</th>
                <th>Valor</th>
                <th>Válido Até</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {precos.map((preco) => {
                const agora = new Date();
                const validade = new Date(preco.data_validade);
                const ativo = validade >= agora;

                return (
                  <tr key={preco.id} className={`preco-row ${ativo ? 'ativo' : 'expirado'}`}>
                    <td className="id-produto">{preco.id_produto}</td>
                    <td className="tipo-desconto">
                      <span className="badge-tipo">
                        {preco.tipo_desconto === 'PERCENTUAL' ? 'Percentual' : 'Valor Fixo'}
                      </span>
                    </td>
                    <td className="valor">
                      {formatoDesconto(preco.tipo_desconto, preco.valor)}
                    </td>
                    <td className="data-validade">
                      {formatDate(preco.data_validade)}
                    </td>
                    <td className="status">
                      <span className={`status-badge ${ativo ? 'ativo' : 'expirado'}`}>
                        {ativo ? '✓ Ativo' : '✕ Expirado'}
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
                        {deletando === preco.id ? 'Deletando...' : 'Deletar'}
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
              <h3>{editingId ? 'Editar Preço' : 'Novo Preço Especial'}</h3>
              <button className="btn-close" onClick={handleFecharForm}>✕</button>
            </div>

            <div className="modal-body">
              <div className="form-group">
                <label htmlFor="id-produto">Produto ID:</label>
                <input
                  id="id-produto"
                  type="number"
                  min="1"
                  value={formData.id_produto}
                  onChange={(e) => setFormData({ ...formData, id_produto: parseInt(e.target.value) || 0 })}
                  placeholder="Ex: 1"
                />
              </div>

              <div className="form-group">
                <label htmlFor="tipo-desconto">Tipo de Desconto:</label>
                <select
                  id="tipo-desconto"
                  value={formData.tipo_desconto}
                  onChange={(e) => setFormData({ ...formData, tipo_desconto: e.target.value as TipoDescontoType })}
                >
                  <option value="VALOR_FIXO">Valor Fixo</option>
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
                  step={formData.tipo_desconto === 'PERCENTUAL' ? '0.01' : '0.01'}
                  max={formData.tipo_desconto === 'PERCENTUAL' ? '100' : undefined}
                  value={formData.valor}
                  onChange={(e) => setFormData({ ...formData, valor: parseFloat(e.target.value) || 0 })}
                  placeholder="0"
                />
              </div>

              <div className="form-group">
                <label htmlFor="data-validade">Data de Validade:</label>
                <input
                  id="data-validade"
                  type="date"
                  value={formData.data_validade}
                  onChange={(e) => setFormData({ ...formData, data_validade: e.target.value })}
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-cancel" onClick={handleFecharForm}>
                Cancelar
              </button>
              <button className="btn-confirm" onClick={handleSalvar}>
                {editingId ? 'Atualizar' : 'Adicionar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PrecosTab;
