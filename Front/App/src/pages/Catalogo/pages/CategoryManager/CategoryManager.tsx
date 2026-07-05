  import React, { useState, useMemo, useEffect } from 'react';
  import { Categoria, AtributoHerdavel, CreateCategoryPayload, UpdateCategoryPayload } from './CategoryManager.types';
  import { getCategories, createCategory, updateCategory, deleteCategory, getAtributosGlobais } from './categoryService'; 
  import Button from '../../../../components/ui/Button/Button';

  const tenantIdGlobal = 1; 

  interface AtributoGlobalOpc {
    id: string;
    nome: string;
    tipo: string;
    unidade_medida?: string; // Mapeado para o sufixo visual
    valores_sugeridos?: string; // Mapeado para os exemplos
  }

  const useCategoryState = () => {
    const [categorias, setCategorias] = useState<Categoria[]>([]);
    const [categoriaSelecionadaId, setCategoriaSelecionadaId] = useState<string | null>(null);
    const [atributosGlobais, setAtributosGlobais] = useState<AtributoGlobalOpc[]>([]);
    
    const [loading, setLoading] = useState<boolean>(true);
    const [saving, setSaving] = useState<boolean>(false);

    // 🔄 1. CARREGAR DADOS DO SERVIDOR (GET)
    const carregarCategoriasDoServidor = async () => {
      setLoading(true);
      try {
        const dados = await getCategories(tenantIdGlobal);
        setCategorias(dados);
        
        const attrsGlobais = await getAtributosGlobais(tenantIdGlobal);
        setAtributosGlobais(attrsGlobais);
        
        if (dados.length > 0 && !categoriaSelecionadaId) {
          setCategoriaSelecionadaId(dados[0].id);
        }
      } catch (err: any) {
        console.error(err);
        alert(`🚨 Falha de Conexão: ${err.message || 'Não foi possível carregar as categorias.'}`);
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

    // 💾 2. SALVAR ALTERAÇÕES NO SERVIDOR
    const handleSalvarNoServidor = async () => {
      if (!categoriaSelecionada) return;
      setSaving(true);

      try {
        const isNovaCategoria = categoriaSelecionada.id.startsWith('temp-');

        // 🛡️ Filtra atributos que ainda não tiveram uma seleção global válida realizada
        // Dentro do handleSalvarNoServidor, antes de chamar a API:
const atributosLimpos = (categoriaSelecionada.atributosHeranca || [])
  .filter(attr => !String(attr.id).startsWith('h-'))
  .map(attr => ({
    atributo_id: Number(attr.id), // ID original de atributos_comercial
    escopo_comercial: attr.escopoComercial || 'ficha', // 'dna', 'grade' ou 'ficha'
    obrigatorio: attr.obrigatorio ? 1 : 0,
    pesquisavel: attr.pesquisavel ? 1 : 0,
    herdar: attr.herdar ? 1 : 0,
    sobrescreve: attr.sobrescreve ? 1 : 0,
    ordem: attr.ordem || 0
  }));

        if (isNovaCategoria) {
          const payloadCreate: CreateCategoryPayload = {
            nome: categoriaSelecionada.nome,
            parentId: categoriaSelecionada.parentId,
            percentualMargemSugerida: categoriaSelecionada.percentualMargemSugerida,
            modoExibicao: categoriaSelecionada.modoExibicao,
            descricao: categoriaSelecionada.descricao,
            atributosHeranca: atributosLimpos,
          };

          const resposta = await createCategory(payloadCreate, tenantIdGlobal);
          alert('🟢 Categoria criada com sucesso!');
          await carregarCategoriasDoServidor();
          if (resposta.id) setCategoriaSelecionadaId(resposta.id);

        } else {
          const payloadUpdate: UpdateCategoryPayload = {
            nome: categoriaSelecionada.nome,
            parentId: categoriaSelecionada.parentId,
            ativa: categoriaSelecionada.ativa,
            percentualMargemSugerida: categoriaSelecionada.percentualMargemSugerida,
            modoExibicao: categoriaSelecionada.modoExibicao,
            descricao: categoriaSelecionada.descricao,
            atributosHeranca: atributosLimpos,
          };

          await updateCategory(categoriaSelecionada.id, payloadUpdate, tenantIdGlobal);
          alert('🟢 Alterações salvas com sucesso!');
          await carregarCategoriasDoServidor();
        }
      } catch (err: any) {
        console.error(err);
        alert(`❌ Erro ao Salvar: ${err.message || 'O servidor rejeitou as modificações.'}`);
      } finally {
        setSaving(false);
      }
    };

    // 🗑️ 3. REMOVER CATEGORIA DO SERVIDOR (DELETE)
    const handleDeletarNoServidor = async (idCategoria: string) => {
      const temFilhas = categorias.some(c => c.parentId === idCategoria);
      if (temFilhas) {
        alert('❌ Não é possível excluir uma categoria que possui subcategorias vinculadas. Reorganize a árvore primeiro.');
        return;
      }

      if (!window.confirm('⚠️ Tem certeza que deseja deletar permanentemente esta categoria do sistema?')) {
        return;
      }

      setSaving(true);
      try {
        await deleteCategory(idCategoria, tenantIdGlobal);
        alert('🗑️ Categoria removida com sucesso!');
        setCategoriaSelecionadaId(null);
        await carregarCategoriasDoServidor();
      } catch (err: any) {
        console.error(err);
        alert(`❌ Erro ao Excluir: ${err.message || 'Erro ao processar exclusão no servidor.'}`);
      } finally {
        setSaving(false);
      }
    };

    // --- MUTAÇÕES LOCAIS DE ESTADO ---
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

    // 💡 Modificado: Agora injeta todas as propriedades estáticas do Atributo Global selecionado
    const handleMudarAtributoSelecionado = (idTemporario: string, idRealDoAtributoGlobal: string) => {
      const attrGlobal = atributosGlobais.find(a => String(a.id) === String(idRealDoAtributoGlobal));
      if (!attrGlobal) return;

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
                  sufixo: attrGlobal.unidade_medida || '',
                  exemplos: attrGlobal.valores_sugeridos || ''
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
        obrigatorio: false,
        herdar: true,
        ordem: (categoriaSelecionada?.atributosHeranca?.length || 0) + 1,
        exemplos: '',
        sufixo: ''
      };
      setCategorias(prev => prev.map(c => c.id === categoriaSelecionadaId ? { ...c, atributosHeranca: [...(c.atributosHeranca || []), novoAttr] } : c));
    };

    const handleRemoverAtributoLocal = (atributoId: string) => {
      setCategorias(prev => prev.map(c => {
        if (c.id !== categoriaSelecionadaId) return c;
        return {
          ...c,
          atributosHeranca: (c.atributosHeranca || []).filter(attr => attr.id !== atributoId)
        };
      }));
    };

    const handleAdicionarCategoriaNova = () => {
      const nova: Categoria = {
        id: `temp-${Date.now()}`, 
        tenant_id: tenantIdGlobal,
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
      categorias,
      categoriaSelecionada,
      categoriaSelecionadaId,
      atributosGlobais, 
      loading,
      saving,
      handleAtualizarCategoria,
      handleAtualizarSubCampo,
      handleAtualizarAtributoHerdado,
      handleMudarAtributoSelecionado, 
      handleAdicionarAtributo,
      handleRemoverAtributoLocal,
      handleAdicionarCategoriaNova,
      handleSalvarNoServidor,
      handleDeletarNoServidor,
      setCategoriaSelecionadaId
    };
  };

  // --- FUNÇÕES AUXILIARES ---
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
  
  // Guardamos as configurações customizadas que a categoria ALVO (idCategoriaAtual) 
  // fez sobre os atributos herdados (se ela bloqueou ou mudou retransmissão)
  const configuracoesLocaisAlvo = categoriaAtual?.atributosHeranca || [];

  while (categoriaAtual && !visitados.has(categoriaAtual.id)) {
    visitados.add(categoriaAtual.id);
    const deCima = categoriaAtual.id !== idCategoriaAtual;

    if (categoriaAtual.atributosHeranca && Array.isArray(categoriaAtual.atributosHeranca)) {
      
      // Se veio de cima, só avalia se o pai original marcou como 'herdar = true'
      const attrsFiltrados = categoriaAtual.atributosHeranca.filter(attr => !deCima || attr.herdar);

      const attrsFormatados = attrsFiltrados.map(attr => {
        // Se o atributo vem de cima, precisamos ver se a categoria atual (alvo) 
        // tem uma regra customizada para ele (Bloqueado ou Retransmitir)
        const customizacaoLocal = configuracoesLocaisAlvo.find(l => l.id === attr.id);
        
        return {
          ...attr,
          deCima,
          origem: categoriaAtual!.nome,
          // Se houver customização local, respeita ela. Senão, adota o padrão.
          bloqueado: customizacaoLocal ? !!customizacaoLocal.bloqueado : false,
          retransmitir: customizacaoLocal ? customizacaoLocal.retransmitir !== false : true
        };
      });

      // Se estamos avaliando um PAI intermediário (deCima === true), 
      // precisamos checar se ELE permitiu a retransmissão para os nós abaixo dele
      const attrsPermitidos = attrsFormatados.filter(attr => {
        if (!deCima) return true; // Se é nativo da categoria alvo, passa reto.
        
        // Se algum pai no meio do caminho barrou a retransmissão, ele morre aqui
        return attr.retransmitir !== false && !attr.bloqueado;
      });

      resultado = [...attrsPermitidos, ...resultado];
    }

    categoriaAtual = categoriaAtual.parentId 
      ? listaCategorias.find(c => c.id === categoriaAtual!.parentId) 
      : undefined;
  }

  // Remove duplicatas priorizando o nó mais próximo (sobreposição)
  const mapeadoPorId: Record<string, any> = {};
  resultado.forEach(attr => {
    // Se o atributo já foi mapeado por um nó mais abaixo (filho), o do pai não sobrescreve
    if (!mapeadoPorId[attr.id]) {
      mapeadoPorId[attr.id] = attr;
    }
  });

  // Filtra de vez os atributos que a categoria alvo marcou explicitamente como BLOQUEADO
  return Object.values(mapeadoPorId)
    .filter((attr: any) => !attr.bloqueado)
    .sort((a, b) => a.ordem - b.ordem);
};

  export const CategoryManager: React.FC = () => {
    const {
      categorias,
      categoriaSelecionada,
      categoriaSelecionadaId,
      atributosGlobais, 
      loading,
      saving,
      handleAtualizarCategoria,
      handleAtualizarSubCampo,
      handleAtualizarAtributoHerdado,
      handleMudarAtributoSelecionado, 
      handleAdicionarAtributo,
      handleRemoverAtributoLocal,
      handleAdicionarCategoriaNova,
      handleSalvarNoServidor,
      handleDeletarNoServidor,
      setCategoriaSelecionadaId
    } = useCategoryState();

    const [abasAbertas, setAbasAbertas] = useState<Record<string, boolean>>({
      estrutura: true,
      mapeamento: false,
      comercial: false,
      atributos: true
    });

    const toggleAbas = (aba: string) => {
      setAbasAbertas(prev => ({ ...prev, [aba]: !prev[aba] }));
    };

    const todosAtributosCalculados = useMemo(() => {
      return obterAtributosTudo(categoriaSelecionadaId, categorias);
    }, [categoriaSelecionadaId, categorias]);

    const renderTreeNodes = (parentId: string | null, level = 0) => {
      const filhas = categorias.filter(c => c.parentId === parentId);

      return filhas.map(cat => {
        const isSelected = categoriaSelecionada?.id === cat.id;
        const desativadaPorCascata = !cat.ativa || verificarSePaiInativo(cat.parentId, categorias);

        return (
          <div key={cat.id} style={{ display: 'flex', flexDirection: 'column' }}>
            <div 
              className={`tree-node ${isSelected ? 'active' : ''}`}
              style={{ 
                paddingLeft: `${Math.max(12, level * 20)}px`,
                opacity: desativadaPorCascata ? 0.45 : 1,
                cursor: 'pointer'
              }}
              onClick={() => setCategoriaSelecionadaId(cat.id)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexGrow: 1 }}>
                <span style={{ fontWeight: isSelected ? 700 : 500, fontSize: '13px', color: isSelected ? '#0050b3' : '#212b36' }}>
                  {level > 0 ? '↳ ' : ''}{cat.nome}
                </span>
                {desativadaPorCascata && (
                  <span style={{ fontSize: '9px', background: '#ea580c', color: '#fff', padding: '1px 4px', borderRadius: '3px' }}>
                    Inativo
                  </span>
                )}
              </div>
            </div>
            {renderTreeNodes(cat.id, level + 1)}
          </div>
        );
      });
    };

    if (loading) {
      return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'sans-serif', color: '#637381' }}>
          🔄 Carregando árvore de categorias do servidor...
        </div>
      );
    }

    return (
      <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', backgroundColor: '#f4f6f8', minHeight: '100vh', padding: '0' }}>
        
        <style>{`
          .cat-workspace { display: grid; grid-template-columns: 340px 1fr; min-height: 100vh; }
          .cat-sidebar { background: #ffffff; border-right: 1px solid #e1e4e8; padding: 16px; display: flex; flex-direction: column; gap: 12px; }
          .cat-main { padding: 24px; display: flex; flex-direction: column; gap: 12px; max-width: 1400px; width: 100%; box-sizing: border-box; }
          .tree-node { display: flex; align-items: center; justify-content: space-between; padding: 10px 12px; border-bottom: 1px solid #f4f6f8; border-left: 3px solid transparent; transition: all 0.15s; }
          .tree-node:hover { background: #f8fafc; }
          .tree-node.active { border-left-color: #0050b3; background: #f0f7ff; }
          .accordion-card { background: #ffffff; border: 1px solid #e1e4e8; border-radius: 6px; overflow: hidden; box-shadow: 0 1px 2px rgba(0,0,0,0.02); margin-bottom: 12px; }
          .accordion-header { background: #ffffff; padding: 14px 20px; display: flex; justify-content: space-between; align-items: center; cursor: pointer; user-select: none; transition: background 0.1s; }
          .accordion-header:hover { background: #f8fafc; }
          .accordion-title { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #212b36; display: flex; align-items: center; gap: 8px; }
          .accordion-content { padding: 10px; border-top: 1px solid #f4f6f8; background: #fff; }
          .accordion-arrow { font-size: 12px; color: #637381; transition: transform 0.2s; }
          .accordion-arrow.open { transform: rotate(180deg); }
          .cat-table { width: 100%; border-collapse: collapse; font-size: 13px; text-align: left; }
          .cat-table th { background: #f8fafc; color: #454f5b; padding: 12px 10px; font-weight: 600; border-bottom: 2px solid #e1e4e8; }
          .cat-table td { padding: 10px; border-bottom: 1px solid #f4f6f8; vertical-align: middle; }
          .cat-input { height: 32px; border: 1px solid #c4cbd4; border-radius: 3px; padding: 0 8px; font-size: 13px; color: #212b36; width: 100%; box-sizing: border-box; background: #fff; }
          .cat-input:focus { border-color: #0050b3; outline: none; }
          .cat-select { height: 32px; border: 1px solid #c4cbd4; border-radius: 3px; padding: 0 4px; font-size: 13px; width: 100%; background: #fff; box-sizing: border-box; }
          .toggle-active { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; cursor: pointer; }
          .btn-del-attr { background: transparent; border: none; color: #ef4444; cursor: pointer; font-size: 14px; font-weight: bold; padding: 4px 8px; borderRadius: 4px; }
          .btn-del-attr:hover { background: #fee2e2; }
        `}</style>

        <div className="cat-workspace">
          <aside className="cat-sidebar">
            <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: '#111213' }}>🌿 Matriz de Taxonomia</h3>
            <Button onClick={handleAdicionarCategoriaNova} style={{ backgroundColor: '#0050b3', color: '#fff', fontSize: '12px', height: '32px' }}>
              + Nova Categoria
            </Button>
            <div style={{ display: 'flex', flexDirection: 'column', marginTop: '8px', border: '1px solid #e1e4e8', borderRadius: '4px', overflow: 'hidden' }}>
              {renderTreeNodes(null)}
            </div>
          </aside>

          <main className="cat-main">
            {categoriaSelecionada ? (
              <>
                {/* ACORDEÃO 1: CONFIGURAÇÃO ESTRUTURAL */}
                <div className="accordion-card">
                  <div className="accordion-header" onClick={() => toggleAbas('estrutura')}>
                    <div className="accordion-title">📌 Configuração Estrutural da Categoria</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <label className="toggle-active" style={{ color: categoriaSelecionada.ativa ? '#15803d' : '#ea580c' }} onClick={e => e.stopPropagation()}>
                        <input type="checkbox" checked={categoriaSelecionada.ativa} onChange={e => handleAtualizarCategoria('ativa', e.target.checked)} />
                        {categoriaSelecionada.ativa ? '🟢 Ativa' : '🔴 Inativa'}
                      </label>
                      <span className={`accordion-arrow ${abasAbertas.estrutura ? 'open' : ''}`}>▼</span>
                    </div>
                  </div>
                  
                  {abasAbertas.estrutura && (
                    <div className="accordion-content">
                      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.2fr 1.1fr', gap: '16px', marginBottom: '16px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '11px', fontWeight: 500, color: '#454f5b' }}>Nome da Categoria</label>
                          <input type="text" className="cat-input" value={categoriaSelecionada.nome} onChange={e => handleAtualizarCategoria('nome', e.target.value)} />
                        </div>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '11px', fontWeight: 500, color: '#454f5b' }}>URL Amigável (Slug Catálogo)</label>
                          <input type="text" className="cat-input" style={{ background: '#f8fafc', color: '#475569', fontFamily: 'monospace' }} value={categoriaSelecionada.slug} onChange={e => handleAtualizarCategoria('slug', e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-'))} />
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '11px', fontWeight: 500, color: '#454f5b' }}>Nível / Categoria Pai</label>
                          <select 
                            className="cat-select"
                            value={categoriaSelecionada.parentId || ''} 
                            onChange={(e) => handleAtualizarCategoria('parentId', e.target.value || null)}
                            style={{ height: '36px', fontSize: '13px' }}
                          >
                            <option value="">Nível Raiz 🌍</option>
                            {categorias
                              .filter(c => c.id !== categoriaSelecionada.id)
                              .map(opc => (
                                <option key={opc.id} value={opc.id}>
                                  🔹 {opc.nome}
                                </option>
                              ))
                            }
                          </select>
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '11px', fontWeight: 500, color: '#454f5b' }}>Descrição de Escopo Técnico</label>
                        <input type="text" className="cat-input" value={categoriaSelecionada.descricao || ''} onChange={e => handleAtualizarCategoria('descricao', e.target.value)} />
                      </div>
                    </div>
                  )}
                </div>

                {/* ACORDEÃO 2: MAPEAMENTO DE INTEGRAÇÕES */}
                <div className="accordion-card" style={{ borderLeft: '4px solid #6366f1' }}>
                  <div className="accordion-header" onClick={() => toggleAbas('mapeamento')}>
                    <div className="accordion-title" style={{ color: '#4f46e5' }}>🔀 Mapeamento de Ecossistema (De/Para de IDs)</div>
                    <span className={`accordion-arrow ${abasAbertas.mapeamento ? 'open' : ''}`}>▼</span>
                  </div>
                  
                  {abasAbertas.mapeamento && (
                    <div className="accordion-content">
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', background: '#f8fafc', padding: '12px', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                          <label style={{ fontSize: '11px', fontWeight: 700, color: '#334155' }}>📦 CÓDIGO ERP CENTRAL</label>
                          <input type="text" className="cat-input" placeholder="Ex: CAT-9921" value={categoriaSelecionada.integracoes?.erpId || ''} onChange={e => handleAtualizarSubCampo('integracoes', 'erpId', e.target.value)} style={{ fontFamily: 'monospace' }} />
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', background: '#f0fdf4', padding: '12px', borderRadius: '4px', border: '1px solid #bbf7d0' }}>
                          <label style={{ fontSize: '11px', fontWeight: 700, color: '#166534' }}>🛒 ID CATEGORIA VTEX</label>
                          <input type="text" className="cat-input" placeholder="Ex: 402" value={categoriaSelecionada.integracoes?.vtexId || ''} onChange={e => handleAtualizarSubCampo('integracoes', 'vtexId', e.target.value)} style={{ fontFamily: 'monospace' }} />
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', background: '#fffbeb', padding: '12px', borderRadius: '4px', border: '1px solid #fef3c7' }}>
                          <label style={{ fontSize: '11px', fontWeight: 700, color: '#92400e' }}>💛 ID MERCADO LIVRE</label>
                          <input type="text" className="cat-input" placeholder="Ex: MLB1054" value={categoriaSelecionada.integracoes?.mercadolivreId || ''} onChange={e => handleAtualizarSubCampo('integracoes', 'mercadolivreId', e.target.value)} style={{ fontFamily: 'monospace' }} />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* ACORDEÃO 3: INTELIGÊNCIA COMERCIAL */}
                <div className="accordion-card" style={{ borderLeft: '4px solid #0050b3' }}>
                  <div className="accordion-header" onClick={() => toggleAbas('comercial')}>
                    <div className="accordion-title">💼 Inteligência Comercial & Layout</div>
                    <span className={`accordion-arrow ${abasAbertas.comercial ? 'open' : ''}`}>▼</span>
                  </div>
                  
                  {abasAbertas.comercial && (
                    <div className="accordion-content">
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr 2fr', gap: '16px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '11px', fontWeight: 500, color: '#454f5b' }}>Margem Sugerida Base (%)</label>
                          <input type="number" className="cat-input" value={categoriaSelecionada.percentualMargemSugerida || 0} onChange={e => handleAtualizarCategoria('percentualMargemSugerida', Number(e.target.value))} />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '11px', fontWeight: 500, color: '#454f5b' }}>Modo de Exibição Padrão</label>
                          <select className="cat-select" value={categoriaSelecionada.modoExibicao} onChange={e => handleAtualizarCategoria('modoExibicao', e.target.value)}>
                            <option value="grade">Grade de Produtos (Filtros Laterais)</option>
                            <option value="lista">Lista Técnico (Comparativo)</option>
                            <option value="carrossel">Carrossel Compacto (Vitrine)</option>
                          </select>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '11px', fontWeight: 500, color: '#454f5b' }}>Tags Indexadoras SEO</label>
                          <input type="text" className="cat-input" value={categoriaSelecionada.seo?.tags || ''} onChange={e => handleAtualizarSubCampo('seo', 'tags', e.target.value)} placeholder="ex: motor, eletrico" />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* ACORDEÃO 4: MATRIZ DE ATRIBUTOS */}
                <div className="accordion-card">
                  <div className="accordion-header" onClick={() => toggleAbas('atributos')}>
                    <div className="accordion-title">🧬 Matriz Técnico Consolidada (Atributos de Produto)</div>
                    <div onClick={e => e.stopPropagation()}>
                      <Button onClick={handleAdicionarAtributo} style={{ backgroundColor: '#fff', border: '1px solid #c4cbd4', color: '#0050b3', height: '26px', fontSize: '11px', fontWeight: 600 }}>
                        + Associar Atributo Global
                      </Button>
                    </div>
                  </div>
                  
                      <table className="cat-table">
    <thead>
      <tr>
        <th style={{ width: '20%' }}>Atributo & Governança (DNA)</th>
        <th style={{ width: '12%' }}>Tipo de Dado</th>
        <th style={{ width: '15%' }}>Escopo / Destino</th>
        <th style={{ width: '12%' }}>Uso no Catálogo</th>
        <th style={{ width: '10%' }}>Obrigatório</th>
        <th style={{ width: '16%' }}>Origem / Árvore</th>
        <th style={{ width: '13%' }}>Exemplos / Sufixo</th>
        <th style={{ width: '2%' }}></th>
      </tr>
    </thead>
    <tbody>
      {todosAtributosCalculados.map(attr => {
        const ehLinhaFalsaLocal = String(attr.id).startsWith('h-');

        const atributosDisponiveisCombo = atributosGlobais.filter(g => 
          !(categoriaSelecionada.atributosHeranca || []).some(a => String(a.id) === String(g.id))
        );

        return (
          <tr key={attr.id} style={{ backgroundColor: attr.deCima ? '#f8fafc' : 'transparent' }}>
            
            {/* 1. NOME & DNA (GOVERNANÇA) */}
            <td>
              {attr.deCima ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', paddingLeft: '8px' }}>
                  <span style={{ fontWeight: 600, color: '#475569' }}>{attr.nome}</span>
                  <span style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase' }}>
                    🧬 {attr.dna || 'Técnico'}
                  </span>
                </div>
              ) : ehLinhaFalsaLocal ? (
                <select 
                  className="cat-select" 
                  style={{ borderColor: '#0050b3', fontWeight: 600 }}
                  value="" 
                  onChange={e => handleMudarAtributoSelecionado(attr.id, e.target.value)}
                >
                  <option value="" disabled>-- Escolha um Atributo Global --</option>
                  {atributosDisponiveisCombo.map(g => (
                    <option key={g.id} value={g.id}>{g.nome}</option>
                  ))}
                </select>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', paddingLeft: '8px' }}>
                  <span style={{ fontWeight: 600, color: '#212b36' }}>{attr.nome}</span>
                  <span style={{ fontSize: '10px', color: '#637381', textTransform: 'uppercase' }}>
                    🧬 {attr.dna || 'Técnico'}
                  </span>
                </div>
              )}
            </td>

            {/* 2. TIPO DO DADO */}
            <td>
              <select className="cat-select" value={attr.tipoDado} disabled={true} style={{ color: '#64748b', background: '#f8fafc' }}>
                <option value="texto">Texto Livre</option>
                <option value="numero">Numérico</option>
                <option value="decimal">Decimal</option>
                <option value="boolean">Booleano</option>
                <option value="lista">Lista (Dropdown)</option>
              </select>
            </td>

            {/* 3. ESCOPO DE APLICAÇÃO (PRODUTO VS SKU) */}
            <td>
              <select 
                className="cat-select" 
                value={attr.escopo || 'produto'} 
                disabled={attr.deCima}
                onChange={e => handleAtualizarAtributoHerdado(attr.id, 'escopo', e.target.value)}
                style={{ color: attr.deCima ? '#64748b' : '#212b36' }}
              >
                <option value="produto">📦 Nível Produto (Pai)</option>
                <option value="sku">🔲 Nível SKU (Variante)</option>
              </select>
            </td>

            {/* 4. EXIBIÇÃO NO FRONTEND (GRADE VS FICHA) */}
            <td>
              <select 
                className="cat-select" 
                value={attr.comportamentoFront || 'ficha'} 
                disabled={attr.deCima}
                onChange={e => handleAtualizarAtributoHerdado(attr.id, 'comportamentoFront', e.target.value)}
                style={{ color: attr.deCima ? '#64748b' : '#212b36', fontWeight: attr.comportamentoFront === 'grade' ? 600 : 400 }}
              >
                <option value="ficha">📄 Ficha Técnica Only</option>
                <option value="grade">⚡ Seletor de Grade (SKU)</option>
                <option value="filtro">🔍 Filtro Lateral Only</option>
                <option value="ambos">✨ Filtro + Ficha</option>
              </select>
            </td>

            {/* 5. OBRIGATÓRIO */}
            <td>
              <select 
                className="cat-select" 
                value={attr.obrigatorio ? 'sim' : 'nao'} 
                disabled={attr.deCima} 
                onChange={e => handleAtualizarAtributoHerdado(attr.id, 'obrigatorio', e.target.value === 'sim')} 
                style={{ color: attr.deCima ? '#64748b' : '#212b36' }}
              >
                <option value="sim">🔴 Sim</option>
                <option value="nao">⚪ Não</option>
              </select>
            </td>

            {/* 6. ORIGEM / GOVERNANÇA DA ÁRVORE */}
          {/* 6. ORIGEM / GOVERNANÇA DA ÁRVORE */}
<td>
  {attr.deCima ? (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <span style={{ padding: '3px 8px', background: '#e2e8f0', color: '#475569', borderRadius: '4px', fontSize: '11px', fontWeight: 600, display: 'inline-block' }}>
        ↳ Herdado de: {attr.origem}
      </span>
      
      {/* CONTROLES DE HERANÇA PARA O FILHO DECIDIR */}
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
        <label style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', color: '#ef4444' }}>
          <input 
            type="checkbox" 
            checked={!!attr.bloqueado} 
            onChange={e => handleMudarControleHeranca(attr.id, 'bloqueado', e.target.checked)} 
          />
          Excluir desta Cat.
        </label>

        <label style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', color: '#2563eb' }}>
          <input 
            type="checkbox" 
            checked={attr.retransmitir !== false} 
            onChange={e => handleMudarControleHeranca(attr.id, 'retransmitir', e.target.checked)} 
          />
          Passar p/ Subcategorias
        </label>
      </div>
    </div>
  ) : ehLinhaFalsaLocal ? (
    <span style={{ padding: '3px 8px', background: '#fef3c7', color: '#d97706', borderRadius: '4px', fontSize: '11px', fontWeight: 600, display: 'inline-block' }}>
      ⏳ Aguardando...
    </span>
  ) : (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <span style={{ padding: '3px 8px', background: '#dcfce7', color: '#15803d', borderRadius: '4px', fontSize: '11px', fontWeight: 600, display: 'inline-block' }}>
        📍 Nativo desta Cat.
      </span>
      <label style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', color: '#475569' }}>
        <input 
          type="checkbox" 
          checked={attr.herdar} 
          onChange={e => handleAtualizarAtributoHerdado(attr.id, 'herdar', e.target.checked)} 
        />
        Propagar para filhos
      </label>
    </div>
  )}
</td>

            {/* 7. EXEMPLOS & SUFIXO */}
            <td>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <input 
                  type="text" 
                  className="cat-input" 
                  value={attr.exemplos ? `Ex: ${attr.exemplos}` : '-'} 
                  disabled={true} 
                  style={{ color: '#64748b', background: '#f8fafc', fontSize: '11px' }} 
                />
                {attr.sufixo && (
                  <span style={{ fontSize: '10px', color: '#0050b3', fontFamily: 'monospace', paddingLeft: '4px' }}>
                    Sufixo: {attr.sufixo}
                  </span>
                )}
              </div>
            </td>

            {/* 8. REMOVER VÍNCULO */}
            <td style={{ textAlign: 'center' }}>
              {!attr.deCima && (
                <button 
                  type="button" 
                  className="btn-del-attr" 
                  onClick={() => handleRemoverAtributoLocal(attr.id)}
                  title="Remover associação"
                >
                  ✕
                </button>
              )}
            </td>

          </tr>
        );
      })}
    </tbody>
  </table>
                </div>
                
                {/* SEÇÃO DE AÇÕES DO RODAPÉ */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
                  <div>
                    {!categoriaSelecionada.id.startsWith('temp-') && (
                      <Button 
                        onClick={() => handleDeletarNoServidor(categoriaSelecionada.id)}
                        disabled={saving}
                        style={{ backgroundColor: '#ef4444', color: '#fff', fontSize: '12px' }}
                      >
                        Excluir Categoria
                      </Button>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <Button 
                      onClick={handleSalvarNoServidor} 
                      disabled={saving} 
                      style={{ backgroundColor: '#16a34a', color: '#fff', fontWeight: 600, fontSize: '13px' }}
                    >
                      {saving ? '⏳ Gravando...' : '💾 Salvar Alterações'}
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px', border: '2px dashed #c4cbd4', borderRadius: '6px', color: '#637381' }}>
                Seleciona uma categoria ao lado para ver as propriedades técnicos.
              </div>
            )}
          </main>
        </div>
      </div>
    );
  };