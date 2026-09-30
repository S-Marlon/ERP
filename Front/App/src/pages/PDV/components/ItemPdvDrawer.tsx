// Detalhe do item no PDV: unidades de venda (preço, estoque e faixas de cada uma), foto e inclusão na unidade escolhida.
import React, { useEffect, useState } from 'react';
import { Button, Descriptions, Drawer, Empty, Image, Space, Spin, Table, Tag } from 'antd';
import { EnvironmentOutlined, PlusOutlined } from '@ant-design/icons';
import { getPdvProductDetail } from '../services/api/products';
import { UnidadeCarrinho } from '../utils/precoCarrinho';

const money = (v: number) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const qtd = (v: number) => Number(v || 0).toLocaleString('pt-BR', { maximumFractionDigits: 4 });

interface Props {
  idItem: number | null;
  onClose: () => void;
  onAdicionar: (produto: any, idUnidade: number | null) => void;
}

export const ItemPdvDrawer: React.FC<Props> = ({ idItem, onClose, onAdicionar }) => {
  const [produto, setProduto] = useState<any>(null);
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    if (!idItem) { setProduto(null); return; }
    setCarregando(true);
    getPdvProductDetail(idItem)
      .then(p => setProduto(p))
      .finally(() => setCarregando(false));
  }, [idItem]);

  const unidades: UnidadeCarrinho[] = produto?.unidades || [];

  return (
    <Drawer open={!!idItem} onClose={onClose} width={620} title={produto ? produto.name : 'Item'}>
      {carregando && <Spin />}
      {!carregando && produto && (
        <Space direction="vertical" style={{ width: '100%' }} size={14}>
          <div style={{ display: 'flex', gap: 14 }}>
            {produto.pictureUrl
              ? <Image src={produto.pictureUrl} width={120} height={120} style={{ objectFit: 'contain', borderRadius: 8, border: '1px solid #e2e8f0' }} />
              : <div style={{ width: 120, height: 120, borderRadius: 8, background: '#f1f5f9', display: 'grid', placeItems: 'center', color: '#94a3b8' }}>sem foto</div>}
            <Descriptions size="small" column={1} style={{ flex: 1 }}>
              <Descriptions.Item label="SKU">{produto.sku}</Descriptions.Item>
              {produto.barcode && <Descriptions.Item label="GTIN">{produto.barcode}</Descriptions.Item>}
              <Descriptions.Item label="Categoria">{produto.category || '-'}</Descriptions.Item>
              {produto.brand && <Descriptions.Item label="Marca">{produto.brand}</Descriptions.Item>}
              <Descriptions.Item label="Estoque">
                {qtd(produto.estoqueBase)} {produto.unidadeBase}
                {produto.location && <Tag icon={<EnvironmentOutlined />} style={{ marginLeft: 8 }}>{produto.location}</Tag>}
              </Descriptions.Item>
              {produto.publicavel === false && (
                <Descriptions.Item label="Publicação">
                  <Tag color="gold">Não publicável</Tag>
                  <span style={{ fontSize: 11 }}>{(produto.motivosPublicacao || []).join('; ')}</span>
                </Descriptions.Item>
              )}
            </Descriptions>
          </div>

          <Table<UnidadeCarrinho>
            size="small"
            rowKey="idUnidade"
            pagination={false}
            dataSource={unidades}
            locale={{ emptyText: <Empty description="Sem unidade de venda configurada" /> }}
            columns={[
              {
                title: 'Unidade', key: 'u',
                render: (_, u) => (
                  <span>
                    <b>{u.sigla}</b>{u.nomeExibicao && u.nomeExibicao !== u.sigla ? ` · ${u.nomeExibicao}` : ''}
                    {u.fator !== 1 && <span style={{ color: '#64748b' }}> ({qtd(u.fator)} {produto.unidadeBase})</span>}
                    {u.padraoPdv && <Tag color="blue" style={{ marginLeft: 6 }}>padrão</Tag>}
                  </span>
                ),
              },
              { title: 'Preço', dataIndex: 'preco', width: 110, align: 'right' as const, render: (v: number) => <b>{money(v)}</b> },
              {
                title: 'Faixas', key: 'f',
                render: (_, u) => (u.faixas.length === 0 ? '-' : (
                  <Space size={[4, 4]} wrap>
                    {u.faixas.map(f => (
                      <Tag key={`${f.tipoFaixa}-${f.ordem}`} color={f.tipoFaixa === 'ATACADO' ? 'green' : 'default'}>
                        {qtd(f.quantidadeMinima)}{f.quantidadeMaxima !== null ? `–${qtd(f.quantidadeMaxima)}` : '+'}: {money(f.precoUnitario)}
                      </Tag>
                    ))}
                  </Space>
                )),
              },
              { title: 'Estoque', dataIndex: 'estoque', width: 90, align: 'right' as const, render: (v: number) => qtd(v) },
              {
                title: '', key: 'add', width: 60,
                render: (_, u) => <Button type="primary" size="small" icon={<PlusOutlined />} onClick={() => onAdicionar(produto, u.idUnidade)} />,
              },
            ]}
          />
        </Space>
      )}
    </Drawer>
  );
};
