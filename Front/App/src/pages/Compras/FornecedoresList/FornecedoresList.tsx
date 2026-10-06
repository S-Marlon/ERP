// Fornecedores: lista (apelido, razão social, CNPJ, cidade), cadastro completo e editável, e o histórico real:
// notas de entrada, contas a pagar e produtos vinculados.
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert, Avatar, Button, Card, Checkbox, Col, Descriptions, Empty, Form, Input, Layout, List, Modal, Row, Select, Space, Spin,
  Statistic, Table, Tabs, Tag, Tooltip, Typography, message,
} from 'antd';
import {
  CopyOutlined, EditOutlined, FileTextOutlined, MailOutlined, PhoneOutlined, PlusOutlined, ReloadOutlined, SearchOutlined,
  ShoppingOutlined, WalletOutlined, WhatsAppOutlined,
} from '@ant-design/icons';
import { useFornecedores, NovoFornecedor } from './useFornecedores';
import { FornecedorDetalhe, FornecedorEdicao, getFornecedor, updateFornecedor } from './fornecedores.api';

const { Sider, Content } = Layout;
const { Title, Text } = Typography;

const UFS = ['AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT', 'PA', 'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO'];
const CORES = ['#722ed1', '#1677ff', '#13c2c2', '#52c41a', '#fa8c16', '#eb2f96', '#2f54eb', '#a0d911'];

const brl = (v: number) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const dataBr = (v: string | null | undefined) => (v ? new Date(v.length === 10 ? `${v}T12:00:00` : v).toLocaleDateString('pt-BR') : '—');
const formatarCnpj = (v: string) => {
  const d = String(v || '').replace(/\D/g, '');
  return d.length === 14 ? d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5') : v;
};
const formatarCep = (v: string | null | undefined) => {
  const d = String(v || '').replace(/\D/g, '');
  return d.length === 8 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
};
const iniciais = (nome: string) => nome.replace(/[^\p{L}\s]/gu, ' ').trim().split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase() || '?';
const corDo = (id: number) => CORES[id % CORES.length];

const STATUS_NOTA: Record<string, { cor: string; rotulo: string }> = {
  RASCUNHO: { cor: 'gold', rotulo: 'Em conferência' }, IMPORTADO: { cor: 'green', rotulo: 'Importada' }, DESCARTADO: { cor: 'default', rotulo: 'Descartada' },
};

