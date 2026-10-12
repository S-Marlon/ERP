// Memória de preços do item: o que foi pago nas notas e o que os fornecedores cotaram (mesmo sem compra).
import React, { useEffect, useMemo, useState } from 'react';
import { Drawer, Empty, Spin, Table, Tag, Typography, message } from 'antd';
import { compraInteligenteApi, PrecoHistorico } from './compraInteligenteApi';

const { Text } = Typography;
const brl = (v: number) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 4 });
const dataBr = (d: string | null) => (d ? d.split('-').reverse().join('/') : '—');

interface Props {
  item: { idItem: number; sku: string; nome: string; unidade: string } | null;
  onFechar: () => void;
}

const HistoricoPrecosDrawer: React.FC<Props> = ({ item, onFechar }) => {
  const [linhas, setLinhas] = useState<PrecoHistorico[]>([]);
  const [carregando, setCarregando] = useState(false);
  useEffect(() => {
    if (!item) return;
    setCarregando(true);
    compraInteligenteApi.historico(item.idItem)
      .then(r => setLinhas(r.historico))
      .catch(e => message.error(e instanceof Error ? e.message : 'Erro ao carregar os preços.'))
      .finally(() => setCarregando(false));
  }, [item]);

  // Menor preço recente por fornecedor (na unidade de estoque, para comparar embalagens diferentes)
  const melhor = useMemo(() => {
    const porFornecedor = new Map<string, PrecoHistorico>();
    for (const l of linhas) if (!porFornecedor.has(l.fornecedor)) porFornecedor.set(l.fornecedor, l);
    return [...porFornecedor.values()].sort((a, b) => a.precoBase - b.precoBase);
  }, [linhas]);

  return (
    <Drawer open={!!item} onClose={onFechar} width={760} destroyOnHidden title={item ? `Preços · ${item.sku} · ${item.nome}` : ''}>
      <Spin spinning={carregando}>
        {melhor.length > 1 && (
          <div style={{ marginBottom: 12 }}>
            <Text strong>Último preço por fornecedor (por {item?.unidade || 'unidade'}): </Text>
            {melhor.map((m, i) => (
              <Tag key={m.fornecedor} color={i === 0 ? 'green' : undefined} style={{ marginBottom: 4 }}>
                {m.fornecedor}: {brl(m.precoBase)} {m.tipo === 'COTACAO' ? '(cotação)' : '(nota)'}
              </Tag>
            ))}
          </div>
        )}
        <Table<PrecoHistorico>
          size="small"
          rowKey={(l, i) => `${l.tipo}-${l.documento}-${i}`}
          dataSource={linhas}
          pagination={false}
          locale={{ emptyText: <Empty description="Sem compras nem cotações deste item ainda" /> }}
          columns={[
            { title: 'Data', dataIndex: 'data', width: 95, render: (v: string) => dataBr(v) },
            { title: 'Origem', key: 'tipo', width: 120, render: (_, l) => <Tag color={l.tipo === 'COTACAO' ? 'blue' : 'default'}>{l.tipo === 'COTACAO' ? 'Cotação' : 'Compra'} · {l.documento}</Tag> },
            { title: 'Fornecedor', dataIndex: 'fornecedor', ellipsis: true },
            { title: 'Qtd', key: 'q', width: 80, align: 'right' as const, render: (_, l) => `${l.quantidade.toLocaleString('pt-BR')} ${l.unidade}` },
            { title: 'Preço', key: 'p', width: 110, align: 'right' as const, render: (_, l) => `${brl(l.preco)}/${l.unidade || 'un'}` },
            { title: `Por ${item?.unidade || 'un'}`, dataIndex: 'precoBase', width: 100, align: 'right' as const, render: (v: number) => brl(v) },
            { title: 'Validade', dataIndex: 'validade', width: 90, render: (v: string | null) => (v ? dataBr(v) : '') },
          ]}
        />
      </Spin>
    </Drawer>
  );
};

export default HistoricoPrecosDrawer;
