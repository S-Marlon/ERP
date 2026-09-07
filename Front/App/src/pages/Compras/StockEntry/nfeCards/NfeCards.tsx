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
  Tooltip,
  Table,
  Divider
} from 'antd';
import { 
  InfoCircleOutlined, 
  PlusOutlined, 
  CarOutlined, 
  ShopOutlined, 
  FileTextOutlined,
  DollarOutlined,
  CreditCardOutlined,
  CommentOutlined,
  UserOutlined
} from '@ant-design/icons';
import { NfeDataFromXML } from './utils/nfeParser';

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
  return chave ? chave.replace(/(.{4})/g, '$1 ').trim() : '-';
};

const formatarMoeda = (valor?: number | string) => {
  const num = typeof valor === 'string' ? parseFloat(valor) : valor;
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num || 0);
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

const traduzirTipoOperacao = (tpNF?: string) => {
  if (tpNF === '0') return '0 - Entrada';
  if (tpNF === '1') return '1 - Saída';
  return tpNF || '-';
};

const traduzirDestinoOperacao = (idDest?: string) => {
  switch (idDest) {
    case '1': return '1 - Operação interna';
    case '2': return '2 - Operação interestadual';
    case '3': return '3 - Operação com exterior';
    default: return idDest || '-';
  }
};

const traduzirFinalidade = (finNFe?: string) => {
  switch (finNFe) {
    case '1': return '1 - NF-e normal';
    case '2': return '2 - NF-e complementar';
    case '3': return '3 - NF-e de ajuste';
    case '4': return '4 - Devolução de mercadoria';
    default: return finNFe || '-';
  }
};

const traduzirPresencaComprador = (indPres?: string) => {
  switch (indPres) {
    case '0': return '0 - Não se aplica';
    case '1': return '1 - Operação presencial';
    case '2': return '2 - Internet';
    case '3': return '3 - Teleatendimento';
    case '4': return '4 - NFC-e em entrega em domicílio';
    case '5': return '5 - Operação presencial fora do estabelecimento';
    case '9': return '9 - Outros';
    default: return indPres || '-';
  }
};

