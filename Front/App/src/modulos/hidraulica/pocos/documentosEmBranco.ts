// Kit de visita: modelos em branco para imprimir e levar ao cliente (proposta, tabela de preços de referência, contrato
// e autorização de metragem adicional), preenchidos à mão na hora. Usam o logo, os dados da empresa e o modelo de
// contrato da configuração. Funções puras: devolvem a página HTML (a mesma montagem dos documentos da obra).
import type { ConfigProcesso } from './obrasApi';
import { ITENS_PRONTOS } from './obrasApi';
import {
  brl, cabecalho, CONDICOES_ORCAMENTO, escapar, modeloEmHtml, MODELO_CONTRATO_PADRAO, pagina, paragrafos, qualificacaoEmpresa,
} from './documentosPocos';

export type ModeloBranco = 'PROPOSTA' | 'TABELA' | 'CONTRATO' | 'AUTORIZACAO';

export const MODELOS_BRANCO: { id: ModeloBranco; titulo: string; descricao: string }[] = [
  { id: 'PROPOSTA', titulo: 'Proposta comercial', descricao: 'Para negociar na visita: cliente, local, metragem base com duas opções de valor, motobomba, prazo, pagamento e condições gerais.' },
  { id: 'TABELA', titulo: 'Tabela de preços de referência', descricao: 'Os itens da planilha da empresa com o valor de referência; quantidade e total em branco para calcular com o cliente.' },
  { id: 'CONTRATO', titulo: 'Contrato em branco', descricao: 'O contrato da configuração com os dados do cliente, valores e datas em linhas para preencher.' },
  { id: 'AUTORIZACAO', titulo: 'Autorização de metragem adicional', descricao: 'Para o cliente assinar na obra quando for preciso perfurar além do contratado.' },
];

const L = (n = 30) => '_'.repeat(n);
const caixa = '&#9744;';   // ☐

const linhasCliente = () => `<table>
  <tr><th>Cliente (contratante)</th><td>${L(45)}</td></tr>
  <tr><th>CPF / CNPJ</th><td>${L(25)} &nbsp; RG / IE: ${L(18)}</td></tr>
  <tr><th>Telefone / WhatsApp</th><td>${L(25)} &nbsp; E-mail: ${L(25)}</td></tr>
  <tr><th>Local da obra</th><td>${L(45)}<br><br>${L(28)} Cidade: ${L(20)}</td></tr>
</table>`;

const assinaturas = (empresa: string) => `<p style="margin-top:22px">${L(20)}, ____ de ${L(16)} de ________.</p>
  <div class="assinaturas"><div>${escapar(empresa || 'Empresa')}</div><div>Cliente: nome e assinatura</div></div>`;

/** Valor de referência do metro excedente (da planilha da empresa). */
const excedenteReferencia = () => ITENS_PRONTOS.find(p => p.item.opcional && p.item.grupo === 'PERFURACAO')?.item.valorUnitario || null;

const proposta = (e: ConfigProcesso, logo: string | null) => {
  const exc = excedenteReferencia();
  return pagina('Proposta comercial', `${cabecalho({ empresa: e }, logo)}
    <h1>Proposta comercial de prestação de serviços</h1>
    ${linhasCliente()}
    <h2>1. Escopo dos serviços e investimento</h2>
    <p>Prestação de serviços de perfuração de poço tubular profundo (poço artesiano), conforme as especificações abaixo:</p>
    <table class="itens"><tr><th>Descrição do serviço</th><th>Metragem base</th><th>Valor à vista</th><th>Valor parcelado</th></tr>
      <tr><td rowspan="2">Perfuração de poço artesiano, incluindo o fornecimento de materiais para a metragem base e o teste de vazão.</td>
        <td class="n">${L(6)} m</td><td class="n">R$ ${L(12)}</td><td class="n">R$ ${L(12)}</td></tr>
      <tr><td class="n">${L(6)} m</td><td class="n">R$ ${L(12)}</td><td class="n">R$ ${L(12)}</td></tr>
    </table>
    <p style="margin-top:8px">Instalação do conjunto motobomba: ${caixa} Incluso &nbsp; ${caixa} Não incluso &nbsp; ${caixa} À parte: R$ ${L(12)}</p>
    <p>Prazo estimado: ${L(4)} dias úteis após o início dos trabalhos (sujeito a condições climáticas ou geológicas).</p>
    <p><b>Metragem adicional (caso necessário):</b> se a metragem base for atingida sem vazão suficiente, a continuidade dependerá de nova
      autorização do cliente, ao valor ${exc ? `inicial de ${brl(exc)}` : `de R$ ${L(10)}`} por metro, podendo ser readequado conforme o solo e a profundidade, com o preço final aprovado antes do reinício.</p>
    <h2>2. Forma de pagamento</h2>
    <p>Sinal / entrada: ${L(5)}% = R$ ${L(12)}, pago ${caixa} na assinatura &nbsp; ${caixa} na chegada do maquinário.</p>
    <p>Saldo: R$ ${L(12)} &nbsp; ${caixa} ao final dos trabalhos &nbsp; ${caixa} parcelado em ${L(3)} vezes de R$ ${L(10)} no cartão de crédito.</p>
    <p style="font-size:11px;color:#555">Parcelamentos no cartão de crédito podem ter o repasse das taxas da maquininha.</p>
    <h2>3. Observações da negociação</h2>
    <p>${L(95)}</p><p>${L(95)}</p><p>${L(95)}</p>
    <h2>Condições gerais</h2><ul class="condicoes">${CONDICOES_ORCAMENTO.map(t => `<li>${escapar(t)}</li>`).join('')}</ul>
    ${assinaturas(e.empresaNome || '')}`);
};

