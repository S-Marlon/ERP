/**
 * GUIA DE MIGRAÇÃO: OSPanel → OSPanelRefactored
 * 
 * O sistema foi atualizado com uma abordagem de migração controlada.
 * Código novo + Visibilidade antigo = Zero risco.
 */

/*
═══════════════════════════════════════════════════════════════════════════
ANTES (Código Antigo)
═══════════════════════════════════════════════════════════════════════════

❌ Múltiplos useState espalhados
❌ Tipos fracos (any)
❌ Lógica complexa no componente
❌ Cálculos sem testes
❌ Difícil de reutilizar

const [osItems, setOsItems] = useState<CartItem[]>([]);
const [osServices, setOsServices] = useState<CartItem[]>([]);
const [osData, setOsData] = useState<any>({});

<OSPanel
  osItems={osItems}
  setOsItems={setOsItems}
  ...12 props diferentes
/>


═══════════════════════════════════════════════════════════════════════════
DEPOIS (Código Novo)
═══════════════════════════════════════════════════════════════════════════

✅ useReducer centralizado
✅ Tipagem TypeScript forte
✅ Lógica separada do UI
✅ Funções puras testáveis
✅ Componentes isolados e reutilizáveis

const { os, addItem, removeItem, setConfig, ... } = useOrderService(customerId);

<OSPanelAdapter
  customerId={cliente?.id || 'unknown'}
  osItems={osItems}
  setOsItems={setOsItems}
  osServices={osServices}
  setOsServices={setOsServices}
  osData={osData}
  setOsData={setOsData}
  osTotal={osTotal}
  calculatedLabor={calculatedLabor}
  money={money}
  setCart={setCart}
  setActiveTab={setActiveTab}
/>


═══════════════════════════════════════════════════════════════════════════
O QUE MUDOU NO CÓDIGO
═══════════════════════════════════════════════════════════════════════════

📝 IMPORTS (PDV.tsx)
  ANTES: import OSPanel from './components/OSPanel';
  DEPOIS: import OSPanelAdapter from './components/OSPanelAdapter';

🎯 COMPONENTE CHAMADO (PDV.tsx linha 763)
  ANTES: <OSPanel osItems={osItems} ... money={money} />
  DEPOIS: <OSPanelAdapter customerId={...} ... money={money} />

📁 ARQUIVOS CRIADOS
  ✓ src/types/order-service.types.ts      (Tipos completos)
  ✓ src/types/customer.types.ts            (Tipos de Cliente)
  ✓ src/types/technician.types.ts         (Tipos de Técnico)
  ✓ src/types/payment.types.ts            (Tipos de Pagamento)
  ✓ src/types/sale.types.ts               (Tipos de Venda)
  ✓ src/types/common.types.ts             (Tipos Comuns)
  ✓ src/types/erp.types.ts                (Exportação centralizada)
  ✓ src/utils/os-helpers.ts               (Funções puras)
  ✓ src/utils/sale-helpers.ts
  ✓ src/utils/payment-helpers.ts
  ✓ src/utils/id-generator.ts
  ✓ src/hooks/useOrderService.ts          (Hook com useReducer)
  ✓ src/hooks/useSale.ts
  ✓ src/hooks/usePayment.ts
  ✓ src/pages/PDV/components/OrderService/OSItemList.tsx
  ✓ src/pages/PDV/components/OrderService/OSForm.tsx
  ✓ src/pages/PDV/components/OrderService/LaborCalculator.tsx
  ✓ src/pages/PDV/components/OrderService/OSSummary.tsx
  ✓ src/pages/PDV/components/OrderService/OSPanelRefactored.tsx
  ✓ src/pages/PDV/components/OSPanelAdapter.tsx     (← Faz sync com código antigo)
  ✓ src/pages/PDV/hooks/useSyncOrderService.ts      (Sincronização)
  ✓ src/ARCHITECTURE.ts                   (Documentação)


═══════════════════════════════════════════════════════════════════════════
COMO FUNCIONA A MIGRAÇÃO (Fluxo Completo)
═══════════════════════════════════════════════════════════════════════════

1️⃣ USUÁRIO INTERAGE COM UI
   └─ Clica em "+ Produto", preenche dados, etc

2️⃣ OSPANELREFACTORED recebe eventos
   └─ Chama addItem(), removeItem(), setConfig(), etc
   └─ Gerenciados pelo useOrderService (useReducer)

3️⃣ ESTADO ATUALIZADO (OrderService)
   └─ Imutável
   └─ Todos os cálculos são feitos automaticamente
   └─ totalAmount, laborTotal, etc sempre atualizados

4️⃣ USUÁRIO CLICA "GERAR OS"
   └─ onSubmit(osItem) executado
   └─ OSPanelAdapter intercepta
   └─ Converte OrderService → CartItem
   └─ setCart(prev => [...prev, osItem])

5️⃣ ESTADO LEGADO SINCRONIZADO
   └─ osItems, osServices, osData limpos
   └─ Volta pra aba 'parts'
   └─ Pronto para nova OS


═══════════════════════════════════════════════════════════════════════════
COMPONENTES CRIADOS
═══════════════════════════════════════════════════════════════════════════

OSPanelRefactored (Novo)
  ├─ OSItemList
  │   └─ Renderiza lista de produtos/serviços
  │   └─ Gerencia quantidade e preço
  ├─ OSForm  
  │   └─ Formulário de configuração (equipamento, bitola, etc)
  ├─ LaborCalculator
  │   └─ Cálculo de mão de obra (3 tipos)
  └─ OSSummary
      └─ Resumo financeiro e botão de confirmar

OSPanelAdapter (Novo)
  └─ Camada de compatibilidade
  └─ Sincroniza OrderService ↔ Estado Legado
  └─ Permite uso de OSPanelRefactored sem quebrar nada


═══════════════════════════════════════════════════════════════════════════
TIPOS DE DADOS (Exemplo Completo)
═══════════════════════════════════════════════════════════════════════════

// Tipo NOVO (Type-safe, sem `any`)
OrderService {
  id: string;                      // UUID
  number: string;                  // 'OS-2026-0001'
  status: 'draft' | 'open' | ...
  customerId: string;              // FK
  items: OSLineItem[];             // Produtos
  services: OSLineItem[];          // Serviços
  labor: LaborCalculation;         // Mão de obra
  totalAmount: number;             // Total calculado
  config: HydraulicAssemblyConfig; // Especificações
  ...
}

// Tipo ANTIGO (ainda suportado para compatibilidade)
CartItem {
  id: string | number;
  name: string;
  price: number;
  quantity: number;
  type: 'product' | 'service' | 'os';  // ← Agora suporta 'os'
  osData?: {
    osId: string;
    osNumber: string;
    items: OSLineItem[];
    services: OSLineItem[];
    config: HydraulicAssemblyConfig;
    labor: LaborCalculation;
    total: number;
  }
  ...
}


═══════════════════════════════════════════════════════════════════════════
COMO USAR OS NOVOS HOOKS (Exemplos)
═══════════════════════════════════════════════════════════════════════════

// EM UM COMPONENTE CUSTOMIZADO:

import { useOrderService } from '@/hooks/useOrderService';
import { calculateTotal } from '@/utils/os-helpers';

function MeuPainel() {
  const { os, addItem, setConfig, setLabor, canFinalize } = 
    useOrderService('customer-123');

  // Adicionar produtoconst handleAdd = () => {
    addItem({
      name: 'Mangueira 1/2"',
      price: 150,
      quantity: 1,
      itemType: 'product'
    });
  };

  // Configurar equipamento
  const handleEquipmentChange = (equipment: string) => {
    setConfig({ equipment });
  };

  // Finalizar
  const handleFinalize = () => {
    if (canFinalize) {
      // Enviar pro server
      api.createOS(os);
    }
  };

  return (
    <div>
      <button onClick={handleAdd}>Adicionar Item</button>
      <input onChange={(e) => handleEquipmentChange(e.target.value)} />
      <p>Total: R$ {os.totalAmount.toLocaleString('pt-BR')}</p>
      <button disabled={!canFinalize} onClick={handleFinalize}>
        Finalizar OS
      </button>
    </div>
  );
}


═══════════════════════════════════════════════════════════════════════════
O QUE AGORA VOCÊ PODE FAZER
═══════════════════════════════════════════════════════════════════════════

✅ Criar múltiplas versões do painel (grid, modal, wizard, etc)
✅ Reutilizar componentes em outras abas
✅ Testar lógica sem React (funções puras)
✅ Integrar com backend em poucos minutos
✅ Adicionar histórico, duplicar, salvar rascunho
✅ Gerar automáticamente vendas a partir de OS
✅ Gerenciar pagamentos parciais
✅ Relatórios e filtros avançados
✅ Múltiplos clientes/técnicos
✅ Sistema de permissões por status


═══════════════════════════════════════════════════════════════════════════
SE ALGO QUEBROU
═══════════════════════════════════════════════════════════════════════════

❌ "OSPanelAdapter não encontrado"
  → Verifique se o arquivo foi criado em:
    src/pages/PDV/components/OSPanelAdapter.tsx

❌ "Type 'os' not assignable to type ItemType"
  → Você atualizou o cart.types.ts?
  → Adicione 'os' ao type ItemType

❌ "useOrderService não funciona"
  → Verifique se customerId é string válido
  → Não pode ser undefined ou null

❌ "Componentes antigos não carregam dados"
  → Use o OSPanelAdapter, não chame OSPanelRefactored direto
  → O adaptador sincroniza contextos


═══════════════════════════════════════════════════════════════════════════
PRÓXIMOS PASSOS
═══════════════════════════════════════════════════════════════════════════

1. ✅ Tipos completos
2. ✅ Hooks com useReducer
3. ✅ Componentes refatorados
4. ✅ Adaptador para compatibilidade
5. → Testar no navegador
6. → Integrar API para salvar
7. → Criar testes unitários
8. → Adicionar validações de negócio
9. → Implementar paginação/filtros
10. → Gerar notas fiscais


═══════════════════════════════════════════════════════════════════════════

Perguntas? Revise:
  - src/ARCHITECTURE.ts (documentação completa)
  - src/types/erp.types.ts (todos os tipos)
  - src/utils/erp-helpers.ts (funções úteis)
  - src/hooks/useOrderService.ts (lógica principal)

*/

export {};
