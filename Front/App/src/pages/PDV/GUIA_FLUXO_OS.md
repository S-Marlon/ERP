# 🛠️ Guia de Fluxo - Ordem de Serviço (OS) no PDV

## 📋 Resumo

Este guia descreve o novo fluxo otimizado para criar e processar Ordens de Serviço (OS) no PDV com melhor validação, feedback e integração com o carrinho.

---

## 🚀 Fluxo Passo a Passo

### 1️⃣ **Abrir Painel de OS**
- No PDV, clique na aba **"OS"**
- O painel de criação de OS será exibido

### 2️⃣ **Configurar Dados da OS**
```
Lado Esquerdo (SIDEBAR):
├─ Identificação da OS (número único gerado automaticamente)
├─ Cliente (ID do cliente)
├─ Técnico responsável
└─ Ações rápidas (Salvar rascunho, Emitir orçamento, etc)

Centro (MAIN):
├─ Equipamento (ex: "Prensa Hidráulica")
├─ Aplicação (ex: "Prensagem de mangueiras")
├─ Bitola (ex: "½ polegada")
└─ Mão de Obra (tipo e valor)

Direita (SUMMARY):
├─ Total de Itens
├─ Total de Serviços
├─ Total da Mão de Obra
└─ Pagamento Antecipado
```

### 3️⃣ **Adicionar Itens (Produtos/Peças)**
1. Clique no botão **"+ Adicionar"** na seção "Itens"
2. O modal **ItemSelectorModal** abrirá
3. **Busque o produto:**
   - Digite na barra de pesquisa (SKU, EAN ou nome)
   - Ou selecione uma categoria
   - Os resultados carregam dinamicamente
4. **Selecione a quantidade:**
   - Use os botões + e - para ajustar
   - Ou digite diretamente o valor
5. Clique em **"✓ Adicionar"**
6. Um toast de confirmação aparecerá
7. O item será listado na seção "Itens"

**Validações Aplicadas:**
- ✅ Quantidade deve ser > 0
- ✅ Não permite quantidade maior que o estoque
- ✅ Impede adicionar itens sem estoque

### 4️⃣ **Adicionar Serviços**
Mesmo processo dos itens:
1. Clique em **"+ Adicionar"** na seção "Serviços"
2. Busque o serviço no modal
3. Configure a quantidade
4. Clique em **"✓ Adicionar"**

### 5️⃣ **Gerenciar Itens/Serviços**

Cada item adicionado exibe:
```
[1] Nome do Produto
    SKU: ABC123 | Estoque: 50 un
    [-] [2.00] [+]   R$ 100,00   [✕]
```

**Opções:**
- **Aumentar/Diminuir Quantidade:** Use os botões - e +
- **Editar Quantidade:** Clique no campo e digite
- **Remover:** Clique no botão ✕

### 6️⃣ **Configurar Mão de Obra**

Na seção "Mão de Obra":
1. Escolha o tipo:
   - **Fixo:** Valor fixo independente de itens
   - **Por ponto:** Valor multiplicado por quantidade de pontos
   - **Tabela:** Baseado em tabela de valores
2. Defina o valor
3. O total recalcula automaticamente

### 7️⃣ **Gerar Venda da OS**

1. Clique no botão **"💰 Gerar Venda"** (seção "Fechamento da OS")
2. O sistema validará:
   ✅ Dados básicos preenchidos (Equipamento, Bitola)
   ✅ Pelo menos um item/serviço (ou permite apenas MO)
   ✅ Mão de obra configurada
3. **Resumo será exibido:**
   ```
   OS: OS-000123
   Equipamento: Prensa Hidráulica
   Itens: 3
   Serviços: 1
   ─────────────────
   Total: R$ 1.500,00
   Pago: R$ 0,00 | Restante: R$ 1.500,00
   ```
4. Escolha:
   - **"Gerar venda"** → Confirma e adiciona ao carrinho
   - **"Revisar"** → Volta para editar

### 8️⃣ **Carrinho (CartAside)**

Após gerar a OS:
1. Você será redirecionado para o carrinho
2. A OS aparecerá como um item especial:
   ```
   🛠️ Ordem de Serviço (1)
   ┌─────────────────────────────────┐
   │ Prensa Hidráulica • ½ polegada  │
   │ 3 itens • 1 serviço             │
   │ Ref: OS-000123                  │
   │                                 │
   │ Produtos: R$ 1.000,00           │
   │ MO: R$ 500,00                   │
   │ Total: R$ 1.500,00      [✕]     │
   └─────────────────────────────────┘
   ```
3. Você pode:
   - Ver detalhes da OS
   - Aplicar desconto geral
   - Registrar pagamento
   - Continuar adicionando itens/serviços

---

## 🎯 Recursos Principais

### ✨ ItemSelectorModal
- **Busca em tempo real** com debounce
- **Filtro por categoria** dinâmico
- **Visualização de estoque** com aviso de baixa quantidade
- **Grid responsivo** de produtos
- **Feedback visual** com imagens e preços

### 🔒 Validações
- ❌ Quantidade inválida → Aviso e bloqueio
- ❌ Sem estoque → Botão desabilitado
- ❌ Dados incompletos na OS → Popup com instruções
- ❌ Sem itens → Permite continuar apenas com MO

### 📊 Feedback Visual
- 🟢 **Toast de sucesso** ao adicionar itens
- 🟠 **Aviso** para validações importantes
- 🔴 **Erro** para operações críticas
- 💡 **Informações** em modais com contexto

### 💾 Persistência
- OS número gerado automaticamente
- Dados salvos no componente (não perdidos ao navegar abas)
- Integração com CartAside para carrinho principal

---

## 🐛 Troubleshooting

| Problema | Solução |
|----------|---------|
| Modal não abre | Verifique se ItemSelectorModal está importado |
| Produtos não carregam | Verifique conexão com API `getPdvProducts` |
| Quantidade não aumenta | Valide limite de estoque |
| OS não vai para carrinho | Confirm que `onSubmit` callback está passado |
| Estilos diferentes | Verifique se CSS modules estão linkados |

---

## 📦 Dependências Necessárias

```
✅ react
✅ sweetalert2 (para modais de confirmação)
✅ CSS modules (ItemSelectorModal.module.css, OSPanelRefactored.module.css)
✅ API services (getPdvProducts, getPdvCategories)
```

---

## 🔄 Integração com Contexto PDV

```typescript
// No PDV.tsx - ao chamar OSPanelRefactored:
<OSPanelRefactored
  customerId={id}
  onSubmit={(osItem) => {
    addToCart(osItem); // Adiciona ao carrinho principal
  }}
  onCancel={() => setScreen('pdv')}
  money={money}
  setActiveTab={setScreen}
/>
```

---

## 📝 Próximas Melhorias

- [ ] Salvamento automático de rascunhos
- [ ] Histórico de OS criadas
- [ ] Edição de OS já gerada
- [ ] Geração de PDF da OS
- [ ] Integração com sistema de agendamento
- [ ] Relatórios de OS por técnico
- [ ] Sincronização em tempo real com backend

---

## 📞 Suporte

Para dúvidas ou bugs, verifique:
1. Console do navegador (F12)
2. Network tab para erros de API
3. Logs do backend
4. Arquivo de tipos (cart.types.ts)

---

**Última atualização:** 25 de Abril de 2026
**Versão:** 2.0 - Fluxo otimizado com ItemSelectorModal
