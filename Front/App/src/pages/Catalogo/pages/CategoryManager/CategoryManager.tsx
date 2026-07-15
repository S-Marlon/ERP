import React, { useState, useMemo, useEffect } from 'react';
import {
  Layout,
  Tree,
  Button,
  Collapse,
  Row,
  Col,
  Input,
  Select,
  Checkbox,
  Table,
  Space,
  Spin,
  Card,
  Tag,
  message,
  Modal,
  Tooltip
} from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  SaveOutlined,
  SettingOutlined,
  PartitionOutlined,
  DashboardOutlined,
  DeploymentUnitOutlined,
  CloseOutlined,
  ThunderboltOutlined,
  InfoCircleOutlined
} from '@ant-design/icons';
import { Categoria, AtributoHerdavel, CreateCategoryPayload, UpdateCategoryPayload } from './CategoryManager.types';
import { 
  getCategories, 
  createCategory, 
  updateCategory, 
  deleteCategory, 
  getAtributosGlobais, 
  getGruposAtributos,
  getUnidadesMedida // Certifique-se de exportar esta função no seu categoryService
} from './categoryService';

const { Sider, Content } = Layout;

const tenantIdGlobal = 1;

interface AtributoGlobalOpc {
  id: string;
  nome: string;
  tipo: string;
  grupo_id?: number;
  unidade_id?: number;
  sufixo?: string;
  valores_sugeridos?: string;
}

interface GrupoAtributoBanco {
  id: number;
  nome: string;
  descricao?: string;
}

interface UnidadeMedidaBanco {
  id: number;
  nome: string;
  simbolo: string;
}

