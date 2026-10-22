// Mapa do Gestor de frotas: as funcionalidades do módulo, em que etapa cada uma entra, o que vai fazer e com que parte
// do ERP se liga. A tela mostra tudo desde o começo; cada funcionalidade abre quando a etapa dela fica pronta.

import type { Funcionalidade } from '../../../shared/components/mapaModulo/mapaModulo';

export const FUNCIONALIDADES: Funcionalidade[] = [
  {
    chave: 'veiculos', titulo: 'Veículos', etapa: 1, situacao: 'PRONTA',
    resumo: 'O cadastro da frota: cada veículo com documento, quilometragem e situação.',
    oQueFaz: [
      'Cadastro de carros, utilitários, caminhões e motos da loja',
      'Quilometragem atual (atualizada pelos abastecimentos e viagens)',
      'Situação: em uso, em manutenção, parado, vendido',
      'Foto e documento (CRLV) anexados',
    ],
    dados: ['placa', 'marca e modelo', 'ano', 'cor', 'RENAVAM', 'chassi', 'combustível', 'capacidade de carga (kg)', 'km atual', 'situação'],
    ligaCom: ['Anexos (como as fotos dos itens)'],
  },
  {
    chave: 'abastecimentos', titulo: 'Abastecimentos', etapa: 2, situacao: 'PLANEJADA',
    resumo: 'Cada abastecimento com km, litros e valor: o consumo (km/l) e o custo por km saem sozinhos.',
    oQueFaz: [
      'Lançar o abastecimento em segundos (veículo, km, litros, valor, posto)',
      'Consumo km/l e R$/km calculados de tanque cheio a tanque cheio',
      'Aviso quando o consumo foge do normal do veículo (vazamento, uso indevido, erro de digitação)',
      'Vira conta no Contas a pagar (categoria Combustível) ou já pago',
    ],
    dados: ['data', 'veículo', 'motorista', 'km', 'litros', 'valor', 'posto', 'tanque cheio', 'forma de pagamento'],
    ligaCom: ['Financeiro › Contas a pagar (categoria Combustível e fretes)', 'Resultado do mês'],
  },
  {
    chave: 'manutencoes', titulo: 'Manutenções', etapa: 3, situacao: 'PLANEJADA',
    resumo: 'Preventivas por km ou por tempo, com aviso antes de vencer, e o histórico de cada veículo.',
    oQueFaz: [
      'Planos de manutenção: troca de óleo a cada 10.000 km ou 6 meses, pneus, freios, revisão',
      'Aviso quando a próxima manutenção está perto (pelo km atual ou pela data)',
      'Corretivas com oficina, peças e mão de obra',
      'Peças do próprio estoque saem como consumo; o custo vai ao Contas a pagar',
    ],
    dados: ['veículo', 'tipo (preventiva/corretiva)', 'serviço', 'km', 'data', 'oficina', 'peças', 'valor', 'próxima (km/data)'],
    ligaCom: ['Estoque (peças de consumo)', 'Parceiros › Fornecedores (oficinas)', 'Financeiro › Contas a pagar (categoria Manutenção)'],
  },
  {
    chave: 'documentos', titulo: 'Documentos e vencimentos', etapa: 4, situacao: 'PLANEJADA',
    resumo: 'IPVA, licenciamento, seguro, vistorias e multas com aviso antes do vencimento.',
    oQueFaz: [
      'Calendário de vencimentos de cada veículo',
      'Aviso X dias antes (no painel do módulo e no sino de notificações)',
      'IPVA parcelado e seguro viram contas (como as contas fixas do financeiro)',
      'Multas com o motorista responsável e o prazo de indicação',
    ],
    dados: ['veículo', 'tipo (IPVA, licenciamento, seguro, vistoria, multa)', 'vencimento', 'valor', 'parcelas', 'motorista (multa)', 'anexo'],
    ligaCom: ['Financeiro › Contas fixas e Contas a pagar', 'Notificações'],
  },
  {
    chave: 'motoristas', titulo: 'Motoristas', etapa: 5, situacao: 'PLANEJADA',
    resumo: 'Quem dirige: CNH (categoria e validade) e os veículos que cada um pode usar.',
    oQueFaz: [
      'Motorista é um funcionário do cadastro de pessoas (sem cadastro duplicado)',
      'CNH com categoria e validade, com aviso antes de vencer',
      'Bloqueio de veículo que exige categoria que o motorista não tem',
      'Histórico de uso, abastecimentos e multas por motorista',
    ],
    dados: ['funcionário', 'CNH (número, categoria, validade)', 'veículos permitidos'],
    ligaCom: ['Parceiros › Funcionários (pessoas)'],
  },
  {
    chave: 'viagens', titulo: 'Viagens e entregas', etapa: 6, situacao: 'PLANEJADA',
    resumo: 'Saída e retorno de cada veículo: quem levou, quanto rodou e o que foi entregue.',
    oQueFaz: [
      'Saída e retorno com km e horário (o km atual do veículo se atualiza)',
      'Pedidos e OS entregues na viagem (ligação com as vendas)',
      'Checklist de saída (pneus, luzes, documentos)',
      'Veículo em viagem aparece como ocupado',
    ],
    dados: ['veículo', 'motorista', 'saída (km, hora)', 'retorno (km, hora)', 'destinos', 'vendas/OS entregues', 'checklist'],
    ligaCom: ['Vendas (pedidos a entregar)', 'Módulo Montagens (OS)'],
  },
  {
    chave: 'custos', titulo: 'Custos e painel', etapa: 7, situacao: 'PLANEJADA',
    resumo: 'Quanto cada veículo custa por km e por mês, e quanto a frota pesa no resultado da loja.',
    oQueFaz: [
      'Custo por km e por mês de cada veículo (combustível + manutenção + documentos)',
      'Comparação entre veículos e evolução mês a mês',
      'Quanto a frota custa no Resultado do mês (por categoria)',
      'Painel com alertas: manutenção vencendo, documento vencendo, consumo fora do normal',
    ],
    dados: ['(calculado dos lançamentos das outras etapas)'],
    ligaCom: ['Financeiro › Resultado do mês e Painel financeiro'],
  },
];