const NfeCards: React.FC<NfeCardsProps> = ({ data, supplierStatus, actions }) => {
  const { emitente } = data;

  const [isNfDetailsOpen, setIsNfDetailsOpen] = useState(false);
  const [isSupplierDetailsOpen, setIsSupplierDetailsOpen] = useState(false);
  const [isLogisticsDetailsOpen, setIsLogisticsDetailsOpen] = useState(false);
  const [isDestDetailsOpen, setIsDestDetailsOpen] = useState(false);
  const [isCobrDetailsOpen, setIsCobrDetailsOpen] = useState(false);
  const [isInfAdicDetailsOpen, setIsInfAdicDetailsOpen] = useState(false);

  const destinatario = (data as any).destinatario || {};
  const cobranca = (data as any).cobranca || { fatura: {}, duplicatas: [] };
  const infAdic = (data as any).informacoesAdicionais || { infCpl: 'Nenhuma informação complementar informada.', infAdFisco: 'Sem observações do fisco.' };

  const primeiroVolume = data?.transp?.vol?.[0];

  return (
    <div>
      {/* Atalhos Rápidos para Novas Seções */}
      <Row gutter={[16, 16]}>
        <Col span={24}>
          <Card size="small" style={{ background: '#fcfcfc', border: '1px dashed #d9d9d9' }}>
            <Space size="large" wrap>
              <Text strong type="secondary">Blocos Adicionais da NF-e:</Text>
              <Button size="small" icon={<UserOutlined />} onClick={() => setIsDestDetailsOpen(true)}>
                Ver Destinatário ({destinatario.cnpj || 'Destino'})
              </Button>
              <Button size="small" icon={<CreditCardOutlined />} onClick={() => setIsCobrDetailsOpen(true)}>
                Cobrança / Duplicatas ({cobranca.duplicatas?.length || 0} parcelas)
              </Button>
              <Button size="small" icon={<CommentOutlined />} onClick={() => setIsInfAdicDetailsOpen(true)}>
                Informações Adicionais / Fisco
              </Button>
            </Space>
          </Card>
        </Col>
      </Row>

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
            <div style={{ background: '#fafafa', padding: '4px 8px', borderRadius: '4px', }}>
              <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>Chave de Acesso</Text>
              <Text copyable style={{ fontSize: 16, fontFamily: 'monospace' }}>{data.chaveAcesso}</Text>
            </div>
            <Descriptions column={3} layout="horizontal" size="small" bordered style={{ marginBottom: 8 }}>
              <Descriptions.Item label="Número" style={{ fontSize: 12, fontFamily: 'monospace' }}>{data.numero}</Descriptions.Item>
              <Descriptions.Item label="Série" style={{ fontSize: 13, fontFamily: 'monospace' }}>{data.serie}</Descriptions.Item>
              <Descriptions.Item label="Emissão" style={{ fontSize: 12, fontFamily: 'monospace' }}>{formatarDataBR(data.dataEmissao)}</Descriptions.Item>
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
            title={<Space><CarOutlined /><span>3. Logística e Frete</span></Space>}
            size="small"
            style={{ height: '100%' }}
            extra={
              <Tooltip title="Ver composição e tributos">
                <Button type="text" icon={<InfoCircleOutlined />} onClick={() => setIsLogisticsDetailsOpen(true)} />
              </Tooltip>
            }
          >
            <Descriptions column={1} size="small" bordered >
              <Descriptions.Item label="Transportadora">
                <Text ellipsis style={{ maxWidth: 180, display: 'inline-block' }}>
                  {data?.transp?.transporta?.xNome || "Não Informada"}
                </Text>
              </Descriptions.Item>
              <Descriptions.Item label="Modalidade">
                {traduzirModalidadeFrete(data?.transp?.modFrete)}
              </Descriptions.Item>
              <Descriptions.Item label="Volumes / Peso">
                {`${primeiroVolume?.qVol ?? 0} vol(s) | ${primeiroVolume?.pesoB ? `${primeiroVolume.pesoB} kg` : 'Peso não inf.'}`}
              </Descriptions.Item>
            </Descriptions>


            {/* <Row gutter={8}>
              <Col span={12}>
                <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 2 }}>Valor do Frete (R$)</Text>
                <InputNumber 
                  style={{ width: '100%' }} 
                  placeholder="0,00" 
                  min={0} 
                  size="small" 
                  stringMode 
                  value={(data as any)?.totais?.vFrete || data?.transp?.retTransp?.vServ || '0'} 
                />
              </Col>
              <Col span={12}>
                <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 2 }}>Método de Rateio</Text>
                <Select defaultValue="VALOR" style={{ width: '100%' }} size="small">
                  <Select.Option value="VALOR">Proporcional por Valor</Select.Option>
                  <Select.Option value="PESO">Proporcional por Peso</Select.Option>
                  <Select.Option value="IGUAL">Divisão Igualitária</Select.Option>
                  <Select.Option value="MANUAL">Digitação Manual</Select.Option>
                </Select>
              </Col>
            </Row> */}
          </Card>
        </Col>
      </Row>

      {/* MODAL 1: Identificação */}
      <Modal
        title="📄 Detalhes Técnicos e Identificação da NF-e (Grupo <ide>)"
        open={isNfDetailsOpen}
        onCancel={() => setIsNfDetailsOpen(false)}
        width={700}
        footer={[<Button key="close" onClick={() => setIsNfDetailsOpen(false)}>Fechar</Button>]}
      >
        <Descriptions column={2} bordered size="small" style={{ marginTop: 16 }}>
          <Descriptions.Item label="Chave de Acesso" span={2}>
            <Text style={{ fontFamily: 'monospace', fontSize: 12 }}>{formatarChaveAcesso(data.chaveAcesso)}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="Modelo (mod)">55 (NF-e)</Descriptions.Item>
          <Descriptions.Item label="Série (serie)">{data.serie || '-'}</Descriptions.Item>
          <Descriptions.Item label="Número da NF (nNF)">{data.numero}</Descriptions.Item>
          <Descriptions.Item label="Código da UF (cUF)">{data.chaveAcesso ? data.chaveAcesso.substring(0, 2) : '-'}</Descriptions.Item>
          <Descriptions.Item label="Data/Hora Emissão (dhEmi)" span={2}>{formatarDataBR(data.dataEmissao)}</Descriptions.Item>
          <Descriptions.Item label="Natureza da Operação (natOp)" span={2}>{data.naturezaOperacao || 'Venda de Mercadoria'}</Descriptions.Item>
          <Descriptions.Item label="Tipo de Operação (tpNF)">{traduzirTipoOperacao(data.tipoOperacao)}</Descriptions.Item>
          <Descriptions.Item label="Destino da Operação (idDest)">{traduzirDestinoOperacao(data.destinoOperacao)}</Descriptions.Item>
          <Descriptions.Item label="Finalidade (finNFe)">{traduzirFinalidade(data.finalidade)}</Descriptions.Item>
          <Descriptions.Item label="Presença do Comprador (indPres)">{traduzirPresencaComprador(data.presencaComprador)}</Descriptions.Item>
          <Descriptions.Item label="Tipo de Emissão (tpEmis)">1 - Emissão normal</Descriptions.Item>
          <Descriptions.Item label="Processo de Emissão (procEmi)">0 - Emissão de NF-e com aplicativo do contribuinte</Descriptions.Item>
          <Descriptions.Item label="Status SEFAZ" span={2}><Text type="success" strong>100 - Autorizado o uso da NF-e</Text></Descriptions.Item>
        </Descriptions>
      </Modal>

      {/* MODAL 2: Fornecedor */}
      <Modal
        title="🏢 Ficha Completa do Fornecedor / Emitente (<emit>)"
        open={isSupplierDetailsOpen}
        onCancel={() => setIsSupplierDetailsOpen(false)}
        width={750}
        footer={[<Button key="close" type="primary" onClick={() => setIsSupplierDetailsOpen(false)}>Fechar</Button>]}
      >
        <div style={{ maxHeight: '65vh', overflowY: 'auto', paddingRight: 4 }}>
          <Divider orientation="left" style={{ margin: '12px 0 8px 0', fontSize: 13 }}>Identificação Cadastral</Divider>
          <Descriptions column={2} bordered size="small">
            <Descriptions.Item label="Razão Social" span={2}>{emitente.nome || '-'}</Descriptions.Item>
            <Descriptions.Item label="Nome Fantasia" span={2}>{emitente.nomeFantasia || '-'}</Descriptions.Item>
            <Descriptions.Item label="CNPJ / CPF">{emitente.cnpj || '-'}</Descriptions.Item>
            <Descriptions.Item label="Inscrição Estadual (IE)">{emitente.ie || '-'}</Descriptions.Item>
            <Descriptions.Item label="IE Substituto Tributário">{emitente.iest || '-'}</Descriptions.Item>
            <Descriptions.Item label="Inscrição Municipal (IM)">{emitente.im || '-'}</Descriptions.Item>
            <Descriptions.Item label="Código de Regime (CRT)">{emitente.crt || '-'}</Descriptions.Item>
            <Descriptions.Item label="CNAE Fiscal">{emitente.cnae || '-'}</Descriptions.Item>
          </Descriptions>

          <Divider orientation="left" style={{ margin: '16px 0 8px 0', fontSize: 13 }}>Endereço do Estabelecimento Emitente (enderEmit)</Divider>
          <Descriptions column={2} bordered size="small">
            <Descriptions.Item label="Logradouro">{emitente.logradouro || '-'}</Descriptions.Item>
            <Descriptions.Item label="Número">{emitente.numeroEnd || '-'}</Descriptions.Item>
            <Descriptions.Item label="Complemento">{emitente.complemento || '-'}</Descriptions.Item>
            <Descriptions.Item label="Bairro">{emitente.bairro || '-'}</Descriptions.Item>
            <Descriptions.Item label="Município">{`${emitente.municipio || '-'} (${emitente.cMun || 'Cód. IBGE ausente'})`}</Descriptions.Item>
            <Descriptions.Item label="UF">{emitente.uf || '-'}</Descriptions.Item>
            <Descriptions.Item label="CEP">{emitente.cep || '-'}</Descriptions.Item>
            <Descriptions.Item label="País">{`${emitente.xPais || 'Brasil'} (Código: ${emitente.cPais || '1058'})`}</Descriptions.Item>
            <Descriptions.Item label="Telefone de Contato" span={2}>{emitente.fone || '-'}</Descriptions.Item>
          </Descriptions>
        </div>
      </Modal>

      {/* MODAL 3: Logística e Totais */}
      <Modal
        title={<Space><DollarOutlined style={{ color: '#1890ff' }} /><span>Totais e Composição de Valores</span></Space>}
        open={isLogisticsDetailsOpen}
        onCancel={() => setIsLogisticsDetailsOpen(false)}
        width={600}
        footer={[<Button key="close" onClick={() => setIsLogisticsDetailsOpen(false)}>Fechar</Button>]}
      >
        <Title level={5} style={{ marginTop: 16 }}><CarOutlined /> Detalhes de Logística e Frete</Title>
        <Descriptions column={2} bordered size="small" style={{ marginBottom: 20 }}>
          <Descriptions.Item label="Transportador" span={2}>{data?.transp?.transporta?.xNome || "N/A"}</Descriptions.Item>
          <Descriptions.Item label="CNPJ/CPF">{data?.transp?.transporta?.cnpjOrCpf || "N/A"}</Descriptions.Item>
          <Descriptions.Item label="Inscrição Estadual">{data?.transp?.transporta?.ie || "N/A"}</Descriptions.Item>
          <Descriptions.Item label="Peso Bruto Total">{primeiroVolume?.pesoB ? `${primeiroVolume.pesoB} kg` : "N/A"}</Descriptions.Item>
          <Descriptions.Item label="Peso Líquido Total">{primeiroVolume?.pesoL ? `${primeiroVolume.pesoL} kg` : "N/A"}</Descriptions.Item>
        </Descriptions>
      </Modal>

      {/* MODAL 4: Destinatário */}
      {/* MODAL 4: Destinatário */}
     {/* MODAL 4: Destinatário */}
      <Modal
        title="🎯 Dados do Destinatário da Nota (Grupo <dest>)"
        open={isDestDetailsOpen}
        onCancel={() => setIsDestDetailsOpen(false)}
        footer={[<Button key="close" onClick={() => setIsDestDetailsOpen(false)}>Fechar</Button>]}
      >
        <Descriptions column={1} bordered style={{ marginTop: 16 }} size="small">
          <Descriptions.Item label="Razão Social">{destinatario.xNome || destinatario.nome || 'Não Informado'}</Descriptions.Item>
     <Descriptions.Item label="CNPJ / CPF">
<Descriptions.Item label="CNPJ / CPF">
  {destinatario.cnpjOrCpfOrEstrangeiro || destinatario.CNPJ || destinatario.CPF || '-'}
</Descriptions.Item></Descriptions.Item>
          <Descriptions.Item label="Inscrição Estadual">{destinatario.IE || destinatario.ie || '-'}</Descriptions.Item>
          <Descriptions.Item label="Endereço">
            {`${destinatario.enderDest?.xLgr || destinatario.logradouro || ''}, ${destinatario.enderDest?.nro || destinatario.numeroEnd || ''}`}
          </Descriptions.Item>
          <Descriptions.Item label="Bairro">{destinatario.enderDest?.xBairro || destinatario.bairro || '-'}</Descriptions.Item>
          <Descriptions.Item label="Cidade / UF">
            {`${destinatario.enderDest?.xMun || destinatario.municipio || '-'} / ${destinatario.enderDest?.UF || destinatario.enderDest?.uf || destinatario.uf || '-'}`}
          </Descriptions.Item>
          <Descriptions.Item label="CEP">
            {destinatario.enderDest?.CEP || destinatario.enderDest?.cep || destinatario.cep || '-'}
          </Descriptions.Item>
        </Descriptions>
      </Modal>

      {/* MODAL 5: Cobrança e Duplicatas */}
    {/* MODAL 5: Cobrança e Duplicatas */}
      <Modal
        title="💳 Cobrança, Fatura e Duplicatas (Grupo <cobr>)"
        open={isCobrDetailsOpen}
        onCancel={() => setIsCobrDetailsOpen(false)}
        width={650}
        footer={[<Button key="close" onClick={() => setIsCobrDetailsOpen(false)}>Fechar</Button>]}
      >
        <div style={{ marginTop: 16 }}>
          <Title level={5}>Dados da Fatura</Title>
          <Descriptions column={3} bordered size="small" style={{ marginBottom: 16 }}>
            <Descriptions.Item label="Número">{cobranca.fat?.nFat || cobranca.fatura?.numero || '-'}</Descriptions.Item>
            <Descriptions.Item label="Valor Original">{formatarMoeda(cobranca.fat?.vOrig || cobranca.fatura?.valorOriginal)}</Descriptions.Item>
            <Descriptions.Item label="Valor Líquido">{formatarMoeda(cobranca.fat?.vLiq || cobranca.fatura?.valorLiquido)}</Descriptions.Item>
          </Descriptions>

          <Title level={5}>Parcelas / Duplicatas</Title>
          <Table
            dataSource={cobranca.dup || cobranca.duplicatas || []}
            rowKey={(record: any, index) => index.toString()}
            pagination={false}
            size="small"
            bordered
            columns={[
              { title: 'Parcela', dataIndex: 'nDup', key: 'nDup', render: (v: string, _: any, index: number) => v || `Parcela ${index + 1}` },
              { title: 'Vencimento', dataIndex: 'dVenc', key: 'dVenc', render: (v: string) => formatarDataBR(v) },
              { title: 'Valor (R$)', dataIndex: 'vDup', key: 'vDup', render: (v: number) => formatarMoeda(v) }
            ]}
          />
        </div>
      </Modal>

      {/* MODAL 6: Informações Adicionais */}
      <Modal
        title="💬 Informações Adicionais e Observações (Grupo <infAdic>)"
        open={isInfAdicDetailsOpen}
        onCancel={() => setIsInfAdicDetailsOpen(false)}
        width={600}
        footer={[<Button key="close" onClick={() => setIsInfAdicDetailsOpen(false)}>Fechar</Button>]}
      >
        <div style={{ marginTop: 16 }}>
          <Title level={5}>Informações Complementares de Interesse do Contribuinte</Title>
          <div style={{ background: '#f5f5f5', padding: 12, borderRadius: 4, border: '1px solid #d9d9d9', minHeight: 80, whiteSpace: 'pre-wrap' }}>
            <Text>{infAdic.infCpl}</Text>
          </div>

          <Divider style={{ margin: '16px 0' }} />

          <Title level={5}>Informações Adicionais de Interesse do Fisco</Title>
          <div style={{ background: '#f5f5f5', padding: 12, borderRadius: 4, border: '1px solid #d9d9d9', minHeight: 50, whiteSpace: 'pre-wrap' }}>
            <Text>{infAdic.infAdFisco}</Text>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default NfeCards;