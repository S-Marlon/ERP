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

## Etapa 7 (monitoramento remoto, IoT)
- `modulo_hidraulica_pocos_dispositivos` (aparelho no poço, identificador único, conexão, intervalo, profundidade do
  sensor e limites), `_leituras` (hora da medição + recebido; a mesma hora do mesmo aparelho não duplica) e `_alertas`.
- Chave do aparelho = HMAC-SHA256(`IOT_CHAVE_MESTRA`, identificador), 32 caracteres; não fica no banco. Trocar a mestra
  invalida todas. A rota `POST /iot/leituras` usa os cabeçalhos `X-Dispositivo` e `X-Chave` e aceita lote (até 500).
- Alertas (regras em `iot.ts`): nível baixo, a seco (ligada com corrente baixa), sobrecorrente, vazão baixa, tensão e
  sem sinal (3× o intervalo, conferido ao abrir o painel). Um aberto por tipo; fecha quando a leitura volta ao normal;
  o que abriu e fechou dentro do lote fica registrado com início e fim.
- Resumo do dia (NE com bomba desligada, ND ligada, horas de bomba, volume) entra nas medições do poço; alertas na linha
  do tempo. Simulador na tela; guia com peças e exemplo de firmware ESP32.

### Etapa 7, quadro de comando (2026-10-22)
- O servidor não depende da placa (ESP-01, ESP32, 4G, LoRa ou arquivo): vale o formato do envio. A placa pode mudar em
  cada poço; a observação do aparelho registra qual é.
- Leituras ganharam fases R/S/T, pressão, energia acumulada (kWh), contador de partidas, contator (bobina), térmico,
  boia e seletora. Aparelho ganhou alimentação (mono/bi/tri), pressão mínima, horas máximas ligada, partidas por hora,
  tarifa de energia e "aceita comandos".
- Alertas do quadro (regras e testes em `iot.ts`): falta de fase, sem energia (segura os alertas da bomba), não parte
  (boia pede e o contator não liga em 2 leituras seguidas, em AUTO), sem funcionamento (contator ligado e corrente
  ≈ 0: bomba queimada/cabo), térmico, pressão baixa com a bomba trabalhando (cano estourado), ligada demais (boia),
  partidas demais (conta a partida da própria leitura).
- Poço sem internet: conexão OFFLINE (sem "sem sinal") e importação de arquivo (JSON, JSONL ou CSV com cabeçalho), até
  1 ano, sem duplicar.
- Relatório do mês: horas, partidas, volume, kWh, custo pela tarifa, m³/kWh, níveis médios, alertas por tipo e
  disponibilidade; impressão e CSV.
- Comandos (`modulo_hidraulica_pocos_comandos`): BLOQUEAR (com motivo), LIBERAR, RECONHECER; um pendente por vez,
  vale 10 min, vai na resposta do envio e o aparelho confirma no seguinte. No quadro, o relé da placa é NF em série
  com a bobina: a placa só bloqueia/libera, nunca liga por cima das proteções.

## Etapa 9 (atendimento e pós-venda: o processo da empresa)
Os 5 pontos combinados com o dono, cada um registrado no módulo (regras e testes em `processo.ts`):
1. **Atendimento:** todo contato vira lead (`_leads`) com origem; prazo de resposta em minutos de **horário
   comercial** (padrão 60 min, seg–sex 8–18 h, sábado até 12 h); "Respondi" grava a hora. Do lead nasce a obra
   (usa o cliente com o mesmo telefone ou cadastra). A situação do lead acompanha a obra (orçamento enviado,
   convertido quando a obra sai do orçamento).
2. **Orçamento:** obra ganhou escopo, prazo de execução, forma de pagamento e validade; o PDF sai da página para
   imprimir (logo e dados da empresa em `_config`). Prazo: N horas (24) depois da visita (ou da criação).
3. **Obra:** fotos de antes (cobradas ao iniciar), durante e depois (ao concluir) em `_fotos` (Backend/uploads/pocos),
   com "pode divulgar" e a galeria de propaganda.
