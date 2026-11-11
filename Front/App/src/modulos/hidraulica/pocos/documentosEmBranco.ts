// Kit de visita: modelos para imprimir e levar ao cliente (proposta, tabela de preços de referência, contrato e
// autorização de metragem adicional), em branco ou já preenchidos com o que o vendedor souber (o resto sai em linha para
// preencher à mão). Usam o logo, os dados da empresa e o modelo de contrato da configuração. Os campos ficam em
// camposKit.ts. Funções puras: devolvem a página HTML (a mesma montagem dos documentos da obra).
import type { ConfigProcesso } from './obrasApi';
import { ITENS_PRONTOS } from './obrasApi';
import {
  blocoAssinaturas, brl, cabecalho, celula, CONDICOES_ORCAMENTO, escapar, listaCondicoes, modeloEmHtml, MODELO_CONTRATO_PADRAO, pagina,
  qualificacaoEmpresa, RODAPE_PAGINAS, RODAPE_VISTO, valorPorExtenso,
} from './documentosPocos';
import { aplicarCampos, K, ValoresKit } from './camposKit';

export type ModeloBranco = 'PROPOSTA' | 'TABELA' | 'CONTRATO' | 'AUTORIZACAO';

export const MODELOS_BRANCO: { id: ModeloBranco; titulo: string; descricao: string }[] = [
  { id: 'PROPOSTA', titulo: 'Proposta comercial', descricao: 'Uma folha: cliente, local, metragem base e valor, motobomba, prazo, pagamento e condições gerais.' },
  { id: 'TABELA', titulo: 'Tabela de preços de referência', descricao: 'Os itens da planilha da empresa com o valor de referência; com as quantidades, os totais saem calculados.' },
  { id: 'CONTRATO', titulo: 'Contrato', descricao: 'O contrato da configuração com os dados do cliente, valores (por extenso) e datas.' },
  { id: 'AUTORIZACAO', titulo: 'Autorização de metragem adicional', descricao: 'Para o cliente assinar na obra quando for preciso perfurar além do contratado.' },
];

/** Campos de cada modelo, em grupos (a ordem do formulário). As quantidades da tabela são qtd_0, qtd_1... */
export const CAMPOS_DO_MODELO: Record<ModeloBranco, { grupo: string; chaves: string[] }[]> = {
  PROPOSTA: [
    { grupo: 'Documento', chaves: ['doc_numero', 'doc_data'] },
    { grupo: 'Cliente', chaves: ['cliente_nome', 'cliente_doc', 'obra_endereco', 'cliente_tel'] },
    { grupo: 'Escopo e investimento', chaves: ['metros', 'valor_vista', 'valor_parcelado', 'motobomba', 'motobomba_valor', 'prazo_dias'] },
    { grupo: 'Pagamento', chaves: ['sinal_pct', 'sinal_valor', 'sinal_quando', 'saldo_valor', 'saldo_forma', 'parcelas', 'parcela_valor'] },
    { grupo: 'Observações e assinatura', chaves: ['observacoes', 'ass_cidade', 'ass_data'] },
  ],
  TABELA: [
    { grupo: 'Cliente', chaves: ['cliente_nome', 'obra_endereco', 'doc_data'] },
    { grupo: 'Quantidades', chaves: ITENS_PRONTOS.map((_, i) => `qtd_${i}`) },
  ],
  CONTRATO: [
    { grupo: 'Documento', chaves: ['doc_numero', 'doc_data'] },
    { grupo: 'Contratante', chaves: ['cliente_nome', 'cliente_doc', 'cliente_rg', 'cliente_endereco', 'cliente_num', 'cliente_bairro', 'cliente_cidade', 'cliente_uf', 'cliente_cep'] },
    { grupo: 'Obra', chaves: ['obra_endereco', 'obra_cidade', 'data_inicio', 'prazo_dias', 'metros', 'garantia_meses'] },
    { grupo: 'Valores', chaves: ['valor_vista', 'valor_parcelado', 'valor_excedente', 'sinal_valor', 'sinal_pct', 'saldo_valor', 'saldo_quando'] },
    { grupo: 'Assinatura', chaves: ['ass_data'] },
  ],
  AUTORIZACAO: [
    { grupo: 'Documento', chaves: ['doc_numero'] },
    { grupo: 'Cliente', chaves: ['cliente_nome', 'cliente_doc', 'cliente_rg', 'cliente_tel', 'cliente_email', 'obra_endereco', 'obra_cidade', 'obra_ref'] },
    { grupo: 'Situação na obra', chaves: ['prof_contratada', 'prof_atingida', 'vazao', 'solo'] },
    { grupo: 'Autorização', chaves: ['metros_adicionais', 'valor_metro', 'pagamento_adicional', 'ass_cidade', 'ass_data'] },
  ],
};

