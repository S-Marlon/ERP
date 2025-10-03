import React from "react";
// 1. IMPORTAÇÃO ATUALIZADA: Trazendo o novo tipo ItemOrdem
import { ItemOrdem } from "../../../types/newtypes"; 

// 2. TIPAGEM DAS PROPS ATUALIZADA: Usando ItemOrdem[]
interface Props {
  cart: ItemOrdem[];
  totalItems: number;
  subtotal: number;
  handleUpdateQuantity: (id: string, newQuantity: number) => void;
  handleRemoveFromCart: (id: string) => void;
  handleProceedToPayment: () => void;
  showPayment: boolean; // Embora não esteja sendo usado na renderização, mantive-o nas props
}

const Cart: React.FC<Props> = ({
  cart,
  totalItems,
  subtotal,
  handleUpdateQuantity,
  handleRemoveFromCart,
  handleProceedToPayment,
  // showPayment não foi desestruturado pois não é usado aqui, mas está em Props
}) => {
  return (
    <div className="pdv-side-panel pdv-cart">
      
      <h2>Carrinho ({totalItems} itens)</h2>
      <div className="pdv-cart-items">
        {cart.length === 0 ? (
          <p className="pdv-empty">Nenhum item no carrinho.</p>
        ) : (
          cart.map((item) => (
            // 3. MAPEAMENTO DE CAMPOS - ATUALIZADO
            <div key={item.id} className="pdv-cart-item">
              
              <div className="product-details">
                {/* SKU (se for produto) e Tipo do Item */}
                <span>
                    {item.sku ? `${item.sku} - ` : ''} 
                    {item.tipoItem} 
                </span>

                <div>
                  <button
                  onClick={() => handleRemoveFromCart(item.id)}
                  className="remove-button"
                >
                   
    &#x1F6C8;
                </button>

                <button
                  onClick={() => handleRemoveFromCart(item.id)}
                  className="remove-button"
                  >
                  &times;
                </button>
                  </div>
                
              </div>

              <div className="product-name truncado">
                {/* Nome do item (produto ou serviço) */}
                <span title={item.nome}>{item.nome}</span>
              </div>

              <div className="linha-vertical"></div>

              <div className="quantity-controls">
                <div className="unit-price">
                  {/* Preço Praticado (Unitário no momento da compra) */}
                  <span>
                    R$ {item.precoPraticado.toFixed(2).replace(".", ",")}
                  </span>
                </div>

                <div className="container">
                  {/* Botão de Decrementar */}
                  <button className="input-number-decrement"
                    onClick={() =>
                      handleUpdateQuantity(item.id, item.quantidade - 1)
                    }
                  >
                    -
                  </button>

                  {/* Input de Quantidade */}
                  <input className="input-number"
                    type="number"
                    value={item.quantidade}
                    onChange={(e) =>
                      handleUpdateQuantity(
                        item.id,
                        // Usa 'quantidade' em vez de 'quantity'
                        parseFloat(e.target.value) || 0 
                      )
                    }
                  />
                  
                  {/* Botão de Incrementar */}
                  <button className="input-number-increment"
                    onClick={() =>
                      handleUpdateQuantity(item.id, item.quantidade + 1)
                    }
                  >
                    +
                  </button>
                </div>

                <div className="total-price">
                  {/* Subtotal (Preço total da linha) */}
                  <span>R$ {item.subtotal.toFixed(2).replace(".", ",")}</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
      
      {/* Footer do Carrinho (Subtotal) */}
      <div className="pdv-subtotal">
        <span>Subtotal:</span>
        <span>R$ {subtotal.toFixed(2).replace(".", ",")}</span>
      </div>

      {/* Botão de Ação */}
      <button onClick={handleProceedToPayment}>
          Finalizar compra
      </button>
    </div>
  );
};

export default Cart;