// Orçamento rápido › "Custo e preço": a mesma conta do Custo e margem da obra (custoObra.ts), compacta, para responder o
// cliente no primeiro contato sem errar o preço — metros (dos itens) por formação, local (GPS do poço ou digitado) para o
// km, serviços, bomba e materiais. Mostra o custo, o preço mínimo, o sugerido e a margem do total; devolve a estimativa
// (entrada e resultado) para a trava e para guardar na obra criada.
import React, { useEffect, useState } from 'react';
import { Alert, Button, Card, Checkbox, Col, Row, Select, Space, Statistic, Tooltip, Typography, message } from 'antd';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { CampoDinheiro, CampoNumero } from '../../../shared/formularios/CamposNumero';
import { CustosObraDados, custosObraApi, CustosPlano, planoMensalApi, Servico } from './obrasApi';
import { EntradaCusto, EstimativaCusto, estimarCusto, incluirPelosServicos, kmAteOPoco } from './custoObra';

const { Text } = Typography;
const brl = (v: number | null | undefined) => (v === null || v === undefined ? '—' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
const pct = (v: number | null | undefined) => (v === null || v === undefined ? '—' : `${(v * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`);
const r2 = (v: number) => Math.round(v * 100) / 100;

export interface EstimativaRapida { entrada: EntradaCusto; resultado: EstimativaCusto }

export const CustoRapido: React.FC<{
  servicos: Servico[]; metros: number | null; local: { latitude: number; longitude: number } | null; gps: string | null; preco: number;
  onEstimativa: (e: EstimativaRapida | null) => void;
}> = ({ servicos, metros, local, gps, preco, onEstimativa }) => {
  const [custos, setCustos] = useState<CustosObraDados | null>(null);
  const [empresa, setEmpresa] = useState<CustosPlano | null>(null);
  const [trechos, setTrechos] = useState<Array<{ formacao: string; metros: number }>>([]);
  const [trechosAMao, setTrechosAMao] = useState(false);
  const [incluir, setIncluir] = useState<EntradaCusto['incluir']>(incluirPelosServicos(servicos));
  const [incluirAMao, setIncluirAMao] = useState(false);
  const [km, setKm] = useState<number | null>(null);
  const [kmAMao, setKmAMao] = useState(false);
  const [materiais, setMateriais] = useState(0);
  const [bombaCusto, setBombaCusto] = useState(0);

  useEffect(() => {
    Promise.all([custosObraApi.carregar(), planoMensalApi.carregar()])
      .then(([c, p]) => { setCustos(c); setEmpresa(p.custos); })
      .catch(e => message.error(e instanceof Error ? e.message : 'Erro ao carregar os custos.'));
  }, []);
  // acompanham os itens, os serviços e o local até a pessoa mexer à mão
  const formacaoPadrao = custos?.formacoes.find(f => f.custoMetro > 0)?.formacao || 'Argila';
  useEffect(() => { if (!trechosAMao) setTrechos([{ formacao: trechos[0]?.formacao || formacaoPadrao, metros: metros || 0 }]); }, [metros, formacaoPadrao]);   // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!incluirAMao) setIncluir(incluirPelosServicos(servicos)); }, [servicos.join()]);   // eslint-disable-line react-hooks/exhaustive-deps
  const kmGps = empresa && local ? kmAteOPoco(empresa, local.latitude, local.longitude) : null;
  const kmUsado = kmAMao && km !== null ? km : kmGps ?? empresa?.kmMedio ?? 0;

  const entrada: EntradaCusto = { trechos, incluir, materiais, outrosMateriais: 0, bombaCusto, km: kmUsado, preco, gps: gps || null };
  const r = custos && empresa ? estimarCusto(entrada, custos.formacoes, custos.parametros, empresa) : null;
  const chave = r ? JSON.stringify([entrada, r.custo, r.precoMinimo]) : '';
  useEffect(() => { onEstimativa(r && r.custo > 0 ? { entrada, resultado: r } : null); }, [chave]);   // eslint-disable-line react-hooks/exhaustive-deps

  if (!custos || !empresa || !r) return <Card size="small" loading title="Custo e preço" />;
  const mudarTrecho = (i: number, x: Partial<{ formacao: string; metros: number }>) => { setTrechos(trechos.map((t, k) => (k === i ? { ...t, ...x } : t))); setTrechosAMao(true); };
  const cor = r.situacao === 'PREJUIZO' ? '#cf1322' : r.situacao === 'ABAIXO_MINIMA' ? '#d46b08' : r.situacao === 'OK' ? '#389e0d' : undefined;

  return (
    <Card size="small" title="Custo e preço" styles={{ body: { paddingTop: 8 } }}
      extra={<Text type="secondary" style={{ fontSize: 12 }}>a conta do Custo e margem da obra</Text>}>
      {!custos.configurado && <Alert type="warning" showIcon style={{ marginBottom: 8 }} message="Custos da obra não configurados (Plano mensal › Custos da obra): o custo da perfuração sai zerado." />}
      <Row gutter={16}>
        <Col xs={24} lg={13}>
          <Space direction="vertical" size={6} style={{ width: '100%' }}>
            <div>
              {([['perfuracao', 'Perfuração'], ['revestimento', 'Revestimento'], ['limpeza', 'Limpeza'], ['bomba', 'Bomba'], ['transporte', 'Transporte das máquinas'], ['visita', 'Visita técnica']] as const).map(([k, t]) => (
                <Checkbox key={k} checked={!!incluir[k]} onChange={x => { setIncluir({ ...incluir, [k]: x.target.checked }); setIncluirAMao(true); }}>{t}</Checkbox>
              ))}
            </div>
            {incluir.perfuracao && trechos.map((t, i) => (
              <Row key={i} gutter={6} wrap={false}>
                <Col flex="auto">
                  <Select size="small" style={{ width: '100%' }} value={t.formacao} onChange={formacao => mudarTrecho(i, { formacao })}
                    options={custos.formacoes.map(f => ({ value: f.formacao, label: `${f.formacao}${f.custoMetro ? ` · ${brl(f.custoMetro)}/m · ${f.rendimentoMH} m/h` : ' · sem custo'}` }))} />
                </Col>
                <Col flex="110px"><CampoNumero size="small" min={0} suffix="m" style={{ width: '100%' }} value={t.metros} onChange={v => mudarTrecho(i, { metros: Number(v) || 0 })} /></Col>
                <Col flex="28px">
                  {i === 0
                    ? <Tooltip title="Outra formação (ex.: argila até 30 m e rocha depois)"><Button size="small" type="text" icon={<PlusOutlined />} onClick={() => { setTrechos([...trechos, { formacao: 'Rocha sã', metros: 0 }]); setTrechosAMao(true); }} /></Tooltip>
                    : <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={() => { setTrechos(trechos.filter((_, k) => k !== i)); setTrechosAMao(true); }} />}
                </Col>
              </Row>
            ))}
            <Row gutter={[8, 4]}>
              <Col xs={12} md={8}>
                <Text style={{ fontSize: 12 }}>Materiais (custo)</Text>
                <CampoDinheiro size="small" min={0} style={{ width: '100%' }} value={materiais} onChange={v => setMateriais(Number(v) || 0)} />
              </Col>
              {incluir.bomba && (
                <Col xs={12} md={8}>
                  <Text style={{ fontSize: 12 }}>Bomba (custo)</Text>
                  <CampoDinheiro size="small" min={0} style={{ width: '100%' }} value={bombaCusto} onChange={v => setBombaCusto(Number(v) || 0)} />
                  <Space size={4}>{[1, 1.5, 2, 3].map(cv => (
                    <Button key={cv} type="link" size="small" style={{ padding: 0, height: 'auto', fontSize: 11 }} onClick={() => setBombaCusto(r2(cv * empresa.bombaPrecoPorCv))}>{String(cv).replace('.', ',')} CV</Button>
                  ))}</Space>
                </Col>
              )}
              <Col xs={12} md={8}>
                <Text style={{ fontSize: 12 }}>Km ida e volta</Text>
                <CampoNumero size="small" min={0} suffix="km" style={{ width: '100%' }} value={kmUsado} onChange={v => { setKm(Number(v) || 0); setKmAMao(true); }} />
                <Text type="secondary" style={{ fontSize: 11 }}>
                  {kmAMao ? <a onClick={() => setKmAMao(false)}>voltar ao calculado</a> : kmGps !== null ? 'pelo GPS do local' : 'km médio (sem GPS do local)'}
                </Text>
              </Col>
            </Row>
          </Space>
        </Col>
        <Col xs={24} lg={11}>
          <Row gutter={[8, 8]}>
            <Col span={12}><Statistic title="Custo estimado" value={brl(r.custo)} valueStyle={{ fontSize: 16 }} />
              <Text type="secondary" style={{ fontSize: 11 }}>{r.dias} dia(s) · {String(r.horasTotal).replace('.', ',')} h</Text></Col>
            <Col span={12}><Statistic title="Total dos itens" value={preco ? brl(preco) : 'sem preço'} valueStyle={{ fontSize: 16 }} /></Col>
            <Col span={12}>
              <Tooltip title={`Cobre o custo, ${pct(r.deducoesPct)} de impostos/taxas e a margem mínima de ${pct(empresa.margemMinimaPct)}`}>
                <Statistic title="Preço mínimo" value={brl(r.precoMinimo)} valueStyle={{ fontSize: 15 }} />
              </Tooltip>
            </Col>
            <Col span={12}>
              <Tooltip title={`Com a margem desejada de ${pct(empresa.margemPct)}`}>
                <Statistic title="Preço sugerido" value={brl(r.precoSugerido)} valueStyle={{ fontSize: 15, color: '#1677ff' }} />
              </Tooltip>
            </Col>
            <Col span={24}>
              {r.situacao === 'SEM_PRECO' ? <Text type="secondary" style={{ fontSize: 12 }}>Monte os itens para ver a margem.</Text> : (
                <Text>Margem do total: <b style={{ color: cor }}>{pct(r.margem)}</b>
                  {r.situacao === 'PREJUIZO' ? <Text type="danger"> · dá prejuízo</Text> : r.situacao === 'ABAIXO_MINIMA' ? <Text style={{ color: '#d46b08' }}> · abaixo da mínima</Text> : null}</Text>
              )}
            </Col>
          </Row>
          {r.alertas.length > 0 && <Text type="warning" style={{ fontSize: 11, display: 'block', marginTop: 4 }}>{r.alertas.join(' ')}</Text>}
        </Col>
      </Row>
    </Card>
  );
};
