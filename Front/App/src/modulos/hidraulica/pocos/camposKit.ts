// Kit de visita › campos dos modelos: cada modelo marca onde entra cada informação com ⟦chave⟧; na hora de montar, o
// campo preenchido sai escrito e o vazio sai como linha de preencher. Os valores são os mesmos para todos os modelos da
// visita (o cliente digitado na proposta já aparece no contrato). Na pré-visualização o que falta fica marcado de
// amarelo e o campo em edição em amarelo forte (só na tela, nunca na impressão). Regras puras, com teste.
import { escapar } from './documentosPocos';

export type TipoCampo = 'texto' | 'longo' | 'numero' | 'moeda' | 'data' | 'extenso_data' | 'escolha';
export interface CampoKit {
  chave: string; rotulo: string; tipo: TipoCampo;
  /** Largura da linha em branco (mm); 0 = a largura toda. No campo longo, é o número de linhas. */
  largura: number;
  opcoes?: { valor: string; rotulo: string }[];
  sufixo?: string; dica?: string;
}
export type ValoresKit = Record<string, string | number | null | undefined>;

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const numero = (v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: 2 });

const C = (chave: string, rotulo: string, tipo: TipoCampo, largura: number, extra: Partial<CampoKit> = {}): CampoKit => ({ chave, rotulo, tipo, largura, ...extra });

/** Todos os campos que os modelos usam (cada um com o jeito de aparecer em branco e preenchido). */
export const CAMPOS_KIT: Record<string, CampoKit> = Object.fromEntries([
  C('doc_numero', 'Nº do documento', 'texto', 14), C('doc_data', 'Data do documento', 'data', 26),
  C('cliente_nome', 'Cliente (nome / razão social)', 'texto', 0), C('cliente_doc', 'CPF / CNPJ', 'texto', 0), C('cliente_rg', 'RG / IE', 'texto', 0),
  C('cliente_tel', 'Telefone / WhatsApp', 'texto', 0), C('cliente_email', 'E-mail', 'texto', 0),
  C('cliente_endereco', 'Endereço do cliente', 'texto', 70), C('cliente_num', 'Nº', 'texto', 12), C('cliente_bairro', 'Bairro', 'texto', 34),
  C('cliente_cidade', 'Cidade do cliente', 'texto', 34), C('cliente_uf', 'UF', 'texto', 8), C('cliente_cep', 'CEP', 'texto', 20),
  C('obra_endereco', 'Local da obra (endereço)', 'texto', 0), C('obra_cidade', 'Cidade / UF da obra', 'texto', 0), C('obra_ref', 'Referência / GPS', 'texto', 0),
  C('metros', 'Metragem base', 'numero', 12, { sufixo: 'm' }), C('valor_vista', 'Valor à vista', 'moeda', 24), C('valor_parcelado', 'Valor parcelado (cartão)', 'moeda', 24),
  C('valor_excedente', 'Valor do metro excedente', 'moeda', 20),
  C('motobomba', 'Conjunto motobomba', 'escolha', 0, { opcoes: [{ valor: 'INCLUSO', rotulo: 'Incluso' }, { valor: 'NAO', rotulo: 'Não incluso' }, { valor: 'A_PARTE', rotulo: 'À parte' }] }),
  C('motobomba_valor', 'Motobomba à parte (valor)', 'moeda', 14),
  C('prazo_dias', 'Prazo (dias úteis)', 'numero', 8), C('garantia_meses', 'Garantia (meses)', 'numero', 8), C('data_inicio', 'Início dos serviços', 'data', 26),
  C('sinal_pct', 'Sinal (%)', 'numero', 8), C('sinal_valor', 'Sinal (valor)', 'moeda', 24),
  C('sinal_quando', 'Sinal pago', 'escolha', 0, { opcoes: [{ valor: 'ASSINATURA', rotulo: 'na assinatura' }, { valor: 'CHEGADA', rotulo: 'na chegada do maquinário' }] }),
  C('saldo_valor', 'Saldo (valor)', 'moeda', 24),
  C('saldo_forma', 'Saldo pago', 'escolha', 0, { opcoes: [{ valor: 'FINAL', rotulo: 'ao final dos trabalhos' }, { valor: 'CARTAO', rotulo: 'parcelado' }] }),
  C('parcelas', 'Nº de parcelas', 'numero', 6), C('parcela_valor', 'Valor da parcela', 'moeda', 18),
  C('saldo_quando', 'Saldo pago quando/como', 'texto', 75, { dica: 'Ex.: ao final dos trabalhos, no PIX' }),
  C('observacoes', 'Observações da negociação', 'longo', 2),
  C('prof_contratada', 'Profundidade contratada', 'numero', 12, { sufixo: 'm' }), C('prof_atingida', 'Profundidade atingida', 'numero', 12, { sufixo: 'm' }),
  C('vazao', 'Vazão observada', 'texto', 0), C('solo', 'Condições do solo', 'texto', 130),
  C('metros_adicionais', 'Metros adicionais (máximo)', 'numero', 10), C('valor_metro', 'Valor por metro adicional', 'moeda', 18),
  C('pagamento_adicional', 'Pagamento da metragem adicional', 'texto', 85),
  C('ass_cidade', 'Cidade (assinatura)', 'texto', 40), C('ass_data', 'Data (assinatura)', 'extenso_data', 0),
].map(c => [c.chave, c]));

