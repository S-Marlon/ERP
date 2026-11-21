// Gaveta de uma categoria do "Onde focar": os produtos dela com as curvas, margem, estoque, cobertura, preço e desconto
// máximo, e as decisões por item: ajustar o preço (tela de preço do item), pedir conferência no inventário, marcar para a
// promoção (texto para WhatsApp) e exportar a planilha.
import React, { useMemo, useState } from 'react';
import { Button, Drawer, Empty, Flex, Input, Modal, Segmented, Space, Table, Tag, Tooltip, Typography, message } from 'antd';
import { CopyOutlined, DollarOutlined, DownloadOutlined, FileSearchOutlined, WhatsAppOutlined } from '@ant-design/icons';
import ProductCommercialSalesConfig from '../../catalogo/precos/ProductCommercialSalesConfig';
import { baixarArquivo } from '../../../shared/core/impressao/saida';
import { inventarioApi } from '../inventario/inventarioApi';
import { ClasseExibida, classeExibida } from './curvaAbc';
import { AJUDA_CLASSE, AJUDA_XYZ, COR_CLASSE, csvCurva, ItemCurvaTela } from './curvaAbcApi';
import { CategoriaFoco, descontoMaximo, ItemPropaganda, QUADRANTES, textoPromocao } from './ondeFocarApi';

const { Text } = Typography;
const brl = (v: number) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const brl0 = (v: number) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const pct = (v: number | null) => (v === null ? '—' : `${Math.round(v * 100)}%`);
const qtd = (v: number) => Number(v || 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 });
type Item = ItemCurvaTela & { precoVenda?: number };
type Filtro = 'TODOS' | 'PARADOS' | 'VENDEM' | 'RECOMENDACAO';

const Selo: React.FC<{ c: ClasseExibida }> = ({ c }) => (
  <Tooltip title={AJUDA_CLASSE[c]}><Tag color={COR_CLASSE[c]} style={{ margin: 0, minWidth: 20, textAlign: 'center', fontSize: 10, fontWeight: 600 }}>{c}</Tag></Tooltip>
);

