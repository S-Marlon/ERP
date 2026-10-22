// Mapa do módulo Obras de poços (HIDRAULICA_POCOS): da perfuração à manutenção do poço, para empresa de poços
// artesianos. É um sistema à parte dentro do ERP (veio de outro sistema): clientes, cobrança, materiais, equipe e
// resultado próprios, sem misturar com o caixa, o financeiro, os clientes ou o estoque da loja.
import type { Funcionalidade } from '../../../shared/components/mapaModulo/mapaModulo';

export const FUNCIONALIDADES: Funcionalidade[] = [
  {
    chave: 'relatorio', titulo: 'Relatório técnico', etapa: 0, situacao: 'PRONTA',
    resumo: 'O formulário completo do poço e as impressões (relatório, cobrança, teste de vazão, garantia, formulário de campo).',
    oQueFaz: [
      'Dados do poço, perfuração e revestimento por camada, diagnóstico e bombeamento',
      'Teste de vazão com NE, ND, rebaixamento, vazão específica e gráfico',
      'Financeiro da obra: metros contratados, excedente, abatimento, adicionais e pagamentos',
      'Dentro da obra ele grava sozinho; aqui fica o relatório avulso (no navegador e em arquivo), para quando não há obra'
    ],
    dados: ['(no navegador e em arquivo XML, até a etapa 1)'],
    ligaCom: [],
  },
  {
    chave: 'obras', titulo: 'Obras e poços', etapa: 1, situacao: 'PRONTA',
    resumo: 'A lista de obras, a ficha permanente de cada poço e os clientes de poço: o relatório técnico passa a ser gravado na obra.',
    oQueFaz: [
      'Obra com os serviços dela: perfuração, instalação da bomba (junto ou separada), limpeza, manutenção, troca de bomba',
      'Situação: orçamento, aguardando sinal, em execução, concluída, cancelada (garantia contada da conclusão)',
      'Poço como ficha própria (inclusive os que outros perfuraram): local (GPS), profundidade, vazão, níveis, histórico de obras',
      'O formulário e as impressões de hoje abrem dentro da obra, com o cliente vindo do cadastro de clientes de poço',
      'Clientes de poço com cadastro próprio (nome e telefone bastam), separado dos clientes da loja por enquanto',
    ],
    dados: ['obra: cliente, poço, serviços, situação, datas, valores do contrato, relatório', 'poço: identificação, endereço, GPS, profundidade, diâmetro, vazão, NE/ND, solo, quem perfurou'],
    ligaCom: ['Mapa regional (ver no mapa a partir da obra, do poço e do cliente)'],
  },
  {
    chave: 'mapa', titulo: 'Mapa regional dos poços', etapa: 2, situacao: 'PRONTA',
    resumo: 'Todos os poços no mapa: antes de perfurar, a profundidade e a vazão dos poços da região dão a ideia de onde sai água.',
    oQueFaz: [
      'Poços dos clientes (cor pela situação da obra) e poços de referência da base pública, sem misturar',
      'Camada de potencial hídrico que liga e desliga (e o satélite)',
      'Ao clicar num ponto: poços num raio, profundidade média/mediana/faixa, vazão média e o potencial do local',
      'Estimativa de metros para a obra nova; clicar no poço mostra o cliente e abre a obra',
      'Referência e potencial lidos direto dos GeoJSON do maperf (fora do banco): região nova é só pôr o arquivo na pasta',
    ],
    dados: ['(no banco, só os poços dos clientes; a base pública fica nos arquivos do maperf)'],
    ligaCom: ['Obras e poços (etapa 1)', 'Orçamento da obra (etapa 3)'],
  },
  {
    chave: 'cobranca', titulo: 'Orçamento, sinal e cobrança', etapa: 3, situacao: 'PRONTA',
    resumo: 'Orçamento por metro, o sinal que libera o início da obra, adicionais aprovados pelo cliente e o saldo no contas a receber.',
    oQueFaz: [
      'Orçamento: metros previstos, valor do pacote, metro excedente, instalação e materiais à parte',
      'Sinal obrigatório: a obra só sai de "aguardando sinal" quando ele é recebido (ou no ato da perfuração)',
      'Adicionais com aprovação do cliente (registrada: por mensagem, assinatura ou presencial) entram no saldo',
      'Saldo à vista, parcelado ou sem prazo, a receber no próprio módulo (os clientes de poço não estão no cadastro geral)',
      'Metro excedente sugerido pelo relatório (perfurado além do previsto × valor do metro)',
      'Recebimentos e estornos (com motivo) só no módulo; lista "a receber de obras"',
    ],
    dados: ['sinal (valor, antes ou no ato)', 'adicionais (descrição, valor, aprovação: meio, data)', 'parcelas (sinal e saldo)', 'recebimentos'],
    ligaCom: ['Nada da loja: caixa e financeiro próprios do módulo'],
  },
  {
    chave: 'materiais', titulo: 'Materiais da obra', etapa: 4, situacao: 'PRONTA',
    resumo: 'Tubos, filtros, bomba, cabos, brita e conexões usados na obra, com o custo real dela (lista própria do módulo).',
    oQueFaz: [
      'Lista de materiais da obra (previstos no orçamento e usados de fato), com custo',
      'Cadastro próprio do módulo (tubo, filtro, bomba, cabo...) e item avulso; copiar a lista de uma obra parecida',
      'Custo congelado na linha (mudar o cadastro não mexe nas obras antigas); custo real = usado × custo',
      'Material cobrado à parte vira adicional da obra (o cliente aprova como os outros)',
    ],
    dados: ['obra', 'material (cadastro do módulo)', 'quantidade prevista e usada', 'custo'],
    ligaCom: ['Nada da loja: o estoque e o catálogo da loja não são tocados'],
  },
  {
    chave: 'agenda', titulo: 'Agenda, equipe e sonda', etapa: 5, situacao: 'PLANEJADA',
    resumo: 'Calendário das obras, quem trabalha em cada uma e qual sonda ou equipamento vai.',
    oQueFaz: [
      'Calendário das obras e das visitas de manutenção',
      'Quem vai e qual equipamento vai em cada obra',
      'Equipe e equipamentos (sonda, caminhão, compressor) cadastrados no próprio módulo',
    ],
    dados: ['obra', 'datas', 'equipe (cadastro do módulo)', 'equipamento'],
    ligaCom: ['Nada da loja'],
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
    ligaCom: ['Nada da loja: o painel é do próprio módulo'],
  },
];
