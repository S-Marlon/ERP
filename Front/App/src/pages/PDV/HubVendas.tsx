import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './HubVendas.css';
import Badge from '../../components/ui/Badge/Badge';

// Mock de dados para visualização
const MOCK_VENDAS: Venda[] = [
  { id: 1, cliente: "João Silva", vendedor: "Carlos", itens: ["Camiseta Polo", "Calça Jeans", "Cinto"], valorTotal: 250.00, ultimaAlteracao: "2 min", status: 'disponivel' },
  { id: 2, cliente: "Maria Oliveira", vendedor: "Ana", itens: ["Tênis Esportivo", "Meias"], valorTotal: 480.90, ultimaAlteracao: "5 min", status: 'editando', editadoPor: "Marcos" },
  { id: 3, cliente: "Consumidor Final", vendedor: "Carlos", itens: ["Boné"], valorTotal: 55.00, ultimaAlteracao: "15 min", status: 'pagamento' },
];



export const HubVendas: React.FC = () => {

const navigate = useNavigate();

  // Funções de navegação
  const abrirNovaVenda = () => navigate('/vendas/pdv');
  const continuarVenda = (id: number) => navigate(`/vendas/pdv/${id}`);

  // Atalho Global F2
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        abrirNovaVenda();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);


  return (
    <div className="hub-container">
      {/* HEADER */}
      <header className="hub-header">
        <div className="header-left">
          <button className="btn-nova-venda" onClick={abrirNovaVenda}>
            <span className="icon">+</span> Nova Venda <kbd>F2</kbd>
          </button>
          <input type="text" placeholder="Buscar cliente ou ID..." className="search-bar" />
        </div>
        <div className="header-stats">
          <div className="stat-item">Total em Aberto: <strong>R$ 1.500,00</strong></div>
          <div className="stat-item">Vendas Hoje: <strong>42</strong></div>
        </div>
      </header>

      <div className="hub-content">
        {/* SIDEBAR */}
        <aside className="hub-sidebar">
          <h3>Filtros</h3>
          <button className="filter-btn active">Todos</button>
          <button className="filter-btn">Meus Atendimentos</button>
          <button className="filter-btn">Sem Vendedor</button>
          <button className="filter-btn warning">+30 min Inativo</button>
        </aside>

        {/* GRID DE CARDS */}
        <main className="hub-grid">
          {MOCK_VENDAS.map(venda => (
            <div key={venda.id} className={`card-venda status-${venda.status}`}>
              <div className="card-header">
                <div>
                  <h4>{venda.cliente}</h4>
                  <span>{venda.vendedor}</span>
                </div>
                <div>

                {venda.status === 'editando' && <span className="lock-icon">🔒</span>}
                <Badge  >#202</Badge>
                </div>
              </div>

              <div className="card-body">
                <ul className="item-list">
                  {venda.itens.map((item, i) => <li key={i}>{item}</li>)}
                </ul>
                <div className="card-footer">
                  <div className="price">R$ {venda.valorTotal.toFixed(2)}</div>
                  <div className="time">Inativo: {venda.ultimaAlteracao}</div>
                </div>
              </div>

              {venda.status === 'editando' ? (
                <div className="lock-overlay">Sendo editado por {venda.editadoPor}</div>
              ) : (
                <div className="card-actions">
                  <button className="btn-continue">Continuar</button>
                  <button className="btn-caixa">Enviar ao Caixa</button>
                </div>
              )}
            </div>
          ))}
        </main>
      </div>
    </div>
  );
};