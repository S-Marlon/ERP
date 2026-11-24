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
- Outros custos da obra (horas, km, diesel, despesas, terceiros) entram desde 2026-11-23 (ver "Custo real × estimado").

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
- **Kit de visita** (Mais ferramentas e botão na Central): proposta comercial, tabela de preços de referência (itens da
  planilha), contrato do modelo configurado e autorização de metragem adicional, em branco para preencher à mão na
  visita; pré-visualização A4 de cada um e "imprimir os marcados" numa impressão só (`documentosEmBranco.ts`).
- **Kit preenchido** (2026-11-11): cada modelo do kit sai "em branco" ou "preenchida". Preenchida mostra os campos
  (`camposKit.ts`, marcação ⟦chave⟧ nos modelos); o que falta fica amarelo na pré-visualização e o campo em edição em
  amarelo forte (só na tela); o vazio sai em linha para preencher à mão. Os valores valem para todos os modelos da
  visita; valor por extenso, totais da tabela e total da autorização saem calculados. Proposta tem o atalho do padrão.
- **Documentos** (2026-11-11): "Kit de visita" e "Relatório avulso" viraram um item só, com três abas: kit de visita (agora
  com a ficha de campo da perfuração), documentos de uma obra
  (orçamento, contrato, aditivos, laudo e adesivo com pré-visualização A4) e o relatório técnico avulso. Endereços antigos
  (`/kit-visita`, `/relatorio`) abrem a aba certa.
- **Ficha de campo da perfuração** (2026-11-11): modelo do kit como os outros (em branco ou preenchida, campos em amarelo).
  Folha 1: obra, perfuração (etapas e revestimento em 3 linhas cada), motobomba. Folha 2: teste de vazão com 18 linhas de
  leitura de bombeamento e recuperação para anotar à mão, observações e assinaturas.
- **Busca geral e ficha do poço** (2026-11-11): campo no topo de todas as telas do módulo acha cliente (nome, telefone,
  CPF/CNPJ, cidade), poço (identificação, endereço, proprietário) e contrato (nº, título, cliente, poço) — `GET /busca?q=`,
  regras em `busca.ts`. Cliente e poço abrem a ficha **por cima da tela atual** (store `fichasPocos` em `navPocos.ts`,
  montada uma vez em `FichasPocos`); contrato abre a obra. Ficha do poço (`GET /pocos/:id/completo`): dados, GPS (mapa e
  Google Maps), proprietário, contratos/obras do poço com o tipo do contrato — **formal** (assinado no processo) ou
  **informal** (obra fechada sem contrato assinado) —, relatório técnico, documentos da obra e garantia, e o histórico.
  O mapa, a Central, a lista de poços, a obra e a ficha do cliente passaram a abrir essas fichas.
- **Configuração reorganizada** (2026-11-11): `ConfigPocos.tsx` com menu de seções (Empresa, Orçamento e garantia, Contrato,
  Pós-venda, Horário e prazos, Telas do módulo) e uma seção por vez; o menu mostra quantos campos importantes faltam
  (`secoesConfig.ts`). Modelos de contrato/aditivo num editor à parte (resumo: padrão ou personalizado, nº de cláusulas);
  prazos de avaliação/revisão junto das mensagens; barra de salvar com "alterações não salvas" e Desfazer. Atalhos
  abrem a seção certa (`subvista: 'CONFIG:CONTRATO'`).
- **Poço sem nome** (2026-11-11): vira "Poço de <cliente>", e do segundo em diante "#2", "#3" (`nomePadraoPoco`).
- **Todo serviço fechado tem contrato** (2026-11-11, colunas `forma_contrato`, `fechado_em`, `combinado_como` em
  `modulo_hidraulica_pocos_obras`): sair do orçamento pede "Como foi fechado?" — **escrito** (papel assinado; marca a etapa
  Contrato assinado nesse dia) ou **informal** (de boca/WhatsApp, com como foi combinado). Corrigível depois pelo campo
  Contrato no topo da obra (`PUT /obras/:id/contrato`). Documentos da obra ganhou o **Contrato interno** (controle da
  empresa: dados fiscais do cliente, serviço, valores e condições, parcelas e recebimentos). A busca e a ficha do poço usam o
  registro (antes: palpite pela etapa do processo). Obras antigas já fechadas sem registro não travam.
- **Contrato informal só pede nome e telefone** (2026-11-12): a ficha do cliente só avisa de CPF/CNPJ e endereço como
  "só para contrato escrito"; o aviso forte é a falta de telefone.
