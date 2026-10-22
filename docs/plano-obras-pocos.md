# Módulo Obras de poços artesianos (HIDRAULICA_POCOS)

Módulo plugável para empresa de poços artesianos (perfuração, instalação de bomba, limpeza, manutenção, troca de bomba).
Código em `Backend/src/modulos/hidraulica/pocos` e `Front/App/src/modulos/hidraulica/pocos`; tabelas
`modulo_hidraulica_pocos_*`; tela `/modulos/hidraulica/pocos`. O mapa das funcionalidades fica em `planoObras.ts`.
O que era do legado (relatório só no navegador, tela antiga "Obras / Projetos" com dados de exemplo) é substituído
pelas etapas abaixo, ligado ao resto do ERP.

## Regras do negócio (combinadas com o dono)
- A instalação da bomba pode ser uma obra separada ou fazer parte do contrato de perfuração.
- O **sinal** libera o início da obra (ou é recebido no ato da perfuração).
- **Adicional** (metro excedente, material, serviço extra) precisa de **aprovação do cliente** registrada e entra no
  saldo, que o cliente paga no fim ou parcela.
- A empresa atende poços que outros perfuraram: o **poço é uma ficha própria**, com várias obras ao longo do tempo.
- Mapa regional dos poços (profundidade e vazão da região antes de perfurar) e monitoramento remoto (IoT) estão no plano.

## Sistema à parte (decisão do dono, 2026-10-22)
O módulo de poços veio de outro sistema e fica **separado do resto do ERP**: clientes, contratos, cobrança, caixa,
materiais, equipe e resultado são do próprio módulo. Não grava nem lê caixa, financeiro, clientes (pessoas) ou estoque
da loja, e as regras de parcela/recebimento são cópias próprias (mudança no financeiro da loja não mexe aqui). Juntar
com a loja, se um dia for o caso, é uma decisão nova.

## Etapas
| Etapa | Funcionalidade |
|---|---|
| 0 | Relatório técnico e impressões (já existe; vira a ficha da obra na etapa 1) |
| 1 | Obras e poços no banco (cliente de poço, ficha do poço, relatório gravado) |
| 2 | Mapa regional dos poços (integrado ao maperf) |
| 3 | Orçamento, sinal e cobrança (contas a receber) |
| 4 | Materiais da obra (estoque) |
| 5 | Agenda, equipe e sonda (funcionários, Gestor de frotas) |
| 6 | Histórico e manutenção do poço (garantia e manutenção periódica) |
| 7 | Monitoramento remoto (IoT) |
| 8 | Resultado e painel |

## Etapa 1 (desenho)
- `modulo_hidraulica_pocos_clientes`: **clientes de poço**, cadastro próprio do módulo, separado do cadastro geral da
  loja por decisão do dono (juntar quando o sistema amadurecer; `id_pessoa` fica guardado para isso).
- `modulo_hidraulica_pocos_pocos`: identificação, proprietário (cliente de poço), endereço, GPS (latitude e
  longitude, para o mapa), profundidade, diâmetro, vazão, níveis estático e dinâmico, solo, data da perfuração, quem
  perfurou (nós, terceiro, não sabe), situação (ativo, seco, desativado).
- `modulo_hidraulica_pocos_obras`: cliente (cliente de poço), poço, serviços (perfuração, instalação, limpeza, manutenção,
  troca de bomba, teste de vazão, outro), situação (orçamento, aguardando sinal, em execução, concluída, cancelada),
  datas, garantia, metros previstos, valor contratado, valor do metro excedente e o relatório (o formulário de hoje,
  guardado como JSON para as impressões continuarem iguais).

## Etapa 2 (mapa regional)
- A base pública (poços de referência e potencial hídrico) **não vai para o banco** (decisão do dono): o servidor lê
  os GeoJSON do maperf direto da pasta `Backend/dados/maperf` (ou `MAPERF_DIR` no `.env`, que pode apontar para a
  pasta do próprio maperf), nas subpastas `get_pocos_with_center` e `get_hydric_potential_raster_with_center`.
  Guarda em memória e relê quando um arquivo muda. O banco fica só com os poços dos clientes; nunca se misturam.
- O tipo do arquivo é reconhecido pela geometria (pontos = poços, polígonos = potencial). Vazão da referência em m³/h
  (como na origem); a dos nossos poços em L/h.
- Camadas ligam e desligam (poços dos clientes, referência, potencial, satélite); a escolha fica no navegador.
- Análise de um raio (padrão 2 km): quantidade, profundidade média/mediana/faixa, vazão média e o potencial do ponto.
  A sugestão de metros para o orçamento é a mediana arredondada para cima de 10 em 10 m (regra em `mapa.ts`).
