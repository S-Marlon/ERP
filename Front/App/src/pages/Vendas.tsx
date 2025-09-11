import React, { useState } from 'react';

// Tipos para os dados do produto e da venda
interface Product {
  id: string;
  name: string;
  price: number;
  stock: number;
}

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  total: number;
}

// interface Order {
//   id: string;
//   clientName: string;
//   clientInfo: string; // CPF, telefone, etc.
//   status: 'Pendente' | 'Concluído' | 'Cancelado'| 'Em Andamento' | 'Aguardando Peças' | 'Orçamento' | 'pagamento parcial';
//   date: Date;
//   responsible: string; // Nome do funcionário responsável
//   paymentMethod: string;
//   totalAmount: number;
//   items: OrderItem[]; // Este é o array que vai unir tudo
// }

const products: Product[] = [
  { id: '1', name: 'Mangueira R1at 1/2', price: 5.50, stock: 100 },
  { id: '2', name: 'Mangueira R2at 1/2', price: 8.00, stock: 150 },
  { id: '3', name: 'Mangueira R2at 1', price: 21.75, stock: 80 },
  { id: '4', name: 'Água Mineral 500ml', price: 2.50, stock: 200 },
  { id: '5', name: 'Pacote de Café 250g', price: 15.00, stock: 50 },
  { id: '6', name: 'Suco de Laranja 1L', price: 7.25, stock: 65 },
];

