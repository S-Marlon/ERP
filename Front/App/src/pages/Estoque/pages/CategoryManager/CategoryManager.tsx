import React, { useState, useMemo, useEffect } from 'react';
import { Categoria, AtributoHerdável } from './CategoryManager.types';
// 🟢 AJUSTADO: Importando também o deleteCategory do seu arquivo de serviços
import { getCategories, createCategory, updateCategory, deleteCategory } from './categoryService'; 
import Button from '../../../../components/ui/Button/Button';

const tenantIdGlobal = 1; 

const useCategoryState = () => {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [categoriaSelecionadaId, setCategoriaSelecionadaId] = useState<string | null>(null);
  
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);

  // 🔄 1. CARREGAR DADOS DO SERVIDOR (GET)
  const carregarCategoriasDoServidor = async () => {
    setLoading(true);
    try {
      const dados = await getCategories(tenantIdGlobal);
      setCategorias(dados);
      
      if (dados.length > 0 && !categoriaSelecionadaId) {
        setCategoriaSelecionadaId(dados[0].id_categoria);
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
    return categorias.find(c => c.id_categoria === categoriaSelecionadaId) || null;
  }, [categorias, categoriaSelecionadaId]);

  // 💾 2. SALVAR ALTERAÇÕES NO SERVIDOR (POST ou PUT)
  const handleSalvarNoServidor = async () => {
    if (!categoriaSelecionada) return;
    setSaving(true);

    try {
      const isNovaCategoria = categoriaSelecionada.id_categoria.startsWith('temp-');

      if (isNovaCategoria) {
        const payloadCreate = {
          nome: categoriaSelecionada.nome,
          id_categoria_pai: categoriaSelecionada.id_categoria_pai,
          percentual_margem_sugerida: categoriaSelecionada.percentual_margem_sugerida,
          modo_exibicao: categoriaSelecionada.modo_exibicao,
          descricao: categoriaSelecionada.descricao
        };

        const resposta = await createCategory(payloadCreate, tenantIdGlobal);
        alert('🟢 Categoria criada com sucesso!');
        
        await carregarCategoriasDoServidor();
        if (resposta.id_categoria) setCategoriaSelecionadaId(resposta.id_categoria);

      } else {
        // No PUT, enviamos a categoria com a estrutura completa ajustada (incluindo objetos serializados de volta para string se necessário)
        await updateCategory(categoriaSelecionada.id_categoria, categoriaSelecionada, tenantIdGlobal);
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
    const temFilhas = categorias.some(c => c.id_categoria_pai === idCategoria);
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
      
      // Limpa a seleção e atualiza a lista local
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
      if (c.id_categoria !== categoriaSelecionadaId) return c;
      if (campo === 'nome') return { ...c, nome: valor, slug: gerarSlug(valor) };
      return { ...c, [campo]: valor };
    }));
  };

  const handleAtualizarSubCampo = (bloco: 'seo' | 'integracoes', campo: string, valor: string) => {
    setCategorias(prev => prev.map(c => {
      if (c.id_categoria !== categoriaSelecionadaId) return c;
      return { ...c, [bloco]: { ...(c[bloco] || {}), [campo]: valor } };
    }));
  };

  const handleAtualizarAtributoHerdado = (atributoId: string, campo: keyof AtributoHerdável, valor: any) => {
    setCategorias(prev => prev.map(c => {
      if (c.id_categoria !== categoriaSelecionadaId) return c;
      return {
        ...c,
        atributos_heranca: (c.atributos_heranca || []).map(attr => attr.id === atributoId ? { ...attr, [campo]: valor } : attr)
      };
    }));
  };

  const handleAdicionarAtributo = () => {
    if (!categoriaSelecionadaId) return;
    const novoAttr: AtributoHerdável = {
      id: `h-${Date.now()}`,
      nome: 'Novo Atributo Herança',
      tipoDado: 'texto',
      obrigatorio: false,
      sufixo: '',
      exemplos: ''
    };
    setCategorias(prev => prev.map(c => c.id_categoria === categoriaSelecionadaId ? { ...c, atributos_heranca: [...(c.atributos_heranca || []), novoAttr] } : c));
  };

  const handleAlterarPai = (idCategoria: string, newParentId: string | null) => {
    if (idCategoria === newParentId) return;
    setCategorias(prev => prev.map(c => c.id_categoria === idCategoria ? { ...c, id_categoria_pai: newParentId || null } : c));
  };

  const handleAdicionarCategoriaNova = () => {
    const nova: Categoria = {
      id_categoria: `temp-${Date.now()}`, 
      nome: 'Nova Categoria',
      slug: 'nova-categoria',
      ativa: true,
      ordem: categorias.length + 1,
      percentual_margem_sugerida: 30,
      modo_exibicao: 'grade',
      id_categoria_pai: null,
      atributos_heranca: [],
      seo: { tags: '', metaTitle: '', metaDescription: '' },
      integracoes: { erpId: '', vtexId: '', mercadolivreId: '' }
    };
    setCategorias(prev => [...prev, nova]);
    setCategoriaSelecionadaId(nova.id_categoria);
  };

  return {
    categorias,
    categoriaSelecionada,
    categoriaSelecionadaId,
    loading,
    saving,
    handleAtualizarCategoria,
    handleAtualizarSubCampo,
    handleAtualizarAtributoHerdado,
    handleAdicionarAtributo,
    handleAlterarPai,
    handleAdicionarCategoriaNova,
    handleSalvarNoServidor,
    handleDeletarNoServidor,
    setCategoriaSelecionadaId
  };
};

