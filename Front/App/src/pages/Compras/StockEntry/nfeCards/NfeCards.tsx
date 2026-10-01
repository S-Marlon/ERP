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
  Select
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
  EditOutlined
} from '@ant-design/icons';
import { NfeDataFromXML } from '../xml/utils/nfeParser';
import { situacaoDoProtocolo, traduzirAmbiente, traduzirModelo, traduzirProcessoEmissao, traduzirTipoEmissao } from '../xml/utils/10-protocoloParser';

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


  const formatarCnpj = (v?: string) => {
    const d = String(v || '').replace(/\D/g, '');
    if (d.length === 14) return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
    if (d.length === 11) return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
    return v || '-';
  };
  const moeda = (v?: number | string) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  // Linha "rótulo: valor" compacta (no lugar das tabelas com borda)
  const Campo: React.FC<{ rotulo: string; children: React.ReactNode; title?: string }> = ({ rotulo, children, title }) => (
    <div style={{ display: 'flex', gap: 6, fontSize: 12, lineHeight: '20px', minWidth: 0 }}>
      <span style={{ color: '#8c8c8c', whiteSpace: 'nowrap' }}>{rotulo}</span>
      <span title={title} style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{children}</span>
    </div>
  );

  const cardStyle: React.CSSProperties = { height: '100%' };
  const cardBody = { padding: '8px 12px' };
  const tituloCard = (icone: React.ReactNode, texto: string) => (
    <Space size={6} style={{ fontSize: 13 }}>{icone}<span>{texto}</span></Space>
  );

  const fornecedorBorda = supplierStatus.exists === false ? '#ff4d4f' : supplierStatus.exists === true ? '#b7eb8f' : undefined;
  const situacaoNf = situacaoDoProtocolo(data.protocolo);
  const homologacao = (data.protocolo?.tpAmb || data.ide?.tpAmb) === '2';

  return (
    <div>
      <Row gutter={[8, 8]}>
        {/* 1. Identificação da NF */}
        <Col xs={24} lg={8}>
          <Card
            size="small"
            style={{ ...cardStyle, borderColor: situacaoNf === 'AUTORIZADA' ? undefined : '#ff4d4f' }}
            bodyStyle={cardBody}
            title={tituloCard(<FileTextOutlined />, `NF-e ${data.numero || ''}`)}
            extra={
              <Space size={4}>
                {situacaoNf === 'AUTORIZADA' && (
                  <Tooltip title={`Protocolo ${data.protocolo?.nProt} · ${data.protocolo?.xMotivo}. Cancelamento posterior só aparece consultando a SEFAZ.`}>
                    <Badge status="success" text={<span style={{ fontSize: 12 }}>Autorizada</span>} />
                  </Tooltip>
                )}
                {situacaoNf === 'SEM_PROTOCOLO' && <Tooltip title="O XML não traz o protocolo de autorização (<protNFe>)."><Badge status="warning" text={<span style={{ fontSize: 12 }}>Sem protocolo</span>} /></Tooltip>}
                {situacaoNf === 'NAO_AUTORIZADA' && <Tooltip title={data.protocolo?.xMotivo}><Badge status="error" text={<span style={{ fontSize: 12 }}>{data.protocolo?.cStat} - não autorizada</span>} /></Tooltip>}
                <Tooltip title="Detalhes técnicos da nota">
                  <Button type="text" size="small" icon={<InfoCircleOutlined />} onClick={() => setIsNfDetailsOpen(true)} />
                </Tooltip>
              </Space>
            }
          >
            {homologacao && (
              <Alert type="warning" showIcon message="NF-e de homologação: sem valor fiscal" style={{ padding: '2px 8px', marginBottom: 6, fontSize: 12 }} />
            )}
            <Text copyable={{ text: data.chaveAcesso }} style={{ fontSize: 12, fontFamily: 'monospace', display: 'block', marginBottom: 4 }}>
              {formatarChaveAcesso(data.chaveAcesso)}
            </Text>
            <Row gutter={12}>
              <Col span={12}><Campo rotulo="Série">{data.serie || '-'}</Campo></Col>
              <Col span={12}><Campo rotulo="Modelo">{traduzirModelo(data.ide?.mod)}</Campo></Col>
              <Col span={12}><Campo rotulo="Emissão">{formatarDataBR(data.dataEmissao)}</Campo></Col>
              <Col span={12}><Campo rotulo="Natureza" title={data.naturezaOperacao}>{data.naturezaOperacao || '-'}</Campo></Col>
            </Row>
          </Card>
        </Col>

        {/* 2. Fornecedor (emitente) */}
        <Col xs={24} lg={8}>
          <Card
            size="small"
            style={{ ...cardStyle, borderColor: fornecedorBorda, background: supplierStatus.exists === false ? '#fff1f0' : undefined }}
            bodyStyle={cardBody}
            title={tituloCard(<ShopOutlined />, 'Fornecedor')}
            extra={
              <Space size={4}>
                {supplierStatus.isChecking && <Badge status="processing" text={<span style={{ fontSize: 12 }}>Verificando...</span>} />}
                {supplierStatus.exists === true && <Badge status="success" text={<span style={{ fontSize: 12 }}>Cadastrado</span>} />}
                {supplierStatus.exists === false && (
                  <Button type="primary" danger size="small" icon={<PlusOutlined />} onClick={actions.onCreateSupplier}>Cadastrar</Button>
                )}
                <Tooltip title="Ficha completa do fornecedor">
                  <Button type="text" size="small" icon={<InfoCircleOutlined />} onClick={() => setIsSupplierDetailsOpen(true)} />
                </Tooltip>
              </Space>
            }
          >
            <Tooltip title={emitente.nome}>
              <Text strong ellipsis style={{ display: 'block', fontSize: 13 }}>{emitente.nome || '-'}</Text>
            </Tooltip>
            {emitente.nomeFantasia && emitente.nomeFantasia !== emitente.nome && (
              <Text type="secondary" ellipsis style={{ display: 'block', fontSize: 12 }}>{emitente.nomeFantasia}</Text>
            )}
            <Row gutter={12} style={{ marginTop: 2 }}>
              <Col span={13}><Campo rotulo="CNPJ">{formatarCnpj(emitente.cnpj)}</Campo></Col>
              <Col span={11}><Campo rotulo="IE">{emitente.ie || 'Isento'}</Campo></Col>
              <Col span={13}><Campo rotulo="Cidade" title={`${emitente.municipio || '-'} / ${emitente.uf || '-'}`}>{`${emitente.municipio || '-'} / ${emitente.uf || '-'}`}</Campo></Col>
              <Col span={11}><Campo rotulo="Fone">{emitente.fone || '-'}</Campo></Col>
            </Row>
            {supplierStatus.exists === false && (
              <Text type="danger" style={{ fontSize: 11, display: 'block', marginTop: 2 }}>
                <WarningOutlined /> Fornecedor não cadastrado: cadastre antes de dar entrada.
              </Text>
            )}
          </Card>
        </Col>

        {/* 3. Logística e frete */}
        <Col xs={24} lg={8}>
          <Card
            size="small"
            style={cardStyle}
            bodyStyle={cardBody}
            title={tituloCard(<CarOutlined />, 'Logística e frete')}
            extra={
              <Tooltip title="Transportadora e volumes">
                <Button type="text" size="small" icon={<InfoCircleOutlined />} onClick={() => setIsLogisticsDetailsOpen(true)} />
              </Tooltip>
            }
          >
            <Campo rotulo="Transportadora" title={data?.transp?.transporta?.xNome}>{data?.transp?.transporta?.xNome || 'Não informada'}</Campo>
            <Row gutter={12}>
              <Col span={12}><Campo rotulo="Modalidade" title={traduzirModalidadeFrete(data?.transp?.modFrete)}>{traduzirModalidadeFrete(data?.transp?.modFrete)}</Campo></Col>
              <Col span={12}><Campo rotulo="Volumes">{`${primeiroVolume?.qVol ?? 0} vol${primeiroVolume?.pesoB ? ` · ${primeiroVolume.pesoB} kg` : ''}`}</Campo></Col>
            </Row>

            {/* Frete: da nota + pago à parte = total rateado nos itens */}
            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
              {[
                { rotulo: 'Frete NF', valor: moeda(data?.totais?.icmsTot?.vFrete) },
                { rotulo: 'Adicional', valor: moeda(valorFreteAdicional), editavel: true },
                { rotulo: 'Total', valor: moeda(valorTotalFrete), destaque: true },
              ].map(b => (
                <div key={b.rotulo} style={{ flex: 1, background: b.destaque ? '#f0f7ff' : '#fafafa', border: '1px solid #f0f0f0', borderRadius: 6, padding: '3px 8px' }}>
                  <div style={{ fontSize: 11, color: '#8c8c8c', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    {b.rotulo}
                    {b.editavel && !readOnly && (
                      <Tooltip title="Frete pago à parte (Correios, carreto...)">
                        <Button type="text" size="small" icon={<EditOutlined />} onClick={() => setIsEditingFreteAdicional(true)} style={{ height: 16, width: 16, padding: 0 }} />
                      </Tooltip>
                    )}
                  </div>
                  <div style={{ fontWeight: 600, fontSize: 13, color: b.editavel && valorFreteAdicional > 0 ? '#d48806' : b.destaque ? '#1677ff' : undefined }}>{b.valor}</div>
                </div>
              ))}
            </div>
            {valorFreteAdicional > 0 && (
              <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 2 }}>
                Adicional: {metodoFreteAdicional}{obsFreteAdicional ? ` · ${obsFreteAdicional}` : ''}
              </Text>
            )}
          </Card>
        </Col>
      </Row>

      {/* Outros blocos da NF-e */}
      <Space size={4} wrap style={{ marginTop: 6 }}>
        <Text type="secondary" style={{ fontSize: 12 }}>Mais da nota:</Text>
        <Button size="small" type="text" icon={<UserOutlined />} onClick={() => setIsDestDetailsOpen(true)}>Destinatário</Button>
        <Button size="small" type="text" icon={<CreditCardOutlined />} onClick={() => setIsCobrDetailsOpen(true)}>
          Cobrança ({cobranca.duplicatas?.length || cobranca.dup?.length || 0} parcela(s))
        </Button>
        <Button size="small" type="text" icon={<CommentOutlined />} onClick={() => setIsInfAdicDetailsOpen(true)}>Informações adicionais</Button>
      </Space>

      {/* Edição do frete adicional */}
      <Modal
        title="Frete adicional (pago à parte)"
        open={isEditingFreteAdicional}
        onCancel={() => setIsEditingFreteAdicional(false)}
        onOk={handleSalvarFreteAdicional}
        okText="Salvar"
        width={420}
      >
        <Space direction="vertical" size={10} style={{ width: '100%' }}>
          <InputNumber
            value={valorFreteAdicional}
            onChange={(val) => setValorFreteAdicional(Number(val) || 0)}
            min={0}
            precision={2}
            decimalSeparator=","
            addonBefore="R$"
            style={{ width: '100%' }}
          />
          <Select
            value={metodoFreteAdicional}
            onChange={(val) => setMetodoFreteAdicional(val)}
            style={{ width: '100%' }}
            options={['Correios - PAC', 'Correios - SEDEX', 'Carreto / Moto-boy', 'Transportadora Direto', 'Outros'].map(v => ({ value: v, label: v }))}
          />
          <Input placeholder="Observação / código de rastreio" value={obsFreteAdicional} onChange={(e) => setObsFreteAdicional(e.target.value)} />
          <Text type="secondary" style={{ fontSize: 12 }}>O frete adicional é somado ao da nota e rateado no custo dos itens.</Text>
        </Space>
      </Modal>

      {/* MODAL 1: Identificação */}
      <Modal
        title="📄 Detalhes Técnicos e Identificação da NF-e (Grupo <ide>)"
        open={isNfDetailsOpen}
        onCancel={() => setIsNfDetailsOpen(false)}
        width={700}
        footer={[<Button key="close" onClick={() => setIsNfDetailsOpen(false)}>Fechar</Button>]}
      >
        <Descriptions column={2} bordered size="small" style={{ marginTop: 12 }}>
          <Descriptions.Item label="Chave de Acesso" span={2}>
            <Text style={{ fontFamily: 'monospace', fontSize: 12 }}>{formatarChaveAcesso(data.chaveAcesso)}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="Modelo (mod)">{traduzirModelo(data.ide?.mod)}</Descriptions.Item>
          <Descriptions.Item label="Série (serie)">{data.serie || '-'}</Descriptions.Item>
          <Descriptions.Item label="Número da NF (nNF)">{data.numero}</Descriptions.Item>
          <Descriptions.Item label="Código da UF (cUF)">{data.ide?.cUF || (data.chaveAcesso ? data.chaveAcesso.substring(0, 2) : '-')}</Descriptions.Item>
          <Descriptions.Item label="Data/Hora Emissão (dhEmi)" span={2}>{formatarDataBR(data.dataEmissao)}</Descriptions.Item>
          <Descriptions.Item label="Natureza da Operação (natOp)" span={2}>{data.naturezaOperacao || '-'}</Descriptions.Item>
          <Descriptions.Item label="Tipo de Operação (tpNF)">{traduzirTipoOperacao(data.tipoOperacao)}</Descriptions.Item>
          <Descriptions.Item label="Destino da Operação (idDest)">{traduzirDestinoOperacao(data.destinoOperacao)}</Descriptions.Item>
          <Descriptions.Item label="Finalidade (finNFe)">{traduzirFinalidade(data.finalidade)}</Descriptions.Item>
          <Descriptions.Item label="Presença do Comprador (indPres)">{traduzirPresencaComprador(data.presencaComprador)}</Descriptions.Item>
          <Descriptions.Item label="Tipo de Emissão (tpEmis)">{traduzirTipoEmissao(data.ide?.tpEmis)}</Descriptions.Item>
          <Descriptions.Item label="Processo de Emissão (procEmi)">{traduzirProcessoEmissao(data.ide?.procEmi)}{data.ide?.verProc ? ` · versão ${data.ide.verProc}` : ''}</Descriptions.Item>
          <Descriptions.Item label="Ambiente (tpAmb)">{traduzirAmbiente(data.protocolo?.tpAmb || data.ide?.tpAmb)}</Descriptions.Item>
          <Descriptions.Item label="Protocolo (nProt)">{data.protocolo?.nProt || '-'}{data.protocolo?.dhRecbto ? ` · ${new Date(data.protocolo.dhRecbto).toLocaleString('pt-BR')}` : ''}</Descriptions.Item>
          <Descriptions.Item label="Status SEFAZ (no XML)" span={2}>
            {data.protocolo
              ? <Text type={situacaoDoProtocolo(data.protocolo) === 'AUTORIZADA' ? 'success' : 'danger'} strong>{data.protocolo.cStat} - {data.protocolo.xMotivo}</Text>
              : <Text type="warning" strong>XML sem protocolo de autorização (&lt;protNFe&gt;)</Text>}
            <div style={{ fontSize: 11, color: '#8c8c8c' }}>Situação no momento da autorização. Cancelamento posterior só aparece consultando a SEFAZ.</div>
          </Descriptions.Item>
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
          <Divider titlePlacement="start" style={{ margin: '12px 0 8px 0', fontSize: 13 }}>Identificação Cadastral</Divider>
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

          <Divider titlePlacement="start" style={{ margin: '16px 0 8px 0', fontSize: 13 }}>Endereço do Estabelecimento Emitente (enderEmit)</Divider>
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