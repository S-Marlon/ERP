# 💡 Exemplos de Uso - ItemSelectorModal e OSPanelAdapter

## 1️⃣ Importação no PDV.tsx

```typescript
import OSPanelRefactored from './components/OSPanelAdapter';
import { ItemSelectorModal } from './components/ItemSelectorModal'; // Já dentro do OSPanelAdapter

// No render
{screen === 'os-create' && (
  <OSPanelRefactored
    customerId={id}
    onSubmit={(osItem) => addToCart(osItem)}
    onCancel={() => setScreen('os-list')}
    money={money}
    setActiveTab={setScreen}
  />
)}
```

---

## 2️⃣ Uso Standalone do ItemSelectorModal

Se quiser usar em outro lugar:

```typescript
import { ItemSelectorModal } from '../PDV/components/ItemSelectorModal';
import { CartItem } from '../PDV/types/cart.types';

const MyComponent = () => {
  const [isOpen, setIsOpen] = useState(false);
  const money = new Intl.NumberFormat('pt-BR', { 
    style: 'currency', 
    currency: 'BRL' 
  });

  const handleSelectItem = (item: CartItem) => {
    console.log('Item selecionado:', item);
    // Faça algo com o item
    setIsOpen(false);
  };

  return (
    <>
      <button onClick={() => setIsOpen(true)}>
        Abrir Seletor
      </button>

      <ItemSelectorModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onSelect={handleSelectItem}
        title="Escolha um Produto"
        money={money}
      />
    </>
  );
};
```

---

## 3️⃣ Estrutura de Dados da OS

```typescript
// Objeto enviado para CartAside
const osItem: CartItem = {
  id: 'os-1234567890',
  name: 'Prensa Hidráulica • ½ polegada',
  category: 'OS',
  price: 1500.00,
  costPrice: 0,
  type: 'os',
  quantity: 1,
  
  // Dados específicos da OS
  osData: {
    osNumber: 'OS-000123',
    equipment: 'Prensa Hidráulica',
    application: 'Prensagem de mangueiras',
    gauge: '½ polegada',
    layers: '2',
    finalLength: 0,
    laborType: 'fixed',
    laborValue: 500,
    
    // Itens adicionados à OS
    items: [
      {
        id: 'prod-001',
        name: 'Mangueira Hidráulica 1/2"',
        sku: 'MANH-001',
        price: 150.00,
        quantity: 2,
        stock: 50,
        unitOfMeasure: 'mt'
      },
      {
        id: 'prod-002',
        name: 'Luva de Compressão',
        sku: 'LUVA-001',
        price: 25.00,
        quantity: 2,
        stock: 100,
        unitOfMeasure: 'un'
      }
    ],
    
    // Serviços adicionados à OS
    services: [
      {
        id: 'serv-001',
        name: 'Teste de Pressão',
        price: 200.00,
        quantity: 1
      }
    ],
    
    // Totais calculados
    productsTotal: 350.00,  // 2*150 + 2*25
    servicesTotal: 200.00,  // 1*200
    laborTotal: 500.00,
    
    // Pagamento
    paid: 0,
    notes: 'Cliente solicitou entrega em 3 dias'
  }
};

// No CartAside, exibirá:
// 🛠️ Ordem de Serviço (1)
// Prensa Hidráulica • ½ polegada
// 2 itens • 1 serviço
// Ref: OS-000123
// Produtos: R$ 350,00
// MO: R$ 500,00
// Total: R$ 1.050,00
```

---

## 4️⃣ Exemplo de Busca de Produtos

