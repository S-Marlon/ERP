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
    showPayment
}) => {
  return (
    <div className="pdv-cart">
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
              <div>
                <span>{item.name}</span>
                <br />
                <span>{item.sku}</span>
                <br/>
                <span>{item.category}</span>
              </div>
              <div>
                <span>R$ {item.price.toFixed(2).replace(".", ",")}</span>
              </div>
              <div className="pdv-cart-controls">
                <input
                  type="number"
                  value={item.quantity}
                  onChange={(e) =>
                    handleUpdateQuantity(item.id, parseInt(e.target.value) || 0)
                  }
                />
                <span>R$ {item.total.toFixed(2).replace(".", ",")}</span>
                <button onClick={() => handleRemoveFromCart(item.id)}>
                  &times;
                </button>
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
