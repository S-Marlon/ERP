import React, { useState, useMemo, useEffect } from 'react';
import {
  Input, Select, Checkbox, Tooltip, Tag, Spin, Button,
  Modal, Form, Table, Space, Typography, Card, Row, Col, Empty, InputNumber
} from 'antd';
import {
  PlusOutlined, FolderAddOutlined, EditOutlined,
  DeleteOutlined, SearchOutlined, CheckOutlined, CloseOutlined,
  InfoCircleOutlined, WarningOutlined
} from '@ant-design/icons';
import Swal from 'sweetalert2';
import {
  getAtributosGlobais,
  getGruposAtributos,
  getUnidadesMedida,
  createAtributoGlobal,
  updateAtributoGlobal,
  deleteAtributoGlobal,
  createGrupoAtributo,
  updateGrupoAtributo,
  deleteGrupoAtributo
} from './GlobalAttributeManager.api';
import {
  IAtributoGlobal,
  GrupoVisualAPIResponse,
  UnidadeAPIResponse,
  TipoDadoAtributo
} from './GlobalAttributeManager.types';

const { Title, Text } = Typography;

interface GlobalAttributeManagerProps {
  tenantId?: number;
}

export const GlobalAttributeManager: React.FC<GlobalAttributeManagerProps> = ({ tenantId = 1 }) => {
  // --- FORMS ---
  const [formCriarGrupo] = Form.useForm();
  const [formEditarGrupo] = Form.useForm();
  const [formAtributo] = Form.useForm();
  const [formEdicaoInline] = Form.useForm();

  // --- STATES ---
  const [unidades, setUnidades] = useState<UnidadeAPIResponse[]>([]);
  const [grupos, setGrupos] = useState<GrupoVisualAPIResponse[]>([]);
  const [atributos, setAtributos] = useState<IAtributoGlobal[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // --- MODALS VISIBILITY ---
  const [isModalGrupoOpen, setIsModalGrupoOpen] = useState(false);
  const [isModalAtributoOpen, setIsModalAtributoOpen] = useState(false);
  const [isModalEditarGrupoOpen, setIsModalEditarGrupoOpen] = useState(false);

  // --- FILTERS ---
  const [grupoAtivoFiltro, setGrupoAtivoFiltro] = useState<string>('todos');
  const [buscaTexto, setBuscaTexto] = useState<string>('');

  // --- INLINE EDIT STATE ---
  const [idAtributoEmEdicao, setIdAtributoEmEdicao] = useState<string | null>(null);
  const [tipoAtributoSelecionado, setTipoAtributoSelecionado] = useState<TipoDadoAtributo>('texto');
  const [unidadeSelecionada, setUnidadeSelecionada] = useState<string>('');
  const [grupoEmEdicao, setGrupoEmEdicao] = useState<GrupoVisualAPIResponse | null>(null);

  // --- STATE FOR LIST OPTIONS (KEY/VALUE) ---
  const [opcoesLista, setOpcoesLista] = useState<{ chave: string; valor: string }[]>([]);
  const [inputChaveOpcao, setInputChaveOpcao] = useState('');
  const [inputValorOpcao, setInputValorOpcao] = useState('');

  // --- API DATA FETCHING ---
  const carregarDadosDoBanco = async () => {
    setLoading(true);
    try {
      const [listaUnidades, listaGrupos, listaAtributos] = await Promise.all([
        getUnidadesMedida(tenantId),
        getGruposAtributos(tenantId),
        getAtributosGlobais(tenantId)
      ]);
      setUnidades(listaUnidades || []);

      const gruposOrdenados = (listaGrupos || []).sort((a: any, b: any) => (a.ordemExibicao || 0) - (b.ordemExibicao || 0));
      setGrupos(gruposOrdenados);

      setAtributos(listaAtributos || []);
    } catch (err: any) {
      Swal.fire('Erro!', `Falha na sincronização de dados: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarDadosDoBanco();
  }, [tenantId]);

  // --- SLUG GENERATOR ---
  const handleNomeAttrChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nome = e.target.value;
    const slug = nome
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-_]/g, '')
      .replace(/[\s-]+/g, '_');

    formAtributo.setFieldsValue({ nome, codigo: slug });
  };

  // --- KEY GENERATOR FOR OPTIONS ---
  const handleValorOpcaoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const valor = e.target.value;
    const chave = valor
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-_]/g, '')
      .replace(/[\s-]+/g, '_');
    setInputValorOpcao(valor);
    setInputChaveOpcao(chave);
  };

  const handleAdicionarOpcao = () => {
    if (!inputChaveOpcao || !inputValorOpcao) return;
    if (opcoesLista.some(op => op.chave === inputChaveOpcao)) {
      Swal.fire('Atenção', 'Esta chave de opção já existe.', 'warning');
      return;
    }
    setOpcoesLista([...opcoesLista, { chave: inputChaveOpcao, valor: inputValorOpcao }]);
    setInputChaveOpcao('');
    setInputValorOpcao('');
  };

  const handleRemoverOpcao = (chaveParaRemover: string) => {
    setOpcoesLista(opcoesLista.filter(op => op.chave !== chaveParaRemover));
  };

  // --- GRUPO ACTIONS ---
  const handleCriarGrupo = async (valores: any) => {
    setIsSaving(true);
    try {
      await createGrupoAtributo({
        nome: valores.nome.trim(),
        descricao: valores.descricao?.trim(),
        ordemExibicao: valores.ordemExibicao || 0
      }, tenantId);
      Swal.fire('Sucesso!', 'Grupo Semântico criado com sucesso.', 'success');
      formCriarGrupo.resetFields();
      setIsModalGrupoOpen(false);
      carregarDadosDoBanco();
    } catch (err: any) {
      Swal.fire('Erro!', err.message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleIniciarEdicaoGrupo = (grupo: GrupoVisualAPIResponse) => {
    setGrupoEmEdicao(grupo);
    formEditarGrupo.setFieldsValue({
      nome: grupo.nome,
      descricao: grupo.descricao,
      ordemExibicao: (grupo as any).ordemExibicao || 0
    });
    setIsModalEditarGrupoOpen(true);
  };

  const handleSalvarEdicaoGrupo = async (valores: any) => {
    if (!grupoEmEdicao) return;
    setIsSaving(true);
    try {
      await updateGrupoAtributo(grupoEmEdicao.id, {
        nome: valores.nome.trim(),
        descricao: valores.descricao?.trim(),
        ordemExibicao: valores.ordemExibicao || 0
      }, tenantId);
      Swal.fire('Sucesso!', 'Grupo Semântico atualizado.', 'success');
      formEditarGrupo.resetFields();
      setIsModalEditarGrupoOpen(false);
      setGrupoEmEdicao(null);
      carregarDadosDoBanco();
    } catch (err: any) {
      Swal.fire('Erro!', err.message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeletarGrupo = async (id: string) => {
    const temVinculo = atributos.some(a => String(a.grupoId || '') === String(id));
    if (temVinculo) {
      Swal.fire('Bloqueado', 'Existem atributos vinculados a este grupo.', 'error');
      return;
    }

    const confirmacao = await Swal.fire({
      title: 'Remover Grupo?',
      text: "Isso removerá a categoria lógica do dicionário.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444'
    });

    if (!confirmacao.isConfirmed) return;

    try {
      await deleteGrupoAtributo(id, tenantId);
      Swal.fire('Deletado!', 'Grupo removido.', 'success');
      if (grupoAtivoFiltro === id) setGrupoAtivoFiltro('todos');
      carregarDadosDoBanco();
    } catch (err: any) {
      Swal.fire('Erro!', err.message, 'error');
    }
  };

  // --- ATRIBUTO ACTIONS ---
  const handleCriarAtributo = async (valores: any) => {
    if (valores.tipo === 'lista' && opcoesLista.length === 0) {
      Swal.fire('Atenção', 'Atributos do tipo lista precisam de ao menos 1 opção configurada.', 'warning');
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        ...valores,
        nome: valores.nome.trim(),
        codigo: valores.codigo.trim(),
        sufixo: valores.sufixo?.trim() || undefined,
        ajudaContextual: valores.ajudaContextual?.trim() || undefined,
        ordemExibicao: valores.ordemExibicao || 0,
        opcoesLista: valores.tipo === 'lista' ? opcoesLista : undefined
      };
      await createAtributoGlobal(payload, tenantId);
      Swal.fire('Salvo!', 'Atributo adicionado ao pool global!', 'success');
      formAtributo.resetFields();
      setOpcoesLista([]);
      setIsModalAtributoOpen(false);
      carregarDadosDoBanco();
    } catch (err: any) {
      Swal.fire('Erro!', err.message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // --- INLINE EDIT METHODS ---
  const startInlineEdit = (record: IAtributoGlobal) => {
    formEdicaoInline.setFieldsValue({
      ...record,
      ordemExibicao: (record as any).ordemExibicao || 0,
      tipoComponenteUI: (record as any).tipoComponenteUI || 'input',
      ajudaContextual: (record as any).ajudaContextual || ''
    });
    setIdAtributoEmEdicao(record.id);
  };

  const cancelInlineEdit = () => {
    setIdAtributoEmEdicao(null);
    formEdicaoInline.resetFields();
  };

  const saveInlineEdit = async (id: string) => {
    try {
      const rowValues = await formEdicaoInline.validateFields();
      const original = atributos.find(a => a.id === id);

      // --- VALIDAÇÃO AMARELA: UNIDADE ALTERADA ---
      if (original && original.unidadeId !== rowValues.unidadeId && original.emUso) {
        const confirmacaoUnidade = await Swal.fire({
          title: 'Alterar Unidade de Medida?',
          html: `<p style="text-align: left;">Você está prestes a mudar a unidade deste atributo que já está em uso!</p>
<p style="text-align: left; color: #d97706; font-weight: bold;">⚠️ Atenção: alterar a unidade não converterá matematicamente os números já digitados nos SKUs ativos.</p>`,
          icon: 'warning',
          showCancelButton: true,
          confirmButtonText: 'Sim, alterar unidade',
          cancelButtonText: 'Cancelar',
          confirmButtonColor: '#f59e0b'
        });

        if (!confirmacaoUnidade.isConfirmed) {
          return; // Aborta salvamento
        }
      }

      await updateAtributoGlobal(id, { ...original, ...rowValues }, tenantId);
      Swal.fire('Atualizado!', 'Atributo alterado com sucesso.', 'success');
      setIdAtributoEmEdicao(null);
      carregarDadosDoBanco();
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleDeletarAtributo = async (record: IAtributoGlobal) => {
    if ((record as any).emUso) {
      Swal.fire({
        title: 'Bloqueado!',
        text: 'Este atributo está associado a produtos ativos e não pode ser deletado para evitar órfãos estruturais.',
        icon: 'error'
      });
      return;
    }

    const confirm = await Swal.fire({
      title: 'Remover Atributo?',
      text: "Esta ação não pode ser desfeita no Dicionário PIM!",
      icon: 'warning',
      showCancelButton: true,
    });
    if (!confirm.isConfirmed) return;

    try {
      await deleteAtributoGlobal(record.id, tenantId);
      Swal.fire('Deletado!', 'O atributo foi removido.', 'success');
      carregarDadosDoBanco();
    } catch (err: any) {
      Swal.fire('Erro', err.message, 'error');
    }
  };

  // --- MEMOIZED FILTERS & SORTING ---
  const atributosExibidos = useMemo(() => {
    return atributos
      .filter(attr => {
        const matchesGrupo = grupoAtivoFiltro === 'todos' || String(attr.grupoId) === grupoAtivoFiltro;
        const matchesBusca = !buscaTexto ||
          attr.nome.toLowerCase().includes(buscaTexto.toLowerCase()) ||
          attr.codigo.toLowerCase().includes(buscaTexto.toLowerCase());
        return matchesGrupo && matchesBusca;
      })
      .sort((a, b) => ((a as any).ordemExibicao || 0) - ((b as any).ordemExibicao || 0));
  }, [atributos, grupoAtivoFiltro, buscaTexto]);

  // --- TABLE COLUMNS CONFIG ---
  // --- TABLE COLUMNS CONFIG ---
  const columns = [
    {
      title: 'Status',
      dataIndex: 'ativo',
      key: 'ativo',
      width: 80,
      align: 'center' as const,
      render: (ativo: number, record: IAtributoGlobal) => {
        const isEditing = record.id === idAtributoEmEdicao;
        if (isEditing) {
          return (
            <Form.Item name="ativo" valuePropName="checked" style={{ margin: 0 }}>
              <Checkbox />
            </Form.Item>
          );
        }
        return (
          <Tag color={ativo ? 'success' : 'default'} style={{ fontWeight: 'bold' }}>
            {ativo ? 'ATIVO' : 'INATIVO'}
          </Tag>
        );
      }
    },
    {
      title: 'Nome / Código / Alteração',
      dataIndex: 'nome',
      key: 'nome',
      render: (_: any, record: IAtributoGlobal) => {
        const isEditing = record.id === idAtributoEmEdicao;
        const estaEmUso = (record as any).emUso;
        const dataAlteracao = (record as any).alterado_em
          ? new Date((record as any).alterado_em).toLocaleDateString('pt-BR')
          : null;

        return isEditing ? (
          <Space direction="vertical" style={{ width: '100%' }}>
            <Form.Item name="nome" rules={[{ required: true, message: 'Obrigatório' }]} style={{ margin: 0 }}>
              <Input size="small" placeholder="Nome Comercial" />
            </Form.Item>

            {/* ROTEIRO AMARELO: Validação/Alerta no Código Técnico */}
            <Space size={4} style={{ width: '100%' }}>
              <Form.Item
                name="codigo"
                style={{ margin: 0, flexGrow: 1 }}
                rules={[
                  { required: true, message: 'Obrigatório' },
                  { pattern: /^[a-z0-9_]+$/, message: 'Apenas minúsculas, números e underline.' }
                ]}
              >
                <Input size="small" style={{ fontFamily: 'monospace' }} disabled={estaEmUso} placeholder="codigo_tecnico" />
              </Form.Item>
              {estaEmUso ? (
                <Tooltip title="🟨 Nível Amarelo: O código técnico já está em uso no banco e em integrações ativas (ERP/API). A edição deste campo está temporariamente travada.">
                  <WarningOutlined style={{ color: '#d97706', fontSize: '14px', cursor: 'help' }} />
                </Tooltip>
              ) : (
                <Tooltip title="🟨 Alterar o código técnico de integração após homologado pode quebrar APIs, ERPs ou motores de busca ativos que o consultam de forma estática.">
                  <WarningOutlined style={{ color: '#eab308', fontSize: '14px', cursor: 'help' }} />
                </Tooltip>
              )}
            </Space>
          </Space>
        ) : (
          <div>
            <Space size={4}>
              <Text strong>{record.nome}</Text>
              {(record as any).ajudaContextual && (
                <Tooltip title={(record as any).ajudaContextual}>
                  <InfoCircleOutlined style={{ color: '#1890ff', fontSize: 12 }} />
                </Tooltip>
              )}
              {estaEmUso && <Tag color="warning" style={{ fontSize: 10, lineHeight: '14px', fontWeight: 'bold' }}>EM USO ATIVO</Tag>}
            </Space>
            <div style={{ fontSize: '11px', color: '#919eab', fontFamily: 'monospace' }}>{record.codigo}</div>
            {dataAlteracao && (
              <div style={{ fontSize: '9px', color: '#a6b0cf', marginTop: '2px' }}>
                Alterado em: {dataAlteracao}
              </div>
            )}
          </div>
        );
      }
    },
    {
      title: 'Grupo',
      dataIndex: 'grupoId',
      key: 'grupoId',
      render: (grupoId: string, record: IAtributoGlobal) => {
        const isEditing = record.id === idAtributoEmEdicao;
        if (isEditing) {
          return (
            <Form.Item name="grupoId" style={{ margin: 0 }}>
              <Select size="small" style={{ width: '100%' }}>
                {grupos.map(g => <Select.Option key={g.id} value={g.id}>{g.nome}</Select.Option>)}
              </Select>
            </Form.Item>
          );
        }
        return grupos.find(g => String(g.id) === String(grupoId))?.nome || 'Sem Grupo';
      }
    },
    {
      title: 'Escopo Padrão',
      dataIndex: 'escopo_padrao',
      key: 'escopo_padrao',
      render: (escopo: string, record: IAtributoGlobal) => {
        const isEditing = record.id === idAtributoEmEdicao;
        const escopoValor = escopo || (record as any).escopoPadrao || 'ficha';

        if (isEditing) {
          return (
            <Form.Item name="escopo_padrao" style={{ margin: 0 }}>
              <Select size="small" style={{ width: '100%' }}>
                <Select.Option value="ficha">Ficha Técnica</Select.Option>
                <Select.Option value="grade">Grade de Variantes</Select.Option>
                <Select.Option value="dna">DNA de Integração</Select.Option>
              </Select>
            </Form.Item>
          );
        }

        const tagsEscopo: Record<string, { color: string; label: string }> = {
          ficha: { color: 'blue', label: '📄 Ficha' },
          grade: { color: 'orange', label: '🔲 Grade' },
          dna: { color: 'magenta', label: '🧬 DNA' }
        };

        const config = tagsEscopo[escopoValor] || { color: 'default', label: escopoValor };
        return <Tag color={config.color}>{config.label}</Tag>;
      }
    },
    {
      title: 'Tipo físico / Componente',
      dataIndex: 'tipo',
      key: 'tipo',
      render: (tipo: string, record: IAtributoGlobal) => {
        const isEditing = record.id === idAtributoEmEdicao;
        const estaEmUso = (record as any).emUso;
        const unidade = unidades.find(u => String(u.id) === String(record.unidadeId));

        if (isEditing) {
          return (
            <Space direction="vertical" style={{ width: '100%' }}>

              {/* ROTEIRO VERMELHO: Bloqueio do tipo de dado */}
              <Space size={4} style={{ width: '100%' }}>
                <Form.Item name="tipo" style={{ margin: 0, flexGrow: 1 }}>
                  <Select size="small" disabled={estaEmUso}>
                    {/* Alinhado com o ENUM físico do Banco: texto, numero, decimal, boolean, lista, data */}
                    {['texto', 'numero', 'decimal', 'boolean', 'lista', 'data'].map(t => (
                      <Select.Option key={t} value={t}>{t.toUpperCase()}</Select.Option>
                    ))}
                  </Select>
                </Form.Item>
                {estaEmUso && (
                  <Tooltip color="#ef4444" title="🟥 Nível Vermelho: Bloqueio estrutural! Este atributo já possui valores salvos em produtos. Mudar o tipo físico gerará desaparecimento ou incompatibilidade catastrófica nos dados salvos.">
                    <WarningOutlined style={{ color: '#ef4444', fontSize: '15px', cursor: 'pointer' }} />
                  </Tooltip>
                )}
              </Space>

              <Form.Item name="tipoComponenteUI" style={{ margin: 0 }}>
                <Select size="small" placeholder="UI Component">
                  <Select.Option value="input">Input Simples</Select.Option>
                  <Select.Option value="textarea">Área de Texto (TextArea)</Select.Option>
                  <Select.Option value="select">Dropdown de Seleção</Select.Option>
                  <Select.Option value="multiselect">Múltipla Escolha</Select.Option>
                  <Select.Option value="switch">Alternador (Switch)</Select.Option>
                  <Select.Option value="datepicker">Seletor de Data</Select.Option>
                </Select>
              </Form.Item>
            </Space>
          );
        }
        return (
          <Space direction="vertical" size={2}>
            <Space>
              <code>{tipo}</code>
              {unidade && <Text type="primary" strong>({unidade.simbolo})</Text>}
            </Space>
            <Tag color="purple" style={{ fontSize: 11 }}>UI: {(record as any).tipoComponenteUI || 'input'}</Tag>
          </Space>
        );
      }
    },
    {
      title: 'Regras & Valores',
      key: 'regras',
      render: (_: any, record: IAtributoGlobal) => {
        const isEditing = record.id === idAtributoEmEdicao;
        const estaEmUso = (record as any).emUso;

        if (isEditing) {
          return (
            <Space direction="vertical">
              <Form.Item name="obrigatorioPadrao" valuePropName="checked" style={{ margin: 0 }}>
                <Checkbox>Obrigatório</Checkbox>
              </Form.Item>
              <Form.Item name="pesquisavel" valuePropName="checked" style={{ margin: 0 }}>
                <Checkbox>Pesquisável</Checkbox>
              </Form.Item>

              {/* ROTEIRO AMARELO: Alerta sobre alteração de Unidade Física */}
              <Form.Item name="unidadeId" style={{ margin: 0, width: 140 }}>
                <Select size="small" placeholder="Unidade (FK)" allowClear>
                  {unidades.map(u => (
                    <Select.Option key={u.id} value={u.id}>{u.nome} ({u.simbolo})</Select.Option>
                  ))}
                </Select>
              </Form.Item>
              {estaEmUso && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <WarningOutlined style={{ color: '#d97706', fontSize: 11 }} />
                  <span style={{ fontSize: 9, color: '#d97706' }}>Unidade física não retroativa</span>
                </div>
              )}
            </Space>
          );
        }

        // Mapeamento corrigido baseado em 'atributos_comercial_opcoes' usando 'codigo' em vez de 'chave'
        const opcoes = (record as any).opcoesLista || [];
        const possuiOpcoes = opcoes.length > 0;

        return (
          <Space direction="vertical" size={4}>
            {possuiOpcoes ? (
              <div style={{ maxWidth: 220 }}>
                {opcoes.map((op: any) => (
                  <Tooltip key={op.codigo || op.chave} title={`Código do Banco: ${op.codigo || op.chave}`}>
                    <Tag color="cyan" style={{ marginBottom: 2, fontSize: 10 }}>{op.valor}</Tag>
                  </Tooltip>
                ))}
              </div>
            ) : (
              <Text type="secondary" italic style={{ fontSize: 11 }}>Valor Livre</Text>
            )}
            <Space>
              {record.obrigatorioPadrao && <Tag color="error">OBRIGATÓRIO</Tag>}
              <Tag color={record.pesquisavel ? 'processing' : 'default'}>{record.pesquisavel ? '🔍 BUSCA' : '🚫 INTRA'}</Tag>
            </Space>
          </Space>
        );
      }
    },
    {
      title: 'Ações',
      key: 'acoes',
      align: 'center' as const,
      render: (_: any, record: IAtributoGlobal) => {
        const isEditing = record.id === idAtributoEmEdicao;
        const estaEmUso = (record as any).emUso;

        if (isEditing) {
          return (
            <Space>
              <Button size="small" type="primary" shape="circle" icon={<CheckOutlined />} onClick={() => saveInlineEdit(record.id)} style={{ backgroundColor: '#16a34a' }} />
              <Button size="small" shape="circle" icon={<CloseOutlined />} onClick={cancelInlineEdit} />
            </Space>
          );
        }
        return (
          <Space>
            <Tooltip title="Editar Atributo"><Button type="text" icon={<EditOutlined />} onClick={() => startInlineEdit(record)} /></Tooltip>
            <Tooltip title={estaEmUso ? "🟥 Bloqueado: Atributo em uso ativo por produtos no catálogo" : "Excluir Atributo"}>
              <Button type="text" danger disabled={estaEmUso} icon={<DeleteOutlined />} onClick={() => handleDeletarAtributo(record)} />
            </Tooltip>
          </Space>
        );
      }
    }
  ];

  if (loading) {
    return (
      <Row justify="center" align="middle" style={{ minHeight: '80vh', flexDirection: 'column', gap: 16 }}>
        <Spin size="large" />
        <Title level={4} type="secondary">Sincronizando Dicionário PIM Corporativo...</Title>
      </Row>
    );
  }

  return (
    <div style={{ padding: '24px', background: '#f5f7fa', minHeight: '100vh' }}>

      {/* CONTROL HEADER */}
      <Card style={{ marginBottom: 24, borderRadius: 8 }}>
        <Row justify="space-between" align="middle">
          <Col>
            <Title level={3} style={{ margin: 0 }}>🌐 Dicionário de Atributos Globais (PIM)</Title>
            <Text type="secondary">Gerencie taxonomia, ordenação visual, renderização de UI e chaves comerciais de SKUs.</Text>
          </Col>
          <Col>
            <Space>
              <Button icon={<FolderAddOutlined />} onClick={() => setIsModalGrupoOpen(true)}>Criar Grupo Semântico</Button>
              <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsModalAtributoOpen(true)}>Novo Atributo Global</Button>
            </Space>
          </Col>
        </Row>
      </Card>

      <Row gutter={[24, 24]}>
        {/* SIDEBAR FILTERS */}
        <Col xs={24} md={6}>
          <Card title="Grupos Estruturais (Ordem de Exibição)" size="small" style={{ borderRadius: 8 }}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <div
                onClick={() => setGrupoAtivoFiltro('todos')}
                style={{
                  padding: '8px 12px', borderRadius: 4, cursor: 'pointer',
                  background: grupoAtivoFiltro === 'todos' ? '#e6f7ff' : '#fafafa',
                  border: `1px solid ${grupoAtivoFiltro === 'todos' ? '#1890ff' : '#d9d9d9'}`
                }}
              >
                <Row justify="space-between">
                  <Text strong={grupoAtivoFiltro === 'todos'}>🌟 Todos os Atributos</Text>
                  <Tag color="blue">{atributos.length}</Tag>
                </Row>
              </div>

              {grupos.map(g => {
                const qtd = atributos.filter(a => String(a.grupoId) === String(g.id)).length;
                const isSelected = grupoAtivoFiltro === String(g.id);
                return (
                  <div
                    key={g.id}
                    onClick={() => setGrupoAtivoFiltro(String(g.id))}
                    style={{
                      padding: '8px 12px', borderRadius: 4, cursor: 'pointer',
                      background: isSelected ? '#e6f7ff' : '#fff',
                      border: `1px solid ${isSelected ? '#1890ff' : '#f0f0f0'}`
                    }}
                  >
                    <Row justify="space-between" align="middle">
                      <Col span={14}>
                        <Space direction="vertical" size={0}>
                          <Text strong={isSelected}>{g.nome}</Text>
                          <Text type="secondary" style={{ fontSize: 10 }}>Posição: {(g as any).ordemExibicao || 0}</Text>
                        </Space>
                      </Col>
                      <Col span={10} style={{ textAlign: 'right' }}>
                        <Space size={2}>
                          <Tag>{qtd}</Tag>
                          <Button type="text" size="small" icon={<EditOutlined style={{ fontSize: 11 }} />} onClick={(e) => { e.stopPropagation(); handleIniciarEdicaoGrupo(g); }} />
                          <Button type="text" size="small" danger icon={<CloseOutlined style={{ fontSize: 11 }} />} onClick={(e) => { e.stopPropagation(); handleDeletarGrupo(g.id); }} />
                        </Space>
                      </Col>
                    </Row>
                  </div>
                );
              })}
            </Space>
          </Card>
        </Col>

        {/* DATA CONTAINER (TABLE) */}
        <Col xs={24} md={18}>
          <Space direction="vertical" style={{ width: '100%' }} size={16}>
            <Input
              size="large"
              placeholder="Filtrar atributos por nome ou código técnico..."
              prefix={<SearchOutlined />}
              value={buscaTexto}
              onChange={e => setBuscaTexto(e.target.value)}
              allowClear
            />

            <Form form={formEdicaoInline} component={false}>
              <Table
                dataSource={atributosExibidos}
                columns={columns}
                rowKey="id"
                pagination={{ pageSize: 10, showSizeChanger: true }}
                locale={{ emptyText: <Empty description="Nenhum atributo mapeado neste escopo" /> }}
                bordered
              />
            </Form>
          </Space>
        </Col>
      </Row>

      {/* MODALS */}
      {/* Modal Criar Grupo */}
      <Modal title="📁 Criar Grupo Semântico" open={isModalGrupoOpen} onCancel={() => { formCriarGrupo.resetFields(); setIsModalGrupoOpen(false); }} footer={null}>
        <Form form={formCriarGrupo} layout="vertical" onFinish={handleCriarGrupo} initialValues={{ ordemExibicao: 0 }}>
          <Row gutter={16}>
            <Col span={18}>
              <Form.Item name="nome" label="Nome do Grupo" rules={[{ required: true, message: 'Insira o nome do grupo!' }]}>
                <Input placeholder="Ex: Especificações Elétricas" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="ordemExibicao" label="Ordem (UI)">
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="descricao" label="Descrição">
            <Input.TextArea rows={2} placeholder="Ex: Agrupador de propriedades de voltagem, amperagem..." />
          </Form.Item>
          <Form.Item style={{ display: 'flex', justifyContent: 'flex-end', margin: 0 }}>
            <Button onClick={() => setIsModalGrupoOpen(false)} style={{ marginRight: 8 }}>Cancelar</Button>
            <Button type="primary" htmlType="submit" loading={isSaving}>Salvar Grupo</Button>
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal Criar Atributo */}
      <Modal title="🧬 Novo Atributo Estrutural PIM" open={isModalAtributoOpen} onCancel={() => { setIsModalAtributoOpen(false); setOpcoesLista([]); }} footer={null} width={680}>
        <Form form={formAtributo} layout="vertical" onFinish={handleCriarAtributo} initialValues={{ tipo: 'texto', tipoComponenteUI: 'input', escopoPadrao: 'ficha', pesquisavel: true, ordemExibicao: 0 }}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="grupoId" label="Grupo Vinculado" rules={[{ required: true, message: 'Selecione o grupo!' }]}>
                <Select placeholder="Selecione">
                  {grupos.map(g => <Select.Option key={g.id} value={g.id}>{g.nome}</Select.Option>)}
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="nome" label="Nome do Atributo" rules={[{ required: true, message: 'Insira o nome!' }]}>
                <Input placeholder="Ex: Diâmetro do Eixo" onChange={handleNomeAttrChange} />
              </Form.Item>
            </Col>
            <Col span={4}>
              <Form.Item name="ordemExibicao" label="Ordem (UI)">
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="codigo"
                label={
                  <Space>
                    <span>Código Técnico (Database Key)</span>
                    <Tooltip title="🟨 Alterar o código técnico após homologado pode quebrar APIs, ERPs ou integrações ativas. Use com cautela!">
                      <WarningOutlined style={{ color: '#eab308' }} />
                    </Tooltip>
                  </Space>
                }
                rules={[
                  { required: true, message: 'Insira o código!' },
                  { pattern: /^[a-z0-9_]+$/, message: 'Use apenas minúsculas, números e underlines.' }
                ]}
              >
                <Input placeholder="diametro_eixo" style={{ fontFamily: 'monospace', fontWeight: 'bold' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="tipoComponenteUI" label="Componente de Interface (UI Render)">
                <Select>
                  <Select.Option value="input">Caixa de Texto Padrão (Input)</Select.Option>
                  <Select.Option value="textarea">Área de Texto (TextArea)</Select.Option>
                  <Select.Option value="select">Seleção Única (Dropdown)</Select.Option>
                  <Select.Option value="multiselect">Múltipla Escolha (MultiSelect)</Select.Option>
                  <Select.Option value="switch">Booleano Alternador (Switch)</Select.Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                name="tipo"
                label={
                  <Space>
                    <span>Tipo de Dado</span>
                    <Tooltip title="🟥 Escolha sabiamente. Alterações posteriores com o atributo 'Em Uso' serão totalmente travadas para proteger o banco de dados.">
                      <WarningOutlined style={{ color: '#ef4444' }} />
                    </Tooltip>
                  </Space>
                }
              >
                <Select onChange={(val: TipoDadoAtributo) => setTipoAtributoSelecionado(val)}>
                  <Select.Option value="texto">Texto Livre</Select.Option>
                  <Select.Option value="numero">Inteiro (Integer)</Select.Option>
                  <Select.Option value="decimal">Float / Decimal</Select.Option>
                  <Select.Option value="boolean">Booleano</Select.Option>
                  <Select.Option value="lista">Dicionário / Lista</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="unidadeId" label="Unidade de Medida">
                <Select placeholder="Nenhuma" allowClear onChange={(val) => setUnidadeSelecionada(val)}>
                  {unidades.map(u => <Select.Option key={u.id} value={u.id}>{u.nome} ({u.simbolo})</Select.Option>)}
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="sufixo" label="Sufixo Fixo Manual">
                <Input placeholder="Ex: RPM, BAR" disabled={!!unidadeSelecionada} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="ajudaContextual" label="Texto de Ajuda Contextual (Tooltip do Operador)">
            <Input placeholder="Instrua o operador de catálogo sobre como preencher este campo corretamente." />
          </Form.Item>

          {/* DYNAMIC KEY/VALUE LIST OPTIONS MAPPING */}
          {tipoAtributoSelecionado === 'lista' && (
            <Card size="small" title="Mapeamento Comercial da Lista (Chave / Valor)" style={{ marginBottom: 20, borderColor: '#ffd591', background: '#fffbe6' }}>
              <Row gutter={8} align="middle" style={{ marginBottom: 12 }}>
                <Col span={11}>
                  <Input placeholder="Valor Comercial (Ex: 10 Milímetros)" value={inputValorOpcao} onChange={handleValorOpcaoChange} />
                </Col>
                <Col span={9}>
                  <Input placeholder="Chave Interna (Ex: 10_mm)" value={inputChaveOpcao} onChange={e => setInputChaveOpcao(e.target.value)} style={{ fontFamily: 'monospace' }} />
                </Col>
                <Col span={4}>
                  <Button type="dashed" block icon={<PlusOutlined />} onClick={handleAdicionarOpcao}>Add</Button>
                </Col>
              </Row>
              <div>
                {opcoesLista.map(op => (
                  <Tag key={op.chave} closable onClose={() => handleRemoverOpcao(op.chave)} style={{ padding: '4px 8px', marginBottom: 4 }}>
                    <strong>{op.valor}</strong> <span style={{ color: '#919eab', fontSize: 10 }}>({op.chave})</span>
                  </Tag>
                ))}
                {opcoesLista.length === 0 && <Text type="secondary" italic style={{ fontSize: 12 }}>Nenhuma opção comercial mapeada ainda.</Text>}
              </div>
            </Card>
          )}

          <Space style={{ marginBottom: 24 }}>
            <Form.Item name="obrigatorioPadrao" valuePropName="checked" noStyle><Checkbox>Obrigatório no Cadastro</Checkbox></Form.Item>
            <Form.Item name="pesquisavel" valuePropName="checked" noStyle><Checkbox>Indexar para Filtros e Busca</Checkbox></Form.Item>
          </Space>

          <Form.Item style={{ display: 'flex', justifyContent: 'flex-end', margin: 0 }}>
            <Button onClick={() => setIsModalAtributoOpen(false)} style={{ marginRight: 8 }}>Cancelar</Button>
            <Button type="primary" htmlType="submit" loading={isSaving}>Criar Atributo</Button>
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal Editar Grupo */}
      <Modal title="✏️ Editar Grupo Semântico" open={isModalEditarGrupoOpen} onCancel={() => setIsModalEditarGrupoOpen(false)} footer={null}>
        <Form form={formEditarGrupo} layout="vertical" onFinish={handleSalvarEdicaoGrupo}>
          <Row gutter={16}>
            <Col span={18}>
              <Form.Item name="nome" label="Nome do Grupo" rules={[{ required: true, message: 'Obrigatório' }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="ordemExibicao" label="Ordem (UI)">
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="descricao" label="Descrição">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item style={{ display: 'flex', justifyContent: 'flex-end', margin: 0 }}>
            <Button onClick={() => setIsModalEditarGrupoOpen(false)} style={{ marginRight: 8 }}>Cancelar</Button>
            <Button type="primary" htmlType="submit" loading={isSaving}>Salvar Alterações</Button>
          </Form.Item>
        </Form>
      </Modal>

    </div>
  );
};








// 🚀 O que falta para ser "Inabalável"? (A Visão de Backend)

// O seu componente em React está pronto. Ele entrega todas as informações que um sistema de nível enterprise precisa. No entanto, para o ecossistema funcionar sem gargalos, o seu Backend / Banco de Dados precisa sustentar o que o front está enviando.

// Se você quiser dar o passo final rumo à arquitetura sênior, certifique-se de que o seu backend implemente estas duas regras:
// 1. Modelagem EAV (Entity-Attribute-Value) no Banco

// Como os atributos são dinâmicos (o usuário cria o que quiser), o banco de dados não pode ter colunas fixas para eles. O backend deve mapear isso em tabelas pivot:

//     produtos (id, sku, nome)

//     atributos_globais (id, codigo, tipo, tipo_componente_ui)

//     produto_valores (produto_id, atributo_id, valor_salvo)

// 2. Carga Genérica dos Componentes no Formulário do Produto

// Quando você for criar a tela de Cadastro de Produto, você fará um GET nos atributos daquele grupo e usará um mapeamento dinâmico para renderizar o Ant Design baseado no que o seu gerenciador salvou:
// TypeScript

// // Exemplo lógico de como o seu outro componente lerá esses dados:
// {atributo.tipoComponenteUI === 'switch' && <Switch />}
// {atributo.tipoComponenteUI === 'multiselect' && <Select mode="multiple" options={atributo.opcoesLista.map(o => ({ value: o.chave, label: o.valor }))} />}

// Se o seu backend estiver seguindo essa mesma linha de raciocínio, você não precisa fazer mais nada no gerenciador de atributos. O sistema está altamente profissional, escalável e pronto para rodar em cenários multimilionários de catálogo.