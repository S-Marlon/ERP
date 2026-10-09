// Modelos de impressão do módulo Poços: relatório completo (várias páginas), cobrança, teste de vazão,
// certificado de garantia e formulário de campo em branco. Mesmo cabeçalho (empresa) e estilo em todos.
import dayjs, { Dayjs } from 'dayjs';
import {
  ANOMALIAS, brl, calcularFinanceiro, com, Dados, data, dataGarantia, Empresa, escapar, Leitura, num, OCORRENCIAS_OBRA, profundidadeFinal,
  resumoTeste, SecaoId, TEXTO_GARANTIA_PADRAO, vazao, vazio,
} from './relatorioPoco';

export type ModeloId = 'completo' | 'cobranca' | 'vazao' | 'garantia' | 'branco';
export const MODELOS: Array<{ id: ModeloId; nome: string; descricao: string }> = [
  { id: 'completo', nome: 'Relatório técnico completo', descricao: 'Todas as seções marcadas; pode ocupar mais de uma página.' },
  { id: 'cobranca', nome: 'Cobrança / demonstrativo', descricao: 'Obra, conta (contratado, excedente, adicionais), pagamentos e saldo.' },
  { id: 'vazao', nome: 'Relatório de teste de vazão', descricao: 'Leituras, gráfico do nível, rebaixamento e vazão específica.' },
  { id: 'garantia', nome: 'Certificado de garantia', descricao: 'Dados da obra, prazo e condições da garantia.' },
  { id: 'branco', nome: 'Formulário de campo (em branco)', descricao: 'Mesmo layout do completo, com linhas para preencher à mão.' },
];

export interface OpcoesModelo { secoes: Record<SecaoId, boolean>; empresa?: Empresa; agora?: Dayjs }

// ---------------------------------------------------------------- estilo e peças comuns
const CSS = `
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  @page { size: A4; margin: 10mm; }
  body { font-family: 'Segoe UI', Helvetica, Arial, sans-serif; margin: 0; color: #2D3748; font-size: 11px; line-height: 1.35; }
  .header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #004d54; padding-bottom: 8px; margin-bottom: 12px; gap: 12px; }
  .header h1 { margin: 0; color: #004d54; font-size: 17px; }
  .header p { margin: 2px 0 0; color: #718096; font-size: 10px; }
  .empresa { font-weight: 700; color: #1A202C; font-size: 12px; }
  .meta { text-align: right; color: #4A5568; font-size: 10px; white-space: nowrap; }
  .section { border: 1px solid #E2E8F0; padding: 8px 10px; margin-bottom: 8px; border-radius: 6px; page-break-inside: avoid; break-inside: avoid; }
  .section-title { font-weight: 700; color: #004d54; border-bottom: 1px solid #E2E8F0; padding-bottom: 4px; margin-bottom: 8px; text-transform: uppercase; font-size: 11px; letter-spacing: .6px; }
  .grid { display: flex; flex-wrap: wrap; margin: 0 -6px; }
  .c2 { width: 16.66%; } .c3 { width: 25%; } .c4 { width: 33.33%; } .c6 { width: 50%; } .c8 { width: 66.66%; } .c12 { width: 100%; }
  .c2, .c3, .c4, .c6, .c8, .c12 { padding: 0 6px; margin-bottom: 7px; }
  .label { font-weight: 600; color: #718096; text-transform: uppercase; font-size: 8.5px; margin-bottom: 1px; }
  .value { font-size: 11px; color: #1A202C; font-weight: 700; min-height: 15px; }
  .branco .value { border-bottom: 1px dashed #A0AEC0; }
  .destaque { color: #c53030; }
  .texto { font-weight: 500; white-space: pre-wrap; }
  table { width: 100%; border-collapse: collapse; font-size: 10px; }
  th, td { border: 1px solid #E2E8F0; padding: 5px 8px; text-align: left; }
  th { background: #f4f7f9; color: #004d54; text-transform: uppercase; font-size: 8.5px; }
  td.n, th.n { text-align: right; white-space: nowrap; }
  .branco td { height: 22px; }
  tr.total td { font-weight: 800; background: #f4f7f9; }
  tr.saldo td { font-weight: 800; font-size: 13px; background: #fff5f5; color: #c53030; }
  tr.quitado td { font-weight: 800; font-size: 13px; background: #f0fff4; color: #276749; }
  .anomalias { display: flex; flex-wrap: wrap; gap: 4px 12px; margin-bottom: 8px; }
  .anomalia { font-size: 10px; }
  .marca { display: inline-block; width: 10px; height: 10px; border: 1px solid #4A5568; margin-right: 4px; vertical-align: -1px; text-align: center; line-height: 9px; font-size: 9px; font-weight: 700; }
  .sim .marca { background: #c53030; border-color: #c53030; color: #fff; }
  .sim { color: #c53030; font-weight: 700; }
  .cards { display: flex; gap: 8px; margin-bottom: 8px; }
  .card { flex: 1; border: 1px solid #E2E8F0; border-radius: 6px; padding: 8px 10px; }
  .card .valor { font-size: 16px; font-weight: 800; color: #004d54; }
  .assinaturas { margin-top: 40px; display: flex; justify-content: space-between; page-break-inside: avoid; }
  .assinatura { text-align: center; width: 45%; border-top: 1px solid #A0AEC0; padding-top: 5px; font-size: 11px; }
  .assinatura span { color: #718096; font-size: 9px; display: block; }
  .pagamento { border: 1px dashed #004d54; border-radius: 6px; padding: 8px 10px; margin-top: 8px; }
  .garantia-box { border: 2px solid #004d54; border-radius: 10px; padding: 18px 22px; margin-top: 6px; }
  .garantia-box h2 { margin: 0 0 6px; color: #004d54; font-size: 20px; letter-spacing: 1px; }
  .rodape { margin-top: 10px; color: #A0AEC0; font-size: 9px; text-align: center; }
`;

