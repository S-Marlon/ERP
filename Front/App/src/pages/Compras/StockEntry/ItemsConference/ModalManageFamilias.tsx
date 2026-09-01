import React, { useMemo } from 'react';
import { Modal, Button, Typography, Card, List, Empty, Space, Tag, Popconfirm, message } from 'antd';
import { PlusOutlined, DeleteOutlined, EditOutlined, TableOutlined } from '@ant-design/icons';
import { Item, Familia } from '../types';

const { Title, Text, Paragraph } = Typography;

interface Props {
  isOpen: boolean;
  onClose: () => void;
  familias: Familia[];
  items: Item[];
  onCreateFamilia?: () => void;
  onEditFamilia: (familiaId: string) => void;
  onEditFamiliaItems: (familiaId: string) => void;
  onDeleteFamilia: (familiaId: string) => void;
}

export default function ManageFamiliasModal({
  isOpen,
  onClose,
 familias = [], // 👈 Adicione este valor padrão aqui
  items = [],    // 👈 E aproveite para fazer o mesmo com os items
  onCreateFamilia,
  onEditFamilia,
  onEditFamiliaItems,
  onDeleteFamilia,
}: Props) {
  // Indexação otimizada dos itens por família
  const itemsByFamiliaId = useMemo(() => {
    const map = new Map<string, Item[]>();

    for (const it of items) {
      if (!it.familiaId) continue;

      if (!map.has(it.familiaId)) map.set(it.familiaId, []);
      map.get(it.familiaId)!.push(it);
    }

    return map;
  }, [items]);

  const totalFamilias = familias.length;
  const totalFamiliaedItems = useMemo(() => items.filter(i => i.familiaId).length, [items]);

  if (!isOpen) return null;

  return (
    <Modal
      title={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingRight: 24 }}>
          <div>
            <Title level={4} style={{ margin: 0 }}>Gerenciamento de Famílias</Title>
            <Text type="secondary" style={{ fontSize: '13px' }}>
              {totalFamilias} {totalFamilias === 1 ? 'família' : 'famílias'} • {totalFamiliaedItems} {totalFamiliaedItems === 1 ? 'item vinculado' : 'itens vinculados'}
            </Text>
          </div>
        </div>
      }
      open={isOpen}
      onCancel={onClose}
      width={1000}
      footer={[
        <Button key="close" type="primary" onClick={onClose}>
          Fechar Gerenciador
        </Button>
      ]}
      extra={
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => {
            if (onCreateFamilia) {
              onCreateFamilia();
            } else {
              message.info('A integração de criação de famílias ainda está sendo conectada ao sistema pai.');
            }
          }}
        >
          Nova Família
        </Button>
      }
    >
      <div style={{ maxHeight: '65vh', overflowY: 'auto', paddingRight: 4, marginTop: 12 }}>
        {familias.length === 0 ? (
          <Empty 
            description="Nenhuma família criada ainda." 
            style={{ margin: '40px 0' }}
          >
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={onCreateFamilia}
            >
              Criar Primeira Família
            </Button>
          </Empty>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
            {familias.map(familia => {
              const familiaItems = itemsByFamiliaId.get(familia.id) || [];
              const qtdItens = familiaItems.length;
              
              const somaRecebida = familiaItems.reduce(
                (sum, it) => sum + (it.receivedQuantity || 0),
                0
              );

              const isEmpty = qtdItens === 0;
              
              // Busca o nome do atributo marcado como principal nesta família
              const attrPrincipal = familia.atributos?.find(a => a.principal)?.nome;
              const temEstrutura = familia.atributos && familia.atributos.length > 0;

              return (
                <Card
                  key={familia.id}
                  size="small"
                  style={{ 
                    borderColor: isEmpty ? '#d9d9d9' : '#91d5ff',
                    backgroundColor: isEmpty ? '#fafafa' : '#fff'
                  }}
                  title={
                    <span title={familia.nome} style={{ fontSize: '15px', fontWeight: 600 }}>
                      {familia.nome}
                    </span>
                  }
                  extra={
                    <div>
                      {attrPrincipal ? (
                        <Tag color="blue">🔑 {attrPrincipal}</Tag>
                      ) : (
                        <Tag color="warning">⚠️ Sem Estrutura</Tag>
                      )}
                    </div>
                  }
                  actions={[
                    <Button 
                      type="link" 
                      size="small" 
                      icon={<EditOutlined />} 
                      onClick={() => onEditFamilia(familia.id)}
                      title="Editar nome e características da família"
                    >
                      Estrutura
                    </Button>,
                    <Button 
                      type="link" 
                      size="small" 
                      icon={<TableOutlined />} 
                      onClick={() => onEditFamiliaItems(familia.id)}
                      disabled={!temEstrutura || isEmpty}
                      title={
                        !temEstrutura 
                          ? "Configure a estrutura primeiro para poder preencher os valores" 
                          : isEmpty 
                          ? "Não há itens vinculados a esta família para editar" 
                          : "Preencher valores das variações da grade"
                      }
                    >
                      Preencher Grade
                    </Button>,
                    <Popconfirm
                      title={`Remover "${familia.nome}"?`}
                      description={`Isso irá desvincular todos os ${qtdItens} itens associados.`}
                      onConfirm={() => onDeleteFamilia(familia.id)}
                      okText="Sim"
                      cancelText="Não"
                    >
                      <Button 
                        type="link" 
                        danger 
                        size="small" 
                        icon={<DeleteOutlined />}
                      >
                        Excluir
                      </Button>
                    </Popconfirm>
                  ]}
                >
                  <div style={{ marginBottom: 12 }}>
                    <Space size={16}>
                      <Text type="secondary">{qtdItens} {qtdItens === 1 ? 'item' : 'itens'}</Text>
                      <Text type="secondary">{somaRecebida} {somaRecebida === 1 ? 'peça' : 'peças'}</Text>
                    </Space>
                  </div>

                  <div style={{ minHeight: '90px' }}>
                    {familiaItems.length === 0 ? (
                      <Paragraph type="secondary" style={{ fontSize: '12px', fontStyle: 'italic', margin: 0 }}>
                        Sem itens vinculados
                      </Paragraph>
                    ) : (
                      <List
                        size="small"
                        dataSource={familiaItems.slice(0, 5)}
                        renderItem={it => (
                          <List.Item style={{ padding: '4px 0', border: 'none' }}>
                            <Text ellipsis style={{ maxWidth: '180px', fontSize: '12px' }} title={it.descricao}>
                              {it.descricao}
                            </Text>
                            <Tag style={{ margin: 0 }}>{it.receivedQuantity}</Tag>
                          </List.Item>
                        )}
                      />
                    )}

                    {familiaItems.length > 5 && (
                      <Text type="secondary" style={{ fontSize: '11px', display: 'block', marginTop: 4 }}>
                        +{familiaItems.length - 5} mais...
                      </Text>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </Modal>
  );
}