import React, { useState, useMemo, useEffect } from 'react';
import FlexGridContainer from '../../../../components/Layout/FlexGridContainer/FlexGridContainer';



import { TreeSelect } from 'antd';

import { Grupo, AtributoConfig } from './CatalogManager.types';
import { gerarPreviewSku, gerarPreviewNome } from './CatalogManager.helpers';
import { SidebarGrupos } from './SidebarGrupos';
import { PainelSimulador } from './PainelSimulador';
import { TabelaAtributos } from './TabelaAtributos';
import Button from '../../../../components/ui/Button/Button';
import ImageDisplay from '../../../../components/ui/ImageGallery/ImageDysplay';

// Importações dos métodos da API
import { getGroups, createGroup, updateGroup, deleteGroup } from './CatalogManager.api';
import { ModalVinculoAtributos } from './ModalVinculoAtributos';
import Swal from 'sweetalert2';

interface Categoria {
  id: string;
  nome: string;
}

interface AtributoPendente {
  atributoId: string;
  campo: string;
  valor: any;
}

// 🌳 Função auxiliar movida para fora para evitar recriação na memória
const construirArvoreAntd = (lista: any[], paiId = null) => {
  return lista
    .filter(cat => cat.paiId === paiId)
    .map(cat => ({
      value: cat.id,
      title: `${cat.nome} (ID #${cat.id})`,
      children: construirArvoreAntd(lista, cat.id) // Recursão
    }));
};


