// src/components/IndicadorCard.tsx

import React from 'react';
import '../Dashboard.css'; // O mesmo arquivo CSS para todos

interface IndicadorCardProps {
  titulo: string;
  valor: string | number;
  unidade?: string;
}

const IndicadorCard: React.FC<IndicadorCardProps> = ({ titulo, valor, unidade }) => {
  return (
    <div className="card indicador-card">
      <h3 className="card-titulo">{titulo}</h3>
      <div className="card-valor">
        {valor} {unidade && <span className="unidade">{unidade}</span>}
      </div>
    </div>
  );
};

export default IndicadorCard;