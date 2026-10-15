# ERP — guia do projeto (para devs e IA)

ERP de loja (hidráulica, transmissão, ferragens): catálogo/PIM, entrada de NF-e, estoque, PDV/vendas, caixa,
financeiro (receber/pagar), nota fiscal de saída e módulos plugáveis por loja. Todo o sistema é em **português**
(código de negócio, mensagens, commits).

## Como rodar
| O quê | Onde | Comando |
|---|---|---|
| Backend (Express + MySQL 5.7, porta 3001) | `Backend/` | `npm run dev` (nodemon, recarrega sozinho) |
| Front (React 18 + antd 6 + Vite, porta 5173) | `Front/App/` | `npm run dev` |
| Typecheck backend | `Backend/` | `npx tsc --noEmit -p .` (só deve sobrar o erro antigo de `src/scripts/stock-audit.ts`) |
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

## Scripts de banco (como entregar)
- **Fluxo:** propor o desenho → mandar o script com "Por que precisa" em poucas palavras → esperar o usuário dizer
  que rodou → só então depender da estrutura nova. Dizer quando o código depende do script e se rodá-lo muda dados.
  Cargas iniciais (`INSERT IGNORE`) vão num bloco separado e opcional. Senhas e tokens ficam no `.env`, nunca no banco.
- **Antes de escrever FK, conferir o tipo real da coluna de destino** (dump do phpMyAdmin ou `INFORMATION_SCHEMA`).
  Os tipos variam: `itens_core.id_item` e tabelas novas são `bigint(20)`; `fornecedores.id_fornecedor`, pessoas,
  `importacoes_lotes` e `importacao_produtos_staging` são `int(11)`. Tipo diferente = erro **#1215**.
