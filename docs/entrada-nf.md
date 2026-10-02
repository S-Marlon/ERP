# Entrada de mercadorias por NF-e

Como uma nota fiscal de compra vira estoque e cadastro no ERP: as etapas, as regras e as tabelas do banco que cada etapa lê e grava.

> Regra de ouro: **o estoque só muda na aprovação** do lote. Até lá, tudo fica na *staging* (área de rascunho) e pode ser refeito à vontade.

---

## 1. Visão geral

```
 XML da NF-e
     │
     ▼
 [1] Leitura do XML ──────────────► importacoes_lotes (RASCUNHO)
     │                                importacao_produtos_staging (1 linha por item da NF)
     ▼
 [2] Conferência (tela Entrada de Mercadorias)
     │  vincular / cadastrar item, tipo, destino, quantidade, frete, GTIN
     │  cada alteração regrava a linha na staging
     ▼
 [3] Revisão final + pente-fino (só leitura; bloqueios impedem aprovar)
     │
     ▼
 [4] APROVAÇÃO (transação única) ─► catálogo, preços, atributos, estoque, vínculos
     │                                importacoes_lotes = IMPORTADO
     ▼
 [5] Depois da entrada
        • Notas de Entrada: auditoria e correção de linha (vínculo/conversão)
        • Pendências do PIM: completar cadastro dos itens
        • Itens duplicados: unificar
```

Telas (menu):

| Tela | Rota | Para quê |
|---|---|---|
| Entrada de Mercadorias | `/compras/entrada-nfe` (também `/estoque/gerenciamento`) | ler o XML, conferir, revisar e aprovar |
| Notas de Entrada | `/compras/notas` | histórico das notas, detalhe, alertas e correção |
| Staging (aprovação) | `/stagings` | lista de lotes; também aprova (mesma regra) |
| Pendências do PIM | `/catalogo/pendencias` | itens com cadastro incompleto (`?lote=` filtra uma nota) |
| Itens duplicados | `/catalogo/duplicados` | suspeitas e unificação |

---

## 2. Etapa 1 — Leitura do XML

- O XML é lido no navegador (`StockEntry/xml/utils/nfeParser.ts` → `parseNfeComplete`): emitente, destinatário, `ide` (modelo, tpEmis, procEmi, tpAmb), protocolo de autorização (`protNFe`: cStat, xMotivo, nProt), transporte, cobrança, totais e itens.
- A nota vira um **lote** e cada item uma **linha de staging**: `POST /api/compras/lotes/sincronizar-xml` (upsert pela chave de acesso e pelo número do item `item_nfe_seq`).
- Reabrir a mesma chave retoma a conferência de onde parou (`GET /api/compras/lotes/chave/:chave/estado`).
- **Reconhecimento automático**: linhas sem vínculo recebem uma sugestão pelo código do produto no fornecedor (notas anteriores) ou pelo GTIN — `POST /api/compras/sugestoes-vinculo`. A sugestão ainda precisa ser conferida.
- **Fornecedor**: o card do fornecedor verifica o CNPJ; se não existir, o botão *Cadastrar* cria o fornecedor (sem fornecedor a aprovação é bloqueada).

| Tabela | Operação |
|---|---|
| `importacoes_lotes` | INSERT/UPDATE — cabeçalho, `dados_nota_fiscal` (XML convertido em JSON), frete adicional, status `RASCUNHO` |
| `importacao_produtos_staging` | INSERT/UPDATE — uma linha por item da NF |
| `comercial_fornecedores_produtos`, `comercial_unidades_venda` | leitura (sugestão de vínculo) |
| `pessoas_core`, `pessoas_pj`, `pessoas_enderecos`, `pessoas_papeis_atribuido` | INSERT — só se cadastrar o fornecedor pela tela |

---

## 3. Etapa 2 — Conferência

Tudo o que se decide aqui fica em `importacao_produtos_staging` (colunas próprias + o JSON `mapeamento_json`).

### 3.1 Vínculo de cada linha (modal de mapeamento)

| Opção | O que acontece na aprovação |
|---|---|
| **Vincular a item do catálogo** | a entrada soma ao estoque do item existente |
| **Cadastrar item novo** | o item é criado no catálogo na aprovação |
| **Cadastro rápido (lote)** | várias linhas viram itens novos com os dados da nota e um markup único |

Item novo:

