// src/components/AlertaList.tsx

import React from 'react';
import '../Dashboard.css';
import { AlertaEstoque } from '../types/estoque';

interface AlertaListProps {
  alertas: AlertaEstoque[];
}

const AlertaList: React.FC<AlertaListProps> = ({ alertas }) => {
  return (
    <div className="card alerta-list-container">
      <h2 className="alerta-titulo">⚠️ Produtos com Estoque Baixo</h2>
      {alertas.length === 0 ? (
        <p className="alerta-vazio">🎉 Nenhum produto abaixo do estoque mínimo. Ótimo trabalho!</p>
      ) : (
        <ul className="alerta-lista">
          {alertas.map((alerta) => (
            <li key={alerta.id} className="alerta-item">
              <span className="alerta-nome">**{alerta.nomeProduto}**</span>
              <span className="alerta-detalhe">
                **Atual:** {alerta.quantidadeAtual} | **Mínimo:** {alerta.estoqueMinimo}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default AlertaList;