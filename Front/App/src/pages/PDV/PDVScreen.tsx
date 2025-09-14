import React, { useState, useContext } from "react";
import { ProductContext } from "../../context/ProductContext";
import ProductList from "./components/ProductList";
import Cart from "./components/Cart";
import Payment from "./components/Payment";
import { CartItem, Product } from "../../types/types";
import "./PDV.css";

const PDVScreen: React.FC = () => {
  const { products } = useContext(ProductContext)!;
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [receivedAmount, setReceivedAmount] = useState<number | null>(null);
  const [showPayment, setShowPayment] = useState(false); // 👈 Adicionei este novo estado

  const subtotal = cart.reduce((acc, item) => acc + item.total, 0);
  const totalItems = cart.reduce((acc, item) => acc + item.quantity, 0);
  const change = receivedAmount ? receivedAmount - subtotal : 0; 


  const handleAddToCart = (product: Product) => {
    const existingItem = cart.find((item) => item.id === product.id);
    if (existingItem) {
      setCart(
        cart.map((item) =>
          item.id === product.id
            ? {
                ...item,
                quantity: item.quantity + 1,
                total: (item.quantity + 1) * item.price,
              }
            : item
        )
      );
    } else {
      setCart([
        ...cart,
        {
          ...product,
          productId: product.id,
          quantity: 1,
          total: product.price,
        },
      ]);
    }
  };

  

  const handleRemoveFromCart = (productId: string) => {
    setCart(cart.filter((item) => item.id !== productId));
  };

  const handleUpdateQuantity = (productId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      handleRemoveFromCart(productId);
      return;
    }
    setCart(
      cart.map((item) =>
        item.id === productId
          ? { ...item, quantity: newQuantity, total: newQuantity * item.price }
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

    alert("Venda finalizada com sucesso!");
    setCart([]);
    setPaymentMethod("");
    setReceivedAmount(null);
    setShowPayment(false);
  };

  const handleProceedToPayment = () => {
    // 👈 Esta função é nova, ela será chamada pelo botão no componente Cart
    if (cart.length === 0) {
        alert("Adicione itens ao carrinho para prosseguir com o pagamento.");
        return;
    }
    setShowPayment(true);
  };

   const back = () => {
   
    setShowPayment(false);
  };

  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="pdv-container">
       {!showPayment && ( // 👈 Renderiza ProductList apenas se showPayment for falso
          <ProductList
            products={filteredProducts}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            handleAddToCart={handleAddToCart}
          />
        )}

    
      <Cart
        cart={cart}
        totalItems={totalItems}
        subtotal={subtotal}
        handleUpdateQuantity={handleUpdateQuantity}
        handleRemoveFromCart={handleRemoveFromCart}
        handleProceedToPayment={handleProceedToPayment}
        back={back}
        showPayment={showPayment}
      />

       {showPayment && ( // 👈 Renderiza Payment apenas se showPayment for verdadeiro
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
    
    </div>
  );
};

export default PDVScreen;