import React from 'react';
import { ServiceItem as ServiceItemType } from '../types'; // Renomeie para evitar conflito de nomes

interface ServiceItemProps {
  service: ServiceItemType;
}

const ServiceItem: React.FC<ServiceItemProps> = ({ service }) => {
  return (
    <div className="service-card" style={{background:"red", border:"5px solid blue"}}>
      <div className="card-header">
        <span className="order-number">{service.orderNumber}</span>
        <div className="client-info">
          <span>{service.clientName}</span>
          <br />
          <span className="client-details">{service.clientDetails}</span>
        </div>
        <span className={`status-badge status-${service.status.toLowerCase()}`}>
          {service.status}
        </span>
      </div>

      {/* ... (o restante da estrutura do card) */}
      <table className="items-table">
          <thead>
            <tr>
              <th>Qtd</th>
              <th>Itens</th>
              <th>Preços</th>
            </tr>
          </thead>
          <tbody>
            {service.items.map((item, index) => (
              <tr key={index}>
                <td>{item.quantity}</td>
                <td>{item.name}</td>
                <td>R$ {item.price.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

      <div className="card-footer">
        <div className="tags">
          {service.tags.map((tag, index) => (
            <span key={index} className="tag-button">{tag}</span>
          ))}
        </div>
        <span className="responsible">Responsável: {service.responsible}</span>
      </div>
    </div>
  );
};

export default ServiceItem;