// --- FUNÇÕES AUXILIARES PARA CÁLCULO DE HERANÇA E SLUG ---

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
  const pai = listaCategorias.find(c => c.id_categoria === idPai);
  if (!pai) return false;
  if (!pai.ativa) return true;
  return verificarSePaiInativo(pai.id_categoria_pai, listaCategorias);
};

const obterAtributosTudo = (idCategoriaAtual: string | null, listaCategorias: Categoria[]): any[] => {
  if (!idCategoriaAtual) return [];
  
  let resultado: any[] = [];
  let categoriaAtual = listaCategorias.find(c => c.id_categoria === idCategoriaAtual);
  const visitados = new Set<string>();

  while (categoriaAtual && !visitados.has(categoriaAtual.id_categoria)) {
    visitados.add(categoriaAtual.id_categoria);
    const deCima = categoriaAtual.id_categoria !== idCategoriaAtual;

    if (categoriaAtual.atributos_heranca && Array.isArray(categoriaAtual.atributos_heranca)) {
      const attrsFormatados = categoriaAtual.atributos_heranca.map(attr => ({
        ...attr,
        deCima, 
        origem: categoriaAtual!.nome 
      }));
      resultado = [...attrsFormatados, ...resultado];
    }
    categoriaAtual = categoriaAtual.id_categoria_pai 
      ? listaCategorias.find(c => c.id_categoria === categoriaAtual!.id_categoria_pai) 
      : undefined;
  }
  return resultado;
};

