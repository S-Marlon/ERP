# 🔗 Guia de Integração - Tela de Notas Fiscais

## Como Integrar a Tela de Notas no Projeto

### 1️⃣ Importar o Componente

#### Opção A: Import Direto
```typescript
import Notas from './pages/Estoque/pages/notas/Notas';
```

#### Opção B: Import via Index (Recomendado)
```typescript
import { Notas } from './pages/Estoque/pages/notas';
```

### 2️⃣ Usar no Roteamento

Se você está usando React Router, adicione a rota:

```typescript
// src/App.tsx ou seu arquivo de rotas
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Notas } from './pages/Estoque/pages/notas';

function App() {
  return (
    <Router>
      <Routes>
        {/* ... outras rotas */}
        <Route path="/estoque/notas" element={<Notas />} />
      </Routes>
    </Router>
  );
}
```

### 3️⃣ Adicionar Link de Navegação

Adicione um link no menu ou barra lateral:

```typescript
// Layout/AppSidebar ou menu
<Link to="/estoque/notas">
  📋 Notas Fiscais
</Link>
```

### 4️⃣ Estrutura de Pastas Esperada

```
src/
├── pages/
│   └── Estoque/
│       ├── api/
│       │   └── productsApi.ts (✅ Já atualizado)
│       ├── pages/
│       │   └── notas/
│       │       ├── components/
│       │       │   ├── NotasDetailModal.tsx
│       │       │   ├── NotasExport.tsx
│       │       │   ├── NotasStats.tsx
│       │       │   └── SupplierSearch.tsx
│       │       ├── Notas.tsx (✅ Principal)
│       │       ├── index.ts (✅ Exports)
│       │       ├── README.md (✅ Documentação)
│       │       └── TECNICO.md (✅ Docs técnicas)
│       └── ... (outros componentes)
```

### 5️⃣ Variáveis de Ambiente

Certifique-se de que tem no seu `.env`:

```env
VITE_API_BASE=http://localhost:3001/api
```

A tela usar automaticamente esta URL para as requisições.

### 6️⃣ Dependências Necessárias

A tela depende de componentes que já existem no projeto:

- ✅ `components/ui/Badge/Badge`
- ✅ `components/ui/Button/Button`
- ✅ `components/ui/FormControl/FormControl`
- ✅ `components/ui/Typography/Typography`
- ✅ `components/Layout/FlexGridContainer/FlexGridContainer`

Se algum estiver faltando, os imports falharão. Nesse caso, adapte os nomes conforme seu projeto.

### 7️⃣ Extensão: Adicionar Aba ao Estoque

Se você quer adicionar a tela como uma aba dentro do módulo Estoque (como em um dashboard):

```typescript
// src/pages/Estoque/Estoque.tsx (se houver um arquivo assim)
import { useState } from 'react';
import { Notas } from './pages/notas';
import TabsContainer from '../components/ui/TabsContainer/TabsContainer';

export default function EstoqueModule() {
  const [activeTab, setActiveTab] = useState('entry');

  return (
    <div>
      <TabsContainer
        tabs={[
          { id: 'entry', label: 'Entrada de Estoque', content: <StockEntry /> },
          { id: 'notas', label: 'Notas Fiscais', content: <Notas /> },
          // ... outras abas
        ]}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />
    </div>
  );
}
```

## Checklist de Integração

- [ ] Importar o componente Notas
- [ ] Adicionar rota em React Router
- [ ] Adicionar link de navegação
- [ ] Verificar `.env` com VITE_API_BASE
- [ ] Testar carregamento da página
- [ ] Testar busca de notas
- [ ] Testar visualização de detalhes
- [ ] Testar exportação CSV
- [ ] Testar impressão

## Troubleshooting de Integração

### Erro: "Cannot find module"
**Solução**: Verifique se o caminho do import está correto relativo ao arquivo atual

### Erro: "Component not found"
**Solução**: Certifique-se de que o export está no arquivo `index.ts`

### API retorna 404
**Solução**: Verifique se o backend tem os endpoints `/api/stock-entry` e `/api/stock-entry/{id}`

### Componentes UI não renderizam
**Solução**: Verifique se os componentes que a tela importa existem no seu projeto

## Debugging

### Verificar se a tela carregou
```javascript
// No console do navegador
window.location.href = '/estoque/notas'
```

### Verificar requisições
```javascript
// No DevTools (Network tab)
// Procure por requisições para /api/stock-entry
```

### Verificar estado da tela
```javascript
// Adicionar logs no Notas.tsx
console.log('Notes:', notes);
console.log('Loading:', loading);
console.log('Error:', error);
```

## Próximas Etapas

Após integrar com sucesso:

1. **Backend**: Implementar os endpoints necesários
2. **Testes**: Executar testes com dados reais
3. **Performance**: Monitorar e otimizar se necessário
4. **Melhorias**: Adicionar features sugeridas no README.md

## Suporte

Se encontrar problemas:

1. Verifique o TECNICO.md para detalhes da arquitetura
2. Revise os tipos de dados em StockEntryNote
3. Confirme que a API retorna os campos esperados
4. Verifique a console do navegador para erros
5. Use React DevTools para inspeccionar o estado

---

**Arquivo criado em**: March 17, 2026  
**Versão**: 1.0  
**Status**: Pronto para integração
