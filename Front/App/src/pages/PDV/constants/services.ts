/**
 * SERVICE_CATALOG
 * Catálogo de serviços disponíveis para Ordens de Serviço
 * Centralizado para fácil manutenção e atualização
 */

export interface ServiceItem {
  id: string;
  name: string;
  description: string;
  price: number;
  category: 'Montagem' | 'Manutenção' | 'Serviço Técnico' | 'Mão de obra';
}

export const SERVICE_CATALOG: ServiceItem[] = [
 {
    id: 'svc-prensagem-std',
    name: 'Prensagem de Mangueira (Padrão)',
    description: 'Serviço de montagem e prensagem de terminais em mangueiras hidráulicas de 1 ou 2 tramas, bitolas de 1/4" até 3/4".',
    price: 35.0, // Preço médio para bitolas pequenas
    category: 'Montagem',
  },
  {
    id: 'svc-prensagem-heavy', // ID alterado para diferenciar
    name: 'Prensagem de Mangueira (Grande Porte)',
    description: 'Serviço de montagem e prensagem de terminais em mangueiras de alta pressão ou industriais, bitolas de 1" até 2.1/2".',
    price: 45.0, // Sugestão: o valor costuma ser maior pela complexidade e maquinário
    category: 'Montagem',
  },
  {
    id: 'svc-prensagem-super',
    name: 'Prensagem de Alta Pressão',
    description: 'Montagem técnica para mangueiras de 4 a 6 tramas de aço (Super Alta Pressão).',
    price: 85.0,
    category: 'Montagem',
  },
  {
    id: 'svc-recuperacao-term',
    name: 'Recuperação de Terminal',
    description: 'Limpeza e recondicionamento de terminais especiais para reaproveitamento seguro.',
    price: 35.0,
    category: 'Manutenção',
  },
  {
    id: 'svc-limpeza-quimica',
    name: 'Limpeza e Descontaminação',
    description: 'Limpeza interna do conjunto montado para evitar contaminação no sistema hidráulico.',
    price: 25.0,
    category: 'Serviço Técnico',
  },
  {
    id: 'svc-teste-estatico',
    name: 'Teste de Estanqueidade',
    description: 'Teste de pressão em bancada para garantir a segurança da montagem.',
    price: 50.0,
    category: 'Serviço Técnico',
  },
  {
    id: 'svc-visita-campo',
    name: 'Atendimento Móvel / Campo',
    description: 'Deslocamento técnico para diagnóstico e medição de mangueiras no local.',
    price: 120.0,
    category: 'Mão de obra',
  },
  {
    id: 'svc-identificacao-tag',
    name: 'Identificação por Tag',
    description: 'Etiquetagem técnica para controle de validade e rastreabilidade da mangueira.',
    price: 10.0,
    category: 'Serviço Técnico',
  },
];

/**
 * Agrupa serviços por categoria
 */
export const groupServicesByCategory = () => {
  return SERVICE_CATALOG.reduce((acc, service) => {
    if (!acc[service.category]) {
      acc[service.category] = [];
    }
    acc[service.category].push(service);
    return acc;
  }, {} as Record<string, ServiceItem[]>);
};

/**
 * Busca serviço por ID
 */
export const findServiceById = (id: string): ServiceItem | undefined => {
  return SERVICE_CATALOG.find(s => s.id === id);
};