- **Conjunto motobomba e fotos do poço** (2026-11-12, tabelas `modulo_hidraulica_pocos_conjuntos` e
  `modulo_hidraulica_pocos_pocos_fotos`): aba **Bomba e instalação** na ficha do poço com o conjunto instalado (bomba ou
  motor + bombeador, CV, tensão, estágios, profundidade, tubo, fio, corda, quadro e cabeça do poço), **histórico de trocas**
  (trocar retira o atual na data da nova instalação; "conjunto antigo" entra direto no histórico) com o tempo de uso de
  cada um, e fotos do poço por tipo (bomba, cabeça, quadro, local; bomba/cabeça/quadro ficam ligadas ao conjunto da época),
  além das fotos das obras do poço. Concluir obra de instalação, troca de bomba ou perfuração com o "Sistema de
  bombeamento" do relatório preenchido registra o conjunto sozinho (`registrarConjuntoDaObra`). Regras em `conjuntos.ts`.
  A **prévia do plano mensal** usa o conjunto: bomba com 5 anos ou mais de uso (+10 pontos e 2 visitas/ano) e trocas já
  feitas (+5); "Informações a completar" cobra a bomba do poço ativo.
- **Trilha e "subir um nível"** (2026-11-12): no topo, "Central › seção › sub-tela" (ex.: Central › Mais ferramentas › Mapa;
  Central › Obras e orçamentos › Obra nº 4 · cliente), cada degrau clicável, e o botão ↑ (ou Alt+↑) volta ao nível de cima.
  As irmãs do mesmo grupo continuam como abas e sobem direto para a Central; as ferramentas sobem para Mais ferramentas.
  Sub-telas entram na trilha com `useNivelPocos` (obra aberta, Atendimento › Configuração, Agenda › Equipe/Equipamentos);
  a regra da parte fixa está em `trilhaDaSecao` (com teste).
- **Plano mensal** (2026-11-12, tabelas `modulo_hidraulica_pocos_plano_mensal_custos` e `_plano_mensal_niveis`): tela em
  Mais ferramentas com os custos da empresa (hora da equipe, horas da visita e a mais por 100 m, km e custo/km, material,
  limpeza, monitoramento e aparelho, preço da bomba por CV e vida útil, impostos, cobrança, inadimplência, margem desejada e
  mínima, arredondamento e o preço da visita avulsa), os planos oferecidos (visitas/ano, limpeza a cada N meses, emergências,
  monitoramento, % da troca da bomba, desconto em peças, fidelidade) e o simulador por cliente ou poço digitado.
  Preço = custo anual ÷ 12 ÷ (1 − impostos − cobrança − inadimplência − margem), arredondado; viável quando a margem real
  ≥ mínima e o cliente paga menos do que avulso (sem preço avulso nem média de manutenções, a comparação é estimada e não
  reprova). A tela simula o que está sendo editado antes de salvar. A prévia da Central usa os planos: o sugerido é o viável
  que mais economiza para o cliente. Regras em `planoMensal.ts` (com teste). Próxima etapa: contratar o plano e cobrar todo mês.
- **Plano mensal, ajuste** (2026-11-12, colunas `base_latitude`, `base_longitude`, `fator_estrada`, `uso_emergencias_pct` nos
  custos e `desconto_limpeza_pct`, `prioridade` nos planos): o transporte (o custo maior) sai da distância da base da
  empresa até o GPS do poço × fator da estrada × 2 (sem base ou sem GPS, o km médio; no simulador dá para informar à mão);
  as emergências incluídas entram pelo uso esperado (30%); limpeza vira desconto (feita quando precisa) e o desconto em
  bomba e material fica separado; "atendimento prioritário" é marcação sem custo. Planos refeitos: Essencial (1 preventiva/ano),
  Completo (a cada 6 meses, prioridade, 1 emergência) e Monitorado (+ sensores).
- **Poço sem dono** (2026-11-13): sem nome e sem proprietário vira "Poço (<cidade>) #1", "#2"... (pela cidade ou bairro;
  sem local, "Poço (sem local) #1") — `nomePadraoPocoSemDono`. O cadastro do poço ganhou o **CEP** e, no poço novo, a
  **motobomba instalada** (opcional, os mesmos campos do conjunto); no poço já cadastrado, o botão leva à ficha › Bomba e instalação.
- **Checklist de ocorrências** (2026-11-23): 31 itens em 5 grupos (perfuração, qualidade da água, poço e estrutura, bomba e
  elétrica, local) em `ocorrencias.ts` (front e backend); os 8 códigos antigos (`chkCaimento`, `chkAguaNaoLimpou`...)
  continuam. No relatório: perfuração/local na seção Perfuração (+ "outras ocorrências" em texto), água/poço/bomba no
  Diagnóstico; a impressão traz só as marcadas (o formulário em branco traz todas). A ficha do poço mostra o histórico das
  ocorrências dos relatórios e das visitas (o que se repete em vermelho, "×2").
