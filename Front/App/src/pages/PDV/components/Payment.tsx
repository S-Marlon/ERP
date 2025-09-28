import React from "react";
// 1. IMPORTAÇÃO ATUALIZADA: Trazendo o novo tipo ItemOrdem
import { ItemOrdem } from "../../../types/newtypes"; 

// 2. TIPAGEM DAS PROPS CORRIGIDA: Usa ItemOrdem[]
interface Props {
  cart: ItemOrdem[]; // Apenas o tipo da lista de itens foi alterado
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
        {/* Métodos de pagamento fixos */}
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

      {/* Input de Valor Recebido, visível apenas para pagamento em DINHEIRO */}
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

      {/* Exibição do Troco, se aplicável */}
      {receivedAmount !== null && change >= 0 && (
        <div className="pdv-change">
          <span>Troco:</span>
          <span>R$ {change.toFixed(2).replace(".", ",")}</span>
        </div>
      )}

      {/* Botão Finalizar Venda */}
      <button
        onClick={handleFinalizeSale}
        // Desabilitado se o carrinho estiver vazio OU se o método de pagamento não foi selecionado
        disabled={cart.length === 0 || !paymentMethod} 
        className="pdv-finalize"
      >
        Finalizar Venda
      </button>
    </div>
  );
};

export default Payment;