const tabela = (e: ConfigProcesso, logo: string | null) => {
  const tipo = (p: typeof ITENS_PRONTOS[number]) => (p.item.incluso ? 'Incluso' : p.item.opcional ? 'Se necessário' : '');
  return pagina('Tabela de preços de referência', `${cabecalho({ empresa: e }, logo)}
    <h1>Tabela de preços de referência</h1>
    <p>Cliente: ${L(40)} &nbsp; Data: ____/____/________</p>
    <table class="itens"><tr><th>Item</th><th>Qtd.</th><th>Un.</th><th>Valor unit. (ref.)</th><th>Total</th><th></th></tr>
      ${ITENS_PRONTOS.map(p => `<tr${p.item.opcional ? ' class="opcional"' : ''}><td>${escapar(p.item.descricao)}</td><td class="n">${L(5)}</td>
        <td class="n">${escapar(p.item.unidade)}</td><td class="n">${p.item.valorUnitario ? brl(p.item.valorUnitario) : '—'}</td>
        <td class="n">${p.item.incluso ? '<b>INCLUSO</b>' : `R$ ${L(9)}`}</td><td class="n">${tipo(p)}</td></tr>`).join('')}
      <tr><td>${L(40)}</td><td class="n">${L(5)}</td><td></td><td class="n">R$ ${L(8)}</td><td class="n">R$ ${L(9)}</td><td></td></tr>
      <tr><td>${L(40)}</td><td class="n">${L(5)}</td><td></td><td class="n">R$ ${L(8)}</td><td class="n">R$ ${L(9)}</td><td></td></tr>
      <tr class="total"><td colspan="4">Total geral</td><td class="n">R$ ${L(9)}</td><td></td></tr>
    </table>
    <p class="rodape">Valores de referência da empresa: podem mudar conforme o solo, a profundidade, a cidade e o acesso ao local. Itens
      "incluso" fazem parte do pacote e não somam no total; "se necessário" só são cobrados se usados.</p>`);
};

const contrato = (e: ConfigProcesso, logo: string | null) => {
  const campos: Record<string, string> = {
    numero: L(8), empresa: e.empresaNome || L(25), empresa_qualificacao: qualificacaoEmpresa({ empresa: e }), cliente: L(35),
    cliente_qualificacao: `${L(40)}, CPF/CNPJ nº ${L(20)}, RG/IE nº ${L(15)}, residente/sediado em ${L(40)}, nº ${L(6)}, bairro ${L(18)}, cidade ${L(18)}/____, CEP ${L(10)}`,
    local_obra: `${L(50)}, ${L(20)}/____`, servicos: 'perfuração de poço tubular profundo (poço artesiano), instalação de bomba submersa e teste de vazão',
    escopo: '', metros: `${L(6)} metros`, valor_total: `R$ ${L(12)}`, valor_total_extenso: L(40),
    condicao_parcelada: ` à vista, ou R$ ${L(12)} (${L(30)}) se parcelado no cartão de crédito`, valor_parcelado: `R$ ${L(12)}`,
    valor_metro_excedente: `R$ ${L(10)}`, sinal: `Sinal/entrada: R$ ${L(12)} (${L(4)}%), pago ${L(30)}.`,
    forma_pagamento: `Saldo restante: R$ ${L(12)}, pago ${L(40)}.`, prazo_dias: L(4), data_inicio: '____/____/________', garantia_meses: L(4),
    texto_garantia: e.textoGarantia || '', foro: e.foroCidade || L(20), responsavel_tecnico: e.responsavelTecnico || '', registro_tecnico: e.registroTecnico || '',
    cidade_data: `${e.foroCidade || L(20)}, ____ de ${L(16)} de ________`, data_contrato: '____/____/________',
  };
  const corpo = modeloEmHtml(e.modeloContrato || MODELO_CONTRATO_PADRAO, campos, { tabela_itens: '' });
  return pagina('Contrato em branco', `${cabecalho({ empresa: e }, logo)}<div class="contrato">${corpo}</div>
    <div class="assinaturas quatro"><div>CONTRATADA · ${escapar(e.empresaNome || '')}${e.empresaRepresentante ? `<br>${escapar(e.empresaRepresentante)}` : ''}</div>
      <div>CONTRATANTE · nome e assinatura</div><div>Testemunha 1 · nome e CPF</div><div>Testemunha 2 · nome e CPF</div></div>`);
};

const autorizacao = (e: ConfigProcesso, logo: string | null) => pagina('Autorização de metragem adicional', `${cabecalho({ empresa: e }, logo)}
  <h1>Autorização de continuidade da perfuração (metragem adicional)</h1>
  <p>Contrato / orçamento nº ${L(8)}</p>
  ${linhasCliente()}
  <h2>Situação na obra</h2>
  <p>Profundidade contratada: ${L(6)} m &nbsp; Profundidade atingida: ${L(6)} m &nbsp; Vazão observada: ${L(8)}</p>
  <p>Condições do solo: ${L(70)}</p>
  <h2>Autorização</h2>
  ${paragrafos(`Eu, cliente acima identificado, autorizo ${e.empresaNome || 'a empresa contratada'} a continuar a perfuração do poço além da profundidade contratada, até no máximo ${L(6)} metros adicionais (profundidade total de até ${L(6)} m), ao valor de R$ ${L(10)} por metro adicional perfurado, totalizando no máximo R$ ${L(12)}.
Estou ciente de que a perfuração é obrigação de meio e não de resultado: não há garantia de vazão, quantidade ou qualidade da água, e os metros efetivamente perfurados serão cobrados mesmo que não se encontre a vazão desejada.
O valor da metragem adicional será pago ${L(45)}.`)}
  ${assinaturas(e.empresaNome || '')}`);

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
  return pagina(`Kit de visita (${htmls.length} documentos)`, juntas);
};
