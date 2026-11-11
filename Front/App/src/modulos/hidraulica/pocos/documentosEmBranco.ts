// Kit de visita: modelos em branco para imprimir e levar ao cliente (proposta, tabela de preços de referência, contrato
// e autorização de metragem adicional), preenchidos à mão na hora. Usam o logo, os dados da empresa e o modelo de
// contrato da configuração. Funções puras: devolvem a página HTML (a mesma montagem dos documentos da obra).
import type { ConfigProcesso } from './obrasApi';
import { ITENS_PRONTOS } from './obrasApi';
import {
  blocoAssinaturas, brl, cabecalho, celula, CONDICOES_ORCAMENTO, escapar, listaCondicoes, modeloEmHtml, MODELO_CONTRATO_PADRAO, pagina,
  qualificacaoEmpresa, RODAPE_PAGINAS, RODAPE_VISTO,
} from './documentosPocos';

export type ModeloBranco = 'PROPOSTA' | 'TABELA' | 'CONTRATO' | 'AUTORIZACAO';

export const MODELOS_BRANCO: { id: ModeloBranco; titulo: string; descricao: string }[] = [
  { id: 'PROPOSTA', titulo: 'Proposta comercial', descricao: 'Para negociar na visita: cliente, local, metragem base com duas opções de valor, motobomba, prazo, pagamento e condições gerais.' },
  { id: 'TABELA', titulo: 'Tabela de preços de referência', descricao: 'Os itens da planilha da empresa com o valor de referência; quantidade e total em branco para calcular com o cliente.' },
  { id: 'CONTRATO', titulo: 'Contrato em branco', descricao: 'O contrato da configuração com os dados do cliente, valores e datas em linhas para preencher.' },
  { id: 'AUTORIZACAO', titulo: 'Autorização de metragem adicional', descricao: 'Para o cliente assinar na obra quando for preciso perfurar além do contratado.' },
];

const L = (n = 30) => '_'.repeat(n);            // vira linha de preencher na página (pagina → linhasDePreencher)
const LINHA = '<span class="campo" style="width:100%"></span>';
const caixa = '<span class="caixa"></span>';
const DATA = '____/____/________';

const fichaCliente = () => `<div class="ficha branco">
  ${celula('Cliente (contratante)', LINHA, true)}
  ${celula('CPF / CNPJ', LINHA)}${celula('RG / IE', LINHA)}
  ${celula('Telefone / WhatsApp', LINHA)}${celula('E-mail', LINHA)}
  ${celula('Local da obra (endereço)', LINHA, true)}
  ${celula('Cidade / UF', LINHA)}${celula('Referência / GPS', LINHA)}
</div>`;

/** Proposta "basicão" (uma folha): só o essencial do cliente. */
const fichaClienteCurta = () => `<div class="ficha branco">
  ${celula('Cliente (contratante)', LINHA)}${celula('CPF / CNPJ', LINHA)}
  ${celula('Local da obra (endereço e cidade)', LINHA)}${celula('Telefone / WhatsApp', LINHA)}
</div>`;

const localData = () => `<p class="local-data">${L(22)}, ____ de ${L(14)} de ________.</p>`;

/** Valor de referência do metro excedente (da planilha da empresa). */
const excedenteReferencia = () => ITENS_PRONTOS.find(p => p.item.opcional && p.item.grupo === 'PERFURACAO')?.item.valorUnitario || null;

