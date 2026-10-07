// Movimentações de estoque (modelo novo): extrato geral com filtros por período, origem, tipo e item.
import React, { useEffect, useState } from 'react';
import { Button, Card, Input, Select, Space, Table, Tag, Tooltip, message } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { Deposito, DEPOSITOS_ESTOQUE, getMovimentos, Movimento, ORIGENS_MOVIMENTO } from '../api/estoqueItensApi';

const money = (v: number) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const qtd = (v: number) => Number(v || 0).toLocaleString('pt-BR', { maximumFractionDigits: 4 });
const hoje = () => new Date().toISOString().slice(0, 10);
const diasAtras = (d: number) => new Date(Date.now() - d * 86400000).toISOString().slice(0, 10);

const Movimentacoes: React.FC = () => {
  const [dados, setDados] = useState<Movimento[]>([]);
  const [total, setTotal] = useState(0);
  const [carregando, setCarregando] = useState(false);
  const [buscaDigitada, setBuscaDigitada] = useState('');
  const [filtros, setFiltros] = useState<{ de: string; ate: string; deposito: Deposito | ''; origem: string; tipo: string; busca: string; page: number; limit: number }>(
    { de: diasAtras(30), ate: hoje(), deposito: '', origem: '', tipo: '', busca: '', page: 1, limit: 50 });

  const carregar = async () => {
    setCarregando(true);
    try {
      const { deposito, ...resto } = filtros;
      const r = await getMovimentos({ ...resto, deposito: deposito || undefined });
      setDados(r.data);
      setTotal(r.pagination.total);
    } catch (e: any) {
      message.error(e.message);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => { carregar(); }, [filtros]);
  useEffect(() => {
    const t = setTimeout(() => setFiltros(f => (f.busca === buscaDigitada ? f : { ...f, busca: buscaDigitada, page: 1 })), 400);
    return () => clearTimeout(t);
  }, [buscaDigitada]);

  return (
    <div style={{ padding: 16, background: '#f8fafc', minHeight: '100vh' }}>
      <Space direction="vertical" style={{ width: '100%' }} size={12}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>Movimentações de Estoque</h2>
          <Button icon={<ReloadOutlined />} onClick={carregar} loading={carregando}>Atualizar</Button>
        </div>

        <Card size="small">
          <Space wrap style={{ marginBottom: 8 }}>
            <Input type="date" value={filtros.de} max={filtros.ate} onChange={e => setFiltros(f => ({ ...f, de: e.target.value, page: 1 }))} style={{ width: 150 }} />
            <span>até</span>
            <Input type="date" value={filtros.ate} min={filtros.de} onChange={e => setFiltros(f => ({ ...f, ate: e.target.value, page: 1 }))} style={{ width: 150 }} />
            <Select
              style={{ width: 170 }}
              value={filtros.deposito}
              onChange={v => setFiltros(f => ({ ...f, deposito: v, page: 1 }))}
              options={[{ value: '', label: 'Todos os depósitos' }, ...(Object.keys(DEPOSITOS_ESTOQUE) as Deposito[]).map(d => ({ value: d, label: DEPOSITOS_ESTOQUE[d].label }))]}
            />
            <Select
              style={{ width: 200 }}
              value={filtros.origem}
              onChange={v => setFiltros(f => ({ ...f, origem: v, page: 1 }))}
              options={[{ value: '', label: 'Todas as origens' }, ...Object.entries(ORIGENS_MOVIMENTO).map(([k, v]) => ({ value: k, label: v.label }))]}
            />
            <Select
              style={{ width: 140 }}
              value={filtros.tipo}
              onChange={v => setFiltros(f => ({ ...f, tipo: v, page: 1 }))}
              options={[{ value: '', label: 'Entradas e saídas' }, { value: 'ENTRADA', label: 'Entradas' }, { value: 'SAIDA', label: 'Saídas' }]}
            />
            <Input.Search allowClear placeholder="Item, SKU ou documento" style={{ width: 260 }} value={buscaDigitada} onChange={e => setBuscaDigitada(e.target.value)} />
          </Space>

          <Table
            rowKey="idMovimento"
            size="small"
            loading={carregando}
            dataSource={dados}
            scroll={{ x: 1220 }}
            pagination={{
              current: filtros.page,
              pageSize: filtros.limit,
              total,
              showSizeChanger: true,
              onChange: (page, limit) => setFiltros(f => ({ ...f, page, limit })),
            }}
            columns={[
              { title: 'Data', dataIndex: 'criadoEm', width: 130, render: (v: string) => new Date(v).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) },
              {
                title: 'Depósito', dataIndex: 'deposito', width: 115,
                render: (d: Deposito) => <Tag color={DEPOSITOS_ESTOQUE[d]?.color}>{DEPOSITOS_ESTOQUE[d]?.label || d}</Tag>,
              },
              {
                title: 'Item', key: 'item',
                render: (_: unknown, m: Movimento) => (
                  <div>
                    <div style={{ fontWeight: 600 }}>{m.nome}</div>
                    <div style={{ fontSize: 11, color: '#64748b' }}>{m.sku}</div>
                  </div>
                ),
              },
              {
                title: 'Origem', dataIndex: 'origem', width: 170,
                render: (o: string, m: Movimento) => (
                  <div>
                    <Tag color={ORIGENS_MOVIMENTO[o]?.color}>{ORIGENS_MOVIMENTO[o]?.label || o}</Tag>
                    {m.documento && (
                      <Tooltip title={m.documento}>
                        <div style={{ fontSize: 11, color: '#64748b', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.documento}</div>
                      </Tooltip>
                    )}
                  </div>
                ),
              },
              {
                title: 'Quantidade', key: 'q', width: 130, align: 'right' as const,
                render: (_: unknown, m: Movimento) => (
                  <Tooltip title={m.fatorConversao !== 1 && m.quantidadeDocumento !== null ? `${qtd(m.quantidadeDocumento)} ${m.unidadeDocumento || ''} no documento` : undefined}>
                    <b style={{ color: m.tipo === 'ENTRADA' ? '#16a34a' : '#dc2626' }}>
                      {m.tipo === 'ENTRADA' ? '+' : '-'}{qtd(m.quantidade)} {m.unidade}
                    </b>
                  </Tooltip>
                ),
              },
              { title: 'Saldo', key: 's', width: 120, align: 'right' as const, render: (_: unknown, m: Movimento) => `${qtd(m.saldoAnterior)} → ${qtd(m.saldoPosterior)}` },
              { title: 'Custo total', dataIndex: 'custoTotal', width: 110, align: 'right' as const, render: (v: number) => money(v) },
              { title: 'Observação', dataIndex: 'observacao', ellipsis: true },
            ]}
          />
        </Card>
      </Space>
    </div>
  );
};

export default Movimentacoes;
