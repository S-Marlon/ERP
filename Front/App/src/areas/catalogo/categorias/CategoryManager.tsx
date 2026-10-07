import React, { useState, useMemo, useEffect } from 'react';
import {
  Layout, Tree, TreeSelect, Button, Row, Col, Input, InputNumber, Select, Switch, Table, Space, Spin, Card, Tag,
  message, Modal, Tooltip, Badge, Breadcrumb
} from 'antd';
import {
  PlusOutlined, DeleteOutlined, SaveOutlined, DeploymentUnitOutlined, CloseOutlined, ThunderboltOutlined,
  InfoCircleOutlined, FileTextOutlined, SafetyCertificateOutlined, StopOutlined, UndoOutlined, BranchesOutlined
} from '@ant-design/icons';
import { Categoria, AtributoHerdavel } from './CategoryManager.types';
import UsoCategoriaPainel from './UsoCategoriaPainel';
import {
  getCategories, createCategory, updateCategory, deleteCategory, getAtributosGlobais, getGruposAtributos,
  getUnidadesMedida, createAtributoRapido
} from './categoryService';
import {
  AtributoEfetivoCategoria, alterarAtributoNaCategoria, cadeiaCategorias, idsDescendentes, visaoAtributosCategoria
} from './categoriaHeranca';

const { Sider, Content } = Layout;
const tenantIdGlobal = 1;

type Papel = 'dna' | 'grade' | 'ficha';

interface AtributoGlobalOpc {
  id: string;
  nome: string;
  tipo: string;
  grupo_id?: number;
  unidade_id?: number;
  sufixo?: string;
  escopoPadrao?: Papel;
}

interface GrupoAtributoBanco { id: number; nome: string; descricao?: string }
interface UnidadeMedidaBanco { id: number; nome: string; simbolo: string }

const PAPEIS: Record<Papel, { label: string; cor: string; tag: string; ajuda: string }> = {
  dna: { label: 'DNA', cor: '#0891b2', tag: 'cyan', ajuda: 'Identidade da família: o valor é fixado na família e vale para todos os itens dela.' },
  grade: { label: 'Grade', cor: '#7c3aed', tag: 'purple', ajuda: 'Varia item a item dentro da família (medidas, cor, voltagem).' },
  ficha: { label: 'Ficha', cor: '#2563eb', tag: 'blue', ajuda: 'Informação técnica complementar do item.' },
};

const SITUACAO: Record<AtributoEfetivoCategoria['situacao'], { cor: string; texto: (origem?: string) => string }> = {
  proprio: { cor: 'green', texto: () => 'Próprio' },
  herdado: { cor: 'default', texto: origem => `Herdado de ${origem || 'categoria pai'}` },
  ajustado: { cor: 'gold', texto: origem => `Ajustado aqui (vem de ${origem || 'categoria pai'})` },
};

const gerarSlug = (texto: string): string => String(texto || '')
  .toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');

const verificarSePaiInativo = (idPai: string | null, listaCategorias: Categoria[]): boolean => {
  const cadeia = cadeiaCategorias(listaCategorias, idPai);
  return cadeia.some(c => !c.ativa);
};