- **Nome do item** = descrição da nota (travado). **Nome comercial** começa igual e é editável.
- **SKU Customizado** = código que aparece no catálogo/PDV, **único**. Padrão: código do fornecedor (venda) ou vazio (consumo/patrimônio). **Vazio = sequência gerada na aprovação** (`IT-000123`, `CON-000123`, `ATV-000123`).
- **SKU raiz** (`itens_core.sku`) é sempre gerado pelo sistema: `IT-` + id. Não é editável.
- **Chave da linha** (`sku_sugerido`/`sku_interno` = `LINHA-n`): só identifica a linha na staging; **nunca vira SKU**.
- **Classificação no PIM** (opcional): família (que já traz a categoria) ou só categoria, e, se quiser, os **valores dos atributos**. Faltando obrigatório, o item entra no estoque mas fica fora do PDV até completar (ver Pendências do PIM).
- **Preço**: unidades de venda e faixas (varejo/atacado) sobre o **custo base**. Item fora da venda não tem preço.

### 3.2 Conversão e custo

- `1 unidade da NF = fator × unidade base do item` (ex.: 1 CX = 12 UN).
- **Custo final por unidade da NF** = custo da nota + IPI + frete/ST/outros rateados.
- **Custo base** = custo final ÷ fator. É o custo de entrada no estoque e a base do markup.
- **Frete**: o da nota (vFrete) + o **frete adicional** pago à parte (Correios, carreto), rateado nos itens pelo modo escolhido (original do XML, proporcional ao valor, à quantidade ou igual).

### 3.3 Tipo de entrada e destino (depósito)

| Tipo de entrada | Depósito | Observação |
|---|---|---|
| Produto / Revenda | **VENDA** | pode separar parte para uso interno (ex.: 30 graxas = 20 venda + 10 almoxarifado) |
| Consumo Interno / Insumo | **ALMOXARIFADO** | fixo |
| Ativo / Imobilizado | **PATRIMONIO** | fixo |

- Só o depósito **VENDA** aparece no PDV.
- Mudar o tipo devolve o destino ao depósito do novo tipo.
- Produto inteiro no almoxarifado não é aceito (use o tipo Consumo).

### 3.4 Conferência

- Cada linha precisa ser **conferida** (quantidade recebida; divergência da NF é permitida e entra a recebida).
- Qualquer alteração desfaz a conferência da linha.
- GTIN pode ser corrigido/bipado (`gtin_manual`).

| Tabela | Operação |
|---|---|
| `importacao_produtos_staging` | UPDATE a cada alteração (vínculo, tipo, destino, quantidade, conferência, frete rateado) |
| `importacoes_lotes` | UPDATE — frete adicional e modo de rateio |
| `itens_core`, `comercial_produtos_dados`, `atributos_core_entidades`, `comercial_familias`, `comercial_categorias`, `atributos_comercial*` | leitura (busca do catálogo, famílias, atributos) |

### Conteúdo do `mapeamento_json`

```jsonc
{
  "mode": "EXISTING_DIRECT" | "DRAFT",
  "existingProductId": 52, "existingProduct": { "sku": "...", "nome": "...", "tipo_recurso": "PRODUTO" },
  "conversaoCompra": { "unidade_compra": "CX", "unidade_base": "UN", "fator": 12 },
  "draftIdentity": {                     // só item novo
    "tipo_recurso": "PRODUTO", "nome_interno": "...", "nome_comercial": "...",
    "sku_interno": "LINHA-3", "sku_comercial": "GRX-1",
    "familia_id": 7, "categoria_id": null, "atributos": { "23": 10, "17": 1.5 }
  },
  "configVendas": { "unidades": [...], "faixas": [...], "custo_gerencial": 1.0 },  // item novo de venda
  "tipo_recurso": "PRODUTO",
  "destinos": [{ "deposito": "VENDA", "quantidade": 20 }, { "deposito": "ALMOXARIFADO", "quantidade": 10 }],
  "gtin_manual": "7891234567895"
}
```

---

## 4. Etapa 3 — Revisão final e pente-fino

Botão **Revisar e dar entrada** (habilita quando todas as linhas estão conferidas). Abre a revisão **somente leitura**: números da entrada, valor por depósito, linha a linha (vínculo/novo, SKU, tipo/destino, quantidade e conversão, custos) e o **pente-fino** do servidor (`GET /api/compras/lotes/:loteId/analise`).

**Bloqueios** (impedem aprovar):

