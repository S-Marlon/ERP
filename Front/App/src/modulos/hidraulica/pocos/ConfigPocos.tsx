// Atendimento › Configuração do módulo Poços: menu de seções à esquerda (com o que falta em cada uma) e uma seção por
// vez à direita. Os modelos de contrato e aditivo abrem num editor à parte; a barra de salvar avisa o que não foi salvo.
import React, { useEffect, useState } from 'react';
import { Alert, Badge, Button, Card, Col, Collapse, Empty, Flex, Form, Input, Modal, Row, Space, Switch, Tag, TimePicker, Tooltip, Typography, Upload, message } from 'antd';
import {
  AppstoreOutlined, CheckCircleFilled, ClockCircleOutlined, EditOutlined, FileProtectOutlined, FileTextOutlined, MessageOutlined, ShopOutlined, UndoOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { ConfigProcesso, processoApi, urlArquivo } from './obrasApi';
import { recursosPocos } from './recursosPocos';
import { reduzirImagem } from './ProcessoObra';
import { CAMPOS_MODELO, MODELO_ADITIVO_PADRAO, MODELO_CONTRATO_PADRAO } from './documentosPocos';
import { contarClausulas, faltasDaSecao, SecaoConfig, SECOES_CONFIG, secaoDoPedido, temAlteracao } from './secoesConfig';
import { CampoNumero } from '../../../shared/formularios/CamposNumero';

const { Text, Title } = Typography;
const erro = (e: unknown) => message.error(e instanceof Error ? e.message : 'Erro.');
const ICONES: Record<SecaoConfig, React.ReactNode> = {
  EMPRESA: <ShopOutlined />, ORCAMENTO: <FileTextOutlined />, CONTRATO: <FileProtectOutlined />, POSVENDA: <MessageOutlined />,
  HORARIO: <ClockCircleOutlined />, TELAS: <AppstoreOutlined />,
};
type Mudar = (x: Partial<ConfigProcesso>) => void;

/** Campo de texto ligado à configuração (vazio grava null). */
const Texto: React.FC<{ c: ConfigProcesso; k: keyof ConfigProcesso; mudar: Mudar; rotulo: string; dica?: string; placeholder?: string; max?: number }> =
  ({ c, k, mudar, rotulo, dica, placeholder, max }) => (
    <Form.Item label={rotulo} extra={dica} style={{ marginBottom: 12 }}>
      <Input value={(c[k] as string) || ''} placeholder={placeholder} maxLength={max} onChange={e => mudar({ [k]: e.target.value || null } as Partial<ConfigProcesso>)} />
    </Form.Item>
  );
const Numero: React.FC<{ c: ConfigProcesso; k: keyof ConfigProcesso; mudar: Mudar; rotulo: string; sufixo: string; min: number; max: number; dica?: string }> =
  ({ c, k, mudar, rotulo, sufixo, min, max, dica }) => (
    <Form.Item label={rotulo} extra={dica} style={{ marginBottom: 12 }}>
      <CampoNumero min={min} max={max} suffix={sufixo} style={{ width: '100%' }} value={c[k] as number} onChange={v => mudar({ [k]: Number(v) || min } as Partial<ConfigProcesso>)} />
    </Form.Item>
  );
const Hora: React.FC<{ valor: string | null; onChange: (v: string | null) => void; disabled?: boolean }> = ({ valor, onChange, disabled }) => (
  <TimePicker format="HH:mm" minuteStep={15} needConfirm={false} style={{ width: '100%' }} disabled={disabled}
    value={valor ? dayjs(`2000-01-01T${valor}`) : null} onChange={v => onChange(v ? v.format('HH:mm') : null)} />
);

/** Etiquetas que inserem o {campo} no fim do texto. */
const Etiquetas: React.FC<{ campos: Record<string, string>; inserir: (t: string) => void }> = ({ campos, inserir }) => (
  <Space size={[4, 4]} wrap>
    {Object.entries(campos).map(([k, t]) => (
      <Tooltip key={k} title={`${t} · clique para inserir`}><Tag style={{ cursor: 'pointer', margin: 0 }} onClick={() => inserir(`{${k}}`)}>{`{${k}}`}</Tag></Tooltip>
    ))}
  </Space>
);

// ------------------------------------------------------------------ editor do modelo (contrato ou aditivo)
const EditorModelo: React.FC<{ titulo: string; valor: string | null; padrao: string; aberto: boolean; onFechar: () => void; onAplicar: (v: string | null) => void }> =
  ({ titulo, valor, padrao, aberto, onFechar, onAplicar }) => {
    const [texto, setTexto] = useState(valor || padrao);
    useEffect(() => { if (aberto) setTexto(valor || padrao); }, [aberto]);   // eslint-disable-line react-hooks/exhaustive-deps
    return (
      <Modal open={aberto} title={titulo} width={960} onCancel={onFechar} destroyOnHidden okText="Usar este texto" cancelText="Voltar"
        onOk={() => { onAplicar(texto.trim() && texto !== padrao ? texto : null); onFechar(); }}
        footer={(_, { OkBtn, CancelBtn }) => (
          <Flex justify="space-between">
            <Button icon={<UndoOutlined />} disabled={texto === padrao} onClick={() => setTexto(padrao)}>Voltar ao modelo padrão</Button>
            <Space><CancelBtn /><OkBtn /></Space>
          </Flex>
        )}>
        <Space direction="vertical" size={8} style={{ width: '100%' }}>
          <Text type="secondary">
            Linhas que começam com "CLÁUSULA" viram título. Os campos entre chaves são trocados pelos dados de cada obra.
          </Text>
          <Input.TextArea value={texto} onChange={e => setTexto(e.target.value)} autoSize={{ minRows: 18, maxRows: 26 }}
            maxLength={titulo.includes('aditivo') ? 20000 : 60000} style={{ fontFamily: 'Cambria, Georgia, serif', fontSize: 13 }} />
          <Collapse size="small" items={[{
            key: 'c', label: 'Campos que você pode usar (clique para inserir no fim)',
            children: <Etiquetas campos={CAMPOS_MODELO} inserir={t => setTexto(x => `${x}${x.endsWith(' ') || x.endsWith('\n') ? '' : ' '}${t}`)} />,
          }]} />
          <Alert type="warning" showIcon message="O modelo padrão é uma referência: peça para um advogado revisar as cláusulas antes de usar com clientes." />
        </Space>
      </Modal>
    );
  };

// ------------------------------------------------------------------ seções
const Empresa: React.FC<{ c: ConfigProcesso; mudar: Mudar; logoNovo: string | null; setLogoNovo: (v: string | null) => void; tirarLogo: () => void }> =
  ({ c, mudar, logoNovo, setLogoNovo, tirarLogo }) => (
    <Row gutter={24}>
      <Col xs={24} md={7}>
        <Form.Item label="Logo" extra="PNG ou JPG; sai no cabeçalho dos documentos." style={{ marginBottom: 12 }}>
          <div style={{ border: '1px dashed #d9d9d9', borderRadius: 8, height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 8, background: '#fafafa' }}>
            {logoNovo || c.logo
              ? <img src={logoNovo || urlArquivo(c.logo) || ''} alt="logo" style={{ maxHeight: 104, maxWidth: '100%' }} />
              : <Text type="secondary">sem logo</Text>}
          </div>
          <Space style={{ marginTop: 8 }}>
            <Upload accept="image/png,image/jpeg,image/webp" showUploadList={false}
              beforeUpload={async f => { try { setLogoNovo(await reduzirImagem(f, 600, 0.9)); } catch (e) { erro(e); } return false; }}>
              <Button size="small">{c.logo || logoNovo ? 'Trocar' : 'Escolher'}</Button>
            </Upload>
            {logoNovo && <Button size="small" type="link" onClick={() => setLogoNovo(null)}>desfazer</Button>}
            {c.logo && !logoNovo && <Button size="small" type="link" danger onClick={tirarLogo}>tirar</Button>}
          </Space>
        </Form.Item>
      </Col>
      <Col xs={24} md={17}>
        <Row gutter={12}>
          <Col xs={24} md={14}><Texto c={c} k="empresaNome" mudar={mudar} rotulo="Nome da empresa" /></Col>
          <Col xs={24} md={10}><Texto c={c} k="empresaDocumento" mudar={mudar} rotulo="CNPJ / CPF" /></Col>
          <Col xs={24} md={8}><Texto c={c} k="empresaTelefone" mudar={mudar} rotulo="Telefone" /></Col>
          <Col xs={24} md={8}><Texto c={c} k="empresaWhatsapp" mudar={mudar} rotulo="WhatsApp" /></Col>
          <Col xs={24} md={8}><Texto c={c} k="empresaEmail" mudar={mudar} rotulo="E-mail" /></Col>
          <Col span={24}><Texto c={c} k="empresaEndereco" mudar={mudar} rotulo="Endereço" /></Col>
        </Row>
        <Title level={5} style={{ marginTop: 4 }}>Quem assina o contrato pela empresa</Title>
        <Row gutter={12}>
          <Col xs={24} md={14}><Texto c={c} k="empresaRepresentante" mudar={mudar} rotulo="Representante legal" placeholder="Ex.: José Maurício dos Santos" /></Col>
          <Col xs={24} md={10}><Texto c={c} k="empresaRepresentanteCpf" mudar={mudar} rotulo="CPF do representante" /></Col>
        </Row>
      </Col>
    </Row>
  );

const Orcamento: React.FC<{ c: ConfigProcesso; mudar: Mudar }> = ({ c, mudar }) => (
  <Row gutter={12}>
    <Col xs={24} md={16}><Texto c={c} k="formaPagamentoPadrao" mudar={mudar} rotulo="Forma de pagamento padrão" placeholder="Ex.: 30% de sinal, saldo na entrega ou em até 3 vezes" /></Col>
    <Col xs={24} md={8}><Numero c={c} k="validadeOrcamentoDias" mudar={mudar} rotulo="Validade do orçamento" sufixo="dias" min={1} max={365} /></Col>
    <Col span={24}>
      <Form.Item label="Texto de garantia" extra="Sai no orçamento e no laudo de entrega." style={{ marginBottom: 12 }}>
        <Input.TextArea autoSize={{ minRows: 3, maxRows: 8 }} maxLength={2000} value={c.textoGarantia || ''} onChange={e => mudar({ textoGarantia: e.target.value || null })}
          placeholder="Ex.: A garantia cobre a execução da perfuração e do revestimento contra defeitos de construção. Não cobre: redução natural da vazão do aquífero..." />
      </Form.Item>
    </Col>
  </Row>
);

const Contrato: React.FC<{ c: ConfigProcesso; mudar: Mudar }> = ({ c, mudar }) => {
  const [editando, setEditando] = useState<'modeloContrato' | 'modeloAditivo' | null>(null);
  const modelos = [
    { k: 'modeloContrato' as const, titulo: 'Modelo do contrato', padrao: MODELO_CONTRATO_PADRAO, nomePadrao: 'modelo da empresa' },
    { k: 'modeloAditivo' as const, titulo: 'Modelo do termo aditivo', padrao: MODELO_ADITIVO_PADRAO, nomePadrao: 'modelo padrão' },
  ];
  const atual = modelos.find(m => m.k === editando);
  return (
    <>
      <Row gutter={12}>
        <Col xs={24} md={8}><Texto c={c} k="foroCidade" mudar={mudar} rotulo="Foro (cidade da comarca)" max={60} /></Col>
        <Col xs={24} md={10}><Texto c={c} k="responsavelTecnico" mudar={mudar} rotulo="Responsável técnico" max={120} /></Col>
        <Col xs={24} md={6}><Texto c={c} k="registroTecnico" mudar={mudar} rotulo="CREA / registro" max={30} /></Col>
      </Row>
      <Title level={5} style={{ marginTop: 4 }}>Textos</Title>
      <Space direction="vertical" size={8} style={{ width: '100%' }}>
        {modelos.map(m => {
          const texto = c[m.k] || m.padrao;
          return (
            <Card key={m.k} size="small" styles={{ body: { padding: '10px 14px' } }}>
              <Flex justify="space-between" align="center" gap={8} wrap>
                <div>
                  <Text strong>{m.titulo}</Text>
                  <div>
                    {c[m.k] ? <Tag color="blue">personalizado</Tag> : <Tag color="green">{m.nomePadrao}</Tag>}
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {contarClausulas(texto) ? `${contarClausulas(texto)} cláusulas · ` : ''}{texto.length.toLocaleString('pt-BR')} caracteres
                    </Text>
                  </div>
                </div>
                <Space>
                  {c[m.k] && <Button size="small" type="link" onClick={() => mudar({ [m.k]: null })}>voltar ao padrão</Button>}
                  <Button icon={<EditOutlined />} onClick={() => setEditando(m.k)}>Ver e editar</Button>
                </Space>
              </Flex>
            </Card>
          );
        })}
      </Space>
      {atual && (
        <EditorModelo titulo={atual.titulo} valor={c[atual.k]} padrao={atual.padrao} aberto={!!editando}
          onFechar={() => setEditando(null)} onAplicar={v => mudar({ [atual.k]: v })} />
      )}
    </>
  );
};

const CAMPOS_MENSAGEM = { cliente: 'Nome do cliente', empresa: 'Nome da empresa', link: 'Link de avaliação', poco: 'Poço', obra: 'Obra' };

const PosVenda: React.FC<{ c: ConfigProcesso; mudar: Mudar }> = ({ c, mudar }) => {
  const anexar = (k: 'msgAvaliacao' | 'msgRevisao') => (t: string) => mudar({ [k]: `${c[k]}${c[k].endsWith(' ') || !c[k] ? '' : ' '}${t}` });
  return (
    <Space direction="vertical" size={14} style={{ width: '100%' }}>
      <Card size="small" title="Pedido de avaliação no Google">
        <Row gutter={12}>
          <Col xs={24} md={16}><Texto c={c} k="linkAvaliacao" mudar={mudar} rotulo="Link para avaliar"
            placeholder="https://g.page/r/.../review" dica='No Perfil da Empresa no Google: "Pedir avaliações".' /></Col>
          <Col xs={24} md={8}><Numero c={c} k="avaliacaoDias" mudar={mudar} rotulo="Pedir depois de" sufixo="dias" min={1} max={90} dica="contados da conclusão da obra" /></Col>
          <Col span={24}>
            <Form.Item label="Mensagem" style={{ marginBottom: 4 }}>
              <Input.TextArea autoSize={{ minRows: 3, maxRows: 8 }} maxLength={1000} value={c.msgAvaliacao} onChange={e => mudar({ msgAvaliacao: e.target.value })} />
            </Form.Item>
            <Etiquetas campos={CAMPOS_MENSAGEM} inserir={anexar('msgAvaliacao')} />
          </Col>
        </Row>
      </Card>
      <Card size="small" title="Lembrete de revisão">
        <Row gutter={12}>
          <Col xs={24} md={8}><Numero c={c} k="revisaoMeses" mudar={mudar} rotulo="Lembrar depois de" sufixo="meses" min={1} max={60} dica="contados da conclusão da obra" /></Col>
          <Col span={24}>
            <Form.Item label="Mensagem" style={{ marginBottom: 4 }}>
              <Input.TextArea autoSize={{ minRows: 3, maxRows: 8 }} maxLength={1000} value={c.msgRevisao} onChange={e => mudar({ msgRevisao: e.target.value })} />
            </Form.Item>
            <Etiquetas campos={CAMPOS_MENSAGEM} inserir={anexar('msgRevisao')} />
          </Col>
        </Row>
      </Card>
    </Space>
  );
};

const Horario: React.FC<{ c: ConfigProcesso; mudar: Mudar }> = ({ c, mudar }) => (
  <Space direction="vertical" size={14} style={{ width: '100%' }}>
    <Card size="small" title="Horário comercial">
      <Row gutter={12} align="bottom">
        <Col xs={12} md={6}><Form.Item label="Segunda a sexta, abre" style={{ marginBottom: 12 }}><Hora valor={c.horaAbre} onChange={v => mudar({ horaAbre: v || '08:00' })} /></Form.Item></Col>
        <Col xs={12} md={6}><Form.Item label="Fecha" style={{ marginBottom: 12 }}><Hora valor={c.horaFecha} onChange={v => mudar({ horaFecha: v || '18:00' })} /></Form.Item></Col>
        <Col xs={12} md={6}>
          <Form.Item label="Abre no sábado" style={{ marginBottom: 12 }}>
            <Switch checked={!!c.sabadoFecha} onChange={v => mudar({ sabadoFecha: v ? '12:00' : null })} />
          </Form.Item>
        </Col>
        <Col xs={12} md={6}>
          <Form.Item label="Sábado fecha" style={{ marginBottom: 12 }}><Hora valor={c.sabadoFecha} disabled={!c.sabadoFecha} onChange={v => mudar({ sabadoFecha: v })} /></Form.Item>
        </Col>
      </Row>
    </Card>
    <Card size="small" title="Prazos de resposta">
      <Row gutter={12}>
        <Col xs={24} md={12}><Numero c={c} k="respostaLeadMin" mudar={mudar} rotulo="Responder um contato novo em até" sufixo="min" min={5} max={1440} /></Col>
        <Col xs={24} md={12}><Numero c={c} k="orcamentoHoras" mudar={mudar} rotulo="Enviar o orçamento em até" sufixo="h" min={1} max={240} dica="depois da visita" /></Col>
      </Row>
      <Text type="secondary" style={{ fontSize: 12 }}>Os prazos só correm dentro do horário comercial: um contato às 17h50 de sexta vence na segunda de manhã.</Text>
    </Card>
  </Space>
);

const Telas: React.FC<{ c: ConfigProcesso; mudar: Mudar }> = ({ c, mudar }) => (
  <Space direction="vertical" size={10} style={{ width: '100%' }}>
    {([
      ['usaMapa', 'Mapa', 'Os poços dos clientes no mapa e a base regional (profundidade e vazão da região).'],
      ['usaMonitoramento', 'Monitoramento (sensores)', 'Ligue quando houver aparelho medindo o nível ou a vazão de algum poço.'],
    ] as const).map(([k, titulo, desc]) => (
      <Card key={k} size="small" styles={{ body: { padding: '10px 14px' } }}>
        <Flex justify="space-between" align="center" gap={12}>
          <div><Text strong>{titulo}</Text><div><Text type="secondary" style={{ fontSize: 12 }}>{desc}</Text></div></div>
          <Switch checked={c[k]} onChange={v => mudar({ [k]: v })} checkedChildren="ligada" unCheckedChildren="desligada" />
        </Flex>
      </Card>
    ))}
    <Text type="secondary" style={{ fontSize: 12 }}>Desligada, a tela sai de "Mais ferramentas". Nada é apagado: ligar de novo traz tudo de volta.</Text>
  </Space>
);

// ------------------------------------------------------------------ tela
const ConfigPocos: React.FC<{ pedido?: string }> = ({ pedido }) => {
  const [salva, setSalva] = useState<ConfigProcesso | null>(null);
  const [c, setC] = useState<ConfigProcesso | null>(null);
  const [logoNovo, setLogoNovo] = useState<string | null>(null);
  const [secao, setSecao] = useState<SecaoConfig>(secaoDoPedido(pedido));
  const [salvando, setSalvando] = useState(false);
  useEffect(() => { processoApi.config().then(r => { setSalva(r); setC(r); }).catch(erro); }, []);
  useEffect(() => { setSecao(secaoDoPedido(pedido)); }, [pedido]);
  if (!c) return <Card loading />;
  const mudar: Mudar = x => setC(a => (a ? { ...a, ...x } : a));
  const alterado = temAlteracao(salva, c, logoNovo);
  const salvar = async (tirarLogo = false) => {
    setSalvando(true);
    try {
      const r = await processoApi.salvarConfig({ ...c, logoNovo: logoNovo || undefined, tirarLogo });
      setSalva(r); setC(r); setLogoNovo(null); recursosPocos.definir(r); message.success('Configuração salva.');
    } catch (e) { erro(e); } finally { setSalvando(false); }
  };
  const atual = SECOES_CONFIG.find(s => s.id === secao)!;
  const faltas = faltasDaSecao(secao, c);
  const corpo: Record<SecaoConfig, React.ReactNode> = {
    EMPRESA: <Empresa c={c} mudar={mudar} logoNovo={logoNovo} setLogoNovo={setLogoNovo} tirarLogo={() => salvar(true)} />,
    ORCAMENTO: <Orcamento c={c} mudar={mudar} />, CONTRATO: <Contrato c={c} mudar={mudar} />, POSVENDA: <PosVenda c={c} mudar={mudar} />,
    HORARIO: <Horario c={c} mudar={mudar} />, TELAS: <Telas c={c} mudar={mudar} />,
  };
  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} md={7} lg={6}>
        <Card size="small" styles={{ body: { padding: 6 } }}>
          {SECOES_CONFIG.map(s => {
            const f = faltasDaSecao(s.id, c);
            const ativo = s.id === secao;
            return (
              <div key={s.id} onClick={() => setSecao(s.id)}
                style={{ cursor: 'pointer', padding: '9px 12px', borderRadius: 6, background: ativo ? '#e6f4ff' : undefined, color: ativo ? '#1677ff' : undefined }}>
                <Flex justify="space-between" align="center" gap={8}>
                  <Space size={8}>{ICONES[s.id]}<span style={{ fontWeight: ativo ? 600 : 400 }}>{s.titulo}</span></Space>
                  {f.length ? <Tooltip title={`Falta: ${f.join(', ')}`}><Badge count={f.length} color="#faad14" size="small" /></Tooltip>
                    : ['EMPRESA', 'CONTRATO', 'POSVENDA'].includes(s.id) ? <CheckCircleFilled style={{ color: '#52c41a' }} /> : null}
                </Flex>
              </div>
            );
          })}
        </Card>
      </Col>
      <Col xs={24} md={17} lg={18}>
        <Card size="small" title={<Space>{ICONES[secao]}{atual.titulo}</Space>} styles={{ body: { paddingBottom: 0 } }}>
          <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>{atual.descricao}</Text>
          {faltas.length > 0 && <Alert type="warning" showIcon style={{ marginBottom: 12 }} message={`Falta preencher: ${faltas.join(', ')}.`} />}
          <Form layout="vertical" component="div">{corpo[secao] || <Empty />}</Form>
          <div style={{ position: 'sticky', bottom: 0, background: '#fff', borderTop: '1px solid #f0f0f0', margin: '8px -12px 0', padding: '10px 12px', zIndex: 2 }}>
            <Flex justify="space-between" align="center" gap={8} wrap>
              <Text type={alterado ? 'warning' : 'secondary'} style={{ fontSize: 12 }}>
                {alterado ? 'Há alterações não salvas (valem para todas as seções).' : 'Tudo salvo.'}
              </Text>
              <Space>
                <Button icon={<UndoOutlined />} disabled={!alterado || salvando} onClick={() => { setC(salva); setLogoNovo(null); }}>Desfazer</Button>
                <Button type="primary" loading={salvando} disabled={!alterado} onClick={() => salvar()}>Salvar</Button>
              </Space>
            </Flex>
          </div>
        </Card>
      </Col>
    </Row>
  );
};

export default ConfigPocos;
