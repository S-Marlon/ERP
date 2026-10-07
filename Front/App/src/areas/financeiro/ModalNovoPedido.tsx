import React, { useState } from 'react';
import { 
  Modal, 
  Form, 
  Select, 
  InputNumber, 
  Table, 
  Button, 
  Space, 
  Typography, 
  Divider, 
  message,
  Input
} from 'antd';
import { PlusOutlined, DeleteOutlined, ShoppingCartOutlined, CodeOutlined, CheckOutlined } from '@ant-design/icons';

const { Text, Title } = Typography;
const { TextArea } = Input;

interface ItemPedido {
  key: string;
  id_item: number;
  sku: string;
  ncm: string;
  nome: string;
  quantidade: number;
  precoUnitario: number;
}

interface ModalNovoPedidoProps {
  visible: boolean;
  onClose: () => void;
  onSave: (dadosPedido: any) => void;
}

export const ModalNovoPedido: React.FC<ModalNovoPedidoProps> = ({ visible, onClose, onSave }) => {
  const [form] = Form.useForm();
  const [itensCarrinho, setItensCarrinho] = useState<ItemPedido[]>([]);
  
  // Estados para controlar o modo de importação por JSON
  const [isJsonMode, setIsJsonMode] = useState(false);
  const [jsonInputText, setJsonInputText] = useState('');

  // Função para ler e injetar o JSON colado (com suporte a NCM e SKU)
  const handleImportJson = () => {
    try {
      const parsedData = JSON.parse(jsonInputText);

      if (parsedData.cliente_id) {
        form.setFieldValue('cliente_id', parsedData.cliente_id);
      }
      if (parsedData.condicaoPagamento) {
        form.setFieldValue('condicaoPagamento', parsedData.condicaoPagamento);
      }

      if (Array.isArray(parsedData.itens)) {
        const itensMapeados: ItemPedido[] = parsedData.itens.map((item: any, index: number) => ({
          key: String(Date.now() + index),
          id_item: item.id_item || 101,
          sku: item.sku || `SKU-IMP-${index}`,
          ncm: item.ncm || '8708.99.90',
          nome: item.nome || item.descricao || 'Produto Importado via JSON',
          quantidade: Number(item.quantidade) || 1,
          precoUnitario: Number(item.precoUnitario || item.preco) || 0.00,
        }));

        setItensCarrinho(itensMapeados);
        message.success('Pedido importado via JSON com sucesso!');
        setIsJsonMode(false);
        setJsonInputText('');
      } else {
        message.error('O JSON precisa conter um array "itens" com os produtos.');
      }
    } catch (error) {
      message.error('JSON inválido! Verifique a sintaxe das chaves e aspas.');
    }
  };

  // Adicionar item em branco para edição totalmente livre
  const adicionarItemLivre = () => {
    const novoItem: ItemPedido = {
      key: String(Date.now()),
      id_item: Math.floor(Math.random() * 1000),
      sku: `SKU-${Math.floor(Math.random() * 1000)}`,
      ncm: '8708.99.90',
      nome: 'Novo Produto (Clique para editar)',
      quantidade: 1,
      precoUnitario: 0.00,
    };
    setItensCarrinho([...itensCarrinho, novoItem]);
  };

  const removerItem = (key: string) => {
    setItensCarrinho(itensCarrinho.filter(i => i.key !== key));
  };

  // Função para atualizar propriedades específicas de um item na tabela de forma reativa
  const atualizarItem = (key: string, campo: keyof ItemPedido, valor: any) => {
    setItensCarrinho(itensCarrinho.map(item => {
      if (item.key === key) {
        return { ...item, [campo]: valor };
      }
      return item;
    }));
  };

  const valorTotalPedido = itensCarrinho.reduce((acc, item) => acc + (item.quantidade * item.precoUnitario), 0);

  const handleSubmit = () => {
    form.validateFields().then(values => {
      if (itensCarrinho.length === 0) {
        message.error('Adicione pelo menos um item ao pedido faturado!');
        return;
      }

      const payloadPedido = {
        ...values,
        itens: itensCarrinho,
        valorTotal: valorTotalPedido,
        statusCiclo: 'AGUARDANDO_CREDITO'
      };

      onSave(payloadPedido);
      message.success('Pedido faturado criado e enviado para análise de crédito!');
      form.resetFields();
      setItensCarrinho([]);
      onClose();
    }).catch(info => {
      console.log('Validate Failed:', info);
    });
  };

  // Colunas da Tabela com Inputs editáveis livres (SKU, NCM, Nome, Quantidade e Preço)
  const colunasItens = [
    { 
      title: 'SKU', 
      dataIndex: 'sku', 
      key: 'sku',
      width: '120px',
      render: (sku: string, record: ItemPedido) => (
        <Input 
          value={sku} 
          size="small" 
          onChange={(e) => atualizarItem(record.key, 'sku', e.target.value)} 
        />
      )
    },
    { 
      title: 'NCM (Fiscal)', 
      dataIndex: 'ncm', 
      key: 'ncm',
      width: '130px',
      render: (ncm: string, record: ItemPedido) => (
        <Input 
          value={ncm} 
          size="small" 
          placeholder="0000.00.00"
          onChange={(e) => atualizarItem(record.key, 'ncm', e.target.value)} 
        />
      )
    },
    { 
      title: 'Nome / Descrição do Produto', 
      dataIndex: 'nome', 
      key: 'nome',
      render: (nome: string, record: ItemPedido) => (
        <Input 
          value={nome} 
          size="small" 
          onChange={(e) => atualizarItem(record.key, 'nome', e.target.value)} 
        />
      )
    },
    { 
      title: 'Qtd', 
      dataIndex: 'quantidade', 
      key: 'quantidade',
      width: '80px',
      render: (qtd: number, record: ItemPedido) => (
        <InputNumber 
          min={1} 
          size="small"
          value={qtd} 
          onChange={(val) => atualizarItem(record.key, 'quantidade', val || 1)} 
          style={{ width: '100%' }}
        />
      )
    },
    { 
      title: 'Preço Unit. (R$)', 
      dataIndex: 'precoUnitario', 
      key: 'precoUnitario',
      width: '120px',
      render: (val: number, record: ItemPedido) => (
        <InputNumber 
          min={0} 
          precision={2}
          size="small"
          value={val} 
          onChange={(v) => atualizarItem(record.key, 'precoUnitario', v || 0)} 
          style={{ width: '100%' }}
        />
      )
    },
    { 
      title: 'Subtotal', 
      key: 'subtotal',
      width: '110px',
      render: (_: any, record: ItemPedido) => <Text strong>R$ {(record.quantidade * record.precoUnitario).toFixed(2)}</Text>
    },
    {
      title: 'Ação',
      key: 'acao',
      width: '60px',
      render: (_: any, record: ItemPedido) => (
        <Button danger size="small" icon={<DeleteOutlined />} onClick={() => removerItem(record.key)} />
      )
    }
  ];

  return (
    <Modal
      title={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingRight: 24 }}>
          <Space><ShoppingCartOutlined /><span>Novo Pedido Faturado (Venda a Prazo)</span></Space>
          <Button 
            type="dashed" 
            size="small" 
            icon={<CodeOutlined />} 
            onClick={() => setIsJsonMode(!isJsonMode)}
          >
            {isJsonMode ? 'Voltar ao Formulário' : 'Importar via JSON (IA)'}
          </Button>
        </div>
      }
      open={visible}
      onCancel={onClose}
      width={1050}
      okText="Salvar e Enviar para Crédito"
      cancelText="Cancelar"
      onOk={handleSubmit}
    >
      {/* PAINEL DE IMPORTAÇÃO DE JSON */}
      {isJsonMode ? (
        <div style={{ background: '#f6f8fa', padding: 16, borderRadius: 8, border: '1px solid #d0d7de' }}>
          <Title level={5} style={{ marginTop: 0 }}>Cole o JSON gerado pela IA abaixo (incluindo NCM e SKU):</Title>
          <Text type="secondary" style={{ fontSize: '13px', display: 'block', marginBottom: 12 }}>
            Exemplo compatível: <code>{`{ "cliente_id": 1, "condicaoPagamento": "30_DIAS", "itens": [{ "sku": "ABC", "ncm": "8708.99.90", "nome": "Produto X", "quantidade": 5, "precoUnitario": 100 }] }`}</code>
          </Text>
          <TextArea 
            rows={8} 
            value={jsonInputText} 
            onChange={(e) => setJsonInputText(e.target.value)}
            placeholder="Cole o JSON aqui..."
            style={{ fontFamily: 'monospace', fontSize: '13px', marginBottom: 12 }}
          />
          <Button type="primary" icon={<CheckOutlined />} onClick={handleImportJson}>
            Processar e Preencher Pedido
          </Button>
        </div>
      ) : (
        /* FORMULÁRIO COM CAMPOS LIVRES E EDITÁVEIS */
        <Form form={form} layout="vertical" initialValues={{ condicaoPagamento: '30_DIAS' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px' }}>
            <Form.Item 
              name="cliente_id" 
              label="Cliente B2B" 
              rules={[{ required: true, message: 'Selecione o cliente!' }]}
            >
              <Select 
                placeholder="Selecione um cliente cadastrado..."
                options={[
                  { value: 1, label: 'Comercial Alvorada Ltda (Limite: R$ 20.000,00)' },
                  { value: 2, label: 'Distribuidora São Paulo S.A. (Limite: R$ 50.000,00)' },
                  { value: 3, label: 'Supermercados Bella Vista (Limite: R$ 10.000,00)' }
                ]}
              />
            </Form.Item>

            <Form.Item 
              name="condicaoPagamento" 
              label="Condição de Pagamento" 
              rules={[{ required: true, message: 'Informe a condição!' }]}
            >
              <Select 
                placeholder="Selecione a condição..."
                options={[
                  { value: 'A_VISTA_PIX', label: 'À Vista / PIX' },
                  { value: '7_DIAS', label: '7 Dias (Boleto)' },
                  { value: '15_DIAS', label: '15 Dias (Boleto)' },
                  { value: '30_DIAS', label: '30 Dias (Boleto)' },
                  { value: '15_30_DIAS', label: '15 / 30 Dias' },
                  { value: '30_60_DIAS', label: '30 / 60 Dias' },
                  { value: '30_60_90_DIAS', label: '30 / 60 / 90 Dias' },
                  { value: '30_60_90_120_DIAS', label: '30 / 60 / 90 / 120 Dias' },
                ]}
              />
            </Form.Item>
          </div>

          <Divider style={{ margin: '12px 0' }} />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <Text strong>Itens do Pedido (Edição Livre / Nota Fiscal)</Text>
            <Button type="dashed" size="small" icon={<PlusOutlined />} onClick={adicionarItemLivre}>
              Adicionar Linha em Branco
            </Button>
          </div>

          <Table 
            dataSource={itensCarrinho} 
            columns={colunasItens} 
            pagination={false} 
            size="small" 
            locale={{ emptyText: 'Nenhum item adicionado. Adicione uma linha em branco ou importe via JSON.' }}
          />

          <div style={{ marginTop: 16, textAlign: 'right', background: '#fafafa', padding: 12, borderRadius: 6 }}>
            <Title level={4} style={{ margin: 0 }}>
              Valor Total do Pedido: <span style={{ color: '#52c41a' }}>R$ {valorTotalPedido.toFixed(2)}</span>
            </Title>
          </div>
        </Form>
      )}
    </Modal>
  );
};