const documento = (titulo: string, corpo: string, branco = false) =>
  `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${escapar(titulo)}</title><style>${CSS}</style></head><body class="${branco ? 'branco' : ''}">${corpo}</body></html>`;

const cabecalho = (titulo: string, subtitulo: string, emp: Empresa, meta: string) => `
  <div class="header">
    <div>
      ${emp.nome ? `<div class="empresa">${escapar(emp.nome)}</div>` : ''}
      <h1>${escapar(titulo)}</h1>
      <p>${escapar([emp.documento, emp.telefone, emp.cidade].filter(Boolean).join(' · ') || subtitulo)}</p>
    </div>
    <div class="meta">${meta}</div>
  </div>`;

const campoHtml = (cls: string, rotulo: string, valor: string, extra = '', branco = false) =>
  `<div class="${cls}"><div class="label">${escapar(rotulo)}</div><div class="value ${extra}">${branco ? '' : (valor ? escapar(valor) : '---')}</div></div>`;

const blocoCliente = (d: Dados, b = false) => {
  const f = (c: string, r: string, v: string) => campoHtml(c, r, v, '', b);
  return `<div class="section"><div class="section-title">Cliente / proprietário</div><div class="grid">
    ${f('c6', 'Nome / razão social', d.cliente)}${f('c3', 'CPF / CNPJ', d.documento)}${f('c3', 'Telefone', d.celular)}
    ${f('c6', 'Endereço', d.endereco)}${f('c2', 'Bairro', d.bairro)}${f('c2', 'CEP', d.cep)}${f('c2', 'Cidade / UF', [d.cidade, d.uf].filter(Boolean).join(' - '))}
  </div></div>`;
};

const assinaturas = (esq: string, rotEsq: string, dir: string, rotDir: string) => `<div class="assinaturas">
  <div class="assinatura">${escapar(esq)}<span>${escapar(rotEsq)}</span></div>
  <div class="assinatura">${escapar(dir)}<span>${escapar(rotDir)}</span></div></div>`;

