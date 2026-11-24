// Obra › "Custos e resultado": lança o que a obra custou além dos materiais (horas da equipe, km, diesel da sonda,
// desgaste, despesas, terceiros) e compara com a estimativa do orçamento, grupo a grupo, até a margem real.
// Os materiais vêm da aba Materiais (a bomba separada pela categoria). Regras em custoObra.ts.
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Card, Col, Empty, Input, Popconfirm, Row, Select, Space, Statistic, Table, Tag, Tooltip, Typography, message } from 'antd';
import { DeleteOutlined, EditOutlined, PlusOutlined, SaveOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { CampoData, CampoDinheiro, CampoNumero } from '../../../shared/formularios/CamposNumero';
import { CustoReal, CustoRealForm, custosReaisApi, CustosReaisDados } from './obrasApi';
import { compararEstimadoReal, TIPOS_CUSTO_REAL, TipoCustoReal } from './custoObra';

const { Text } = Typography;
const brl = (v: number | null | undefined) => (v === null || v === undefined ? '—' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
const pct = (v: number | null | undefined) => (v === null || v === undefined ? '—' : `${(v * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`);
const num = (v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
const dataBr = (s: string) => `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}`;
const erro = (e: unknown) => message.error(e instanceof Error ? e.message : 'Erro.');
const porQuantidade = (t: TipoCustoReal) => t === 'EQUIPE' || t === 'KM';

export const CustosResultadoObra: React.FC<{ idObra: number; cancelada?: boolean }> = ({ idObra, cancelada }) => {
  const [d, setD] = useState<CustosReaisDados | null>(null);
  const [form, setForm] = useState<CustoRealForm | null>(null);
  const [editando, setEditando] = useState<number | null>(null);
  const [salvando, setSalvando] = useState(false);
  const carregar = useCallback(() => { custosReaisApi.carregar(idObra).then(setD).catch(erro); }, [idObra]);
  useEffect(() => { carregar(); }, [carregar]);
  if (!d) return <Card size="small" loading />;

  const est = (d.estimativa?.resultado || null) as any;
  const entradaEst = (d.estimativa?.entrada || null) as any;
  const c = compararEstimadoReal(est, { materiais: d.materiais.materiais, bomba: d.materiais.bomba, lancamentos: d.lancamentos }, d.total, d.empresa.deducoesPct);

  // ponto de partida de cada tipo: horas e km pelo que falta da estimativa, custo unitário do plano mensal
  const novo = (tipo: TipoCustoReal): CustoRealForm => {
    const hoje = dayjs().format('YYYY-MM-DD');
    if (tipo === 'EQUIPE') {
      const falta = c.horasEstimadas ? Math.max(0, Math.round((c.horasEstimadas - c.horasReais) * 100) / 100) : null;
      return { data: hoje, tipo, descricao: null, quantidade: falta || null, valorUnitario: d.empresa.custoHoraEquipe || null, valor: null };
    }
    if (tipo === 'KM') {
      const kmEst = entradaEst && est ? Number(entradaEst.km || 0) * Number(est.dias || 0) : 0;
      const falta = kmEst ? Math.max(0, Math.round(kmEst - c.kmReais)) : null;
      return { data: hoje, tipo, descricao: null, quantidade: falta || null, valorUnitario: d.empresa.custoKm || null, valor: null };
    }
    return { data: hoje, tipo, descricao: null, quantidade: null, valorUnitario: null, valor: null };
  };
  const abrirNovo = (tipo: TipoCustoReal) => { setEditando(null); setForm(novo(tipo)); };
  const editar = (l: CustoReal) => { setEditando(l.idCusto); setForm({ data: l.data, tipo: l.tipo, descricao: l.descricao, quantidade: l.quantidade, valorUnitario: l.valorUnitario, valor: l.valor }); };
  const mudar = (x: Partial<CustoRealForm>) => setForm(f => (f ? { ...f, ...x } : f));
  // troca o tipo mantendo a data e a descrição (e o valor, entre os tipos só em R$)
  const trocarTipo = (tipo: TipoCustoReal) => setForm(f => {
    const base = novo(tipo);
    return f ? { ...base, data: f.data, descricao: f.descricao, valor: !porQuantidade(tipo) && !porQuantidade(f.tipo) ? f.valor : base.valor } : base;
  });

  const gravar = async () => {
    if (!form) return;
    setSalvando(true);
    try {
      if (editando) await custosReaisApi.salvar(editando, form); else await custosReaisApi.lancar(idObra, form);
      message.success(editando ? 'Custo alterado.' : 'Custo lançado.');
      setForm(null); setEditando(null); carregar();
    } catch (e) { erro(e); } finally { setSalvando(false); }
  };
  const apagar = async (id: number) => { try { await custosReaisApi.apagar(id); carregar(); } catch (e) { erro(e); } };

  const totalForm = form && porQuantidade(form.tipo) ? Math.round((form.quantidade || 0) * (form.valorUnitario || 0) * 100) / 100 : null;
  const corMargem = c.margemReal === null ? undefined : c.margemReal < 0 ? '#cf1322' : c.margemReal < d.empresa.margemMinimaPct ? '#d46b08' : '#389e0d';
  const corDif = (v: number | null) => (v === null || v === 0 ? undefined : v > 0 ? '#cf1322' : '#389e0d');

  return (
    <Space direction="vertical" size={10} style={{ width: '100%' }}>
      <Card size="small" title="Resultado da obra">
        {!d.estimativa && <Alert type="info" showIcon style={{ marginBottom: 8 }} message="Esta obra não tem estimativa guardada (Orçamento e contrato › Custo e margem): aparece só o custo real." />}
        {d.materiais.semConferir > 0 && <Alert type="warning" showIcon style={{ marginBottom: 8 }} message={`${d.materiais.semConferir} material(is) sem conferir o usado: entrou o previsto (aba Materiais).`} />}
        <Row gutter={[12, 12]}>
          <Col xs={12} md={6}><Statistic title="Cobrado" value={brl(d.total)} valueStyle={{ fontSize: 18 }} /></Col>
          <Col xs={12} md={6}>
            <Statistic title="Custo real" value={brl(c.custoReal)} valueStyle={{ fontSize: 18 }} />
            {c.custoEstimado !== null && <Text type="secondary" style={{ fontSize: 12 }}>estimado {brl(c.custoEstimado)}
              {c.diferenca ? <Text style={{ fontSize: 12, color: corDif(c.diferenca) }}> ({c.diferenca > 0 ? '+' : ''}{brl(c.diferenca)})</Text> : null}</Text>}
          </Col>
          <Col xs={12} md={6}>
            <Tooltip title={`Cobrado − ${pct(c.deducoesPct)} de impostos/taxas (${brl(c.impostos)}) − custo real`}>
              <Statistic title="Sobra" value={brl(c.lucroReal)} valueStyle={{ fontSize: 18, color: c.lucroReal !== null && c.lucroReal < 0 ? '#cf1322' : undefined }} />
            </Tooltip>
          </Col>
          <Col xs={12} md={6}>
            <Statistic title="Margem real" value={pct(c.margemReal)} valueStyle={{ fontSize: 18, color: corMargem }} />
            {c.margemEstimada !== null && <Text type="secondary" style={{ fontSize: 12 }}>estimada {pct(c.margemEstimada)}</Text>}
          </Col>
        </Row>
        <Table size="small" pagination={false} rowKey="grupo" style={{ marginTop: 10 }} dataSource={c.linhas}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Nenhum custo lançado ainda" /> }}
          columns={[
            { title: 'Custo', dataIndex: 'rotulo' },
            { title: 'Estimado', width: 120, align: 'right', render: (_, l) => brl(l.estimado) },
            { title: 'Real', width: 120, align: 'right', render: (_, l) => brl(l.real) },
            { title: 'Diferença', width: 150, align: 'right', render: (_, l) => (l.diferenca === null ? '—'
              : <Text style={{ color: corDif(l.diferenca) }}>{l.diferenca > 0 ? '+' : ''}{brl(l.diferenca)}{l.diferencaPct !== null && l.diferenca ? ` (${l.diferencaPct > 0 ? '+' : ''}${num(l.diferencaPct)}%)` : ''}</Text>) },
          ]}
          summary={() => (
            <Table.Summary.Row>
              <Table.Summary.Cell index={0}><b>Total</b></Table.Summary.Cell>
              <Table.Summary.Cell index={1} align="right">{brl(c.custoEstimado)}</Table.Summary.Cell>
              <Table.Summary.Cell index={2} align="right"><b>{brl(c.custoReal)}</b></Table.Summary.Cell>
              <Table.Summary.Cell index={3} align="right">{c.diferenca === null ? '—' : <Text strong style={{ color: corDif(c.diferenca) }}>{c.diferenca > 0 ? '+' : ''}{brl(c.diferenca)}</Text>}</Table.Summary.Cell>
            </Table.Summary.Row>
          )} />
        <Space size={16} wrap style={{ marginTop: 6 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>Horas: {num(c.horasReais)} h{c.horasEstimadas !== null ? ` (estimado ${num(c.horasEstimadas)} h)` : ''}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>Km rodados: {num(c.kmReais)} km</Text>
        </Space>
      </Card>

      <Card size="small" title="Custos lançados (além dos materiais)"
        extra={!cancelada && !form && (
          <Space size={4} wrap>
            {(Object.keys(TIPOS_CUSTO_REAL) as TipoCustoReal[]).filter(t => t !== 'OUTRO').map(t => (
              <Button key={t} size="small" icon={<PlusOutlined />} onClick={() => abrirNovo(t)}>{TIPOS_CUSTO_REAL[t].texto}</Button>
            ))}
            <Button size="small" icon={<PlusOutlined />} onClick={() => abrirNovo('OUTRO')}>Outro</Button>
          </Space>
        )}>
        {form && (
          <div style={{ background: 'rgba(22,119,255,.04)', border: '1px solid rgba(22,119,255,.2)', borderRadius: 8, padding: 10, marginBottom: 10 }}>
            <Row gutter={[8, 8]} align="bottom">
              <Col xs={12} md={5}>
                <Text>Tipo</Text>
                <Select style={{ width: '100%' }} value={form.tipo} onChange={trocarTipo}
                  options={(Object.keys(TIPOS_CUSTO_REAL) as TipoCustoReal[]).map(t => ({ value: t, label: TIPOS_CUSTO_REAL[t].texto }))} />
              </Col>
              <Col xs={12} md={4}>
                <Text>Data</Text>
                <CampoData style={{ width: '100%' }} allowClear={false} value={dayjs(form.data)} onChange={v => { if (v && !Array.isArray(v)) mudar({ data: v.format('YYYY-MM-DD') }); }} />
              </Col>
              {porQuantidade(form.tipo) ? (
                <>
                  <Col xs={8} md={3}>
                    <Text>{form.tipo === 'EQUIPE' ? 'Horas' : 'Km'}</Text>
                    <CampoNumero min={0} style={{ width: '100%' }} value={form.quantidade ?? undefined} onChange={v => mudar({ quantidade: v === null || v === undefined ? null : Number(v) })} />
                  </Col>
                  <Col xs={8} md={3}>
                    <Text>{form.tipo === 'EQUIPE' ? 'Custo da hora' : 'Custo do km'}</Text>
                    <CampoDinheiro min={0} style={{ width: '100%' }} value={form.valorUnitario ?? undefined} onChange={v => mudar({ valorUnitario: v === null || v === undefined ? null : Number(v) })} />
                  </Col>
                  <Col xs={8} md={2}><Text type="secondary">Total</Text><div style={{ lineHeight: '32px' }}><b>{brl(totalForm)}</b></div></Col>
                </>
              ) : (
                <Col xs={12} md={4}>
                  <Text>Valor</Text>
                  <CampoDinheiro min={0} style={{ width: '100%' }} value={form.valor ?? undefined} onChange={v => mudar({ valor: v === null || v === undefined ? null : Number(v) })} />
                </Col>
              )}
              <Col xs={24} md={porQuantidade(form.tipo) ? 7 : 11}>
                <Text>Descrição {form.tipo === 'OUTRO' ? '' : <Text type="secondary" style={{ fontSize: 12 }}>(opcional{TIPOS_CUSTO_REAL[form.tipo].dica ? `: ${TIPOS_CUSTO_REAL[form.tipo].dica}` : ''})</Text>}</Text>
                <Input maxLength={150} value={form.descricao || ''} onChange={e => mudar({ descricao: e.target.value || null })} onPressEnter={gravar} />
              </Col>
            </Row>
            <Space style={{ marginTop: 8 }}>
              <Button type="primary" size="small" icon={<SaveOutlined />} loading={salvando} onClick={gravar}>{editando ? 'Salvar' : 'Lançar'}</Button>
              <Button size="small" onClick={() => { setForm(null); setEditando(null); }}>Cancelar</Button>
            </Space>
          </div>
        )}
        <Table size="small" pagination={false} rowKey="idCusto" dataSource={d.lancamentos}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Lance as horas da equipe, os km, o diesel e as despesas da obra" /> }}
          columns={[
            { title: 'Data', width: 100, render: (_, l) => dataBr(l.data) },
            { title: 'Tipo', width: 150, render: (_, l) => <Tag>{TIPOS_CUSTO_REAL[l.tipo]?.texto || l.tipo}</Tag> },
            { title: 'Descrição', render: (_, l) => (
              <>{l.descricao || <Text type="secondary">—</Text>}
                {l.quantidade !== null && <Text type="secondary" style={{ fontSize: 12 }}> · {num(l.quantidade)} {l.tipo === 'EQUIPE' ? 'h' : 'km'} × {brl(l.valorUnitario)}</Text>}</>
            ) },
            { title: 'Valor', width: 120, align: 'right', render: (_, l) => brl(l.valor) },
            { title: '', width: 76, render: (_, l) => !cancelada && (
              <Space size={0}>
                <Button type="text" size="small" icon={<EditOutlined />} onClick={() => editar(l)} />
                <Popconfirm title="Apagar este custo?" okText="Apagar" cancelText="Não" onConfirm={() => apagar(l.idCusto)}>
                  <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                </Popconfirm>
              </Space>
            ) },
          ]} />
        <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 6 }}>
          Os materiais (e a bomba) entram pela aba Materiais. A hora da equipe e o custo do km vêm do Plano mensal e ficam congelados no lançamento.
        </Text>
      </Card>
    </Space>
  );
};
