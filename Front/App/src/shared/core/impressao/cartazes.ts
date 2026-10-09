// Cartaz de atacado em folha A4 (impressora comum / PDF): preço de varejo + 2 ou 3 faixas de atacado, com a
// economia de cada faixa. Os modelos "com imagem" usam a foto principal do item; sem foto, saem como o modelo simples.
import { escolherCodigo, svgCodigoBarras } from './codigoBarras';
import { partesPreco } from './etiquetas';

export interface FaixaAtacado { quantidadeMinima: number; quantidadeMaxima?: number | null; preco: number }

export interface CartazDados {
  nome: string;
  sku: string;
  marca?: string;
  preco: number;            // varejo, na unidade de venda
  unidade?: string;
  gtin?: string;
  imagemUrl?: string | null;
  faixas: FaixaAtacado[];
  copias: number;
  // Ajustes do editor (só no cartaz; preço não se edita aqui: vem da precificação)
  /** Linha abaixo do nome (padrão: marca · SKU) */
  detalhe?: string;
  /** Destaque livre no rodapé, ex.: "Caixa com 50 unidades" */
  observacao?: string;
  mostrarVarejo?: boolean;
  mostrarCodigo?: boolean;
  /** Faixas que não vão para o cartaz (pela quantidade mínima) */
  faixasOcultas?: number[];
}

export type ModeloCartazId = 'A4_ATACADO_2' | 'A4_ATACADO_3' | 'A4_ATACADO_2_IMG' | 'A4_ATACADO_3_IMG';

export interface ModeloCartaz { id: ModeloCartazId; nome: string; faixas: 2 | 3; imagem: boolean; descricao: string }

export const MODELOS_CARTAZ: Record<ModeloCartazId, ModeloCartaz> = {
  A4_ATACADO_2: { id: 'A4_ATACADO_2', nome: 'Cartaz A4 · 2 faixas', faixas: 2, imagem: false, descricao: 'Varejo + 2 preços de atacado' },
  A4_ATACADO_3: { id: 'A4_ATACADO_3', nome: 'Cartaz A4 · 3 faixas', faixas: 3, imagem: false, descricao: 'Varejo + 3 preços de atacado' },
  A4_ATACADO_2_IMG: { id: 'A4_ATACADO_2_IMG', nome: 'Cartaz A4 · 2 faixas com imagem', faixas: 2, imagem: true, descricao: 'Com a foto do item' },
  A4_ATACADO_3_IMG: { id: 'A4_ATACADO_3_IMG', nome: 'Cartaz A4 · 3 faixas com imagem', faixas: 3, imagem: true, descricao: 'Com a foto do item' },
};

export const ehModeloCartaz = (id: string): id is ModeloCartazId => id in MODELOS_CARTAZ;

export interface OpcoesCartaz {
  titulo: string;           // ex.: ATACADO, LEVE MAIS PAGUE MENOS
  subtitulo?: string;
  validade?: string;        // AAAA-MM-DD
  /** Sem fundos chapados (gasta menos tinta) */
  economico?: boolean;
}

export const OPCOES_CARTAZ_PADRAO: OpcoesCartaz = { titulo: 'ATACADO', subtitulo: 'Quanto mais leva, menos paga', economico: false };

// ---------------------------------------------------------------- regras
const qtdBr = (q: number) => Number(q || 0).toLocaleString('pt-BR', { maximumFractionDigits: 3 });

export interface LinhaCartaz { rotulo: string; preco: number; economiaPct: number | null; quantidadeMinima: number }

/**
 * Linhas do cartaz: varejo e até `maximo` faixas de atacado (menores quantidades primeiro; faixa repetida ou
 * mais cara que o varejo fica de fora). Cada faixa vai até a próxima que aparece no cartaz ("3 a 10 BD") e a última
 * fica em aberto ("A partir de 11 BD"): com faixa oculta, a anterior cobre o intervalo dela e o rótulo continua certo.
 * A economia é sobre o varejo, arredondada para baixo (nunca promete a mais).
 */