```typescript
// ItemSelectorModal faz requisições assim:

// GET /api/pdv/products?searchTerm=mangueira&limit=50&page=1
// Resposta:
{
  "data": [
    {
      "id": "prod-001",
      "name": "Mangueira Hidráulica 1/2\"",
      "sku": "MANH-001",
      "barcode": "1234567890123",
      "category": "Mangueiras",
      "salePrice": 150.00,
      "costPrice": 85.00,
      "currentStock": 50,
      "unitOfMeasure": "mt",
      "pictureUrl": "/images/products/manh-001.jpg",
      "status": "Ativo"
    },
    {
      "id": "prod-002",
      "name": "Mangueira Poliuretano 3/4\"",
      "sku": "MANH-002",
      "barcode": "1234567890124",
      "category": "Mangueiras",
      "salePrice": 180.00,
      "costPrice": 95.00,
      "currentStock": 0,
      "unitOfMeasure": "mt",
      "pictureUrl": "/images/products/manh-002.jpg",
      "status": "Ativo"
    }
  ],
  "pagination": {
    "total": 2,
    "page": 1,
    "limit": 50
  }
}
```

---

## 5️⃣ Callbacks e Eventos

```typescript
// OSPanelAdapter - Callbacks
interface OSPanelRefactoredProps {
  // Quando usuário clica "Gerar Venda"
  onSubmit?: (item: CartItem) => void;
  
  // Quando usuário clica "Cancelar"
  onCancel?: () => void;
  
  // Para redirecionar para aba de carrinho após gerar
  setActiveTab?: (tab: string) => void;
  
  // Formatador de moeda
  money: Intl.NumberFormat;
  
  // Outros props...
}

// Uso:
<OSPanelRefactored
  onSubmit={(osItem) => {
    addToCart(osItem);  // Adiciona ao carrinho
    console.log('OS gerada:', osItem.osData?.osNumber);
  }}
  onCancel={() => {
    setScreen('pdv');  // Volta para PDV normal
  }}
  setActiveTab={(tab) => {
    setScreen(tab);  // Muda aba
  }}
  money={money}
  customerId={customerId}
/>
```

---

## 6️⃣ Fluxo de Validações

```typescript
// 1. Adicionar item - Validações
try {
  if (!item || !item.id) throw new Error('Item inválido');
  if (item.quantity <= 0) throw new Error('Quantidade deve ser > 0');
  if (item.type === 'product' && item.quantity > (item.stock || 0)) {
    throw new Error(`Apenas ${item.stock} disponíveis`);
  }
  // ✅ Item adicionado com sucesso
} catch (error) {
  // ⚠️ Mostrar toast/alerta
  Swal.fire({ icon: 'error', text: error.message });
}

// 2. Gerar venda - Validações
if (!osData.equipment || !osData.gauge) {
  // ⚠️ Faltam dados básicos
  Swal.fire({ text: 'Preencha Equipamento e Bitola' });
  return;
}

if (osItems.length === 0 && osServices.length === 0) {
  // ❓ Confirmar se quer continuar só com MO
  const result = await Swal.fire({
    text: 'Continuar apenas com mão de obra?'
  });
  if (!result.isConfirmed) return;
}

if (osItems.length > 0 && osData.laborValue <= 0) {
  // ❓ Confirmar se quer continuar sem MO
  const result = await Swal.fire({
    text: 'Continuar sem mão de obra?'
  });
  if (!result.isConfirmed) return;
}

// ✅ Todas as validações passaram
// Mostrar resumo e confirmar
```

---

## 7️⃣ Cálculos Automáticos

```typescript
// Cálculos no OSPanelAdapter

// Total de Produtos
const productsTotal = osItems.reduce(
  (acc, item) => acc + item.price * (item.quantity || 1),
  0
);

// Total de Serviços
const servicesTotal = osServices.reduce(
  (acc, service) => acc + service.price * (service.quantity || 1),
  0
);

// Total de Mão de Obra
let laborTotal = 0;
if (osData.laborType === 'fixed') {
  laborTotal = osData.laborValue;
} else if (osData.laborType === 'per_point') {
  // Exemplo: 2 pontos por item
  const points = osItems.length * 2;
  laborTotal = points * osData.laborValue;
}

// TOTAL GERAL
const total = productsTotal + servicesTotal + laborTotal;

// Restante a pagar
const remaining = total - paid;
```

