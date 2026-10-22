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