export const linhasDoCartaz = (c: Pick<CartazDados, 'preco' | 'unidade' | 'faixas' | 'faixasOcultas'>, maximo: number) => {
  const un = c.unidade || 'UN';
  const faixas = [...c.faixas]
    .filter(f => f.preco > 0 && f.quantidadeMinima > 1 && (!(c.preco > 0) || f.preco < c.preco))
    .filter(f => !(c.faixasOcultas || []).includes(f.quantidadeMinima))
    .sort((a, b) => a.quantidadeMinima - b.quantidadeMinima)
    .filter((f, i, l) => i === 0 || f.quantidadeMinima !== l[i - 1].quantidadeMinima)
    .slice(0, maximo);
  const primeira = faixas[0]?.quantidadeMinima;
  const varejo: LinhaCartaz = {
    rotulo: primeira && primeira > 2 ? `1 a ${qtdBr(primeira - 1)} ${un}` : `1 ${un}`,
    preco: c.preco, economiaPct: null, quantidadeMinima: 1,
  };
  const atacado: LinhaCartaz[] = faixas.map((f, i) => {
    const ate = faixas[i + 1] ? faixas[i + 1].quantidadeMinima - 1 : null;
    return {
      rotulo: ate === null ? `A partir de ${qtdBr(f.quantidadeMinima)} ${un}`
        : ate > f.quantidadeMinima ? `${qtdBr(f.quantidadeMinima)} a ${qtdBr(ate)} ${un}` : `${qtdBr(f.quantidadeMinima)} ${un}`,
      quantidadeMinima: f.quantidadeMinima,
      preco: f.preco,
      economiaPct: c.preco > 0 ? Math.floor(((c.preco - f.preco) / c.preco) * 100) : null,
    };
  });
  return { varejo, atacado };
};

/** Tamanho do nome (mm) pelo comprimento: nome longo diminui para caber em até 3 linhas. */
export const tamanhoNome = (nome: string, comImagem: boolean) => {
  const n = String(nome || '').length;
  const base = n <= 28 ? 15 : n <= 50 ? 12 : n <= 80 ? 9.5 : 7.5;
  return comImagem ? base * 0.85 : base;
};

/** Tamanho do número do preço (mm): diminui quando a parte inteira tem muitos dígitos. */
export const tamanhoPreco = (preco: number, base: number) => {
  const digitos = partesPreco(preco).inteiro.length; // "1.234" conta o ponto
  return digitos <= 2 ? base : digitos <= 3 ? base * 0.85 : digitos <= 5 ? base * 0.68 : base * 0.55;
};

