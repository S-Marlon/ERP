Perfeito! Vou criar um **README.md detalhado** explicando o fluxo de estoque, decomposição de produtos, venda do derivado ou do conjunto, e como o modal deve funcionar. Vou organizar de forma clara para você seguir no desenvolvimento.

---

# 📦 Stock Decomposition & Dual Sale Flow

Este módulo lida com produtos fracionáveis, onde um **produto principal** (ex: caixa ou rolo) pode gerar um **produto derivado** (ex: unidade ou metro/kg). Ele permite visualizar, editar e vender ambos os tipos de produtos de forma integrada.

---

## 1️⃣ Objetivo

* Permitir que produtos fracionáveis sejam tratados corretamente no estoque e vendas.
* Criar automaticamente produtos derivados a partir do produto principal.
* Dar ao vendedor a opção de vender:

  * Apenas o derivado (unidade/fracionado) – padrão.
  * O produto completo (caixa/rolo) – mantendo GTIN e SKU do principal.

---

## 2️⃣ Conceitos

| Tipo      | Nome               | GTIN                | SKU      | Unidade de venda | Observações                                                                |
| --------- | ------------------ | ------------------- | -------- | ---------------- | -------------------------------------------------------------------------- |
| Principal | Produto da NF      | Original            | Original | Caixa/Rolo       | Mantido no sistema, estoque controlado por caixas/rolos                    |
| Derivado  | Produto fracionado | Igual ou modificado | Derivado | Unidade/Metro/Kg | Criado automaticamente, estoque fracionado, pode ser vendido separadamente |

---

## 3️⃣ Fluxo do Usuário

1. **Entrada de NF / Estoque**

   * Vendedor adiciona produto na nota fiscal.
   * Sistema detecta se o produto é fracionável.
   * Modal de decomposição é aberto automaticamente para:

     * Informar quantidade a fracionar (slider).
     * Editar nome, SKU e GTIN do derivado.
     * Mostrar resumo do produto principal e derivado.

2. **Modal de Fracionamento**

   * Lado esquerdo: **Produto principal**

     * Nome original
     * GTIN e SKU do principal
     * Quantidade da NF
   * Lado direito: **Produto derivado**

     * Nome sugerido (editável)
     * SKU derivado (editável)
     * GTIN derivado (igual ou editável)
     * Quantidade derivada calculada pelo slider
   * Slider para selecionar quantas caixas/rolos fracionar.
   * Confirmar cria o derivado no sistema e vincula ao principal.

3. **Venda no PDV**

   * Ao bipa o produto, aparecem **dois produtos**:

     1. Derivado (padrão) – unidade fracionada.
     2. Principal – caixa/rolo completo.
   * Usuário pode escolher:

     * Vender apenas o derivado.
     * Vender a caixa/rolo inteira (GTIN e SKU do principal).
   * Estoque é atualizado corretamente.

---

## 4️⃣ Regras de Negócio

* **Sempre criar derivado** quando produto for fracionável.
* **GTIN e SKU do derivado:**

  * Por padrão, igual ao principal.
  * Para caixas → unidade, vendedor pode inserir um novo GTIN e SKU derivado.
* **Nome do derivado:**

  * Sugestão: remover medida total do nome do produto principal.
  * Editável pelo usuário.
* **Custo unitário do derivado:**

  * Calculado automaticamente: `custo total / (quantidade NF * itens por embalagem)`.
* **Estoque final derivado:** calculado com base no slider.

---

## 5️⃣ Estrutura do Modal

* **Componentes**

  * `StockDecomposition` – componente principal, dispara o modal.
  * `showDecompositionModal` – abre modal com SweetAlert2.
  * `DecompositionContent` – conteúdo do modal, inputs para derivado.
  * `ProgressBar` – barra visual mostrando proporção do estoque.
* **Inputs principais no modal**

  * Produto principal: read-only, GTIN e SKU fixos
  * Produto derivado: editáveis (nome, SKU, GTIN)
  * Slider para fracionamento
  * Visualização de custo e unidades
* **Confirmar**

  * Chama função `onConfirm(derivedQuantity, derivedName, derivedSku, derivedGtin)`

---

## 6️⃣ Exemplo de Uso

```tsx
<StockDecomposition
  value={decompositionData}
  onChange={setDecompositionData}
  nfQuantity={5}
  productName="CORDA POL.FIRMEZA CARR.COR 8MM/240M"
  costTotal={1500}
/>

// Ao criar derivado:
showDecompositionModal({
  productName: "CORDA POL.FIRMEZA CARR.COR 8MM/240M",
  nfQuantity: 5,
  unitsPerPackage: 1,
  baseUnit: "UN",
  derivedName: "CORDA POL.FIRMEZA CARR.COR 8MM",
  derivedSku: "386880d1",
  derivedGtin: "7898393921520",
  costTotal: 1500,
  onConfirm: (qty, name, sku, gtin) => {
    console.log("Derivado criado:", qty, name, sku, gtin);
  }
});
```

---

## 7️⃣ Fluxo Visual do PDV

```
[Produto BIPADO] -> Sistema mostra:
1️⃣ Derivado (padrão) -> vender unidade fracionada
2️⃣ Caixa/Rolo (opçãozinha) -> vender conjunto
```

* Checkbox ou botão para “Vender Caixa/Rolo Inteiro”
* Atualiza estoque do derivado e principal automaticamente
* Mantém rastreabilidade de GTIN/SKU

---

## 8️⃣ Observações Técnicas

* **Sempre criar produto derivado** mesmo que não fracionado (para padronização de nomes e SKUs)
* **Estoque:** derivado e principal separados, mas vinculados
* **GTIN/SKU:** respeitar integridade fiscal e rastreabilidade
* **Modal:** SweetAlert2 + ReactContent para inputs dinâmicos

---

Se você quiser, posso criar **uma versão completa do modal já pronta em React/TypeScript** seguindo exatamente esse fluxo, pronta para integrar no PDV e na entrada de NF.

Quer que eu faça isso agora?
