import React, { useState } from 'react';
import { 
  Card, 
  Row, 
  Col, 
  Typography, 
  Badge, 
  Button, 
  Space, 
  Modal, 
  Descriptions, 
  InputNumber, 
  Select,
  Tooltip
} from 'antd';
import { 
  InfoCircleOutlined, 
  PlusOutlined, 
  CarOutlined, 
  ShopOutlined, 
  FileTextOutlined,
  DollarOutlined
} from '@ant-design/icons';
import { NfeDataFromXML } from '../../types/NF-e';

interface NfeCardsProps {
  data: NfeDataFromXML;
  supplierStatus: {
    isChecking: boolean;
    exists: boolean | null;
  };
  actions: {
    onCreateSupplier: () => void;
  };
}

const { Text, Title } = Typography;

const formatarDataBR = (dataString?: string) => {
  if (!dataString) return '-';
  try {
    const data = new Date(dataString);
    return data.toLocaleDateString('pt-BR');
  } catch {
    return dataString.split('T')[0].split('-').reverse().join('/');
  }
};

const formatarChaveAcesso = (chave: string) => {
  return chave.replace(/(.{4})/g, '$1 ').trim();
};

const formatarMoeda = (valor?: number) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor || 0);
};

const traduzirModalidadeFrete = (mod?: string) => {
  switch (mod) {
    case '0': return '0 - CIF (Remetente)';
    case '1': return '1 - FOB (Destinatário)';
    case '2': return '2 - Terceiros';
    case '3': return '3 - Próprio Remetente';
    case '4': return '4 - Próprio Destinatário';
    case '9': return '9 - Sem Frete';
    default: return 'Não Informado';
  }
};

