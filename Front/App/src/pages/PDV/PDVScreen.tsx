import React, { useState, useContext } from "react";
// Importações de contexto (presumimos que os contextos ainda trazem os dados antigos por enquanto)
import { ProductContext } from "../../context/NewProductContext";
import { ServiceProductContext } from "../../context/NewServiceProductContext";

// Importa os novos tipos do arquivo provisório 'newtypes.tsx'
import { Produto, Servico, ItemOrdem, OrdemVenda } from "../../types/newtypes";

// Importações de componentes (mantidas)
import ProductListFilter from "./components/ProductListFilter";
import Cart from "./components/Cart";
import Payment from "./components/Payment";
import "./PDV.css";
import ProductTable from "./components/ProductTable";
import AddService from "./components/pdvAddService";
import FlexGridContainer from "../../components/Layout/FlexGridContainer/FlexGridContainer";
import Typography from "../../components/ui/Typography/Typography";
import Fieldset from "../../components/ui/Fieldset/Fieldset";
import FormControl from "../../components/ui/FormControl/FormControl";

const PDVScreen: React.FC = () => {
  // ATENÇÃO: Seus Contextos precisam ser atualizados para retornar os novos tipos (Produto/Servico)
  const { services } = useContext(ServiceProductContext)!; // serviços agora deve ser Servico[]
  const { products } = useContext(ProductContext)!; // products agora deve ser Produto[]

  // O estado 'cart' é atualizado para usar o novo tipo ItemOrdem[]
  const [cart, setCart] = useState<ItemOrdem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [receivedAmount, setReceivedAmount] = useState<number | null>(null);
  const [showPayment, setShowPayment] = useState(false);

  // Lógica de cálculo atualizada para usar 'subtotal' e 'quantidade' do ItemOrdem
  const subtotal = cart.reduce((acc, item) => acc + item.subtotal, 0);
  const totalItems = cart.reduce((acc, item) => acc + item.quantidade, 0);
  const change = receivedAmount ? receivedAmount - subtotal : 0;

  // Função para adicionar PRODUTO (do catálogo) ao carrinho (ItemOrdem)
  const handleAddToCart = (product: any) => {
    const existingItem = cart.find((item) => item.produtoId === product.id);

    if (existingItem) {
      setCart(
        cart.map((item) =>
          item.produtoId === product.id
            ? {
                ...item,
                quantidade: item.quantidade + 1,
                subtotal: (item.quantidade + 1) * item.precoPraticado,
              }
            : item
        )
      );
    } else {
      // Cria um novo ItemOrdem a partir do Produto
      const newItem: ItemOrdem = {
        id: Math.random().toString(), // ID único para o item do carrinho
        tipoItem: "Produto",
        produtoId: product.id,
        nome: product.nome,
        sku: product.sku,
        quantidade: 1,
        precoPraticado: product.precoUnitario,
        subtotal: product.precoUnitario,
      };
      setCart([...cart, newItem]);
    }
  };

  // Função para adicionar SERVIÇO (do catálogo) ao carrinho (ItemOrdem)
  const handleServiceAddToCart = (service: Servico) => {
    const existingItem = cart.find((item) => item.servicoId === service.id);

    if (existingItem) {
      setCart(
        cart.map((item) =>
          item.servicoId === service.id
            ? {
                ...item,
                quantidade: item.quantidade + 1,
                subtotal: (item.quantidade + 1) * item.precoPraticado,
              }
            : item
        )
      );
    } else {
      // Cria um novo ItemOrdem a partir do Serviço
      const newItem: ItemOrdem = {
        id: Math.random().toString(), // ID único para o item do carrinho
        tipoItem: "Servico",
        servicoId: service.id,
        nome: service.nome,
        quantidade: 1,
        precoPraticado: service.valorBase, // Usa valorBase como preço praticado
        subtotal: service.valorBase,
      };
      setCart([...cart, newItem]);
    }
  };

  // As funções de remoção e atualização de quantidade precisam usar os IDs corretos
  const handleRemoveFromCart = (itemId: string) => { // Agora remove pelo ID do ItemOrdem
    setCart(cart.filter((item) => item.id !== itemId));
  };

  const handleUpdateQuantity = (itemId: string, newQuantity: number) => { // Agora atualiza pelo ID do ItemOrdem
    if (newQuantity <= 0) {
      handleRemoveFromCart(itemId);
      return;
    }
    setCart(
      cart.map((item) =>
        item.id === itemId
          ? {
              ...item,
              quantidade: newQuantity,
              subtotal: newQuantity * item.precoPraticado,
            }
          : item
      )
    );
  };

  const handleFinalizeSale = () => {
    if (cart.length === 0) {
      alert("O carrinho está vazio.");
      return;
    }
    if (!paymentMethod) {
      alert("Selecione uma forma de pagamento.");
      return;
    }

    // Lógica para salvar a OrdemVenda (OrderHeader + Itens)
    const newOrder: OrdemVenda = {
      id: Math.random().toString(), // Gere um ID real no backend
      orderNumber: `ORD-${Date.now()}`, // Gere um número de ordem
      clientName: "Cliente Padrão", // Substitua pelo cliente real
      clienteId: "CL001", // Substitua pelo ID do cliente real
      status: 'Concluído',
      dataCriacao: new Date(),
      responsavel: "Usuário Logado",
      total: subtotal,
      itens: cart, // O array de ItemOrdem
      pagamentos: [{ id: "PAG001", metodo: paymentMethod, valor: subtotal, dataPagamento: new Date() }], // Simples, ajuste conforme a interface Pagamento
      tags: [],
      tipoServico: '',
      metodoPagamento: paymentMethod,
      items: [],
      responsible: ""
    }

    console.log("Ordem de Venda a ser salva:", newOrder);
    alert("Venda finalizada com sucesso!");
    
    // Reset dos estados
    setCart([]);
    setPaymentMethod("");
    setReceivedAmount(null);
    setShowPayment(false);
  };

  const handleProceedToPayment = () => {
    if (cart.length === 0) {
        alert("Adicione itens ao carrinho para prosseguir com o pagamento.");
        return;
    }
    setShowPayment(true);
  };

  const back = () => {
    setShowPayment(false);
  };

  

  // Assumindo que os dados em 'products' e 'services' já usam Produto e Servico
  const filteredProducts = products.filter((p: Produto) =>
    p.nome.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredServicesProducts = services.filter((s: Servico) =>
    s.nome.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
     <FlexGridContainer 
                        layout="grid" 
                        gap="5px" 
                        template="4fr 10fr 4fr"
                        mobileTemplate="1fr" 
                    >
      {/* <div className={!showPayment ? 'pdv-container' : 'pdv-container-payment'}> */}
        {/* Lado Esquerdo: Produtos/Serviços */}
        {!showPayment && (
          <ProductListFilter
            products={filteredProducts}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            onCategoryClick={() => {}} // Provide a no-op or your actual handler
            activeCategory={""} // Provide the current active category or an empty string
          />
        )}

        {showPayment && (
          <AddService
            handleServiceAddToCart={handleServiceAddToCart}
            services={filteredServicesProducts}
            back={back}
            showPayment={showPayment}
          />
        )}

        {!showPayment && (
          <div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <Typography variant="h2">Lista de Produtos</Typography>
              <Fieldset legend="Buscar Produto" >
                <div className="pdv-search-inputs">
                  <FormControl label=""
                    type="text"
                    placeholder="Pesquisar nome do produto"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </Fieldset>
            </div>
            <div className="pdv-product-table-container">
              {/* O ProductTable deve ser atualizado internamente para receber Produto[] */}
              <ProductTable
            // Função que lida com o clique na linha (item: Produto)
            handleAddToCart={handleAddToCart} 
            // Array de dados (linhas da tabela)
            products={filteredProducts}
            // [OPCIONAL] Adiciona a variação visual, se desejado
            variant="striped" // Exemplo: usa a variação "striped"
        />
            </div>
          </div>
        )}

        {/* Lado Central/Direito: Carrinho */}
        <Cart
          cart={cart} // ItemOrdem[]
          totalItems={totalItems}
          subtotal={subtotal}
          handleUpdateQuantity={handleUpdateQuantity}
          handleRemoveFromCart={handleRemoveFromCart}
          handleProceedToPayment={handleProceedToPayment}
          showPayment={showPayment}
        />

        {/* Lado Direito: Pagamento (condicional) */}
        {showPayment && (
          <Payment
            cart={cart}
            paymentMethod={paymentMethod}
            setPaymentMethod={setPaymentMethod}
            receivedAmount={receivedAmount}
            setReceivedAmount={setReceivedAmount}
            change={change}
            handleFinalizeSale={handleFinalizeSale}
          />
        )}
      {/* </div> */}
    </FlexGridContainer>
  );
};

export default PDVScreen;