const proposta = (e: ConfigProcesso, logo: string | null) => {
  const exc = excedenteReferencia();
  return pagina('Proposta comercial', `<div class="compacta">${cabecalho({ empresa: e }, logo, { tipo: 'Proposta comercial', numero: `Nº ${L(6)}`, data: `Data: ${DATA}` })}
    <h1>Proposta comercial · perfuração de poço artesiano</h1>
    <div class="sub">Prestação de serviços de perfuração de poço tubular profundo</div>
    ${fichaClienteCurta()}
    <h2><span class="n">1</span>Escopo e investimento</h2>
    <table class="itens"><tr><th>Descrição do serviço</th><th class="n">Metragem base</th><th class="n">Valor à vista</th><th class="n">Valor parcelado</th></tr>
      <tr><td>Perfuração de poço artesiano · opção A<br><span class="nota">Inclui os materiais da metragem base e o teste de vazão.</span></td>
        <td class="n">${L(6)} m</td><td class="n">R$ ${L(11)}</td><td class="n">R$ ${L(11)}</td></tr>
      <tr><td>Perfuração de poço artesiano · opção B<br><span class="nota">Inclui os materiais da metragem base e o teste de vazão.</span></td>
        <td class="n">${L(6)} m</td><td class="n">R$ ${L(11)}</td><td class="n">R$ ${L(11)}</td></tr>
    </table>
    <div class="ficha branco" style="margin-top:3mm">
      ${celula('Conjunto motobomba', `${caixa}Incluso ${caixa}Não incluso ${caixa}À parte R$ ${L(7)}`)}
      ${celula('Prazo estimado', `${L(4)} dias úteis após o início <small>· sujeito ao clima e ao solo</small>`)}
    </div>
    <p class="nota" style="margin-top:2.5mm"><b>Metragem adicional (caso necessário):</b> se a metragem base for atingida sem vazão suficiente, a continuidade dependerá de nova
      autorização do cliente, ao valor ${exc ? `inicial de ${brl(exc)}` : `de R$ ${L(10)}`} por metro, podendo ser readequado conforme o solo e a profundidade, com o preço final aprovado antes do reinício.</p>
    <h2><span class="n">2</span>Forma de pagamento</h2>
    <div class="ficha branco">
      ${celula('Sinal / entrada', `${L(4)}% = R$ ${L(11)} &nbsp; ${caixa}na assinatura ${caixa}na chegada do maquinário`, true)}
      ${celula('Saldo', `R$ ${L(11)} &nbsp; ${caixa}ao final dos trabalhos ${caixa}parcelado em ${L(3)}× de R$ ${L(9)} no cartão <small>(com o repasse das taxas da maquininha)</small>`, true)}
    </div>
    <h2><span class="n">3</span>Observações da negociação</h2>
    <p>${LINHA}</p><p>${LINHA}</p>
    <h2><span class="n">4</span>Condições gerais</h2>${listaCondicoes(CONDICOES_ORCAMENTO.filter(t => !t.startsWith('Metragem adicional')))}
    ${localData()}
    ${blocoAssinaturas([{ nome: escapar(e.empresaNome || 'Empresa'), papel: 'Contratada' }, { nome: '', papel: 'Cliente · nome e assinatura' }])}</div>`);
};

const tabela = (e: ConfigProcesso, logo: string | null) => {
  const linha = (p: typeof ITENS_PRONTOS[number]) => `<tr${p.item.opcional ? ' class="opcional"' : ''}><td>${escapar(p.item.descricao)}</td>
    <td class="n">${L(4)}</td><td class="n">${escapar(p.item.unidade)}</td><td class="n">${p.item.valorUnitario ? brl(p.item.valorUnitario) : '—'}</td>
    <td class="n">${p.item.incluso ? '<span class="pill">Incluso</span>' : `R$ ${L(8)}`}</td></tr>`;
  const base = ITENS_PRONTOS.filter(p => !p.item.opcional), opc = ITENS_PRONTOS.filter(p => p.item.opcional);
  const livre = `<tr><td>${LINHA}</td><td class="n">${L(4)}</td><td class="n">${L(2)}</td><td class="n">R$ ${L(7)}</td><td class="n">R$ ${L(8)}</td></tr>`;
  return pagina('Tabela de preços de referência', `${cabecalho({ empresa: e }, logo, { tipo: 'Tabela de preços', numero: 'Referência', data: `Data: ${DATA}` })}
    <h1>Tabela de preços de referência</h1>
    <div class="sub">Perfuração 6" por faixa de solo, materiais e serviços · preencha a quantidade e o total com o cliente</div>
    <div class="ficha branco">${celula('Cliente', LINHA)}${celula('Local da obra', LINHA)}</div>
    <h2><span class="n">1</span>Itens</h2>
    <table class="itens"><tr><th>Item</th><th class="n">Qtd.</th><th class="n">Un.</th><th class="n">Valor unit. (ref.)</th><th class="n">Total</th></tr>
      ${base.map(linha).join('')}${livre}${livre}
      <tr class="total"><td colspan="4">Total geral</td><td class="n">R$ ${L(9)}</td></tr>
      <tr class="grupo"><td colspan="5">Se necessário, não incluso no total · cobrado só se for usado</td></tr>
      ${opc.map(linha).join('')}
    </table>
    <p class="rodape">Valores de referência da empresa: podem mudar conforme o solo, a profundidade, a cidade e o acesso ao local. Itens "incluso" fazem parte
      do pacote e não somam no total.</p>`);
};

