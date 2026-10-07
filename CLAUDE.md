# ERP — guia do projeto (para devs e IA)

ERP de loja (hidráulica, transmissão, ferragens): catálogo/PIM, entrada de NF-e, estoque, PDV/vendas, caixa,
financeiro (receber/pagar), nota fiscal de saída e módulos plugáveis por loja. Todo o sistema é em **português**
(código de negócio, mensagens, commits).

## Como rodar
| O quê | Onde | Comando |
|---|---|---|
| Backend (Express + MySQL 5.7, porta 3001) | `Backend/` | `npm run dev` (nodemon, recarrega sozinho) |
| Front (React 18 + antd 6 + Vite, porta 5173) | `Front/App/` | `npm run dev` |
| Typecheck backend | `Backend/` | `npx tsc --noEmit -p .` (só deve sobrar o erro antigo de `src/tests/stock-audit.ts`) |
| Typecheck front | `Front/App/` | `npx tsc --noEmit -p tsconfig.app.json` (há erros antigos; não aumente) |
| Build de produção | `Front/App/` | `npx vite build` |
| Teste backend | `Backend/` | `npx ts-node caminho/arquivo.test.ts` (alguns exportam `runXxxTests()`) |
| Teste front | `Front/App/` | `npx tsx caminho/arquivo.test.ts` |

Não há framework de teste: cada `*.test.ts` usa `assert` próprio e imprime `nome: ok`. Regras de negócio ficam em
arquivos puros (sem banco) ao lado do controller, sempre com teste.

Teste de integração no banco real: abrir uma conexão, `beginTransaction`, trocar `pool.getConnection/execute/query`
por essa conexão (commit/rollback viram no-op), chamar os controllers com `req/res` falsos e dar **rollback** no fim.

## Regras combinadas com o dono do sistema (obrigatórias)
- **Banco:** toda mudança de estrutura vira um **script SQL enviado ao usuário** com uma justificativa curta de cada
  alteração; ele aprova e roda no phpMyAdmin. Nunca alterar a estrutura direto. Seguir o padrão de nomes do banco.
- **Nomes de tabela:** `area_assunto_*` (ex.: `vendas_caixas`, `financeiro_contas_pagar`, `fiscal_documentos`).
  Módulo plugável: `modulo_<area>_<assunto>_*` e código `AREA_ASSUNTO` (ex.: `TRANSMISSAO_ROLAMENTOS`).
- **MySQL sem `STRICT_TRANS_TABLES`:** texto maior que a coluna é cortado em silêncio. Respeite os tamanhos
  (ex.: `vendas_caixas_movimentos.tipo` varchar(20)).
- **Sem login por enquanto:** o operador é o nome do perfil (Configurações › Meu Perfil) ou `ADM`. Loja (tenant) padrão 1.
- **Tabelas legadas de estoque** (`produtos`, `estoque_saldos`, `estoque_movimentacoes`) continuam em uso;
  código novo usa `estoque_movimentos` + `estoque_saldos_itens`.
- **Estoque só entra de verdade na aprovação da nota (staging).** O SKU raiz (`itens_core.sku`, IT-000123) fica oculto;
  o operador vê o SKU customizado.
- **Módulo plugável** liga/desliga por loja e não pode quebrar nada desligado. O núcleo nunca importa um módulo;
  o contato é só pelo registro (`Backend/src/modulos/registro.ts` e `Front/App/src/modulos/registroModulos.tsx`)
  e pelos pontos de extensão (`pdv`, `entradaNf`).
- Pergunta do usuário ("é só uma dúvida") se responde sem mexer no código.
- Commits no padrão `tipo(area): descrição` em português (`feat`, `fix`, `chore`), um assunto por commit.

## Padrões de código
- **Backend por área:** `x.routes.ts` (rotas) · `x.controller.ts` (HTTP + banco) · `x.ts` (regras puras) ·
  `x.test.ts`. Controllers usam `tenantDe(req)`, `operadorDe(req)` e uma classe `ErroXxx` com status HTTP.
  Datas que voltam para o front saem formatadas no SQL (`DATE_FORMAT`) para não deslocar fuso.
- **Front por área:** página(s) + `xApi.ts` (fetch, tipos, mensagens de erro) + regras puras testáveis.
  Estado compartilhado com `useSyncExternalStore` (ex.: `caixaStore`, `modulosStore`).
- antd 6: `destroyOnHidden`, `styles={{ body: ... }}`, `popupMatchSelectWidth`; ícones de `@ant-design/icons`.
- Dinheiro: arredondar por linha antes de somar; `decimal(18,4)` no banco.

## Mapa das áreas
Veja o `README.md` de cada área para os arquivos de entrada e as tabelas.

| Área | Backend | Front | Tabelas principais |
|---|---|---|---|
| Vendas (PDV, caixa, orçamentos, devoluções, taxas, regras, painel) | `Backend/src/routes/Venda` | `Front/App/src/pages/PDV` | `vendas_*` |
| Notas fiscais de saída (NFC-e/NF-e) | `Backend/src/routes/Fiscal` | `Front/App/src/pages/PDV/pages/NotasFiscais` | `fiscal_*` |
| Financeiro (receber, pagar) | `Backend/src/routes/Financeiro` | `Front/App/src/pages/Financeiro` | `financeiro_*` |
| Entrada de NF (staging) | `Backend/src/routes/Compras` | `Front/App/src/pages/Compras/StockEntry` | `importacoes_lotes`, `importacao_produtos_staging` |
| Catálogo / PIM | `Backend/src/routes/Catalogo` | `Front/App/src/pages/Catalogo` | `itens_core`, `comercial_*`, `atributos_*` |
| Estoque | `Backend/src/routes/EstoqueItens` | `Front/App/src/pages/Estoque` | `estoque_movimentos`, `estoque_saldos_itens` |
| Parceiros (clientes, fornecedores) | `Backend/src/routes/Parceiros` | `Front/App/src/pages/Parceiros`, `pages/Compras/FornecedoresList` | `pessoas_*` |
| Módulo Hidráulica · Montagens | `Backend/src/modulos/hidraulica/montagens` | `Front/App/src/modulos/hidraulica/montagens` | `modulo_hidraulica_montagens_*` |
| Módulo Transmissão · Rolamentos | `Backend/src/modulos/transmissao/rolamentos` | `Front/App/src/modulos/transmissao/rolamentos` | `modulo_transmissao_rolamentos_*` |

Planos e decisões: `docs/` (`plano-vendas.md`, `entrada-nf.md`).

## Pendências conhecidas (não "consertar" sem combinar)
- Endereço do servidor `http://localhost:3001` repetido nos arquivos de API do front; tenant fixo em 1.
- Telas com dados de exemplo fixos (Financeiro › Faturamento, Emissão Faturado, Obras, Funcionários, modal antigo
  de novo produto do catálogo).
- Erros de TypeScript antigos no front (concentrados em telas legadas).