/** Pacote padrão da proposta (das propostas da empresa): preenche metragem e valores de uma vez. */
export const PADRAO_PROPOSTA: ValoresKit = { metros: 60, valor_vista: 18000, valor_parcelado: 19000 };

const fichaCliente = () => `<div class="ficha branco">
  ${celula('Cliente (contratante)', K('cliente_nome'), true)}
  ${celula('CPF / CNPJ', K('cliente_doc'))}${celula('RG / IE', K('cliente_rg'))}
  ${celula('Telefone / WhatsApp', K('cliente_tel'))}${celula('E-mail', K('cliente_email'))}
  ${celula('Local da obra (endereço)', K('obra_endereco'), true)}
  ${celula('Cidade / UF', K('obra_cidade'))}${celula('Referência / GPS', K('obra_ref'))}
</div>`;

/** Proposta "basicão" (uma folha): só o essencial do cliente. */
const fichaClienteCurta = () => `<div class="ficha branco">
  ${celula('Cliente (contratante)', K('cliente_nome'))}${celula('CPF / CNPJ', K('cliente_doc'))}
  ${celula('Local da obra (endereço e cidade)', K('obra_endereco'))}${celula('Telefone / WhatsApp', K('cliente_tel'))}
</div>`;

const localData = () => `<p class="local-data">${K('ass_cidade')}, ${K('ass_data')}.</p>`;

/** Valor de referência do metro excedente (da planilha da empresa). */
const excedenteReferencia = () => ITENS_PRONTOS.find(p => p.item.opcional && p.item.grupo === 'PERFURACAO')?.item.valorUnitario || null;

