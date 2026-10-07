// Lista de produtos do PDV: tabela (padrão) ou cards, com paginação e ordenação controladas pelo PDV.
import React, { useRef } from 'react';
import { Button, Card, Empty, Flex, Pagination, Segmented, Select, Space, Spin, Table, Tag, Tooltip, Typography, theme } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { AppstoreOutlined, EnvironmentOutlined, InfoCircleOutlined, PlusOutlined, ReloadOutlined, UnorderedListOutlined } from '@ant-design/icons';
import ImageDisplay from '../../../../shared/components/ui/ImageGallery/ImageDysplay';
import { Product } from '../types/product.types';

export type ModoLista = 'lista' | 'cards';

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const qtd = (v: number) => Number(v || 0).toLocaleString('pt-BR', { maximumFractionDigits: 3 });

export const ORDENACOES = [
  { value: 'name_asc', label: 'Nome A → Z' },
  { value: 'name_desc', label: 'Nome Z → A' },
  { value: 'price_asc', label: 'Menor preço' },
  { value: 'price_desc', label: 'Maior preço' },
  { value: 'stock_asc', label: 'Menor estoque' },
  { value: 'stock_desc', label: 'Maior estoque' },
];

const destacar = (texto: string, termo: string) => {
  if (!termo.trim()) return texto;
  const escapado = termo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return String(texto).split(new RegExp(`(${escapado})`, 'gi')).map((parte, i) =>
    parte.toLowerCase() === termo.toLowerCase()
      ? <mark key={i} style={{ background: '#fde68a', padding: 0 }}>{parte}</mark>
      : parte
  );
};

interface Props {
  produtos: Product[];
  total: number;
  carregando: boolean;
  busca: string;
  pagina: number;
  porPagina: number;
  ordem: string;
  modo: ModoLista;
  /** Tela estreita: some com a foto e junta estoque ao preço */
  compacto?: boolean;
  onModo: (m: ModoLista) => void;
  onPagina: (pagina: number, porPagina: number) => void;
  onOrdem: (ordem: string) => void;
  onAtualizar: () => void;
  onIncluir: (p: Product) => void;
  onDetalhe: (id: number) => void;
}