- **Estrutura do poço** (2026-11-23): o revestimento tem tipo (externo, interno de complemento, filtro, tubo de boca),
  início livre (não encadeia: o interno começa em 0 dentro do de fora) e motivo; o relatório ganhou o perfil geológico
  (camadas encadeadas). `estruturaPoco.ts` monta o resumo ("sem revestimento de 48 a 120 m: parede em rocha sã") e o
  desenho (SVG) para a tela, a impressão e a aba **Estrutura** da ficha, que junta as obras do poço (`estrutura.ts` no
  backend: perfuração e geologia da obra mais funda, revestimentos de todas com a obra de origem, NE e bomba mais recentes).
  Sem relatório detalhado, o desenho básico sai do cadastro (profundidade, diâmetro e NE; revestimento "não informado").
  A estrutura também pode ser informada **direto no poço** (ficha › Estrutura › Informar a estrutura; coluna
  `dados_estrutura` em `modulo_hidraulica_pocos_pocos`, `limparEstrutura`): vale como base (a mais antiga) e o que as
  obras registram depois entra por cima. O registro de visita ganhou o checklist (coluna `ocorrencias`).
- **Navegação** (2026-11-23): o que se usa todo dia saiu de "Mais ferramentas": Mapa virou aba de Clientes e poços,
  Manutenção virou aba de "Agenda e manutenção" e Documentos ganhou item próprio na barra lateral. Em Mais ferramentas
  ficam Resultado, Plano mensal e Monitoramento (o aviso de tela desligada continua lá, também para o Mapa).
- **Materiais no relatório** (2026-11-23, colunas `diametro`, `comprimento_m`, `marca`, `classe`, `cor` em
  `modulo_hidraulica_pocos_materiais`): o revestimento, o tubo edutor, o cabo, a corda e o pré-filtro escolhem do cadastro
  (`CampoMaterial`, com a cor; digitar livre continua valendo) e guardam id, cor e comprimento da barra na linha. Barras
  calculadas pelo trecho ("8 barras de 6 m"), tubo edutor conferido com a profundidade da bomba, cabo sugerido (bomba +
  10 m). Completação no relatório (pré-filtro, cimentação, laje, tampa), desenhada no espaço anelar. "Lançar materiais
  na obra" leva o consumo do relatório para Materiais da obra (`consumoDoRelatorio`). No cadastro, "Completar pelo nome"
  preenche diâmetro, barra, classe e cor vazios (`sugerirDadosTecnicos`, cor padrão por tipo em `corPadrao`).
- **Desenho do conjunto instalado** (2026-11-23, `desenhoConjunto.ts`): na ficha › Bomba e instalação (e no histórico de
  trocas), o que desce no poço: tubo edutor contado por barra com as emendas marcadas na altura (6 barras de 6 m = 36 m:
  serve para trocar a tubulação ou subir/baixar a bomba), fio do quadro até o motor, corda, bombeador sobre o motor, NE/ND
  e o fundo. Conferência: tubos × profundidade da bomba, fio e corda chegam, sobra do fio, bomba abaixo do ND e longe do
  fundo. No formulário, "barras de 6 m" calcula os metros. O conjunto registrado pela obra leva também cabo (metros) e corda.
- **Custo e margem da obra** (2026-11-23, tabelas `modulo_hidraulica_pocos_custos_perfuracao` e `_custos_obra`, coluna
  `estimativa_custo` nas obras): em Plano mensal › "Custos da obra", o custo por metro e o rendimento da sonda (m/h) de cada
  formação e as horas fixas (montar a sonda, revestir 100 m, limpeza, instalar a bomba), a jornada e a despesa por dia. No
  orçamento da obra, "Custo e margem" soma perfuração por formação (parte do perfil geológico do relatório), materiais da
  estrutura prevista a custo do cadastro, bomba, equipe (horas × hora da equipe), deslocamento (km pelo GPS × dias) e
  despesas por dia; com impostos, cobrança e inadimplência dá o preço mínimo (margem mínima), o sugerido (margem desejada) e
  a margem do contratado. A estimativa fica gravada na obra. Regra em `custoObra.ts`.
