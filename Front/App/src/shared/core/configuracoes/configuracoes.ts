// Configurações do usuário e da empresa. Por enquanto ficam neste navegador (localStorage):
// não há login nem tabela de configurações no banco ainda. Regras puras + leitura/gravação segura.

export interface Perfil {
  nome: string;
  cargo: string;
  email: string;
  telefone: string;
}

export interface DadosEmpresa {
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  inscricaoEstadual: string;
  inscricaoMunicipal: string;
  regimeTributario: 'SIMPLES' | 'PRESUMIDO' | 'REAL' | '';
  logradouro: string;
  numero: string;
  bairro: string;
  cidade: string;
  uf: string;
  cep: string;
  telefone: string;
  email: string;
  logoUrl: string;
}

export interface Preferencias {
  itensPorPagina: number;
  casasDecimaisPreco: number;
  casasDecimaisQuantidade: number;
  somNoPdv: boolean;
  confirmarAoSairComAlteracoes: boolean;
}

export type TipoNotificacao =
  | 'NOTAS_EM_CONFERENCIA' | 'ABAIXO_MINIMO' | 'ESTOQUE_NEGATIVO'
  | 'PIM_CRITICOS' | 'SEM_PRECO' | 'CUSTO_DEFASADO' | 'DUPLICADOS';

export interface PreferenciasNotificacao {
  ativas: Record<TipoNotificacao, boolean>;
  intervaloMinutos: number;
}

export interface Configuracoes {
  perfil: Perfil;
  empresa: DadosEmpresa;
  preferencias: Preferencias;
  notificacoes: PreferenciasNotificacao;
}

export const CONFIG_PADRAO: Configuracoes = {
  perfil: { nome: 'Usuário', cargo: 'Administrador', email: '', telefone: '' },
  empresa: {
    razaoSocial: '', nomeFantasia: '', cnpj: '', inscricaoEstadual: '', inscricaoMunicipal: '', regimeTributario: '',
    logradouro: '', numero: '', bairro: '', cidade: '', uf: '', cep: '', telefone: '', email: '', logoUrl: '',
  },
  preferencias: { itensPorPagina: 50, casasDecimaisPreco: 2, casasDecimaisQuantidade: 3, somNoPdv: true, confirmarAoSairComAlteracoes: true },
  notificacoes: {
    ativas: {
      NOTAS_EM_CONFERENCIA: true, ABAIXO_MINIMO: true, ESTOQUE_NEGATIVO: true,
      PIM_CRITICOS: true, SEM_PRECO: true, CUSTO_DEFASADO: true, DUPLICADOS: true,
    },
    intervaloMinutos: 5,
  },
};

const CHAVE = 'erp.configuracoes';

/** Junta o salvo com o padrão (campos novos ganham o valor padrão; lixo é ignorado). */
export const mesclarConfiguracoes = (salvo: unknown): Configuracoes => {
  const s = (salvo && typeof salvo === 'object' ? salvo : {}) as Partial<Configuracoes>;
  return {
    perfil: { ...CONFIG_PADRAO.perfil, ...(s.perfil || {}) },
    empresa: { ...CONFIG_PADRAO.empresa, ...(s.empresa || {}) },
    preferencias: { ...CONFIG_PADRAO.preferencias, ...(s.preferencias || {}) },
    notificacoes: {
      intervaloMinutos: Number(s.notificacoes?.intervaloMinutos) > 0 ? Number(s.notificacoes?.intervaloMinutos) : CONFIG_PADRAO.notificacoes.intervaloMinutos,
      ativas: { ...CONFIG_PADRAO.notificacoes.ativas, ...(s.notificacoes?.ativas || {}) },
    },
  };
};

export const lerConfiguracoes = (): Configuracoes => {
  try {
    return mesclarConfiguracoes(JSON.parse(localStorage.getItem(CHAVE) || 'null'));
  } catch {
    return mesclarConfiguracoes(null);
  }
};

export const gravarConfiguracoes = (c: Configuracoes) => {
  try { localStorage.setItem(CHAVE, JSON.stringify(c)); } catch { /* armazenamento indisponível */ }
};

export const formatarCnpj = (v: string) => {
  const d = String(v || '').replace(/\D/g, '').slice(0, 14);
  return d.replace(/^(\d{2})(\d)/, '$1.$2').replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d)/, '.$1/$2').replace(/(\d{4})(\d)/, '$1-$2');
};

/** Dígitos verificadores do CNPJ. */
export const cnpjValido = (v: string): boolean => {
  const d = String(v || '').replace(/\D/g, '');
  if (d.length !== 14 || /^(\d)\1+$/.test(d)) return false;
  const calc = (base: string, pesos: number[]) => {
    const soma = base.split('').reduce((a, n, i) => a + Number(n) * pesos[i], 0);
    const r = soma % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const d1 = calc(d.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = calc(d.slice(0, 12) + d1, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return d.endsWith(`${d1}${d2}`);
};