| Código | Quando |
|---|---|
| `LOTE_FINALIZADO` | lote já importado ou descartado |
| `SEM_ITENS` | lote sem linhas |
| `ITEM_SEM_VINCULO` | linha sem vínculo nem cadastro novo |
| `ITEM_NOVO_SEM_NOME` | item novo sem nome |
| `ITEM_NAO_CONFERIDO` | linha não conferida |
| `PRODUTO_INEXISTENTE` | vinculado a item que não existe mais |
| `SKU_JA_EXISTE` | SKU customizado já existe no catálogo (raiz ou customizado) |
| `SKU_RESERVADO` | SKU digitado no formato das sequências (`IT-`/`CON-`/`ATV-`/`TMP-` + número) |
| `SKU_REPETIDO_NA_NOTA` | dois itens novos da nota com o mesmo SKU |
| `DESTINO_INVALIDO` | divisão entre depósitos não soma a quantidade recebida |
| `DESTINO_INCOMPATIVEL` | destino não combina com o tipo de entrada |
| `CUSTO_INVALIDO` | custo unitário zerado |
| `FATOR_INVALIDO` | fator de conversão ≤ 0 |
| `CONFIG_VENDAS_INCOERENTE` | preço do item novo não bate com a conversão |
| `FORNECEDOR_NAO_CADASTRADO` | fornecedor da NF não cadastrado |

**Avisos** (não impedem): `GTIN_INVALIDO`, `GTIN_EM_USO`, `SEM_GTIN`, `CONVERSAO_UNIDADE`, `DIVERGENCIA_QUANTIDADE`, `QUANTIDADE_ZERO`, `FORA_DA_VENDA`, `TOTAL_DIVERGENTE`.

Regras em `Backend/src/routes/Compras/staging/penteFino.ts` (com testes). O mesmo pente-fino roda de novo dentro da aprovação.

---

## 5. Etapa 4 — Aprovação

`POST /api/compras/lotes/:loteId/aprovar` — **uma transação**; qualquer erro desfaz tudo. Mesma aprovação usada pela revisão final e pela tela de Staging (`stagingLoteController.aprovarLote`).

Para cada linha da staging:

1. **Item novo** (`mode = DRAFT`):
   - `itens_core`: cria com SKU provisório `TMP-{lote}-{linha}` e troca por `IT-` + id; unidade base em `itens_unidades_medida` (cria a sigla se não existir).
   - `comercial_produtos_dados`: SKU customizado (digitado ou sequência), nome comercial, **custo gerencial = custo base desta entrada**, família/categoria; marca da família quando ela é DNA da família.
   - `atributos_comercial_valores`: valores informados (só os da família/categoria; DNA fixo é ignorado; valor inválido para o tipo bloqueia com mensagem).
   - `comercial_unidades_venda` + `comercial_precos_faixas`: unidades de venda e faixas, recalculadas pelo custo final da aprovação.
2. **Item vinculado** (`mode = EXISTING_DIRECT`): usa o tipo do item do catálogo; se o item não tem unidade base, assume a da conversão.
3. **Dados fiscais**: `itens_dados_fiscais` recebe NCM/CEST da nota sem sobrescrever o que já existe.
4. **Embalagem de compra**: se a unidade da NF ≠ base, `itens_unidades_conversao` (ex.: 1 CX = 12 UN).
5. **GTIN** (manual ou do XML, válido e livre): `comercial_unidades_venda` na unidade de compra.
6. **Estoque**, por depósito de destino, na unidade base, pelo custo base (`EstoqueItens/depositos.ts → lancarMovimentoEstoque`):
   - `estoque_movimentos`: origem `ENTRADA_NFE`, `id_origem` = lote, `id_origem_item` = linha da staging;
   - `estoque_saldos_itens`: saldo, **custo médio** recalculado e último custo, por depósito.
7. **Vínculo item × fornecedor**: `comercial_fornecedores_produtos` (código do fornecedor, unidade/fator de compra, último preço) — é o que faz as próximas notas reconhecerem o item.
8. **Linha da staging**: `status = IMPORTADO`, `produto_id_sistema` e `sku_sistema` (SKU criado/vinculado).

No fim: `importacoes_lotes.status = IMPORTADO` + `resumo_conferencia` (resumo, avisos, data). Itens vinculados cujo custo ficou diferente do custo gerencial são contados como **custo defasado** (o preço não muda sozinho; o gestor decide na tela de preços).

Depois da aprovação a tela consulta as **Pendências do PIM** do lote e avisa se algum item ficou com cadastro incompleto.

