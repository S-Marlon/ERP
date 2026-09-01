import React, { useState, useEffect } from 'react';
import { 
  Form, 
  Input, 
  Select, 
  InputNumber, 
  Button, 
  Card, 
  Table, 
  Space, 
  Typography, 
  Modal, 
  message, 
  Tag,
  Divider
} from 'antd';
import { 
  FileTextOutlined, 
  PrinterOutlined, 
  PlusOutlined, 
  DeleteOutlined,
  ThunderboltOutlined 
} from '@ant-design/icons';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { Option } = Select;

// Tipagem para os itens do pedido
interface ItemPedido {
  key: string;
  produto: string;
  quantidade: number;
  valorUnitario: number;
}

// Mock de clientes vindos do banco
const clientesMock = [
  { id: 1, nome: 'Comércio de Roupas LTDA', cnpj: '12.345.678/0001-90' },
  { id: 2, nome: 'Tech Solutions S.A.', cnpj: '98.765.432/0001-10' },
  { id: 3, nome: 'Distribuidora Alimentos Master', cnpj: '45.678.901/0001-23' },
];

export default function EmissaoFaturado() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [etapa, setEtapa] = useState<'temporario' | 'oficial'>('temporario');
  const [dadosPedido, setDadosPedido] = useState<any>(null);
  
  // Estados para os itens da tabela do pedido
  const [itens, setItens] = useState<ItemPedido[]>([
    { key: '1', produto: 'Produto Exemplo A', quantidade: 2, valorUnitario: 150.00 }
  ]);
  const [modalItemVisible, setModalItemVisible] = useState(false);
  const [formItem] = Form.useForm();

  // Calcular valor total
  const valorTotal = itens.reduce((acc, item) => acc + (item.quantidade * item.valorUnitario), 0);

  // Valores padrão iniciais (Ex: 1ª parcela para 30 dias)
  useEffect(() => {
    form.setFieldsValue({
      qtdParcelas: 1,
      primeirosDias: 30,
      diasIntervalo: 15
    });
  }, [form]);

  // Função para aplicar atalhos rápidos da tabelinha de base
  const aplicarAtalho = (qtd: number, primeiro: number, intervalo: number) => {
    form.setFieldsValue({
      qtdParcelas: qtd,
      primeirosDias: primeiro,
      diasIntervalo: intervalo
    });
  };

  // Ação 1: Criar Registro Temporário / Pedido de Faturamento
  const handleCriarTemporario = (values: any) => {
    if (itens.length === 0) {
      message.error('Adicione pelo menos um item ao pedido.');
      return;
    }

    setLoading(true);
    setTimeout(() => {
      setLoading(false);

      const { qtdParcelas, primeirosDias, diasIntervalo } = values;

      // Monta a string de resumo da condição
      let condicaoTexto = `${primeirosDias} dias`;
      if (qtdParcelas > 1) {
        condicaoTexto = `${qtdParcelas}x (1ª para ${primeirosDias} dias, após de ${diasIntervalo} em ${diasIntervalo} dias)`;
      }

      // Simulação do cálculo das datas de vencimento reais de cada parcela
      const vencimentosSimulados = [];
      const valorPorParcela = valorTotal / qtdParcelas;

      for (let i = 1; i <= qtdParcelas; i++) {
        let diasTotais = 0;
        if (i === 1) {
          diasTotais = primeirosDias;
        } else {
          diasTotais = primeirosDias + ((i - 1) * diasIntervalo);
        }

        const dataVenc = dayjs().add(diasTotais, 'day').format('DD/MM/YYYY');
        vencimentosSimulados.push({
          parcela: `${i}/${qtdParcelas}`,
          diasAcumulados: diasTotais,
          data: dataVenc,
          valor: valorPorParcela
        });
      }

      const clienteObj = clientesMock.find(c => c.id === values.clienteId);

      const pedidoCompleto = {
        ...values,
        clienteNome: clienteObj?.nome || '',
        clienteCnpj: clienteObj?.cnpj || '',
        condicaoTexto,
        vencimentosSimulados,
        itens,
        valorTotal,
        dataEmissao: dayjs().format('DD/MM/YYYY'),
      };
      
      setDadosPedido(pedidoCompleto);
      setEtapa('oficial');
      message.success('Pedido temporário faturado criado com sucesso!');
    }, 1000);
  };

  // Ação 2: Acionar a Impressão do Espelho / Pré-Nota para apoio operacional
  const handleImprimirEspelho = () => {
    window.print();
  };

  // Adicionar item na lista temporária
  const handleAdicionarItem = (values: any) => {
    const novoItem: ItemPedido = {
      key: String(Date.now()),
      produto: values.produto,
      quantidade: values.quantidade,
      valorUnitario: values.valorUnitario,
    };
    setItens([...itens, novoItem]);
    setModalItemVisible(false);
    formItem.resetFields();
  };

  const removerItem = (key: string) => {
    setItens(itens.filter(i => i.key !== key));
  };

  const colunasItens = [
    { title: 'Produto', dataIndex: 'produto', key: 'produto' },
    { title: 'Qtd', dataIndex: 'quantidade', key: 'quantidade' },
    { 
      title: 'Vlr. Unitário', 
      dataIndex: 'valorUnitario', 
      key: 'valorUnitario',
      render: (val: number) => `R$ ${val.toFixed(2)}` 
    },
    { 
      title: 'Subtotal', 
      key: 'subtotal',
      render: (_: any, record: ItemPedido) => `R$ ${(record.quantidade * record.valorUnitario).toFixed(2)}` 
    },
    etapa === 'temporario' ? {
      title: 'Ações',
      key: 'acoes',
      render: (_: any, record: ItemPedido) => (
        <Button danger type="text" icon={<DeleteOutlined />} onClick={() => removerItem(record.key)} />
      ),
    } : {},
  ].filter(col => Object.keys(col).length > 0);

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
      
      {/* Estilo CSS customizado para garantir que na hora de imprimir saia apenas o essencial */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-area, #printable-area * {
            visibility: visible;
          }
          #printable-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 20px;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <Card title={
        <Space>
          <FileTextOutlined />
          <Title level={4} style={{ margin: 0 }}>
            {etapa === 'temporario' ? '1. Emissão de Pedido Faturado (Prazos Inteligentes)' : '2. Espelho de Pré-Faturamento (Apoio Emissão Manual)'}
          </Title>
        </Space>
      }>
        
        {/* Status atual do fluxo */}
        <div style={{ marginBottom: 24 }} className="no-print">
          <Tag color={etapa === 'temporario' ? 'processing' : 'success'}>
            Status: {etapa === 'temporario' ? 'Rascunho / Temporário' : 'Pronto para Conferência e Emissão Manual'}
          </Tag>
        </div>

        {etapa === 'temporario' ? (
          // FORMULÁRIO TEMPORÁRIO
          <Form form={form} layout="vertical" onFinish={handleCriarTemporario}>
            <Form.Item 
              name="clienteId" 
              label="Cliente (CNPJ Cadastrado)" 
              rules={[{ required: true, message: 'Selecione o cliente' }]}
            >
              <Select placeholder="Selecione a empresa compradora" showSearch optionFilterProp="children">
                {clientesMock.map(c => (
                  <Option key={c.id} value={c.id}>
                    {c.nome} — CNPJ: {c.cnpj}
                  </Option>
                ))}
              </Select>
            </Form.Item>

            {/* Tabelinha de Base / Atalhos Rápidos */}
            <div style={{ marginBottom: 16, background: '#f5f5f5', padding: 12, borderRadius: 8 }}>
              <Text strong style={{ display: 'block', marginBottom: 8 }}>
                <ThunderboltOutlined style={{ color: '#faad14' }} /> Sugestões Comerciais Rápidas:
              </Text>
              <Space wrap>
                <Button size="small" onClick={() => aplicarAtalho(1, 30, 0)}>30 Dias Fixos</Button>
                <Button size="small" onClick={() => aplicarAtalho(2, 30, 15)}>30 Dias + 15 (30/45)</Button>
                <Button size="small" onClick={() => aplicarAtalho(3, 30, 30)}>30 / 60 / 90 Dias</Button>
                <Button size="small" onClick={() => aplicarAtalho(2, 15, 15)}>15 / 30 Dias</Button>
              </Space>
            </div>

            {/* Campos inteligentes estruturados */}
            <div style={{ display: 'flex', gap: 16 }}>
              <Form.Item 
                name="qtdParcelas" 
                label="Qtd Parcelas (Máx 12)" 
                rules={[{ required: true, message: 'Informe' }]}
                style={{ flex: 1 }}
              >
                <InputNumber min={1} max={12} style={{ width: '100%' }} />
              </Form.Item>

              <Form.Item 
                name="primeirosDias" 
                label="Dias para a 1ª Parcela" 
                rules={[{ required: true, message: 'Informe' }]}
                style={{ flex: 1 }}
              >
                <InputNumber min={1} max={365} style={{ width: '100%' }} />
              </Form.Item>

              <Form.Item 
                name="diasIntervalo" 
                label="Intervalo Próximas (Dias)" 
                rules={[{ required: true, message: 'Informe' }]}
                style={{ flex: 1 }}
              >
                <InputNumber min={0} max={365} style={{ width: '100%' }} />
              </Form.Item>
            </div>

            <Divider orientation="left">Itens do Pedido / Faturamento</Divider>
            
            <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text strong>Valor Total: R$ {valorTotal.toFixed(2)}</Text>
              <Button type="dashed" icon={<PlusOutlined />} onClick={() => setModalItemVisible(true)}>
                Adicionar Item
              </Button>
            </div>

            <Table dataSource={itens} columns={colunasItens} pagination={false} size="small" />

            <div style={{ marginTop: 24, textAlign: 'right' }}>
              <Button type="primary" htmlType="submit" loading={loading} size="large">
                Gerar Espelho e Salvar Pedido
              </Button>
            </div>
          </Form>
        ) : (
          // ETAPA ESPELHO / PRÉ-NOTA PARA IMPRESSÃO E DIGITAÇÃO MANUAL
          <div id="printable-area">
            <Card type="inner" title="Espelho de Conferência (Uso para Emissão Manual)" style={{ marginBottom: 24 }}>
              <p><strong>Cliente:</strong> {dadosPedido.clienteNome}</p>
              <p><strong>CNPJ:</strong> {dadosPedido.clienteCnpj}</p>
              <p><strong>Data de Emissão / Saída:</strong> {dadosPedido.dataEmissao}</p>
              <p><strong>Condição de Pagamento:</strong> <Tag color="orange">{dadosPedido.condicaoTexto}</Tag></p>
              <p><strong>Valor Total dos Produtos:</strong> R$ {dadosPedido.valorTotal.toFixed(2)}</p>
              
              <Divider orientation="left" plain>Cronograma de Vencimento (Para controle financeiro)</Divider>
              <ul>
                {dadosPedido.vencimentosSimulados.map((v: any, index: number) => (
                  <li key={index}>
                    Parcela <strong>{v.parcela}</strong> — Vencimento: <strong>{v.data}</strong> (Daqui a {v.diasAcumulados} dias) — <strong>R$ {v.valor.toFixed(2)}</strong>
                  </li>
                ))}
              </ul>
            </Card>

            <Table dataSource={dadosPedido.itens} columns={colunasItens} pagination={false} size="small" style={{ marginBottom: 24 }} />

            <div style={{ display: 'flex', justifyContent: 'space-between' }} className="no-print">
              <Button onClick={() => setEtapa('temporario')}>
                Voltar e Editar Pedido
              </Button>
              <Space>
                <Button 
                  type="primary" 
                  icon={<PrinterOutlined />} 
                  onClick={handleImprimirEspelho}
                  style={{ backgroundColor: '#fa8c16', borderColor: '#fa8c16' }}
                >
                  Imprimir Espelho (PDF / Papel)
                </Button>
              </Space>
            </div>
          </div>
        )}

      </Card>

      {/* Modal para Adicionar Itens */}
      <Modal
        title="Adicionar Produto ao Pedido"
        open={modalItemVisible}
        onCancel={() => setModalItemVisible(false)}
        onOk={() => formItem.submit()}
      >
        <Form form={formItem} layout="vertical" onFinish={handleAdicionarItem}>
          <Form.Item name="produto" label="Nome do Produto" rules={[{ required: true }]}>
            <Input placeholder="Ex: Peça / Insumo X" />
          </Form.Item>
          <Form.Item name="quantidade" label="Quantidade" rules={[{ required: true }]}>
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="valorUnitario" label="Valor Unitário (R$)" rules={[{ required: true }]}>
            <InputNumber min={0.01} step={0.01} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}