4. **Entrega:** laudo (profundidade, vazão, NE/ND, bomba, garantia) e adesivo do quadro para imprimir; etapas com prazo
   de 3 dias da conclusão; "não se aplica" quando não há quadro.
5. **Pós-venda:** avaliação no Google pedida N dias (7) depois da conclusão e lembrete de revisão aos N meses (11),
   com o WhatsApp aberto por link (wa.me) e a mensagem pronta (modelos com {cliente}, {empresa}, {link}, {poco}).
- Etapas registradas em `_processo` (uma por obra e etapa, FEITO ou NAO_SE_APLICA). Checklist em cada obra,
  pendências de todas e indicadores (resposta no prazo, orçamento no prazo, obras com as 3 fotos, avaliações,
  conversão e valor fechado por origem). Não há envio automático de WhatsApp (precisaria da API paga).

## Central (reformulação, 2026-10-24)
O módulo abre na **Central** e as abas seguem o dia a dia (Central, Atendimento, Obras/poços/clientes, Agenda,
Manutenção, Monitoramento, Mapa, Resultado, Relatório avulso); o mapa de etapas saiu da tela (todas prontas). Cobrança,
materiais e processo continuam dentro da obra. Regras e pesos em `central.ts` (com teste); sem tabela nova.
- **Hoje:** agenda do dia, contatos sem resposta, alertas dos sensores, a receber e vencido (atalhos para as abas).
- **Contratos a finalizar** por fase (negociação, aguardando sinal, em execução, fechamento) com o que falta em cada um:
  orçamento sem valor ou parado, sinal, início vencido, execução longa, saldo sem parcela, vencido, materiais não
  lançados/conferidos, garantia, poço sem GPS/profundidade/vazão, cliente sem telefone e as etapas do processo (as do
  orçamento só antes de começar; pós-venda fica no Atendimento). Obra concluída sem nada faltando sai da lista. Cada
  pendência leva ao lugar de resolver.
- **Informações a completar:** fichas de clientes (telefone, cidade, endereço, documento) e poços (dono, GPS,
  profundidade, vazão, nível estático, diâmetro, data da perfuração) e a % da base completa.
- **Prévia do plano mensal:** chance de assinar (pontos com motivo: poço nosso, recorrência, garantia vencida/vencendo,
  idade e profundidade do poço, relacionamento, paga em dia, IoT; tiram pontos: inadimplência, sem telefone, sem poço)
  e estimativa do valor (visitas/ano × poços × valor da visita — do cliente, da empresa ou o padrão — ÷ 12 + margem +
  monitoramento). Pesos em `PESOS_PLANO` e valores em `BASE_PLANO`, para calibrar quando o plano existir.

## Orçamento rápido, contrato, aditivo e ficha completa do cliente (2026-10-24)
Tabelas novas: `_orcamento_itens`, `_aditivos` (e `id_aditivo` em `_adicionais`); qualificação do cliente em
`_clientes` (PF/PJ, RG/IE, estado civil, profissão, 2º telefone, CEP, representante); modelos em `_config`.
- **Orçamento rápido** (Central, Obras, contato do Atendimento e ficha do cliente): cliente escolhido/cadastrado ou o
  do contato, local (poço do cliente ou local novo), itens "quantidade × valor" com linhas prontas (perfuração em m,
  metro excedente "se necessário", revestimento, bomba, instalação, materiais, teste de vazão) e as condições. Grava a
  obra em ORCAMENTO e abre o PDF. O total dos itens (sem os "se necessário") vira o valor contratado; a perfuração em
  metros dá os metros previstos e o metro excedente. Regras em `orcamento.ts` (com teste).
- **Obra › Orçamento e contrato:** editar itens (até concluir), orçamento PDF, duplicar, contrato completo em PDF,
  "contrato assinado" (etapa `CONTRATO_ASSINADO` do processo, atrasada se a obra começar sem ela) e termos aditivos
  (agrupam adicionais aprovados; numerados por obra; só o último, sem assinatura, pode ser apagado).