/** O campo pela chave (as quantidades da tabela de preços são qtd_0, qtd_1...). */
export const campoDe = (chave: string): CampoKit | undefined =>
  CAMPOS_KIT[chave] || (/^qtd_\d+$/.test(chave) ? C(chave, 'Quantidade', 'numero', 10) : undefined);

/** Campos calculados de outros (aparecem preenchidos quando a origem está preenchida). */
const CALCULADOS: Record<string, { origem: string[]; largura: number; valor: (v: ValoresKit, extenso: (n: number) => string) => string | null }> = {
  valor_vista_extenso: { origem: ['valor_vista'], largura: 80, valor: (v, ext) => (num(v.valor_vista) ? ext(num(v.valor_vista)!) : null) },
  valor_parcelado_extenso: { origem: ['valor_parcelado'], largura: 60, valor: (v, ext) => (num(v.valor_parcelado) ? ext(num(v.valor_parcelado)!) : null) },
  prof_total: { origem: ['prof_contratada', 'metros_adicionais'], largura: 10,
    valor: v => (num(v.prof_contratada) !== null && num(v.metros_adicionais) !== null ? numero(num(v.prof_contratada)! + num(v.metros_adicionais)!) : null) },
  // nome em cima da linha de assinatura: vazio não desenha outra linha (largura -1)
  nome_assinatura: { origem: ['cliente_nome'], largura: -1, valor: v => (preenchido(v.cliente_nome) ? String(v.cliente_nome) : null) },
  total_adicional: { origem: ['metros_adicionais', 'valor_metro'], largura: 24,
    valor: v => (num(v.metros_adicionais) !== null && num(v.valor_metro) !== null ? brl(Math.round(num(v.metros_adicionais)! * num(v.valor_metro)! * 100) / 100) : null) },
};

const num = (v: unknown) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
const preenchido = (v: unknown) => !(v === null || v === undefined || String(v).trim() === '');

const linhaBranca = (mm: number) => `<span class="campo" style="width:${mm ? `${mm}mm` : '100%'}"></span>`;
const caixa = (marcada: boolean) => `<span class="caixa${marcada ? ' marcada' : ''}"></span>`;

/** Como o valor aparece escrito (moeda, data, número com sufixo...). */
export const formatarCampo = (c: CampoKit, v: unknown): string => {
  if (c.tipo === 'moeda') return brl(Number(v));
  if (c.tipo === 'numero') return `${numero(Number(v))}${c.sufixo ? ` ${c.sufixo}` : ''}`;
  if (c.tipo === 'data' || c.tipo === 'extenso_data') {
    const s = String(v);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return escapar(s);
    return c.tipo === 'data' ? s.split('-').reverse().join('/') : `${Number(s.slice(8, 10))} de ${MESES[Number(s.slice(5, 7)) - 1]} de ${s.slice(0, 4)}`;
  }
  if (c.tipo === 'escolha') return escapar(c.opcoes?.find(o => o.valor === v)?.rotulo || String(v));
  if (c.tipo === 'longo') return escapar(String(v)).split(/\r?\n/).join('<br>');
  return escapar(String(v));
};

