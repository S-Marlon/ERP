import React from 'react';
import { Table } from 'antd';

interface SkuRow {
  key?: string;
  id_item?: number;
  sku?: string;
  variacao?: string;
  estoque?: number;
  preco_venda?: number;
  marca?: string;
  status?: string;
}

interface SkuSubTableProps {
  parentItem: {
    skus?: SkuRow[];
  };
}

export const SkuSubTable: React.FC<SkuSubTableProps> = ({ parentItem }) => {
  const skus: SkuRow[] = parentItem?.skus ?? [];

  const skuColumns = [
    { title: 'SKU', dataIndex: 'sku', key: 'sku', render: (value: string) => value || '-' },
    { title: 'Variação', dataIndex: 'variacao', key: 'variacao', render: (value: string) => value || 'Principal' },
    { title: 'Marca', dataIndex: 'marca', key: 'marca', render: (value: string) => value || 'Própria' },
    { title: 'Preço', dataIndex: 'preco_venda', key: 'preco_venda', render: (value: number) => `R$ ${(Number(value) || 0).toFixed(2)}` },
    { title: 'Estoque', dataIndex: 'estoque', key: 'estoque', render: (value: number) => `${Number(value) || 0} UN` },
  ];

  return (
    <Table
      columns={skuColumns}
      dataSource={skus}
      rowKey={(record: SkuRow) => String(record.key ?? record.id_item ?? record.sku ?? Math.random())}
      pagination={false}
      size="small"
    />
  );
};