export default function Fornecedores() {
  const navigate = useNavigate();
  const [formNovo] = Form.useForm<NovoFornecedor>();
  const [formEdicao] = Form.useForm<FornecedorEdicao>();
  const [novoAberto, setNovoAberto] = useState(false);
  const [editando, setEditando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [detalhe, setDetalhe] = useState<FornecedorDetalhe | null>(null);
  const [carregandoDetalhe, setCarregandoDetalhe] = useState(false);
  const [buscaProduto, setBuscaProduto] = useState('');

  const { loading, searchTerm, setSearchTerm, fornecedores, fornecedoresFiltrados, idAtivo, setIdAtivo, fetchFornecedores, handleCreateFornecedor } = useFornecedores(1);

  const carregarDetalhe = async (id: number) => {
    setCarregandoDetalhe(true);
    try {
      setDetalhe(await getFornecedor(id));
    } catch (e) {
      setDetalhe(null);
      message.error(e instanceof Error ? e.message : 'Erro ao carregar o fornecedor.');
    } finally {
      setCarregandoDetalhe(false);
    }
  };
  useEffect(() => {
    setBuscaProduto('');
    if (idAtivo) carregarDetalhe(idAtivo); else setDetalhe(null);
  }, [idAtivo]);

  const produtosFiltrados = useMemo(() => {
    const t = buscaProduto.trim().toLowerCase();
    const lista = detalhe?.produtos || [];
    return t ? lista.filter(p => [p.sku, p.nome, p.codigoFornecedor].some(v => String(v || '').toLowerCase().includes(t))) : lista;
  }, [detalhe, buscaProduto]);

  const abrirEdicao = () => {
    if (!detalhe) return;
    formEdicao.setFieldsValue({
      razaoSocial: detalhe.razaoSocial, nomeFantasia: detalhe.nomeFantasia, inscricaoEstadual: detalhe.inscricaoEstadual,
      inscricaoMunicipal: detalhe.inscricaoMunicipal, status: detalhe.status, observacoes: detalhe.observacoes, email: detalhe.email,
      telefone: detalhe.telefone, whatsapp: detalhe.whatsapp, nomeContato: detalhe.nomeContato,
      endereco: detalhe.endereco ? { ...detalhe.endereco, cep: formatarCep(detalhe.endereco.cep) } : {},
    });
    setEditando(true);
  };

  const salvarEdicao = async () => {
    if (!detalhe) return;
    const v = await formEdicao.validateFields();
    setSalvando(true);
    try {
      await updateFornecedor(detalhe.idPessoa, { ...v, whatsapp: Boolean(v.whatsapp), endereco: v.endereco || null });
      message.success('Fornecedor atualizado.');
      setEditando(false);
      await Promise.all([carregarDetalhe(detalhe.idPessoa), fetchFornecedores()]);
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Erro ao salvar.');
    } finally {
      setSalvando(false);
    }
  };

  const salvarNovo = async () => {
    const v = await formNovo.validateFields();
    if (await handleCreateFornecedor(v)) {
      setNovoAberto(false);
      formNovo.resetFields();
    }
  };

  const nomeExibido = (d: { nomeFantasia?: string | null; razaoSocial: string }) => d.nomeFantasia || d.razaoSocial;
  const endereco = detalhe?.endereco;
  const enderecoTexto = endereco
    ? [[endereco.logradouro, endereco.numero].filter(Boolean).join(', '), endereco.complemento, endereco.bairro,
      [endereco.cidade, endereco.estado].filter(Boolean).join(' / '), formatarCep(endereco.cep)].filter(Boolean).join(' · ')
    : '';

  return (
    <Layout style={{ height: 'calc(100vh - 64px)', background: '#f5f7fa' }}>
      <Sider width={340} theme="light" style={{ borderRight: '1px solid #eef0f3', padding: 14, overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div>
            <Title level={4} style={{ margin: 0 }}>Fornecedores</Title>
            <Text type="secondary" style={{ fontSize: 12 }}>{fornecedores.length} cadastrado(s)</Text>
          </div>
          <Space size={4}>
            <Tooltip title="Recarregar"><Button icon={<ReloadOutlined />} onClick={fetchFornecedores} loading={loading} /></Tooltip>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setNovoAberto(true)}>Novo</Button>
          </Space>
        </div>
        <Input
          placeholder="Apelido, razão social, CNPJ ou cidade"
          prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          allowClear
          style={{ marginBottom: 10 }}
        />
        <div style={{ overflowY: 'auto', height: 'calc(100% - 100px)' }}>
          <List
            dataSource={fornecedoresFiltrados}
            loading={loading && !fornecedores.length}
            locale={{ emptyText: searchTerm ? 'Nenhum fornecedor encontrado' : 'Nenhum fornecedor cadastrado' }}
            renderItem={f => {
              const ativo = f.id_pessoa === idAtivo;
              const nome = f.nome_fantasia || f.nome_razao;
              return (
                <div
                  onClick={() => setIdAtivo(f.id_pessoa)}
                  style={{
                    display: 'flex', gap: 10, padding: '9px 10px', borderRadius: 8, cursor: 'pointer', marginBottom: 4,
                    background: ativo ? '#e6f4ff' : 'transparent', border: `1px solid ${ativo ? '#91caff' : 'transparent'}`,
                  }}
                >
                  <Avatar style={{ background: corDo(f.id_pessoa), flexShrink: 0 }}>{iniciais(nome)}</Avatar>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}>
                      <Text strong ellipsis style={{ maxWidth: 210 }}>{nome}</Text>
                      {f.status !== 'ATIVO' && <Tag color="red" style={{ margin: 0, fontSize: 10 }}>inativo</Tag>}
                    </div>
                    {f.nome_fantasia && f.nome_fantasia !== f.nome_razao && (
                      <Text type="secondary" ellipsis style={{ fontSize: 11, display: 'block' }}>{f.nome_razao}</Text>
                    )}
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      {formatarCnpj(f.documento)}{f.cidade ? ` · ${f.cidade}${f.estado ? `/${f.estado}` : ''}` : ''}
                    </Text>
                  </div>
                </div>
              );
            }}
          />
        </div>
      </Sider>

      <Content style={{ padding: 20, overflowY: 'auto' }}>
        {!idAtivo ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '70vh' }}>
            <Empty description="Selecione um fornecedor na lista" />
          </div>
        ) : !detalhe ? (
          <div style={{ textAlign: 'center', paddingTop: 80 }}><Spin /></div>
        ) : (
          <Spin spinning={carregandoDetalhe}>
            <Card style={{ marginBottom: 14 }} styles={{ body: { padding: '16px 20px' } }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                <Space size={14} align="start">
                  <Avatar size={56} style={{ background: corDo(detalhe.idPessoa), fontSize: 22 }}>{iniciais(nomeExibido(detalhe))}</Avatar>
                  <div>
                    <Space size={8} align="center">
                      <Title level={3} style={{ margin: 0 }}>{nomeExibido(detalhe)}</Title>
                      <Tag color={detalhe.status === 'ATIVO' ? 'green' : 'red'}>{detalhe.status === 'ATIVO' ? 'Ativo' : 'Inativo'}</Tag>
                    </Space>
                    <div><Text type="secondary">{detalhe.razaoSocial}</Text></div>
                    <Space size={12} style={{ marginTop: 4 }} wrap>
                      <Text copyable={{ text: detalhe.cnpj, icon: <CopyOutlined style={{ fontSize: 12 }} /> }} style={{ fontSize: 13 }}>CNPJ {formatarCnpj(detalhe.cnpj)}</Text>
                      {detalhe.inscricaoEstadual && <Text type="secondary" style={{ fontSize: 13 }}>IE {detalhe.inscricaoEstadual}</Text>}
                      {detalhe.telefone && <Text type="secondary" style={{ fontSize: 13 }}><PhoneOutlined /> {detalhe.telefone}</Text>}
                      {detalhe.email && <Text type="secondary" style={{ fontSize: 13 }}><MailOutlined /> {detalhe.email}</Text>}
                    </Space>
                  </div>
                </Space>
                <Button type="primary" icon={<EditOutlined />} onClick={abrirEdicao}>Editar cadastro</Button>
              </div>
              {!detalhe.nomeFantasia && (
                <Alert type="info" showIcon style={{ marginTop: 12 }} message="Sem apelido (nome fantasia): o contas a pagar e as listas mostram a razão social. Edite o cadastro para definir um nome curto." />
              )}
            </Card>

            <Row gutter={[12, 12]} style={{ marginBottom: 14 }}>
              <Col xs={12} lg={6}><Card size="small"><Statistic title="Total comprado" value={brl(detalhe.resumo.totalComprado)} valueStyle={{ fontSize: 20 }} /></Card></Col>
              <Col xs={12} lg={6}><Card size="small"><Statistic title="Notas importadas" value={detalhe.resumo.qtdNotas} valueStyle={{ fontSize: 20 }} /></Card></Col>
              <Col xs={12} lg={6}><Card size="small"><Statistic title="Última compra" value={dataBr(detalhe.resumo.ultimaCompra)} valueStyle={{ fontSize: 20 }} /></Card></Col>
              <Col xs={12} lg={6}>
                <Card size="small">
                  <Statistic title="A pagar" value={brl(detalhe.resumo.aPagar)} valueStyle={{ fontSize: 20, color: detalhe.resumo.vencido > 0 ? '#cf1322' : undefined }} />
                  {detalhe.resumo.vencido > 0 && <Text type="danger" style={{ fontSize: 12 }}>{brl(detalhe.resumo.vencido)} vencido</Text>}
                </Card>
              </Col>
            </Row>

            <Card styles={{ body: { paddingTop: 4 } }}>
              <Tabs
                items={[
                  {
                    key: 'cadastro',
                    label: <span><FileTextOutlined /> Cadastro</span>,
                    children: (
                      <Descriptions bordered size="small" column={{ xs: 1, md: 2 }}>
                        <Descriptions.Item label="Apelido (nome fantasia)">{detalhe.nomeFantasia || <Text type="secondary">—</Text>}</Descriptions.Item>
                        <Descriptions.Item label="Razão social">{detalhe.razaoSocial}</Descriptions.Item>
                        <Descriptions.Item label="CNPJ">{formatarCnpj(detalhe.cnpj)}</Descriptions.Item>
                        <Descriptions.Item label="Inscrição estadual">{detalhe.inscricaoEstadual || 'Isento / não informada'}</Descriptions.Item>
                        <Descriptions.Item label="Inscrição municipal">{detalhe.inscricaoMunicipal || '—'}</Descriptions.Item>
                        <Descriptions.Item label="Situação"><Tag color={detalhe.status === 'ATIVO' ? 'green' : 'red'}>{detalhe.status === 'ATIVO' ? 'Ativo' : 'Inativo'}</Tag></Descriptions.Item>
                        <Descriptions.Item label="E-mail">{detalhe.email ? <a href={`mailto:${detalhe.email}`}>{detalhe.email}</a> : '—'}</Descriptions.Item>
                        <Descriptions.Item label="Telefone">
                          {detalhe.telefone ? (
                            <Space>
                              {detalhe.telefone}
                              {detalhe.whatsapp && (
                                <a href={`https://wa.me/55${detalhe.telefone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer"><WhatsAppOutlined style={{ color: '#25d366' }} /></a>
                              )}
                              {detalhe.nomeContato && <Text type="secondary">({detalhe.nomeContato})</Text>}
                            </Space>
                          ) : '—'}
                        </Descriptions.Item>
                        <Descriptions.Item label="Endereço" span={2}>{enderecoTexto || '—'}</Descriptions.Item>
                        <Descriptions.Item label="Observações" span={2}><span style={{ whiteSpace: 'pre-wrap' }}>{detalhe.observacoes || '—'}</span></Descriptions.Item>
                        <Descriptions.Item label="Cadastrado em">{dataBr(detalhe.criadoEm)}</Descriptions.Item>
                      </Descriptions>
                    ),
                  },
                  {
                    key: 'notas',
                    label: <span><FileTextOutlined /> Notas de entrada ({detalhe.notas.length})</span>,
                    children: (
                      <Table
                        size="small" rowKey="idLote" dataSource={detalhe.notas} pagination={{ pageSize: 15, hideOnSinglePage: true }}
                        locale={{ emptyText: 'Nenhuma nota de entrada deste fornecedor.' }}
                        columns={[
                          { title: 'Nota', key: 'n', render: (_, n) => <b>{n.numero || '—'}{n.serie ? <Text type="secondary"> / série {n.serie}</Text> : null}</b> },
                          { title: 'Emissão', dataIndex: 'emissao', width: 110, render: (v: string) => dataBr(v) },
                          { title: 'Valor', dataIndex: 'valor', width: 130, align: 'right' as const, render: (v: number) => brl(v) },
                          { title: 'Situação', dataIndex: 'status', width: 140, render: (v: string) => <Tag color={STATUS_NOTA[v]?.cor}>{STATUS_NOTA[v]?.rotulo || v}</Tag> },
                          {
                            title: 'Boletos', dataIndex: 'financeiro', width: 120,
                            render: (v: string | null) => (v === 'LANCADO' ? <Tag color="blue">lançados</Tag> : v === 'DISPENSADO' ? <Tag>dispensados</Tag> : <Text type="secondary">—</Text>),
                          },
                          { title: '', key: 'a', width: 80, render: (_, n) => <Button size="small" type="link" onClick={() => navigate(`/compras/entrada-nfe?lote=${n.idLote}`)}>Abrir</Button> },
                        ]}
                      />
                    ),
                  },
                  {
                    key: 'pagar',
                    label: <span><WalletOutlined /> Contas a pagar ({detalhe.titulos.length})</span>,
                    children: (
                      <>
                        <Table
                          size="small" rowKey="idTitulo" dataSource={detalhe.titulos} pagination={{ pageSize: 15, hideOnSinglePage: true }}
                          locale={{ emptyText: 'Nenhum boleto lançado para este fornecedor.' }}
                          columns={[
                            { title: 'Vencimento', dataIndex: 'vencimento', width: 110, render: (v: string, t) => <Text type={t.vencido ? 'danger' : undefined} strong={t.vencido}>{dataBr(v)}</Text> },
                            { title: 'Documento', key: 'd', render: (_, t) => <span>{t.documento || '—'} <Text type="secondary" style={{ fontSize: 11 }}>({t.parcela}/{t.totalParcelas})</Text></span> },
                            { title: 'NF', dataIndex: 'numeroNf', width: 110, render: (v: string | null) => v || '—' },
                            { title: 'Valor', dataIndex: 'valor', width: 130, align: 'right' as const, render: (v: number) => brl(v) },
                            {
                              title: 'Situação', key: 's', width: 140,
                              render: (_, t) => (t.status === 'PAGO' ? <Tag color="green">Pago {dataBr(t.pagoEm)}</Tag> : t.vencido ? <Tag color="red">Vencido</Tag> : <Tag color="gold">Em aberto</Tag>),
                            },
                          ]}
                        />
                        {detalhe.titulos.length > 0 && <Button type="link" style={{ paddingLeft: 0, marginTop: 6 }} onClick={() => navigate('/financeiro/pagar')}>Abrir contas a pagar</Button>}
                      </>
                    ),
                  },
                  {
                    key: 'produtos',
                    label: <span><ShoppingOutlined /> Produtos ({detalhe.produtos.length})</span>,
                    children: (
                      <>
                        <Input allowClear prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />} placeholder="SKU, nome ou código do fornecedor"
                          value={buscaProduto} onChange={e => setBuscaProduto(e.target.value)} style={{ maxWidth: 320, marginBottom: 10 }} />
                        <Table
                          size="small" rowKey="idItem" dataSource={produtosFiltrados} pagination={{ pageSize: 20, hideOnSinglePage: true }}
                          locale={{ emptyText: 'Nenhum produto vinculado a este fornecedor.' }}
                          columns={[
                            { title: 'SKU', dataIndex: 'sku', width: 140 },
                            { title: 'Produto', dataIndex: 'nome', ellipsis: true },
                            { title: 'Cód. fornecedor', dataIndex: 'codigoFornecedor', width: 150, render: (v: string | null) => v || '—' },
                            {
                              title: 'Compra', key: 'u', width: 110,
                              render: (_, p) => (p.unidadeCompra ? `${p.unidadeCompra}${p.fatorCompra && p.fatorCompra !== 1 ? ` (x${p.fatorCompra.toLocaleString('pt-BR')})` : ''}` : '—'),
                            },
                            { title: 'Último preço', dataIndex: 'precoUltimaCompra', width: 120, align: 'right' as const, render: (v: number | null) => (v === null ? '—' : brl(v)) },
                          ]}
                        />
                      </>
                    ),
                  },
                ]}
              />
            </Card>
          </Spin>
        )}
      </Content>

      {/* Edição */}
      <Modal open={editando} title={`Editar fornecedor · ${detalhe ? nomeExibido(detalhe) : ''}`} okText="Salvar" cancelText="Cancelar"
        onOk={salvarEdicao} confirmLoading={salvando} onCancel={() => setEditando(false)} width={760} destroyOnHidden>
        <Form form={formEdicao} layout="vertical" size="middle" requiredMark={false}>
          <Text strong>Identificação</Text>
          <Row gutter={12} style={{ marginTop: 8 }}>
            <Col span={12}>
              <Form.Item name="nomeFantasia" label="Apelido (nome fantasia)" extra="Nome curto que aparece no contas a pagar e nas listas.">
                <Input maxLength={150} placeholder="Ex: Hlemman" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="razaoSocial" label="Razão social" rules={[{ required: true, whitespace: true, message: 'Informe a razão social.' }]}>
                <Input maxLength={150} />
              </Form.Item>
            </Col>
            <Col span={8}><Form.Item label="CNPJ"><Input value={detalhe ? formatarCnpj(detalhe.cnpj) : ''} disabled /></Form.Item></Col>
            <Col span={8}><Form.Item name="inscricaoEstadual" label="Inscrição estadual"><Input maxLength={30} /></Form.Item></Col>
            <Col span={8}><Form.Item name="inscricaoMunicipal" label="Inscrição municipal"><Input maxLength={30} /></Form.Item></Col>
            <Col span={8}>
              <Form.Item name="status" label="Situação">
                <Select options={[{ value: 'ATIVO', label: 'Ativo' }, { value: 'INATIVO', label: 'Inativo (não aparece para novas compras)' }]} />
              </Form.Item>
            </Col>
          </Row>

          <Text strong>Contato</Text>
          <Row gutter={12} style={{ marginTop: 8 }}>
            <Col span={9}><Form.Item name="email" label="E-mail" rules={[{ type: 'email', message: 'E-mail inválido.' }]}><Input placeholder="vendas@fornecedor.com.br" /></Form.Item></Col>
            <Col span={7}><Form.Item name="telefone" label="Telefone"><Input placeholder="(00) 00000-0000" maxLength={20} /></Form.Item></Col>
            <Col span={8}><Form.Item name="nomeContato" label="Falar com"><Input placeholder="Nome do vendedor" maxLength={100} /></Form.Item></Col>
            <Col span={24} style={{ marginTop: -12 }}><Form.Item name="whatsapp" valuePropName="checked"><Checkbox>Telefone tem WhatsApp</Checkbox></Form.Item></Col>
          </Row>

          <Text strong>Endereço</Text>
          <Row gutter={12} style={{ marginTop: 8 }}>
            <Col span={5}><Form.Item name={['endereco', 'cep']} label="CEP"><Input placeholder="00000-000" maxLength={9} /></Form.Item></Col>
            <Col span={13}><Form.Item name={['endereco', 'logradouro']} label="Logradouro"><Input maxLength={150} /></Form.Item></Col>
            <Col span={6}><Form.Item name={['endereco', 'numero']} label="Número"><Input maxLength={20} /></Form.Item></Col>
            <Col span={8}><Form.Item name={['endereco', 'complemento']} label="Complemento"><Input maxLength={100} /></Form.Item></Col>
            <Col span={7}><Form.Item name={['endereco', 'bairro']} label="Bairro"><Input maxLength={100} /></Form.Item></Col>
            <Col span={6}><Form.Item name={['endereco', 'cidade']} label="Cidade"><Input maxLength={100} /></Form.Item></Col>
            <Col span={3}><Form.Item name={['endereco', 'estado']} label="UF"><Select showSearch allowClear options={UFS.map(u => ({ value: u, label: u }))} /></Form.Item></Col>
          </Row>

          <Form.Item name="observacoes" label="Observações">
            <Input.TextArea rows={2} maxLength={1000} placeholder="Prazo de entrega, condições de pagamento, pedido mínimo..." />
          </Form.Item>
        </Form>
      </Modal>

      {/* Novo */}
      <Modal open={novoAberto} title="Novo fornecedor" okText="Cadastrar" cancelText="Cancelar" onOk={salvarNovo} confirmLoading={loading}
        onCancel={() => setNovoAberto(false)} width={640} destroyOnHidden>
        <Text type="secondary" style={{ fontSize: 12 }}>
          Fornecedores com nota fiscal também são cadastrados direto pela entrada de nota. Se o CNPJ já existir (como cliente, por exemplo), ele só passa a ser fornecedor.
        </Text>
        <Form form={formNovo} layout="vertical" requiredMark={false} style={{ marginTop: 12 }}>
          <Row gutter={12}>
            <Col span={10}>
              <Form.Item name="cnpj" label="CNPJ" rules={[{ required: true, message: 'Informe o CNPJ.' }, { validator: (_, v) => (!v || String(v).replace(/\D/g, '').length === 14 ? Promise.resolve() : Promise.reject(new Error('CNPJ deve ter 14 dígitos.'))) }]}>
                <Input placeholder="00.000.000/0000-00" />
              </Form.Item>
            </Col>
            <Col span={14}><Form.Item name="razao_social" label="Razão social" rules={[{ required: true, whitespace: true, message: 'Informe a razão social.' }]}><Input /></Form.Item></Col>
            <Col span={12}><Form.Item name="nome_fantasia" label="Apelido (nome fantasia)"><Input placeholder="Nome curto para as listas" /></Form.Item></Col>
            <Col span={12}><Form.Item name="inscricao_estadual" label="Inscrição estadual"><Input /></Form.Item></Col>
            <Col span={12}><Form.Item name="email" label="E-mail" rules={[{ type: 'email', message: 'E-mail inválido.' }]}><Input /></Form.Item></Col>
            <Col span={12}><Form.Item name="telefone" label="Telefone"><Input placeholder="(00) 00000-0000" /></Form.Item></Col>
            <Col span={16}><Form.Item name="cidade" label="Cidade"><Input /></Form.Item></Col>
            <Col span={8}><Form.Item name="estado" label="UF"><Select showSearch allowClear options={UFS.map(u => ({ value: u, label: u }))} /></Form.Item></Col>
          </Row>
        </Form>
      </Modal>
    </Layout>
  );
}
