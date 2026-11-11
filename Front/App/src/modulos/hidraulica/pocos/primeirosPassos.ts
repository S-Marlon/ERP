// Central › Primeiros passos: o que deixar pronto antes do primeiro orçamento (empresa no PDF, contrato, equipe,
// sonda, materiais, primeiro cliente e orçamento). Some sozinho quando tudo está feito. Regras puras, com teste.

export interface EstadoInicial {
  empresaNome: string | null; empresaTelefone: string | null; logo: string | null; responsavelTecnico: string | null; foroCidade: string | null;
  equipe: number; equipamentos: number; materiais: number; clientes: number; obras: number;
}

export type ChavePasso = 'EMPRESA' | 'CONTRATO' | 'EQUIPE' | 'EQUIPAMENTOS' | 'MATERIAIS' | 'CLIENTE' | 'ORCAMENTO';
export interface PassoInicial { chave: ChavePasso; titulo: string; descricao: string; feito: boolean }

export const primeirosPassos = (e: EstadoInicial): PassoInicial[] => [
  {
    chave: 'EMPRESA', titulo: 'Dados da empresa e logo', feito: !!(e.empresaNome && e.empresaTelefone && e.logo),
    descricao: 'Saem no cabeçalho do orçamento, do contrato e do laudo.',
  },
  {
    chave: 'CONTRATO', titulo: 'Contrato: foro e responsável técnico', feito: !!(e.foroCidade && e.responsavelTecnico),
    descricao: 'O modelo de cláusulas já vem pronto; revise com o advogado quando puder.',
  },
  { chave: 'EQUIPE', titulo: 'Equipe de campo', feito: e.equipe > 0, descricao: 'Quem vai nas obras (para a agenda).' },
  { chave: 'EQUIPAMENTOS', titulo: 'Sonda e equipamentos', feito: e.equipamentos > 0, descricao: 'Para a agenda avisar quando estiverem em duas obras.' },
  { chave: 'MATERIAIS', titulo: 'Materiais com custo', feito: e.materiais > 0, descricao: 'Tubos, filtros, bombas: o custo da obra sai daqui.' },
  { chave: 'CLIENTE', titulo: 'Primeiro cliente', feito: e.clientes > 0, descricao: 'Ou deixe o orçamento rápido cadastrar junto.' },
  { chave: 'ORCAMENTO', titulo: 'Primeiro orçamento', feito: e.obras > 0, descricao: 'Orçamento rápido: itens, condições e o PDF.' },
];

/** Mostra o quadro enquanto faltar algum passo. */
export const faltaComecar = (passos: PassoInicial[]) => passos.some(p => !p.feito);
