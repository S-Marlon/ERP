// Módulo Rolamentos (TRANSMISSAO_ROLAMENTOS): API e regras de SKU/nome (iguais às do backend).
const API = 'http://localhost:3001/api/modulos/transmissao/rolamentos';

export type TipoRolamento = 'RIGIDO_ESFERAS' | 'INSERCAO_UC' | 'AGULHAS' | 'ROLOS_CONICOS' | 'AUTOCOMPENSADOR' | 'ROLOS_CILINDRICOS' | 'AXIAL';
export type CampoAtributo = 'codigo' | 'vedacao' | 'folga' | 'linha' | 'diametroInterno' | 'diametroExterno' | 'largura';

export const TIPOS: Record<TipoRolamento, { familia: string; subcategoria: string; nomeCurto: string; comVedacao: boolean }> = {
  RIGIDO_ESFERAS: { familia: 'Rolamento rígido de esferas', subcategoria: 'Rígidos de esferas', nomeCurto: 'Rolamento', comVedacao: true },
  INSERCAO_UC: { familia: 'Rolamento de inserção (UC)', subcategoria: 'Inserção (UC)', nomeCurto: 'Rolamento de inserção', comVedacao: false },
  AGULHAS: { familia: 'Rolamento de agulhas', subcategoria: 'Agulhas', nomeCurto: 'Rolamento de agulha', comVedacao: true },
  ROLOS_CONICOS: { familia: 'Rolamento de rolos cônicos', subcategoria: 'Rolos cônicos', nomeCurto: 'Rolamento cônico', comVedacao: false },
  AUTOCOMPENSADOR: { familia: 'Rolamento autocompensador', subcategoria: 'Autocompensadores', nomeCurto: 'Rolamento autocompensador', comVedacao: false },
  ROLOS_CILINDRICOS: { familia: 'Rolamento de rolos cilíndricos', subcategoria: 'Rolos cilíndricos', nomeCurto: 'Rolamento de rolos cilíndricos', comVedacao: false },
  AXIAL: { familia: 'Rolamento axial', subcategoria: 'Axiais', nomeCurto: 'Rolamento axial', comVedacao: false },
};
export const VEDACOES = [
  { value: 'ABERTO', label: 'Aberto' }, { value: '2RS', label: '2RS (borracha)' }, { value: 'RS', label: 'RS (1 lado)' },
  { value: 'ZZ', label: 'ZZ (metálica)' }, { value: 'Z', label: 'Z (1 lado)' },
];
export const SIGLA_SEGUNDA_LINHA = '2L';

/** Família de um código (fica na subcategoria do tipo): Rolamento 6205, Rolamento UC207-20. */
export const nomeFamiliaDoCodigo = (codigo: string) => `Rolamento ${codigo.trim().toUpperCase()}`;
export const NOME_MARCA_SEGUNDA_LINHA = '2ª Linha';

export interface ConfigRolamentos {
  idCategoria?: number | null;
  subcategorias?: Partial<Record<TipoRolamento, number>>;  // Rolamentos › Rígidos de esferas... (famílias por código ficam nelas)
  familias?: Partial<Record<TipoRolamento, number>>;
  atributos?: Partial<Record<CampoAtributo, number>>;
  idMarcaSegundaLinha?: number | null;
  markup?: number;
  sufixos?: Record<string, string>; // significado dos códigos de fabricante definidos pelo operador
}
export interface MarcaModulo { id: number; nome: string; codigo: string | null; linha: 1 | 2 | null; apelidos: string[] }
export interface MedidaAprendida { idMedida: number; codigo: string; tipo: string | null; d: number | null; D: number | null; B: number | null }
export interface Medidas { d: number; D: number; B: number }
export interface Sufixo { codigo: string; categoria: string | null; significado: string | null; provavel?: boolean }

export interface LinhaAnalisada {
  chave: string; ehRolamento: boolean; tipo: TipoRolamento | null; codigo: string | null; vedacao: string; folga: string | null;
  codigoCompleto: string | null; prefixo: string | null; sufixos: Sufixo[]; marca: MarcaModulo | null; marcaTexto: string | null; linha: 1 | 2 | null;
  medidas: Medidas | null; origemMedidas: 'TABELA' | 'APRENDIDA' | null; sku: string | null; nome: string | null;
}
export interface ItemExistente { idItem: number; sku: string; nome: string; tipoRecurso: string; unidadeBase: string | null }

const requisitar = async <T>(url: string, init: RequestInit | undefined, erro: string): Promise<T> => {
  const response = await fetch(url, init);
  const dados = await response.json().catch(() => ({}));
  if (response.status === 404 && !dados.error) throw new Error('Rota não encontrada: reinicie o backend.');
  if (!response.ok) throw new Error(dados.error || erro);
  return dados as T;
};
const json = (metodo: string, corpo: unknown): RequestInit => ({ method: metodo, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) });

