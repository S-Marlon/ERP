import React, { useEffect, useState } from 'react';
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
  Tooltip,
  Table,
  Divider,
  Alert,
  InputNumber,
  Input,
  Select,
  Statistic
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
  UserOutlined,
  WarningOutlined,
  CheckOutlined,
  EditOutlined
} from '@ant-design/icons';
import { NfeDataFromXML } from '../../utils/nfeParser';

interface NfeCardsProps {
  data: NfeDataFromXML;
  supplierStatus: {
    isChecking: boolean;
    exists: boolean | null;
  };
  actions: {
    onCreateSupplier: () => void;
  };// NOVAS PROPS PARA O PAI ENXERGAR OS DADOS DO FRETE ADICIONAL
  freteAdicionalData?: {
    valor: number;
    metodo: string;
    observacao: string;
  };
  onUpdateFreteAdicional?: (dados: { valor: number; metodo: string; observacao: string }) => void;
  valorTotalFrete: number;
  readOnly?: boolean;
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

const nfStatus = {
  isChecking: false,
  isRegular: false // Força como falso para o alerta aparecer sempre
};

const NfeCards: React.FC<NfeCardsProps> = ({ data, supplierStatus, actions, freteAdicionalData, valorTotalFrete, onUpdateFreteAdicional, readOnly = false }) => {

  const { emitente } = data;
  const [isNfDetailsOpen, setIsNfDetailsOpen] = useState(false);
  const [isSupplierDetailsOpen, setIsSupplierDetailsOpen] = useState(false);
  const [isLogisticsDetailsOpen, setIsLogisticsDetailsOpen] = useState(false);
  const [isDestDetailsOpen, setIsDestDetailsOpen] = useState(false);
  const [isCobrDetailsOpen, setIsCobrDetailsOpen] = useState(false);
  const [isInfAdicDetailsOpen, setIsInfAdicDetailsOpen] = useState(false);

const [isEditingFreteAdicional, setIsEditingFreteAdicional] = useState(false);
const [valorFreteAdicional, setValorFreteAdicional] = useState(freteAdicionalData?.valor || 0);

  const destinatario = (data as any).destinatario || {};
  const cobranca = (data as any).cobranca || { fatura: {}, duplicatas: [] };
  const infAdic = (data as any).informacoesAdicionais || { infCpl: 'Nenhuma informação complementar informada.', infAdFisco: 'Sem observações do fisco.' };

  const primeiroVolume = data?.transp?.vol?.[0];

  
  // Valores locais que serão sincronizados ou enviados ao pai
  const [metodoFreteAdicional, setMetodoFreteAdicional] = useState(freteAdicionalData?.metodo || 'Correios');
  const [obsFreteAdicional, setObsFreteAdicional] = useState(freteAdicionalData?.observacao || '');

  // Acompanha o valor do pai (ex.: frete restaurado ao retomar um lote), exceto durante a edição
  useEffect(() => {
    if (isEditingFreteAdicional || !freteAdicionalData) return;
    setValorFreteAdicional(freteAdicionalData.valor || 0);
    setMetodoFreteAdicional(freteAdicionalData.metodo || 'Correios');
    setObsFreteAdicional(freteAdicionalData.observacao || '');
  }, [freteAdicionalData, isEditingFreteAdicional]);



  const handleSalvarFreteAdicional = () => {
    setIsEditingFreteAdicional(false);
    // Notifica o componente pai com os novos dados estruturados
    if (onUpdateFreteAdicional) {
      onUpdateFreteAdicional({
        valor: valorFreteAdicional,
        metodo: metodoFreteAdicional,
        observacao: obsFreteAdicional
      });
    }
  };


  // Lógica de estilo dinâmico para o Card do Fornecedor baseada no status
  const getSupplierCardStyle = () => {
    if (supplierStatus.exists === false) {
      return {
        height: '100%',
        border: '1px solid #ff4d4f',
        backgroundColor: '#fff1f0', // Fundo avermelhado bem sutil
      };
    }
    if (supplierStatus.exists === true) {
      return {
        height: '100%',
        border: '1px solid #b7eb8f',
        backgroundColor: '#f6ffed', // Fundo esverdeado bem sutil
      };
    }
    return { height: '100%' };
  };

  return (
    <div>
     

      <Row gutter={[6, 6]}>
        {/* CARD 1: Identificação da NF */}
        {/* CARD 1: Identificação da NF */}
<Col xs={24} md={8}>
  <Card 
    title={<Space><FileTextOutlined /><span>1. Identificação da NF</span></Space>}
    size="small"
    style={{ 
      height: '100%', 
      // Exemplo de destaque visual se a NF não estiver autorizada (ajuste a variável de condição conforme seu código)
      ...(nfStatus?.isRegular === false ? { borderColor: '#ff4d4f', backgroundColor: '#fff2f0' } : {}) 
    }}
    extra={
      <Space>
        {nfStatus?.isChecking && <Badge status="processing" text="Verificando Sefaz..." />}
        {nfStatus?.isRegular === true && <Badge status="success" text="Autorizada" />}
        {nfStatus?.isRegular === false && <Badge status="error" text="Irregular / Cancelada" />}
        <Tooltip title="Ver detalhes técnicos da nota">
          <Button type="text" icon={<InfoCircleOutlined />} onClick={() => setIsNfDetailsOpen(true)} />
        </Tooltip>
      </Space>
    }
  >
    {/* Alerta Fiscal / Sefaz integrado no Card 1 */}
    {nfStatus?.isRegular === false && (
      <Alert
        message="Alerta Fiscal / Sefaz"
        description="A NF-e não consta como autorizada, foi cancelada ou possui irregularidades na Sefaz."
        type="error"
        showIcon
        icon={<WarningOutlined />}
        style={{ marginBottom: 8, padding: '4px 8px', fontSize: 11 }}
      />
    )}

    <div style={{ background: '#fafafa', padding: '2px 4px', borderRadius: '4px' }}>
      <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>Chave de Acesso</Text>
      <Text copyable style={{ fontSize: 14, fontFamily: 'monospace' }}>
        {data.chaveAcesso ? data.chaveAcesso.replace(/(\d{4})(?=\d)/g, '$1 ') : ''}
      </Text>
    </div>
    
    <Descriptions column={3} layout="horizontal" size="small" bordered style={{ marginBottom: 8, marginTop: 8 }}>
      <Descriptions.Item label="Número" style={{ fontSize: 12, fontFamily: 'monospace' }}>{data.numero}</Descriptions.Item>
      <Descriptions.Item label="Série" style={{ fontSize: 13, fontFamily: 'monospace' }}>{data.serie}</Descriptions.Item>
      <Descriptions.Item label="Formato da NF" style={{ fontSize: 12, fontFamily: 'monospace' }}>{data.mo}</Descriptions.Item>
      <Descriptions.Item label="Emissão" style={{ fontSize: 12, fontFamily: 'monospace' }}>{formatarDataBR(data.dataEmissao)}</Descriptions.Item>
    </Descriptions>
  </Card>
</Col>


        {/* CARD 2: Fornecedor (Emitente) com Alerta Visual */}
        <Col xs={24} md={8}>
          <Card 
            title={
              <Space>
                <ShopOutlined />
                <span>2. Fornecedor (Emitente)</span>
              </Space>
            }
            size="small"
            style={getSupplierCardStyle()}
            extra={
              <Space>
                {supplierStatus.isChecking && <Badge status="processing" text="Verificando..." />}
                {supplierStatus.exists === true && <Badge status="success" text="Cadastrado" />}
                {supplierStatus.exists === false && (
                  <Space size={4}>
                    <Badge status="error" text="Não Cadastrado" />
                    <Button type="primary" danger size="small" icon={<PlusOutlined />} onClick={actions.onCreateSupplier}>
                      Cadastrar
                    </Button>
                  </Space>
                )}
                <Tooltip title="Ver dados do fornecedor">
                  <Button type="text" icon={<InfoCircleOutlined />} onClick={() => setIsSupplierDetailsOpen(true)} />
                </Tooltip>
              </Space>
            }
          >
            {supplierStatus.exists === false && (
              <Alert
                message="Fornecedor ausente no sistema!"
                description="Cadastre-o antes de prosseguir com a entrada."
                type="error"
                showIcon
                icon={<WarningOutlined />}
                style={{ marginBottom: 8, padding: '4px 8px', fontSize: 11 }}
              />
            )}

            <Descriptions column={1} layout="horizontal" size="small" bordered>
              <Descriptions.Item label="CNPJ">
  {emitente?.cnpj 
    ? emitente.cnpj.replace(/\D/g, '').replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5') 
    : '-'}
</Descriptions.Item>
              <Descriptions.Item label="Fantasia" labelStyle={{ whiteSpace: 'nowrap' }}>
                <Text ellipsis >{emitente.nomeFantasia || "Não Informado"}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Razão Social">
                <Text ellipsis>{emitente.nome}</Text>
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
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="Transportadora">
                <Tooltip title={data?.transp?.transporta?.xNome || "Não Informada"}>
                  <Text ellipsis style={{ maxWidth: 260, display: 'inline-block' }}>
                    {data?.transp?.transporta?.xNome || "Não Informada"}
                  </Text>
                </Tooltip>
              </Descriptions.Item>
              <Descriptions.Item label="Modalidade">
                {traduzirModalidadeFrete(data?.transp?.modFrete)}
              </Descriptions.Item>
              <Descriptions.Item label="Volumes / Peso">
                {`${primeiroVolume?.qVol ?? 0} vol(s) | ${primeiroVolume?.pesoB ? `${primeiroVolume.pesoB} kg` : 'Peso não inf.'}`}
              </Descriptions.Item>
              
           
            </Descriptions>
            

            <Descriptions column={3} layout="vertical" size="small" bordered style={{ marginBottom: 8, marginTop: 8 }}>
               {/* Valor do Frete original (Nota Fiscal) */}
              <Descriptions.Item label="Valor Frete (NF)">
                <Text>
                  {Number(data?.totais?.vFrete || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </Text>
                
              </Descriptions.Item>

             
                

              {/* Frete Adicional com Detalhamento e Edição */}
              <Descriptions.Item 
  label={
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', gap: 8 }}>
      <span>Frete Adicional</span>
      {!isEditingFreteAdicional && !readOnly && (
        <Button 
          type="text" 
          size="small" 
          icon={<EditOutlined />} 
          onClick={() => setIsEditingFreteAdicional(true)} 
          title="Editar frete pago à parte"
          style={{ padding: 0, height: 'auto' }}
        />
      )}
    </div>
  }
>
                <div style={{ width: '100%' }}>
                  {isEditingFreteAdicional ? (
                    <Space direction="vertical" size="small" style={{ width: '100%', padding: '4px 0' }}>
                      <InputNumber
                        size="small"
                        value={valorFreteAdicional}
                        onChange={(val) => setValorFreteAdicional(val || 0)}
                        formatter={(value) => `R$ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}
                        parser={(value) => value.replace(/\R\$\s?|\./g, '').replace(',', '.')}
                        style={{ width: '100%' }}
                        placeholder="Valor R$"
                      />
                      <Select
                        size="small"
                        value={metodoFreteAdicional}
                        onChange={(val) => setMetodoFreteAdicional(val)}
                        style={{ width: '100%' }}
                        options={[
                          { value: 'Correios - PAC', label: 'Correios - PAC' },
                          { value: 'Correios - SEDEX', label: 'Correios - SEDEX' },
                          { value: 'Carreto / Moto-boy', label: 'Carreto / Moto-boy' },
                          { value: 'Transportadora Direto', label: 'Transportadora Direto' },
                          { value: 'Outros', label: 'Outros' }
                        ]}
                      />
                      <Input
                        size="small"
                        placeholder="Obs / Código de Rastreio"
                        value={obsFreteAdicional}
                        onChange={(e) => setObsFreteAdicional(e.target.value)}
                      />
                      <Button 
                        type="primary" 
                        size="small" 
                        icon={<CheckOutlined />} 
                        onClick={handleSalvarFreteAdicional}
                        block
                      >
                        Salvar Frete Adicional
                      </Button>
                    </Space>
                  ) : (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%' }}>
                      <div>
                        <Text strong type={valorFreteAdicional > 0 ? "warning" : "secondary"} style={{ display: 'block' }}>
                          {Number(valorFreteAdicional || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </Text>
                        {valorFreteAdicional > 0 && (
                          <div style={{ fontSize: 11, color: '#8c8c8c', marginTop: 2 }}>
                            <div><strong>Método:</strong> {metodoFreteAdicional}</div>
                            {obsFreteAdicional && <div><strong>Obs:</strong> {obsFreteAdicional}</div>}
                          </div>
                        )}
                      </div>
                      
                    </div>
                  )}
                </div>
              </Descriptions.Item>




               <Descriptions.Item label="Valor Total do Frete">
             
                

       <Text>
                  {Number(valorTotalFrete || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </Text>

              </Descriptions.Item>






            </Descriptions>
          </Card>
        </Col>
      </Row>

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
          <Descriptions.Item style={{background: 'red'}} label="Modelo (mod)">55 (NF-e)**</Descriptions.Item>
          <Descriptions.Item label="Série (serie)">{data.serie || '-'}</Descriptions.Item>
          <Descriptions.Item label="Número da NF (nNF)">{data.numero}</Descriptions.Item>
          <Descriptions.Item label="Código da UF (cUF)">{data.chaveAcesso ? data.chaveAcesso.substring(0, 2) : '-'}</Descriptions.Item>
          <Descriptions.Item label="Data/Hora Emissão (dhEmi)" span={2}>{formatarDataBR(data.dataEmissao)}</Descriptions.Item>
          <Descriptions.Item label="Natureza da Operação (natOp)" span={2}>{data.naturezaOperacao || 'Venda de Mercadoria'}</Descriptions.Item>
          <Descriptions.Item label="Tipo de Operação (tpNF)">{traduzirTipoOperacao(data.tipoOperacao)}</Descriptions.Item>
          <Descriptions.Item label="Destino da Operação (idDest)">{traduzirDestinoOperacao(data.destinoOperacao)}</Descriptions.Item>
          <Descriptions.Item label="Finalidade (finNFe)">{traduzirFinalidade(data.finalidade)}</Descriptions.Item>
          <Descriptions.Item label="Presença do Comprador (indPres)">{traduzirPresencaComprador(data.presencaComprador)}</Descriptions.Item>
          <Descriptions.Item style={{background: 'red'}} label="Tipo de Emissão (tpEmis)">1 - Emissão normal</Descriptions.Item>
          <Descriptions.Item style={{background: 'red'}}  label="Processo de Emissão (procEmi)">0 - Emissão de NF-e com aplicativo do contribuinte</Descriptions.Item>
          <Descriptions.Item style={{background: 'red'}}  label="Status SEFAZ" span={2}><Text type="success" strong>100 - Autorizado o uso da NF-e</Text></Descriptions.Item>
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
      <Modal
        title="🎯 Dados do Destinatário da Nota (Grupo <dest>)"
        open={isDestDetailsOpen}
        onCancel={() => setIsDestDetailsOpen(false)}
        footer={[<Button key="close" onClick={() => setIsDestDetailsOpen(false)}>Fechar</Button>]}
      >
        <Descriptions column={1} bordered style={{ marginTop: 16 }} size="small">
          <Descriptions.Item label="Razão Social">{destinatario.xNome || destinatario.nome || 'Não Informado'}</Descriptions.Item>
          <Descriptions.Item label="CNPJ / CPF">
            {destinatario.cnpjOrCpfOrEstrangeiro || destinatario.CNPJ || destinatario.CPF || '-'}
          </Descriptions.Item>
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
            rowKey={(_: any, index?: number) => index?.toString() || '0'}
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