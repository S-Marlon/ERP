// Obras de poços › resultado e painel (etapa 8): os números do próprio módulo (fora do Resultado do mês da loja).
// Obras por situação, a receber, recebido e faturado no período, metros perfurados, lucro de cada obra e os alertas de
// obra parada ou atrasada. Clicar numa obra abre ela.
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Card, Col, Empty, Input, List, Row, Segmented, Space, Statistic, Table, Tag, Tooltip, Typography, message } from 'antd';
import { ReloadOutlined, WarningOutlined } from '@ant-design/icons';
import GraficoBarras from '../../../shared/components/graficos/GraficoBarras';
import { dataBr, LucroObra, painelApi, PainelPocos as Painel, periodoRapido, SERVICOS, SITUACOES_OBRA, SituacaoObra } from './obrasApi';
import { abrirObra } from './navPocos';

const { Text } = Typography;
const brl = (v: number | null | undefined) => (v === null || v === undefined ? '—' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
const brlCurto = (v: number) => (Math.abs(v) >= 1000 ? `R$ ${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil` : brl(v));
const VERDE = '#52c41a', AZUL = '#1677ff';
type Rapido = 'MES' | 'MES_ANTERIOR' | 'ANO' | 'OUTRO';
type FiltroObras = 'PERIODO' | 'ANDAMENTO' | 'TODAS';

const PainelPocos: React.FC = () => {
  const [rapido, setRapido] = useState<Rapido>('MES');
  const [periodo, setPeriodo] = useState(periodoRapido('MES', new Date()));
  const [dados, setDados] = useState<Painel | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [filtro, setFiltro] = useState<FiltroObras>('PERIODO');
  const carregar = useCallback(async () => {
    setCarregando(true);
    try { setDados(await painelApi.carregar(periodo.de, periodo.ate)); }
    catch (e) { message.error(e instanceof Error ? e.message : 'Erro.'); }
    finally { setCarregando(false); }
  }, [periodo]);
  useEffect(() => { carregar(); }, [carregar]);
  const escolher = (r: Rapido) => { setRapido(r); if (r !== 'OUTRO') setPeriodo(periodoRapido(r, new Date())); };
  const r = dados?.periodoResumo;
  const obras = (dados?.obras || []).filter(o => filtro === 'TODAS' || (filtro === 'PERIODO' ? o.concluidaNoPeriodo
    : ['ORCAMENTO', 'AGUARDANDO_SINAL', 'EM_EXECUCAO'].includes(o.situacao)));
  const cartao = (titulo: string, valor: number, extra?: React.ReactNode, cor?: string, moeda = true) => (
    <Card size="small" style={{ height: '100%' }}>
      <Statistic title={titulo} value={valor} precision={moeda ? 2 : undefined} prefix={moeda ? 'R$' : undefined} decimalSeparator="," groupSeparator="."
        valueStyle={cor ? { color: cor } : undefined} />
      {extra && <Text type="secondary" style={{ fontSize: 12 }}>{extra}</Text>}
    </Card>
  );
  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      <Card size="small" styles={{ body: { padding: '8px 12px' } }}>
        <Space wrap style={{ width: '100%', justifyContent: 'space-between' }}>
          <Space wrap>
            <Segmented value={rapido} onChange={v => escolher(v as Rapido)}
              options={[{ value: 'MES', label: 'Este mês' }, { value: 'MES_ANTERIOR', label: 'Mês passado' }, { value: 'ANO', label: 'Este ano' }, { value: 'OUTRO', label: 'Outro' }]} />
            {rapido === 'OUTRO' && <>
              <Input type="date" style={{ width: 150 }} value={periodo.de} onChange={e => e.target.value && setPeriodo(p => ({ ...p, de: e.target.value }))} />
              <Text type="secondary">a</Text>
              <Input type="date" style={{ width: 150 }} value={periodo.ate} onChange={e => e.target.value && setPeriodo(p => ({ ...p, ate: e.target.value }))} />
            </>}
            <Text type="secondary">{dataBr(periodo.de)} a {dataBr(periodo.ate)}</Text>
          </Space>
          <Tooltip title="Recarregar"><Button icon={<ReloadOutlined />} loading={carregando} onClick={carregar} /></Tooltip>
        </Space>
      </Card>

      {dados && r && <>
        <Row gutter={[12, 12]}>
          {(['ORCAMENTO', 'AGUARDANDO_SINAL', 'EM_EXECUCAO'] as SituacaoObra[]).map(s => (
            <Col xs={8} md={4} key={s}><Card size="small" style={{ height: '100%' }}><Statistic title={SITUACOES_OBRA[s].texto} value={dados.contagem[s] || 0} /></Card></Col>
          ))}
          <Col xs={12} md={6}>{cartao('A receber das obras', dados.aReceber.total, dados.aReceber.vencido ? `${brl(dados.aReceber.vencido)} vencido` : 'nada vencido', dados.aReceber.vencido ? '#d48806' : undefined)}</Col>
          <Col xs={12} md={6}>{cartao('Recebido no período', r.recebido, `${r.recebimentos} recebimento(s)`, '#389e0d')}</Col>
        </Row>
        <Row gutter={[12, 12]}>
          <Col xs={12} md={6}>{cartao('Faturado (obras concluídas)', r.faturado, `${r.concluidas} obra(s) concluída(s)`)}</Col>
          <Col xs={12} md={6}>{cartao('Custo de materiais', r.custo, 'das obras concluídas no período')}</Col>
          <Col xs={12} md={6}>{cartao('Lucro das concluídas', r.lucro, r.faturado ? `margem ${(Math.round((r.lucro / r.faturado) * 1000) / 10).toLocaleString('pt-BR')}%` : undefined, r.lucro < 0 ? '#cf1322' : '#389e0d')}</Col>
          <Col xs={12} md={6}>{cartao('Metros perfurados', r.metrosPerfurados, `${r.perfuracoes} perfuração(ões) concluída(s)`, undefined, false)}</Col>
        </Row>

        {!!dados.alertas.length && (
          <Card size="small" title={<Space><WarningOutlined style={{ color: '#d48806' }} />Obras para olhar ({dados.alertas.length})</Space>}>
            <List size="small" dataSource={dados.alertas} renderItem={a => (
              <List.Item style={{ cursor: 'pointer' }} onClick={() => abrirObra(a.idObra, a.tipo === 'SALDO_NAO_LANCADO' ? 'COBRANCA' : undefined)}>
                <Text strong>Nº {a.idObra} · {a.titulo}</Text><Text type="secondary">{a.texto}</Text>
              </List.Item>
            )} />
          </Card>
        )}

        <Card size="small" title="Últimos 12 meses" extra={<Text type="secondary" style={{ fontSize: 12 }}>Recebido (sem estornos) e faturado (obras concluídas no mês)</Text>}>
          {dados.serie.some(p => p.recebido || p.faturado) ? (
            <GraficoBarras
              pontos={dados.serie.map(p => ({ chave: p.chave, rotulo: p.rotulo, valores: { recebido: p.recebido }, linha: p.faturado }))}
              series={[{ chave: 'recebido', nome: 'Recebido', cor: VERDE }]} linha={{ nome: 'Faturado', cor: AZUL }} formatar={brlCurto} altura={220} />
          ) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Sem recebimentos nem obras concluídas nos últimos 12 meses" />}
        </Card>

        <Card size="small" title="Lucro por obra"
          extra={<Segmented size="small" value={filtro} onChange={v => setFiltro(v as FiltroObras)}
            options={[{ value: 'PERIODO', label: 'Concluídas no período' }, { value: 'ANDAMENTO', label: 'Em andamento' }, { value: 'TODAS', label: 'Todas' }]} />}>
          <Alert type="info" showIcon style={{ marginBottom: 8 }}
            message="Lucro = contrato + adicionais aprovados − materiais. Onde o material ainda não foi conferido, entra o previsto (custo estimado)." />
          <Table<LucroObra> size="small" rowKey="idObra" dataSource={obras} pagination={{ pageSize: 50, hideOnSinglePage: true }}
            locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Nenhuma obra neste filtro" /> }}
            onRow={o => ({ onClick: () => abrirObra(o.idObra), style: { cursor: 'pointer' } })}
            summary={linhas => {
              const s = (k: 'total' | 'recebido' | 'custo' | 'lucro') => linhas.reduce((a, o) => a + Math.round(o[k] * 100), 0) / 100;
              return linhas.length > 1 ? (
                <Table.Summary.Row>
                  <Table.Summary.Cell index={0} colSpan={2}><Text strong>Total ({linhas.length})</Text></Table.Summary.Cell>
                  <Table.Summary.Cell index={2} align="right"><Text strong>{brl(s('total'))}</Text></Table.Summary.Cell>
                  <Table.Summary.Cell index={3} align="right">{brl(s('recebido'))}</Table.Summary.Cell>
                  <Table.Summary.Cell index={4} align="right">{brl(s('custo'))}</Table.Summary.Cell>
                  <Table.Summary.Cell index={5} align="right"><Text strong>{brl(s('lucro'))}</Text></Table.Summary.Cell>
                  <Table.Summary.Cell index={6} />
                </Table.Summary.Row>
              ) : null;
            }}
            columns={[
              {
                title: 'Obra', render: (_, o) => (
                  <div style={{ lineHeight: 1.35 }}>
                    <Text strong>Nº {o.idObra} · {o.titulo}</Text>
                    <div><Text type="secondary" style={{ fontSize: 12 }}>{o.cliente}{o.servicos.length ? ` · ${o.servicos.map(s => SERVICOS[s]).join(' + ')}` : ''}{o.termino ? ` · concluída ${dataBr(o.termino)}` : ''}</Text></div>
                  </div>
                ),
              },
              { title: 'Situação', width: 140, render: (_, o) => <Tag color={SITUACOES_OBRA[o.situacao].cor}>{SITUACOES_OBRA[o.situacao].texto}</Tag> },
              { title: 'Total', width: 120, align: 'right', render: (_, o) => brl(o.total) },
              { title: 'Recebido', width: 120, align: 'right', render: (_, o) => <>{brl(o.recebido)}{o.aReceber > 0 && <div><Text type="secondary" style={{ fontSize: 11 }}>falta {brl(o.aReceber)}</Text></div>}</> },
              {
                title: 'Materiais', width: 130, align: 'right', render: (_, o) => (o.semMateriais ? <Text type="secondary">sem lançar</Text>
                  : <Tooltip title={o.custoEstimado ? 'Tem material sem conferir: entrou o previsto' : undefined}>{brl(o.custo)}{o.custoEstimado && <Text type="warning"> *</Text>}</Tooltip>),
              },
              { title: 'Lucro', width: 120, align: 'right', render: (_, o) => <Text strong style={{ color: o.lucro < 0 ? '#cf1322' : undefined }}>{brl(o.lucro)}</Text> },
              { title: 'Margem', width: 80, align: 'right', render: (_, o) => (o.margem === null ? '—' : `${o.margem.toLocaleString('pt-BR')}%`) },
            ]} />
        </Card>
      </>}
    </Space>
  );
};

export default PainelPocos;
