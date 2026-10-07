# ⚡ QUICKSTART - Tela de Notas Fiscais

## 🚀 Começar em 5 Minutos

### 1️⃣ Instalar a Tela (30 segundos)
```typescript
// Já está criada em:
src/pages/Estoque/pages/notas/
```

### 2️⃣ Importar em Seu Código (2 minutos)
```typescript
// App.tsx ou seu arquivo de rotas
import { Notas } from './pages/Estoque/pages/notas';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/estoque/notas" element={<Notas />} />
      </Routes>
    </BrowserRouter>
  );
}
```

### 3️⃣ Implementar 2 Endpoints (tempo variável)
```typescript
// Backend (Node.js/Express)

// 1. Listar notas
GET /api/stock-entry?supplierCnpj=xxx&invoiceNumber=xxx&startDate=xxx&endDate=xxx
// Retorna: Array de StockEntryNote

// 2. Detalhes de uma nota
GET /api/stock-entry/{noteId}
// Retorna: StockEntryNote com items []
```

### 4️⃣ Testes Locais
```bash
# Acessar a página
http://localhost:5173/estoque/notas

# Verificar console para erros
F12 → Console → Procure por erros
```

---

## 📋 Estrutura Rápida

```
📁 notas/
├── 📄 Notas.tsx                    ← Tela principal
├── 📁 components/                  ← Componentes auxiliares
│   ├── NotasDetailModal.tsx        ← Modal de detalhes
│   ├── NotasStats.tsx              ← Estatísticas
│   └── NotasExport.tsx             ← Download/Impressão
├── 📄 index.ts                     ← Exports
└── 📚 README.md, TECNICO.md, etc   ← Documentação
```

---

## 🔌 Especificação de API (Essencial)

### Formato de Resposta - GET /api/stock-entry

```json
[
  {
    "id": 1,
    "invoiceNumber": "NF 001",
    "accessKey": "1234567890123456789012345678901234567890123456",
    "entryDate": "2026-03-17",
    "supplierCnpj": "12.345.678/0001-90",
    "supplierName": "Empresa LTDA",
    "totalFreight": 500,
    "totalIpi": 1200,
    "totalIcmsST": 500,
    "totalIBS": 100,
    "totalCBS": 50,
    "totalOtherExpenses": 100,
    "totalNoteValue": 14100,
    "itemsCount": 10
  }
]
```

### Formato de Resposta - GET /api/stock-entry/1

```json
{
  "id": 1,
  "invoiceNumber": "NF 001",
  "accessKey": "1234567890123456789012345678901234567890123456",
  "entryDate": "2026-03-17",
  "supplierCnpj": "12.345.678/0001-90",
  "supplierName": "Empresa LTDA",
  "totalFreight": 500,
  "totalIpi": 1200,
  "totalNoteValue": 14100,
  "items": [
    {
      "id": 1,
      "codigoInterno": "001",
      "skuFornecedor": "ABC",
      "quantidadeRecebida": 10,
      "unidade": "UN",
      "custoUnitario": 1000,
      "ncm": "1234567890"
    }
  ]
}
```

---

## 🧪 Testar com Dados Fictícios

Se não tiver backend pronto, use dados mockados:

```typescript
// Em Notas.tsx, substitua loadNotes():
const mockData = [
  {
    id: 1,
    invoiceNumber: 'NF 001',
    accessKey: '12345678901234567890123456789012345678901234',
    entryDate: '2026-03-17',
    supplierCnpj: '12.345.678/0001-90',
    supplierName: 'Empresa LTDA',
    totalFreight: 500,
    totalIpi: 1200,
    totalNoteValue: 14100,
    itemsCount: 10,
  }
];
setNotes(mockData);
```

---

## 🎯 Funcionalidades Base

| Funcionalidade | Status |
|---|---|
| 📋 Listar notas | ✅ Pronto |
| 🔍 Filtrar por período | ✅ Pronto |
| 🔍 Filtrar por fornecedor | ✅ Pronto |
| 👁️ Ver detalhes | ✅ Pronto |
| 📊 Estatísticas | ✅ Pronto |
| 📥 Exportar CSV | ✅ Pronto |
| 🖨️ Imprimir | ✅ Pronto |

---

## ⚠️ Erros Comuns

| Erro | Solução |
|---|---|
| "Cannot find module" | Verificar import path |
| Nenhuma nota aparece | API não retornando dados |
| Modal não abre | Verificar console para erros |
| Exportação vazia | Tabela sem dados |

---

## 📚 Ler Mais

- 📖 **README.md** - Documentação completa
- 🔧 **TECNICO.md** - Para desenvolvedores
- 🔗 **INTEGRACAO.md** - Integração passo a passo
- 👀 **OVERVIEW.md** - Visão geral com diagrama

---

## 💡 Dicas de Produção

1. ✅ Implementar paginação para >1000 notas
2. ✅ Adicionar cache/índices no banco
3. ✅ Rate limiting na API
4. ✅ Validação de entrada do usuário
5. ✅ Testes com dados reais

---

## ✉️ Suporte Rápido

**Erro de API?** → Verifique TECNICO.md, seção "Endpoints da API"

**Não sabe integrar?** → Siga INTEGRACAO.md passo a passo

**Quer estender?** → Leia o código em Notas.tsx (bem comentado)

---

**Criado**: 17/03/2026 | **Versão**: 1.0 | **Status**: ✅ Pronto

→ Próximo passo: Implementar backend e acessar /estoque/notas