- **Custo real × estimado** (2026-11-23, tabela `modulo_hidraulica_pocos_obras_custos`): aba "Custos e resultado" da obra
  com os custos além dos materiais — horas da equipe e km (quantidade × custo do Plano mensal, congelado no lançamento;
  sugere o que falta da estimativa), diesel da sonda, desgaste, despesas, terceiros e outros. Compara grupo a grupo com a
  estimativa (perfuração = diesel + desgaste; bomba = materiais da categoria Bomba) e mostra a sobra e a margem real pela
  mesma conta (cobrado × (1 − deduções) − custo). No Resultado, o lucro passa a descontar também esses custos, com a
  margem estimada ao lado (preço − custo estimado, a mesma conta do painel). Regras em `custoObra.ts` e `custosReais.ts`.
- **Fechamento com custo real** (2026-11-23): "Concluir a obra" abre uma janela com horas e km já sugeridos pelo que falta
  da estimativa (`faltaDaEstimativa`), diesel, desgaste, despesas e terceiros, o aviso de material sem conferir e a margem
  real ao vivo; "Lançar e concluir" grava um por vez (erro no meio não duplica) e conclui. No Resultado, alerta
  "concluída sem o custo real" só para obra com estimativa guardada (as antigas não viram alerta).
- **Trava do preço mínimo** (2026-11-23, `travaPrecoMinimo`): no orçamento, o Custo e margem acompanha o total dos itens
  ainda não salvo; abaixo do preço mínimo (aviso laranja) ou no prejuízo (o total, sem impostos/taxas, não cobre o custo;
  aviso vermelho), "Salvar itens" pede confirmação. Sem custos da obra configurados, não trava.
- **Ficha de campo do poço** (2026-11-23, `fichaCampoPoco.ts`): na ficha do poço, "Ficha de campo" abre a pré-visualização
  A4 da ficha de campo da perfuração (o modelo do Kit de visita) preenchida com cliente, local e GPS, profundidade,
  diâmetro, vazão, níveis, solo, etapas de perfuração e revestimentos da estrutura (até 3) e a bomba instalada; ou em branco.
- **Local, visita técnica e transporte das máquinas** (2026-11-23, colunas `horas_visita_tecnica`, `custo_km_caminhao`,
  `custo_fixo_transporte`, `viagens_maquina` em `_custos_obra`): no Custo e margem, o km de ida e volta sai do GPS do poço
  ou da localização colada (obra sem poço ainda; fica na estimativa) até a base da empresa. Visita técnica = horas × hora
  da equipe + uma viagem; transporte das máquinas (marcado em perfuração e limpeza) = transportes × (km × custo/km do
  caminhão + fixo). Viram linhas próprias no estimado × real, com os tipos de custo real TRANSPORTE e VISITA.
- **Orçamento rápido com o custo** (2026-11-23, `CustoRapido.tsx`): bloco "Custo e preço" com a conta do Custo e margem
  (metros dos itens por formação, km pelo GPS do poço escolhido ou digitado, serviços, bomba, materiais), preço mínimo,
  sugerido e margem do total; a mesma trava ao gravar; a estimativa é guardada na obra criada.
- **Relatório para o cliente no papel timbrado** (2026-11-23): o mesmo estilo dos documentos da obra (cabeçalho com o
  quadro do documento, resumo em destaque, fichas, seções numeradas, cuidados com o poço, assinatura e rodapé).
- **Plano mensal: risco e análise por cliente** (2026-11-23, `riscoDoPlano` em `planoMensal.ts`, `POST /plano-mensal/analise`):
  a tela virou abas (Análise por cliente, Simular caso a caso, Planos oferecidos, Custos, Carteira). Para cada cliente e
  plano: distância (GPS do poço até a base, ou km médio), lucro por mês esperado e a faixa pessimista–otimista
  (`CENARIOS`: emergências todas usadas, visita +25%, inadimplência dobrada, bomba 25% menos; erro do km `ERRO_KM`: ±5%
  informado, ±15% GPS, ±40% km médio; profundidade/bomba não informadas de 50 a 150 m e 1 a 3 CV), o raio (até quantos km
  dá lucro e mantém a margem mínima com o preço), o risco (alto = esperado abaixo da margem mínima; médio = pessimista
  negativo) com os motivos e a precisão dos dados. A análise soma a carteira (receita, lucro e faixa se todos assinarem).
  No simulador, "Fechar por" testa um preço combinado (desconto) e mostra os cenários.
- **Desconto em bomba e material no custo** (2026-11-23, coluna `material_ano_poco` em `_plano_mensal_custos`): o desconto
  (até 100%, para a escadinha 20/50/100%) vira linha de custo do plano = desconto × (troca da bomba por ano na parte que a
  reserva não cobre + material do cliente por poço por ano); o avulso compara com a peça cheia.
