// Obra › Orçamento e contrato › "Custo e margem": estima o custo da obra (perfuração por formação, materiais da
// estrutura prevista, bomba, equipe, dias, deslocamento e despesas) e mostra o preço mínimo, o sugerido e a margem do
// valor contratado. A estimativa fica gravada na obra para comparar com o real depois. Regras em custoObra.ts.
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Checkbox, Col, Flex, Input, Row, Select, Space, Statistic, Table, Tag, Tooltip, Typography, message } from 'antd';
import { DeleteOutlined, EnvironmentOutlined, PlusOutlined, SaveOutlined } from '@ant-design/icons';
import { CampoDinheiro, CampoNumero } from '../../../shared/formularios/CamposNumero';
import { CustosObraDados, custosObraApi, CustosPlano, Obra, planoMensalApi } from './obrasApi';
import { EntradaCusto, EstimativaCusto, estimarCusto, incluirPelosServicos, kmAteOPoco, trechosIniciais } from './custoObra';
import { useCatalogoMateriais } from './CampoMaterial';
import { consumoDoRelatorio } from './materiaisPoco';
import { CAMADAS_GEOLOGICAS } from './estruturaPoco';
import { lerGpsTexto } from './mapaRegional';

const { Text } = Typography;
const brl = (v: number | null | undefined) => (v === null || v === undefined ? '—' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
const pct = (v: number | null) => (v === null ? '—' : `${(v * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`);
const r2 = (v: number) => Math.round(v * 100) / 100;

/** preco: o total dos itens na tela (ainda não salvo); onResultado: a estimativa para a trava do preço mínimo. */
export const CustoMargemObra: React.FC<{ obra: Obra; preco?: number; onSalvo?: () => void; onResultado?: (r: EstimativaCusto | null) => void }> = ({ obra, preco, onSalvo, onResultado }) => {
  const [custos, setCustos] = useState<CustosObraDados | null>(null);
  const [empresa, setEmpresa] = useState<CustosPlano | null>(null);
  const [entrada, setEntrada] = useState<EntradaCusto | null>(null);
  const [mudou, setMudou] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const catalogo = useCatalogoMateriais();

  // materiais da estrutura prevista no relatório, a custo do cadastro
  const materiais = useMemo(() => {
    const porId = new Map(catalogo.map(m => [m.idMaterial, m]));
    const linhas = consumoDoRelatorio(obra.relatorio || {}, catalogo).map(c => ({ ...c, custo: r2(c.quantidade * (porId.get(c.idMaterial)?.custo || 0)) }));
    return { linhas, total: r2(linhas.reduce((s, l) => s + l.custo, 0)), semCusto: linhas.filter(l => !l.custo).length };
  }, [obra.relatorio, catalogo]);

  useEffect(() => {
    Promise.all([custosObraApi.carregar(), planoMensalApi.carregar()]).then(([c, p]) => {
      setCustos(c); setEmpresa(p.custos);
      const salva = obra.estimativaCusto?.entrada as EntradaCusto | undefined;
      const km = kmAteOPoco(p.custos, obra.latitude, obra.longitude) ?? p.custos.kmMedio;
      setEntrada(salva || {
        trechos: trechosIniciais(obra.relatorio, obra.metrosPrevistos, c.formacoes.find(f => f.custoMetro > 0)?.formacao || 'Argila'),
        incluir: incluirPelosServicos(obra.servicos), materiais: 0, outrosMateriais: 0,
        bombaCusto: 0, km, preco: obra.valorContratado || 0,
      });
    }).catch(e => message.error(e instanceof Error ? e.message : 'Erro ao carregar os custos.'));
  }, [obra.idObra]);   // eslint-disable-line react-hooks/exhaustive-deps

  // materiais sempre os do relatório (atualizam sozinhos); o preço acompanha o total dos itens (ou o contratado)
  const precoAtual = preco ?? (obra.valorContratado || 0);
  const e: EntradaCusto | null = entrada ? { ...entrada, materiais: materiais.total, preco: precoAtual } : null;
  const r = e && custos && empresa ? estimarCusto(e, custos.formacoes, custos.parametros, empresa) : null;
  const chave = r ? `${r.custo}|${r.precoMinimo}|${r.deducoesPct}` : '';
  useEffect(() => { onResultado?.(r); }, [chave]);   // eslint-disable-line react-hooks/exhaustive-deps
  if (!custos || !empresa || !e || !r) return <Card size="small" title="Custo e margem" loading />;
  const mudar = (x: Partial<EntradaCusto>) => { setEntrada({ ...entrada!, ...x }); setMudou(true); };
  // local: o GPS do poço ou o colado aqui (obra sem poço cadastrado ainda); sem a base da empresa, não dá para medir
  const gpsColado = obra.latitude === null || obra.longitude === null ? lerGpsTexto(e.gps) : null;
  const local = obra.latitude !== null && obra.longitude !== null ? { latitude: obra.latitude, longitude: obra.longitude } : gpsColado;
  const semBase = empresa.baseLatitude === null || empresa.baseLongitude === null;
  const kmGps = local ? kmAteOPoco(empresa, local.latitude, local.longitude) : null;
  const colarGps = (texto: string) => {
    const g = lerGpsTexto(texto);
    const km = g ? kmAteOPoco(empresa, g.latitude, g.longitude) : null;
    mudar({ gps: texto || null, ...(km !== null ? { km } : {}) });
  };
  const par = custos.parametros;
  const bombaPorCv = (cv: number) => r2(cv * empresa.bombaPrecoPorCv);

  const salvar = async () => {
    setSalvando(true);
    try {
      await custosObraApi.salvarEstimativa(obra.idObra, { entrada: e, resultado: r });
      setMudou(false); message.success('Estimativa de custo guardada na obra.'); onSalvo?.();
    } catch (x) { message.error(x instanceof Error ? x.message : 'Erro ao salvar.'); } finally { setSalvando(false); }
  };

  const corSituacao = r.situacao === 'PREJUIZO' ? '#cf1322' : r.situacao === 'ABAIXO_MINIMA' ? '#d46b08' : r.situacao === 'OK' ? '#389e0d' : undefined;
  const linhasCusto = [
    { k: 'perf', item: 'Perfuração', detalhe: r.perfuracao.map(p => `${p.metros} m ${p.formacao.toLowerCase()}`).join(' · '), valor: r.custoPerfuracao },
    { k: 'mat', item: 'Materiais', detalhe: materiais.linhas.length ? `${materiais.linhas.length} itens do relatório${e.outrosMateriais ? ' + outros' : ''}` : 'sem materiais no relatório', valor: r.materiais },
    { k: 'bomba', item: 'Bomba', detalhe: e.incluir.bomba ? '' : 'não incluída', valor: r.bomba },
    { k: 'eq', item: 'Equipe', detalhe: `${String(r.horasTotal).replace('.', ',')} h × ${brl(r.horaEquipe)} (${empresa.pessoasTroca || 1} pessoa(s))`, valor: r.equipe },
    { k: 'km', item: 'Deslocamento', detalhe: `${e.km} km × ${r.dias} dia(s) × ${brl(empresa.custoKm)}/km`, valor: r.deslocamento },
    { k: 'dia', item: 'Despesas por dia', detalhe: `${r.dias} dia(s) × ${brl(custos.parametros.custoDia)}`, valor: r.despesasDia },
    ...(e.incluir.transporte ? [{ k: 'transp', item: 'Transporte das máquinas',
      detalhe: `${par.viagensMaquina ?? 1} × (${e.km} km × ${brl(par.custoKmCaminhao || 0)}/km + ${brl(par.custoFixoTransporte || 0)})`, valor: r.transporte }] : []),
    ...(e.incluir.visita ? [{ k: 'visita', item: 'Visita técnica',
      detalhe: `${String(par.horasVisitaTecnica || 0).replace('.', ',')} h + ${e.km} km`, valor: r.visita }] : []),
  ];

  return (
    <Card size="small" title="Custo e margem"
      extra={<Space>
        {obra.estimativaCusto?.salvoEm && <Text type="secondary" style={{ fontSize: 12 }}>guardada em {String(obra.estimativaCusto.salvoEm).slice(8, 10)}/{String(obra.estimativaCusto.salvoEm).slice(5, 7)}</Text>}
        <Button size="small" type="primary" icon={<SaveOutlined />} disabled={!mudou && !!obra.estimativaCusto} loading={salvando} onClick={salvar}>Guardar estimativa</Button>
      </Space>}>
      {!custos.configurado && <Alert type="warning" showIcon style={{ marginBottom: 8 }} message="Custos da obra ainda não configurados: preencha em Mais ferramentas › Plano mensal › Custos da obra." />}
      <Row gutter={16}>
        <Col xs={24} xl={13}>
          <Flex vertical gap={10}>
            <div>
              <Text strong>O que a obra tem</Text>
              <div>
                {([['perfuracao', 'Perfuração'], ['revestimento', 'Revestimento'], ['limpeza', 'Limpeza'], ['bomba', 'Instalação da bomba'],
                  ['transporte', 'Transporte das máquinas'], ['visita', 'Visita técnica']] as const).map(([k, t]) => (
                  <Checkbox key={k} checked={!!e.incluir[k]} onChange={x => mudar({ incluir: { ...e.incluir, [k]: x.target.checked } })}>{t}</Checkbox>
                ))}
              </div>
            </div>
            {e.incluir.perfuracao && (
              <div>
                <Text strong>Metros previstos por formação</Text>
                <Text type="secondary" style={{ fontSize: 12 }}> (a rocha custa mais e a sonda anda mais devagar)</Text>
                {e.trechos.map((t, i) => (
                  <Row key={i} gutter={6} style={{ marginTop: 4 }} wrap={false}>
                    <Col flex="auto">
                      <Select style={{ width: '100%' }} value={t.formacao} onChange={formacao => mudar({ trechos: e.trechos.map((x, k) => (k === i ? { ...x, formacao } : x)) })}
                        options={custos.formacoes.map(f => ({ value: f.formacao, label: (
                          <Space size={6}><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: CAMADAS_GEOLOGICAS.find(c => c.valor === f.formacao)?.cor }} />
                            {f.formacao}<Text type="secondary" style={{ fontSize: 11 }}>{f.custoMetro ? `${brl(f.custoMetro)}/m · ${f.rendimentoMH} m/h` : 'sem custo'}</Text></Space>
                        ) }))} />
                    </Col>
                    <Col flex="120px"><CampoNumero min={0} style={{ width: '100%' }} suffix="m" value={t.metros} onChange={v => mudar({ trechos: e.trechos.map((x, k) => (k === i ? { ...x, metros: Number(v) || 0 } : x)) })} /></Col>
                    <Col flex="32px"><Button type="text" danger icon={<DeleteOutlined />} disabled={e.trechos.length === 1} onClick={() => mudar({ trechos: e.trechos.filter((_, k) => k !== i) })} /></Col>
                  </Row>
                ))}
                <Space style={{ marginTop: 4 }} wrap>
                  <Button size="small" type="dashed" icon={<PlusOutlined />} onClick={() => mudar({ trechos: [...e.trechos, { formacao: 'Rocha sã', metros: 0 }] })}>Outra formação</Button>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    Total {r.metros} m{obra.metrosPrevistos && r.metros !== obra.metrosPrevistos ? ` (obra prevê ${obra.metrosPrevistos} m)` : ''}
                  </Text>
                </Space>
              </div>
            )}
            <Row gutter={[10, 8]}>
              <Col xs={12} md={8}>
                <Text>Outros materiais</Text>
                <CampoDinheiro min={0} style={{ width: '100%' }} value={e.outrosMateriais} onChange={v => mudar({ outrosMateriais: Number(v) || 0 })} />
              </Col>
              {e.incluir.bomba && (
                <Col xs={12} md={8}>
                  <Text>Bomba (custo)</Text>
                  <CampoDinheiro min={0} style={{ width: '100%' }} value={e.bombaCusto} onChange={v => mudar({ bombaCusto: Number(v) || 0 })} />
                  <Space size={4} wrap>{[1, 1.5, 2, 3].map(cv => (
                    <Button key={cv} type="link" size="small" style={{ padding: 0, height: 'auto' }} onClick={() => mudar({ bombaCusto: bombaPorCv(cv) })}>{String(cv).replace('.', ',')} CV</Button>
                  ))}</Space>
                </Col>
              )}
            </Row>
            <div>
              <Text strong><EnvironmentOutlined /> Local da obra e distância</Text>
              <Row gutter={[10, 6]} style={{ marginTop: 4 }}>
                <Col xs={24} md={16}>
                  {obra.latitude !== null && obra.longitude !== null
                    ? <Input disabled value={`GPS do poço: ${obra.latitude.toFixed(6)}, ${obra.longitude.toFixed(6)}`} />
                    : <Input allowClear placeholder="Cole a localização (WhatsApp, Google Maps ou -23.05, -46.62)" value={e.gps || ''}
                        status={e.gps && !gpsColado ? 'warning' : undefined} onChange={x => colarGps(x.target.value)} />}
                </Col>
                <Col xs={24} md={8}>
                  <CampoNumero min={0} style={{ width: '100%' }} suffix="km ida e volta" value={e.km} onChange={v => mudar({ km: Number(v) || 0 })} />
                </Col>
              </Row>
              <Text type="secondary" style={{ fontSize: 11 }}>
                {semBase ? 'Sem a base da empresa (Plano mensal › Custos e variáveis): use o km à mão.'
                  : kmGps !== null ? `Pelo GPS: ${kmGps} km ida e volta (linha reta × fator da estrada ${String(empresa.fatorEstrada).replace('.', ',')})${kmGps !== e.km ? ' · o km acima foi mudado à mão' : ''}.`
                  : e.gps ? 'Não consegui ler a localização colada.' : `Sem GPS do local: km médio da empresa (${empresa.kmMedio} km).`}
                {' '}O km vale para o deslocamento diário, o transporte das máquinas e a visita técnica.
              </Text>
            </div>
            {materiais.linhas.length > 0 && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                Materiais do relatório: {materiais.linhas.map(l => `${l.nome} ${l.quantidade} ${l.unidade}`).join(' · ')}
                {materiais.semCusto ? ` · ${materiais.semCusto} sem custo no cadastro` : ''}
              </Text>
            )}
          </Flex>
        </Col>
        <Col xs={24} xl={11}>
          <Row gutter={[10, 10]}>
            <Col span={12}><Statistic title="Custo estimado" value={brl(r.custo)} valueStyle={{ fontSize: 18 }} /></Col>
            <Col span={12}>
              <Statistic title={precoAtual !== (obra.valorContratado || 0) ? 'Total dos itens (não salvo)' : 'Contratado'}
                value={precoAtual ? brl(precoAtual) : 'sem preço'} valueStyle={{ fontSize: 18 }} />
            </Col>
            <Col span={12}>
              <Tooltip title={`Cobre o custo, ${pct(r.deducoesPct)} de impostos/taxas e a margem mínima de ${pct(empresa.margemMinimaPct)}`}>
                <Statistic title="Preço mínimo" value={brl(r.precoMinimo)} valueStyle={{ fontSize: 16 }} />
              </Tooltip>
            </Col>
            <Col span={12}>
              <Tooltip title={`Com a margem desejada de ${pct(empresa.margemPct)}`}>
                <Statistic title="Preço sugerido" value={brl(r.precoSugerido)} valueStyle={{ fontSize: 16, color: '#1677ff' }} />
              </Tooltip>
            </Col>
            <Col span={24}>
              {r.situacao === 'SEM_PRECO' ? <Alert type="info" showIcon message="Sem valor contratado: monte os itens do orçamento (o total vira o contratado)." />
                : (
                  <Alert type={r.situacao === 'OK' ? 'success' : r.situacao === 'PREJUIZO' ? 'error' : 'warning'} showIcon
                    message={<span>Margem do contratado: <b style={{ color: corSituacao }}>{pct(r.margem)}</b> · sobra {brl(r.lucro)} depois de {brl(r.impostosSobrePreco)} de impostos/taxas</span>}
                    description={r.situacao === 'PREJUIZO' ? 'O preço não cobre o custo: a obra dá prejuízo.'
                      : r.situacao === 'ABAIXO_MINIMA' ? `Abaixo da margem mínima (${pct(empresa.margemMinimaPct)}): o preço mínimo é ${brl(r.precoMinimo)}.` : undefined} />
                )}
            </Col>
          </Row>
          <Table size="small" pagination={false} rowKey="k" style={{ marginTop: 8 }} dataSource={linhasCusto}
            columns={[
              { title: 'Custo', dataIndex: 'item', width: 130 },
              { title: '', render: (_, l) => <Text type="secondary" style={{ fontSize: 12 }}>{l.detalhe}</Text> },
              { title: '', align: 'right', width: 110, render: (_, l) => brl(l.valor) },
            ]}
            summary={() => <Table.Summary.Row><Table.Summary.Cell index={0} colSpan={2}><b>Total</b> <Tag style={{ marginLeft: 6 }}>{r.dias} dia(s) de obra</Tag></Table.Summary.Cell><Table.Summary.Cell index={2} align="right"><b>{brl(r.custo)}</b></Table.Summary.Cell></Table.Summary.Row>} />
          {r.alertas.length > 0 && <Alert type="warning" showIcon style={{ marginTop: 8 }} message={<ul style={{ margin: 0, paddingLeft: 16 }}>{r.alertas.map(a => <li key={a}>{a}</li>)}</ul>} />}
        </Col>
      </Row>
    </Card>
  );
};
