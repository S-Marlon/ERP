import React, { useState } from "react";
import {ServiceProduct } from "../../../types/types";

interface AddServiceProps {
   services: ServiceProduct[];
  back: () => void;
  showPayment: boolean;
  handleServiceAddToCart: (service: ServiceProduct) => void;

}


const AddService: React.FC<AddServiceProps> = ({ services,handleServiceAddToCart,back,
  showPayment, }) => {
  // Estado para o serviço personalizado
  const [customServiceName, setCustomServiceName] = useState('');
  const [customServicePrice, setCustomServicePrice] = useState<number | ''>('');



  // Função para adicionar o serviço personalizado
//   const handleAddCustomService = () => {
//     if (customServiceName && customServicePrice !== '') {
//       const newProduct: Product = {
//         id: `custom-service-${Date.now()}`,
//         name: customServiceName,
//         price: customServicePrice as number,
//         quantity: 1,
//       };
//       handleAddServiceToCart(newProduct);
//       // Limpa os campos após adicionar
//       setCustomServiceName('');
//       setCustomServicePrice('');
//     } else {
//       alert("Por favor, preencha a descrição e o valor do serviço.");
//     }
//   };
  return (
    <div className="add-service-container">
        {showPayment && ( // 👈 Renderiza ProductList apenas se showPayment for falso
        <button onClick={() => back()}> voltar</button>
      )}
      {/* Seção de serviços fixos (grid) */}
      <h2>Adicionar Serviços Fixos</h2>
      <div className="flex-row services-buttons">
        {services.map((service, index) => (
        
          <button
            key={index}
            className="service-button"
            onClick={() => handleServiceAddToCart(service)}
          >
            {service.name} <br/> R$ {service.price.toFixed(2)}
          </button>
        ))}
      </div>

      {/* --- */}

      {/* Seção de mão de obra personalizada */}
      <h2>Mão de Obra Personalizada</h2>
      <div className="custom-service-section">
        <label htmlFor="custom-service-desc">Descrição do Serviço:</label>
        <textarea className="custom-service-desc"
          id="custom-service-desc"
          value={customServiceName}
          onChange={(e) => setCustomServiceName(e.target.value)}
          rows={3}
          placeholder="Ex: Instalação de software complexo"
        />

        <label htmlFor="custom-service-price">Valor (R$):</label>
        <input
          id="custom-service-price"
          type="number"
          step="0.01"
          value={customServicePrice}
          onChange={(e) => setCustomServicePrice(parseFloat(e.target.value))}
          placeholder="Ex: 150.00"
        />

        {/* <button className="custom-service-button" onClick={handleAddCustomService}>
          Adicionar Serviço Personalizado
        </button> */}
      </div>
    </div>
  );
};

export default AddService;