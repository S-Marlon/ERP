import React, { useState } from 'react';
import { 
  Button, 
  Card, 
  Table, 
  Row, 
  Col, 
  Typography, 
  Divider, 
  Form,
  Input,
  Space,
  message,
  Popconfirm,
  Upload
} from 'antd';
import { 
  PlusOutlined, 
  DeleteOutlined, 
  FileOutlined, 
  CodeOutlined, 
  ArrowLeftOutlined,
  UploadOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

const { Title, Text } = Typography;

interface ItemCompra {
  key: string;
  codigo: string;
  descricao: string;
  quantidade: number;
}

export default function ListaComprasExport() {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [itens, setItens] = useState<ItemCompra[]>([]);

  // ➕ Adicionar item à lista local
  const handleAdicionarItem = (values: { codigo: string; descricao: string; quantidade: number }) => {
    const novoItem: ItemCompra = {
      key: String(Date.now() + Math.random()),
      codigo: values.codigo,
      descricao: values.descricao,
      quantidade: Number(values.quantidade),
    };

    setItens(prev => [...prev, novoItem]);
    message.success('Item adicionado à lista temporária!');
    form.resetFields();
  };

  // ❌ Remover item da lista
  const handleRemoverItem = (key: string) => {
    setItens(itens.filter(item => item.key !== key));
    message.info('Item removido da lista.');
  };

  // 💾 Exportar como JSON
  const handleExportJson = () => {
    if (itens.length === 0) {
      message.warning('A lista está vazia!');
      return;
    }

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(itens, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `lista_compras_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    message.success('Arquivo JSON exportado com sucesso!');
  };

  // 📄 Exportar como XML simples
  const handleExportXml = () => {
    if (itens.length === 0) {
      message.warning('A lista está vazia!');
      return;
    }

    let xmlString = '<?xml version="1.0" encoding="UTF-8"?>\n<ListaCompras>\n';
    itens.forEach(item => {
      xmlString += `  <Item>\n`;
      xmlString += `    <Codigo>${item.codigo}</Codigo>\n`;
      xmlString += `    <Descricao>${item.descricao}</Descricao>\n`;
      xmlString += `    <Quantidade>${item.quantidade}</Quantidade>\n`;
      xmlString += `  </Item>\n`;
    });
    xmlString += '</ListaCompras>';

    const dataStr = "data:text/xml;charset=utf-8," + encodeURIComponent(xmlString);
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `lista_compras_${Date.now()}.xml`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    message.success('Arquivo XML exportado com sucesso!');
  };

  // 📥 Importar Arquivo (JSON ou XML)
  const handleImportFile = (file: File) => {
    const reader = new FileReader();
    const fileExtension = file.name.split('.').pop()?.toLowerCase();

    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;

        if (fileExtension === 'json') {
          const parsedData = JSON.parse(content);
          if (Array.isArray(parsedData)) {
            const novosItens: ItemCompra[] = parsedData.map((item, index) => ({
              key: String(Date.now() + index),
              codigo: item.codigo || 'S/C',
              descricao: item.descricao || 'Sem descrição',
              quantidade: Number(item.quantidade) || 1,
            }));
            setItens(prev => [...prev, ...novosItens]);
            message.success(`${novosItens.length} itens importados via JSON com sucesso!`);
          } else {
            message.error('O formato do JSON não é uma lista válida.');
          }
        } else if (fileExtension === 'xml') {
          const parser = new DOMParser();
          const xmlDoc = parser.parseFromString(content, "text/xml");
          const itemNodes = xmlDoc.getElementsByTagName('Item');
          
          if (itemNodes.length === 0) {
            message.error('Nenhum elemento <Item> encontrado no XML.');
            return;
          }

          const novosItens: ItemCompra[] = [];
          for (let i = 0; i < itemNodes.length; i++) {
            const node = itemNodes[i];
            const codigo = node.getElementsByTagName('Codigo')[0]?.textContent || 'S/C';
            const descricao = node.getElementsByTagName('Descricao')[0]?.textContent || 'Sem descrição';
            const quantidade = Number(node.getElementsByTagName('Quantidade')[0]?.textContent) || 1;

            novosItens.push({
              key: String(Date.now() + i),
              codigo,
              descricao,
              quantidade,
            });
          }

          setItens(prev => [...prev, ...novosItens]);
          message.success(`${novosItens.length} itens importados via XML com sucesso!`);
        } else {
          message.error('Formato de arquivo não suportado. Use .json ou .xml');
        }
      } catch (error) {
        console.error(error);
        message.error('Erro ao processar o arquivo. Verifique se a estrutura está correta.');
      }
    };

    reader.readAsText(file);
    return false; // Impede o upload automático para um servidor externo
  };

  const columns = [
    { title: 'Cód. do Item', dataIndex: 'codigo', key: 'codigo' },
    { title: 'Descrição', dataIndex: 'descricao', key: 'descricao' },
    { title: 'Quantidade', dataIndex: 'quantidade', key: 'quantidade' },
    { 
      title: 'Ações', 
      key: 'acoes',
      render: (_: any, record: ItemCompra) => (
        <Popconfirm
          title="Deseja remover este item?"
          onConfirm={() => handleRemoverItem(record.key)}
          okText="Sim"
          cancelText="Não"
        >
          <Button type="text" danger icon={<DeleteOutlined />} size="small" />
        </Popconfirm>
      )
    },
  ];

  return (
    <div style={{ padding: '24px', backgroundColor: '#f8f9fa', minHeight: '100vh' }}>
      
      {/* 🖥️ Cabeçalho */}
      <Row justify="space-between" align="middle" style={{ marginBottom: '24px' }}>
        <Col>
          <Button 
            icon={<ArrowLeftOutlined />} 
            onClick={() => navigate(-1)} 
            style={{ marginBottom: '12px' }}
          >
            Voltar
          </Button>
          <Title level={2} style={{ margin: 0 }}>Gerador e Importador de Lista de Compras</Title>
          <Text type="secondary">Monte sua lista avulsa, importe dados ou exporte para JSON/XML.</Text>
        </Col>
      </Row>

      <Divider />

      <Row gutter={[24, 24]}>
        {/* Formulário de Adição */}
        <Col xs={24} md={8}>
          <Card title="Adicionar Item à Lista" bordered={false} style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.05)', marginBottom: '24px' }}>
            <Form form={form} layout="vertical" onFinish={handleAdicionarItem}>
              <Form.Item 
                name="codigo" 
                label="Código do Item" 
                rules={[{ required: true, message: 'Informe o código!' }]}
              >
                <Input placeholder="Ex: SKU-9988" />
              </Form.Item>

              <Form.Item 
                name="descricao" 
                label="Descrição" 
                rules={[{ required: true, message: 'Informe a descrição!' }]}
              >
                <Input placeholder="Ex: Cadeira de Escritório Ergonômica" />
              </Form.Item>

              <Form.Item 
                name="quantidade" 
                label="Quantidade" 
                rules={[{ required: true, message: 'Informe a quantidade!' }]}
              >
                <Input type="number" min={1} placeholder="Ex: 5" />
              </Form.Item>

              <Button type="primary" htmlType="submit" icon={<PlusOutlined />} block>
                Adicionar à Lista
              </Button>
            </Form>
          </Card>

          {/* 📥 Card de Importação */}
          <Card title="Importar Lista Existente" bordered={false} style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
            <Text type="secondary" style={{ display: 'block', marginBottom: '16px', fontSize: '13px' }}>
              Selecione um arquivo .json ou .xml gerado anteriormente para carregar os itens na tabela.
            </Text>
            <Upload 
              beforeUpload={handleImportFile} 
              showUploadList={false}
              accept=".json,.xml"
            >
              <Button icon={<UploadOutlined />} block>
                Selecionar Arquivo (JSON / XML)
              </Button>
            </Upload>
          </Card>
        </Col>

        {/* Tabela e Ações de Exportação */}
        <Col xs={24} md={16}>
          <Card 
            title="Itens Adicionados" 
            bordered={false} 
            style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.05)', height: '100%' }}
            extra={
              <Space>
                <Button 
                  type="default" 
                  icon={<CodeOutlined />} 
                  onClick={handleExportJson}
                  disabled={itens.length === 0}
                >
                  Exportar JSON
                </Button>
                <Button 
                  type="primary" 
                  icon={<FileOutlined />} 
                  onClick={handleExportXml}
                  disabled={itens.length === 0}
                >
                  Exportar XML
                </Button>
              </Space>
            }
          >
            <Table 
              dataSource={itens} 
              columns={columns} 
              pagination={false} 
              size="small"
              locale={{ emptyText: 'Nenhum item adicionado na lista ainda.' }}
            />
          </Card>
        </Col>
      </Row>

    </div>
  );
}