// ---------------------------------------------------------------- tabelas e gráfico reaproveitados
const tabelaFinanceiro = (d: Dados) => {
  const f = calcularFinanceiro(d);
  const linhas: string[] = [];
  linhas.push(`<tr><td>Perfuração contratada${f.contratados ? ` (${num(f.contratados)} m)` : ''}</td><td class="n">${brl(f.valorContratado)}</td></tr>`);
  if (f.excedente > 0) linhas.push(`<tr><td>Metros excedentes: ${num(f.excedente)} m × ${brl(f.valorMetroExcedente)} (poço com ${num(f.profundidade)} m)</td><td class="n">${brl(f.valorExcedente)}</td></tr>`);
  if (f.falta > 0) linhas.push(`<tr><td>${f.abatimento ? `Abatimento: ${num(f.falta)} m a menos × ${brl(f.valorMetroFalta)}` : `Poço com ${num(f.falta)} m a menos que o contratado (sem abatimento)`}</td><td class="n">${f.abatimento ? `− ${brl(f.abatimento)}` : '—'}</td></tr>`);
  for (const a of f.adicionais) linhas.push(`<tr><td>${escapar(a.descricao || 'Adicional')}</td><td class="n">${brl(a.valor)}</td></tr>`);
  linhas.push(`<tr class="total"><td>Total da obra</td><td class="n">${brl(f.total)}</td></tr>`);
  const pagamentos = f.pagamentos.length
    ? f.pagamentos.map(p => `<tr><td>${escapar(p.data || '—')}</td><td>${escapar(p.forma || '—')}${p.obs ? ` · ${escapar(p.obs)}` : ''}</td><td class="n">${brl(p.valor)}</td></tr>`).join('')
    : `<tr><td colspan="3" style="text-align:center;color:#718096">Nenhum pagamento registrado</td></tr>`;
  return { f, html: `
    <table><thead><tr><th>Descrição</th><th class="n">Valor</th></tr></thead><tbody>${linhas.join('')}</tbody></table>
    <div class="label" style="margin-top:8px">Pagamentos recebidos</div>
    <table><thead><tr><th>Data</th><th>Forma</th><th class="n">Valor</th></tr></thead><tbody>${pagamentos}
      <tr class="total"><td colspan="2">Total pago</td><td class="n">${brl(f.pago)}</td></tr>
      <tr class="${f.saldo > 0 ? 'saldo' : 'quitado'}"><td colspan="2">${f.saldo > 0 ? 'Saldo a receber' : f.saldo < 0 ? 'Crédito do cliente' : 'Obra quitada'}</td><td class="n">${brl(Math.abs(f.saldo))}</td></tr>
    </tbody></table>` };
};