export const CategoriaFocoDrawer: React.FC<{
  categoria: CategoriaFoco | null; itens: Item[] | null; margemMinima: number; onFechar: () => void; onPrecoMudou: () => void;
}> = ({ categoria, itens, margemMinima, onFechar, onPrecoMudou }) => {
  const [filtro, setFiltro] = useState<Filtro>('TODOS');
  const [busca, setBusca] = useState('');
  const [selecionados, setSelecionados] = useState<number[]>([]);
  const [preco, setPreco] = useState<Item | null>(null);
  const [texto, setTexto] = useState<string | null>(null);
  const [conferir, setConferir] = useState<Item | null>(null);
  const [motivo, setMotivo] = useState('');

  const daCategoria = useMemo(() => (itens || []).filter(i => categoria && (i.categoriaTopoNome || 'Sem categoria') === categoria.categoria), [itens, categoria]);
  const visiveis = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return daCategoria
      .filter(i => filtro === 'TODOS' || (filtro === 'PARADOS' ? i.situacao === 'PARADO' : filtro === 'VENDEM' ? i.situacao === 'NORMAL' : !!i.recomendacao))
      .filter(i => !t || `${i.sku} ${i.nome}`.toLowerCase().includes(t))
      .sort((a, b) => b.receita - a.receita || b.valorEstoque - a.valorEstoque);
  }, [daCategoria, filtro, busca]);

  if (!categoria) return null;
  const q = QUADRANTES[categoria.quadrante];
  const margemTab = (i: Item) => (i.precoVenda && i.precoVenda > 0 ? (i.precoVenda - i.custoUnitario) / i.precoVenda : null);
  const promo = (i: Item): ItemPropaganda => {
    const max = descontoMaximo(i.precoVenda || 0, i.custoUnitario, margemMinima);
    const sug = Math.floor(Math.min(max, 0.15) * 20) / 20;
    return { idItem: i.idItem, sku: i.sku, nome: i.nome, unidade: i.unidade, categoria: i.categoriaTopoNome, estoque: i.estoque, valorEstoque: i.valorEstoque,
      preco: i.precoVenda || 0, margemTabela: margemTab(i) || 0, descontoMaximo: max, descontoSugerido: sug, precoPromocao: Math.round((i.precoVenda || 0) * (1 - sug) * 100) / 100 };
  };
  const contagem = (f: Filtro) => daCategoria.filter(i => f === 'TODOS' || (f === 'PARADOS' ? i.situacao === 'PARADO' : f === 'VENDEM' ? i.situacao === 'NORMAL' : !!i.recomendacao)).length;
  const escolhidos = daCategoria.filter(i => selecionados.includes(i.idItem) && (i.precoVenda || 0) > 0);

  return (
    <Drawer open={!!categoria} onClose={() => { setSelecionados([]); setFiltro('TODOS'); setBusca(''); onFechar(); }} width="min(1250px, 100vw)" destroyOnHidden
      loading={!itens}
      title={<Space wrap><Text strong>{categoria.categoria}</Text><Tag color={q.cor}>{q.titulo}</Tag><Text type="secondary" style={{ fontSize: 12, fontWeight: 400 }}>{categoria.motivo}</Text></Space>}
      extra={<Space>
        <Button icon={<WhatsAppOutlined style={{ color: '#25d366' }} />} disabled={!escolhidos.length} onClick={() => setTexto(textoPromocao(escolhidos.map(promo)))}>Promoção ({escolhidos.length})</Button>
        <Button icon={<DownloadOutlined />} onClick={() => baixarArquivo(csvCurva(visiveis, i => classeExibida(i, 'VENDA')), `onde-focar-${categoria.categoria.toLowerCase().replace(/[^a-z0-9]+/gi, '-')}.csv`, 'text/csv;charset=utf-8')}>Planilha</Button>
      </Space>}>
      <Space direction="vertical" size={10} style={{ width: '100%' }}>
        <Flex gap={16} wrap>
          <Text>Faturamento <b>{brl0(categoria.receita)}</b> ({pct(categoria.participacao)})</Text>
          <Text>Margem <b>{pct(categoria.margem ?? categoria.margemTabela)}</b>{categoria.margem === null ? ' (de tabela)' : ''}</Text>
          <Text>Estoque <b>{brl0(categoria.estoque)}</b></Text>
          <Text>Parado <b style={{ color: '#cf1322' }}>{brl0(categoria.parado)}</b></Text>
          <Text>{categoria.vendidos} de {categoria.itens} itens venderam</Text>
        </Flex>
        <Text type="secondary" style={{ fontSize: 12 }}>O que fazer: {q.acao}.</Text>
        <Flex gap={8} wrap align="center">
          <Segmented value={filtro} onChange={v => setFiltro(v as Filtro)} options={[
            { value: 'TODOS', label: `Todos (${contagem('TODOS')})` }, { value: 'PARADOS', label: `Parados (${contagem('PARADOS')})` },
            { value: 'VENDEM', label: `Vendem (${contagem('VENDEM')})` }, { value: 'RECOMENDACAO', label: `Com recomendação (${contagem('RECOMENDACAO')})` },
          ]} />
          <Input.Search allowClear placeholder="Código ou nome" style={{ width: 220 }} value={busca} onChange={e => setBusca(e.target.value)} />
          <Text type="secondary" style={{ fontSize: 12 }}>Marque itens para montar o texto da promoção (preço com desconto que respeita a margem mínima de {pct(margemMinima)}).</Text>
        </Flex>
        <Table<Item> size="small" rowKey="idItem" dataSource={visiveis} pagination={{ pageSize: 40, hideOnSinglePage: true, showSizeChanger: false }} scroll={{ x: 1150 }}
          rowSelection={{ selectedRowKeys: selecionados, onChange: k => setSelecionados(k as number[]) }}
          locale={{ emptyText: <Empty description="Nenhum item neste filtro." /> }}
          columns={[
            {
              title: 'Item', key: 'i', fixed: 'left', width: 290, render: (_, i) => <>
                <Text strong style={{ fontSize: 13 }}>{i.nome}</Text>
                <div><Text type="secondary" style={{ fontSize: 11 }}>{i.sku}{i.categoria && i.categoria !== i.categoriaTopoNome ? ` · ${i.categoria}` : ''}</Text></div>
              </>,
            },
            {
              title: <Tooltip title="Venda · lucro · estoque · frequência">Curvas</Tooltip>, key: 'c', width: 120, render: (_, i) => <Space size={2}>
                <Selo c={classeExibida(i, 'VENDA')} /><Selo c={classeExibida(i, 'LUCRO')} /><Selo c={classeExibida(i, 'ESTOQUE')} />
                {i.xyz && <Tooltip title={AJUDA_XYZ[i.xyz]}><Tag style={{ margin: 0, fontSize: 10 }}>{i.xyz}</Tag></Tooltip>}
              </Space>,
            },
            { title: 'Faturou', dataIndex: 'receita', width: 100, align: 'right' as const, sorter: (a, b) => a.receita - b.receita, render: (v: number, i) => (v ? <>{brl(v)}<div><Text type="secondary" style={{ fontSize: 11 }}>{i.vendas}× · {pct(i.margem)}</Text></div></> : '—') },
            {
              title: 'Estoque', key: 'e', width: 115, align: 'right' as const, sorter: (a, b) => a.valorEstoque - b.valorEstoque,
              render: (_, i) => <>{qtd(i.estoque)} {i.unidade}<div><Text type={i.situacao === 'PARADO' ? 'danger' : 'secondary'} style={{ fontSize: 11 }}>{brl0(i.valorEstoque)}{i.situacao === 'PARADO' ? ' parado' : ''}</Text></div></>,
            },
            { title: 'Dura', dataIndex: 'coberturaDias', width: 75, align: 'right' as const, render: (v: number | null) => (v === null ? '—' : <Text type={v < 15 ? 'danger' : undefined}>{v.toLocaleString('pt-BR')} d</Text>) },
            {
              title: 'Preço', key: 'p', width: 110, align: 'right' as const, render: (_, i) => (i.precoVenda ? <>{brl(i.precoVenda)}<div><Text type="secondary" style={{ fontSize: 11 }}>custo {brl(i.custoUnitario)}</Text></div></> : '—'),
            },
            {
              title: <Tooltip title="Margem de tabela · desconto máximo que respeita a margem mínima">Margem · desc.</Tooltip>, key: 'm', width: 105, align: 'right' as const,
              sorter: (a, b) => (margemTab(a) ?? -1) - (margemTab(b) ?? -1),
              render: (_, i) => { const m = margemTab(i); return m === null ? '—' : <>{pct(m)}<div><Tag color="blue" style={{ margin: 0, fontSize: 10 }}>até −{pct(descontoMaximo(i.precoVenda || 0, i.custoUnitario, margemMinima))}</Tag></div></>; },
            },
            { title: 'O que fazer', dataIndex: 'recomendacao', width: 220, render: (v: string | null) => (v ? <Text style={{ fontSize: 12 }}>{v}</Text> : '') },
            {
              title: '', key: 'a', width: 90, fixed: 'right', render: (_, i) => <Space size={2}>
                <Tooltip title="Ajustar preço"><Button size="small" icon={<DollarOutlined />} onClick={() => setPreco(i)} /></Tooltip>
                <Tooltip title="Pedir conferência no inventário"><Button size="small" icon={<FileSearchOutlined />} onClick={() => { setMotivo(''); setConferir(i); }} /></Tooltip>
              </Space>,
            },
          ]} />
      </Space>

      <Drawer open={!!preco} onClose={() => { setPreco(null); onPrecoMudou(); }} width="min(1100px, 100vw)" destroyOnHidden title={preco ? `Preço · ${preco.nome}` : ''}>
        {preco && <ProductCommercialSalesConfig idItem={preco.idItem} />}
      </Drawer>

      <Modal open={!!conferir} title={conferir ? `Pedir conferência · ${conferir.nome}` : ''} okText="Pedir" cancelText="Voltar" okButtonProps={{ disabled: !motivo.trim() }}
        onCancel={() => setConferir(null)} destroyOnHidden
        onOk={() => conferir && inventarioApi.pedirConferencia(conferir.idItem, motivo.trim())
          .then(() => { message.success('Conferência pedida: entra na próxima lista do inventário.'); setConferir(null); })
          .catch(e => message.error(e.message))}>
        <Input placeholder="O que conferir (ex.: parado há meses, confirmar se existe mesmo)" maxLength={150} value={motivo} onChange={e => setMotivo(e.target.value)} />
      </Modal>

      <Modal open={texto !== null} title="Texto da promoção" onCancel={() => setTexto(null)} footer={<Space>
        <Button icon={<CopyOutlined />} onClick={() => navigator.clipboard.writeText(texto || '').then(() => message.success('Texto copiado.')).catch(() => message.error('O navegador não deixou copiar.'))}>Copiar</Button>
        <Button type="primary" icon={<WhatsAppOutlined />} onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(texto || '')}`, '_blank')}>Abrir no WhatsApp</Button>
      </Space>}>
        <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: 13, background: '#f6f6f6', padding: 10, borderRadius: 6 }}>{texto}</pre>
        <Text type="secondary" style={{ fontSize: 12 }}>Os preços de promoção não mudam o cadastro: lance o desconto no PDV ou ajuste o preço pelo botão $.</Text>
      </Modal>
    </Drawer>
  );
};