const PDVScreen: React.FC = () => {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [receivedAmount, setReceivedAmount] = useState<number | null>(null);

  const subtotal = cart.reduce((acc, item) => acc + item.total, 0);
  const totalItems = cart.reduce((acc, item) => acc + item.quantity, 0);
  const change = receivedAmount ? receivedAmount - subtotal : 0;

  const handleAddToCart = (product: Product) => {
    const existingItem = cart.find(item => item.id === product.id);
    if (existingItem) {
      setCart(cart.map(item =>
        item.id === product.id
          ? { ...item, quantity: item.quantity + 1, total: (item.quantity + 1) * item.price }
          : item
      ));
    } else {
      setCart([...cart, { ...product, quantity: 1, total: product.price }]);
    }
  };

  const handleRemoveFromCart = (productId: string) => {
    setCart(cart.filter(item => item.id !== productId));
  };

  const handleUpdateQuantity = (productId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      handleRemoveFromCart(productId);
      return;
    }
    setCart(cart.map(item =>
      item.id === productId
        ? { ...item, quantity: newQuantity, total: newQuantity * item.price }
        : item
    ));
  };

  const handleFinalizeSale = () => {
    if (cart.length === 0) {
      alert('O carrinho está vazio.');
      return;
    }
    if (!paymentMethod) {
      alert('Selecione uma forma de pagamento.');
      return;
    }

    alert('Venda finalizada com sucesso!');
    // Lógica para salvar a venda, imprimir cupom, limpar o carrinho, etc.
    setCart([]);
    setPaymentMethod('');
    setReceivedAmount(null);
  };

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div style={{ display: 'flex', height: '100vh', backgroundColor: '#f5f5f5' }}>

      {/* Coluna 1: Lista de Produtos */}
      <div style={{ flex: 1, padding: '1rem', borderRight: '1px solid #ddd', overflowY: 'auto', }}>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem', color: '#333' }}>Catálogo de Produtos</h2>
        <input
          type="text"
          placeholder="Pesquisar produto..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ width: '100%', padding: '0.5rem', marginBottom: '1rem', border: '1px solid #ccc', borderRadius: '4px' }}
        />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '1rem' }}>

          {filteredProducts.map(product => (
            <div
              key={product.id}
              onClick={() => handleAddToCart(product)}
              style={{
                backgroundColor: '#fff',
                borderRadius: '8px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                cursor: 'pointer',
                textAlign: 'center',
                transition: 'transform 0.2s',
              }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 'bold', color: 'black' }}>{product.name}</h3>
              <span style={{ background: "blue" }}>Cod: #45445</span>
              <span style={{ background: "red" }}>Mangueira Hidraulicas</span>
              <p style={{ color: '#059669', fontWeight: 'bold', marginTop: '0.3rem' }}>
                R$ {product.price.toFixed(2).replace('.', ',')}
              </p>
              <p style={{ fontSize: '0.8rem', color: '#666' }}>Estoque: {product.stock}</p>
            </div>
          ))}


        </div>
      </div>

      {/* Coluna 2: Carrinho de Vendas */}
      <div style={{ flex: 1.2, padding: '1rem', borderRight: '1px solid #ddd', display: 'flex', flexDirection: 'column' }}>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem', color: '#333' }}>Carrinho ({totalItems} itens)</h2>
        <div style={{ flex: 1, overflowY: 'auto', marginBottom: '1rem' }}>
          {cart.length === 0 ? (
            <p style={{ color: '#666', textAlign: 'center', marginTop: '2rem' }}>Nenhum item no carrinho.</p>
          ) : (
            cart.map(item => (
              <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', padding: '0.75rem', borderRadius: '4px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', marginBottom: '0.5rem' }}>
                <div style={{ flex: 1 }}>
                  <h4 style={{ margin: 0, fontWeight: 'bold', color: 'black' }}>{item.name}</h4>
                  <p style={{ margin: 0, fontSize: '0.9rem', color: '#555' }}>
                    R$ {item.price.toFixed(2).replace('.', ',')}
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="number"
                    value={item.quantity}
                    onChange={(e) => handleUpdateQuantity(item.id, parseInt(e.target.value) || 0)}
                    style={{ width: '60px', textAlign: 'center', padding: '0.25rem', borderRadius: '4px', border: '1px solid #ccc', }}
                  />
                  <span style={{ fontWeight: 'bold', minWidth: '80px', textAlign: 'right', color: 'black' }}>
                    R$ {item.total.toFixed(2).replace('.', ',')}
                  </span>
                  <button onClick={() => handleRemoveFromCart(item.id)} style={{ backgroundColor: '#ef4444', color: '#fff', border: 'none', borderRadius: '4px', padding: '0.25rem 0.5rem', cursor: 'pointer' }}>
                    &times;
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Resumo da Venda */}
        <div style={{ borderTop: '2px solid #ddd', paddingTop: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem' }}>
            <span>Subtotal:</span>
            <span>R$ {subtotal.toFixed(2).replace('.', ',')}</span>
          </div>
        </div>
      </div>

      {/* Coluna 3: Pagamento e Finalização */}
      <div style={{
        flex: 0.8, padding: '1rem', backgroundColor: '#e2e8f0', display: 'flex', flexDirection: 'column'
      }}>

        <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem', color: '#333' }}>Pagamento</h2>

        {/* Formas de Pagamento */}
        <div style={{ marginBottom: '1rem' }}>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>Método de Pagamento</h3>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={() => setPaymentMethod('dinheiro')}
              style={{ flex: 1, padding: '0.75rem', border: '1px solid #ccc', borderRadius: '4px', cursor: 'pointer', backgroundColor: paymentMethod === 'dinheiro' ? '#d1e7dd' : '#fff' }}
            >
              Dinheiro
            </button>
            <button
              onClick={() => setPaymentMethod('cartao')}
              style={{ flex: 1, padding: '0.75rem', border: '1px solid #ccc', borderRadius: '4px', cursor: 'pointer', backgroundColor: paymentMethod === 'cartao' ? '#d1e7dd' : '#fff' }}
            >
              Cartão
            </button>
            <button
              onClick={() => setPaymentMethod('pix')}
              style={{ flex: 1, padding: '0.75rem', border: '1px solid #ccc', borderRadius: '4px', cursor: 'pointer', backgroundColor: paymentMethod === 'pix' ? '#d1e7dd' : '#fff' }}
            >
              PIX
            </button>
          </div>
        </div>

        {/* Input de Valor Recebido (para troco) */}
        {paymentMethod === 'dinheiro' && (
          <div style={{ marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>Valor Recebido</h3>
            <input
              type="number"
              step="0.01"
              value={receivedAmount || ''}
              onChange={(e) => setReceivedAmount(parseFloat(e.target.value) || null)}
              style={{ width: '100%', padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px' }}
            />
          </div>
        )}

        {/* Resumo do Troco */}
        {receivedAmount !== null && change >= 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.25rem', fontWeight: 'bold', color: '#2563eb', marginBottom: '1rem' }}>
            <span>Troco:</span>
            <span>R$ {change.toFixed(2).replace('.', ',')}</span>
          </div>
        )}

        {/* Botão de Finalizar */}
        <button
          onClick={handleFinalizeSale}
          disabled={cart.length === 0 || !paymentMethod}
          style={{
            marginTop: 'auto', // Empurra o botão para a parte inferior
            backgroundColor: (cart.length === 0 || !paymentMethod) ? '#ccc' : '#059669',
            color: '#fff',
            padding: '1.5rem',
            fontSize: '1.25rem',
            fontWeight: 'bold',
            border: 'none',
            borderRadius: '8px',
            cursor: (cart.length === 0 || !paymentMethod) ? 'not-allowed' : 'pointer',
            transition: 'background-color 0.2s',
          }}
        >
          Finalizar Venda
        </button>
      </div>
    </div>
  );
};

export default PDVScreen;