- **Armadilhas que já deram erro:** FK com `ON DELETE CASCADE` numa coluna usada por coluna gerada `STORED` (#1215);
  `UNIQUE` com coluna NULL não impede duplicata (usar coluna gerada `IFNULL(col, 0) STORED` na chave única).
- **Modelo de tabela** (padrão das tabelas recentes):
  ```sql
  -- 1) O que é e por que existe (um comentário por bloco do script)
  CREATE TABLE `area_assunto` (
    `id_entidade` bigint(20) NOT NULL AUTO_INCREMENT,
    `tenant_id` bigint(20) NOT NULL,
    `id_item` bigint(20) NOT NULL COMMENT 'FK para itens_core',
    `status` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ABERTO' COMMENT 'ABERTO, PAGO, CANCELADO',
    `valor` decimal(18,4) NOT NULL,            -- dinheiro 18,4 · percentual 6,4 · fator de conversão 18,6
    `operador` varchar(60) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ADM',
    `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` datetime DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id_entidade`),
    KEY `idx_area_assunto_tenant_status` (`tenant_id`, `status`),
    KEY `fk_area_assunto_item` (`id_item`),
    CONSTRAINT `fk_area_assunto_item` FOREIGN KEY (`id_item`) REFERENCES `itens_core` (`id_item`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Descrição curta da tabela';
  ```
  Valores fixos (status, forma, tipo) são `varchar` com as opções no `COMMENT`, não `ENUM`. Nomes de índice:
  `idx_`, `uk_`, `fk_` + tabela abreviada + campo. Coluna nova: `ALTER TABLE ... ADD COLUMN ... AFTER <coluna>`,
  com `NULL`/`DEFAULT` que não mude as linhas existentes.

## Padrões de código
- **Backend por área:** `x.routes.ts` (rotas) · `x.controller.ts` (HTTP + banco) · `x.ts` (regras puras) ·
  `x.test.ts`. Controllers usam `tenantDe(req)`, `operadorDe(req)` e uma classe `ErroXxx` com status HTTP.
  Datas que voltam para o front saem formatadas no SQL (`DATE_FORMAT`) para não deslocar fuso.
- **Front por área:** página(s) + `xApi.ts` (fetch, tipos, mensagens de erro) + regras puras testáveis.
  Estado compartilhado com `useSyncExternalStore` (ex.: `caixaStore`, `modulosStore`).
- antd 6: `destroyOnHidden`, `styles={{ body: ... }}`, `popupMatchSelectWidth`; ícones de `@ant-design/icons`.
- Dinheiro: arredondar por linha antes de somar; `decimal(18,4)` no banco.

## Estrutura de pastas
Backend e front seguem a mesma divisão por área de negócio:

```
Backend/src/
  server.ts, rotas.ts      entrada do servidor e montagem de todas as rotas
  areas/<area>/            rotas, controllers, regras puras e testes de cada área
  modulos/                 módulos plugáveis (registro.ts + <area>/<assunto>/)
  infra/db.ts              pool do MySQL
  scripts/                 auditorias e testes avulsos (fora do nodemon)
Front/App/src/
  main.tsx                 entrada do Vite (+ index.css, forms.css globais)
  app/                     App, AppLayout (rotas e menu) e layout/
  areas/<area>/            telas + xApi.ts + regras puras de cada área
  modulos/                 módulos plugáveis (registroModulos.tsx + <area>/<assunto>/)
  shared/                  api/config.ts (API_URL), components, context, core, utils, types
docs/                      planos e decisões; docs/legado guarda material antigo
```

## Mapa das áreas
| Área | Backend (`Backend/src/`) | Front (`Front/App/src/`) | Tabelas principais |
|---|---|---|---|
| Vendas (PDV, caixa, orçamentos, devoluções, taxas, regras, painel) | `areas/vendas` | `areas/vendas` (`pdv`, `caixa`, `orcamentos`, `taxas`, `regras`, `painel`, `vendasDoDia`) | `vendas_*` |
| Notas fiscais de saída (NFC-e/NF-e) | `areas/fiscal` | `areas/fiscal/notasSaida` | `fiscal_*` |
| Financeiro (receber, pagar) | `areas/financeiro` | `areas/financeiro` | `financeiro_*` |
| Entrada de NF (staging) | `areas/compras` | `areas/compras/entradaNf`, `areas/compras/notasEntrada` | `importacoes_lotes`, `importacao_produtos_staging` |
| Catálogo / PIM | `areas/catalogo` | `areas/catalogo` (`skus`, `familias`, `categorias`, `atributos`, `marcas`, `precos`, `staging`…) | `itens_core`, `comercial_*`, `atributos_*` |
| Estoque | `areas/estoque` | `areas/estoque` | `estoque_movimentos`, `estoque_saldos_itens` |
| Parceiros (clientes, fornecedores) | `areas/parceiros` | `areas/parceiros` (`fornecedores`), `areas/clientes` | `pessoas_*` |
| Módulo Hidráulica · Montagens | `modulos/hidraulica/montagens` | `modulos/hidraulica/montagens` | `modulo_hidraulica_montagens_*` |
| Módulo Transmissão · Rolamentos | `modulos/transmissao/rolamentos` | `modulos/transmissao/rolamentos` | `modulo_transmissao_rolamentos_*` |
| Módulo E-commerce · Mercado Livre (tela `/ecommerce`) | `modulos/ecommerce/mercadolivre` | `modulos/ecommerce/mercadolivre` | `modulo_ecommerce_mercadolivre_*` |

Arquivo novo vai para a área dele; o que é usado por várias áreas vai para `shared/` (front). Nomes de pasta em
minúsculo/camelCase. Imports são relativos; o endereço do backend vem só de `shared/api/config.ts`.

Planos e decisões: `docs/` (`plano-vendas.md`, `entrada-nf.md`).

## Pendências conhecidas (não "consertar" sem combinar)
- Tenant fixo em 1 (sem login).
- Telas com dados de exemplo fixos (Financeiro › Faturamento, Emissão Faturado, Obras, Funcionários, modal antigo
  de novo produto do catálogo).
- Erros de TypeScript antigos no front (concentrados em telas legadas).