const proposta = (e: ConfigProcesso, logo: string | null) => {
  const exc = excedenteReferencia();
  return pagina('Proposta comercial', `<div class="compacta">${cabecalho({ empresa: e }, logo, { tipo: 'Proposta comercial', numero: `Nº ${K('doc_numero')}`, data: `Data: ${K('doc_data')}` })}
    <h1>Proposta comercial · perfuração de poço artesiano</h1>
    <div class="sub">Prestação de serviços de perfuração de poço tubular profundo</div>
    ${fichaClienteCurta()}
    <h2><span class="n">1</span>Escopo e investimento</h2>
    <table class="itens"><tr><th>Descrição do serviço</th><th class="n">Metragem base</th><th class="n">Valor à vista</th><th class="n">Valor parcelado</th></tr>
      <tr><td>Perfuração de poço artesiano<br><span class="nota">Inclui os materiais da metragem base e o teste de vazão.</span></td>
        <td class="n">${K('metros')}</td><td class="n">${K('valor_vista')}</td><td class="n">${K('valor_parcelado')}</td></tr>
    </table>
    <div class="ficha branco" style="margin-top:3mm">
      ${celula('Conjunto motobomba', `${K('motobomba')} ${K('motobomba_valor')}`)}
      ${celula('Prazo estimado', `${K('prazo_dias')} dias úteis após o início <small>· sujeito ao clima e ao solo</small>`)}
    </div>
    <p class="nota" style="margin-top:2.5mm"><b>Metragem adicional (caso necessário):</b> se a metragem base for atingida sem vazão suficiente, a continuidade dependerá de nova
      autorização do cliente, ao valor ${exc ? `inicial de ${brl(exc)}` : `de ${K('valor_excedente')}`} por metro, podendo ser readequado conforme o solo e a profundidade, com o preço final aprovado antes do reinício.</p>
    <h2><span class="n">2</span>Forma de pagamento</h2>
    <div class="ficha branco">
      ${celula('Sinal / entrada', `${K('sinal_pct')}% = ${K('sinal_valor')} &nbsp; ${K('sinal_quando')}`, true)}
      ${celula('Saldo', `${K('saldo_valor')} &nbsp; ${K('saldo_forma')} em ${K('parcelas')}× de ${K('parcela_valor')} no cartão <small>(com o repasse das taxas da maquininha)</small>`, true)}
    </div>
    <h2><span class="n">3</span>Observações da negociação</h2>
    ${K('observacoes')}
    <h2><span class="n">4</span>Condições gerais</h2>${listaCondicoes(CONDICOES_ORCAMENTO.filter(t => !t.startsWith('Metragem adicional')))}
    ${localData()}
    ${blocoAssinaturas([{ nome: escapar(e.empresaNome || 'Empresa'), papel: 'Contratada' }, { nome: '', papel: 'Cliente · nome e assinatura' }])}</div>`);
};

const L = (n: number) => '_'.repeat(n);            // linha de preencher sem campo (vira linha na página)
const LINHA = '<span class="campo" style="width:100%"></span>';

const tabela = (e: ConfigProcesso, logo: string | null, v: ValoresKit | null) => {
  const qtd = (i: number) => (v && Number(v[`qtd_${i}`]) > 0 ? Number(v[`qtd_${i}`]) : null);
  const total = (i: number) => { const q = qtd(i); const p = ITENS_PRONTOS[i].item; return q !== null && !p.incluso ? Math.round(q * p.valorUnitario * 100) / 100 : null; };
  const celTotal = (i: number) => {
    const p = ITENS_PRONTOS[i].item;
    if (p.incluso) return '<span class="pill">Incluso</span>';
    const t = total(i);
    return `<span class="cp${t === null ? ' cp-vazio' : ''}" data-campo="qtd_${i}">${t === null ? `R$ ${L(8)}` : `<b>${brl(t)}</b>`}</span>`;
  };
  const linha = (i: number) => { const p = ITENS_PRONTOS[i].item; return `<tr${p.opcional ? ' class="opcional"' : ''}><td>${escapar(p.descricao)}</td>
    <td class="n">${K(`qtd_${i}`)}</td><td class="n">${escapar(p.unidade)}</td><td class="n">${p.valorUnitario ? brl(p.valorUnitario) : '—'}</td>
    <td class="n">${celTotal(i)}</td></tr>`; };
  const indices = ITENS_PRONTOS.map((_, i) => i);
  const base = indices.filter(i => !ITENS_PRONTOS[i].item.opcional), opc = indices.filter(i => ITENS_PRONTOS[i].item.opcional);
  const somados = base.map(total).filter((t): t is number => t !== null);
  const geral = somados.length ? `<b>${brl(somados.reduce((s, t) => s + Math.round(t * 100), 0) / 100)}</b>` : `R$ ${L(9)}`;
  const livre = `<tr><td>${LINHA}</td><td class="n">${L(4)}</td><td class="n">${L(2)}</td><td class="n">R$ ${L(7)}</td><td class="n">R$ ${L(8)}</td></tr>`;
  return pagina('Tabela de preços de referência', `${cabecalho({ empresa: e }, logo, { tipo: 'Tabela de preços', numero: 'Referência', data: `Data: ${K('doc_data')}` })}
    <h1>Tabela de preços de referência</h1>
    <div class="sub">Perfuração 6" por faixa de solo, materiais e serviços · preencha a quantidade e o total com o cliente</div>
    <div class="ficha branco">${celula('Cliente', K('cliente_nome'))}${celula('Local da obra', K('obra_endereco'))}</div>
    <h2><span class="n">1</span>Itens</h2>
    <table class="itens"><tr><th>Item</th><th class="n">Qtd.</th><th class="n">Un.</th><th class="n">Valor unit. (ref.)</th><th class="n">Total</th></tr>
      ${base.map(linha).join('')}${livre}${livre}
      <tr class="total"><td colspan="4">Total geral${somados.length ? ' <span class="nota">(itens com quantidade)</span>' : ''}</td><td class="n">${geral}</td></tr>
      <tr class="grupo"><td colspan="5">Se necessário, não incluso no total · cobrado só se for usado</td></tr>
      ${opc.map(linha).join('')}
    </table>
    <p class="rodape">Valores de referência da empresa: podem mudar conforme o solo, a profundidade, a cidade e o acesso ao local. Itens "incluso" fazem parte
      do pacote e não somam no total.</p>`);
};