export const CategoryManager: React.FC = () => {
  const {
    categorias,
    categoriaSelecionada,
    categoriaSelecionadaId,
    loading,
    saving,
    handleAtualizarCategoria,
    handleAtualizarSubCampo,
    handleAtualizarAtributoHerdado,
    handleAdicionarAtributo,
    handleAlterarPai,
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
  const filhas = categorias.filter(c => c.id_categoria_pai === parentId);

  return filhas.map(cat => {
    const isSelected = categoriaSelecionada?.id_categoria === cat.id_categoria;
    const desativadaPorCascata = !cat.ativa || verificarSePaiInativo(cat.id_categoria_pai, categorias);

    return (
      <div key={cat.id_categoria} style={{ display: 'flex', flexDirection: 'column' }}>
        <div 
          className={`tree-node ${isSelected ? 'active' : ''}`}
          style={{ 
            paddingLeft: `${Math.max(12, level * 20)}px`,
            opacity: desativadaPorCascata ? 0.45 : 1,
            cursor: 'pointer'
          }}
          onClick={() => setCategoriaSelecionadaId(cat.id_categoria)}
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
        {renderTreeNodes(cat.id_categoria, level + 1)}
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
        
        .hierarchy-controls { display: none; margin-left: 8px; }
        .tree-node:hover .hierarchy-controls { display: block; }

        .accordion-card { background: #ffffff; border: 1px solid #e1e4e8; border-radius: 6px; overflow: hidden; box-shadow: 0 1px 2px rgba(0,0,0,0.02); }
        .accordion-header { background: #ffffff; padding: 14px 20px; display: flex; justify-content: space-between; align-items: center; cursor: pointer; user-select: none; transition: background 0.1s; }
        .accordion-header:hover { background: #f8fafc; }
        .accordion-title { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #212b36; display: flex; align-items: center; gap: 8px; }
        .accordion-content { padding: 20px; border-top: 1px solid #f4f6f8; background: #fff; }
        .accordion-arrow { font-size: 12px; color: #637381; transition: transform 0.2s; }
        .accordion-arrow.open { transform: rotate(180deg); }
        
        .cat-table { width: 100%; border-collapse: collapse; font-size: 13px; text-align: left; }
        .cat-table th { background: #f8fafc; color: #454f5b; padding: 10px; font-weight: 600; border-bottom: 2px solid #e1e4e8; }
        .cat-table td { padding: 8px 10px; border-bottom: 1px solid #f4f6f8; vertical-align: middle; }
        
        .cat-input { height: 32px; border: 1px solid #c4cbd4; border-radius: 3px; padding: 0 8px; font-size: 13px; color: #212b36; width: 100%; box-sizing: border-box; background: #fff; }
        .cat-input:focus { border-color: #0050b3; outline: none; }
        .cat-select { height: 32px; border: 1px solid #c4cbd4; border-radius: 3px; padding: 0 4px; font-size: 13px; width: 100%; background: #fff; box-sizing: border-box; }
        .toggle-active { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; cursor: pointer; }
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
              {/* ACORDEÃO 1: CONFIGURAÇÃO CORE */}
              {/* ACORDEÃO: CONFIGURAÇÃO ESTRUTURAL */}
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
      {/* Alterado para 3 colunas para acomodar a Hierarquia com elegância */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.2fr 1.1fr', gap: '16px', marginBottom: '16px' }}>
        
        {/* Campo: Nome */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '11px', fontWeight: 500, color: '#454f5b' }}>Nome da Categoria</label>
          <input type="text" className="cat-input" value={categoriaSelecionada.nome} onChange={e => handleAtualizarCategoria('nome', e.target.value)} />
        </div>
        
        {/* Campo: Slug */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '11px', fontWeight: 500, color: '#454f5b' }}>URL Amigável (Slug Catálogo)</label>
          <input type="text" className="cat-input" style={{ background: '#f8fafc', color: '#475569', fontFamily: 'monospace' }} value={categoriaSelecionada.slug} onChange={e => handleAtualizarCategoria('slug', e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-'))} />
        </div>

        {/* 🟢 NOVO CAMPO: Seletor de Hierarquia Pai (Trazido da barra lateral) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '11px', fontWeight: 500, color: '#454f5b' }}>Nível / Categoria Pai</label>
          <select 
            className="cat-select"
            value={categoriaSelecionada.id_categoria_pai || ''} 
            onChange={(e) => handleAtualizarCategoria('id_categoria_pai', e.target.value || null)}
            style={{ height: '36px', fontSize: '13px' }}
          >
            <option value="">Nível Raiz 🌍</option>
            {categorias
              // Regra de ouro: Não deixa ela ser subcategoria dela mesma
              .filter(c => c.id_categoria !== categoriaSelecionada.id_categoria)
              .map(opc => (
                <option key={opc.id_categoria} value={opc.id_categoria}>
                  🔹 {opc.nome}
                </option>
              ))
            }
          </select>
        </div>

      </div>

      {/* Campo: Descrição */}
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
                        <label style={{ fontSize: '11px', fontWeight: 700, color: '#334155' }}>📦 CÓDIGO ERP CENTRAL (Totvs/SAP)</label>
                        <input type="text" className="cat-input" placeholder="Ex: CAT-9921" value={categoriaSelecionada.integracoes?.erpId || ''} onChange={e => handleAtualizarSubCampo('integracoes', 'erpId', e.target.value)} style={{ fontFamily: 'monospace' }} />
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', background: '#f0fdf4', padding: '12px', borderRadius: '4px', border: '1px solid #bbf7d0' }}>
                        <label style={{ fontSize: '11px', fontWeight: 700, color: '#166534' }}>🛒 ID CATEGORIA VTEX / E-COMMERCE</label>
                        <input type="text" className="cat-input" placeholder="Ex: 402" value={categoriaSelecionada.integracoes?.vtexId || ''} onChange={e => handleAtualizarSubCampo('integracoes', 'vtexId', e.target.value)} style={{ fontFamily: 'monospace' }} />
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', background: '#fffbeb', padding: '12px', borderRadius: '4px', border: '1px solid #fef3c7' }}>
                        <label style={{ fontSize: '11px', fontWeight: 700, color: '#92400e' }}>💛 ID CATEGORIA MERCADO LIVRE</label>
                        <input type="text" className="cat-input" placeholder="Ex: MLB1054" value={categoriaSelecionada.integracoes?.mercadolivreId || ''} onChange={e => handleAtualizarSubCampo('integracoes', 'mercadolivreId', e.target.value)} style={{ fontFamily: 'monospace' }} />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* ACORDEÃO 3: COMERCIAL */}
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
                        <input type="number" className="cat-input" value={categoriaSelecionada.percentual_margem_sugerida || 0} onChange={e => handleAtualizarCategoria('percentual_margem_sugerida', Number(e.target.value))} />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '11px', fontWeight: 500, color: '#454f5b' }}>Modo de Exibição Padrão</label>
                        <select className="cat-select" value={categoriaSelecionada.modo_exibicao} onChange={e => handleAtualizarCategoria('modo_exibicao', e.target.value)}>
                          <option value="grade">Grade de Produtos (Filtros Laterais)</option>
                          <option value="lista">Lista Técnica (Comparativo Linha a Linha)</option>
                          <option value="carrossel">Carrossel Compacto (Vitrine)</option>
                        </select>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '11px', fontWeight: 500, color: '#454f5b' }}>Tags Indexadoras SEO</label>
                        <input type="text" className="cat-input" value={categoriaSelecionada.seo?.tags || ''} onChange={e => handleAtualizarSubCampo('seo', 'tags', e.target.value)} placeholder="ex: motor, eletrico, weg" />
                      </div>
                    </div>
                  </div>
                )}
              </div>

            {/* ACORDEÃO 4: MATRIZ DE ATRIBUTOS */}
<div className="accordion-card">
  <div className="accordion-header" onClick={() => toggleAbas('atributos')}>
    <div className="accordion-title">🧬 Matriz Técnica Consolidada (Atributos de Produto)</div>
    <div onClick={e => e.stopPropagation()}>
      <Button onClick={handleAdicionarAtributo} style={{ backgroundColor: '#fff', border: '1px solid #c4cbd4', color: '#0050b3', height: '26px', fontSize: '11px', fontWeight: 600 }}>
        + Adicionar Atributo Local
      </Button>
    </div>
  </div>
  
  {abasAbertas.atributos && (
    <div className="accordion-content" style={{ padding: '0' }}>
      <table className="cat-table">
        <thead>
          <tr>
            <th style={{ width: '22%' }}>Nome do Atributo</th>
            <th style={{ width: '15%' }}>Tipo do Dado</th>
            <th style={{ width: '12%' }}>Sufixo</th>
            <th style={{ width: '12%' }}>Obrigatório</th>
            <th style={{ width: '22%' }}>Origem / Governança</th>
            <th>Exemplos de Valores</th>
          </tr>
        </thead>
        <tbody>
          {todosAtributosCalculados.map(attr => (
            <tr key={attr.id} style={{ backgroundColor: attr.deCima ? '#f8fafc' : 'transparent' }}>
              <td><input type="text" className="cat-input" value={attr.nome} disabled={attr.deCima} onChange={e => handleAtualizarAtributoHerdado(attr.id, 'nome', e.target.value)} style={{ fontWeight: 500, color: attr.deCima ? '#64748b' : '#212b36' }} /></td>
              <td>
                <select className="cat-select" value={attr.tipoDado} disabled={attr.deCima} onChange={e => handleAtualizarAtributoHerdado(attr.id, 'tipoDado', e.target.value as any)} style={{ color: attr.deCima ? '#64748b' : '#212b36' }}>
                  <option value="texto">Texto Livre</option>
                  <option value="numero">Numérico</option>
                  <option value="select">Lista (Select)</option>
                </select>
              </td>
              <td><input type="text" className="cat-input" value={attr.sufixo || ''} disabled={attr.deCima} onChange={e => handleAtualizarAtributoHerdado(attr.id, 'sufixo', e.target.value)} placeholder="-" style={{ textAlign: 'center', fontFamily: 'monospace', color: attr.deCima ? '#64748b' : '#212b36' }} /></td>
              <td>
                <select className="cat-select" value={attr.obrigatorio ? 'sim' : 'nao'} disabled={attr.deCima} onChange={e => handleAtualizarAtributoHerdado(attr.id, 'obrigatorio', e.target.value === 'sim')} style={{ color: attr.deCima ? '#64748b' : '#212b36' }}>
                  <option value="sim">Sim</option>
                  <option value="nao">Não</option>
                </select>
              </td>
              <td>
                {attr.deCima ? (
                  <span style={{ padding: '3px 8px', background: '#e2e8f0', color: '#475569', borderRadius: '12px', fontSize: '11px', fontWeight: 600, display: 'inline-block' }}>
                    ⬆️ Herdado de: {attr.origem.replace(/[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD00-\uDFFF]/g, '')}
                  </span>
                ) : (
                  <span style={{ padding: '3px 8px', background: '#dcfce7', color: '#15803d', borderRadius: '12px', fontSize: '11px', fontWeight: 600, display: 'inline-block' }}>
                    📍 Definido Aqui
                  </span>
                )}
              </td>
              {/* 🟢 CORRIGIDO AQUI: Adicionado o (e) => antes da função */}
              <td><input type="text" className="cat-input" value={attr.exemplos || ''} disabled={attr.deCima} onChange={(e) => handleAtualizarAtributoHerdado(attr.id, 'exemplos', e.target.value)} placeholder="Ex: valores..." style={{ color: attr.deCima ? '#64748b' : '#212b36' }} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )}
</div>
              
              {/* 🟢 SEÇÃO DE AÇÕES DO RODAPÉ (SALVAR E DELETAR) */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
                <div>
                  {/* O botão de excluir só aparece se a categoria não for temporária (já existir no DB) */}
                  {!categoriaSelecionada.id_categoria.startsWith('temp-') && (
                    <Button 
                      onClick={() => handleDeletarNoServidor(categoriaSelecionada.id_categoria)}
                      disabled={saving}
                      style={{ backgroundColor: '#dc2626', color: '#fff', padding: '0 16px', height: '40px', fontWeight: 600, fontSize: '13px' }}
                    >
                      🗑️ Excluir Categoria
                    </Button>
                  )}
                </div>
                
                <Button 
                  onClick={handleSalvarNoServidor}
                  disabled={saving}
                  style={{ backgroundColor: saving ? '#9ca3af' : '#15803d', color: '#fff', padding: '0 24px', height: '40px', fontWeight: 600 }}
                >
                  {saving ? '⏳ Salvando...' : '💾 Salvar Modificações'}
                </Button>
              </div>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px', color: '#637381' }}>Selecione uma categoria para gerenciar a árvore técnica.</div>
          )}
        </main>
      </div>
    </div>
  );
};