- "Ver no mapa" na obra, no poço e no cliente; no mapa, o poço do cliente abre a obra, a ficha do poço e a do cliente.

## Etapa 3 (sinal e cobrança)
- A cobrança fica **no próprio módulo** (`modulo_hidraulica_pocos_parcelas`, `_adicionais`, `_recebimentos`), separada
  do contas a receber e do caixa da loja.
- Sinal na obra (`valor_sinal`, `sinal_quando`): ANTES = a obra só vai para "em execução" com a parcela do sinal paga;
  NO_ATO = libera o início e fica cobrando. A parcela do sinal acompanha o valor (não fica abaixo do já recebido).
- Adicional nasce pendente e só entra no saldo aprovado, com o meio (mensagem, assinatura, presencial, telefone), a data
  e uma observação. O relatório sugere o metro excedente (perfurado − previsto) × valor do metro.
- Saldo = contrato + adicionais aprovados − parcelas lançadas; vira à vista, parcelado ou sem prazo (mesmas regras do
  contas a receber da loja, copiadas em `cobranca.ts`). O recebimento fica só no módulo (não passa pelo caixa da loja);
  estorno com motivo. A coluna `id_caixa` de `_recebimentos` não é usada.
- O resultado das obras fica no painel do próprio módulo (etapa 8), fora do Resultado do mês da loja.

## Etapa 4 (materiais da obra)
- `modulo_hidraulica_pocos_materiais`: cadastro próprio (nome único, categoria, unidade, custo, preço quando cobrado à
  parte, ativo). Não usa o catálogo nem o estoque da loja.
- `modulo_hidraulica_pocos_obras_materiais`: linhas da obra (do cadastro ou avulsas) com previsto, usado (vazio = não
  conferido) e o custo congelado na linha. Custo real = usado × custo, arredondado por linha; o real é parcial
  enquanto houver linha sem conferir.
- Copiar de outra obra traz materiais e quantidades previstas com o custo atual do cadastro.
- Cobrar à parte cria um adicional MATERIAL pendente (quantidade usada, ou a prevista, × preço) e guarda o vínculo
  (não cobra duas vezes; não tira da obra o material cobrado).

## Etapa 5 (agenda, equipe e sonda)
- `modulo_hidraulica_pocos_equipe` e `_equipamentos`: cadastros próprios (não usam os funcionários nem a frota da loja).
  Equipamento tem situação (ativo, em manutenção, inativo).
- `modulo_hidraulica_pocos_agenda`: compromisso de um ou vários dias (até 90), hora opcional, tipo (obra, visita de
  orçamento, manutenção, outro), situação (agendado, realizado, cancelado), ligado à obra quando houver.
  `_agenda_equipe` e `_agenda_equipamentos` guardam quem vai e o que vai (chave dupla, apagam junto com o compromisso).
- Avisos sem bloquear (regra em `agenda.ts`): pessoa ou equipamento em dois compromissos que se encontram (cancelados
  não contam; só o compromisso agendado gera aviso) e equipamento em manutenção/inativo.
- "Agendar" na obra abre a agenda com o compromisso já preenchido (título, local, data prevista).

## Etapa 8 (resultado e painel) — feita antes da 6 e da 7
- Sem tabela nova: calculado das obras, cobrança, materiais e relatório (regras em `painel.ts`). Fora do Resultado do
  mês da loja.
- Lucro da obra = contrato + adicionais aprovados − materiais; o custo usa o usado de cada linha e, onde não foi
  conferido, o previsto ("estimado").
- Período: recebido (sem estornos), faturado e lucro das obras concluídas no período, metros perfurados (profundidade
  do relatório das perfurações concluídas). Gráfico dos últimos 12 meses (recebido × faturado).
- Alertas: orçamento sem resposta > 30 dias, início previsto vencido sem começar, em execução > 15 dias, concluída com
  valor sem parcela lançada.
- Ainda não entram outros custos da obra (combustível, diárias, terceiros): ficariam numa tabela própria, se quiser.

## Etapa 6 (histórico e manutenção do poço)
- `modulo_hidraulica_pocos_historico`: registros avulsos do poço (medição com NE/ND/vazão, visita, observação,
  problema). A medição da ficha (perfuração) entra como primeiro ponto das medições.
- `modulo_hidraulica_pocos_planos_manutencao`: serviço + "a cada N meses". A última vez é a mais recente entre a última
  obra concluída com o serviço no poço e a data informada (poço antigo); próxima = última + N meses; vencida, a vencer
  (30 dias), em dia ou nunca feita. Regras em `manutencao.ts`.
- Lista "manutenções para oferecer" (vencidas e a vencer) com o cliente, e "criar obra"/"criar e agendar" (orçamento já
  com cliente, poço e serviço); mostra quando já existe obra aberta para o serviço. Garantias vencendo em 30 dias.
