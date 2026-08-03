import React, { useState, useMemo } from 'react';
import { 
  Layout, 
  Input, 
  List, 
  Avatar, 
  Tag, 
  Button, 
  Typography, 
  Card, 
  Row, 
  Col, 
  Descriptions, 
  Table, 
  Modal, 
  Form, 
  Select, 
  InputNumber,
  message,
  Divider,
  Empty,
  Space,
  Upload,
  Dropdown
} from 'antd';
import { 
  SearchOutlined, 
  PlusOutlined, 
  ReloadOutlined, 
  ShoppingCartOutlined, 
  DownloadOutlined, 
  UploadOutlined, 
  EditOutlined, 
  DeleteOutlined
} from '@ant-design/icons';

const { Sider, Content } = Layout;
const { Title, Text } = Typography;

interface ItemPedido {
  key: string;
  descricao: string;
  quantidade: number;
  valor_unitario: number;
}

interface PedidoAggregate {
  id_pedido: number;
  cliente_nome: string;
  documento_cliente: string;
  status_pagamento: 'PAGO' | 'PARCIAL' | 'PENDENTE';
  data_pedido: string;
  itens: ItemPedido[];
  observacoes?: string;
}

export default function Pedidos() {
  const [form] = Form.useForm();
  
  const [loading, setLoading] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [pedidoEmEdicao, setPedidoEmEdicao] = useState<PedidoAggregate | null>(null);

  // Lista inicial vazia (sem exemplos)
  const [pedidos, setPedidos] = useState<PedidoAggregate[]>([]);
  const [pedidoAtivo, setPedidoAtivo] = useState<PedidoAggregate | null>(null);

  // Filtragem na barra lateral
  const pedidosFiltrados = useMemo(() => {
    const termo = searchTerm.toLowerCase();
    return pedidos.filter(p => 
      p.cliente_nome.toLowerCase().includes(termo) || 
      String(p.id_pedido).includes(termo) ||
      p.documento_cliente.includes(termo)
    );
  }, [pedidos, searchTerm]);

  const handleReload = () => {
    setLoading(true);
    setTimeout(() => { setLoading(false); message.info('Lista de pedidos atualizada.'); }, 400);
  };

  // Abrir modal para Criar Novo
  const handleAbrirCriacao = () => {
    setPedidoEmEdicao(null);
    form.resetFields();
    form.setFieldsValue({
      status_pagamento: 'PENDENTE',
      data_pedido: new Date().toLocaleDateString('pt-BR'),
      itens: [{ descricao: '', quantidade: 1, valor_unitario: 0 }]
    });
    setIsModalOpen(true);
  };

  // Abrir modal para Editar
  const handleAbrirEdicao = (pedido: PedidoAggregate) => {
    setPedidoEmEdicao(pedido);
    form.setFieldsValue(pedido);
    setIsModalOpen(true);
  };

  // Salvar (Criar ou Atualizar)
  const handleSalvarPedido = (values: any) => {
    const itensFormatados = (values.itens || []).map((item: any, idx: number) => ({
      key: String(idx + 1),
      descricao: item.descricao || 'Item sem descrição',
      quantidade: Number(item.quantidade) || 1,
      valor_unitario: Number(item.valor_unitario) || 0
    }));

    if (pedidoEmEdicao) {
      const atualizados = pedidos.map(p => {
        if (p.id_pedido === pedidoEmEdicao.id_pedido) {
          return {
            ...p,
            ...values,
            itens: itensFormatados
          };
        }
        return p;
      });
      setPedidos(atualizados);
      setPedidoAtivo(atualizados.find(p => p.id_pedido === pedidoEmEdicao.id_pedido) || null);
      message.success('Pedido atualizado com sucesso!');
    } else {
      const novoId = Math.floor(Math.random() * 9000) + 1000;
      const novoPedido: PedidoAggregate = {
        id_pedido: novoId,
        cliente_nome: values.cliente_nome,
        documento_cliente: values.documento_cliente || '000.000.000-00',
        status_pagamento: values.status_pagamento,
        data_pedido: values.data_pedido || new Date().toLocaleDateString('pt-BR'),
        observacoes: values.observacoes,
        itens: itensFormatados
      };
      setPedidos([novoPedido, ...pedidos]);
      setPedidoAtivo(novoPedido);
      message.success('Novo pedido criado com sucesso!');
    }

    setIsModalOpen(false);
    form.resetFields();
  };

  // Excluir Pedido
  const handleExcluirPedido = (id: number) => {
    Modal.confirm({
      title: 'Deseja realmente excluir este pedido?',
      content: 'Esta ação removerá o pedido permanentemente da lista local.',
      okText: 'Sim, excluir',
      okType: 'danger',
      cancelText: 'Cancelar',
      onOk() {
        const filtrados = pedidos.filter(p => p.id_pedido !== id);
        setPedidos(filtrados);
        setPedidoAtivo(filtrados.length > 0 ? filtrados[0] : null);
        message.success('Pedido excluído.');
      }
    });
  };

  const calcularTotal = (itens: ItemPedido[]) => {
    const total = itens.reduce((acc, item) => acc + (item.quantidade * item.valor_unitario), 0);
    return total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  // ================= EXPORTAÇÃO E IMPORTAÇÃO FORMATADAS =================

  // Função auxiliar para obter data formatada como DD-MM-YYYY
  const getDataFormatada = () => {
    const hoje = new Date();
    const dia = String(hoje.getDate()).padStart(2, '0');
    const mes = String(hoje.getMonth() + 1).padStart(2, '0');
    const ano = hoje.getFullYear();
    return `${dia}-${mes}-${ano}`;
  };

  // Exportar JSON
  const exportarJSON = () => {
    if (pedidos.length === 0) {
      message.warning('Não há pedidos para exportar.');
      return;
    }
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(pedidos, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `Pedidos-${getDataFormatada()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    message.success('Arquivo JSON exportado com sucesso!');
  };

  // Exportar CSV
  const exportarCSV = () => {
    if (pedidos.length === 0) {
      message.warning('Não há pedidos para exportar.');
      return;
    }
    let csvContent = "data:text/csv;charset=utf-8,ID;Cliente;Documento;Status;Data;Total\n";
    pedidos.forEach(p => {
      const totalNum = p.itens.reduce((acc, i) => acc + (i.quantidade * i.valor_unitario), 0);
      csvContent += `${p.id_pedido};"${p.cliente_nome}";${p.documento_cliente};${p.status_pagamento};${p.data_pedido};${totalNum}\n`;
    });
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Pedidos-${getDataFormatada()}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    message.success('Arquivo CSV exportado com sucesso!');
  };

  // Exportar XML
  const exportarXML = () => {
    if (pedidos.length === 0) {
      message.warning('Não há pedidos para exportar.');
      return;
    }
    let xmlContent = `<?xml version="1.0" encoding="UTF-8"?>\n<Pedidos>\n`;
    pedidos.forEach(p => {
      xmlContent += `  <Pedido id="${p.id_pedido}">\n`;
      xmlContent += `    <Cliente>${p.cliente_nome}</Cliente>\n`;
      xmlContent += `    <Documento>${p.documento_cliente}</Documento>\n`;
      xmlContent += `    <StatusPagamento>${p.status_pagamento}</StatusPagamento>\n`;
      xmlContent += `    <Data>${p.data_pedido}</Data>\n`;
      xmlContent += `    <Itens>\n`;
      p.itens.forEach(i => {
        xmlContent += `      <Item descricao="${i.descricao}" qtd="${i.quantidade}" valorUnitario="${i.valor_unitario}"/>\n`;
      });
      xmlContent += `    </Itens>\n`;
      xmlContent += `  </Pedido>\n`;
    });
    xmlContent += `</Pedidos>`;

    const blob = new Blob([xmlContent], { type: 'text/xml;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Pedidos-${getDataFormatada()}.xml`;
    link.click();
    link.remove();
    message.success('Arquivo XML exportado com sucesso!');
  };

  // Importar Arquivo Local
  const handleFileUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (file.name.endsWith('.json')) {
        try {
          const parsed = JSON.parse(content);
          if (Array.isArray(parsed)) {
            setPedidos(parsed);
            setPedidoAtivo(parsed[0] || null);
            message.success('Pedidos importados via JSON com sucesso!');
          }
        } catch (err) {
          message.error('Erro ao processar arquivo JSON.');
        }
      } else {
        message.warning('Formato não suportado para leitura automática. Use JSON.');
      }
    };
    reader.readAsText(file);
    return false;
  };

  return (
    <Layout style={{ minHeight: '100vh', backgroundColor: '#f0f2f5' }}>
      
      {/* Barra Lateral de Pedidos */}
      <Sider width={360} theme="light" style={{ borderRight: '1px solid #e8e8e8', padding: '16px' }}>
        <Row justify="space-between" align="middle" style={{ marginBottom: '16px' }}>
          <Col><Title level={4} style={{ margin: 0 }}>Gestão de Pedidos</Title></Col>
          <Col>
            <Button type="primary" shape="circle" icon={<PlusOutlined />} onClick={handleAbrirCriacao} />
          </Col>
        </Row>

        <Input
          placeholder="Buscar por ID ou Cliente..."
          prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ marginBottom: '16px' }}
          allowClear
          addonAfter={<Button type="text" size="small" icon={<ReloadOutlined />} onClick={handleReload} loading={loading} />}
        />

        <Space style={{ width: '100%', marginBottom: '16px', display: 'flex', justifyContent: 'space-between' }} size="small">
          <DropdownExportar 
            exportarJSON={exportarJSON} 
            exportarCSV={exportarCSV} 
            exportarXML={exportarXML} 
          />
          <Upload beforeUpload={handleFileUpload} showUploadList={false} accept=".json">
            <Button icon={<UploadOutlined />} size="small">Importar</Button>
          </Upload>
        </Space>

        <div style={{ overflowY: 'auto', height: 'calc(100vh - 210px)' }}>
          <List
            dataSource={pedidosFiltrados}
            loading={loading}
            renderItem={(item) => {
              const totalItem = item.itens.reduce((acc, i) => acc + (i.quantidade * i.valor_unitario), 0);
              const statusColor = item.status_pagamento === 'PAGO' ? 'success' : item.status_pagamento === 'PARCIAL' ? 'warning' : 'error';
              
              return (
                <List.Item
                  onClick={() => setPedidoAtivo(item)}
                  style={{
                    padding: '12px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    marginBottom: '8px',
                    backgroundColor: pedidoAtivo?.id_pedido === item.id_pedido ? '#e6f7ff' : 'transparent',
                    border: pedidoAtivo?.id_pedido === item.id_pedido ? '1px solid #91d5ff' : '1px solid transparent',
                    transition: 'all 0.2s'
                  }}
                >
                  <List.Item.Meta
                    avatar={
                      <Avatar style={{ backgroundColor: '#1890ff' }}>
                        <ShoppingCartOutlined />
                      </Avatar>
                    }
                    title={
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text strong>Pedido #{item.id_pedido}</Text>
                        <Tag color={statusColor} style={{ marginRight: 0, fontSize: '10px' }}>
                          {item.status_pagamento}
                        </Tag>
                      </div>
                    }
                    description={
                      <div style={{ fontSize: '12px' }}>
                        <div style={{ fontWeight: 500, color: '#333' }}>{item.cliente_nome}</div>
                        <Text type="secondary">Total: {totalItem.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</Text>
                      </div>
                    }
                  />
                </List.Item>
              );
            }}
          />
        </div>
      </Sider>

      {/* Conteúdo Principal / Detalhes do Pedido */}
      <Content style={{ padding: '24px', overflowY: 'auto', height: '100vh' }}>
        {pedidoAtivo ? (
          <>
            <Card bordered={false} style={{ marginBottom: '16px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
              <Row justify="space-between" align="middle">
                <Col>
                  <Space size="middle" align="center">
                    <ShoppingCartOutlined style={{ fontSize: '32px', color: '#1890ff', padding: '8px', backgroundColor: '#e6f7ff', borderRadius: '8px' }} />
                    <div>
                      <Title level={3} style={{ margin: 0 }}>Pedido #{pedidoAtivo.id_pedido}</Title>
                      <Text type="secondary">Cliente: {pedidoAtivo.cliente_nome}</Text>
                    </div>
                  </Space>
                </Col>
                <Col>
                  <Space>
                    <Button icon={<EditOutlined />} onClick={() => handleAbrirEdicao(pedidoAtivo)}>Editar</Button>
                    <Button danger icon={<DeleteOutlined />} onClick={() => handleExcluirPedido(pedidoAtivo.id_pedido)}>Excluir</Button>
                  </Space>
                </Col>
              </Row>
            </Card>

            <Space direction="vertical" size="middle" style={{ display: 'flex' }}>
              <Card bordered={false}>
                <Descriptions title="Resumo do Faturamento" bordered column={{ xs: 1, sm: 3 }}>
                  <Descriptions.Item label="Data do Pedido">{pedidoAtivo.data_pedido}</Descriptions.Item>
                  <Descriptions.Item label="Documento">{pedidoAtivo.documento_cliente}</Descriptions.Item>
                  <Descriptions.Item label="Status Pagamento">
                    <Tag color={pedidoAtivo.status_pagamento === 'PAGO' ? 'success' : pedidoAtivo.status_pagamento === 'PARCIAL' ? 'warning' : 'error'}>
                      {pedidoAtivo.status_pagamento}
                    </Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="Valor Total Geral" span={3}>
                    <Text strong style={{ fontSize: '16px', color: '#389e0d' }}>{calcularTotal(pedidoAtivo.itens)}</Text>
                  </Descriptions.Item>
                  {pedidoAtivo.observacoes && (
                    <Descriptions.Item label="Observações" span={3}>{pedidoAtivo.observacoes}</Descriptions.Item>
                  )}
                </Descriptions>
              </Card>

              <Card bordered={false} title="Itens e Serviços Personalizados">
                <Table
                  size="small"
                  pagination={false}
                  columns={[
                    { title: 'Item / Serviço', dataIndex: 'descricao' },
                    { title: 'Quantidade', dataIndex: 'quantidade' },
                    { 
                      title: 'Valor Unitário Customizado', 
                      dataIndex: 'valor_unitario',
                      render: (val: number) => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                    },
                    { 
                      title: 'Subtotal', 
                      render: (_, record: ItemPedido) => (record.quantidade * record.valor_unitario).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                    }
                  ]}
                  dataSource={pedidoAtivo.itens}
                />
              </Card>
            </Space>
          </>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
            <Empty description="Nenhum pedido cadastrado ou selecionado no momento." />
          </div>
        )}
      </Content>

      {/* Modal de Criação / Edição de Pedidos */}
      <Modal
        title={pedidoEmEdicao ? `Editar Pedido #${pedidoEmEdicao.id_pedido}` : "Criar Novo Pedido"}
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        onOk={() => form.submit()}
        width={750}
        okText="Salvar Pedido"
        cancelText="Voltar"
        destroyOnClose
      >
        <Divider style={{ margin: '12px 0' }} />
        
        <Form form={form} layout="vertical" onFinish={handleSalvarPedido}>
          <Row gutter={16}>
            <Col span={14}>
              <Form.Item name="cliente_nome" label="Nome do Cliente / Empresa" rules={[{ required: true, message: 'Informe o cliente' }]}>
                <Input placeholder="Ex: Indústria Metalúrgica S.A." />
              </Form.Item>
            </Col>
            <Col span={10}>
              <Form.Item name="documento_cliente" label="CNPJ / CPF" rules={[{ required: true, message: 'Informe o documento' }]}>
                <Input placeholder="00.000.000/0001-00" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="status_pagamento" label="Status de Pagamento" rules={[{ required: true }]}>
                <Select>
                  <Select.Option value="PAGO">Pago Integralmente</Select.Option>
                  <Select.Option value="PARCIAL">Pago Parcialmente</Select.Option>
                  <Select.Option value="PENDENTE">Pendente</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="data_pedido" label="Data do Pedido">
                <Input placeholder="DD/MM/AAAA" />
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left" style={{ fontSize: '11px', color: '#bfbfbf' }}>Itens, Serviços e Valores Unitários Personalizados</Divider>

          <Form.List name="itens">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name, ...restField }) => (
                  <Space key={key} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
                    <Form.Item {...restField} name={[name, 'descricao']} rules={[{ required: true, message: 'Falta o item' }]}>
                      <Input placeholder="Descrição do produto ou serviço" style={{ width: 280 }} />
                    </Form.Item>
                    <Form.Item {...restField} name={[name, 'quantidade']} rules={[{ required: true, message: 'Qtd' }]}>
                      <InputNumber placeholder="Qtd" min={1} style={{ width: 80 }} />
                    </Form.Item>
                    <Form.Item {...restField} name={[name, 'valor_unitario']} rules={[{ required: true, message: 'Preço' }]}>
                      <InputNumber placeholder="Valor Unit. (R$)" min={0} step={0.10} style={{ width: 140 }} />
                    </Form.Item>
                    <Button type="text" danger onClick={() => remove(name)}>Excluir</Button>
                  </Space>
                ))}
                <Form.Item>
                  <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                    Adicionar Novo Item / Serviço
                  </Button>
                </Form.Item>
              </>
            )}
          </Form.List>

          <Form.Item name="observacoes" label="Observações Internas / Logística">
            <Input.TextArea rows={2} placeholder="Ex: Instruções de entrega ou condições de faturamento" />
          </Form.Item>
        </Form>
      </Modal>

    </Layout>
  );
}

// Subcomponente de Dropdown para Exportação
function DropdownExportar({ exportarJSON, exportarCSV, exportarXML }: any) {
  const items = [
    { key: 'json', label: 'Exportar como JSON', onClick: exportarJSON },
    { key: 'csv', label: 'Exportar como CSV', onClick: exportarCSV },
    { key: 'xml', label: 'Exportar como XML', onClick: exportarXML },
  ];

  return (
    <Dropdown menu={{ items }} trigger={['click']}>
      <Button icon={<DownloadOutlined />} size="small">Exportar</Button>
    </Dropdown>
  );
}