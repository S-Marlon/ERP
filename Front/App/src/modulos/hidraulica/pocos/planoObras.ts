// Mapa do módulo Obras de poços (HIDRAULICA_POCOS): da perfuração à manutenção do poço, para empresa de poços
// artesianos. O relatório técnico (etapa 0) já existe; o resto abre por etapas, ligado ao ERP.
import type { Funcionalidade } from '../../../shared/components/mapaModulo/mapaModulo';

export const FUNCIONALIDADES: Funcionalidade[] = [
  {
    chave: 'relatorio', titulo: 'Relatório técnico', etapa: 0, situacao: 'PRONTA',
    resumo: 'O formulário completo do poço e as impressões (relatório, cobrança, teste de vazão, garantia, formulário de campo).',
    oQueFaz: [
      'Dados do poço, perfuração e revestimento por camada, diagnóstico e bombeamento',
      'Teste de vazão com NE, ND, rebaixamento, vazão específica e gráfico',
      'Financeiro da obra: metros contratados, excedente, abatimento, adicionais e pagamentos',
      'Hoje fica no navegador e em arquivo; na etapa 1 passa a ser a ficha da obra, gravada no banco',
    ],
    dados: ['(no navegador e em arquivo XML, até a etapa 1)'],
    ligaCom: [],
  },
  {
    chave: 'obras', titulo: 'Obras e poços', etapa: 1, situacao: 'PLANEJADA',
    resumo: 'A lista de obras e a ficha permanente de cada poço, com o cliente do cadastro: o relatório técnico passa a ser gravado.',
    oQueFaz: [
      'Obra com os serviços dela: perfuração, instalação da bomba (junto ou separada), limpeza, manutenção, troca de bomba',
      'Situação: orçamento, aguardando sinal, em execução, concluída, cancelada (garantia contada da conclusão)',
      'Poço como ficha própria (inclusive os que outros perfuraram): local (GPS), profundidade, vazão, níveis, histórico de obras',
      'O formulário e as impressões de hoje abrem dentro da obra, com o cliente vindo do cadastro',
    ],
    dados: ['obra: cliente, poço, serviços, situação, datas, valores do contrato, relatório', 'poço: identificação, endereço, GPS, profundidade, diâmetro, vazão, NE/ND, solo, quem perfurou'],
    ligaCom: ['Parceiros › Clientes (cadastro rápido com nome e telefone)'],
  },
  {
    chave: 'mapa', titulo: 'Mapa regional dos poços', etapa: 2, situacao: 'PLANEJADA',
    resumo: 'Todos os poços no mapa: antes de perfurar, a profundidade e a vazão dos poços da região dão a ideia de onde sai água.',
    oQueFaz: [
      'Mapa com todos os poços cadastrados (os da empresa e os de terceiros)',
      'Ao escolher um ponto: poços num raio, profundidade média, vazão e nível estático da região',
      'Estimativa de profundidade para o orçamento da obra nova',
      'Integração com o mapa que já está em desenvolvimento',
    ],
    dados: ['(dos poços: GPS, profundidade, vazão, níveis, solo)'],
    ligaCom: ['Orçamento da obra (etapa 3)'],
  },
  {
    chave: 'cobranca', titulo: 'Orçamento, sinal e cobrança', etapa: 3, situacao: 'PLANEJADA',
    resumo: 'Orçamento por metro, o sinal que libera o início da obra, adicionais aprovados pelo cliente e o saldo no contas a receber.',
    oQueFaz: [
      'Orçamento: metros previstos, valor do pacote, metro excedente, instalação e materiais à parte',
      'Sinal obrigatório: a obra só sai de "aguardando sinal" quando ele é recebido (ou no ato da perfuração)',
      'Adicionais com aprovação do cliente (registrada: por mensagem, assinatura ou presencial) entram no saldo',
      'Saldo à vista no fim do serviço ou parcelado: vira contas a receber do cliente',
    ],
    dados: ['orçamento', 'sinal (valor, quando, como)', 'adicionais (descrição, valor, aprovação)', 'parcelas do saldo'],
    ligaCom: ['Financeiro › Contas a receber', 'Caixa (sinal recebido na loja)', 'Resultado do mês'],
  },
  {
    chave: 'materiais', titulo: 'Materiais da obra', etapa: 4, situacao: 'PLANEJADA',
    resumo: 'Tubos, filtros, bomba, cabos, brita e conexões saindo do estoque para a obra, com o custo real dela.',
    oQueFaz: [
      'Lista de materiais da obra (previstos no orçamento e usados de fato)',
      'Saída do estoque ao separar ou ao concluir (com devolução do que sobrou)',
      'Custo real da obra para o resultado',
    ],
    dados: ['obra', 'item do catálogo', 'quantidade prevista e usada', 'custo'],
    ligaCom: ['Estoque', 'Catálogo'],
  },
  {
    chave: 'agenda', titulo: 'Agenda, equipe e sonda', etapa: 5, situacao: 'PLANEJADA',
    resumo: 'Calendário das obras, quem trabalha em cada uma e qual sonda ou equipamento vai.',
    oQueFaz: [
      'Calendário das obras e das visitas de manutenção',
      'Equipe (funcionários) e equipamento de cada obra',
      'A sonda e o caminhão podem ser veículos do Gestor de frotas',
    ],
    dados: ['obra', 'datas', 'equipe', 'equipamento/veículo'],
    ligaCom: ['Parceiros › Funcionários', 'Gestor de frotas (quando ligado)'],
  },
  {
    chave: 'manutencao', titulo: 'Histórico e manutenção do poço', etapa: 6, situacao: 'PLANEJADA',
    resumo: 'O histórico de cada poço e o plano de manutenção, com aviso de garantia e de limpeza periódica.',
    oQueFaz: [
      'Linha do tempo do poço: perfuração, testes de vazão, limpezas, trocas de bomba',
      'Plano de manutenção (ex.: limpeza química a cada 2 anos, revisão da bomba) com aviso',
      'Aviso de garantia vencendo e lista de clientes para oferecer manutenção',
    ],
    dados: ['poço', 'tipo de serviço', 'periodicidade', 'próxima data'],
    ligaCom: ['Obras (cada manutenção é uma obra)', 'Notificações'],
  },
  {
    chave: 'iot', titulo: 'Monitoramento remoto (IoT)', etapa: 7, situacao: 'PLANEJADA',
    resumo: 'Sensores no poço mandando nível, vazão e corrente da bomba: alerta antes de o poço secar ou a bomba queimar.',
    oQueFaz: [
      'Cadastro do dispositivo ligado ao poço',
      'Leituras de nível da água, vazão, corrente e horas de bomba ligada',
      'Alertas: nível baixando, bomba trabalhando a seco, corrente fora do normal',
      'Base para vender o monitoramento como serviço mensal',
    ],
    dados: ['dispositivo (poço, identificador, chave de acesso)', 'leituras (data, nível, vazão, corrente)', 'alertas'],
    ligaCom: ['Histórico do poço (etapa 6)', 'Notificações'],
  },
  {
    chave: 'resultado', titulo: 'Resultado e painel', etapa: 8, situacao: 'PLANEJADA',
    resumo: 'Lucro de cada obra e o painel da empresa: metros perfurados, obras em andamento e atrasadas.',
    oQueFaz: [
      'Lucro por obra: cobrado − materiais − custos lançados',
      'Metros perfurados no mês, obras por situação, sinais a receber',
      'Obras paradas ou atrasadas',
    ],
    dados: ['(calculado das outras etapas)'],
    ligaCom: ['Financeiro › Resultado do mês'],
  },
];