export const ListaProdutosPdv: React.FC<Props> = ({
  produtos, total, carregando, busca, pagina, porPagina, ordem, modo, compacto,
  onModo, onPagina, onOrdem, onAtualizar, onIncluir, onDetalhe,
}) => {
  const { token } = theme.useToken();
  const rolagem = useRef<HTMLDivElement>(null);
  const un = (p: Product) => p.unitOfMeasure || 'un';

  const preco = (p: Product) => (
    <Flex vertical align="flex-end" gap={2}>
      <span style={{ whiteSpace: 'nowrap' }}>
        <Typography.Text strong type={Number(p.salePrice) > 0 ? undefined : 'danger'}>{money.format(Number(p.salePrice) || 0)}</Typography.Text>
        <Typography.Text type="secondary" style={{ fontSize: 11 }}> /{un(p)}</Typography.Text>
      </span>
      {p.atacado && (
        <Tooltip title={`A partir de ${qtd(p.atacado.quantidadeMinima)} ${un(p)}, cada ${un(p)} sai por ${money.format(p.atacado.preco)} (economia de ${Math.round((1 - p.atacado.preco / (Number(p.salePrice) || 1)) * 100)}%)`}>
          <Tag color="green" style={{ margin: 0, fontSize: 11 }}>Atacado {qtd(p.atacado.quantidadeMinima)}+: {money.format(p.atacado.preco)}</Tag>
        </Tooltip>
      )}
    </Flex>
  );

  const estoque = (p: Product) => (
    <Flex vertical align="flex-end" gap={2}>
      <Typography.Text strong type={Number(p.currentStock) > 0 ? undefined : 'danger'} style={{ whiteSpace: 'nowrap' }}>
        {qtd(p.currentStock)} <Typography.Text type="secondary" style={{ fontWeight: 400 }}>{p.unitOfMeasure}</Typography.Text>
      </Typography.Text>
      {p.location && <Tag icon={<EnvironmentOutlined />} style={{ margin: 0, fontSize: 10 }}>{p.location}</Tag>}
    </Flex>
  );

  const acoes = (p: Product) => (
    <Space size={4}>
      <Tooltip title="Detalhes, unidades e faixas">
        <Button size="small" icon={<InfoCircleOutlined />} onClick={() => onDetalhe(p.id)} />
      </Tooltip>
      <Tooltip title="Adicionar ao carrinho">
        <Button size="small" type="primary" icon={<PlusOutlined />} onClick={() => onIncluir(p)} />
      </Tooltip>
    </Space>
  );

  const nome = (p: Product) => (
    <div style={{ minWidth: 0 }}>
      <Typography.Text strong style={{ display: 'block', lineHeight: 1.3 }}>{destacar(p.name, busca)}</Typography.Text>
      <Typography.Text type="secondary" style={{ fontSize: 11 }}>
        {destacar(String(p.sku || ''), busca)}{p.category ? ` · ${p.category}` : ''}{p.brand ? ` · ${p.brand}` : ''}
      </Typography.Text>
      {p.publicavel === false && (
        <Tooltip title={(p.motivosPublicacao || []).join(' · ')}>
          <Tag color="gold" style={{ fontSize: 10, marginLeft: 6 }}>Não publicável</Tag>
        </Tooltip>
      )}
    </div>
  );

  const colunas: ColumnsType<Product> = [
    ...(compacto ? [] : [{ key: 'foto', width: 52, render: (_: unknown, p: Product) => <ImageDisplay src={p.pictureUrl} size="38px" rounded="6px" /> }]),
    { title: 'Item', key: 'nome', render: (_, p) => nome(p) },
    {
      title: compacto ? 'Preço · estoque' : 'Preço', key: 'preco', align: 'right', width: 150,
      render: (_, p) => compacto ? <Flex vertical align="flex-end" gap={2}>{preco(p)}{estoque(p)}</Flex> : preco(p),
    },
    ...(compacto ? [] : [{ title: 'Estoque', key: 'estoque', align: 'right' as const, width: 110, render: (_: unknown, p: Product) => estoque(p) }]),
    { key: 'acoes', align: 'center', width: 76, render: (_, p) => acoes(p) },
  ];

  return (
    <Flex vertical style={{ flex: 1, minHeight: 0, background: token.colorBgContainer, borderRadius: token.borderRadiusLG, border: `1px solid ${token.colorBorderSecondary}` }}>
      <Flex align="center" justify="space-between" gap={8} wrap style={{ padding: '6px 10px', borderBottom: `1px solid ${token.colorBorderSecondary}` }}>
        <Space size={6}>
          <Tooltip title="Atualizar"><Button size="small" icon={<ReloadOutlined />} onClick={onAtualizar} loading={carregando} /></Tooltip>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>{total} item(ns)</Typography.Text>
        </Space>
        <Space size={6}>
          <Select size="small" value={ordem || 'name_asc'} onChange={onOrdem} options={ORDENACOES} style={{ width: 140 }} popupMatchSelectWidth={false} />
          <Segmented size="small" value={modo} onChange={v => onModo(v as ModoLista)}
            options={[{ value: 'lista', icon: <UnorderedListOutlined />, title: 'Lista' }, { value: 'cards', icon: <AppstoreOutlined />, title: 'Cards' }]} />
        </Space>
      </Flex>

      <div ref={rolagem} style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        {modo === 'lista' ? (
          <Table<Product>
            size="small"
            rowKey="id"
            columns={colunas}
            dataSource={produtos}
            loading={carregando}
            pagination={false}
            sticky={{ getContainer: () => rolagem.current || window }}
            onRow={p => ({ onDoubleClick: () => onIncluir(p) })}
            locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Nenhum item encontrado" /> }}
          />
        ) : (
          <Spin spinning={carregando}>
            {produtos.length === 0 && !carregando
              ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Nenhum item encontrado" style={{ padding: 32 }} />
              : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 8, padding: 8 }}>
                  {produtos.map(p => (
                    <Card key={p.id} size="small" hoverable onDoubleClick={() => onIncluir(p)} styles={{ body: { padding: 8, height: '100%' } }}>
                      <Flex vertical gap={6} style={{ height: '100%' }}>
                        <Flex justify="center"><ImageDisplay src={p.pictureUrl} size="64px" rounded="6px" /></Flex>
                        <Typography.Paragraph strong ellipsis={{ rows: 2, tooltip: p.name }} style={{ margin: 0, fontSize: 13 }}>{destacar(p.name, busca)}</Typography.Paragraph>
                        <Typography.Text type="secondary" style={{ fontSize: 11 }} ellipsis>{p.sku}</Typography.Text>
                        <Flex justify="space-between" align="flex-end" style={{ marginTop: 'auto' }}>
                          {estoque(p)}
                          {preco(p)}
                        </Flex>
                        {acoes(p)}
                      </Flex>
                    </Card>
                  ))}
                </div>
              )}
          </Spin>
        )}
      </div>

      <Flex justify="flex-end" style={{ padding: '6px 10px', borderTop: `1px solid ${token.colorBorderSecondary}` }}>
        <Pagination
          size="small"
          current={pagina}
          pageSize={porPagina}
          total={total}
          showSizeChanger
          pageSizeOptions={[10, 20, 50, 100]}
          onChange={onPagina}
          showLessItems
        />
      </Flex>
    </Flex>
  );
};
