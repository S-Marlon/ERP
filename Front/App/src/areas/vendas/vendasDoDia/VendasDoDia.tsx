// Vendas do dia (PDV, modelo novo): resumo do caixa, detalhe de cada venda e cancelamento com estorno de estoque.
import { API_URL } from '../../../shared/api/config';
import React, { useEffect, useMemo, useState } from 'react';
import { Button, Card, Col, Empty, Input, Row, Space, Spin, Statistic, Table, Tag, Tooltip, message } from 'antd';
import { ReloadOutlined, StopOutlined } from '@ant-design/icons';
import Swal from 'sweetalert2';
import { ModalDevolucao } from '../pdv/components/ModalDevolucao';
import { salesService, VendaResumo } from '../pdv/services/salesService';

const API_VENDAS = `${API_URL}/api/vendas/pdv/vendas`;

const FORMAS: Record<string, { label: string; cor: string }> = {
  DINHEIRO: { label: 'Dinheiro', cor: 'green' },
  PIX: { label: 'PIX', cor: 'cyan' },
  DEBITO: { label: 'Débito', cor: 'blue' },
  CREDITO: { label: 'Crédito', cor: 'geekblue' },
  PRAZO: { label: 'Crediário', cor: 'orange' },
  TRANSFERENCIA: { label: 'Transferência', cor: 'purple' },
};

const money = (v: number) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const hoje = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const hora = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

interface DetalheVenda {
  itens: any[];
  pagamentos: any[];
  operador?: string | null;
  id_caixa?: number | null;
  autorizado_por?: string | null;
  motivo_autorizacao?: string | null;
}