const NfeCards: React.FC<NfeCardsProps> = ({ data, supplierStatus, actions }) => {
  const { emitente } = data;

  // Modais Controlados pelo AntD
  const [isNfDetailsOpen, setIsNfDetailsOpen] = useState(false);
  const [isSupplierDetailsOpen, setIsSupplierDetailsOpen] = useState(false);
  const [isLogisticsDetailsOpen, setIsLogisticsDetailsOpen] = useState(false);

  return (
    <div>
      <Row gutter={[16, 16]}>
        
        {/* CARD 1: Identificação da NF */}
        <Col xs={24} md={8}>
          <Card 
            title={<Space><FileTextOutlined /><span>1. Identificação da NF</span></Space>}
            size="small"
            style={{ height: '100%' }}
            extra={
              <Tooltip title="Ver detalhes técnicos da nota">
                <Button type="text" icon={<InfoCircleOutlined />} onClick={() => setIsNfDetailsOpen(true)} />
              </Tooltip>
            }
          >
            <div style={{ background: '#fafafa', padding: '8px', borderRadius: '4px', border: '1px solid #f0f0f0' }}>
              <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>Chave de Acesso</Text>
              <Text copyable style={{ fontSize: 13, fontFamily: 'monospace' }}>{data.chaveAcesso}</Text>
            </div>
            <Descriptions column={1} layout="horizontal" size="small" bordered style={{ marginBottom: 12 }}>
              <Descriptions.Item label="Número">{data.numero}</Descriptions.Item>
              <Descriptions.Item label="Série">{data.serie}</Descriptions.Item>
              <Descriptions.Item label="Emissão">{formatarDataBR(data.dataEmissao)}</Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>

        {/* CARD 2: Fornecedor (Emitente) */}
        <Col xs={24} md={8}>
          <Card 
            title={<Space><ShopOutlined /><span>2. Fornecedor (Emitente)</span></Space>}
            size="small"
            style={{ height: '100%' }}
            extra={
              <Space>
                {supplierStatus.isChecking && <Badge status="processing" text="Verificando..." />}
                {supplierStatus.exists === true && <Badge status="success" text="Ativo" />}
                {supplierStatus.exists === false && (
                  <Space size={4}>
                    <Badge status="warning" text="Não Cadastrado" />
                    <Button type="primary" size="small" icon={<PlusOutlined />} onClick={actions.onCreateSupplier}>Criar</Button>
                  </Space>
                )}
                <Tooltip title="Ver dados do fornecedor">
                  <Button type="text" icon={<InfoCircleOutlined />} onClick={() => setIsSupplierDetailsOpen(true)} />
                </Tooltip>
              </Space>
            }
          >
            <Descriptions column={1} layout="horizontal" size="small" bordered>
              <Descriptions.Item label="CNPJ">{emitente.cnpj}</Descriptions.Item>
              <Descriptions.Item label="Fantasia" labelStyle={{ whiteSpace: 'nowrap' }}>
                <Text ellipsis style={{ maxWidth: 140 }}>{emitente.nomeFantasia || "Não Informado"}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Razão Social">
                <Text ellipsis style={{ maxWidth: 140 }}>{emitente.nome}</Text>
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>

        {/* CARD 3: Dados de Logística e Frete */}
        <Col xs={24} md={8}>
          <Card 
            title={<Space><CarOutlined /><span>3. Logística e Rateio de Frete</span></Space>}
            size="small"
            style={{ height: '100%' }}
            extra={
              <Tooltip title="Ver composição e tributos">
                <Button type="text" icon={<InfoCircleOutlined />} onClick={() => setIsLogisticsDetailsOpen(true)} />
              </Tooltip>
            }
          >
            <Text type="secondary" style={{ fontSize: 12 }}>Transportadora: </Text>
            <Text strong block ellipsis style={{ marginBottom: 4 }}>{data?.frete?.transportadora?.nome || "Não Informada"}</Text>


            <Descriptions column={3} size="small" layout="vertical" bordered style={{ marginBottom: 12 }}>
              <Descriptions.Item label="Volumes">{data?.frete?.volumes?.quantidade ?? '-'}</Descriptions.Item>
              <Descriptions.Item label="Espécie">{data?.frete?.volumes?.especie || '-'}</Descriptions.Item>
              <Descriptions.Item label="Peso Bruto">{data?.frete?.volumes?.pesoBruto ? `${data.frete.volumes.pesoBruto} kg` : '-'}</Descriptions.Item>
            </Descriptions>

            
            <Text type="secondary" style={{ fontSize: 12 }}>Modalidade do Frete (XML): </Text>
            <Text strong block style={{ marginBottom: 12 }}>{traduzirModalidadeFrete(data?.frete?.modalidade)}</Text>

            <Row gutter={8}>
              <Col span={12}>
                <Text strong style={{ fontSize: 12 }}>Valor do Frete (R$)</Text>
                <InputNumber 
                  style={{ width: '100%', marginTop: 4 }} 
                  placeholder="0,00" 
                  min={0} 
                  stringMode
                />
              </Col>
              <Col span={12}>
                <Text strong style={{ fontSize: 12 }}>Método de Rateio</Text>
                <Select defaultValue="VALOR" style={{ width: '100%', marginTop: 4 }}>
                  <Select.Option value="VALOR">Proporcional por Valor</Select.Option>
                  <Select.Option value="PESO">Proporcional por Peso</Select.Option>
                  <Select.Option value="IGUAL">Divisão Igualitária</Select.Option>
                  <Select.Option value="MANUAL">Digitação Manual</Select.Option>
                </Select>
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>

      {/* ================= MODAL: DETALHES DA NF ================= */}
      <Modal
        title="📄 Detalhes Técnicos da NF-e"
        open={isNfDetailsOpen}
        onCancel={() => setIsNfDetailsOpen(false)}
        footer={[<Button key="close" onClick={() => setIsNfDetailsOpen(false)}>Fechar</Button>]}
      >
        <Descriptions column={1} bordered style={{ marginTop: 16 }}>
          <Descriptions.Item label="Chave de Acesso"><Text style={{ fontFamily: 'monospace' }}>{formatarChaveAcesso(data.chaveAcesso)}</Text></Descriptions.Item>
          <Descriptions.Item label="Número">{data.numero}</Descriptions.Item>
          <Descriptions.Item label="Série">{data.serie}</Descriptions.Item>
          <Descriptions.Item label="Data Emissão">{formatarDataBR(data.dataEmissao)}</Descriptions.Item>
          <Descriptions.Item label="Modelo Fiscal">55 (Nota Fiscal Eletrônica)</Descriptions.Item>
          <Descriptions.Item label="Ambiente">1 (Produção)</Descriptions.Item>
          <Descriptions.Item label="Status SEFAZ"><Text type="success" strong>100 - Autorizado o uso da NF-e</Text></Descriptions.Item>
        </Descriptions>
      </Modal>

      {/* ================= MODAL: DETALHES DO FORNECEDOR ================= */}
      <Modal
        title="🏢 Dados Completos do Emitente"
        open={isSupplierDetailsOpen}
        onCancel={() => setIsSupplierDetailsOpen(false)}
        footer={[<Button key="close" onClick={() => setIsSupplierDetailsOpen(false)}>Fechar</Button>]}
      >
        <Descriptions column={1} bordered style={{ marginTop: 16 }}>
          <Descriptions.Item label="Razão Social">{emitente.nome}</Descriptions.Item>
          <Descriptions.Item label="Nome Fantasia">{emitente.nomeFantasia || '-'}</Descriptions.Item>
          <Descriptions.Item label="CNPJ">{emitente.cnpj}</Descriptions.Item>
          <Descriptions.Item label="Inscrição Estadual">{emitente.ie || '-'}</Descriptions.Item>
          <Descriptions.Item label="Endereço">{`${emitente.logradouro || ''}, ${emitente.numeroEnd || ''}`}</Descriptions.Item>
          <Descriptions.Item label="Bairro">{emitente.bairro || '-'}</Descriptions.Item>
          <Descriptions.Item label="Cidade/UF">{`${emitente.municipio || '-'} / ${emitente.uf || '-'}`}</Descriptions.Item>
        </Descriptions>
      </Modal>

      {/* ================= MODAL: RESUMO FINANCEIRO E LOGÍSTICO ================= */}
      <Modal
        title={<Space><DollarOutlined style={{ color: '#1890ff' }} /><span>Totais e Composição de Valores</span></Space>}
        open={isLogisticsDetailsOpen}
        onCancel={() => setIsLogisticsDetailsOpen(false)}
        width={600}
        footer={[<Button key="close" onClick={() => setIsLogisticsDetailsOpen(false)}>Fechar</Button>]}
      >
        <Title level={5} style={{ marginTop: 16 }}><CarOutlined /> Detalhes de Logística e Frete</Title>
        <Descriptions column={2} bordered size="small" style={{ marginBottom: 20 }}>
          <Descriptions.Item label="Transportador" span={2}>{data?.frete?.transportadora?.nome || "N/A"}</Descriptions.Item>
          <Descriptions.Item label="CNPJ/CPF">{data?.frete?.transportadora?.cnpjCpf || "N/A"}</Descriptions.Item>
          <Descriptions.Item label="Inscrição Estadual">{data?.frete?.transportadora?.ie || "N/A"}</Descriptions.Item>
          <Descriptions.Item label="Peso Bruto Total">{data?.frete?.volumes?.pesoBruto ? `${data.frete.volumes.pesoBruto} kg` : "N/A"}</Descriptions.Item>
          <Descriptions.Item label="Peso Líquido Total">{data?.frete?.volumes?.pesoLiquido ? `${data.frete.volumes.pesoLiquido} kg` : "N/A"}</Descriptions.Item>
        </Descriptions>

        <Title level={5}><DollarOutlined /> Composição de Custos</Title>
        <Descriptions column={1} bordered size="small">
          <Descriptions.Item label="Valor dos Produtos">{formatarMoeda(data?.totais?.valorTotalProdutos ?? data?.valorTotalProdutos)}</Descriptions.Item>
          <Descriptions.Item label="(+) Valor do Frete">{formatarMoeda(data?.totais?.valorTotalFrete ?? data?.valorTotalFrete)}</Descriptions.Item>
          <Descriptions.Item label="(+) Valor do Seguro">{formatarMoeda(data?.totais?.valorTotalSeguro ?? data?.valorTotalSeguro)}</Descriptions.Item>
          <Descriptions.Item label="(+) Outras Despesas">{formatarMoeda(data?.totais?.valorOutrasDespesas ?? data?.valorOutrasDespesas)}</Descriptions.Item>
          <Descriptions.Item label="(-) Desconto Total"><Text type="success">({formatarMoeda(data?.totais?.valorTotalDesconto ?? data?.valorTotalDesconto)})</Text></Descriptions.Item>
          <Descriptions.Item label="ICMS Próprio">{formatarMoeda(data?.totais?.valorTotalIcms ?? data?.valorTotalIcms)}</Descriptions.Item>
          <Descriptions.Item label="ICMS ST">{formatarMoeda(data?.totais?.valorTotalIcmsST ?? data?.valorTotalIcmsST)}</Descriptions.Item>
          <Descriptions.Item label="IPI Comercial">{formatarMoeda(data?.totais?.valorTotalIpi ?? data?.valorTotalIpi)}</Descriptions.Item>
          
          {(data?.totais?.valorTotalIBS ?? data?.valorTotalIBS) !== undefined && (
            <Descriptions.Item label="IBS Total (Reforma)">{formatarMoeda(data?.totais?.valorTotalIBS ?? data?.valorTotalIBS)}</Descriptions.Item>
          )}
          {(data?.totais?.valorTotalCBS ?? data?.valorTotalCBS) !== undefined && (
            <Descriptions.Item label="CBS Total (Reforma)">{formatarMoeda(data?.totais?.valorTotalCBS ?? data?.valorTotalCBS)}</Descriptions.Item>
          )}
          
          <Descriptions.Item label={<Text strong>VALOR LÍQUIDO DA NOTA</Text>}>
            <Text type="primary" strong style={{ fontSize: 16 }}>{formatarMoeda(data?.totais?.valorTotalNf ?? data?.valorTotalNf)}</Text>
          </Descriptions.Item>
        </Descriptions>
      </Modal>
    </div>
  );
};

export default NfeCards;