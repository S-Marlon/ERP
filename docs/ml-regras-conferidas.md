# Mercado Livre: regras conferidas (e o que ainda é dúvida)

O que o ERP assume sobre o ML, **de onde veio** e **quando** foi conferido. Serve para não transformar suposição em
regra. Regra de custo usada no código fica numa função pura com teste e a data da conferência (ver
`docs/incidentes/2026-10-16-frete-ml-divergente.md`).

**Ordem de confiança das fontes**
1. **Painel do vendedor / venda real**: o que o ML cobrou de verdade.
2. **API do ML** (leitura de um anúncio publicado).
3. **Assistente (IA) do ML**: ajuda a orientar, mas responde de forma geral e às vezes contradiz o painel.
4. **Suposição nossa**: precisa ser confirmada.

Quando duas fontes discordam, vale a de cima. Atualize esta página quando conferir de novo.

## Frete

| Regra | No ERP | Fonte | Data | Situação |
|---|---|---|---|---|
| Abaixo de R$ 79 **com** frete grátis: o vendedor paga o frete cheio pela tabela de R$ 79 | `valorNaTabelaDeFrete()` (`custosMl.ts`) | Painel, 10 de 10 anúncios iguais | 2026-10-16 | **Valendo** |
| Abaixo de R$ 79 **sem** frete grátis: o vendedor ainda paga a tarifa de envio do item barato | `freteDe()` (`precificacao.controller.ts`) | Painel | 2026-10-16 | **Valendo** |
| R$ 79 ou mais: frete grátis obrigatório, com desconto por reputação/condição | `freteDe()` | Painel + assistente | 2026-10-16 | **Valendo** |
| "De R$ 19 a R$ 78,99, com frete grátis padrão, o ML cobre o custo total do envio" | — | Assistente | 2026-10-16 | **Contradiz o painel.** Não aplicado. Confirmar com um anúncio específico ou com a 1ª venda real (Pedidos › Resultado real) |
| "Frete grátis acima de R$ 19,90" que o comprador vê é benefício pago pelo ML | (só texto de ajuda) | Assistente | 2026-10-16 | Informativo |
| Peso cobrado = maior entre o real e o volumétrico (cm³ ÷ 6) | `pesoVolumetrico()` (`sugestoes.ts`) | API (peso cobrado do anúncio) | 2026-10-16 | Valendo |
| Pacote maior que o declarado: medido e pesado na operação, pode ser **recusado** | Guia de frete | Assistente | 2026-10-16 | Valendo. "Cobra a diferença automaticamente" **não** foi confirmado |
| Fatores do frete: peso, medidas, distância e serviço (a categoria muda a tarifa de venda, não o frete) | — | Assistente | 2026-10-16 | Informativo |

## Fotos e kits

| Regra | No ERP | Fonte | Data | Situação |
|---|---|---|---|---|
| Foto principal sem texto, selo, logo, marca-d'água, QR ou borda | Aviso no editor de imagem | Assistente | 2026-10-16 | **Valendo** |
| Montagem digital (produto repetido N vezes) como foto do kit | Vai como **2ª** foto do anúncio do kit (`fotosDaLinha()`) | Assistente: **não confirmou** que é aceita; recomenda foto real das N unidades | 2026-10-16 | Em dúvida: por isso não é a 1ª |
| Título do kit deve deixar claro quantas unidades são | `tituloComUnidade()` ("Kit 10 Unidades Rolamento …") | Assistente | 2026-10-16 | Valendo |
| Trocar o título de anúncio já publicado | "Enviar atributos, fotos e descrição" manda o título; se o ML recusar, manda o resto e avisa | Assistente: bloqueado enquanto está em análise | 2026-10-16 | Em dúvida fora da análise |
| Anúncio User Products (com `family_name`): o título não muda direto ("You cannot modify the title if the item has a family_name"); o título que aparece é o family_name, às vezes + atributo (ex.: a cor) | O envio troca o `family_name` quando o título é o próprio family_name; senão avisa para trocar no painel | API (recusa real) | 2026-10-16 | Recusa confirmada; aceitar a troca do family_name **ainda não testado** |
| Kit: preencher unidades por pacote e formato de venda quando a categoria tiver esses campos | `atributosDoItem()` (UNITS_PER_PACK, SALE_FORMAT) | Assistente | 2026-10-16 | Valendo |

## Categoria e moderação

| Regra | No ERP | Fonte | Data | Situação |
|---|---|---|---|---|
| Motivo da moderação, o que fazer e categorias sugeridas vêm de `/moderations/infractions` | `anotarModeracao()` (`sincronizacao.ts`) | API | 2026-10-16 | Valendo |
| Trocar a categoria de anúncio em análise **pela API**: não confirmado | Sem botão no ERP; corrigir pelo painel/assistente do ML | Assistente | 2026-10-16 | Não automatizar |
| Categoria trocada no ML vem para o ERP | `categoriaParaTrazer()` + `trazerCategoriaDoMl()` | API | 2026-10-16 | Valendo |
| Produto de vários usos (bike, skate, patins): publicar na categoria da aplicação principal comprovada | — | Assistente | 2026-10-16 | Orientação |

## Tipo de anúncio, frete por anúncio e descontos

| Regra | No ERP | Fonte | Data | Situação |
|---|---|---|---|---|
| Frete grátis pode ser trocado por anúncio (um de cada vez), se elegível | Etiqueta do item na lista (`modoDaLinha`) | Assistente | 2026-10-16 | Valendo |
| Premium → Clássico num anúncio publicado | O ERP tenta e mostra a recusa do ML | Assistente: não confirmou | 2026-10-16 | Em dúvida |
| "Desconto por quantidade como **promoção** não aceita anúncio vendido como kit" | — | Assistente | 2026-10-16 | Em dúvida se vale também para o **preço por quantidade (B2B)** que o ERP usa (`faixas.controller.ts`). Confirmar antes de mexer |
| Cupons se somam a promoções e ao desconto no Pix; com preço por faixa, não confirmado | — | Assistente | 2026-10-16 | Em dúvida |

## Custo real de cada venda

| Regra | No ERP | Fonte | Data | Situação |
|---|---|---|---|---|
| Tarifa e frete cobrados de cada venda | Pedidos importados (tarifa do pedido, frete do envio) → Resultado real | API | 2026-10-14 | Valendo |
| Relatório de faturamento (painel) traz tarifa, descontos, envio e recebimento por venda | — | Assistente | 2026-10-16 | Para conciliar quando houver vendas (exportar do painel). API completa não confirmada |

## Perguntas em aberto

- Com um anúncio concreto (ex.: MLB7804962608, R$ 23,40, frete grátis): quanto o vendedor paga de envio por venda? Isso resolve a contradição da faixa de R$ 19 a R$ 78,99.
- O preço por quantidade (perfil de negócio) funciona em anúncio de kit?