const contrato = (e: ConfigProcesso, logo: string | null) => {
  const campos: Record<string, string> = {
    numero: K('doc_numero'), empresa: e.empresaNome || L(25), empresa_qualificacao: qualificacaoEmpresa({ empresa: e }), cliente: K('cliente_nome'),
    cliente_qualificacao: `${K('cliente_nome')}, CPF/CNPJ nº ${K('cliente_doc')}, RG/IE nº ${K('cliente_rg')}, residente/sediado em ${K('cliente_endereco')}, nº ${K('cliente_num')}, bairro ${K('cliente_bairro')}, cidade ${K('cliente_cidade')}/${K('cliente_uf')}, CEP ${K('cliente_cep')}`,
    local_obra: `${K('obra_endereco')}, ${K('obra_cidade')}`, servicos: 'perfuração de poço tubular profundo (poço artesiano), instalação de bomba submersa e teste de vazão',
    escopo: '', metros: `${K('metros')}`, valor_total: K('valor_vista'), valor_total_extenso: K('valor_vista_extenso'),
    condicao_parcelada: ` à vista, ou ${K('valor_parcelado')} (${K('valor_parcelado_extenso')}) se parcelado no cartão de crédito`, valor_parcelado: K('valor_parcelado'),
    valor_metro_excedente: K('valor_excedente'), sinal: `Sinal/entrada: ${K('sinal_valor')} (${K('sinal_pct')}%), pago no ato da assinatura deste contrato.`,
    forma_pagamento: `Saldo restante: ${K('saldo_valor')}, pago ${K('saldo_quando')}.`, prazo_dias: K('prazo_dias'), data_inicio: K('data_inicio'), garantia_meses: K('garantia_meses'),
    texto_garantia: e.textoGarantia || '', foro: e.foroCidade || L(20), responsavel_tecnico: e.responsavelTecnico || '', registro_tecnico: e.registroTecnico || '',
    cidade_data: `${e.foroCidade || L(20)}, ${K('ass_data')}`, data_contrato: K('doc_data'),
  };
  const corpo = modeloEmHtml(e.modeloContrato || MODELO_CONTRATO_PADRAO, campos, { tabela_itens: '' });
  return pagina('Contrato', `<div class="pagina-contrato">${cabecalho({ empresa: e }, logo, { tipo: 'Contrato', numero: `Nº ${K('doc_numero')}`, data: `Data: ${K('doc_data')}` })}<div class="contrato" style="text-align:left">${corpo}</div>
    ${blocoAssinaturas([
      { nome: escapar(e.empresaNome || ''), papel: `CONTRATADA${e.empresaRepresentante ? `<br>${escapar(e.empresaRepresentante)}` : ''}` },
      { nome: K('nome_assinatura'), papel: 'CONTRATANTE · nome e assinatura' }, { nome: '', papel: 'Testemunha 1 · nome e CPF' }, { nome: '', papel: 'Testemunha 2 · nome e CPF' },
    ], true)}</div>`, RODAPE_VISTO + RODAPE_PAGINAS);
};

