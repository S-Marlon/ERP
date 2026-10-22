# Módulo Gestor de frotas (LOGISTICA_FROTA)

Módulo plugável (liga/desliga em Configurações › Módulos). Código em `Backend/src/modulos/logistica/frota` e
`Front/App/src/modulos/logistica/frota`; tabelas `modulo_logistica_frota_*`; rota da tela `/modulos/logistica/frota`.
O núcleo não importa o módulo; o módulo usa o núcleo (pessoas, estoque, contas a pagar, categorias).

O mapa das funcionalidades (o que a tela mostra) fica em `Front/App/src/modulos/logistica/frota/planoFrota.ts`:
cada funcionalidade tem a etapa e a situação (planejada, em construção, pronta). Ao abrir uma etapa, mudar a situação lá.

## Etapas

| Etapa | Funcionalidade | Liga com |
|---|---|---|
| 1 | Veículos (cadastro, km atual, situação) | — |
| 2 | Abastecimentos (consumo km/l, R$/km, aviso de consumo fora do normal) | Contas a pagar (Combustível), Resultado do mês |
| 3 | Manutenções (preventivas por km/tempo com aviso, corretivas, peças) | Estoque (consumo), fornecedores (oficinas), Contas a pagar |
| 4 | Documentos e vencimentos (IPVA, licenciamento, seguro, vistoria, multas) | Contas fixas/a pagar, notificações |
| 5 | Motoristas (funcionário + CNH com validade, veículos permitidos) | Pessoas (papel Funcionário) |
| 6 | Viagens e entregas (saída/retorno, km, vendas/OS entregues, checklist) | Vendas, módulo Montagens |
| 7 | Custos e painel (custo por km e por mês, alertas) | Resultado do mês, Painel financeiro |

## Etapa 1: veículos (desenho)

`modulo_logistica_frota_veiculos`: placa (única na loja, guardada sem traço; aceita a antiga ABC1234 e a Mercosul
ABC1D23), apelido ("Strada branca"), tipo (carro, utilitário, caminhão, moto, outro), marca, modelo, ano de fabricação e
do modelo, cor, RENAVAM, chassi, combustível, tanque (l), carga (kg), km atual (com a data do último ajuste), situação
(em uso, em manutenção, parado, vendido) e observação. O km atual passa a subir sozinho com abastecimentos (etapa 2) e
viagens (etapa 6).