const contrato = (e: ConfigProcesso, logo: string | null) => {
  const campos: Record<string, string> = {
    numero: L(8), empresa: e.empresaNome || L(25), empresa_qualificacao: qualificacaoEmpresa({ empresa: e }), cliente: L(35),
    cliente_qualificacao: `${L(40)}, CPF/CNPJ nº ${L(20)}, RG/IE nº ${L(15)}, residente/sediado em ${L(40)}, nº ${L(6)}, bairro ${L(18)}, cidade ${L(18)}/____, CEP ${L(10)}`,
    local_obra: `${L(50)}, ${L(20)}/____`, servicos: 'perfuração de poço tubular profundo (poço artesiano), instalação de bomba submersa e teste de vazão',
    escopo: '', metros: `${L(6)} metros`, valor_total: `R$ ${L(12)}`, valor_total_extenso: L(40),
    condicao_parcelada: ` à vista, ou R$ ${L(12)} (${L(30)}) se parcelado no cartão de crédito`, valor_parcelado: `R$ ${L(12)}`,
    valor_metro_excedente: `R$ ${L(10)}`, sinal: `Sinal/entrada: R$ ${L(12)} (${L(4)}%), pago ${L(30)}.`,
    forma_pagamento: `Saldo restante: R$ ${L(12)}, pago ${L(40)}.`, prazo_dias: L(4), data_inicio: DATA, garantia_meses: L(4),
    texto_garantia: e.textoGarantia || '', foro: e.foroCidade || L(20), responsavel_tecnico: e.responsavelTecnico || '', registro_tecnico: e.registroTecnico || '',
    cidade_data: `${e.foroCidade || L(20)}, ____ de ${L(16)} de ________`, data_contrato: DATA,
  };
  const corpo = modeloEmHtml(e.modeloContrato || MODELO_CONTRATO_PADRAO, campos, { tabela_itens: '' });
  return pagina('Contrato em branco', `<div class="pagina-contrato">${cabecalho({ empresa: e }, logo, { tipo: 'Contrato', numero: `Nº ${L(6)}`, data: `Data: ${DATA}` })}<div class="contrato" style="text-align:left">${corpo}</div>
    ${blocoAssinaturas([
      { nome: escapar(e.empresaNome || ''), papel: `CONTRATADA${e.empresaRepresentante ? `<br>${escapar(e.empresaRepresentante)}` : ''}` },
      { nome: '', papel: 'CONTRATANTE · nome e assinatura' }, { nome: '', papel: 'Testemunha 1 · nome e CPF' }, { nome: '', papel: 'Testemunha 2 · nome e CPF' },
    ], true)}</div>`, RODAPE_VISTO + RODAPE_PAGINAS);
};

const autorizacao = (e: ConfigProcesso, logo: string | null) => pagina('Autorização de metragem adicional', `${cabecalho({ empresa: e }, logo,
  { tipo: 'Autorização', numero: 'Metragem adicional', data: `Contrato nº ${L(6)}` })}
  <h1>Autorização de continuidade da perfuração</h1>
  <div class="sub">Metragem adicional além da profundidade contratada</div>
  ${fichaCliente()}
  <h2><span class="n">1</span>Situação na obra</h2>
  <div class="ficha tres branco">
    ${celula('Profundidade contratada', `${L(6)} m`)}${celula('Profundidade atingida', `${L(6)} m`)}${celula('Vazão observada', LINHA)}
  </div>
  <p style="margin-top:2.5mm">Condições do solo: ${L(70)}</p>
  <h2><span class="n">2</span>Autorização</h2>
  <p>Eu, cliente acima identificado, autorizo <b>${escapar(e.empresaNome || 'a empresa contratada')}</b> a continuar a perfuração do poço além da profundidade
    contratada, até no máximo <b>${L(5)} metros adicionais</b> (profundidade total de até ${L(5)} m), ao valor de <b>R$ ${L(9)} por metro</b> adicional perfurado,
    totalizando no máximo R$ ${L(11)}.</p>
  <p>Estou ciente de que a perfuração é obrigação de meio e não de resultado: não há garantia de vazão, quantidade ou qualidade da água, e os metros
    efetivamente perfurados serão cobrados mesmo que não se encontre a vazão desejada.</p>
  <p>O valor da metragem adicional será pago ${L(45)}.</p>
  ${localData()}
  ${blocoAssinaturas([{ nome: '', papel: 'Cliente · nome e assinatura' }, { nome: escapar(e.empresaNome || ''), papel: 'Responsável pela obra' }])}`);

/** Página HTML do modelo em branco (com a impressão automática, como os outros documentos). */
export const htmlEmBranco = (id: ModeloBranco, empresa: ConfigProcesso, logo: string | null) =>
  ({ PROPOSTA: proposta, TABELA: tabela, CONTRATO: contrato, AUTORIZACAO: autorizacao }[id](empresa, logo));

/** Para a pré-visualização: a mesma página sem abrir a impressão sozinha. */
export const semImpressao = (html: string) => html.replace(/<script>[\s\S]*?<\/script>/g, '');

/** Vários documentos numa impressão só: um estilo e cada documento começando numa folha nova. */
export const juntarPaginas = (htmls: string[]) => {
  if (htmls.length <= 1) return htmls[0] || '';
  const corpo = (h: string) => semImpressao(h).match(/<body[^>]*>([\s\S]*)<\/body>/)?.[1] || '';
  const juntas = htmls.map((h, i) => `<div style="${i ? 'break-before: page; page-break-before: always;' : ''}">${corpo(h)}</div>`).join('');
  // impressos juntos, o contrato mantém o visto em todas as folhas; a paginação contaria o kit inteiro, então fica de fora
  return pagina(`Kit de visita (${htmls.length} documentos)`, juntas, htmls.some(h => h.includes('pagina-contrato')) ? RODAPE_VISTO : '');
};