const DetalheLinha: React.FC<{ idVenda: number }> = ({ idVenda }) => {
  const [detalhe, setDetalhe] = useState<DetalheVenda | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_VENDAS}/${idVenda}`)
      .then(r => (r.ok ? r.json() : Promise.reject(new Error('Falha ao carregar a venda.'))))
      .then(setDetalhe)
      .catch(e => setErro(e.message));
  }, [idVenda]);

  if (erro) return <span style={{ color: '#dc2626' }}>{erro}</span>;
  if (!detalhe) return <Spin size="small" />;

  return (
    <Row gutter={16}>
      <Col xs={24} lg={16}>
        <Table
          size="small"
          rowKey="id_venda_item"
          pagination={false}
          dataSource={detalhe.itens}
          columns={[
            { title: 'SKU', dataIndex: 'sku_snapshot', width: 140 },
            { title: 'Item', dataIndex: 'nome_snapshot' },
            {
              title: 'Qtd', key: 'qtd', width: 110, align: 'right' as const,
              render: (_: unknown, i: any) => (
                <Tooltip title={Number(i.fator_conversao) !== 1 ? `Baixou ${Number(i.quantidade_base)} na unidade base` : undefined}>
                  {Number(i.quantidade).toLocaleString('pt-BR')} {i.unidade_sigla || ''}
                </Tooltip>
              ),
            },
            { title: 'Tabela', dataIndex: 'preco_tabela', width: 100, align: 'right' as const, render: (v: number) => money(v) },
            { title: 'Desconto', dataIndex: 'desconto_valor', width: 100, align: 'right' as const, render: (v: number) => (Number(v) > 0 ? money(v) : '-') },
            { title: 'Total', dataIndex: 'total_item', width: 110, align: 'right' as const, render: (v: number) => <b>{money(v)}</b> },
            {
              title: 'Margem', key: 'margem', width: 80, align: 'right' as const,
              render: (_: unknown, i: any) => {
                const total = Number(i.total_item);
                return total > 0 ? `${(((total - Number(i.custo_total)) / total) * 100).toFixed(1)}%` : '-';
              },
            },
          ]}
        />
      </Col>
      <Col xs={24} lg={8}>
        <Card size="small" title="Pagamentos">
          {detalhe.pagamentos.map(p => (
            <div key={p.id_pagamento} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <span>
                <Tag color={FORMAS[p.forma]?.cor}>{FORMAS[p.forma]?.label || p.forma}</Tag>
                {Number(p.parcelas) > 1 ? `${p.parcelas}x` : ''}
              </span>
              <span>
                {money(p.valor)}
                {Number(p.troco) > 0 && <span style={{ color: '#64748b', fontSize: 11 }}> (troco {money(p.troco)})</span>}
              </span>
            </div>
          ))}
        </Card>
        <div style={{ fontSize: 12, color: '#64748b', marginTop: 6 }}>
          {detalhe.operador && <div>Operador: <b>{detalhe.operador}</b>{detalhe.id_caixa ? ` · caixa ${detalhe.id_caixa}` : ''}</div>}
          {detalhe.autorizado_por && (
            <div style={{ color: '#b45309' }}>Autorizado por <b>{detalhe.autorizado_por}</b>: {detalhe.motivo_autorizacao}</div>
          )}
        </div>
      </Col>
    </Row>
  );
};

const VendasDoDia: React.FC = () => {
  const [devolvendo, setDevolvendo] = useState<number | null>(null);
  const [numeroVenda, setNumeroVenda] = useState('');
  const [data, setData] = useState<string>(hoje());
  const [vendas, setVendas] = useState<VendaResumo[]>([]);
  const [carregando, setCarregando] = useState(false);

  const carregar = async () => {
    setCarregando(true);
    try {
      setVendas(await salesService.listarVendas(data));
    } catch (e: any) {
      message.error(e.message);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => { carregar(); }, [data]);

  // Resumo só com as vendas válidas (canceladas ficam fora dos totais)
  const resumo = useMemo(() => {
    const validas = vendas.filter(v => v.status === 'CONCLUIDA');
    const liquido = validas.reduce((a, v) => a + v.totalLiquido, 0);
    const custo = validas.reduce((a, v) => a + v.totalCusto, 0);
    return {
      quantidade: validas.length,
      canceladas: vendas.length - validas.length,
      liquido,
      desconto: validas.reduce((a, v) => a + v.totalDesconto, 0),
      lucro: liquido - custo,
      margem: liquido > 0 ? ((liquido - custo) / liquido) * 100 : 0,
      ticket: validas.length > 0 ? liquido / validas.length : 0,
    };
  }, [vendas]);

  const cancelar = async (venda: VendaResumo) => {
    const { value: motivo } = await Swal.fire({
      title: `Cancelar a venda ${venda.idVenda}?`,
      html: `Total de <b>${money(venda.totalLiquido)}</b>. Os itens voltam para o estoque.`,
      input: 'text',
      inputPlaceholder: 'Motivo do cancelamento',
      inputValidator: v => (!String(v || '').trim() ? 'Informe o motivo.' : undefined),
      showCancelButton: true,
      confirmButtonText: 'Cancelar venda',
      confirmButtonColor: '#dc2626',
      cancelButtonText: 'Voltar',
    });
    if (!motivo) return;
    try {
      await salesService.cancelarVenda(venda.idVenda, String(motivo).trim());
      message.success(`Venda ${venda.idVenda} cancelada e estoque devolvido.`);
      carregar();
    } catch (e: any) {
      Swal.fire('Não foi possível cancelar', e.message, 'error');
    }
  };

  return (
    <div style={{ padding: 16, background: '#f8fafc', minHeight: '100vh' }}>
      <Space direction="vertical" style={{ width: '100%' }} size={12}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>Vendas do Dia</h2>
          <Space>
            <Input.Search placeholder="Devolver venda Nº" style={{ width: 180 }} value={numeroVenda} onChange={e => setNumeroVenda(e.target.value.replace(/\D/g, ''))}
              enterButton="Devolver" onSearch={v => { if (Number(v) > 0) setDevolvendo(Number(v)); }} />
            <Input type="date" value={data} max={hoje()} onChange={e => setData(e.target.value || hoje())} style={{ width: 160 }} />
            <Button icon={<ReloadOutlined />} onClick={carregar} loading={carregando}>Atualizar</Button>
          </Space>
        </div>

        <Row gutter={[12, 12]}>
          {[
            { titulo: 'Faturado', valor: money(resumo.liquido), extra: `${resumo.quantidade} venda(s)` },
            { titulo: 'Ticket médio', valor: money(resumo.ticket) },
            { titulo: 'Descontos', valor: money(resumo.desconto) },
            { titulo: 'Lucro bruto', valor: money(resumo.lucro), extra: `margem ${resumo.margem.toFixed(1)}%` },
            { titulo: 'Canceladas', valor: String(resumo.canceladas) },
          ].map(c => (
            <Col key={c.titulo} xs={12} md={8} lg={4}>
              <Card size="small">
                <Statistic title={c.titulo} value={c.valor} valueStyle={{ fontSize: 18, fontWeight: 700 }} />
                {c.extra && <span style={{ fontSize: 11, color: '#64748b' }}>{c.extra}</span>}
              </Card>
            </Col>
          ))}
        </Row>

        <Card size="small" bodyStyle={{ padding: 0 }}>
          <Table
            rowKey="idVenda"
            size="small"
            loading={carregando}
            dataSource={vendas}
            pagination={{ pageSize: 20, hideOnSinglePage: true }}
            locale={{ emptyText: <Empty description="Nenhuma venda nesta data" /> }}
            expandable={{ expandedRowRender: v => <DetalheLinha idVenda={v.idVenda} /> }}
            rowClassName={v => (v.status === 'CANCELADA' ? 'venda-cancelada' : '')}
            columns={[
              { title: 'Nº', dataIndex: 'idVenda', width: 70 },
              { title: 'Hora', dataIndex: 'criadoEm', width: 70, render: (v: string) => hora(v) },
              { title: 'Cliente', dataIndex: 'clienteNome' },
              { title: 'Itens', dataIndex: 'qtdItens', width: 60, align: 'center' as const },
              {
                title: 'Pagamento', dataIndex: 'formas', width: 200,
                render: (formas: string[]) => formas.map(f => <Tag key={f} color={FORMAS[f]?.cor}>{FORMAS[f]?.label || f}</Tag>),
              },
              { title: 'Desconto', dataIndex: 'totalDesconto', width: 100, align: 'right' as const, render: (v: number) => (v > 0 ? money(v) : '-') },
              {
                title: 'Total', dataIndex: 'totalLiquido', width: 120, align: 'right' as const,
                render: (v: number, venda) => (
                  <span>
                    <b style={venda.status === 'CANCELADA' ? { textDecoration: 'line-through', color: '#94a3b8' } : undefined}>{money(v)}</b>
                    {Number(venda.totalDevolvido) > 0 && <div><Tag color="orange" style={{ margin: 0, fontSize: 10 }}>devolvido {money(Number(venda.totalDevolvido))}</Tag></div>}
                  </span>
                ),
              },
              {
                title: 'Situação', dataIndex: 'status', width: 110,
                render: (s: string, venda) => (s === 'CANCELADA'
                  ? <Tooltip title={venda.motivoCancelamento || ''}><Tag color="red">Cancelada</Tag></Tooltip>
                  : <Tag color="green">Concluída</Tag>),
              },
              {
                title: '', key: 'acoes', width: 120, align: 'center' as const,
                render: (_: unknown, venda) => venda.status === 'CONCLUIDA' && (
                  <Space size={2}>
                    <Button size="small" onClick={() => setDevolvendo(venda.idVenda)}>Devolver</Button>
                    {!(Number(venda.totalDevolvido) > 0) && (
                      <Tooltip title="Cancelar venda inteira (devolve o estoque)">
                        <Button type="text" danger size="small" icon={<StopOutlined />} onClick={() => cancelar(venda)} />
                      </Tooltip>
                    )}
                  </Space>
                ),
              },
            ]}
          />
        </Card>
      </Space>
      <ModalDevolucao idVenda={devolvendo} onFechar={() => { setDevolvendo(null); setNumeroVenda(''); }} onConcluido={carregar} />
    </div>
  );
};

export default VendasDoDia;