/** Gráfico do nível (m, para baixo) no tempo (min): bombeamento e, em seguida, recuperação. */
export const graficoNivel = (bomb: Leitura[], rec: Leitura[], ne: number | null): string => {
  if (bomb.length + rec.length < 2) return '';
  const fimBomb = bomb.length ? bomb[bomb.length - 1].tempo : 0;
  const pontosRec = rec.map(l => ({ ...l, tempo: fimBomb + l.tempo }));
  const todos = [...bomb, ...pontosRec];
  const W = 700; const H = 210; const m = { l: 44, r: 12, t: 12, b: 26 };
  const tMax = Math.max(...todos.map(l => l.tempo), 1);
  const niveis = [...todos.map(l => l.nivel), ...(ne !== null ? [ne] : [])];
  const nMin = Math.floor(Math.min(...niveis)); const nMax = Math.ceil(Math.max(...niveis)) || 1;
  const x = (t: number) => m.l + (t / tMax) * (W - m.l - m.r);
  const y = (v: number) => m.t + ((v - nMin) / Math.max(1, nMax - nMin)) * (H - m.t - m.b);
  const linha = (pts: Leitura[], cor: string) => pts.length ? `<polyline fill="none" stroke="${cor}" stroke-width="2" points="${pts.map(p => `${x(p.tempo).toFixed(1)},${y(p.nivel).toFixed(1)}`).join(' ')}"/>
    ${pts.map(p => `<circle cx="${x(p.tempo).toFixed(1)}" cy="${y(p.nivel).toFixed(1)}" r="2.5" fill="${cor}"/>`).join('')}` : '';
  const marcasY = [nMin, (nMin + nMax) / 2, nMax].map(v => `<text x="${m.l - 6}" y="${y(v) + 3}" text-anchor="end" font-size="9" fill="#718096">${num(v)} m</text>
    <line x1="${m.l}" x2="${W - m.r}" y1="${y(v)}" y2="${y(v)}" stroke="#EDF2F7"/>`).join('');
  const marcasX = [0, tMax / 2, tMax].map(t => `<text x="${x(t)}" y="${H - 8}" text-anchor="middle" font-size="9" fill="#718096">${num(t)} min</text>`).join('');
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" style="max-height:${H}px">${marcasY}${marcasX}
    ${ne !== null ? `<line x1="${m.l}" x2="${W - m.r}" y1="${y(ne)}" y2="${y(ne)}" stroke="#38A169" stroke-dasharray="4 3"/><text x="${W - m.r}" y="${y(ne) - 3}" text-anchor="end" font-size="9" fill="#38A169">NE ${num(ne)} m</text>` : ''}
    ${linha(bomb, '#004d54')}${linha(pontosRec, '#DD6B20')}
    ${rec.length ? `<line x1="${x(fimBomb)}" x2="${x(fimBomb)}" y1="${m.t}" y2="${H - m.b}" stroke="#CBD5E0" stroke-dasharray="3 3"/>` : ''}
  </svg>
  <div style="font-size:9px;color:#718096"><span style="color:#004d54">●</span> bombeamento &nbsp; ${rec.length ? '<span style="color:#DD6B20">●</span> recuperação' : ''}</div>`;
};

const tabelaLeituras = (lista: Leitura[], comVazao: boolean, titulo: string) => lista.length ? `
  <div class="label" style="margin-top:6px">${titulo}</div>
  <table><thead><tr><th class="n">Tempo (min)</th><th class="n">Nível (m)</th>${comVazao ? '<th class="n">Vazão (L/h)</th>' : ''}</tr></thead><tbody>
    ${lista.map(l => `<tr><td class="n">${num(l.tempo)}</td><td class="n">${num(l.nivel)}</td>${comVazao ? `<td class="n">${l.vazao !== undefined ? num(l.vazao) : ''}</td>` : ''}</tr>`).join('')}
  </tbody></table>` : '';

const cardsTeste = (d: Dados) => {
  const r = resumoTeste(d);
  const card = (rot: string, v: string) => `<div class="card"><div class="label">${rot}</div><div class="valor">${v || '—'}</div></div>`;
  return { r, html: `<div class="cards">
    ${card('Nível estático (NE)', r.ne !== null ? `${num(r.ne)} m` : '')}${card('Nível dinâmico (ND)', r.nd !== null ? `${num(r.nd)} m` : '')}
    ${card('Rebaixamento', r.rebaixamento !== null ? `${num(r.rebaixamento)} m` : '')}${card('Vazão', r.vazaoM3h !== null ? `${num(r.vazaoM3h)} m³/h` : '')}
    ${card('Vazão específica', r.vazaoEspecifica !== null ? `${r.vazaoEspecifica.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} m³/h/m` : '')}
  </div>` };
};

// ---------------------------------------------------------------- relatório completo (e o em branco)
const completo = (d: Dados, op: OpcoesModelo, b: boolean) => {
  const s = op.secoes;
  const f = (cls: string, rotulo: string, valor: string, extra = '') => campoHtml(cls, rotulo, valor, extra, b);
  const perf: Dados[] = b ? [{}, {}, {}] : (d.perfuracoes || []).filter((p: Dados) => !vazio(p?.perfAte) || !vazio(p?.perfDiam));
  const rev: Dados[] = b ? [{}, {}, {}] : (d.revestimentos || []).filter((r: Dados) => !vazio(r?.revAte) || !vazio(r?.revDiam) || !vazio(r?.revMaterial));
  const v = (x: string) => (b ? '' : x);
  const vazia = (cols: number, msg: string) => `<tr><td colspan="${cols}" style="text-align:center;color:#718096">${msg}</td></tr>`;
  const marca = (ligado: boolean) => (b ? '<span class="marca"></span>sim <span class="marca"></span>não' : `<span class="marca">${ligado ? '✓' : ''}</span>`);
  const lista = (itens: Array<[string, string]>) => `<div class="anomalias">${itens.map(([k, t]) => `<span class="anomalia ${!b && d[k] ? 'sim' : ''}">${marca(!!d[k])} ${escapar(t)}</span>`).join('')}</div>`;
  const tubos = !b && (d.bombaQtdTubos || d.bombaTamTubo)
    ? `${num(d.bombaQtdTubos) || 0} barra(s) de ${num(d.bombaTamTubo) || 0} m${d.bombaMedidaTubo ? ` · ${d.bombaMedidaTubo}${d.bombaTuboUnidade || '"'}` : ''}${d.bombaTubulacao ? ` · ${d.bombaTubulacao}` : ''}`
    : '';
  const teste = cardsTeste(d);
  const comMarca = (x: string, campo: string) => (b || d[campo] ? f('c12', x, d[campo], 'texto') : '');

  return documento(`Relatório técnico de poço - ${b ? 'em branco' : d.cliente || 'sem nome'}`, `
  ${cabecalho('RELATÓRIO TÉCNICO DE POÇO ARTESIANO', 'Especificações estruturais, bombeamento e parâmetros hidrodinâmicos', op.empresa || {},
    `<strong>Emissão:</strong> ${b ? '____/____/________' : (op.agora || dayjs()).format('DD/MM/YYYY HH:mm')}${b ? '<br>Formulário de campo' : ''}`)}
  ${blocoCliente(d, b)}

  ${s.dadosPoco ? `<div class="section"><div class="section-title">Dados do poço</div><div class="grid">
    ${f('c4', 'Coordenadas (GPS)', d.localizacao)}${f('c2', 'Profundidade', com(d.profundidade, ' m'))}
    ${f('c2', 'Diâmetro interno', com(d.diametroInterno, d.diamInternoUnidade || '"'))}${f('c2', 'Vazão (perfuração)', vazao(d.vazaoAprox, d.vazaoAproxAproximada))}
    ${f('c2', 'Última limpeza', data(d.dtLimpeza))}
  </div></div>` : ''}

  ${s.perfuracao ? `<div class="section"><div class="section-title">Perfuração e revestimento</div><div class="grid">
    ${f('c2', 'Início', data(d.dtInicio))}${f('c2', 'Conclusão', data(d.dtTermino))}${f('c2', 'Garantia', d.garantiaMeses ? `${d.garantiaMeses} meses` : '')}
    ${f('c2', 'Garantia até', dataGarantia(d.dtTermino, d.garantiaMeses), 'destaque')}${f('c4', 'Formação / solo', d.tipoSolo)}
    <div class="c6"><div class="label">Etapas de perfuração</div><table><thead><tr><th>De (m)</th><th>Até (m)</th><th>Diâmetro</th></tr></thead><tbody>
      ${perf.map(p => `<tr><td>${v(num(p.perfDe))}</td><td>${v(num(p.perfAte))}</td><td>${v(com(p.perfDiam, p.perfDiamUnidade || '"'))}</td></tr>`).join('') || vazia(3, 'Nenhuma etapa registrada')}
    </tbody></table></div>
    <div class="c6"><div class="label">Revestimento</div><table><thead><tr><th>De (m)</th><th>Até (m)</th><th>Diâmetro</th><th>Material</th><th>União</th></tr></thead><tbody>
      ${rev.map(r => `<tr><td>${v(num(r.revDe))}</td><td>${v(num(r.revAte))}</td><td>${v(com(r.revDiam, r.revDiamUnidade || '"'))}</td><td>${v(escapar(r.revMaterial || ''))}</td><td>${v(escapar(r.revUniao || ''))}</td></tr>`).join('') || vazia(5, 'Nenhum revestimento registrado')}
    </tbody></table></div>
    <div class="c12"><div class="label">Ocorrências na obra</div>${lista(OCORRENCIAS_OBRA)}</div>
    ${f('c4', 'Equipe / sonda', d.equipePerfuracao)}${f('c4', 'Responsável técnico', d.respNomePerf)}
    ${comMarca('Observações geológicas', 'obsGeraisPerfuracao')}
  </div></div>` : ''}

  ${s.diagnostico ? `<div class="section"><div class="section-title">Diagnóstico técnico</div>
    ${lista(ANOMALIAS)}
    <div class="grid">
      ${f('c3', 'Amperagem (leitura)', com(d.manutAmperagem, ' A'))}${f('c3', 'Isolamento (megômetro)', com(d.manutMegometro, ' MΩ'))}
      ${f('c3', 'Limpeza química', ({ '6_meses': 'A cada 6 meses', '12_meses': 'Anual' } as Record<string, string>)[d.manutPeriodicidadeLimpeza] || d.manutPeriodicidadeLimpeza || '')}
      ${comMarca('Diretrizes preventivas / observações', 'manutDiretrizesTexto')}
    </div></div>` : ''}

  ${s.bombeamento ? `<div class="section"><div class="section-title">Conjunto motobomba e instalação</div><div class="grid">
    ${f('c3', 'Marca da bomba', d.bombaMarca)}${f('c3', 'Motor (modelo / potência)', d.imgMotorModelo)}${f('c3', 'Bombeador', d.imgBombeadorModelo)}${f('c3', 'Instalação', data(d.bombaDtInstalacao))}
    ${f('c6', 'Tubulação edutora', tubos)}${f('c2', 'Profundidade da bomba', com(d.bombaProfundidade, ' m'))}${f('c2', 'Cabo elétrico', d.bombaCabeamento)}${f('c2', 'Cavalete de saída', d.bombaCavalete)}
    ${f('c2', 'Nível estático (NE)', com(d.bombaNivelEstatico, ' m'))}${f('c2', 'Nível dinâmico (ND)', com(d.bombaNivelDinamico, ' m'))}
    ${f('c2', 'Vazão regulada', vazao(d.bombaVazaoEstimada, d.bombaVazaoAproximada))}${f('c3', 'Equipe de instalação', d.equipeInstalacaoBomba)}${f('c3', 'Responsável', d.respNomeBomba)}
    ${comMarca('Observações da instalação', 'bombaObsGerais')}
  </div></div>` : ''}

  ${s.testeVazao ? `<div class="section"><div class="section-title">Teste de vazão</div>
    ${b ? '' : teste.html}
    <div class="grid">
      ${f('c3', 'Duração do ensaio', com(d.testeVazaoDuracao, ' h'))}${f('c3', 'Método', d.testeVazaoMetodo)}${f('c3', 'Vazão estabilizada', com(d.testeVazaoEstabilizada, ' m³/h'))}
      ${comMarca('Comportamento do nível e da recuperação', 'testeVazaoDados')}
    </div>
    ${b ? '' : graficoNivel(teste.r.bombeamento, teste.r.recuperacao, teste.r.ne)}
    ${b ? '' : `<div class="grid"><div class="c6">${tabelaLeituras(teste.r.bombeamento, true, 'Leituras do bombeamento')}</div><div class="c6">${tabelaLeituras(teste.r.recuperacao, false, 'Leituras da recuperação')}</div></div>`}
  </div>` : ''}

  ${s.financeiro && !b ? `<div class="section"><div class="section-title">Financeiro da obra</div>${tabelaFinanceiro(d).html}</div>` : ''}

  ${s.assinaturas ? assinaturas(!b && (d.respNomePerf || d.respNomeBomba) || 'Responsável técnico', 'Responsável técnico', !b && d.cliente || 'Proprietário', 'Recebimento e conformidade') : ''}
  `, b);
};

// ---------------------------------------------------------------- cobrança / demonstrativo
const cobranca = (d: Dados, op: OpcoesModelo) => {
  const emp = op.empresa || {};
  const { f, html } = tabelaFinanceiro(d);
  const campo = (c: string, r: string, v: string) => campoHtml(c, r, v);
  return documento(`Demonstrativo - ${d.cliente || 'obra'}`, `
  ${cabecalho('DEMONSTRATIVO DE SERVIÇOS – PERFURAÇÃO DE POÇO', 'Valores da obra e situação dos pagamentos', emp, `<strong>Emissão:</strong> ${(op.agora || dayjs()).format('DD/MM/YYYY')}`)}
  ${blocoCliente(d)}
  <div class="section"><div class="section-title">Obra</div><div class="grid">
    ${campo('c3', 'Profundidade final', f.profundidade ? `${num(f.profundidade)} m` : '')}${campo('c3', 'Metros contratados', f.contratados ? `${num(f.contratados)} m` : '')}
    ${campo('c3', 'Início', data(d.dtInicio))}${campo('c3', 'Conclusão', data(d.dtTermino))}
  </div></div>
  <div class="section"><div class="section-title">Valores</div>${html}</div>
  ${f.saldo > 0 && (emp.pix || emp.dadosPagamento) ? `<div class="pagamento"><div class="label">Para pagamento</div>
    ${emp.pix ? `<div class="value">PIX: ${escapar(emp.pix)}</div>` : ''}${emp.dadosPagamento ? `<div class="value texto">${escapar(emp.dadosPagamento)}</div>` : ''}</div>` : ''}
  ${d.finObs ? `<div class="section" style="margin-top:8px"><div class="label">Observações</div><div class="value texto">${escapar(d.finObs)}</div></div>` : ''}
  ${assinaturas(emp.nome || 'Empresa', 'Emitente', d.cliente || 'Cliente', 'De acordo')}
  `);
};

// ---------------------------------------------------------------- teste de vazão
const relatorioVazao = (d: Dados, op: OpcoesModelo) => {
  const { r, html } = cardsTeste(d);
  const campo = (c: string, rot: string, v: string) => campoHtml(c, rot, v);
  return documento(`Teste de vazão - ${d.cliente || 'poço'}`, `
  ${cabecalho('RELATÓRIO DE TESTE DE VAZÃO', 'Ensaio de bombeamento e recuperação do nível', op.empresa || {}, `<strong>Emissão:</strong> ${(op.agora || dayjs()).format('DD/MM/YYYY')}`)}
  ${blocoCliente(d)}
  <div class="section"><div class="section-title">Poço e equipamento</div><div class="grid">
    ${campo('c3', 'Profundidade', profundidadeFinal(d) ? `${num(profundidadeFinal(d))} m` : '')}${campo('c3', 'Diâmetro interno', com(d.diametroInterno, d.diamInternoUnidade || '"'))}
    ${campo('c3', 'Bomba', [d.bombaMarca, d.imgBombeadorModelo].filter(Boolean).join(' '))}${campo('c3', 'Profundidade da bomba', com(d.bombaProfundidade, ' m'))}
    ${campo('c4', 'Coordenadas (GPS)', d.localizacao)}${campo('c4', 'Método', d.testeVazaoMetodo)}${campo('c4', 'Duração', com(d.testeVazaoDuracao, ' h'))}
  </div></div>
  <div class="section"><div class="section-title">Resultados</div>${html}
    ${graficoNivel(r.bombeamento, r.recuperacao, r.ne)}
    ${r.recuperacaoPct !== null ? `<div class="value" style="margin-top:4px">Recuperação ao fim das leituras: ${r.recuperacaoPct}% do rebaixamento</div>` : ''}
  </div>
  <div class="grid"><div class="c6">${tabelaLeituras(r.bombeamento, true, 'Leituras do bombeamento')}</div><div class="c6">${tabelaLeituras(r.recuperacao, false, 'Leituras da recuperação')}</div></div>
  ${d.testeVazaoDados ? `<div class="section" style="margin-top:8px"><div class="label">Comportamento observado</div><div class="value texto">${escapar(d.testeVazaoDados)}</div></div>` : ''}
  ${assinaturas(d.respNomePerf || d.respNomeBomba || 'Responsável técnico', 'Responsável pelo ensaio', d.cliente || 'Proprietário', 'Ciente')}
  `);
};

// ---------------------------------------------------------------- certificado de garantia
const garantia = (d: Dados, op: OpcoesModelo) => {
  const emp = op.empresa || {};
  const ate = dataGarantia(d.dtTermino, d.garantiaMeses);
  const campo = (c: string, r: string, v: string) => campoHtml(c, r, v);
  return documento(`Garantia - ${d.cliente || 'poço'}`, `
  ${cabecalho('CERTIFICADO DE GARANTIA', 'Perfuração de poço artesiano', emp, `<strong>Emissão:</strong> ${(op.agora || dayjs()).format('DD/MM/YYYY')}`)}
  <div class="garantia-box">
    <h2>GARANTIA DE ${d.garantiaMeses ? `${d.garantiaMeses} MESES` : '___ MESES'}</h2>
    <div class="grid">
      ${campo('c8', 'Cliente', d.cliente)}${campo('c4', 'CPF / CNPJ', d.documento)}
      ${campo('c8', 'Local da obra', [d.endereco, d.bairro, [d.cidade, d.uf].filter(Boolean).join(' - ')].filter(Boolean).join(', '))}${campo('c4', 'Coordenadas', d.localizacao)}
      ${campo('c3', 'Profundidade', profundidadeFinal(d) ? `${num(profundidadeFinal(d))} m` : '')}${campo('c3', 'Conclusão da obra', data(d.dtTermino))}
      ${campo('c3', 'Garantia válida até', ate)}${campo('c3', 'Revestimento', (d.revestimentos || []).map((r: Dados) => r?.revMaterial).filter(Boolean).join(', '))}
    </div>
    <div class="label" style="margin-top:8px">Condições</div>
    <div class="value texto">${escapar(emp.textoGarantia || TEXTO_GARANTIA_PADRAO)}</div>
  </div>
  ${assinaturas(emp.nome || d.respNomePerf || 'Empresa', 'Emitente da garantia', d.cliente || 'Cliente', 'Recebi este certificado')}
  `);
};

/** HTML do modelo escolhido. */
export const gerarModelo = (id: ModeloId, d: Dados, op: OpcoesModelo): string => {
  if (id === 'cobranca') return cobranca(d, op);
  if (id === 'vazao') return relatorioVazao(d, op);
  if (id === 'garantia') return garantia(d, op);
  return completo(d, op, id === 'branco');
};