const autorizacao = (e: ConfigProcesso, logo: string | null) => pagina('Autorização de metragem adicional', `${cabecalho({ empresa: e }, logo,
  { tipo: 'Autorização', numero: 'Metragem adicional', data: `Contrato nº ${K('doc_numero')}` })}
  <h1>Autorização de continuidade da perfuração</h1>
  <div class="sub">Metragem adicional além da profundidade contratada</div>
  ${fichaCliente()}
  <h2><span class="n">1</span>Situação na obra</h2>
  <div class="ficha tres branco">
    ${celula('Profundidade contratada', K('prof_contratada'))}${celula('Profundidade atingida', K('prof_atingida'))}${celula('Vazão observada', K('vazao'))}
  </div>
  <p style="margin-top:2.5mm">Condições do solo: ${K('solo')}</p>
  <h2><span class="n">2</span>Autorização</h2>
  <p>Eu, cliente acima identificado, autorizo <b>${escapar(e.empresaNome || 'a empresa contratada')}</b> a continuar a perfuração do poço além da profundidade
    contratada, até no máximo ${K('metros_adicionais')} <b>metros adicionais</b> (profundidade total de até ${K('prof_total')} m), ao valor de ${K('valor_metro')} <b>por metro</b>
    adicional perfurado, totalizando no máximo ${K('total_adicional')}.</p>
  <p>Estou ciente de que a perfuração é obrigação de meio e não de resultado: não há garantia de vazão, quantidade ou qualidade da água, e os metros
    efetivamente perfurados serão cobrados mesmo que não se encontre a vazão desejada.</p>
  <p>O valor da metragem adicional será pago ${K('pagamento_adicional')}.</p>
  ${localData()}
  ${blocoAssinaturas([{ nome: K('nome_assinatura'), papel: 'Cliente · nome e assinatura' }, { nome: escapar(e.empresaNome || ''), papel: 'Responsável pela obra' }])}`);

/**
 * Página HTML do modelo (com a impressão automática, como os outros documentos). valores = null: tudo em branco;
 * com valores, o que estiver preenchido sai escrito e o resto em linha para preencher à mão.
 */
export const htmlEmBranco = (id: ModeloBranco, empresa: ConfigProcesso, logo: string | null, valores: ValoresKit | null = null) => {
  const html = id === 'PROPOSTA' ? proposta(empresa, logo) : id === 'TABELA' ? tabela(empresa, logo, valores)
    : id === 'CONTRATO' ? contrato(empresa, logo) : autorizacao(empresa, logo);
  return aplicarCampos(html, valores, valorPorExtenso);
};

/** Para a pré-visualização: a mesma página sem abrir a impressão sozinha. */
export const semImpressao = (html: string) => html.replace(/<script>window\.onload[\s\S]*?<\/script>/g, '');

/** Vários documentos numa impressão só: um estilo e cada documento começando numa folha nova. */
export const juntarPaginas = (htmls: string[]) => {
  if (htmls.length <= 1) return htmls[0] || '';
  const corpo = (h: string) => semImpressao(h).match(/<body[^>]*>([\s\S]*)<\/body>/)?.[1] || '';
  const juntas = htmls.map((h, i) => `<div style="${i ? 'break-before: page; page-break-before: always;' : ''}">${corpo(h)}</div>`).join('');
  // impressos juntos, o contrato mantém o visto em todas as folhas; a paginação contaria o kit inteiro, então fica de fora
  return pagina(`Kit de visita (${htmls.length} documentos)`, juntas, htmls.some(h => h.includes('pagina-contrato')) ? RODAPE_VISTO : '');
};
