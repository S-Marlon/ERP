// Desempenho do anúncio na lista principal: visitas, vendas e conversão dos últimos 30 dias, com a variação sobre os
// 30 anteriores (o comparativo que o painel do ML esconde num ícone), e quantos dias o estoque no ML dura.
import React from 'react';
import { Space, Table, Tooltip, Typography } from 'antd';
import { EyeOutlined, ShoppingCartOutlined } from '@ant-design/icons';
import type { DesempenhoPeriodos, NumerosDesempenho } from './mercadoLivreApi';

const { Text } = Typography;

const dataCurta = (d: string) => { const [, m, dd] = d.split('-'); return `${Number(dd)}/${['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'][Number(m) - 1]}`; };
const pct = (v: number | null) => (v === null ? '—' : `${v.toFixed(1).replace('.', ',')}%`);

/** Variação sobre o período anterior: null sem base; 'novo' quando antes era zero. */
export const variacao = (atual: number | null, antes: number | null): number | 'novo' | null => {
  if (atual === null || antes === null) return null;
  if (antes === 0) return atual > 0 ? 'novo' : null;
  return Math.round(((atual - antes) / antes) * 1000) / 10;
};

const Variacao: React.FC<{ v: number | 'novo' | null }> = ({ v }) => {
  if (v === null) return <Text type="secondary" style={{ fontSize: 11 }}>—</Text>;
  if (v === 'novo') return <Text style={{ fontSize: 11, color: '#389e0d' }}>novo</Text>;
  const cor = v > 0 ? '#389e0d' : v < 0 ? '#cf1322' : undefined;
  return <Text style={{ fontSize: 11, color: cor }}>{v > 0 ? '▲' : v < 0 ? '▼' : ''}{Math.abs(v).toFixed(0)}%</Text>;
};

export const DesempenhoCelula: React.FC<{
  atual: NumerosDesempenho; anterior: NumerosDesempenho; periodo: DesempenhoPeriodos; dias: number; semVisitas?: boolean;
}> = ({ atual, anterior, periodo, dias, semVisitas }) => {
  const linhas = [
    { chave: 'Visitas', agora: String(atual.visitas), antes: String(anterior.visitas), v: variacao(atual.visitas, anterior.visitas) },
    { chave: 'Vendas', agora: `${atual.vendas}${atual.unidades !== atual.vendas ? ` (${atual.unidades} un)` : ''}`, antes: String(anterior.vendas), v: variacao(atual.vendas, anterior.vendas) },
    { chave: 'Conversão', agora: pct(atual.conversao), antes: pct(anterior.conversao), v: variacao(atual.conversao, anterior.conversao) },
  ];
  const detalhe = (
    <div style={{ minWidth: 300 }}>
      <div style={{ marginBottom: 6 }}>
        Últimos {dias} dias (<b>{dataCurta(periodo.atual.de)} a {dataCurta(periodo.atual.ate)}</b>) em comparação a {dataCurta(periodo.anterior.de)} a {dataCurta(periodo.anterior.ate)}:
      </div>
      <Table
        size="small" pagination={false} rowKey="chave" dataSource={linhas}
        columns={[
          { title: '', dataIndex: 'chave' },
          { title: 'Agora', dataIndex: 'agora', align: 'right' },
          { title: 'Antes', dataIndex: 'antes', align: 'right' },
          { title: 'Variação', align: 'right', render: (_, l) => <Variacao v={l.v} /> },
        ]}
      />
      <div style={{ marginTop: 6, fontSize: 11, opacity: 0.8 }}>
        Visitas: do ML. Vendas: pedidos pagos do ML lidos pelo ERP. Conversão: vendas ÷ visitas.
        {semVisitas ? ' O ML não devolveu as visitas deste anúncio agora.' : ''}
      </div>
    </div>
  );
  return (
    <Tooltip title={detalhe} color="#fff" styles={{ container: { color: 'rgba(0,0,0,0.88)' } }}>
      <div style={{ lineHeight: 1.4, cursor: 'default' }}>
        <Space size={4}>
          <EyeOutlined style={{ color: '#8c8c8c' }} />
          <Text>{semVisitas ? '—' : atual.visitas}</Text>
          {!semVisitas && <Variacao v={variacao(atual.visitas, anterior.visitas)} />}
        </Space>
        <div>
          <Space size={4}>
            <ShoppingCartOutlined style={{ color: '#8c8c8c' }} />
            <Text strong={atual.vendas > 0}>{atual.vendas}</Text>
            <Text type="secondary" style={{ fontSize: 11 }}>· {pct(atual.conversao)}</Text>
          </Space>
        </div>
      </div>
    </Tooltip>
  );
};

/** Quantos dias o estoque no ML dura no ritmo de venda (só aparece com venda no período). */
export const Cobertura: React.FC<{ dias: number | null | undefined; periodo: number }> = ({ dias, periodo }) => {
  if (dias === null || dias === undefined) return null;
  const cor = dias < 7 ? '#cf1322' : dias < 15 ? '#d46b08' : undefined;
  return (
    <Tooltip title={`No ritmo de venda dos últimos ${periodo} dias, o estoque no ML acaba em cerca de ${dias} dia(s).`}>
      <Text type={cor ? undefined : 'secondary'} style={{ fontSize: 11, color: cor }}>dura ~{dias} dia{dias === 1 ? '' : 's'}</Text>
    </Tooltip>
  );
};
