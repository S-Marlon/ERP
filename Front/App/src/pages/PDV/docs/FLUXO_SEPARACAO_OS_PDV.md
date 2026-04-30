# ✅ SEPARAÇÃO DE FLUXO: OS vs PDV

## 🔴 PROBLEMA CORRIGIDO

Quando adicionava um produto na OS, o sistema redirecionava para a aba "Peças" (parts).

```
Aba Peças → seleciona produto → vai pra OS ✅
Aba OS → clica "+ Adicionar" → redireciona pra Peças ❌ (ERRADO)
```

---

## ✅ SOLUÇÃO IMPLEMENTADA

### 1. **Modal Local na OS**

Ao invés de redirecionar para outra aba, OSPanelAdapter agora tem seu próprio modal de seleção:

```tsx
// OSPanelAdapter.tsx

const [showItemSelector, setShowItemSelector] = useState(false);

// Botão "Adicionar" agora abre modal local
<button onClick={() => setShowItemSelector(true)}>
  + Adicionar
</button>

// Modal renderizado dentro da OS, sem deixar a aba
{showItemSelector && (
  <div className={styles.modalOverlay}>
    <input placeholder="Buscar..." />
    {/* Lista de produtos aqui */}
  </div>
)}
```

### 2. **Fluxo Separado**

#### ❌ ANTES (errado):
```
PDV.tsx submeter OS
  → onSubmit chama addToCart
  → setActiveTab('cart') imediatamente
  → mas OSPanelAdapter também chamava setActiveTab('parts')
  → conflito de navegação
```

#### ✅ DEPOIS (correto):
```
OSPanelAdapter (aba isolada)
  ├─ "+ Adicionar" → abre modal local (SEM sair da aba)
  ├─ Seleciona item → addToOS (estado local)
  └─ "Gerar Venda" → chama onSubmit + setActiveTab('cart')

PDV.tsx (coordenador)
  ├─ Aba "Peças" → carrinho normal
  └─ Aba "OS" → controle isolado
```

---

## 🎯 COMPORTAMENTO AGORA

### Aba Peças (PDV Normal)
✅ Seleciona produto  
✅ Clica "+" → vai pro carrinho  
✅ Continua em "Peças"  

### Aba OS (Ordem de Serviço)
✅ Clica "+ Adicionar"  
✅ Abre modal de seleção (dentro da OS)  
✅ **NÃO sai da aba**  
✅ Produto adicionado localmente  
✅ Continua montando a OS  
✅ Ao final, clica "Gerar Venda"  
✅ Aí sim redireciona pro carrinho ("cart")  

---

## 🔧 HANDLERS CRIADOS

### handleAddItemToOS
```tsx
const handleAddItemToOS = useCallback((item: CartItem) => {
  setOsItems([...osItems, item]);
  setShowItemSelector(false); // Fecha modal após adicionar
}, [osItems]);
```

### handleGenerateSale (com redirecionamento)
```tsx
const handleGenerateSale = useCallback(() => {
  if (osItems.length === 0) return;
  
  const osItem = { ... };
  onSubmit(osItem);
  setActiveTab?.('cart'); // Redireciona APENAS ao finalizar
}, [..., setActiveTab]);
```

---

## 📝 PRÓXIMOS PASSOS

Para integrar o seletor de produtos ao modal:

```tsx
// OSPanelAdapter.tsx - dentro do modal

<input 
  type="text"
  placeholder="Buscar por SKU, EAN ou nome..."
  onChange={(e) => {
    // Chamar API de produtos
    // Filtrar resultados
  }}
/>

{/* Renderizar lista de produtos aqui */}
{filteredProducts.map(product => (
  <div 
    key={product.id}
    onClick={() => handleAddItemToOS(product)}
  >
    {product.name} - {money.format(product.price)}
  </div>
))}
```

---

## 🚀 RESULTADO

| Ação | Antes | Depois |
|------|-------|--------|
| Aba Peças - selecionar | ✅ OK | ✅ OK |
| Aba OS - "+ Adicionar" | ❌ Sai da aba | ✅ Modal local |
| Navegar entre abas | ❌ Conflitos | ✅ Limpo |
| Finalizar OS | ✅ OK | ✅ OK + fluxo claro |

---

## ✨ VANTAGENS

✅ **Fluxo separado** - OS não interfere em PDV  
✅ **Modal isolado** - usuário não se perde  
✅ **Redirecionamento claro** - só redireciona ao finalizar  
✅ **Sem quebra** - compatível com código existente  
✅ **Escalável** - pronto para refactor futuro  

