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
| 1 | Obras e poços no banco (cliente do cadastro, ficha do poço, relatório gravado) |
| 2 | Mapa regional dos poços (integrar o mapa já em desenvolvimento) |
| 3 | Orçamento, sinal e cobrança (contas a receber) |
| 4 | Materiais da obra (estoque) |
| 5 | Agenda, equipe e sonda (funcionários, Gestor de frotas) |
| 6 | Histórico e manutenção do poço (garantia e manutenção periódica) |
| 7 | Monitoramento remoto (IoT) |
| 8 | Resultado e painel |

## Etapa 1 (desenho)
- `modulo_hidraulica_pocos_pocos`: identificação, proprietário (cliente do cadastro), endereço, GPS (latitude e
  longitude, para o mapa), profundidade, diâmetro, vazão, níveis estático e dinâmico, solo, data da perfuração, quem
  perfurou (nós, terceiro, não sabe), situação (ativo, seco, desativado).
- `modulo_hidraulica_pocos_obras`: cliente (cadastro), poço, serviços (perfuração, instalação, limpeza, manutenção,
  troca de bomba, teste de vazão, outro), situação (orçamento, aguardando sinal, em execução, concluída, cancelada),
  datas, garantia, metros previstos, valor contratado, valor do metro excedente e o relatório (o formulário de hoje,
  guardado como JSON para as impressões continuarem iguais).
