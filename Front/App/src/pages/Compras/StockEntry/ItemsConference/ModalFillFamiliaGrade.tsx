// ModalFillFamiliaGrade.

import React, { useState, useEffect } from 'react';
import { Modal, Button, Typography, Table, InputNumber, Space, Tag, message, Card } from 'antd';
import { TableOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { Item, Familia } from '../types';

const { Title, Text, Paragraph } = Typography;

interface Props {
  isOpen: boolean;
  onClose: () => void;
  familiaId: string | null;
  familias: Familia[];
  items: Item[]; // Itens vinculados a esta nota/família
  onSaveGrade: (familiaId: string, atualizacoesItens: Item[]) => void; // Salva o preenchimento no componente pai
}

export default function ModalFillFamiliaGrade({
  isOpen,
  onClose,
  familiaId,
  familias = [],
  items = [],
  onSaveGrade,
}: Props) {
  const [familiaAtual, setFamiliaAtual] = useState<Familia | null>(null);
  const [itensDaFamilia, setItensDaFamilia] = useState<Item[]>([]);
  // Estado local para controlar as quantidades preenchidas na matriz da grade: { [itemId]: quantidade }
  const [gradeValues, setGradeValues] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);

  // Carrega os dados da família e os itens correspondentes quando o modal abre
  useEffect(() => {
    if (isOpen && familiaId) {
      const fam = familias.find(f => f.id === familiaId) || null;
      setFamiliaAtual(fam);

      // Filtra apenas os itens desta nota que pertencem a esta família
      const filteredItems = items.filter(i => i.familiaId === familiaId);
      setItensDaFamilia(filteredItems);

      // Inicializa o mapa de valores com o que já estiver preenchido nos itens
      const initialValues: Record<string, number> = {};
      filteredItems.forEach(item => {
        initialValues[item.id] = item.receivedQuantity || 0;
      });
      setGradeValues(initialValues);
    }
  }, [isOpen, familiaId, familias, items]);

  if (!isOpen || !familiaId || !familiaAtual) return null;

  // Atributos que compõem a grade estrutural desta família
  const atributosEstrutura = familiaAtual.atributos || [];
  const atributoPrincipal = atributosEstrutura.find(a => a.principal)?.nome || 'Variação';

  // Atualiza o valor de uma célula/item específico na grade
  const handleQuantityChange = (itemId: string, value: number | null) => {
    setGradeValues(prev => ({
      ...prev,
      [itemId]: value || 0
    }));
  };

  // Salvar o preenchimento da grade
  const handleSave = () => {
    try {
      setLoading(true);

      // Mapeia os itens atualizados com a nova quantidade informada na grade
      const itensAtualizados = itensDaFamilia.map(item => ({
        ...item,
        receivedQuantity: gradeValues[item.id] || 0
      }));

      onSaveGrade(familiaId, itensAtualizados);
      message.success('Grade da família preenchida com sucesso!');
      onClose();
    } catch (error) {
      message.error('Erro ao salvar os valores da grade.');
    } finally {
      setLoading(false);
    }
  };

  // Montagem das colunas dinâmicas da Tabela Ant Design com base nos atributos da família
  const columns = [
    {
      title: atributoPrincipal,
      dataIndex: 'descricao', // Ou o campo específico do atributo secundário/principal do item
      key: 'descricao',
      render: (text: string, record: Item) => (
        <Space direction="vertical" size={0}>
          <Text strong>{record.descricao}</Text>
          <Text type="secondary" style={{ fontSize: '11px' }}>SKU: {record.sku || 'N/D'}</Text>
        </Space>
      ),
    },
    // Aqui você pode expandir colunas dinâmicas caso sua grade cruze Linha x Coluna (ex: Grade Cor x Tamanho)
    {
      title: 'Quantidade Recebida',
      key: 'receivedQuantity',
      width: 180,
      align: 'center' as const,
      render: (_: any, record: Item) => (
        <InputNumber
          min={0}
          value={gradeValues[record.id] ?? 0}
          onChange={val => handleQuantityChange(record.id, val)}
          style={{ width: '100px' }}
        />
      ),
    },
  ];

  const totalPecasPreenchidas = Object.values(gradeValues).reduce((acc, curr) => acc + curr, 0);

  return (
    <Modal
      title={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingRight: 24 }}>
          <div>
            <Title level={4} style={{ margin: 0 }}>
              Preencher Grade: {familiaAtual.nome}
            </Title>
            <Text type="secondary" style={{ fontSize: '12px' }}>
              Atributo base: <Tag color="blue">{atributoPrincipal}</Tag> • {itensDaFamilia.length} variações vinculadas
            </Text>
          </div>
        </div>
      }
      open={isOpen}
      onCancel={onClose}
      width={800}
      footer={[
        <Button key="cancel" onClick={onClose}>
          Cancelar
        </Button>,
        <Button 
          key="submit" 
          type="primary" 
          icon={<CheckCircleOutlined />} 
          loading={loading} 
          onClick={handleSave}
        >
          Confirmar Grade ({totalPecasPreenchidas} peças)
        </Button>
      ]}
    >
      <div style={{ marginTop: 16 }}>
        <Card size="small" style={{ marginBottom: 16, backgroundColor: '#f6ffed', borderColor: '#b7eb8f' }}>
          <Paragraph style={{ margin: 0, fontSize: '13px' }}>
            Informe abaixo as quantidades conferidas para cada variação desta família. Os totais serão refletidos diretamente no resumo da nota.
          </Paragraph>
        </Card>

        <Table
          dataSource={itensDaFamilia}
          columns={columns}
          rowKey="id"
          size="middle"
          pagination={false}
          scroll={{ y: 350 }}
          locale={{ emptyText: 'Nenhum item vinculado a esta família para preenchimento.' }}
        />
      </div>
    </Modal>
  );
}