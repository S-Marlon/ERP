import React from "react";
import { CartItem } from "../../../types/types";

interface Props {
  cart: CartItem[];
  totalItems: number;
  subtotal: number;
  handleUpdateQuantity: (id: string, newQuantity: number) => void;
  handleRemoveFromCart: (id: string) => void;
  handleProceedToPayment: () => void;
  back: () => void;
  showPayment: boolean;
}

const Cart: React.FC<Props> = ({
  cart,
  totalItems,
  subtotal,
  handleUpdateQuantity,
  handleRemoveFromCart,
  handleProceedToPayment,
  back,
  showPayment,
}) => {
  return (
    <div className="pdv-side-panel pdv-cart">
      {showPayment && ( // 👈 Renderiza ProductList apenas se showPayment for falso
        <button onClick={() => back()}> voltar</button>
      )}
      <h2>Carrinho ({totalItems} itens)</h2>
      <div className="pdv-cart-items">
        {cart.length === 0 ? (
          <p className="pdv-empty">Nenhum item no carrinho.</p>
        ) : (
          cart.map((item) => (
            <div key={item.id} className="pdv-cart-item">
              {/* Agrupa as informações do produto */}

              <div className="flex-row">
                <div className="flex-column">
                  <span>{item.sku}</span>
                  <div className="product-name">
                    <span>{item.name}</span>
                  </div>

                  <div className="flex-column">
                    <div className="product-details">
                      <span>{item.category}</span>
                    </div>

                    <div className="pricing-details">
                      <div className="unit-price">
                        <span>
                          R$ {item.price.toFixed(2).replace(".", ",")}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Contêiner para o valor total e o botão de remover */}
                </div>
                <div className="total-and-remove-container">
                  <button
                    onClick={() => handleRemoveFromCart(item.id)}
                    className="remove-button"
                  >
                    &times;
                  </button>
                  <div className="quantity-controls">
                    <button
                      onClick={() =>
                        handleUpdateQuantity(item.id, item.quantity + 1)
                      }
                    >
                      +
                    </button>
                    <input
                      type="number"
                      value={item.quantity}
                      onChange={(e) =>
                        handleUpdateQuantity(
                          item.id,
                          parseFloat(e.target.value) || 0
                        )
                      }
                    />
                    <button
                      onClick={() =>
                        handleUpdateQuantity(item.id, item.quantity - 1)
                      }
                    >
                      -
                    </button>
                  </div>

                  <div className="total-price">
                    <span>R$ {item.total.toFixed(2).replace(".", ",")}</span>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
      <div className="pdv-subtotal">
        <span>Subtotal:</span>
        <span>R$ {subtotal.toFixed(2).replace(".", ",")}</span>
      </div>

      <button onClick={() => handleProceedToPayment()}>Finalizar compra</button>
    </div>
  );
};

export default Cart;
