// Vendas › resultado do pedido: o fechamento de um orçamento, venda ou pedido — quanto entra, quanto custa, quanto sobra
// de lucro, a margem contra o alvo e a mínima, o que puxa o lucro para baixo e o lucro de cada item. Só leitura.
import React, { useEffect, useState } from 'react';
import { Alert, Card, Col, Descriptions, Empty, Modal, Row, Space, Statistic, Table, Tag, Tooltip, Typography } from 'antd';
import { carregarResultadoPedido, ItemDoResultado, NivelResultado, ResultadoPedido } from './resultadoApi';

const { Text } = Typography;
const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const pct = (v: number | null) => (v === null ? '—' : `${(v * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`);
const dataBr = (s: string) => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)} ${s.slice(11, 16)}` : '');

const NIVEL: Record<NivelResultado, { tag: string; cor: string; alerta: 'success' | 'info' | 'warning' | 'error' }> = {
  OTIMA: { tag: 'Lucro ótimo', cor: '#389e0d', alerta: 'success' },
  BOA: { tag: 'Lucro bom', cor: '#389e0d', alerta: 'success' },
  ABAIXO_ALVO: { tag: 'Lucro aceitável', cor: '#d48806', alerta: 'info' },
  ABAIXO_MINIMA: { tag: 'Lucro baixo', cor: '#d46b08', alerta: 'warning' },
  PREJUIZO: { tag: 'Prejuízo', cor: '#cf1322', alerta: 'error' },
};
const SITUACAO: Record<string, string> = { ORCAMENTO: 'Orçamento', CONCLUIDA: 'Venda concluída', CONVERTIDO: 'Orçamento vendido', CANCELADA: 'Cancelada', SUSPENSA: 'Suspensa' };
const FORMA: Record<string, string> = { PIX: 'PIX', DINHEIRO: 'Dinheiro', DEBITO: 'Débito', CREDITO: 'Crédito', PRAZO: 'A prazo', SINAL: 'Sinal/crédito', ADIANTAMENTO: 'Sinal/crédito' };

export const ResultadoPedidoModal: React.FC<{ idVenda: number | null; onFechar: () => void }> = ({ idVenda, onFechar }) => {
  const [d, setD] = useState<ResultadoPedido | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  useEffect(() => {
    setD(null); setErro(null);
    if (idVenda) carregarResultadoPedido(idVenda).then(setD).catch(e => setErro(e instanceof Error ? e.message : 'Erro.'));
  }, [idVenda]);

  const r = d?.resultado;
  const n = r ? NIVEL[r.nivel] : null;

  return (
    <Modal open={!!idVenda} onCancel={onFechar} footer={null} width={980} destroyOnHidden
      title={d ? <Space wrap>Resultado do pedido Nº {d.pedido.idVenda}<Tag>{SITUACAO[d.pedido.status] || d.pedido.status}</Tag>{d.pedido.cliente && <Text type="secondary">{d.pedido.cliente}</Text>}</Space> : 'Resultado do pedido'}>
      {erro && <Alert type="error" showIcon message={erro} />}
      {!d && !erro && <Card loading bordered={false} />}
      {d && r && n && (
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Alert type={n.alerta} showIcon message={<b>{r.avaliacao}</b>}
            description={<>
              {r.faltaParaAlvo > 0 && <div>Para chegar na margem alvo com o mesmo custo, o pedido precisaria de mais {brl(r.faltaParaAlvo)} (total {brl(r.receitaNoAlvo || 0)}).</div>}
              {r.melhorItem && <div>O item que mais deixa lucro: {r.melhorItem.sku} ({brl(r.melhorItem.lucro)}).</div>}
              {!r.custoCompleto && <div><b>Atenção:</b> tem item sem custo cadastrado — o lucro real é menor que o mostrado.</div>}
              {r.taxasEstimadas && <div>Orçamento: as taxas são as estimadas pela condição combinada; viram as reais quando for vendido.</div>}
            </>} />

          <Row gutter={[12, 12]}>
            <Col xs={12} md={6}><Card size="small"><Statistic title="Recebe (produtos)" value={brl(r.receita)} valueStyle={{ fontSize: 18 }} />
              {r.frete > 0 && <Text type="secondary" style={{ fontSize: 12 }}>+ frete {brl(r.frete)}</Text>}</Card></Col>
            <Col xs={12} md={6}><Card size="small"><Statistic title="Custo das mercadorias" value={brl(r.custo)} valueStyle={{ fontSize: 18 }} /></Card></Col>
            <Col xs={12} md={6}><Card size="small"><Statistic title={`Taxas${r.taxasEstimadas ? ' (estimadas)' : ''}`} value={brl(r.taxas)} valueStyle={{ fontSize: 18 }} /></Card></Col>
            <Col xs={12} md={6}><Card size="small" style={{ borderColor: n.cor }}>
              <Statistic title="Lucro" value={brl(r.lucro)} valueStyle={{ fontSize: 20, color: n.cor, fontWeight: 600 }} />
              <Tag color={r.nivel === 'PREJUIZO' ? 'red' : r.nivel === 'ABAIXO_MINIMA' ? 'orange' : r.nivel === 'ABAIXO_ALVO' ? 'gold' : 'green'} style={{ marginTop: 2 }}>{n.tag} · {pct(r.margem)}</Tag>
            </Card></Col>
          </Row>

          <Card size="small" title="Margem do pedido">
            {/* régua: a margem do pedido com a mínima e o alvo marcados */}
            {(() => {
              const topo = Math.max(r.margemAlvo + 0.15, (r.margem ?? 0) + 0.05, 0.2);
              const pos = (v: number) => `${Math.min(100, Math.max(0, (v / topo) * 100))}%`;
              return (
                <div style={{ position: 'relative', height: 34, marginTop: 4 }}>
                  <div style={{ position: 'absolute', top: 8, left: 0, right: 0, height: 10, background: '#f0f0f0', borderRadius: 5 }} />
                  <div style={{ position: 'absolute', top: 8, left: 0, width: pos(Math.max(0, r.margem ?? 0)), height: 10, background: n.cor, borderRadius: 5 }} />
                  {[{ v: r.margemMinima, t: `mínima ${pct(r.margemMinima)}` }, { v: r.margemAlvo, t: `alvo ${pct(r.margemAlvo)}` }].map(m => (
                    <div key={m.t} style={{ position: 'absolute', left: pos(m.v), top: 2, bottom: 0 }}>
                      <div style={{ width: 2, height: 22, background: '#595959', marginLeft: -1 }} />
                      <Text type="secondary" style={{ fontSize: 10, position: 'absolute', top: 22, left: -24, whiteSpace: 'nowrap' }}>{m.t}</Text>
                    </div>
                  ))}
                </div>
              );
            })()}
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 10 }}>
              Margem deste pedido: <b style={{ color: n.cor }}>{pct(r.margem)}</b>{d.pedido.negociado ? ' · o alvo é o da negociação' : ''} · o lucro é o que sobra depois do custo e das taxas, sem o frete.
            </Text>
          </Card>

          <Row gutter={12}>
            <Col xs={24} md={12}>
              <Card size="small" title="Como chega no lucro">
                <Descriptions size="small" column={1} items={[
                  { key: 't', label: 'Preço de tabela', children: brl(r.tabela) },
                  ...(r.descontoItens > 0 ? [{ key: 'd', label: 'Desconto nos itens', children: `− ${brl(r.descontoItens)}` }] : []),
                  ...(r.descontoForma > 0 ? [{ key: 'f', label: 'Desconto da forma de pagamento', children: `− ${brl(r.descontoForma)}` }] : []),
                  ...(r.devolvido > 0 ? [{ key: 'v', label: 'Devolvido', children: `− ${brl(r.devolvido)}` }] : []),
                  { key: 'r', label: <b>Recebe pelos produtos</b>, children: <b>{brl(r.receita)}</b> },
                  { key: 'c', label: 'Custo das mercadorias', children: `− ${brl(r.custo)}` },
                  { key: 'x', label: `Taxas dos pagamentos${r.taxasEstimadas ? ' (estimadas)' : ''}`, children: `− ${brl(r.taxas)}` },
                  { key: 'l', label: <b>Lucro</b>, children: <b style={{ color: n.cor }}>{brl(r.lucro)} ({pct(r.margem)})</b> },
                ]} />
              </Card>
            </Col>
            <Col xs={24} md={12}>
              <Card size="small" title="Pagamento">
                <Text type="secondary" style={{ fontSize: 12 }}>{d.pedido.condicao || 'Condição não informada'}</Text>
                {d.pagamentos.length ? (
                  <Table size="small" pagination={false} rowKey={(_, i) => String(i)} style={{ marginTop: 6 }} dataSource={d.pagamentos}
                    columns={[
                      { title: 'Forma', render: (_, x) => <>{FORMA[x.forma] || x.forma}{x.quando && <Text type="secondary" style={{ fontSize: 11 }}> · {x.quando}</Text>}</> },
                      { title: 'Valor', align: 'right', render: (_, x) => brl(x.valor) },
                      { title: 'Taxa', align: 'right', render: (_, x) => (x.taxa === null ? <Text type="secondary">prevista</Text> : x.taxa ? brl(x.taxa) : '—') },
                    ]} />
                ) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Sem pagamento lançado" />}
                {d.pedido.autorizadoPor && <div style={{ marginTop: 6 }}><Text type="secondary" style={{ fontSize: 12 }}>Autorizado por {d.pedido.autorizadoPor}{d.pedido.motivoAutorizacao ? `: ${d.pedido.motivoAutorizacao}` : ''}</Text></div>}
              </Card>
            </Col>
          </Row>

          {!!r.fatores.length && (
            <Card size="small" title="O que pesa no lucro">
              <ul style={{ margin: 0, paddingLeft: 18 }}>{r.fatores.map(f => <li key={f}>{f}</li>)}</ul>
            </Card>
          )}

          <Card size="small" title="Lucro por item">
            <Table<ItemDoResultado> size="small" pagination={false} rowKey={(_, i) => String(i)} dataSource={r.itens}
              columns={[
                { title: 'Item', render: (_, i) => <div style={{ lineHeight: 1.3 }}><Text strong>{i.sku}</Text><div><Text type="secondary" style={{ fontSize: 11 }}>{i.nome}</Text></div></div> },
                { title: 'Qtd', align: 'right', width: 80, render: (_, i) => `${i.quantidade.toLocaleString('pt-BR')} ${i.unidade}` },
                { title: 'Recebe', align: 'right', width: 110, render: (_, i) => <Tooltip title={i.descontoPct > 0 ? `${pct(i.descontoPct)} abaixo da tabela` : undefined}>{brl(i.receita)}</Tooltip> },
                { title: 'Custo', align: 'right', width: 110, render: (_, i) => (i.semCusto ? <Tag color="orange" style={{ margin: 0 }}>sem custo</Tag> : brl(i.custoTotal)) },
                { title: 'Lucro', align: 'right', width: 110, render: (_, i) => <Text style={{ color: i.lucro < 0 ? '#cf1322' : undefined }}>{brl(i.lucro)}</Text> },
                { title: 'Margem', align: 'right', width: 80, render: (_, i) => pct(i.margem) },
              ]} />
          </Card>
          <Text type="secondary" style={{ fontSize: 12 }}>Só leitura: esta tela não muda nenhum valor do pedido. {d.pedido.data ? `Pedido de ${dataBr(d.pedido.data)}${d.pedido.operador ? ` · ${d.pedido.operador}` : ''}.` : ''}</Text>
        </Space>
      )}
    </Modal>
  );
};