- **Contrato e aditivo** saem de modelos de texto com `{campos}` (Atendimento › Configuração; vazio = modelo padrão),
  com qualificação das partes, valor por extenso, foro, responsável técnico e testemunhas. O modelo padrão é referência:
  revisar com advogado. Montagem em `documentosPocos.ts` (com teste).
- **Ficha completa do cliente** (`GET /clientes/:id/completo`): dados, contratos (total, recebido, a receber,
  assinado, aditivos, garantia), poços com ficha técnica, parcelas e recebimentos, linha do tempo (contato, obras,
  processo, alertas dos sensores) e a prévia do plano mensal (mesmo cálculo da Central). Lista com filtros (obra aberta,
  vencido, sem telefone, cidade). Orçamento ainda não aprovado não conta como "a receber".

## Navegação e fluxo do escritório (2026-11-11)
O módulo ainda não tinha dados lançados; a revisão foi para o uso no escritório (computador). Sem tabela nova.
- **Barra lateral com 6 itens** (Central, Atendimento, Obras e orçamentos, Clientes e poços, Agenda, Mais ferramentas). As
  outras telas do grupo viram abas no topo (Obras · A receber · Materiais; Clientes · Poços) e marcam o item do grupo
  (`tambem` em `ItemMenu`). Os endereços antigos continuam valendo. Grupos em `secoesPocos.ts` (com teste).
- **Mais ferramentas:** página com um cartão por tela (manutenção, resultado, mapa, monitoramento, relatório avulso).
- **Obra aberta:** abre onde está o trabalho da situação (orçamento → orçamento e contrato, aguardando sinal → cobrança,
  em execução → relatório, concluída → processo) e mostra o **próximo passo** (a pendência mais grave da Central ou o
  passo normal da situação) com o botão que leva até lá, e o resto que falta. Regras em `proximoPasso.ts` (com teste).
- **Primeiros passos** na Central enquanto faltar algo para o primeiro orçamento: empresa e logo, foro e responsável
  técnico, equipe, sonda, materiais, primeiro cliente e orçamento. Some quando tudo está feito (`primeirosPassos.ts`).
- **Telas que se ligam:** Monitoramento (IoT) e Mapa só aparecem em "Mais ferramentas" quando ligados em Atendimento ›
  Configuração (`usa_monitoramento`, `usa_mapa` em `_config`, padrão desligado). Nada é apagado ao desligar.

## Modelos da empresa: contrato, proposta e planilha de orçamento (2026-11-11)
Feito a partir dos documentos que a empresa já usava (contrato completo, propostas e a planilha de orçamento).
Colunas novas: `incluso` em `_orcamento_itens`, `valor_parcelado` em `_obras`, `empresa_representante(_cpf)` em `_config`.
- **Contrato padrão** = o contrato completo da empresa, com campos: objeto, local, início (`{data_inicio}`, da data
  prevista), prazo, valor à vista e parcelado (`{condicao_parcelada}`), metragem excedente com autorização (inclusive por
  WhatsApp), multa 2% + juros 1% + IPCA, suspensão após 15 dias, obrigações das partes, garantia, condições geológicas
  (obrigação de meio, troca do ponto), rescisão, disposições gerais e foro. Dados bancários do cliente ficaram fora.
- **Item incluso:** aparece com o valor de referência e "INCLUSO", não soma (transporte, bomba, painel...).
  "Se necessário" ganha de incluso. Perfuração por faixas de solo: metros previstos = soma das faixas; valor do metro =
  o da última faixa.
- **Linhas prontas** com os valores da planilha (6" até 60 m por faixa: 300/290/280/270; excedente 280; gerador 320 e
  água 300 se necessário) e o botão "Modelo da empresa (60 m)" que põe todas de uma vez. São ponto de partida: cada
  orçamento ajusta (cliente, cidade, solo).
- **Orçamento PDF:** à vista × parcelado (cartão) e "Condições gerais" (cliente, risco geológico, metragem adicional,
  imprevistos no solo, autorização digital).
