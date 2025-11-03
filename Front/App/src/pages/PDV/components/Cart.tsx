import React from "react";
// 1. IMPORTAÇÃO ATUALIZADA: Trazendo o novo tipo ItemOrdem
import { ItemOrdem } from "../../../types/newtypes";
import Card from "../../../components/ui/Card/Card";
import Button from "../../../components/ui/Button/Button";
import Typography from "../../../components/ui/Typography/Typography";
import FormControl from "../../../components/ui/FormControl/FormControl";

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
    <Card>
      <Typography variant="h2Alt">Carrinho ({totalItems} itens)</Typography>
      <div className="pdv-cart-items">
        {cart.length === 0 ? (
          <Typography variant="p">Nenhum item no carrinho.</Typography>
        ) : (
          cart.map((item) => (
            // 3. MAPEAMENTO DE CAMPOS - ATUALIZADO
            <div key={item.id} className="pdv-cart-item">
              <div className="product-details">
                {/* SKU (se for produto) e Tipo do Item */}
                <Typography>
                  {item.sku ? `${item.sku} - ` : ""}
                  {item.tipoItem}
                </Typography>

                <div>
                  <Button
                    variant="warning"
                    onClick={() => handleRemoveFromCart(item.id)}
                  >
                    &#x1F6C8;
                  </Button>

                  <Button
                    variant="danger"
                    onClick={() => handleRemoveFromCart(item.id)}
                  >
                    &times;
                  </Button>
                </div>
              </div>

              <div className="product-name truncado">
                {/* Nome do item (produto ou serviço) */}
                <Typography>{item.nome}</Typography>
              </div>

              <div className="linha-vertical"></div>

              <div className="quantity-controls">
                <div className="unit-price">
                  {/* Preço Praticado (Unitário no momento da compra) */}
                  <Typography>
                    R$ {item.precoPraticado.toFixed(2).replace(".", ",")}
                  </Typography>
                </div>

                <div className="container">
                  {/* Botão de Decrementar */}
                  <Button
                    onClick={() =>
                      handleUpdateQuantity(item.id, item.quantidade - 1)
                    }
                  >
                    -
                  </Button>

                  {/* Input de Quantidade */}
                  <FormControl
                    label="Quantidade"
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
                  <Button
                    onClick={() =>
                      handleUpdateQuantity(item.id, item.quantidade + 1)
                    }
                  >
                    +
                  </Button>
                </div>

                <div className="total-price">
                  {/* Subtotal (Preço total da linha) */}
                  <Typography>
                    R$ {item.subtotal.toFixed(2).replace(".", ",")}
                  </Typography>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer do Carrinho (Subtotal) */}
      <div className="pdv-subtotal">
        <Typography>Subtotal:</Typography>
        <Typography>R$ {subtotal.toFixed(2).replace(".", ",")}</Typography>
      </div>

      {/* Botão de Ação */}
      <Button onClick={handleProceedToPayment}>Finalizar compra</Button>
    </Card>
  );
};

export default Cart;