Descartar o lote (`DELETE /api/compras/lotes/:loteId`): `importacoes_lotes.status = DESCARTADO`, linhas `REJEITADO`. Não mexe em estoque.

---

## 6. Etapa 5 — Depois da entrada

### 6.1 Auditoria (Notas de Entrada → detalhe)

`GET /api/compras/notas/:loteId` traz, por linha aprovada, **alertas** de entrada suspeita (`Compras/staging/auditoriaEntrada.ts`):

| Alerta | Regra |
|---|---|
| Custo fora do padrão | custo base ≥ 60% acima ou ≤ 40% abaixo da mediana das últimas compras do item (ou do custo gerencial). Típico de fator errado (caixa lançada como unidade) ou vínculo errado |
| Código já usado em outro item | o mesmo código do fornecedor entrou como outro SKU em outra nota (duplicado ou vínculo errado) |
| GTIN diferente do item | GTIN da nota não é nenhum dos GTINs do item |

### 6.2 Correção de linha já aprovada

Botão **Corrigir** na linha: escolhe o item certo (ou o mesmo) e o fator; **Simular** mostra os movimentos antes de gravar. `POST /api/compras/notas/:loteId/itens/:idStaging/correcao` (`{ idItemNovo, fator, motivo, inativarAnterior?, simular? }`):

1. Calcula o que a linha tem hoje no estoque (entrada original + correções anteriores).
2. **Entrada** no item certo (origem `CORRECAO_NFE_ENTRADA`), pelo custo da nota ÷ fator novo.
3. **Estorno** do item errado (origem `CORRECAO_NFE_ESTORNO`), desfazendo o custo médio. **Sem saldo (já vendido) → bloqueia**; ajuste por inventário antes.
4. Vínculo do fornecedor e GTIN passam para o item certo; unidade derivada de compra se precisar.
5. Linha da staging passa a apontar para o item certo; histórico em `importacao_correcoes`.
6. Opcional: inativa o item errado se ficou sem saldo e sem outro uso.

| Tabela | Operação |
|---|---|
| `importacao_correcoes` | INSERT (antes/depois em `detalhes_json`) |
| `estoque_movimentos`, `estoque_saldos_itens` | entrada no certo, estorno no errado (`id_origem_item` = id da correção) |
| `comercial_fornecedores_produtos` | upsert no certo; remove do errado se nenhuma outra nota usou |
| `comercial_unidades_venda`, `itens_unidades_conversao`, `itens_unidades_medida` | GTIN e embalagem de compra |
| `importacao_produtos_staging` | `produto_id_sistema`, `sku_sistema`, `mapeamento_json` |
| `itens_core` | `status = INATIVO` (opcional) |

### 6.3 Itens duplicados

`GET /api/catalogo/itens/duplicados`: suspeitas por **mesmo código de fornecedor em itens diferentes** ou **nome igual normalizado** (acentos, caixa, `[NOVO]`, ordem das palavras). *Não é duplicado* dispensa a suspeita (guardado no navegador).

**Juntar** (`POST /api/catalogo/itens/unificar`, `{ idOrigem, idDestino, fator, motivo, simular? }`): saldo de cada depósito passa pelo custo médio convertido (origens `UNIFICACAO_ENTRADA`/`UNIFICACAO_SAIDA`), vínculos de fornecedor e GTINs vão para o item que fica, o duplicado é inativado. Vendas e notas antigas continuam no histórico do original.

| Tabela | Operação |
|---|---|
| `itens_core_unificacoes` | INSERT (saldos, vínculos e GTINs movidos em `detalhes_json`) |
| `estoque_movimentos`, `estoque_saldos_itens` | saída do duplicado, entrada no que fica |
| `comercial_fornecedores_produtos` | move para o que fica (fator de compra convertido) |
| `comercial_unidades_venda` | move os GTINs |
| `itens_core` | duplicado `status = INATIVO` |

### 6.4 Pendências do PIM

`GET /api/catalogo/pendencias` lista itens com: obrigatórios sem valor, família não ativa, sem preço (**críticos** — ficam fora do PDV ou sem preço) e sem família/categoria, grade vazia, sem marca, sem GTIN (**incompletos**). Consumo/patrimônio só são cobrados de classificação.

---

## 7. Resumo: tabelas por etapa