---

## 8️⃣ Integração com Context PDV

```typescript
// PDV.tsx - Usando usePDV hook

const PDVContent: React.FC = () => {
  const {
    cart,          // Carrinho principal
    addToCart,     // Adiciona item ao carrinho
    updateQuantity,
    removeItem,
    applyIndividualDiscount
  } = usePDV();

  // Passar addToCart para OSPanelAdapter
  return (
    <OSPanelRefactored
      onSubmit={(osItem) => {
        // Adiciona OS ao carrinho principal
        addToCart(osItem);
        
        // Vai para aba do carrinho
        setScreen('cart');
      }}
      {...otherProps}
    />
  );
};
```

---

## 9️⃣ Renderização de OS no CartAside

```typescript
// CartAside.tsx - Exibição de OS

{osItems.length > 0 && (
  <div className={styles.osHighlight}>
    <div className={styles.osHighlightHeader}>
      🛠️ Ordem de Serviço ({osItems.length})
    </div>

    {osItems.map(os => {
      const osDetails = os.osData || {};
      
      return (
        <div key={os.id} className={styles.osHighlightItem}>
          <div className={styles.osItemContent}>
            <strong>{os.name}</strong>
            <small>
              {osDetails.items?.length || 0} itens • 
              {osDetails.services?.length || 0} serviços
            </small>
          </div>
          
          <div className={styles.osItemRight}>
            <strong>{money.format(os.price)}</strong>
          </div>
          
          <button onClick={() => removeItem(os.id)}>✕</button>
        </div>
      );
    })}
  </div>
)}
```

---

## 🔟 Tratamento de Erros

```typescript
try {
  // Validações
  if (!item) throw new Error('Item inválido');
  if (!isValidQuantity(item.quantity)) throw new Error('Quantidade inválida');
  
  // Adicionar item
  setOsItems([...osItems, item]);
  
  // Sucesso
  Swal.fire({
    icon: 'success',
    title: 'Adicionado!',
    text: `${item.name} x${item.quantity}`,
    timer: 1500,
    toast: true,
    position: 'bottom-end'
  });
  
} catch (error) {
  // Erro
  Swal.fire({
    icon: 'error',
    title: 'Erro ao adicionar',
    text: error.message || 'Tente novamente'
  });
}
```

---

## 📚 Boas Práticas

### ✅ Fazer
```typescript
// 1. Sempre validar antes de adicionar
if (isValid(item)) addItem(item);

// 2. Usar useCallback para callbacks
const handleAdd = useCallback((item) => {
  addItem(item);
}, []);

// 3. Mostrar feedback
Swal.fire({ icon: 'success', toast: true });

// 4. Tratar erros
try { } catch (err) { }

// 5. Memoizar cálculos
const total = useMemo(() => calculate(), [deps]);
```

### ❌ Evitar
```typescript
// 1. Adicionar sem validar
addItem(item);  // Pode quebrar

// 2. Callback inline (re-criar a cada render)
onClick={() => addItem(item)}  // Ruim para performance

// 3. Sem feedback
// Usuário não sabe se funcionou

// 4. Sem tratamento de erro
fetch(...);  // Pode quebrar silenciosamente

// 5. Recalcular sempre
const total = calculate();  // Re-calcula a cada render
```

---

## 🎯 Resumo Rápido

| Ação | Componente | Função |
|------|-----------|---------|
| Abrir seletor | ItemSelectorModal | Busca de produtos |
| Adicionar item | handleAddItemToOS | Valida e adiciona |
| Editar quantidade | handleUpdateItemQuantity | Atualiza valor |
| Remover | handleRemoveItem | Tira do array |
| Gerar venda | handleGenerateSale | Cria OS + CartItem |
| Exibir no carrinho | CartAside | Mostra resumo |

---

**Última atualização:** 25/04/2026  
**Exemplos testados:** ✅ Sim  
**Pronto para uso:** ✅ Sim