const useCategoryState = () => {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [categoriaSelecionadaId, setCategoriaSelecionadaId] = useState<string | null>(null);
  const [atributosGlobais, setAtributosGlobais] = useState<AtributoGlobalOpc[]>([]);
  const [gruposDisponiveis, setGruposDisponiveis] = useState<GrupoAtributoBanco[]>([]);
  const [unidadesMedida, setUnidadesMedida] = useState<UnidadeMedidaBanco[]>([]);

  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);

  const [grupoSelecionadoLote, setGrupoSelecionadoLote] = useState<string>('');
  const [mostrarCriarRapido, setMostrarCriarRapido] = useState<boolean>(false);
  const [novoAttrRapido, setNovoAttrRapido] = useState({
    nome: '',
    tipo: 'texto',
    grupo_id: undefined as number | undefined,
    unidade_id: undefined as number | undefined
  });

  const carregarCategoriasDoServidor = async () => {
    setLoading(true);
    try {
      const dados = await getCategories(tenantIdGlobal);
      setCategorias(dados);

      const attrsGlobais = await getAtributosGlobais(tenantIdGlobal);
      setAtributosGlobais(attrsGlobais as any);

      const dadosGrupos = await getGruposAtributos(tenantIdGlobal);
      setGruposDisponiveis(dadosGrupos);

      // Busca as unidades do banco de dados para popular o formulário
      if (typeof getUnidadesMedida === 'function') {
        const dadosUnidades = await getUnidadesMedida(tenantIdGlobal);
        setUnidadesMedida(dadosUnidades);
      }

      if (dados.length > 0 && !categoriaSelecionadaId) {
        setCategoriaSelecionadaId(dados[0].id);
      }
    } catch (err: any) {
      console.error(err);
      message.error(`🚨 Falha de Conexão: ${err.message || 'Não foi possível carregar as categorias.'}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarCategoriasDoServidor();
  }, []);

 

  const categoriaSelecionada = useMemo(() => {
    return categorias.find(c => c.id === categoriaSelecionadaId) || null;
  }, [categorias, categoriaSelecionadaId]);

  

  const handleAssociarGrupoEmLote = (grupoId: string | number) => {
    if (!grupoId || !categoriaSelecionadaId) return;

    const grupoEncontrado = gruposDisponiveis.find(g => String(g.id) === String(grupoId));
    const nomeGrupo = grupoEncontrado ? grupoEncontrado.nome : `ID ${grupoId}`;

    // Filtra atributos do grupo que o usuário selecionou
    const attrsDoGrupo = atributosGlobais.filter(a => String(a.grupo_id) === String(grupoId));
    const attrsJaVinculados = categoriaSelecionada?.atributosHeranca || [];
    const novosVinculos: AtributoHerdavel[] = [];

    attrsDoGrupo.forEach(attrGlobal => {
      const jaExiste = attrsJaVinculados.some(a => String(a.id) === String(attrGlobal.id));
      if (!jaExiste) {
        const unidadeObj = unidadesMedida.find(u => u.id === attrGlobal.unidade_id);
        novosVinculos.push({
          id: String(attrGlobal.id),
          nome: attrGlobal.nome,
          tipoDado: attrGlobal.tipo as any,
          sufixo: unidadeObj?.simbolo || attrGlobal.sufixo || '',
          escopoComercial: 'ficha',
          pesquisavel: true,
          obrigatorio: false,
          herdar: true,
          sobrescreve: false, // Por padrão não sobrescreve herança
          ordem: attrsJaVinculados.length + novosVinculos.length + 1
        } as any);
      }
    });

    if (novosVinculos.length === 0) {
      message.warning(`Todos os atributos do grupo "${nomeGrupo}" já estão associados.`);
      return;
    }

    setCategorias(prev => prev.map(c => {
      if (c.id !== categoriaSelecionadaId) return c;
      return { ...c, atributosHeranca: [...(c.atributosHeranca || []), ...novosVinculos] };
    }));

    setGrupoSelecionadoLote('');
    message.success(`🟢 ${novosVinculos.length} atributos do grupo "${nomeGrupo}" vinculados!`);
  };

  
  
  const handleCriarEAssociarAtributoRapido = async () => {
    if (!novoAttrRapido.nome.trim()) return message.error('Insira o nome do atributo.');
    setSaving(true);

    try {
      const idMockadoNovoGlobal = `g-${Date.now()}`;
      const unidadeSelecionada = unidadesMedida.find(u => u.id === novoAttrRapido.unidade_id);

      const novoAtributoCriado: AtributoGlobalOpc = {
        id: idMockadoNovoGlobal,
        nome: novoAttrRapido.nome,
        tipo: novoAttrRapido.tipo,
        grupo_id: novoAttrRapido.grupo_id,
        unidade_id: novoAttrRapido.unidade_id,
        sufixo: unidadeSelecionada?.simbolo || ''
      };

      setAtributosGlobais(prev => [...prev, novoAtributoCriado]);

      const novoVinculo: AtributoHerdavel = {
        id: idMockadoNovoGlobal,
        nome: novoAttrRapido.nome,
        tipoDado: novoAttrRapido.tipo as any,
        sufixo: unidadeSelecionada?.simbolo || '',
        escopoComercial: 'ficha',
        pesquisavel: true,
        obrigatorio: false,
        herdar: true,
        sobrescreve: false,
        ordem: (categoriaSelecionada?.atributosHeranca?.length || 0) + 1,
        exemplos: ''
      };

      setCategorias(prev => prev.map(c => {
        if (c.id !== categoriaSelecionadaId) return c;
        return { ...c, atributosHeranca: [...(c.atributosHeranca || []), novoVinculo] };
      }));

      setNovoAttrRapido({ nome: '', tipo: 'texto', grupo_id: undefined, unidade_id: undefined });
      setMostrarCriarRapido(false);
      message.success('🟢 Atributo criado globalmente e vinculado à categoria!');
    } catch (err) {
      message.error('Erro ao criar atributo sob demanda.');
    } finally {
      setSaving(false);
    }
  };

  const handleSalvarNoServidor = async () => {
    if (!categoriaSelecionada) return;
    setSaving(true);

    try {
      const isNovaCategoria = categoriaSelecionada.id.startsWith('temp-');

      const payloadBase = {
        nome: categoriaSelecionada.nome,
        parentId: categoriaSelecionada.parentId,
        ativa: categoriaSelecionada.ativa,
        percentualMargemSugerida: categoriaSelecionada.percentualMargemSugerida,
        modoExibicao: categoriaSelecionada.modoExibicao,
        descricao: categoriaSelecionada.descricao,
        atributosHeranca: categoriaSelecionada.atributosHeranca,
        seo: categoriaSelecionada.seo,
        integracoes: categoriaSelecionada.integracoes
      };

      if (isNovaCategoria) {
        const resposta = await createCategory(payloadBase as any, tenantIdGlobal);
        message.success('🟢 Categoria criada com sucesso!');
        await carregarCategoriasDoServidor();
        if (resposta.id) setCategoriaSelecionadaId(resposta.id);
      } else {
        await updateCategory(categoriaSelecionada.id, payloadBase as any, tenantIdGlobal);
        message.success('🟢 Alterações salvas com sucesso!');
        await carregarCategoriasDoServidor();
      }
    } catch (err: any) {
      console.error(err);
      message.error(`❌ Erro ao Salvar: ${err.message || 'O servidor rejeitou as modificações.'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDeletarNoServidor = async (idCategoria: string) => {
    const temFilhas = categorias.some(c => c.parentId === idCategoria);
    if (temFilhas) {
      message.error('❌ Não é possível excluir uma categoria que possui subcategorias vinculadas.');
      return;
    }

    Modal.confirm({
      title: '⚠️ Tem certeza que deseja deletar permanentemente esta categoria?',
      content: 'Esta ação não poderá ser desfeita.',
      okText: 'Sim, Deletar',
      okType: 'danger',
      cancelText: 'Cancelar',
      onOk: async () => {
        setSaving(true);
        try {
          await deleteCategory(idCategoria, tenantIdGlobal);
          message.success('🗑️ Categoria removida com sucesso!');
          setCategoriaSelecionadaId(null);
          await carregarCategoriasDoServidor();
        } catch (err: any) {
          console.error(err);
          message.error(`❌ Erro ao Excluir: ${err.message || 'Erro ao processar exclusão.'}`);
        } finally {
          setSaving(false);
        }
      }
    });
  };

  

  const handleAtualizarCategoria = (campo: keyof Categoria, valor: any) => {
    setCategorias(prev => prev.map(c => {
      if (c.id !== categoriaSelecionadaId) return c;
      if (campo === 'nome') return { ...c, nome: valor, slug: gerarSlug(valor) };
      return { ...c, [campo]: valor };
    }));
  };

  const handleAtualizarSubCampo = (bloco: 'seo' | 'integracoes', campo: string, valor: string) => {
    setCategorias(prev => prev.map(c => {
      if (c.id !== categoriaSelecionadaId) return c;
      return { ...c, [bloco]: { ...(c[bloco] || {}), [campo]: valor } };
    }));
  };

  const handleAtualizarAtributoHerdado = (atributoId: string, campo: keyof AtributoHerdavel, valor: any) => {
    setCategorias(prev => prev.map(c => {
      if (c.id !== categoriaSelecionadaId) return c;
      return {
        ...c,
        atributosHeranca: (c.atributosHeranca || []).map(attr => attr.id === atributoId ? { ...attr, [campo]: valor } : attr)
      };
    }));
  };

  const handleMudarControleHeranca = (atributoId: string, campo: 'bloqueado' | 'retransmitir' | 'sobrescreve', valor: boolean) => {
    setCategorias(prev => prev.map(c => {
      if (c.id !== categoriaSelecionadaId) return c;

      const listaAtual = c.atributosHeranca || [];
      const existeLocal = listaAtual.some(a => a.id === atributoId);

      if (!existeLocal) {
        const novoVinculoCustomizado: AtributoHerdavel = {
          id: atributoId,
          nome: '',
          tipoDado: 'texto',
          escopoComercial: 'ficha',
          pesquisavel: true,
          obrigatorio: false,
          herdar: true,
          sobrescreve: false,
          ordem: listaAtual.length + 1,
          [campo]: valor
        };
        return { ...c, atributosHeranca: [...listaAtual, novoVinculoCustomizado] };
      }

      return {
        ...c,
        atributosHeranca: listaAtual.map(attr => attr.id === atributoId ? { ...attr, [campo]: valor } : attr)
      };
    }));
  };

  const handleMudarAtributoSelecionado = (idTemporario: string, idRealDoAtributoGlobal: string) => {
    const attrGlobal = atributosGlobais.find(a => String(a.id) === String(idRealDoAtributoGlobal));
    if (!attrGlobal) return;

    const unidadeObj = unidadesMedida.find(u => u.id === attrGlobal.unidade_id);

    setCategorias(prev => prev.map(c => {
      if (c.id !== categoriaSelecionadaId) return c;
      return {
        ...c,
        atributosHeranca: (c.atributosHeranca || []).map(attr =>
          attr.id === idTemporario
            ? {
                ...attr,
                id: String(attrGlobal.id),
                nome: attrGlobal.nome,
                tipoDado: attrGlobal.tipo as any,
                sufixo: unidadeObj?.simbolo || attrGlobal.sufixo || '',
                exemplos: attrGlobal.valores_sugeridos || '',
                escopoComercial: 'ficha',
                pesquisavel: true,
                herdar: true,
                sobrescreve: false
              }
            : attr
        )
      };
    }));
  };

  const handleAdicionarAtributo = () => {
    if (!categoriaSelecionadaId) return;
    const novoAttr: AtributoHerdavel = {
      id: `h-${Date.now()}`,
      nome: '',
      tipoDado: 'texto',
      escopoComercial: 'ficha',
      pesquisavel: true,
      obrigatorio: false,
      herdar: true,
      sobrescreve: false,
      ordem: (categoriaSelecionada?.atributosHeranca?.length || 0) + 1,
      exemplos: '',
      sufixo: ''
    };
    setCategorias(prev => prev.map(c => c.id === categoriaSelecionadaId ? { ...c, atributosHeranca: [...(c.atributosHeranca || []), novoAttr] } : c));
  };

  const handleRemoverAtributoLocal = (atributoId: string) => {
    setCategorias(prev => prev.map(c => {
      if (c.id !== categoriaSelecionadaId) return c;
      return { ...c, atributosHeranca: (c.atributosHeranca || []).filter(attr => attr.id !== atributoId) };
    }));
  };

  const handleAdicionarCategoriaNova = () => {
    const nova: Categoria = {
      id: `temp-${Date.now()}`,
      tenantId: tenantIdGlobal,
      nome: 'Nova Categoria',
      slug: 'nova-categoria',
      ativa: true,
      ordem: categorias.length + 1,
      percentualMargemSugerida: 30,
      modoExibicao: 'grade',
      parentId: null,
      descricao: '',
      atributosHeranca: [],
      seo: { tags: '', metaTitle: '', metaDescription: '' },
      integracoes: { erpId: '', vtexId: '', mercadolivreId: '' }
    };
    setCategorias(prev => [...prev, nova]);
    setCategoriaSelecionadaId(nova.id);
  };

  return {
    categorias, categoriaSelecionada, categoriaSelecionadaId, atributosGlobais, loading, saving,
    gruposDisponiveis, unidadesMedida, grupoSelecionadoLote, setGrupoSelecionadoLote, mostrarCriarRapido, setMostrarCriarRapido,
    novoAttrRapido, setNovoAttrRapido, handleAssociarGrupoEmLote, handleCriarEAssociarAtributoRapido,
    handleAtualizarCategoria, handleAtualizarSubCampo, handleAtualizarAtributoHerdado, handleMudarControleHeranca,
    handleMudarAtributoSelecionado, handleAdicionarAtributo, handleRemoverAtributoLocal, handleAdicionarCategoriaNova,
    handleSalvarNoServidor, handleDeletarNoServidor, setCategoriaSelecionadaId, 
  };
};

const gerarSlug = (texto: string): string => {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
};

const verificarSePaiInativo = (idPai: string | null, listaCategorias: Categoria[]): boolean => {
  if (!idPai) return false;
  const pai = listaCategorias.find(c => c.id === idPai);
  if (!pai) return false;
  if (!pai.ativa) return true;
  return verificarSePaiInativo(pai.parentId, listaCategorias);
};

const obterAtributosTudo = (idCategoriaAtual: string | null, listaCategorias: Categoria[]): any[] => {
  if (!idCategoriaAtual) return [];

  let resultado: any[] = [];
  let categoriaAtual = listaCategorias.find(c => c.id === idCategoriaAtual);
  const visitados = new Set<string>();
  const configuracoesLocaisAlvo = categoriaAtual?.atributosHeranca || [];

  while (categoriaAtual && !visitados.has(categoriaAtual.id)) {
    visitados.add(categoriaAtual.id);
    const deCima = categoriaAtual.id !== idCategoriaAtual;

    if (categoriaAtual.atributosHeranca && Array.isArray(categoriaAtual.atributosHeranca)) {
      const attrsFiltrados = categoriaAtual.atributosHeranca.filter(attr => !deCima || attr.herdar);

      const attrsFormatados = attrsFiltrados.map(attr => {
        const customizacaoLocal = configuracoesLocaisAlvo.find(l => l.id === attr.id);
        return {
          ...attr,
          deCima,
          origem: categoriaAtual!.nome,
          bloqueado: customizacaoLocal ? !!customizacaoLocal.bloqueado : false,
          retransmitir: customizacaoLocal ? customizacaoLocal.retransmitir !== false : true,
          sobrescreve: customizacaoLocal ? !!customizacaoLocal.sobrescreve : false,
          // Caso sobrescreva, assumimos os valores locais em vez dos herdados
          escopoComercial: (customizacaoLocal && customizacaoLocal.sobrescreve) ? customizacaoLocal.escopoComercial : attr.escopoComercial,
          obrigatorio: (customizacaoLocal && customizacaoLocal.sobrescreve) ? customizacaoLocal.obrigatorio : attr.obrigatorio,
        };
      });

      const attrsPermitidos = attrsFormatados.filter(attr => {
        if (!deCima) return true;
        return attr.retransmitir !== false && !attr.bloqueado;
      });

      resultado = [...attrsPermitidos, ...resultado];
    }

    categoriaAtual = categoriaAtual.parentId
      ? listaCategorias.find(c => c.id === categoriaAtual!.parentId)
      : undefined;
  }

  const mapeadoPorId: Record<string, any> = {};
  resultado.forEach(attr => {
    if (!mapeadoPorId[attr.id]) {
      mapeadoPorId[attr.id] = attr;
    }
  });

  return Object.values(mapeadoPorId)
    .filter((attr: any) => !attr.bloqueado)
    .sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
};

export const CategoryManager: React.FC = () => {
  const state = useCategoryState();
  const [abasAbertas, setAbasAbertas] = useState<string[]>(['estrutura', 'atributos']);

  const todosAtributosCalculados = useMemo(() => {
    return obterAtributosTudo(state.categoriaSelecionadaId, state.categorias);
  }, [state.categoriaSelecionadaId, state.categorias]);

  const buildTreeData = (parentId: string | null): any[] => {
    return state.categorias
      .filter(c => c.parentId === parentId)
      .map(cat => {
        const desativadaPorCascata = !cat.ativa || verificarSePaiInativo(cat.parentId, state.categorias);
        return {
          title: (
            <Space>
              <span style={{ fontWeight: state.categoriaSelecionadaId === cat.id ? 700 : 400 }}>
                {cat.nome}
              </span>
              {desativadaPorCascata && <Tag color="warning" style={{ fontSize: '10px' }}>Inativo</Tag>}
            </Space>
          ),
          key: cat.id,
          children: buildTreeData(cat.id)
        };
      });
  };

  const treeData = useMemo(() => buildTreeData(null), [state.categorias, state.categoriaSelecionadaId]);

  if (state.loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', gap: '12px' }}>
        <Spin size="large" />
        <span>Carregando taxonomia técnica...</span>
      </div>
    );
  }

  const columns = [
    {
      title: 'Atributo & Governança (DNA)',
      dataIndex: 'nome',
      key: 'nome',
      width: '25%',
      render: (_: any, attr: any) => {
        const ehLinhaFalsaLocal = String(attr.id).startsWith('h-');
        const atributosDisponiveisCombo = state.atributosGlobais.filter(g =>
          !(state.categoriaSelecionada?.atributosHeranca || []).some(a => String(a.id) === String(g.id))
        );

        if (attr.deCima) {
          return (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontWeight: 600, color: '#475569' }}>{attr.nome}</span>
              <span style={{ fontSize: '10px', color: '#94a3b8' }}>🧬 HERDADO</span>
            </div>
          );
        }

        if (ehLinhaFalsaLocal) {
          return (
            <Select
              style={{ width: '100%' }}
              placeholder="-- Escolha um Atributo Global --"
              value=""
              onChange={val => state.handleMudarAtributoSelecionado(attr.id, val)}
            >
              {atributosDisponiveisCombo.map(g => {
                const grupoObj = state.gruposDisponiveis.find(gr => gr.id === g.grupo_id);
                return (
                  <Select.Option key={g.id} value={g.id}>
                    {g.nome} {grupoObj ? `(${grupoObj.nome})` : ''}
                  </Select.Option>
                );
              })}
            </Select>
          );
        }

        return (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontWeight: 600 }}>{attr.nome}</span>
            <span style={{ fontSize: '10px', color: '#637381' }}>🧬 TÉCNICO</span>
          </div>
        );
      }
    },
    {
      title: 'Tipo de Dado',
      dataIndex: 'tipoDado',
      key: 'tipoDado',
      width: '12%',
      render: (tipoDado: string) => (
        <Select value={tipoDado} disabled style={{ width: '100%' }}>
          <Select.Option value="texto">Texto Livre</Select.Option>
          <Select.Option value="numero">Numérico</Select.Option>
          <Select.Option value="decimal">Decimal</Select.Option>
          <Select.Option value="boolean">Booleano</Select.Option>
          <Select.Option value="lista">Lista (Dropdown)</Select.Option>
        </Select>
      )
    },
    {
      title: 'Escopo Comercial',
      dataIndex: 'escopoComercial',
      key: 'escopoComercial',
      width: '15%',
      render: (escopo: string, attr: any) => {
        // Bloqueia edição se for herdado, a não ser que tenha ativado "Sobrescrever"
        const desabilitado = attr.deCima && !attr.sobrescreve;
        return (
          <Select
            value={escopo || 'ficha'}
            disabled={desabilitado}
            style={{ width: '100%' }}
            onChange={val => state.handleAtualizarAtributoHerdado(attr.id, 'escopoComercial', val)}
          >
            <Select.Option value="ficha">📄 Ficha Técnica Only</Select.Option>
            <Select.Option value="grade">⚡ Seletor de Grade</Select.Option>
            <Select.Option value="dna">🧬 Característica DNA</Select.Option>
          </Select>
        );
      }
    },
    {
      title: 'Obrigatório',
      dataIndex: 'obrigatorio',
      key: 'obrigatorio',
      width: '10%',
      render: (obrig: boolean, attr: any) => {
        const desabilitado = attr.deCima && !attr.sobrescreve;
        return (
          <Select
            value={obrig ? 'sim' : 'nao'}
            disabled={desabilitado}
            style={{ width: '100%' }}
            onChange={val => state.handleAtualizarAtributoHerdado(attr.id, 'obrigatorio', val === 'sim')}
          >
            <Select.Option value="sim">🔴 Sim</Select.Option>
            <Select.Option value="nao">⚪ Não</Select.Option>
          </Select>
        );
      }
    },
    {
      title: 'Ajuste Fino / Herança',
      key: 'governanca',
      width: '26%',
      render: (_: any, attr: any) => {
        const ehLinhaFalsaLocal = String(attr.id).startsWith('h-');

        if (attr.deCima) {
          return (
            <Space direction="vertical" size={1}>
              <Tag color="default">↳ {attr.origem}</Tag>
              <Space wrap size={4}>
                <Checkbox 
                  checked={!!attr.bloqueado} 
                  onChange={e => state.handleMudarControleHeranca(attr.id, 'bloqueado', e.target.checked)}
                >
                  <span style={{ color: '#ef4444', fontSize: '10px' }}>Bloquear</span>
                </Checkbox>
                <Checkbox 
                  checked={attr.retransmitir !== false} 
                  onChange={e => state.handleMudarControleHeranca(attr.id, 'retransmitir', e.target.checked)}
                >
                  <span style={{ color: '#2563eb', fontSize: '10px' }}>Propagar</span>
                </Checkbox>
                <Checkbox 
                  checked={!!attr.sobrescreve} 
                  onChange={e => state.handleMudarControleHeranca(attr.id, 'sobrescreve', e.target.checked)}
                >
                  <Tooltip title="Permite alterar Escopo e Obrigatoriedade nesta categoria filha sem herdar as regras do pai">
                    <span style={{ color: '#db2777', fontSize: '10px', cursor: 'pointer' }}>Sobrescrever <InfoCircleOutlined size={8} /></span>
                  </Tooltip>
                </Checkbox>
              </Space>
            </Space>
          );
        }

        if (ehLinhaFalsaLocal) {
          return <Tag color="warning">⏳ Aguardando...</Tag>;
        }

        return (
          <Space direction="vertical" size={2}>
            <Tag color="success">📍 Nativo</Tag>
            <Checkbox 
              checked={attr.herdar !== false} 
              onChange={e => state.handleAtualizarAtributoHerdado(attr.id, 'herdar', e.target.checked)}
            >
              <span style={{ color: '#475569', fontSize: '10px' }}>Propagar para filhos</span>
            </Checkbox>
          </Space>
        );
      }
    },
    {
      title: 'Unid.',
      dataIndex: 'sufixo',
      key: 'sufixo',
      width: '8%',
      render: (sufixo: string) => (
        <span style={{ fontSize: '12px', color: '#0050b3', fontFamily: 'monospace', fontWeight: 600 }}>
          {sufixo ? `${sufixo}` : '-'}
        </span>
      )
    },
    {
      title: '',
      key: 'acoes',
      width: '4%',
      render: (_: any, attr: any) => !attr.deCima && (
        <Button
          type="text"
          danger
          icon={<CloseOutlined />}
          onClick={() => state.handleRemoverAtributoLocal(attr.id)}
        />
      )
    }
  ];

   const getGrupoColorStyle = (grupoId: string | number) => {
  if (!grupoId) return { bg: '#f1f5f9', border: '#cbd5e1', text: '#64748b', name: 'Avulso' };
  
  // Lista de cores elegantes e suaves (Pastel) para diferenciar os grupos
  const cores = [
    { bg: '#eff6ff', border: '#bfdbfe', text: '#1d4ed8' }, // Azul
    { bg: '#f0fdf4', border: '#bbf7d0', text: '#15803d' }, // Verde
    { bg: '#fdf2f8', border: '#fbcfe8', text: '#be185d' }, // Rosa
    { bg: '#faf5ff', border: '#e9d5ff', text: '#7e22ce' }, // Roxo
    { bg: '#fffbeb', border: '#fef3c7', text: '#b45309' }, // Âmbar
    { bg: '#f0fdfa', border: '#99f6e4', text: '#0f766e' }, // Teal
  ];

  const index = Math.abs(String(grupoId).split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)) % cores.length;
  return { ...cores[index], name: 'Grupo' };
};

  return (
    <Layout style={{ minHeight: '100vh', background: '#f4f6f8' }}>
      
      {/* LATERAL ESQUERDA: ÁRVORE TAXONOMIA */}
      <Sider width={340} theme="light" style={{ padding: '16px', borderRight: '1px solid #e1e4e8' }}>
        <Space direction="vertical" style={{ width: '100%' }} size={12}>
          <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>🌿 Matriz de Taxonomia</h3>
          <Button
            type="primary"
            block
            icon={<PlusOutlined />}
            onClick={state.handleAdicionarCategoriaNova}
            style={{ backgroundColor: '#0050b3' }}
          >
            Nova Categoria
          </Button>
          <div style={{ border: '1px solid #e1e4e8', borderRadius: '4px', padding: '8px', maxHeight: 'calc(100vh - 120px)', overflowY: 'auto' }}>
            <Tree
              treeData={treeData}
              selectedKeys={state.categoriaSelecionadaId ? [state.categoriaSelecionadaId] : []}
              onSelect={(keys) => keys.length > 0 && state.setCategoriaSelecionadaId(keys[0] as string)}
              defaultExpandAll
            />
          </div>
        </Space>
      </Sider>

      {/* ÁREA CENTRAL DE TRABALHO */}
      <Content style={{ padding: '24px', maxWidth: '1400px', width: '100%' }}>
        {state.categoriaSelecionada ? (
          <Space direction="vertical" style={{ width: '100%' }} size={16}>

            <Collapse
              activeKey={abasAbertas}
              onChange={(keys) => setAbasAbertas(keys as string[])}
              expandIconPosition="end"
            >
              {/* ABA 1: ESTRUTURAL */}
              <Collapse.Panel
                header={
                  <div style={{ display: 'flex', justifyContent: 'space-between', width: '95%', alignItems: 'center' }}>
                    <span style={{ fontWeight: 600 }}><SettingOutlined /> CONFIGURAÇÃO ESTRUTURAL DA CATEGORIA</span>
                    <div onClick={e => e.stopPropagation()}>
                      <Checkbox
                        checked={state.categoriaSelecionada.ativa}
                        onChange={e => state.handleAtualizarCategoria('ativa', e.target.checked)}
                      >
                        {state.categoriaSelecionada.ativa ? '🟢 Ativa' : '🔴 Inativa'}
                      </Checkbox>
                    </div>
                  </div>
                }
                key="estrutura"
              >
                <Row gutter={[16, 16]}>
                  <Col span={8}>
                    <label style={{ fontSize: '11px', fontWeight: 500 }}>Nome da Categoria</label>
                    <Input value={state.categoriaSelecionada.nome} onChange={e => state.handleAtualizarCategoria('nome', e.target.value)} />
                  </Col>
                  <Col span={8}>
                    <label style={{ fontSize: '11px', fontWeight: 500 }}>URL Amigável (Slug Catálogo)</label>
                    <Input value={state.categoriaSelecionada.slug} onChange={e => state.handleAtualizarCategoria('slug', e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-'))} style={{ fontFamily: 'monospace' }} />
                  </Col>
                  <Col span={8}>
                    <label style={{ fontSize: '11px', fontWeight: 500 }}>Nível / Categoria Pai</label>
                    <Select
                      style={{ width: '100%' }}
                      value={state.categoriaSelecionada.parentId || ''}
                      onChange={val => state.handleAtualizarCategoria('parentId', val || null)}
                    >
                      <Select.Option value="">Root / Raiz 🌍</Select.Option>
                      {state.categorias.filter(c => c.id !== state.categoriaSelecionada?.id).map(opc => (
                        <Select.Option key={opc.id} value={opc.id}>🔹 {opc.nome}</Select.Option>
                      ))}
                    </Select>
                  </Col>
                  <Col span={24}>
                    <label style={{ fontSize: '11px', fontWeight: 500 }}>Descrição de Escopo Técnico</label>
                    <Input value={state.categoriaSelecionada.descricao || ''} onChange={e => state.handleAtualizarCategoria('descricao', e.target.value)} />
                  </Col>
                </Row>
              </Collapse.Panel>

              {/* ABA 2: MAPEAMENTO DE INTEGRAÇÕES */}
              <Collapse.Panel
                header={<span style={{ fontWeight: 600, color: '#4f46e5' }}><PartitionOutlined /> MAPEAMENTO DE ECOSSISTEMA (DE/PARA DE IDS)</span>}
                key="mapeamento"
              >
                <Row gutter={[16, 16]}>
                  <Col span={8}>
                    <Card size="small" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                      <label style={{ fontSize: '11px', fontWeight: 700, color: '#334155' }}>📦 CÓDIGO ERP CENTRAL</label>
                      <Input placeholder="Ex: CAT-9921" value={state.categoriaSelecionada.integracoes?.erpId || ''} onChange={e => state.handleAtualizarSubCampo('integracoes', 'erpId', e.target.value)} style={{ fontFamily: 'monospace', marginTop: 4 }} />
                    </Card>
                  </Col>
                  <Col span={8}>
                    <Card size="small" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                      <label style={{ fontSize: '11px', fontWeight: 700, color: '#166534' }}>🛒 ID CATEGORIA VTEX</label>
                      <Input placeholder="Ex: 402" value={state.categoriaSelecionada.integracoes?.vtexId || ''} onChange={e => state.handleAtualizarSubCampo('integracoes', 'vtexId', e.target.value)} style={{ fontFamily: 'monospace', marginTop: 4 }} />
                    </Card>
                  </Col>
                  <Col span={8}>
                    <Card size="small" style={{ background: '#fffbeb', border: '1px solid #fef3c7' }}>
                      <label style={{ fontSize: '11px', fontWeight: 700, color: '#92400e' }}>💛 ID MERCADO LIVRE</label>
                      <Input placeholder="Ex: MLB1054" value={state.categoriaSelecionada.integracoes?.mercadolivreId || ''} onChange={e => state.handleAtualizarSubCampo('integracoes', 'mercadolivreId', e.target.value)} style={{ fontFamily: 'monospace', marginTop: 4 }} />
                    </Card>
                  </Col>
                </Row>
              </Collapse.Panel>

              {/* ABA 3: INTELIGÊNCIA COMERCIAL */}
              <Collapse.Panel
                header={<span style={{ fontWeight: 600 }}><DashboardOutlined /> INTELIGÊNCIA COMERCIAL & LAYOUT</span>}
                key="comercial"
              >
                <Row gutter={[16, 16]}>
                  <Col span={6}>
                    <label style={{ fontSize: '11px', fontWeight: 500 }}>Margem Sugerida Base (%)</label>
                    <Input type="number" value={state.categoriaSelecionada.percentualMargemSugerida || 0} onChange={e => state.handleAtualizarCategoria('percentualMargemSugerida', Number(e.target.value))} />
                  </Col>
                  <Col span={9}>
                    <label style={{ fontSize: '11px', fontWeight: 500 }}>Modo de Exibição Padrão</label>
                    <Select style={{ width: '100%' }} value={state.categoriaSelecionada.modoExibicao} onChange={val => state.handleAtualizarCategoria('modoExibicao', val)}>
                      <Select.Option value="grade">Grade de Produtos (Filtros Laterais)</Select.Option>
                      <Select.Option value="lista">Lista Técnico (Comparativo)</Select.Option>
                      <Select.Option value="carrossel">Carrossel Compacto (Vitrine)</Select.Option>
                    </Select>
                  </Col>
                  <Col span={9}>
                    <label style={{ fontSize: '11px', fontWeight: 500 }}>Tags Indexadoras SEO</label>
                    <Input placeholder="ex: motor, eletrico" value={state.categoriaSelecionada.seo?.tags || ''} onChange={e => state.handleAtualizarSubCampo('seo', 'tags', e.target.value)} />
                  </Col>
                </Row>
              </Collapse.Panel>

              {/* ABA 4: MATRIZ DE ATRIBUTOS COM OPERAÇÃO EM LOTE + INLINE */}
            {/* ABA 4: MATRIZ DE ATRIBUTOS COM OPERAÇÃO EM LOTE + INLINE */}
<Collapse.Panel
  header={
    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
      {/* Título Principal */}
      <span style={{ fontWeight: 600, fontSize: '14px', display: 'flex', alignItems: 'center', gap: 6, color: '#1e293b' }}>
        <DeploymentUnitOutlined style={{ color: '#0f766e' }} /> 🧬 MATRIZ TÉCNICA CONSOLIDADA (ATRIBUTOS)
      </span>

      {/* Ações Rápidas do Cabeçalho */}
      <div onClick={e => e.stopPropagation()}>
        <Space size="small" wrap>
          {/* Seletor de Grupo em Lote */}
          <Space style={{ background: '#f8fafc', padding: '3px 10px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748b' }}>📦 Incluir Grupo:</span>
            <Select
              size="small"
              style={{ width: 180 }}
              placeholder="Escolha o Grupo..."
              showSearch
              optionFilterProp="children"
              value={state.grupoSelecionadoLote || undefined}
              onChange={(grupoId) => state.handleAssociarGrupoEmLote(grupoId)}
              allowClear
            >
              {state.gruposDisponiveis?.map((g) => (
                <Select.Option key={g.id} value={g.id}>
                  {g.nome}
                </Select.Option>
              ))}
            </Select>
          </Space>

          {/* Botão Criar Inline */}
          <Button
            size="small"
            type={state.mostrarCriarRapido ? 'primary' : 'dashed'}
            danger={!state.mostrarCriarRapido}
            icon={<ThunderboltOutlined />}
            onClick={() => state.setMostrarCriarRapido(!state.mostrarCriarRapido)}
            style={{ borderRadius: '6px' }}
          >
            {state.mostrarCriarRapido ? 'Fechar Cadastro' : 'Criar Inline'}
          </Button>

          {/* Botão Seleção Individual */}
          <Button
            size="small"
            type="primary"
            ghost
            icon={<PlusOutlined />}
            onClick={state.handleAdicionarAtributo}
            style={{ borderRadius: '6px' }}
          >
            Seleção Individual
          </Button>
        </Space>
      </div>
    </div>
  }
  key="atributos"
>
  {/* FORMULÁRIO EXPRESS: CRIAÇÃO INLINE COM SELEÇÃO DE GRUPO DO BANCO */}
  {state.mostrarCriarRapido && (
    <Card
      size="small"
      title={
        <span style={{ fontSize: '12px', fontWeight: 600, color: '#db2777' }}>
          ✨ Cadastro Rápido de Atributo Global Core
        </span>
      }
      style={{ marginBottom: 16, background: '#fff1f2', borderColor: '#fecdd3', borderRadius: '8px' }}
    >
      <Row gutter={[12, 12]} align="bottom">
        <Col xs={24} sm={12} md={6}>
          <label style={{ fontSize: '11px', fontWeight: 600, display: 'block', marginBottom: 4, color: '#475569' }}>
            Nome Global
          </label>
          <Input
            size="small"
            placeholder="Ex: Espessura de Bobina"
            value={state.novoAttrRapido.nome}
            onChange={e => state.setNovoAttrRapido(p => ({ ...p, nome: e.target.value }))}
            style={{ borderRadius: '4px' }}
          />
        </Col>

        <Col xs={12} sm={6} md={4}>
          <label style={{ fontSize: '11px', fontWeight: 600, display: 'block', marginBottom: 4, color: '#475569' }}>
            Tipo
          </label>
          <Select
            size="small"
            style={{ width: '100%' }}
            value={state.novoAttrRapido.tipo}
            onChange={val => state.setNovoAttrRapido(p => ({ ...p, tipo: val }))}
          >
            <Select.Option value="texto">Texto</Select.Option>
            <Select.Option value="numero">Número</Select.Option>
            <Select.Option value="decimal">Decimal</Select.Option>
            <Select.Option value="boolean">Booleano</Select.Option>
            <Select.Option value="lista">Lista</Select.Option>
          </Select>
        </Col>

        <Col xs={12} sm={6} md={5}>
          <label style={{ fontSize: '11px', fontWeight: 600, display: 'block', marginBottom: 4, color: '#475569' }}>
            Grupo Comercial
          </label>
          <Select
            size="small"
            style={{ width: '100%' }}
            placeholder="Defina o Grupo"
            value={state.novoAttrRapido.grupo_id}
            onChange={val => state.setNovoAttrRapido(p => ({ ...p, grupo_id: val }))}
          >
            {state.gruposDisponiveis.map(g => (
              <Select.Option key={g.id} value={g.id}>{g.nome}</Select.Option>
            ))}
          </Select>
        </Col>

        <Col xs={24} sm={12} md={5}>
          <label style={{ fontSize: '11px', fontWeight: 600, display: 'block', marginBottom: 4, color: '#475569' }}>
            Unidade de Medida
          </label>
          <Select
            size="small"
            style={{ width: '100%' }}
            placeholder="Símbolo (BAR, mm...)"
            value={state.novoAttrRapido.unidade_id}
            onChange={val => state.setNovoAttrRapido(p => ({ ...p, unidade_id: val }))}
            allowClear
          >
            {state.unidadesMedida.map(u => (
              <Select.Option key={u.id} value={u.id}>{u.nome} ({u.simbolo})</Select.Option>
            ))}
          </Select>
        </Col>

        <Col xs={24} sm={12} md={4}>
          <Button
            size="small"
            type="primary"
            block
            style={{ background: '#db2777', borderColor: '#db2777', fontWeight: 500, borderRadius: '4px' }}
            onClick={state.handleCriarEAssociarAtributoRapido}
          >
            🚀 Injetar Vínculo
          </Button>
        </Col>
      </Row>
    </Card>
  )}

  <Table
    dataSource={todosAtributosCalculados}
    columns={[
      // 🎨 COLUNA DE IDENTIFICAÇÃO VISUAL DO GRUPO (Adicionada)
      {
        title: 'Origem / Grupo',
        dataIndex: 'grupo_id',
        key: 'grupo_id',
        width: 180,
        render: (grupoId, record) => {
          const colorMeta = getGrupoColorStyle(grupoId);
          // Procura o nome amigável do grupo na lista disponível
          const nomeGrupo = state.gruposDisponiveis?.find(g => g.id === grupoId)?.nome || 'Atributo Avulso';
          
          return (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '2px 8px',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: 600,
                backgroundColor: colorMeta.bg,
                border: `1px solid ${colorMeta.border}`,
                color: colorMeta.text,
                maxWidth: '100%',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}
              title={nomeGrupo}
            >
              <span style={{ 
                width: 6, 
                height: 6, 
                borderRadius: '50%', 
                backgroundColor: colorMeta.text,
                display: 'inline-block' 
              }} />
              {nomeGrupo}
            </span>
          );
        }
      },
      // Insira as outras colunas existentes (columns) abaixo dela:
      ...columns
    ]}
    rowKey="id"
    pagination={false}
    size="small"
    bordered
    // 🎨 Estilização da linha para aplicar borda colorida no mesmo grupo
    rowClassName={(record) => {
      const colorMeta = getGrupoColorStyle(record.grupo_id);
      return record.grupo_id ? 'linha-com-grupo' : '';
    }}
    onRow={(record) => {
      const colorMeta = getGrupoColorStyle(record.grupo_id);
      return {
        style: record.grupo_id ? {
          borderLeft: `4px solid ${colorMeta.text}`, // Destaque visual na borda esquerda da linha
        } : {}
      };
    }}
  />
</Collapse.Panel>
            </Collapse>

            {/* RODAPÉ DO CONTROLADOR */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
              <div>
                {!state.categoriaSelecionada.id.startsWith('temp-') && (
                  <Button
                    type="primary"
                    danger
                    icon={<DeleteOutlined />}
                    disabled={state.saving}
                    onClick={() => state.handleDeletarNoServidor(state.categoriaSelecionada!.id)}
                  >
                    Excluir Categoria
                  </Button>
                )}
              </div>
              <Button
                type="primary"
                size="large"
                icon={<SaveOutlined />}
                style={{ background: '#16a34a' }}
                loading={state.saving}
                onClick={state.handleSalvarNoServidor}
              >
                Salvar Alterações
              </Button>
            </div>
          </Space>
        ) : (
          <div style={{ padding: '60px', textAlign: 'center', border: '2px dashed #cbd5e1', borderRadius: '6px', background: '#fff' }}>
            Selecione uma categoria ao lado para ver e configurar as propriedades técnicas.
          </div>
        )}
      </Content>
    </Layout>
  );
};