const useCategoryState = () => {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [categoriaSelecionadaId, setCategoriaSelecionadaId] = useState<string | null>(null);
  const [alteradas, setAlteradas] = useState<Set<string>>(new Set());
  const [atributosGlobais, setAtributosGlobais] = useState<AtributoGlobalOpc[]>([]);
  const [gruposDisponiveis, setGruposDisponiveis] = useState<GrupoAtributoBanco[]>([]);
  const [unidadesMedida, setUnidadesMedida] = useState<UnidadeMedidaBanco[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [mostrarCriarRapido, setMostrarCriarRapido] = useState<boolean>(false);
  const [novoAttrRapido, setNovoAttrRapido] = useState({
    nome: '',
    tipo: 'texto',
    grupo_id: undefined as number | undefined,
    unidade_id: undefined as number | undefined
  });

  const categoriaSelecionada = useMemo(
    () => categorias.find(c => c.id === categoriaSelecionadaId) || null,
    [categorias, categoriaSelecionadaId]
  );

  // Recarrega do servidor preservando as categorias com alterações ainda não salvas
  const carregarCategoriasDoServidor = async (preservar: Set<string> = new Set()) => {
    try {
      const [dados, attrsGlobais, grupos, unidades] = await Promise.all([
        getCategories(tenantIdGlobal),
        getAtributosGlobais(tenantIdGlobal),
        getGruposAtributos(tenantIdGlobal),
        getUnidadesMedida(tenantIdGlobal),
      ]);
      setCategorias(prev => {
        const locais = prev.filter(c => preservar.has(c.id));
        return [...dados.map(d => locais.find(l => l.id === d.id) || d), ...locais.filter(l => l.id.startsWith('temp-'))];
      });
      setAtributosGlobais(attrsGlobais as any);
      setGruposDisponiveis(grupos);
      setUnidadesMedida(unidades);
      setCategoriaSelecionadaId(atual => atual ?? (dados[0]?.id || null));
    } catch (err: any) {
      message.error(`Falha de conexão: ${err.message || 'Não foi possível carregar as categorias.'}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarCategoriasDoServidor();
  }, []);

  const alterarCategoriaSelecionada = (fn: (c: Categoria) => Categoria) => {
    if (!categoriaSelecionadaId) return;
    setCategorias(prev => prev.map(c => (c.id === categoriaSelecionadaId ? fn(c) : c)));
    setAlteradas(prev => new Set(prev).add(categoriaSelecionadaId));
  };

  const handleAtualizarCategoria = (campo: keyof Categoria, valor: any) => {
    alterarCategoriaSelecionada(c => (campo === 'nome' ? { ...c, nome: valor, slug: gerarSlug(valor) } : { ...c, [campo]: valor }));
  };

  // Papel, obrigatório, sufixo: em atributo herdado cria o ajuste local
  const handleAlterarAtributo = (atributoId: string, mudancas: Partial<AtributoHerdavel>) => {
    if (!categoriaSelecionadaId) return;
    alterarCategoriaSelecionada(c => ({
      ...c,
      atributosHeranca: alterarAtributoNaCategoria(categorias, c.id, atributoId, mudancas),
    }));
  };

  // Tira o vínculo local: próprio sai da categoria; ajustado volta ao herdado; bloqueado volta a ser usado
  const handleRemoverVinculoLocal = (atributoId: string) => {
    alterarCategoriaSelecionada(c => ({ ...c, atributosHeranca: (c.atributosHeranca || []).filter(a => a.id !== atributoId) }));
  };

  const handleNaoUsarNesteRamo = (atributoId: string) => {
    handleAlterarAtributo(atributoId, { bloqueado: true });
  };

  const vinculoDoGlobal = (attrGlobal: AtributoGlobalOpc, ordem: number): AtributoHerdavel => ({
    id: String(attrGlobal.id),
    nome: attrGlobal.nome,
    tipoDado: attrGlobal.tipo as any,
    sufixo: attrGlobal.sufixo || '',
    formatoSufixo: '',
    unidadeSimbolo: attrGlobal.sufixo || '',
    escopoComercial: attrGlobal.escopoPadrao || 'ficha',
    pesquisavel: true,
    obrigatorio: false,
    herdar: attrGlobal.escopoPadrao === 'dna',
    sobrescreve: false,
    bloqueado: false,
    ordem,
    exemplos: '',
  });

  const handleAdicionarAtributos = (ids: string[], jaNaCategoria: Set<string>) => {
    const novos = ids
      .filter(id => !jaNaCategoria.has(id))
      .map(id => atributosGlobais.find(a => String(a.id) === String(id)))
      .filter(Boolean) as AtributoGlobalOpc[];
    if (novos.length === 0) return 0;
    alterarCategoriaSelecionada(c => {
      const locais = (c.atributosHeranca || []).filter(a => !novos.some(n => String(n.id) === a.id));
      return { ...c, atributosHeranca: [...locais, ...novos.map((n, i) => vinculoDoGlobal(n, locais.length + i + 1))] };
    });
    return novos.length;
  };

  const handleCriarEAssociarAtributoRapido = async () => {
    if (!novoAttrRapido.nome.trim()) return message.error('Informe o nome do atributo.');
    setSaving(true);
    try {
      const resp = await createAtributoRapido({
        nome: novoAttrRapido.nome.trim(),
        tipo: novoAttrRapido.tipo as any,
        grupo_id: novoAttrRapido.grupo_id,
        unidade_id: novoAttrRapido.unidade_id,
      }, tenantIdGlobal);
      const unidade = unidadesMedida.find(u => u.id === novoAttrRapido.unidade_id);
      const criado: AtributoGlobalOpc = {
        id: String(resp.id),
        nome: novoAttrRapido.nome.trim(),
        tipo: novoAttrRapido.tipo,
        grupo_id: novoAttrRapido.grupo_id,
        unidade_id: novoAttrRapido.unidade_id,
        sufixo: unidade?.simbolo || '',
        escopoPadrao: 'ficha',
      };
      setAtributosGlobais(prev => [...prev, criado]);
      alterarCategoriaSelecionada(c => ({
        ...c,
        atributosHeranca: [...(c.atributosHeranca || []), vinculoDoGlobal(criado, (c.atributosHeranca?.length || 0) + 1)],
      }));
      setNovoAttrRapido({ nome: '', tipo: 'texto', grupo_id: undefined, unidade_id: undefined });
      setMostrarCriarRapido(false);
      message.success('Atributo criado no dicionário e vinculado. Salve a categoria para gravar o vínculo.');
    } catch (err: any) {
      message.error(err?.message || 'Erro ao criar o atributo.');
    } finally {
      setSaving(false);
    }
  };

  const handleSalvarNoServidor = async () => {
    if (!categoriaSelecionada) return;
    if (!categoriaSelecionada.nome.trim()) return message.error('Informe o nome da categoria.');
    setSaving(true);
    try {
      const payload = {
        nome: categoriaSelecionada.nome,
        parentId: categoriaSelecionada.parentId,
        ativa: categoriaSelecionada.ativa,
        percentualMargemSugerida: categoriaSelecionada.percentualMargemSugerida,
        modoExibicao: categoriaSelecionada.modoExibicao,
        descricao: categoriaSelecionada.descricao,
        atributosHeranca: categoriaSelecionada.atributosHeranca,
      };
      const restantes = new Set(alteradas);
      restantes.delete(categoriaSelecionada.id);

      if (categoriaSelecionada.id.startsWith('temp-')) {
        const resposta = await createCategory(payload as any, tenantIdGlobal);
        setCategorias(prev => prev.filter(c => c.id !== categoriaSelecionada.id));
        await carregarCategoriasDoServidor(restantes);
        setCategoriaSelecionadaId(String(resposta.id));
        message.success('Categoria criada.');
      } else {
        await updateCategory(categoriaSelecionada.id, payload as any, tenantIdGlobal);
        await carregarCategoriasDoServidor(restantes);
        message.success('Alterações salvas.');
      }
      setAlteradas(restantes);
    } catch (err: any) {
      Modal.error({ title: 'Não foi possível salvar', content: err.message || 'O servidor rejeitou as alterações.' });
    } finally {
      setSaving(false);
    }
  };

  const handleDescartarAlteracoes = async () => {
    if (!categoriaSelecionada) return;
    const restantes = new Set(alteradas);
    restantes.delete(categoriaSelecionada.id);
    if (categoriaSelecionada.id.startsWith('temp-')) {
      setCategorias(prev => prev.filter(c => c.id !== categoriaSelecionada.id));
      setCategoriaSelecionadaId(categoriaSelecionada.parentId);
    } else {
      await carregarCategoriasDoServidor(restantes);
    }
    setAlteradas(restantes);
  };

  const handleDeletarNoServidor = (categoria: Categoria) => {
    const subcategorias = categorias.filter(c => c.parentId === categoria.id).length;
    const pendencias = [
      subcategorias ? `${subcategorias} subcategoria(s)` : '',
      categoria.qtdFamilias ? `${categoria.qtdFamilias} família(s)` : '',
      categoria.qtdProdutos ? `${categoria.qtdProdutos} produto(s)` : '',
    ].filter(Boolean);
    if (pendencias.length > 0) {
      Modal.warning({
        title: 'Categoria em uso',
        content: `"${categoria.nome}" ainda tem ${pendencias.join(', ')}. Mova-os para outra categoria antes de excluir.`,
      });
      return;
    }

    Modal.confirm({
      title: `Excluir a categoria "${categoria.nome}"?`,
      content: 'Os vínculos de atributos desta categoria também serão removidos. Esta ação não pode ser desfeita.',
      okText: 'Excluir',
      okType: 'danger',
      cancelText: 'Cancelar',
      onOk: async () => {
        setSaving(true);
        try {
          await deleteCategory(categoria.id, tenantIdGlobal);
          message.success('Categoria removida.');
          setCategorias(prev => prev.filter(c => c.id !== categoria.id));
          setCategoriaSelecionadaId(categoria.parentId);
          const restantes = new Set(alteradas);
          restantes.delete(categoria.id);
          setAlteradas(restantes);
          await carregarCategoriasDoServidor(restantes);
        } catch (err: any) {
          Modal.error({ title: 'Não foi possível excluir', content: err.message || 'Erro ao excluir a categoria.' });
        } finally {
          setSaving(false);
        }
      }
    });
  };

  const handleAdicionarCategoriaNova = (parentId: string | null) => {
    const nova: Categoria = {
      id: `temp-${Date.now()}`,
      tenantId: tenantIdGlobal,
      nome: parentId ? 'Nova Subcategoria' : 'Nova Categoria',
      slug: '',
      ativa: true,
      ordem: categorias.length + 1,
      percentualMargemSugerida: null,
      modoExibicao: 'grade',
      parentId,
      descricao: '',
      atributosHeranca: [],
    };
    setCategorias(prev => [...prev, nova]);
    setCategoriaSelecionadaId(nova.id);
    setAlteradas(prev => new Set(prev).add(nova.id));
  };

  return {
    categorias, categoriaSelecionada, categoriaSelecionadaId, setCategoriaSelecionadaId, alteradas,
    atributosGlobais, gruposDisponiveis, unidadesMedida, loading, saving,
    mostrarCriarRapido, setMostrarCriarRapido, novoAttrRapido, setNovoAttrRapido,
    handleAtualizarCategoria, handleAlterarAtributo, handleRemoverVinculoLocal, handleNaoUsarNesteRamo,
    handleAdicionarAtributos, handleCriarEAssociarAtributoRapido, handleSalvarNoServidor, handleDescartarAlteracoes,
    handleDeletarNoServidor, handleAdicionarCategoriaNova,
    // Recarrega as contagens da árvore sem perder o que está em edição
    recarregarContagens: () => carregarCategoriasDoServidor(alteradas),
  };
};

const rotulo = (texto: string) => (
  <span style={{ fontSize: '11px', fontWeight: 600, display: 'block', marginBottom: 4, color: '#475569' }}>{texto}</span>
);

export const CategoryManager: React.FC = () => {
  const state = useCategoryState();
  const [atributosParaAdicionar, setAtributosParaAdicionar] = useState<string[]>([]);
  const cat = state.categoriaSelecionada;

  const visao = useMemo(
    () => visaoAtributosCategoria(state.categorias, state.categoriaSelecionadaId),
    [state.categorias, state.categoriaSelecionadaId]
  );

  // Atributos já presentes (efetivos, ajustes ou bloqueios) não aparecem para adicionar
  const idsNaCategoria = useMemo(() => new Set([
    ...visao.atributos.map(a => a.id),
    ...visao.bloqueadosAqui.map(a => a.id),
  ]), [visao]);

  const opcoesAtributos = useMemo(() => state.atributosGlobais
    .filter(a => !idsNaCategoria.has(String(a.id)))
    .sort((a, b) => a.nome.localeCompare(b.nome))
    .map(a => ({
      value: String(a.id),
      label: `${a.nome}${a.sufixo ? ` (${a.sufixo})` : ''} · ${a.tipo}`,
    })), [state.atributosGlobais, idsNaCategoria]);

  const buildTreeData = (parentId: string | null): any[] => state.categorias
    .filter(c => c.parentId === parentId)
    .map(c => ({
      title: (
        <Space size={4}>
          <span style={{ fontWeight: state.categoriaSelecionadaId === c.id ? 700 : 400 }}>{c.nome}</span>
          {(!c.ativa || verificarSePaiInativo(c.parentId, state.categorias)) && <Tag color="warning" style={{ fontSize: 10 }}>Inativo</Tag>}
          {state.alteradas.has(c.id) && <Tooltip title="Alterações não salvas"><Badge status="processing" /></Tooltip>}
        </Space>
      ),
      key: c.id,
      children: buildTreeData(c.id),
    }));

  const treeData = useMemo(() => buildTreeData(null), [state.categorias, state.categoriaSelecionadaId, state.alteradas]);

  // Pai possível: qualquer categoria fora da subárvore da selecionada
  const treeDataPai = useMemo(() => {
    if (!cat) return [];
    const bloqueados = idsDescendentes(state.categorias, cat.id);
    const montar = (parentId: string | null): any[] => state.categorias
      .filter(c => c.parentId === parentId && !c.id.startsWith('temp-'))
      .map(c => ({ title: c.nome, value: c.id, disabled: bloqueados.has(c.id), children: montar(c.id) }));
    return montar(null);
  }, [state.categorias, cat?.id]);

  if (state.loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', gap: '12px' }}>
        <Spin size="large" />
        <span>Carregando categorias...</span>
      </div>
    );
  }

  const colunasTabela = [
    {
      title: 'Atributo',
      dataIndex: 'nome',
      key: 'nome',
      render: (nome: string, record: AtributoEfetivoCategoria) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontWeight: 600, color: '#0f172a', fontSize: '12px' }}>{nome}</span>
          <span>
            <Tag color={SITUACAO[record.situacao].cor} style={{ fontSize: 10, margin: 0 }}>
              {SITUACAO[record.situacao].texto(record.origemNome)}
            </Tag>
            <span style={{ fontSize: 10, color: '#94a3b8', marginLeft: 6 }}>{record.tipoDado}</span>
          </span>
        </div>
      )
    },
    {
      title: 'Papel',
      key: 'papel',
      width: 105,
      render: (_: unknown, record: AtributoEfetivoCategoria) => (
        <Select
          size="small"
          style={{ width: '100%' }}
          value={record.escopoComercial}
          onChange={(v: Papel) => state.handleAlterarAtributo(record.id, { escopoComercial: v, herdar: v === 'dna' })}
          options={(Object.keys(PAPEIS) as Papel[]).map(p => ({ value: p, label: PAPEIS[p].label }))}
        />
      )
    },
    {
      title: <Tooltip title="Item/família não fica completo sem este valor">Obrig.</Tooltip>,
      key: 'obrigatorio',
      width: 60,
      align: 'center' as const,
      render: (_: unknown, record: AtributoEfetivoCategoria) => (
        <Switch size="small" checked={record.obrigatorio} onChange={v => state.handleAlterarAtributo(record.id, { obrigatorio: v })} />
      )
    },
    {
      title: <Tooltip title="Vazio = usa o símbolo da unidade do atributo">Sufixo</Tooltip>,
      key: 'sufixo',
      width: 90,
      render: (_: unknown, record: AtributoEfetivoCategoria) => (
        <Input
          size="small"
          value={record.formatoSufixo || ''}
          placeholder={record.unidadeSimbolo || 'ex: mm'}
          maxLength={30}
          onChange={e => state.handleAlterarAtributo(record.id, { formatoSufixo: e.target.value })}
        />
      )
    },
    {
      title: '',
      key: 'acoes',
      width: 44,
      align: 'center' as const,
      render: (_: unknown, record: AtributoEfetivoCategoria) => {
        if (record.situacao === 'proprio') {
          return (
            <Tooltip title="Remover desta categoria (sai também das subcategorias)">
              <Button type="text" danger size="small" icon={<CloseOutlined />} onClick={() => state.handleRemoverVinculoLocal(record.id)} />
            </Tooltip>
          );
        }
        return (
          <Space size={0}>
            {record.situacao === 'ajustado' && (
              <Tooltip title="Desfazer o ajuste e voltar à configuração herdada">
                <Button type="text" size="small" icon={<UndoOutlined />} onClick={() => state.handleRemoverVinculoLocal(record.id)} />
              </Tooltip>
            )}
            <Tooltip title="Não usar neste ramo (esta categoria e as abaixo dela)">
              <Button type="text" danger size="small" icon={<StopOutlined />} onClick={() => state.handleNaoUsarNesteRamo(record.id)} />
            </Tooltip>
          </Space>
        );
      }
    },
  ];

  const tabela = (papel: Papel, titulo: string, icone: React.ReactNode) => {
    const lista = visao.atributos.filter(a => a.escopoComercial === papel);
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <Tooltip title={PAPEIS[papel].ajuda}>
            <Tag color={PAPEIS[papel].tag} icon={icone} style={{ fontWeight: 700, margin: 0, padding: '2px 8px' }}>{titulo}</Tag>
          </Tooltip>
          <span style={{ fontSize: '11px', color: '#64748b' }}>{lista.length} atributo(s)</span>
        </div>
        <Table
          dataSource={lista}
          columns={colunasTabela}
          rowKey="id"
          pagination={false}
          size="small"
          bordered
          locale={{ emptyText: `Nenhum atributo de ${PAPEIS[papel].label}.` }}
        />
      </div>
    );
  };

  const cadeia = cat ? cadeiaCategorias(state.categorias, cat.id) : [];
  const alterada = cat ? state.alteradas.has(cat.id) : false;

  return (
    <Layout style={{ minHeight: '100vh', background: '#f8fafc' }}>

      {/* ÁRVORE */}
      <Sider width={350} theme="light" style={{ padding: '16px 12px', borderRight: '1px solid #e2e8f0', background: '#ffffff' }}>
        <Space direction="vertical" style={{ width: '100%' }} size={12}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Categorias
            </span>
            <Badge count={state.categorias.length} style={{ backgroundColor: '#0284c7' }} />
          </div>
          <Button type="primary" block icon={<PlusOutlined />} onClick={() => state.handleAdicionarCategoriaNova(null)}
            style={{ backgroundColor: '#0f766e', borderColor: '#0f766e', fontWeight: 600 }}>
            Nova Categoria Raiz
          </Button>
          <div style={{ border: '1px solid #f1f5f9', borderRadius: '8px', padding: '8px', maxHeight: 'calc(100vh - 140px)', overflowY: 'auto', background: '#fafafa' }}>
            <Tree
              treeData={treeData}
              selectedKeys={state.categoriaSelecionadaId ? [state.categoriaSelecionadaId] : []}
              onSelect={(keys) => keys.length > 0 && state.setCategoriaSelecionadaId(keys[0] as string)}
              defaultExpandAll
            />
          </div>
        </Space>
      </Sider>

      {/* ÁREA CENTRAL */}
      <Content style={{ padding: '8px', flex: 1, overflowY: 'auto' }}>
        {cat ? (
          <Space direction="vertical" style={{ width: '100%' }} size={8}>

            {/* DADOS DA CATEGORIA */}
            <Card size="small" style={{ borderRadius: '6px', border: '1px solid #e2e8f0' }}
              title={
                <Space>
                  <DeploymentUnitOutlined style={{ color: '#166534' }} />
                  <Breadcrumb items={cadeia.map(c => ({ title: c.nome }))} />
                  {alterada && <Tag color="processing">Não salvo</Tag>}
                </Space>
              }
              extra={
                <Space>
                  <Tag color={cat.ativa ? 'success' : 'error'}>{cat.ativa ? 'Ativa' : 'Inativa'}</Tag>
                  {!cat.id.startsWith('temp-') && (
                    <Button size="small" icon={<BranchesOutlined />} onClick={() => state.handleAdicionarCategoriaNova(cat.id)}>
                      Nova Subcategoria
                    </Button>
                  )}
                </Space>
              }
            >
              <Row gutter={[12, 10]}>
                <Col xs={24} md={9}>
                  {rotulo('Nome')}
                  <Input value={cat.nome} maxLength={120} onChange={e => state.handleAtualizarCategoria('nome', e.target.value)} />
                  <span style={{ fontSize: 11, color: '#64748b', fontFamily: 'monospace' }}>/{cat.slug || gerarSlug(cat.nome)}</span>
                </Col>
                <Col xs={24} md={9}>
                  {rotulo('Categoria pai')}
                  <TreeSelect
                    style={{ width: '100%' }}
                    allowClear
                    placeholder="Raiz (sem pai)"
                    treeData={treeDataPai}
                    treeDefaultExpandAll
                    value={cat.parentId || undefined}
                    onChange={v => state.handleAtualizarCategoria('parentId', v || null)}
                  />
                </Col>
                <Col xs={12} md={3}>
                  {rotulo('Ativa')}
                  <Switch checked={cat.ativa} onChange={v => state.handleAtualizarCategoria('ativa', v)} />
                </Col>
                <Col xs={12} md={3}>
                  {rotulo('Margem sug. %')}
                  <InputNumber style={{ width: '100%' }} min={0} max={1000} value={cat.percentualMargemSugerida ?? undefined}
                    onChange={v => state.handleAtualizarCategoria('percentualMargemSugerida', v ?? null)} />
                </Col>
                <Col xs={24} md={18}>
                  {rotulo('Descrição')}
                  <Input.TextArea rows={2} value={cat.descricao} onChange={e => state.handleAtualizarCategoria('descricao', e.target.value)} />
                </Col>
                <Col xs={24} md={6}>
                  {rotulo('Exibição na vitrine')}
                  <Select style={{ width: '100%' }} value={cat.modoExibicao} onChange={v => state.handleAtualizarCategoria('modoExibicao', v)}
                    options={[{ value: 'grade', label: 'Grade' }, { value: 'lista', label: 'Lista' }, { value: 'carrossel', label: 'Carrossel' }]} />
                </Col>
              </Row>
            </Card>

            {/* ATRIBUTOS */}
            <Card size="small" style={{ borderRadius: '6px', border: '1px solid #e2e8f0' }}
              title={<span style={{ fontSize: 13, fontWeight: 700 }}>Atributos desta categoria</span>}
              extra={
                <Space wrap>
                  <Select
                    size="small"
                    style={{ width: 170 }}
                    placeholder="Incluir grupo inteiro..."
                    showSearch
                    optionFilterProp="label"
                    value={null}
                    onChange={(grupoId) => {
                      const ids = state.atributosGlobais.filter(a => String(a.grupo_id) === String(grupoId)).map(a => String(a.id));
                      const n = state.handleAdicionarAtributos(ids, idsNaCategoria);
                      if (n > 0) message.success(`${n} atributo(s) do grupo incluídos.`);
                      else message.info('Todos os atributos do grupo já estão nesta categoria.');
                    }}
                    options={state.gruposDisponiveis.map(g => ({ value: g.id, label: g.nome }))}
                  />
                  <Button size="small" type={state.mostrarCriarRapido ? 'primary' : 'dashed'} icon={<ThunderboltOutlined />}
                    onClick={() => state.setMostrarCriarRapido(!state.mostrarCriarRapido)}>
                    {state.mostrarCriarRapido ? 'Fechar' : 'Criar atributo novo'}
                  </Button>
                </Space>
              }
            >
              <Space direction="vertical" style={{ width: '100%' }} size={12}>
                <div style={{ fontSize: 11, color: '#166534', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6, padding: '6px 10px' }}>
                  <InfoCircleOutlined /> Os atributos descem para as subcategorias e famílias. Numa subcategoria, mudar papel, obrigatório ou sufixo
                  de um herdado cria um <b>ajuste</b> que vale dali para baixo; <StopOutlined /> tira o atributo daquele ramo.
                </div>

                <Space.Compact style={{ width: '100%' }}>
                  <Select
                    mode="multiple"
                    style={{ width: '100%' }}
                    placeholder="Adicionar atributos do dicionário..."
                    showSearch
                    optionFilterProp="label"
                    value={atributosParaAdicionar}
                    onChange={setAtributosParaAdicionar}
                    options={opcoesAtributos}
                    maxTagCount="responsive"
                  />
                  <Button type="primary" icon={<PlusOutlined />} disabled={atributosParaAdicionar.length === 0}
                    onClick={() => { state.handleAdicionarAtributos(atributosParaAdicionar, idsNaCategoria); setAtributosParaAdicionar([]); }}>
                    Adicionar
                  </Button>
                </Space.Compact>

                {state.mostrarCriarRapido && (
                  <Card size="small" title={<span style={{ fontSize: '12px', fontWeight: 600, color: '#db2777' }}>Cadastro rápido no dicionário de atributos</span>}
                    style={{ background: '#fff1f2', borderColor: '#fecdd3' }}>
                    <Row gutter={[12, 12]} align="bottom">
                      <Col xs={24} sm={12} md={7}>
                        {rotulo('Nome')}
                        <Input size="small" placeholder="Ex: Espessura" value={state.novoAttrRapido.nome}
                          onChange={e => state.setNovoAttrRapido(p => ({ ...p, nome: e.target.value }))} />
                      </Col>
                      <Col xs={12} sm={6} md={4}>
                        {rotulo('Tipo')}
                        <Select size="small" style={{ width: '100%' }} value={state.novoAttrRapido.tipo}
                          onChange={val => state.setNovoAttrRapido(p => ({ ...p, tipo: val }))}
                          options={[
                            { value: 'texto', label: 'Texto' }, { value: 'numero', label: 'Número' },
                            { value: 'decimal', label: 'Decimal' }, { value: 'boolean', label: 'Sim/Não' },
                          ]} />
                      </Col>
                      <Col xs={12} sm={6} md={5}>
                        {rotulo('Grupo')}
                        <Select size="small" style={{ width: '100%' }} placeholder="Grupo" allowClear value={state.novoAttrRapido.grupo_id}
                          onChange={val => state.setNovoAttrRapido(p => ({ ...p, grupo_id: val }))}
                          options={state.gruposDisponiveis.map(g => ({ value: g.id, label: g.nome }))} />
                      </Col>
                      <Col xs={24} sm={12} md={4}>
                        {rotulo('Unidade')}
                        <Select size="small" style={{ width: '100%' }} placeholder="Unidade" allowClear value={state.novoAttrRapido.unidade_id}
                          onChange={val => state.setNovoAttrRapido(p => ({ ...p, unidade_id: val }))}
                          options={state.unidadesMedida.map(u => ({ value: u.id, label: u.simbolo }))} />
                      </Col>
                      <Col xs={24} sm={12} md={4}>
                        <Button size="small" type="primary" block loading={state.saving} style={{ background: '#db2777', borderColor: '#db2777' }}
                          onClick={state.handleCriarEAssociarAtributoRapido}>
                          Criar e vincular
                        </Button>
                      </Col>
                    </Row>
                    <span style={{ fontSize: 11, color: '#9f1239' }}>Para atributos de lista (com opções), use o Gerenciador de Atributos.</span>
                  </Card>
                )}

                {tabela('dna', 'DNA', <DeploymentUnitOutlined />)}
                <Row gutter={8}>
                  <Col xs={24} xl={12}>{tabela('grade', 'GRADE E VARIANTES', <ThunderboltOutlined />)}</Col>
                  <Col xs={24} xl={12}>{tabela('ficha', 'FICHA TÉCNICA', <FileTextOutlined />)}</Col>
                </Row>

                {visao.bloqueadosAqui.length > 0 && (
                  <div>
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#64748b' }}>Não usados neste ramo: </span>
                    {visao.bloqueadosAqui.map(b => (
                      <Tag key={b.id} icon={<StopOutlined />} color="default" style={{ marginTop: 4 }}>
                        {b.nome}{b.origemNome ? ` (de ${b.origemNome})` : ''}
                        <Tooltip title="Voltar a usar">
                          <UndoOutlined style={{ marginLeft: 6, cursor: 'pointer', color: '#0284c7' }} onClick={() => state.handleRemoverVinculoLocal(b.id)} />
                        </Tooltip>
                      </Tag>
                    ))}
                  </div>
                )}
              </Space>
            </Card>

            {/* RODAPÉ */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', padding: '12px 16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <Space>
                {!cat.id.startsWith('temp-') && (
                  <Button danger icon={<DeleteOutlined />} disabled={state.saving} onClick={() => state.handleDeletarNoServidor(cat)}>
                    Excluir Categoria
                  </Button>
                )}
                {alterada && (
                  <Button icon={<UndoOutlined />} disabled={state.saving} onClick={state.handleDescartarAlteracoes}>
                    Descartar alterações
                  </Button>
                )}
              </Space>
              <Button type="primary" size="large" icon={<SaveOutlined />} loading={state.saving} onClick={state.handleSalvarNoServidor}
                style={{ background: '#16a34a', borderColor: '#16a34a', fontWeight: 600, paddingInline: 24 }}>
                Salvar
              </Button>
            </div>
          </Space>
        ) : (
          <div style={{ padding: '80px 20px', textAlign: 'center', border: '2px dashed #cbd5e1', borderRadius: '8px', background: '#fff' }}>
            <DeploymentUnitOutlined style={{ fontSize: '48px', color: '#94a3b8', marginBottom: 12 }} />
            <h3 style={{ color: '#334155', margin: '0 0 4px 0' }}>Nenhuma categoria selecionada</h3>
            <p style={{ color: '#64748b', fontSize: '13px', margin: 0 }}>Selecione uma categoria na árvore para editar os dados e os atributos.</p>
          </div>
        )}
      </Content>

      {/* LATERAL: USO DA CATEGORIA */}
      {cat && (
        <Sider width={400} theme="light" style={{ padding: '16px 12px', borderLeft: '1px solid #e2e8f0', background: '#ffffff' }}>
          <Space direction="vertical" style={{ width: '100%' }} size={12}>
            <UsoCategoriaPainel
              categoria={cat}
              categorias={state.categorias}
              onSelecionar={id => state.setCategoriaSelecionadaId(id)}
              onNovaSubcategoria={() => state.handleAdicionarCategoriaNova(cat.id)}
              onAlterado={state.recarregarContagens}
            />
            <Card size="small" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <SafetyCertificateOutlined style={{ fontSize: '14px', color: '#166534', marginTop: 2 }} />
                <div style={{ fontSize: '11px', color: '#166534', lineHeight: 1.5 }}>
                  {(Object.keys(PAPEIS) as Papel[]).map(p => (
                    <div key={p}><b>{PAPEIS[p].label}:</b> {PAPEIS[p].ajuda}</div>
                  ))}
                  <div style={{ marginTop: 4 }}>Se o código entra no SKU e a ordem são definidos na família.</div>
                </div>
              </div>
            </Card>
          </Space>
        </Sider>
      )}
    </Layout>
  );
};

export default CategoryManager;
