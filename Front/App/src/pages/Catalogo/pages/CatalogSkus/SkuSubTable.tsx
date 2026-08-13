import React, { useEffect, useState } from 'react';
import { Table, message } from 'antd';

interface SkuSubTableProps {
  parentItem: any; // ou a tipagem correta do produto pai
}

export const SkuSubTable: React.FC<SkuSubTableProps> = ({ parentItem }) => {
  const [skus, setSkus] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Se os SKUs já vierem no objeto pai, use-os diretamente:
    if (parentItem.skus) {
      setSkus(parentItem.skus);
      return;
    }

    // Se precisar buscar da API sob demanda:
    const fetchSkus = async () => {
      setLoading(true);
      try {
        // const response = await api.get(`/produtos/${parentItem.id_item}/skus`);
        // setSkus(response.data);
      } catch (error) {
        message.error('Erro ao carregar os SKUs');
      } finally {
        setLoading(false);
      }
    };

    fetchSkus();
  }, [parentItem]);

  const skuColumns = [
    { title: 'SKU', dataIndex: 'sku', key: 'sku' },
    { title: 'Variação', dataIndex: 'variation', key: 'variation' },
    { title: 'Preçoas', dataIndex: 'preco', key: 'preco' },
    { title: 'Estoque', dataIndex: 'stock', key: 'stock' },
    { title: 'Ações', dataIndex: 'actions', key: 'actions' },
  ];

  return (
    <Table
      columns={skuColumns}
      dataSource={skus}
      loading={loading}
      rowKey={(record) => String(record.id_sku || record.sku)}
      pagination={false}
      size="small"
    />
  );
};