// ---------------------------------------------------------------- HTML
const escaparHtml = (t: string) => String(t || '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const dataBr = (iso?: string) => (iso && /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso.split('-').reverse().join('/') : '');
const urlSegura = (u?: string | null) => (u && /^(https?:\/\/|\/|data:image\/)/i.test(u) ? u : '');

const precoHtml = (preco: number, tamanhoMm: number) => {
  const { inteiro, centavos } = partesPreco(preco);
  const t = tamanhoPreco(preco, tamanhoMm);
  return `<span class="valor"><span class="rs" style="font-size:${(t * 0.3).toFixed(1)}mm">R$</span>`
    + `<span class="int" style="font-size:${t.toFixed(1)}mm">${inteiro}</span>`
    + `<span class="cent" style="font-size:${(t * 0.45).toFixed(1)}mm">,${centavos}</span></span>`;
};

const htmlUm = (c: CartazDados, modelo: ModeloCartaz, op: OpcoesCartaz): string => {
  const imagem = modelo.imagem ? urlSegura(c.imagemUrl) : '';
  const { varejo, atacado } = linhasDoCartaz(c, modelo.faixas);
  const codigo = escolherCodigo(c.gtin, c.sku);
  const barras = codigo && c.mostrarCodigo !== false ? svgCodigoBarras(codigo, 46, 9) : '';
  const detalhe = c.detalhe ?? [c.marca, c.sku].filter(Boolean).join(' · ');
  // Mais faixas ou imagem: menos altura para cada preço
  const basePreco = (atacado.length >= 3 ? 30 : 40) * (imagem ? 0.82 : 1);
  const ultima = atacado.length - 1;
  const validade = dataBr(op.validade);
  return `
<div class="cartaz${op.economico ? ' economico' : ''}">
  <div class="topo">
    <div class="titulo">${escaparHtml(op.titulo || 'ATACADO')}</div>
    ${op.subtitulo ? `<div class="subtitulo">${escaparHtml(op.subtitulo)}</div>` : ''}
  </div>
  <div class="produto${imagem ? ' com-imagem' : ''}">
    ${imagem ? `<div class="foto"><img src="${escaparHtml(imagem)}" alt=""></div>` : ''}
    <div class="ident">
      <div class="nome" style="font-size:${tamanhoNome(c.nome, !!imagem).toFixed(1)}mm">${escaparHtml(c.nome)}</div>
      ${detalhe ? `<div class="detalhe">${escaparHtml(detalhe)}</div>` : ''}
    </div>
  </div>
  ${c.mostrarVarejo === false ? '' : `<div class="linha varejo">
    <div class="rotulo"><span class="tipo">Varejo</span><span class="qtd">${escaparHtml(varejo.rotulo)}</span></div>
    ${precoHtml(varejo.preco, basePreco * 0.55)}
  </div>`}
  <div class="faixas">
    ${atacado.map((l, i) => `
    <div class="linha atacado${i === ultima ? ' melhor' : ''}">
      <div class="rotulo">
        <span class="qtd">${escaparHtml(l.rotulo)}</span>
        ${l.economiaPct && l.economiaPct > 0 ? `<span class="economia">economize ${l.economiaPct}%</span>` : ''}
        <span class="cada">preço de cada ${escaparHtml(c.unidade || 'UN')}</span>
      </div>
      ${precoHtml(l.preco, basePreco)}
    </div>`).join('')}
  </div>
  ${c.observacao ? `<div class="observacao">${escaparHtml(c.observacao)}</div>` : ''}
  <div class="rodape">
    <div class="avisos">${validade ? `Preços válidos até ${validade}.` : ''} Preço por ${escaparHtml(c.unidade || 'UN')}; o atacado vale para a quantidade na mesma compra.</div>
    ${barras ? `<div class="barras">${barras}<div class="cod">${escaparHtml(codigo!.valor)}</div></div>` : ''}
  </div>
</div>`;
};

export const CSS_CARTAZES = `
  .cartaz { --cor: #c8102e; --cor-txt: #fff; box-sizing: border-box; width: 210mm; height: 297mm; padding: 9mm; background: #fff; color: #111;
            font-family: Arial, Helvetica, sans-serif; display: flex; flex-direction: column; gap: 4mm; overflow: hidden; }
  .cartaz * { box-sizing: border-box; }
  .cartaz .topo { background: var(--cor); color: var(--cor-txt); border-radius: 4mm; padding: 4mm 6mm; text-align: center; }
  .cartaz .titulo { font-size: 22mm; font-weight: 900; line-height: 1; letter-spacing: 1mm; text-transform: uppercase; }
  .cartaz .subtitulo { font-size: 6mm; font-weight: 700; margin-top: 1.5mm; }
  .cartaz .produto { display: flex; gap: 5mm; align-items: center; min-height: 34mm; }
  .cartaz .produto .foto { flex: 0 0 62mm; height: 62mm; display: flex; align-items: center; justify-content: center; }
  .cartaz .produto .foto img { max-width: 100%; max-height: 100%; object-fit: contain; }
  .cartaz .ident { flex: 1; min-width: 0; }
  .cartaz .nome { font-weight: 800; line-height: 1.1; text-transform: uppercase; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
  .cartaz .detalhe { font-size: 4.5mm; color: #555; margin-top: 2mm; }
  .cartaz .linha { display: flex; align-items: center; justify-content: space-between; gap: 4mm; border: 0.8mm solid #222; border-radius: 4mm; padding: 2mm 6mm; }
  .cartaz .linha .rotulo { display: flex; flex-direction: column; gap: 1mm; min-width: 0; }
  .cartaz .linha .tipo { font-size: 5mm; font-weight: 800; text-transform: uppercase; }
  .cartaz .linha .qtd { font-size: 6.5mm; font-weight: 800; }
  .cartaz .varejo { border-width: 0.5mm; border-color: #999; }
  .cartaz .varejo .qtd { font-size: 5mm; font-weight: 600; }
  .cartaz .faixas { flex: 1; display: flex; flex-direction: column; gap: 4mm; min-height: 0; }
  .cartaz .atacado { flex: 1; }
  .cartaz .atacado .qtd { font-size: 9mm; line-height: 1.05; }
  .cartaz .economia { align-self: flex-start; background: #ffd400; color: #000; font-size: 5mm; font-weight: 800; padding: 0.8mm 3mm; border-radius: 2mm; text-transform: uppercase; }
  .cartaz .cada { font-size: 3.6mm; color: #555; }
  .cartaz .melhor { border: 1.6mm solid var(--cor); }
  .cartaz .melhor .valor { color: var(--cor); }
  .cartaz .valor { white-space: nowrap; font-weight: 900; line-height: 1; letter-spacing: -0.5mm; }
  .cartaz .valor .rs { font-weight: 800; margin-right: 2mm; vertical-align: top; }
  .cartaz .valor .cent { vertical-align: top; }
  .cartaz .observacao { font-size: 7mm; font-weight: 800; text-align: center; border: 0.6mm dashed #222; border-radius: 3mm; padding: 2mm; }
  .cartaz .rodape { display: flex; justify-content: space-between; align-items: flex-end; gap: 6mm; }
  .cartaz .avisos { font-size: 3.4mm; color: #555; }
  .cartaz .barras { text-align: center; flex: 0 0 auto; }
  .cartaz .barras svg { display: block; }
  .cartaz .barras .cod { font-size: 3mm; letter-spacing: 0.4mm; }
  /* Econômico: sem fundos chapados; a cor fica só em contornos e textos */
  .cartaz.economico .topo { background: #fff; color: var(--cor); border: 1.4mm solid var(--cor); }
  .cartaz.economico .economia { background: #fff; border: 0.6mm solid #000; }
  @media print { .cartaz { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
`;

/** Cartazes (com as cópias) em HTML, um por folha A4 em pé. */
export const gerarHtmlCartazes = (cartazes: CartazDados[], modeloId: ModeloCartazId, opcoes: OpcoesCartaz): string => {
  const modelo = MODELOS_CARTAZ[modeloId];
  const paginas = cartazes.flatMap(c => Array.from({ length: Math.max(1, Math.floor(c.copias || 1)) }, () => htmlUm(c, modelo, opcoes)));
  return `<!doctype html><html><head><meta charset="utf-8"><title>Cartazes de atacado</title><style>
    @page { size: A4 portrait; margin: 0; }
    html, body { margin: 0; padding: 0; }
    .pagina { page-break-after: always; break-after: page; }
    .pagina:last-child { page-break-after: auto; break-after: auto; }
    ${CSS_CARTAZES}
  </style></head><body>${paginas.map(p => `<div class="pagina">${p}</div>`).join('')}</body></html>`;
};

/** Só o cartaz (sem página), para pré-visualização na tela. */
export const htmlPreviewCartaz = (c: CartazDados, modeloId: ModeloCartazId, opcoes: OpcoesCartaz) =>
  htmlUm(c, MODELOS_CARTAZ[modeloId], opcoes);
