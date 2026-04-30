/**
 * PLANO DE AÇÃO IMEDIATO
 * ======================
 * 
 * Objetivo: Corrigir erro e preparar para refactor arquitetural
 * Status: ACIONÁVEL AGORA
 */

/*
═══════════════════════════════════════════════════════════════════════════════
PROBLEMA 1: Corrigir erro "setCart is not defined"
═══════════════════════════════════════════════════════════════════════════════

Local: PDV.tsx linha ~764
Erro: OSPanelAdapter tenta usar setCart que não existe

❌ ESTADO ATUAL em PDV.tsx:

  <OSPanelAdapter
    // setCart={setCart}  ← COMENTADO (causa erro)
    setActiveTab={setActiveTab}
    ...
  />

E dentro de OSPanelAdapter.tsx:

  const handleSubmit = async (osData) => {
    // ... code ...
    setCart(osData);  ← EXPLODE AQUI
  };

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SOLUÇÃO PROPOSTA: 3 opções em ordem de viabilidade

╔═══════════════════════════════════════════════════════════════════════════╗
║ OPÇÃO A: Remover setCart, usar addToCart (RECOMENDADO AGORA)            ║
╚═══════════════════════════════════════════════════════════════════════════╝

Por quê:
  • Menos invasivo
  • PDVContext já tem addToCart
  • Não quebra contexto
  • Funciona com CartItem existente

Como fazer:

1. Em OSPanelAdapter.tsx, trocar:
   
   // ❌ ANTES
   const handleSubmit = async (osData) => {
     ...
     setCart(osData);  // ERRO
   };

   // ✅ DEPOIS
   const handleSubmit = async (osData) => {
     const osCartItem: CartItem = {
       id: generateUUID(),
       type: 'os',
       osId: osData.id,
       osNumber: osData.number,
       status: 'completed',
       customerId: osData.customerId,
       orders: osData,
       finalPrice: osData.total,
       createdAt: new Date(),
     };
     
     onSubmit?.(osCartItem); // ou
     addToCart(osCartItem);  // se receber do context
   };

2. Atualizar prop em PDV.tsx:
   
   // ❌ ANTES
   <OSPanelAdapter
     // setCart={setCart}
     setActiveTab={setActiveTab}
   />

   // ✅ DEPOIS
   <OSPanelAdapter
     onSubmit={(osItem) => {
       addToCart(osItem);
       setActiveTab('cart');
     }}
     setActiveTab={setActiveTab}
   />


╔═══════════════════════════════════════════════════════════════════════════╗
║ OPÇÃO B: Adicionar setCart ao PDVContext (MAIS TRABALHO)                 ║
╚═══════════════════════════════════════════════════════════════════════════╝

Se precisar de "substituir todo o carrinho" (não apenas adicionar):

1. Adicionar ao PDVContext:
   
   const setCart = (newCart: CartItem[]) => {
     setCartState(newCart);
   };
   
   // Exportar
   <PDVProvider value={{ ...state, setCart }}>

2. Em PDV.tsx:
   
   <OSPanelAdapter
     setCart={setCart}
     setActiveTab={setActiveTab}
   />

3. ✅ Erro desaparece


╔═══════════════════════════════════════════════════════════════════════════╗
║ OPÇÃO C: Usar callback genérico (MELHOR PARA FUTURO)                     ║
╚═══════════════════════════════════════════════════════════════════════════╝

Preparar para state machine:

1. Modificar OSPanelAdapter:
   
   interface OSPanelAdapterProps {
     onOSComplete: (osItem: CartItem) => void;  // ← genérico
     setActiveTab?: (tab: string) => void;
   }

   const handleSubmit = (osData) => {
     const osCartItem: CartItem = createOSCartItem(osData);
     onOSComplete(osCartItem);  // ← chamada genérica
   };

2. Em PDV.tsx:
   
   <OSPanelAdapter
     onOSComplete={(osItem) => {
       addToCart(osItem);
       setActiveTab('cart');
     }}
   />


═══════════════════════════════════════════════════════════════════════════════
PROBLEMA 2: OSPanelAdapter não usa useOrderService
═══════════════════════════════════════════════════════════════════════════════

Situação:
  • Criamos un hook useOrderService (perfeito!)
  • OSPanelAdapter não usa (usa local state)
  • Duplicação de lógica

Solução para agora (não quebra nada):
  └─ Deixar como está
  └─ No refactor ETAPA 4, conectar OSPanelAdapter ao hook

Próximo: especificar qual será o estado da OSPanelAdapter
  • Opção 1: Recebe osData via props + usa addToCart
  • Opção 2: Usa hook useOrderService (melhor, mas precisa setupar)


═══════════════════════════════════════════════════════════════════════════════
PROBLEMA 3: CartItem.osData: any
═══════════════════════════════════════════════════════════════════════════════

Status: ✅ JÁ RESOLVIDO nas files criadas

CartItem já tem type: 'os' | 'product' | 'service'
Basta usar discriminated union ao invés de any.

Implementação:
  export type CartItem = 
    | ProductCartItem
    | ServiceCartItem
    | OSCartItem;

Nada a fazer agora (será feito na ETAPA 1 do refactor).


═══════════════════════════════════════════════════════════════════════════════
CRONOGRAMA IMEDIATO
═══════════════════════════════════════════════════════════════════════════════

█ HOJE (Hoje mesmo, ~30 min):
  □ Escolher entre Opção A, B ou C acima
  □ Aplicar correção em 2 arquivos (OSPanelAdapter.tsx, PDV.tsx)
  │
  │ Resultado: ✅ Erro desaparece
  │            ✅ Sistema volta a funcionar


█ PRÓXIMOS PASSOS (Semana que vem):

ETAPA 1: Modelos (2-3 dias)
  ├─ Criar models/ com discriminated types
  ├─ Criar services/domain/OrderServiceService.ts
  └─ Criar services/domain/StateTransitionService.ts

ETAPA 2: State Machine (1-2 dias)
  ├─ Implementar useOrderService com state machine
  └─ Testes unitários

ETAPA 3: Refactor Contextos (1-2 dias)
  ├─ Dividir PDVContext em 3
  └─ Compatibilidade com código antigo

ETAPA 4: Refactor Componentes (1-2 dias)
  ├─ PDV.tsx → 3 abas
  ├─ Conectar OSPanelAdapter ao novo hook
  └─ Testes e2e


═══════════════════════════════════════════════════════════════════════════════
RESUMO DA AÇÃO
═══════════════════════════════════════════════════════════════════════════════

Agora:
  ✨ Escolher opção de correção
  ✨ Aplicar em 2 arquivos
  ✨ 30 minutos
  ✨ Sistema volta online

Depois:
  ✨ Implementar arquitetura proposta em ARCHITECTURE_ANALYSIS.ts
  ✨ 1-2 semanas
  ✨ Sistema pronto para produção

*/

export {};