const embrulhar = (chave: string, conteudo: string, vazio: boolean) =>
  `<span class="cp${vazio ? ' cp-vazio' : ''}" data-campo="${chave}">${conteudo}</span>`;

/** Um campo pronto para a página: escrito (preenchido) ou a linha em branco; escolha vira as caixinhas com a marcada. */
export const campoHtml = (chave: string, valores: ValoresKit | null, extenso: (n: number) => string): string => {
  const calc = CALCULADOS[chave];
  if (calc) {
    const v = valores ? calc.valor(valores, extenso) : null;
    if (!v && calc.largura < 0) return '&nbsp;';
    return `<span class="cp${v ? '' : ' cp-vazio'}" data-campo="${calc.origem[0]}" data-origem="${calc.origem.join(' ')}">${v ? escapar(v) : linhaBranca(calc.largura)}</span>`;
  }
  const c = campoDe(chave);
  if (!c) return `⟦${chave}⟧`;
  const v = valores?.[chave];
  if (c.tipo === 'escolha') {
    return embrulhar(chave, (c.opcoes || []).map(o => `${caixa(v === o.valor)}${escapar(o.rotulo)}`).join(' '), !preenchido(v));
  }
  if (c.tipo === 'longo') {
    // bloco (várias linhas): div, para o fundo amarelo pintar as linhas inteiras
    const corpo = preenchido(v) ? `<p>${formatarCampo(c, v)}</p>` : Array.from({ length: c.largura || 1 }, () => `<p>${linhaBranca(0)}</p>`).join('');
    return `<div class="cp${preenchido(v) ? '' : ' cp-vazio'}" data-campo="${chave}">${corpo}</div>`;
  }
  if (c.tipo === 'extenso_data' && !preenchido(v)) return embrulhar(chave, `${linhaBranca(8)} de ${linhaBranca(28)} de ${linhaBranca(14)}`, true);
  if (preenchido(v)) return embrulhar(chave, `<b>${formatarCampo(c, v)}</b>`, false);
  // em branco: a linha, com o "R$" do dinheiro e a unidade do número ("____ m")
  return embrulhar(chave, `${c.tipo === 'moeda' ? 'R$ ' : ''}${linhaBranca(c.largura)}${c.sufixo ? ` ${c.sufixo}` : ''}`, true);
};

/** Troca todos os ⟦chave⟧ da página pelo campo (valores = null: tudo em branco). */
export const aplicarCampos = (html: string, valores: ValoresKit | null, extenso: (n: number) => string) =>
  html.replace(/⟦([a-z0-9_]+)⟧/g, (_, k: string) => campoHtml(k, valores, extenso));

/** Marcação ⟦chave⟧ para os modelos. */
export const K = (chave: string) => `⟦${chave}⟧`;

/** Estilo só da pré-visualização: o que falta em amarelo claro e o campo em edição em amarelo forte. */
export const destaquePrevia = (html: string, ativo: string | null, marcarVazios: boolean) => {
  const css = `<style>
    ${marcarVazios ? `.cp-vazio { background: #fff59d; border-radius: 2px; box-shadow: 0 0 0 1px #fff59d; }
      .cp { cursor: pointer; } .cp:hover { outline: 1.5px dashed #f59e0b; outline-offset: 1px; border-radius: 2px; }` : ''}
    ${ativo ? `[data-campo="${ativo}"], [data-origem~="${ativo}"] { background: #ffca28 !important; box-shadow: 0 0 0 2px #f59e0b !important; border-radius: 2px; }` : ''}
  </style>${ativo ? `<script>window.addEventListener('load',function(){var e=document.querySelector('[data-campo="${ativo}"]');if(e)e.scrollIntoView({block:'center'});});</script>` : ''}`;
  return html.replace('</head>', `${css}</head>`);
};

/** Quantos campos do modelo ainda estão vazios (para o contador da tela). */
export const camposVazios = (chaves: string[], valores: ValoresKit) =>
  chaves.filter(k => campoDe(k) && !preenchido(valores[k])).length;