| Tabela | Leitura do XML | Conferência | Aprovação | Correção | Unificação |
|---|:-:|:-:|:-:|:-:|:-:|
| `importacoes_lotes` | ✏️ | ✏️ | ✏️ status | 👁 | |
| `importacao_produtos_staging` | ✏️ | ✏️ | ✏️ status/SKU | ✏️ | |
| `importacao_correcoes` | | | | ✏️ | |
| `itens_core` | | 👁 | ✏️ novo | ✏️ inativar | ✏️ inativar |
| `itens_core_unificacoes` | | | | | ✏️ |
| `itens_unidades_medida` | | | ✏️ | ✏️ | |
| `itens_unidades_conversao` | | | ✏️ | ✏️ | |
| `itens_dados_fiscais` | | | ✏️ | | |
| `comercial_produtos_dados` | | 👁 | ✏️ novo | 👁 | 👁 |
| `comercial_unidades_venda` | 👁 | | ✏️ | ✏️ | ✏️ |
| `comercial_precos_faixas` | | | ✏️ | | |
| `comercial_fornecedores_produtos` | 👁 | | ✏️ | ✏️ | ✏️ |
| `atributos_comercial_valores` | | | ✏️ | | |
| `estoque_movimentos` | | | ✏️ | ✏️ | ✏️ |
| `estoque_saldos_itens` | | | ✏️ | ✏️ | ✏️ |
| `pessoas_*` (fornecedor) | ✏️ se cadastrar | | 👁 | 👁 | |

✏️ grava · 👁 só lê

**Origens em `estoque_movimentos`** ligadas a este fluxo: `ENTRADA_NFE`, `CORRECAO_NFE_ENTRADA`, `CORRECAO_NFE_ESTORNO`, `UNIFICACAO_ENTRADA`, `UNIFICACAO_SAIDA`. Chave única: `(tenant_id, origem, id_origem_item, deposito)`.

**Status**

- `importacoes_lotes.status`: `RASCUNHO` → `IMPORTADO` (ou `DESCARTADO`). A tela de notas mostra *Em conferência* / *Pronta* enquanto é rascunho.
- `importacao_produtos_staging.status`: `PENDENTE` → `IMPORTADO` (ou `REJEITADO`).
- `itens_core.status`: `ATIVO` / `INATIVO`.

---

## 8. Onde está o código

| Parte | Arquivo |
|---|---|
| Leitura do XML | `Front/App/src/pages/Compras/StockEntry/xml/utils/` (`nfeParser.ts`, `10-protocoloParser.ts`) |
| Tela de entrada | `Front/App/src/pages/Compras/StockEntry/StockEntryForm.tsx` |
| Conferência / lote | `StockEntry/ItemsConference/` (`ItemsConference.tsx`, `ProductMappingModal.tsx`, `ModaisLote.tsx`, `ClassificacaoPim.tsx`, `DestinosEditor.tsx`) |
| Revisão final | `StockEntry/RevisaoFinalModal.tsx` |
| Regras puras do front | `StockEntry/` (`edicaoLote.ts`, `depositos.ts`, `vinculoSugerido.ts`, `stagingRestore.ts`, `freightDistribution.ts`) |
| Staging (gravar/retomar) | `Backend/src/routes/Compras/controllers/comprasController.ts` |
| Pente-fino e aprovação | `Backend/src/routes/Compras/staging/penteFino.ts`, `controllers/stagingLoteController.ts` |
| Estoque por depósito | `Backend/src/routes/EstoqueItens/depositos.ts` |
| Notas, auditoria, correção | `Compras/controllers/notasEntrada.controller.ts`, `staging/auditoriaEntrada.ts`, `staging/correcaoEntrada.ts`, `controllers/correcaoEntrada.controller.ts` |
| Pendências e duplicados | `Backend/src/routes/Catalogo/Produtos/` (`pendenciasPim.ts`, `duplicados.ts`, `unificacao.controller.ts`) |

---

## 9. Observações

- **Reinicie o backend** depois de mudar código (`npm start` usa `ts-node`, que não recarrega sozinho). Rota nova respondendo 404 ou mensagem antiga = servidor desatualizado.
- **Legado (fora deste fluxo)**: `comprasController.confirmarEstoqueLote` (grava em `produtos` e no formato antigo de `estoque_movimentos`, sem rota montada) e `POST /api/compras/itens/processar-xml`. As tabelas antigas `produtos`, `estoque_saldos` e `estoque_movimentacoes` ainda são usadas em outras partes e não são alimentadas pela entrada nova.
- O protocolo do XML mostra a situação **no momento da autorização**; cancelamento posterior só aparece consultando a SEFAZ.
