import React, { useState } from "react";
// ATENÇÃO: Estou assumindo que o tipo Servico é o novo tipo (com valorBase).
// Se o seu arquivo types/types ainda tiver ServiceProduct, você pode renomeá-lo localmente
// ou atualizar o arquivo original. Usarei Servico como o novo padrão:
import { Servico } from "../../../types/newtypes"; // << Usando o novo tipo Servico

// O componente agora recebe Servico[] nas props
interface AddServiceProps {
    services: Servico[];
    back: () => void;
    showPayment: boolean;
    // A função de callback deve receber o novo tipo Servico
    handleServiceAddToCart: (service: Servico) => void; 
}


const AddService: React.FC<AddServiceProps> = ({ services, handleServiceAddToCart, back,
  showPayment, }) => {
  
  // O estado para o preço agora é Servico['valorBase'] ou number | ''
  const [customServiceName, setCustomServiceName] = useState('');
  const [customServicePrice, setCustomServicePrice] = useState<number | ''>('');


  // Função para adicionar o serviço personalizado (Reativada e Ajustada)
  const handleAddCustomService = () => {
    // 1. Validação simples
    if (customServiceName.trim() === '' || customServicePrice === '' || (customServicePrice as number) <= 0) {
      alert("Por favor, preencha a descrição e um valor válido para o serviço.");
      return;
    }

    // 2. Cria o objeto Servico temporário (Personalizado)
    const newCustomService: Servico = {
      // Cria um ID temporário único para o carrinho. O prefixo é útil para debugging.
      id: `custom-svc-${Date.now()}`, 
      nome: customServiceName,
      descricao: `Serviço personalizado: ${customServiceName}`, // Descrição padrão
      valorBase: customServicePrice as number,
    };
    
    // 3. Adiciona ao carrinho via função callback
    handleServiceAddToCart(newCustomService); 
    
    // 4. Limpa os campos após adicionar
    setCustomServiceName('');
    setCustomServicePrice('');
  };
  
  // Helper para garantir que o input de preço só receba números válidos
  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '') {
      setCustomServicePrice('');
    } else {
      const parsedValue = parseFloat(value);
      if (!isNaN(parsedValue)) {
        setCustomServicePrice(parsedValue);
      }
    }
  };


  return (
    <div className="add-service-container">
        
      {/* Botão Voltar */}
      {showPayment && ( 
        <button onClick={back}> ← Voltar</button>
      )}
      
      {/* Seção de serviços fixos (grid) */}
      <h2>Serviços Fixos do Catálogo</h2>
      <div className="flex-row services-buttons">
        {/* Renderização de serviços fixos */}
        {services.map((service, index) => (
          <button
            key={service.id || index} // Use service.id se existir, senão index
            className="service-button"
            onClick={() => handleServiceAddToCart(service)}
          >
            {service.nome} <br/> R$ {service.valorBase.toFixed(2)} {/* Usando 'nome' e 'valorBase' */}
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
          placeholder="Ex: Instalação de software complexo ou Horas extras"
        />

        <label htmlFor="custom-service-price">Valor (R$):</label>
        <input
          id="custom-service-price"
          type="number"
          step="0.01"
          value={customServicePrice}
          onChange={handlePriceChange} // Usando o helper para garantir o parsing
          placeholder="Ex: 150.00"
        />

        {/* Botão de Ação Reativado */}
        <button className="custom-service-button" onClick={handleAddCustomService}>
          Adicionar Serviço Personalizado
        </button>
      </div>
    </div>
  );
};

export default AddService;