const useCatalogState = () => {
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [grupoSelecionadoId, setGrupoSelecionadoId] = useState<string | null>(null);
  const [valoresTeste, setValoresTeste] = useState<Record<string, string>>({});
  const [grupoImage, setGrupoImage] = useState<string>('');
  const [abaAtiva, setAbaAtiva] = useState<'variantes' | 'informativos'>('variantes');
  const [isSimuladorAberto, setIsSimuladorAberto] = useState(false);

  const [atributoPendenteEdicao, setAtributoPendenteEdicao] = useState<AtributoPendente | null>(null);
  // const [listaAtributos, setListaAtributos] = useState<AtributoConfig[]>(dadosIniciais);


  // 🔄 ATUALIZADO: Agora intercepta a mudança com um Modal e salva o rastro para destaque visual
  // 🔄 ATUALIZADO: Agora intercepta a mudança com um Modal, garante tipos seguros e atualiza o estado
  const handleAtualizarAtributoDireto = async (atributoId: string, campo: keyof AtributoConfig, valor: any) => {
    if (!grupoSelecionado) return;

    // 🔒 Comparação segura transformando ambos para String
    const atributoAtual = grupoSelecionado.atributos.find(attr => String(attr.id) === String(atributoId));
    const nomeAtributo = atributoAtual ? atributoAtual.nome : 'este atributo';

    // 1. Define o ID e campo pendente para ativar o destaque visual via CSS
    setAtributoPendenteEdicao({ atributoId, campo, valor });

    // 2. Dispara o Modal de Confirmação do SweetAlert
    const resultado = await Swal.fire({
      title: 'Confirmar alteração?',
      text: `Deseja realmente alterar o campo "${String(campo)}" do atributo "${nomeAtributo}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: grupoSelecionado.cor || '#0050b3',
      cancelButtonColor: '#637381',
      confirmButtonText: 'Sim, alterar!',
      cancelButtonText: 'Cancelar',
      background: '#ffffff',
    });

    // 3. Se o usuário confirmou, aplica a alteração no estado do React
    // 3. Se o usuário confirmou, aplica a alteração no estado do React
    // 3. Se o usuário confirmou, aplica a alteração no estado do React
    if (resultado.isConfirmed) {
      setGrupos(prev => {
        // Retorna um novo array para garantir que o React mude a referência do estado principal
        return prev.map(g => {
          if (String(g.id) !== String(grupoSelecionadoId)) return g;

          // Cria um NOVO array de atributos para forçar a renderização e o re-fíltro nas tabelas
          const atributosAtualizados = g.atributos.map(attr => {
            if (String(attr.id) !== String(atributoId)) return attr;

            // Cria a cópia base com a nova alteração aplicada
            const novoAtributo = { ...attr, [campo]: valor };

            // 🔥 Sincroniza as flags automaticamente ao mudar de tabela/classificação
            if (campo === 'classificacao') {
              if (valor === 'dna') {
                novoAtributo.compoeSku = true;
                novoAtributo.geraVariacao = false;
              } else if (valor === 'grade') {
                novoAtributo.compoeSku = false;
                novoAtributo.geraVariacao = true;
              } else if (valor === 'especificacao') {
                novoAtributo.compoeSku = false;
                novoAtributo.geraVariacao = false;
              }
            }

            // Mantém as regras legadas por segurança
            if (campo === 'compoeSku' && valor === true) {
              novoAtributo.obrigatorio = true;
              novoAtributo.classificacao = 'dna';
            }

            if (campo === 'geraVariacao' && valor === true) {
              novoAtributo.classificacao = 'grade';
            }

            return novoAtributo;
          });

          // Retorna um NOVO objeto de grupo, forçando os useMemo de filtro a rodarem novamente
          return { ...g, atributos: atributosAtualizados };
        });
      });

      Swal.fire({
        title: 'Alterado!',
        text: 'O atributo foi movido/atualizado com sucesso.',
        icon: 'success',
        timer: 2000,
        showConfirmButton: false
      });
    }

    // 4. Limpa o destaque visual
    setAtributoPendenteEdicao(null);
  };


  // Controle Unificado do Modal de Vínculo
  const [isModalAberto, setIsModalAberto] = useState(false);
  const [tabelaAlvoModal, setTabelaAlvoModal] = useState<'dna' | 'grade' | 'especificacao' | null>(null);

  const handleAbrirModal = (tipo: 'dna' | 'grade' | 'especificacao') => {
    setTabelaAlvoModal(tipo);
    setIsModalAberto(true);
  };


  // Lista simulada de atributos globais cadastrados no ERP
  const [atributosGlobaisDisponiveis] = useState<Partial<AtributoConfig>[]>([
    { id: '10', nome: 'Voltagem', tipoDado: 'select' },
    { id: '11', nome: 'Potência (HP)', tipoDado: 'numero' },
    { id: '12', nome: 'Blindagem', tipoDado: 'texto' },
    { id: '13', nome: 'Vazão Máxima', tipoDado: 'numero' },
  ]);

  // 1. READ: Buscar dados do backend
  const carregarDados = async () => {
    setLoading(true);
    setError(null);
    try {
      const dadosDoServidor = await getGroups(1);
      setGrupos(dadosDoServidor);

      setCategorias([
        { id: '1', nome: 'Bombas Centrífugas' },
        { id: '2', nome: 'Motores Elétricos' },
        { id: '3', nome: 'Ferramentas Industriais' }
      ]);

      

      if (dadosDoServidor.length > 0 && !grupoSelecionadoId) {
        setGrupoSelecionadoId(dadosDoServidor[0].id);
      }
    } catch (err: any) {
      console.error("Erro ao buscar dados iniciais:", err);
      setError(err.message || 'Falha na conexão com o servidor de estoque.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarDados();
  }, []);

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setGrupoImage(event.target.value);
  };

  //  Criando um novo objeto com o spread operator para notificar o React
  const onAtualizarTemplateComercial = (valor: string) => {
    setGrupoSelecionado(prev => {
      if (!prev) return prev;
      return { ...prev, templateNomeComercial: valor };
    });
  };

  const handleMudancaValorTeste = (nomeAtributo: string, valor: string) => {
    setValoresTeste(prev => ({
      ...prev,
      [nomeAtributo]: valor // Atualiza dinamicamente a chave usando o nome do atributo
    }));
  };

  const grupoSelecionado = useMemo(() => {
    return grupos.find(g => g.id === grupoSelecionadoId) || null;
  }, [grupos, grupoSelecionadoId]);

  useEffect(() => {
    if (grupoSelecionado) {
      setGrupoImage(grupoSelecionado.imagem || '');
    }
  }, [grupoSelecionadoId, grupoSelecionado]);

  const atributosDoSku = useMemo(() => {
    if (!grupoSelecionado) return [];
    return grupoSelecionado.atributos
      .filter(attr => attr.compoeSku && attr.ordemSku > 0)
      .sort((a, b) => a.ordemSku - b.ordemSku);
  }, [grupoSelecionado]);

  const previewSkuSimulado = useMemo(() => {
    return gerarPreviewSku(grupoSelecionado, atributosDoSku, valoresTeste);
  }, [grupoSelecionado, atributosDoSku, valoresTeste]);

  const previewNomeSimulado = useMemo(() => {
    return gerarPreviewNome(grupoSelecionado, valoresTeste);
  }, [grupoSelecionado, valoresTeste]);

  const handleSelecionarGrupo = (id: string | null) => {
    setGrupoSelecionadoId(id);
    setValoresTeste({});
  };

  const handleAtualizarGrupoDireto = (campo: keyof Grupo, valor: any) => {
    setGrupos(prev => prev.map(g => g.id === grupoSelecionadoId ? { ...g, [campo]: valor } : g));
  };


  // 🔗 LINK ATRIBUTO: Insere o atributo configurando as flags baseado em quem abriu o modal
  const handleAdicionarAtributoAoGrupo = (novoAttr: Partial<AtributoConfig>) => {
    if (!grupoSelecionado) return;

    const oAtributoJaExiste = grupoSelecionado.atributos.some(a => a.nome.toLowerCase() === novoAttr.nome?.toLowerCase());
    if (oAtributoJaExiste) {
      alert("Este atributo já está associado a este grupo.");
      return;
    }

    const compoeSku = tabelaAlvoModal === 'dna';
    const geraVariacao = tabelaAlvoModal === 'grade';
    const classificacao = tabelaAlvoModal || 'especificacao';

    const estruturaCompletaAtributo: AtributoConfig = {
      id: novoAttr.id || `temp-${Date.now()}`,
      nome: novoAttr.nome || 'Novo Atributo',
      tipoDado: novoAttr.tipoDado || 'texto',
      classificacao: classificacao,
      separadorSufixo: 'nenhum',
      sufixo: '',
      obrigatorio: compoeSku,
      geraVariacao: geraVariacao,
      compoeSku: compoeSku,
      ordemSku: grupoSelecionado.atributos.length + 1,
      exemplos: ''
    };

    setGrupos(prev => prev.map(g => {
      if (g.id !== grupoSelecionadoId) return g;
      return { ...g, atributos: [...g.atributos, estruturaCompletaAtributo] };
    }));

    setIsModalAberto(false);
    setTabelaAlvoModal(null);
  };

  // 2. CREATE
  const handleCriarGrupo = async () => {
    setLoading(true);
    try {
      const payloadVazio = {
        nome: 'Novo Grupo de Produtos',
        categoriaPai: '',
        descricao: '',
        unidadeMedidaBase: 'PC',
        templateNome: '{GRUPO} {sigla-Grupo}',
        separadorSku: '-',
        cor: '#0050b3',
        imagem: '',
        atributos: []
      };

      const res = await createGroup(payloadVazio, 1);
      if (res.success && res.id_grupo) {
        await carregarDados();
        setGrupoSelecionadoId(res.id_grupo);
      }
    } catch (err: any) {
      alert(`Erro ao criar grupo: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // 3. UPDATE
  const handleSalvarGrupoNoBanco = async () => {
    if (!grupoSelecionado) return;
    setLoading(true);
    try {
      const dadosParaSalvar = { ...grupoSelecionado, imagem: grupoImage };
      await updateGroup(grupoSelecionado.id, dadosParaSalvar, 1);
      alert(`Estrutura relacional do grupo "${grupoSelecionado.nome}" salva com sucesso!`);
      await carregarDados();
    } catch (err: any) {
      console.error("Erro ao salvar grupo:", err);
      alert(`Erro ao salvar alterações: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // 4. DELETE
  const handleDeletarGrupo = async (id: string) => {
    if (!window.confirm("Tem certeza que deseja excluir permanentemente este grupo?")) return;

    setLoading(true);
    try {
      await deleteGroup(id, 1);
      const novosGrupos = grupos.filter(g => g.id !== id);
      setGrupos(novosGrupos);

      if (grupoSelecionadoId === id) {
        setGrupoSelecionadoId(novosGrupos[0]?.id || null);
      }
      alert("Grupo removido com sucesso!");
    } catch (err: any) {
      console.error("Erro ao deletar grupo:", err);
      alert(`Não foi possível excluir: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return {
    grupos,
    categorias,
    grupoSelecionado,
    valoresTeste,
    setValoresTeste,
    isModalAberto,
    abaAtiva,
    previewSkuSimulado,
    previewNomeSimulado,
    grupoImage,
    isSimuladorAberto,
    loading,
    error,
    atributosGlobaisDisponiveis,
    carregarDados,
    setIsSimuladorAberto,
    setIsModalAberto,
    setAbaAtiva,
    handleSelecionarGrupo,
    handleAtualizarGrupoDireto,
    handleAtualizarAtributoDireto,
    handleAdicionarAtributoAoGrupo,
    handleInputChange,
    handleCriarGrupo,
    handleSalvarGrupoNoBanco,
    handleDeletarGrupo,
    handleAbrirModal,
    tabelaAlvoModal,
    atributoPendenteEdicao
  };
};

export const CatalogManager: React.FC = () => {
  const {
    grupoSelecionado,
    grupos,
    categorias,
    valoresTeste,
    setValoresTeste,
    abaAtiva,
    previewSkuSimulado,
    previewNomeSimulado,
    grupoImage,
    isSimuladorAberto,
    loading,
    error,
    isModalAberto,
    atributosGlobaisDisponiveis,
    setIsSimuladorAberto,
    setAbaAtiva,
    handleSelecionarGrupo,
    handleAtualizarGrupoDireto,
    handleAtualizarAtributoDireto,
    atributoPendenteEdicao,
    handleAdicionarAtributoAoGrupo,
    handleInputChange,
    setIsModalAberto,
    handleCriarGrupo,
    handleSalvarGrupoNoBanco,
    handleDeletarGrupo,
    handleAbrirModal,
    tabelaAlvoModal,
    
  } = useCatalogState();

  const brandColor = grupoSelecionado?.cor || '#0050b3';
// 1. Memoriza os dados convertidos em árvore para alimentar o TreeSelect eficientemente
  const dadosArvoreAntd = useMemo(() => {
    return construirArvoreAntd(categorias);
  }, [categorias]);


  const atributosIdentidade = useMemo(() => {
    return grupoSelecionado ? grupoSelecionado.atributos.filter(attr => attr.classificacao === 'dna' || attr.compoeSku) : [];
  }, [grupoSelecionado]);

  const atributosVariacao = useMemo(() => {
    return grupoSelecionado ? grupoSelecionado.atributos.filter(attr => attr.classificacao === 'grade' || attr.geraVariacao) : [];
  }, [grupoSelecionado]);

  const atributosFichaTecnica = useMemo(() => {
    return grupoSelecionado ? grupoSelecionado.atributos.filter(attr => attr.classificacao === 'especificacao' || (!attr.compoeSku && !attr.geraVariacao)) : [];
  }, [grupoSelecionado]);

  return (
    <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', backgroundColor: '#f4f6f8', padding: '0' }}>

      <style>{`
        .panel-header-sticky { position: sticky; top: 0; z-index: 10; display: flex; justify-content: space-between; align-items: center; background: #ffffff; padding: 12px 24px; border-bottom: 1px solid #e1e4e8; box-shadow: 0 1px 2px rgba(0,0,0,0.02); }
        .manager-workspace { display: grid; grid-template-columns: 280px 1fr; min-height: calc(100vh - 60px); }
        .manager-content-area { padding: 20px; display: flex; flex-direction: column; gap: 16px; max-width: 1600px; width: 100%; box-sizing: border-box; }
        .section-card { background: #ffffff; border: 1px solid #e1e4e8; border-radius: 4px; padding: 16px; box-shadow: 0 1px 2px rgba(0,0,0,0.01); }
        .premium-card { 
  background: #11161d; /* Escuro moderno (Slate/Navy) */
  border: 1px solid #1e293b; 
  border-radius: 8px; 
  padding: 20px; 
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3); 
  color: #f8fafc; 
  position: relative; 
}

        .linha-atributo-pendente {
          background-color: #fffbe6 !important; /* Amarelo bem claro de alerta */
          outline: 2px solid #faad14; /* Borda dourada/alerta */
          animation: pulseDestaque 1.5s infinite ease-in-out;
          transition: all 0.3s ease;
        }

        @keyframes pulseDestaque {
          0% { opacity: 1; }
          50% { opacity: 0.7; }
          100% { opacity: 1; }
        }
.premium-card-title { 
  font-size: 11px; 
  font-weight: 700; 
  text-transform: uppercase; 
  letter-spacing: 0.8px; 
  color: #64748b; 
  padding-bottom: 12px; 
  margin-bottom: 4px; 
  display: flex; 
  align-items: center; 
  justify-content: space-between; 
}

.premium-card .input-wrapper label { 
  color: #94a3b8; 
  font-weight: 600;
  font-size: 11px;
}

/* Inputs internos dos blocos escuros */
.premium-card .modern-input { 
  background-color: #0b0f14 !important; 
  border-color: #334155 !important; 
  color: #f8fafc !important; 
  border-radius: 6px;
  height: 34px;
}

.premium-card .modern-input:focus {
  border-color: #38bdf8 !important;
  outline: none;
  box-shadow: 0 0 0 1px #38bdf8;
}  

.grid-inputs { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; width: 100%; }
        .input-wrapper { display: flex; flex-direction: column; gap: 4px; }
        .input-wrapper label { font-size: 11px; font-weight: 500; color: #454f5b; }
        
        
        .modern-input, .modern-select { height: 32px; border: 1px solid #c4cbd4; border-radius: 3px; padding: 0 8px; font-size: 13px; color: #212b36; background-color: #ffffff; transition: all 0.15s; width: 100%; box-sizing: border-box; }
        .tab-nav-container { display: flex; border-bottom: 1px solid #e1e4e8; margin-bottom: 12px; gap: 4px; }
        .tab-nav-btn { padding: 8px 12px; font-size: 12px; font-weight: 500; color: #637381; border: none; background: transparent; cursor: pointer; position: relative; }
        .tab-nav-btn.active { color: ${brandColor}; font-weight: 600; }
        .tab-nav-btn.active::after { content: ''; position: absolute; bottom: -1px; left: 0; right: 0; height: 2px; background: ${brandColor}; }
        .accordion-header { display: flex; justify-content: space-between; align-items: center; padding: 10px 16px; background: #f0f2f5; border: 1px solid #d9d9d9; border-radius: 4px; cursor: pointer; }
        .accordion-title { font-size: 11px; font-weight: bold; color: #454f5b; text-transform: uppercase; display: flex; align-items: center; gap: 6px; }
        .accordion-content { background: #fafbfc; border: 1px solid #e1e4e8; padding: 16px; border-left: 4px solid #454f5b; border-top: none; }
        .crud-bar { background: #ffffff; padding: 12px 24px; border-bottom: 1px solid #e1e4e8; display: flex; justify-content: space-between; align-items: center; }
        .error-banner { background-color: #ffeaf0; border: 1px solid #ff4d4f; color: #ff4d4f; padding: 12px 24px; display: flex; justify-content: space-between; align-items: center; }
        .modal-overlay { position: fixed; top:0; left:0; right:0; bottom:0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 100; }
        .modal-body { background: #ffffff; padding: 20px; border-radius: 6px; width: 450px; border-top: 4px solid ${brandColor}; }
        .modal-list-item { padding: 10px; border: 1px solid #e1e4e8; margin-bottom: 8px; border-radius: 4px; display: flex; justify-content: space-between; align-items: center; cursor: pointer; }
        .modal-list-item:hover { background: #f4f6f8; }
      `}</style>

      {/* BARRA DE AÇÕES CRUD SUPERIOR */}
      <div className="crud-bar">
        <div>
          <h2 style={{ margin: 0, fontSize: '16px', color: '#1c2434' }}>Gerenciador de Catálogo de Grupos</h2>
          <span style={{ fontSize: '12px', color: loading ? '#fa8c16' : '#00a76f' }}>
            {loading ? '🔄 Sincronizando com o banco...' : '🟢 Banco de dados conectado'}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <Button onClick={handleCriarGrupo} variant="secondary" disabled={loading}>＋ Criar Novo Grupo</Button>
          {grupoSelecionado && (
            <Button onClick={handleSalvarGrupoNoBanco} disabled={loading} style={{ backgroundColor: '#00a76f', color: '#fff' }}>
              {loading ? 'Salvando...' : '💾 Salvar Alterações'}
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="error-banner">
          <div><strong>⚠️ Falha de Integração:</strong> {error}</div>
          <Button onClick={useCatalogState().carregarDados} style={{ backgroundColor: '#ff4d4f', color: '#fff', padding: '4px 12px', fontSize: '12px' }}>
            🔄 Tentar Novamente
          </Button>
        </div>
      )}

      <div className="manager-workspace">
        <SidebarGrupos
          grupos={grupos}
          grupoSelecionadoId={grupoSelecionado?.id || null}
          onSelecionarGrupo={handleSelecionarGrupo}
          onDeletarGrupo={handleDeletarGrupo}
        />

        <main className="manager-content-area">
          {grupoSelecionado ? (
            <>
              {/* CONFIGURAÇÕES BÁSICAS */}
              <section className="premium-card" style={{ borderTop: `3px solid ${brandColor}` }}>
                <div className="premium-card-title">
                  <span>📌 Configurações Estruturais do Grupo</span>
                  <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'none' }}>Grupo ID: #{grupoSelecionado.id}</span>
                </div>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr minmax(220px, 260px)',
                  gap: '24px',
                  alignItems: 'start'
                }}>

                  {/* COLUNA DA ESQUERDA: GRID DE INPUTS */}
                  <div className="grid-inputs" style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(18 0px, 1fr))',
                    gap: '16px'
                  }}>

                    {/* BLCO 1: DADOS BÁSICOS */}
                    <div className="input-wrapper">
                      <label>Nome Padrão do Grupo</label>
                      <input type="text" value={grupoSelecionado.nome} onChange={e => handleAtualizarGrupoDireto('nome', e.target.value)} className="modern-input" />
                    </div>

{/* BLOCO 2: CATEGORIA ANTD SELECTION */}
                  <div className="input-wrapper">
                    <label>Categoria Global</label>
                    <TreeSelect
                      style={{ width: '100%' }}
                      value={grupoSelecionado.categoriaPai || undefined}
                      dropdownStyle={{ maxHeight: 400, overflow: 'auto' }}
                      treeData={dadosArvoreAntd}
                      placeholder="-- Selecione uma Categoria --"
                      treeDefaultExpandAll
                      onChange={valor => handleAtualizarGrupoDireto('categoriaPai', valor)}
                    />
                  </div>

                    <div className="input-wrapper">
                      <label>Unidade de Medida Padrão (UoM)</label>
                      <select value={grupoSelecionado.unidadeMedidaBase || 'PC'} className="modern-select" onChange={e => handleAtualizarGrupoDireto('unidadeMedidaBase', e.target.value)}>
                        <option value="PC">PC - Peça</option>
                        <option value="UN">UN - Unidade</option>
                        <option value="MM">MM - Milímetro</option>
                        <option value="MT">MT - Metro</option>
                      </select>
                    </div>

                    <div className="input-wrapper">
                      <label>Tipo de Item (Inventário)</label>
                      <select value={grupoSelecionado.tipoItem || 'PA'} className="modern-select" onChange={e => handleAtualizarGrupoDireto('tipoItem', e.target.value)}>
                        <option value="PA">Produto Acabado</option>
                        <option value="MP">Matéria-Prima</option>
                        <option value="KT">Kit / Combo</option>
                      </select>
                    </div>



                    {/* BLOCO 3: FISCAL & IDENTIDADE */}
                    <div className="input-wrapper">
                      <label>NCM Padrão Fiscal</label>
                      <input
                        type="text"
                        value={grupoSelecionado.ncmPadrao || ''}
                        onChange={e => handleAtualizarGrupoDireto('ncmPadrao', e.target.value)}
                        className="modern-input"
                        placeholder="Ex: 8413.70.10"
                      />
                    </div>

                    <div className="input-wrapper">
                      <label>CEST Padrão Fiscal</label>
                      <input
                        type="text"
                        value={grupoSelecionado.cestPadrao || ''}
                        onChange={e => handleAtualizarGrupoDireto('cestPadrao', e.target.value)}
                        className="modern-input"
                        placeholder="Ex: 01.001.00"
                      />
                    </div>


                    {/* --- NOVOS CAMPOS DE TEXTO E HERANÇA ESTRUTURAL --- */}
                    {/* Ocupam toda a largura horizontal disponível para melhor legibilidade de textos longos */}

                    {/* CONTAINER DE TEXTAREAS EM UMA ÚNICA LINHA COMPARTILHADA */}
                    <div style={{
                      gridColumn: '1 / -1',
                      display: 'grid',
                      gridTemplateColumns: '2fr 2fr 1.5fr', // Divide o espaço proporcionalmente
                      gap: '16px',
                      marginTop: '8px'
                    }}>

                      {/* DESCRIÇÃO INTERNA */}
                      <div className="input-wrapper" style={{ display: 'flex', flexDirection: 'column' }}>
                        <label style={{ color: '#0050b3', fontWeight: 600 }}>Descrição Interna (Ficha Técnica ERP)</label>
                        <textarea
                          value={grupoSelecionado.descricao || ''}
                          onChange={e => handleAtualizarGrupoDireto('descricao', e.target.value)}
                          className="modern-input"
                          style={{ minHeight: '70px', padding: '8px', width: '100%', boxSizing: 'border-box', fontFamily: 'inherit', resize: 'vertical' }}
                          placeholder="Descrição técnica resumida para controle interno..."
                        />
                      </div>

                      {/* DESCRIÇÃO COMERCIAL */}
                      <div className="input-wrapper" style={{ display: 'flex', flexDirection: 'column' }}>
                        <label style={{ color: '#0050b3', fontWeight: 600 }}>Descrição Comercial Padrão</label>
                        <textarea
                          value={grupoSelecionado.descricaoComercialPadrao || ''}
                          onChange={e => handleAtualizarGrupoDireto('descricaoComercialPadrao', e.target.value)}
                          className="modern-input"
                          style={{ minHeight: '70px', padding: '8px', width: '100%', boxSizing: 'border-box', fontFamily: 'inherit', resize: 'vertical' }}
                          placeholder="Texto base de marketing/vendas replicado em todos os SKUs..."
                        />
                      </div>

                      {/* OBSERVAÇÕES / GARANTIA */}
                      <div className="input-wrapper" style={{ display: 'flex', flexDirection: 'column' }}>
                        <label style={{ color: '#0050b3', fontWeight: 600 }}>Observações / Garantia</label>
                        <textarea
                          value={grupoSelecionado.observacoesPadrao || ''}
                          onChange={e => handleAtualizarGrupoDireto('observacoesPadrao', e.target.value)}
                          className="modern-input"
                          style={{ minHeight: '70px', padding: '8px', width: '100%', boxSizing: 'border-box', fontFamily: 'inherit', resize: 'vertical' }}
                          placeholder="Ex: Garantia de 12 meses. Cuidados de manuseio..."
                        />
                      </div>

                    </div>


                  </div>

                  {/* COLUNA DA DIREITA: SEÇÃO DA IMAGEM */}
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    padding: '16px',
                    background: '#11161d',
                    border: '1px solid #334155',
                    borderRadius: '4px',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxSizing: 'border-box',
                    minHeight: '180px'
                  }}>

                    <ImageDisplay size='80px' src={grupoImage || undefined} />

                    <div style={{ width: '100%', display: 'flex', flexDirection: 'column' }}>
                      <label style={{ fontSize: '10px', fontWeight: '600', color: '#94a3b8', textTransform: 'uppercase', textAlign: 'center' }}>
                        Imagem Capa do Grupo
                      </label>
                      <input
                        type='text'
                        placeholder='URL da imagem...'
                        value={grupoImage}
                        onChange={handleInputChange}
                        className="modern-input"
                        style={{ height: '28px', fontSize: '11px', marginTop: '8px', textAlign: 'center' }}
                      />
                    </div>

                    <div className="input-wrapper">
                      <label>Código de Cor Identificadora</label>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <input type="color" value={grupoSelecionado.cor || '#fa8c16'} onChange={e => handleAtualizarGrupoDireto('cor', e.target.value)} style={{ width: '40px', height: '34px', padding: 0, border: 'none', background: 'none', cursor: 'pointer' }} />
                        <input type="text" value={grupoSelecionado.cor || ''} onChange={e => handleAtualizarGrupoDireto('cor', e.target.value)} className="modern-input" placeholder="#fa8c16" />
                      </div>
                    </div>
                  </div>

                </div>
              </section>

              {/* 🔥 CHAMADA CORRIGIDA DO PAINEL SIMULADOR */}
              <PainelSimulador
                grupoSelecionado={grupoSelecionado}
                valoresTeste={valoresTeste}
                previewNomeSimulado={previewNomeSimulado}
                previewSkuSimulado={previewSkuSimulado}
                brandColor={brandColor}
                onMudancaValorTeste={(id, valor) => {
                  setValoresTeste(prev => {
                    const novoEstado = { ...prev };
                    if (valor === '') {
                      delete novoEstado[id];
                    } else {
                      novoEstado[id] = valor;
                    }
                    return novoEstado;
                  });
                }}
                // Vincula corretamente os modificadores de estado estrutural do Grupo
                onAtualizarTemplateComercial={(valor) => handleAtualizarGrupoDireto('templateNomeComercial', valor)}
                onAtualizarTemplateSku={(valor) => handleAtualizarGrupoDireto('templateSku', valor)}
                onAtualizarSiglaSku={(valor) => handleAtualizarGrupoDireto('siglaSku', valor)}
                onAtualizarSeparadorSku={(valor) => handleAtualizarGrupoDireto('separadorSku', valor)}
                onAtualizarOrdemSku={(atributoId, novaOrdem) => {
                  handleAtualizarAtributoDireto(atributoId, 'ordemSku', novaOrdem);
                }}
              />

              {/* SANFONA DO SIMULADOR
              <section style={{ width: '100%', display: 'flex', flexDirection: 'column' }}>
                <div className="accordion-header" onClick={() => setIsSimuladorAberto(!isSimuladorAberto)}>
                  <span className="accordion-title">🛠️ Simulador de Engenharia e Ajuste de Fórmulas Anatômicas</span>
                  <span>{isSimuladorAberto ? '▲' : '▼'}</span>
                </div>
                {isSimuladorAberto && (
                  <div className="accordion-content">
                    <PainelSimulador
                      grupoSelecionado={grupoSelecionado}
                      valoresTeste={valoresTeste}
                      onMudancaValorTeste={(id, valor) => {
                        setValoresTeste(prev => {
                          const novoEstado = { ...prev };
                          if (valor === '') {
                            delete novoEstado[id];
                          } else {
                            novoEstado[id] = valor;
                          }
                          return novoEstado;
                        });
                      }}
                      onAtualizarTemplate={(valor) => handleAtualizarGrupoDireto('templateNome', valor)}
                    />
                  </div>
                )}
              </section> */}

              {/* MATRIZ DE ATRIBUTOS */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', alignItems: 'start' }}>
                <div className="section-card" style={{ minHeight: '340px' }}>
                  <TabelaAtributos
                    titulo="Atributos de DNA"
                    tipo="dna"
                    mostrarExpansao={true}
                    atributoPendenteEdicao={atributoPendenteEdicao}
                    onAtualizarAtributo={handleAtualizarAtributoDireto}
                    onAbrirModal={handleAbrirModal}
                    // 🛠️ CORRIGIDO: alterado de attr.tipo para attr.classificacao
                    atributos={grupoSelecionado.atributos.filter(attr => attr.classificacao === 'dna')}
                  />
                </div>

                <div className="section-card" style={{ minHeight: '340px' }}>
                  <nav className="tab-nav-container">
                    <button type="button" onClick={() => setAbaAtiva('variantes')} className={`tab-nav-btn ${abaAtiva === 'variantes' ? 'active' : ''}`}>🧬 Grade de Variações</button>
                    <button type="button" onClick={() => setAbaAtiva('informativos')} className={`tab-nav-btn ${abaAtiva === 'informativos' ? 'active' : ''}`}>📋 Ficha Técnica</button>
                  </nav>

                  <div>
                    {abaAtiva === 'variantes' && (
                      <TabelaAtributos
                        titulo="Grade de Variações"
                        tipo="grade"
                        atributoPendenteEdicao={atributoPendenteEdicao}
                        onAtualizarAtributo={handleAtualizarAtributoDireto}
                        onAbrirModal={handleAbrirModal}
                        // 🛠️ CORRIGIDO: alterado de attr.tipo para attr.classificacao
                        atributos={grupoSelecionado.atributos.filter(attr => attr.classificacao === 'grade')}
                      />
                    )}

                    {abaAtiva === 'informativos' && (
                      <TabelaAtributos
                        titulo="Ficha Técnica"
                        tipo="especificacao"
                        atributoPendenteEdicao={atributoPendenteEdicao}
                        onAtualizarAtributo={handleAtualizarAtributoDireto}
                        onAbrirModal={handleAbrirModal}
                        // 🛠️ CORRIGIDO: alterado de attr.tipo para attr.classificacao
                        atributos={grupoSelecionado.atributos.filter(attr => attr.classificacao === 'especificacao')}
                      />
                    )}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div style={{ padding: '40px', textAlign: 'center', color: '#637381' }}>
              Nenhum grupo selecionado ou cadastrado. Clique em "Criar Novo Grupo" para iniciar.
            </div>
          )}
        </main>
      </div>

      <ModalVinculoAtributos
        isModalAberto={isModalAberto}
        setIsModalAberto={setIsModalAberto}
        destinoModal={tabelaAlvoModal || 'especificacao'}
        atributosGlobaisDisponiveis={atributosGlobaisDisponiveis as any}
        handleAdicionarAtributoAoGrupo={handleAdicionarAtributoAoGrupo}
        brandColor={brandColor}
      />
    </div>
  );
};