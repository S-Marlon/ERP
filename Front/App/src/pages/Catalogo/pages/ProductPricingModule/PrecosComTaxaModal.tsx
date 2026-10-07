// Prévia e aplicação dos preços com a taxa da maquininha embutida (Vendas › Taxas de pagamento).
// Novo preço = custo gerencial x fator da unidade x markup x 1 / (1 - taxa de referência).
import React, { useEffect, useState } from 'react';
import { Alert, Button, Empty, Modal, Space, Table, Tag, Typography, message } from 'antd';
import { API_URL } from '../../../../shared/api/config';

const { Text } = Typography;
const API = `${API_URL}/api/catalogo/precos/taxa`;
const brl = (v: number) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

interface FaixaPrevia {
  idFaixa: number; sigla: string; tipo: string; quantidadeMinima: number; markup: number;
  precoAtual: number; precoNovo: number; variacaoPct: number | null; margemAtual: number | null; margemNova: number | null;
}
interface ItemPrevia { idItem: number; sku: string; nome: string; custo: number; faixas: FaixaPrevia[] }

export const PrecosComTaxaModal: React.FC<{ aberto: boolean; onFechar: () => void; onAplicado: () => void }> = ({ aberto, onFechar, onAplicado }) => {
  const [dados, setDados] = useState<{ taxaPercentual: number; itens: ItemPrevia[] } | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [selecionados, setSelecionados] = useState<React.Key[]>([]);
  const [aplicando, setAplicando] = useState(false);

  const carregar = async () => {
    setCarregando(true);
    try {
      const r = await fetch(`${API}/previa`);
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || (r.status === 404 ? 'Rota não encontrada: reinicie o backend.' : 'Erro na prévia.'));
      setDados(d);
      setSelecionados(d.itens.map((i: ItemPrevia) => i.idItem));
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Erro na prévia.');
    } finally {
      setCarregando(false);
    }
  };
  useEffect(() => { if (aberto) carregar(); }, [aberto]);

  const aplicar = async () => {
    setAplicando(true);
    try {
      const r = await fetch(`${API}/aplicar`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: selecionados }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Erro ao aplicar.');
      message.success(`${d.itens} item(ns) e ${d.faixas} faixa(s) de preço atualizados.`);
      onAplicado();
      carregar();
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Erro ao aplicar.');
    } finally {
      setAplicando(false);
    }
  };

  return (
    <Modal open={aberto} onCancel={onFechar} width={900} title="Preços com a taxa da maquininha"
      footer={[
        <Button key="f" onClick={onFechar}>Fechar</Button>,
        <Button key="a" type="primary" disabled={selecionados.length === 0} loading={aplicando}
          onClick={() => Modal.confirm({
            title: `Atualizar o preço de ${selecionados.length} item(ns)?`,
            content: 'As faixas de preço passam a ser custo × markup ÷ (1 − taxa). O markup de cada faixa é mantido.',
            okText: 'Atualizar preços', cancelText: 'Voltar', onOk: aplicar,
          })}>
          Aplicar em {selecionados.length} item(ns)
        </Button>,
      ]}>
      <Space direction="vertical" style={{ width: '100%' }}>
        {dados && (
          dados.taxaPercentual > 0
            ? <Alert type="info" showIcon message={<span>Taxa de referência: <b>{dados.taxaPercentual.toFixed(2)}%</b>. Para receber o markup depois da taxa, o preço é dividido por {(1 - dados.taxaPercentual / 100).toFixed(4)}.</span>}
              description="Também aparecem itens cujo preço já não batia com o markup (preço digitado à mão ou arredondamento): o novo preço volta a seguir o markup." />
            : <Alert type="warning" showIcon message="Nenhuma taxa de referência configurada (Vendas › Taxas de pagamento). A prévia só mostra preços que não batem com o markup." />
        )}
        <Table<ItemPrevia>
          size="small"
          rowKey="idItem"
          loading={carregando}
          dataSource={dados?.itens || []}
          pagination={{ pageSize: 10, hideOnSinglePage: true }}
          rowSelection={{ selectedRowKeys: selecionados, onChange: setSelecionados }}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Todos os preços já estão com a taxa embutida." /> }}
          expandable={{
            expandedRowRender: i => (
              <Table<FaixaPrevia> size="small" rowKey="idFaixa" pagination={false} dataSource={i.faixas} columns={[
                { title: 'Unidade', key: 'u', render: (_, f) => <span>{f.sigla} <Tag style={{ fontSize: 10 }}>{f.tipo === 'ATACADO' ? `atacado ≥ ${f.quantidadeMinima}` : 'varejo'}</Tag></span> },
                { title: 'Markup', dataIndex: 'markup', render: (v: number) => `${v}x` },
                { title: 'Atual', dataIndex: 'precoAtual', align: 'right' as const, render: (v: number) => brl(v) },
                { title: 'Novo', dataIndex: 'precoNovo', align: 'right' as const, render: (v: number) => <b>{brl(v)}</b> },
                { title: 'Variação', dataIndex: 'variacaoPct', align: 'right' as const, render: (v: number | null) => (v === null ? '—' : <Text type={v > 0 ? 'warning' : 'success'}>{v > 0 ? '+' : ''}{v.toFixed(2)}%</Text>) },
                { title: 'Margem líquida', key: 'm', align: 'right' as const, render: (_, f) => `${f.margemAtual ?? '—'}% → ${f.margemNova ?? '—'}%` },
              ]} />
            ),
          }}
          columns={[
            { title: 'SKU', dataIndex: 'sku', width: 150 },
            { title: 'Item', dataIndex: 'nome' },
            { title: 'Custo', dataIndex: 'custo', align: 'right' as const, width: 100, render: (v: number) => brl(v) },
            {
              title: 'Varejo', key: 'v', align: 'right' as const, width: 190,
              render: (_, i) => {
                const f = i.faixas.find(x => x.tipo === 'VAREJO') || i.faixas[0];
                return f ? <span>{brl(f.precoAtual)} → <b>{brl(f.precoNovo)}</b></span> : '—';
              },
            },
          ]}
        />
      </Space>
    </Modal>
  );
};

export default PrecosComTaxaModal;