export const rolamentosApi = {
  config: () => requisitar<{
    configuracao: ConfigRolamentos; familias: Record<number, { id: number; nome: string; status: string }>;
    subcategorias: Record<number, { id: number; nome: string; familias: number }>;
    marcas: MarcaModulo[]; medidas: MedidaAprendida[];
  }>(`${API}/config`, undefined, 'Erro ao carregar a configuração de rolamentos.'),
  salvarConfig: (configuracao: ConfigRolamentos) => requisitar<{ configuracao: ConfigRolamentos }>(`${API}/config`, json('PUT', { configuracao }), 'Erro ao salvar a configuração.'),
  salvarMarca: (idMarca: number, linha: 1 | 2 | null, apelidos: string) => requisitar(`${API}/marcas/${idMarca}`, json('PUT', { linha, apelidos }), 'Erro ao salvar a marca.'),
  analisar: (linhas: Array<{ chave: string; descricao: string }>) =>
    requisitar<{ linhas: LinhaAnalisada[]; existentes: Record<string, ItemExistente>; configuracao: ConfigRolamentos }>(`${API}/analisar`, json('POST', { linhas }), 'Erro ao analisar.'),
  dicionario: () => requisitar<Array<{ codigo: string; categoria: string; significado: string }>>(`${API}/dicionario`, undefined, 'Erro ao carregar o dicionário.'),
  skus: (skus: string[]) => requisitar<{ existentes: Record<string, ItemExistente> }>(`${API}/skus`, json('POST', { skus }), 'Erro ao verificar SKUs.'),
  salvarMedidas: (lista: Array<{ codigo: string; tipo: string | null; d: number; D: number; B: number }>) =>
    requisitar(`${API}/medidas`, json('POST', { lista }), 'Erro ao salvar as medidas.'),
  renomear: (aplicar: boolean) => requisitar<{ total: number; aplicadas: number; mudancas: Array<{ idItem: number; sku: string; nomeAtual: string | null; nomeNovo: string }> }>(
    `${API}/renomear`, json('POST', { aplicar }), 'Erro ao renomear os itens.'),
  familias: (pares: Array<{ tipo: TipoRolamento; codigo: string }>) =>
    requisitar<{ familias: Record<string, { id: number; nome: string } | null> }>(`${API}/familias`, json('POST', { pares }), 'Erro ao buscar as famílias.'),
  itensParaReorganizar: () => requisitar<{ itens: Array<{ idItem: number; sku: string; nome: string | null; tipo: TipoRolamento | null; codigo: string; medidas: { d: number | null; D: number | null; B: number | null } }> }>(
    `${API}/reorganizar`, undefined, 'Erro ao listar os itens.'),
  moverItens: (movimentos: Array<{ idItem: number; idFamilia: number }>) =>
    requisitar<{ movidos: number }>(`${API}/reorganizar/mover`, json('POST', { movimentos }), 'Erro ao mover os itens.'),
  excluirMedida: (id: number) => requisitar(`${API}/medidas/${id}`, { method: 'DELETE' }, 'Erro ao excluir a medida.'),
};

export const siglaDaMarca = (marca: { nome: string; codigo: string | null } | null) =>
  (marca?.codigo || marca?.nome || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);

/** 6205-2RS-SKF (1ª linha), 6205-2RS-C3-2L (2ª linha), UC208-24-2L, HK2220-NTN. Rolamento aberto não leva vedação. */
export const montarSku = (p: { codigo: string; vedacao: string; folga: string | null; linha: 1 | 2; marca: { nome: string; codigo: string | null } | null }) =>
  [p.codigo.trim().toUpperCase(), p.vedacao && p.vedacao !== 'ABERTO' ? p.vedacao : null, p.folga, p.linha === 2 ? SIGLA_SEGUNDA_LINHA : siglaDaMarca(p.marca) || null]
    .filter(Boolean).join('-');

const mmNome = (v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: 3 });

/** ROLAMENTO 6205-2RS/C3 | 25 mm × 52 mm × 15 mm | SKF — 2ª linha termina em "2ª LINHA"; sem medidas, a parte do meio sai. */
export const montarNome = (p: {
  codigo: string; vedacao: string; folga: string | null; linha: 1 | 2; marca: { nome: string } | null;
  medidas?: { d: number | null; D: number | null; B: number | null } | null;
}) => {
  const codigo = `${p.codigo.trim().toUpperCase()}${p.vedacao && p.vedacao !== 'ABERTO' ? `-${p.vedacao}` : ''}${p.folga ? `/${p.folga}` : ''}`;
  const m = p.medidas;
  const medidas = m && m.d && m.D && m.B ? `${mmNome(m.d)} mm × ${mmNome(m.D)} mm × ${mmNome(m.B)} mm` : null;
  const marca = p.linha === 2 ? '2ª LINHA' : (p.marca?.nome || '').toUpperCase() || null;
  return [`ROLAMENTO ${codigo}`, medidas, marca].filter(Boolean).join(' | ');
};

const mm = (v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: 3 });

/** Descrição do item para o operador: tipo, medidas, código completo do fabricante e o que cada sufixo significa. */
export const montarDescricao = (p: {
  tipo: TipoRolamento; codigo: string; codigoCompleto: string | null; marca: string | null; linha: 1 | 2;
  medidas: { d: number | null; D: number | null; B: number | null }; sufixos: Sufixo[];
}) => {
  const linhas = [`${TIPOS[p.tipo].familia} ${p.codigo.toUpperCase()}${p.linha === 2 ? ' (2ª linha)' : p.marca ? ` ${p.marca}` : ''}`];
  const { d, D, B } = p.medidas;
  if (d && D && B) linhas.push(`Medidas: ${mm(d)} x ${mm(D)} x ${mm(B)} mm (furo x diâmetro externo x largura)`);
  if (p.codigoCompleto && p.codigoCompleto.toUpperCase() !== p.codigo.toUpperCase()) linhas.push(`Código do fabricante: ${p.codigoCompleto}`);
  const conhecidos = p.sufixos.filter(s => s.significado);
  for (const s of conhecidos) linhas.push(`• ${s.codigo}: ${s.significado}${s.provavel ? ' (provável)' : ''}`);
  const outros = p.sufixos.filter(s => !s.significado).map(s => s.codigo);
  if (outros.length) linhas.push(`Outros códigos do fabricante: ${outros.join(', ')}`);
  return linhas.join('\n');
};
