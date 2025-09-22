import React from "react";
import { CartItem } from "../../../types/types";

interface Props {
  cart: CartItem[];
  paymentMethod: string;
  setPaymentMethod: (value: string) => void;
  receivedAmount: number | null;
  setReceivedAmount: (value: number | null) => void;
  change: number;
  handleFinalizeSale: () => void;
}

const Payment: React.FC<Props> = ({
  cart,
  paymentMethod,
  setPaymentMethod,
  receivedAmount,
  setReceivedAmount,
  change,
  handleFinalizeSale,
}) => {
  return (
    <div className="pdv-payment">
      <h2>Pagamento</h2>

      <div className="pdv-methods">
        {["dinheiro", "cartão", "pix"].map((method) => (
          <button
            key={method}
            onClick={() => setPaymentMethod(method)}
            className={paymentMethod === method ? "active" : ""}
          >
            {method.toUpperCase()}
          </button>
        ))}
      </div>

      {paymentMethod === "dinheiro" && (
        <div>
          <h3>Valor Recebido</h3>
          <input
            type="number"
            step="0.01"
            value={receivedAmount || ""}
            onChange={(e) =>
              setReceivedAmount(parseFloat(e.target.value) || null)
            }
          />
        </div>
      )}

      {receivedAmount !== null && change >= 0 && (
        <div className="pdv-change">
          <span>Troco:</span>
          <span>R$ {change.toFixed(2).replace(".", ",")}</span>
        </div>
      )}

      <button
        onClick={handleFinalizeSale}
        disabled={cart.length === 0 || !paymentMethod}
        className="pdv-finalize"
      >
        Finalizar Venda
      </button>
    </div>
  );
};

export default Payment;
