import React, { useState, useMemo, useEffect } from 'react';
import { TreeSelect, Select, Input } from 'antd'; // 🌟 Centralizado componentes do Antd aqui
import styles from './FamilyManager.module.css';
import { Grupo, AtributoConfig, Categoria } from './CatalogManager.types';
import { gerarPreviewSku, gerarPreviewNome } from './CatalogManager.helpers';
import { SidebarFamilias } from './components/SidebarFamilias';
import { PainelSimulador } from './components/PainelSimulador';
import { TabelaAtributos } from './components/TabelaAtributos';
import Button from '../../../../components/ui/Button/Button';
import ImageDisplay from '../../../../components/ui/ImageGallery/ImageDysplay';

// Importações dos métodos da API oficiais corrigidos
import { getGroups, createGroup, updateGroup, getCategorias, getAtributosDaCategoria } from './FamilyManager.api';
import { ModalVinculoAtributos } from './components/ModalVinculoAtributos';
import Swal from 'sweetalert2';

// 🌳 Versão blindada contra tipos numéricos/strings do banco
const construirArvoreAntd = (lista: any[], paiId: string | null = null) => {
  return lista
    .filter(cat => {
      if (!cat.paiId && !paiId) return true;
      return String(cat.paiId) === String(paiId);
    })
    .map(cat => ({
      value: String(cat.id),
      title: `${cat.nome} (ID #${cat.id})`,
      children: construirArvoreAntd(lista, cat.id)
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
  const [atributoPendenteEdicao, setAtributoPendenteEdicao] = useState<any | null>(null);
  const [atributosGlobaisDisponiveis, setAtributosGlobaisDisponiveis] = useState<any[]>([]);

  const grupoSelecionado = useMemo(() => {
    return grupos.find(g => g.id === grupoSelecionadoId) || null;
  }, [grupos, grupoSelecionadoId]);

  const brandColor = grupoSelecionado?.cor || '#0050b3';

  const handleAtualizarGrupoDireto = (campo: keyof Grupo, valor: any) => {
    setGrupos(prev => prev.map(g => g.id === grupoSelecionadoId ? { ...g, [campo]: valor } : g));
  };

  const handleMoverAtributoDeEscopo = async (atributoId: string, novoEscopo: 'dna' | 'grade' | 'ficha') => {
    if (!grupoSelecionado) return;

    const atributoAtual = grupoSelecionado.atributos.find(attr => String(attr.id) === String(atributoId));
    if (!atributoAtual) return;

    const nomesEscopo = { dna: 'DNA (Fixo do SKU)', grade: 'Grade (Variador de SKU)', ficha: 'Ficha Técnica' };

    const resultado = await Swal.fire({
      title: `Mover para ${nomesEscopo[novoEscopo]}?`,
      text: `Deseja alterar o comportamento do atributo "${atributoAtual.nome}"? Isso reconfigurará as regras de geração de SKU.`,
      icon: 'info',
      showCancelButton: true,
      confirmButtonColor: grupoSelecionado.cor || '#0050b3',
      cancelButtonColor: '#637381',
      confirmButtonText: 'Sim, mover!',
      cancelButtonText: 'Cancelar'
    });

    if (resultado.isConfirmed) {
      setGrupos(prev => prev.map(g => {
        if (String(g.id) !== String(grupoSelecionadoId)) return g;

        const atributosAtualizados = g.atributos.map(attr => {
          if (String(attr.id) !== String(atributoId)) return attr;

          const atributoModificado = { ...attr, classificacao: novoEscopo };

          if (novoEscopo === 'dna') {
            atributoModificado.compoeSku = true;
            atributoModificado.geraVariacao = false;
            atributoModificado.obrigatorio = true;
            if (atributoModificado.ordemSku === 0) {
              atributoModificado.ordemSku = g.atributos.filter(a => a.classificacao === 'dna').length + 1;
            }
          }
          else if (novoEscopo === 'grade') {
            atributoModificado.compoeSku = false;
            atributoModificado.geraVariacao = true;
            atributoModificado.obrigatorio = true;
            atributoModificado.ordemSku = 0;
          }
          else if (novoEscopo === 'ficha') {
            atributoModificado.compoeSku = false;
            atributoModificado.geraVariacao = false;
            atributoModificado.obrigatorio = false;
            atributoModificado.ordemSku = 0;
          }

          return atributoModificado;
        });

        return { ...g, atributos: atributosAtualizados };
      }));

      Swal.fire({
        title: 'Movido!',
        text: `Atributo configurado como ${nomesEscopo[novoEscopo]}.`,
        icon: 'success',
        timer: 1500,
        showConfirmButton: false
      });
    }
  };

  const handleAtualizarAtributoDireto = async (atributoId: string, campo: keyof AtributoConfig, valor: any) => {
    if (!grupoSelecionado) return;

    const atributoAtual = grupoSelecionado.atributos.find(attr => String(attr.id) === String(atributoId));
    const nomeAtributo = atributoAtual ? atributoAtual.nome : 'este atributo';

    setAtributoPendenteEdicao({ atributoId, campo, valor });

    const resultado = await Swal.fire({
      title: 'Confirmar alteração?',
      text: `Deseja realmente alterar o campo "${String(campo)}" do atributo "${nomeAtributo}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: brandColor,
      cancelButtonColor: '#637381',
      confirmButtonText: 'Sim, alterar!',
      cancelButtonText: 'Cancelar',
      background: '#ffffff',
    });

    if (resultado.isConfirmed) {
      setGrupos(prev => {
        return prev.map(g => {
          if (String(g.id) !== String(grupoSelecionadoId)) return g;

          const atributosAtualizados = g.atributos.map(attr => {
            if (String(attr.id) !== String(atributoId)) return attr;

            const novoAtributo = { ...attr, [campo]: valor };

            if (campo === 'classificacao') {
              if (valor === 'dna') {
                novoAtributo.compoeSku = true;
                novoAtributo.geraVariacao = false;
              } else if (valor === 'grade') {
                novoAtributo.compoeSku = false;
                novoAtributo.geraVariacao = true;
              } else if (valor === 'ficha') {
                novoAtributo.compoeSku = false;
                novoAtributo.geraVariacao = false;
              }
            }

            if (campo === 'compoeSku' && valor === true) {
              novoAtributo.obrigatorio = true;
              novoAtributo.classificacao = 'dna';
            }

            if (campo === 'geraVariacao' && valor === true) {
              novoAtributo.classificacao = 'grade';
            }

            return novoAtributo;
          });

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

    setAtributoPendenteEdicao(null);
  };

  const [isModalAberto, setIsModalAberto] = useState(false);
  const [tabelaAlvoModal, setTabelaAlvoModal] = useState<'dna' | 'grade' | 'ficha' | null>(null);

  const handleAbrirModal = (tipo: 'dna' | 'grade' | 'ficha') => {
    setTabelaAlvoModal(tipo);
    setIsModalAberto(true);
  };

  const carregarDados = async () => {
    setLoading(true);
    setError(null);
    try {
      const [dadosDoServidor, dadosCategorias] = await Promise.all([
        getGroups(1),
        getCategorias(1)
      ]);

      setGrupos(dadosDoServidor);
      setCategorias(dadosCategorias);

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

  const handleMudarCategoriaComConfirmacao = async (novaCategoriaId: string | undefined) => {
    if (!grupoSelecionado) return;

    const categoriaAntigaId = grupoSelecionado.categoriaPai;

    if (!novaCategoriaId) {
      const resultadoDesvincular = await Swal.fire({
        title: 'Remover vínculo com a categoria?',
        text: 'Ao desvincular, este grupo deixará de herdar os atributos automáticos desta árvore. Deseja continuar?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#637381',
        confirmButtonText: 'Sim, desvincular!',
        cancelButtonText: 'Cancelar',
        background: '#ffffff',
      });

      if (resultadoDesvincular.isConfirmed) {
        handleAtualizarGrupoDireto('categoriaPai', '');
        handleAtualizarGrupoDireto('categoriaPaiNome', '');
        Swal.fire({
          title: 'Desvinculado!',
          text: 'O vínculo com a categoria foi removido.',
          icon: 'success',
          timer: 2000,
          showConfirmButton: false
        });
      }
      return;
    }

    if (String(categoriaAntigaId) === String(novaCategoriaId)) return;

    const categoriaAlvo = categorias.find(c => String(c.id) === String(novaCategoriaId));
    const nomeCategoria = categoriaAlvo ? categoriaAlvo.nome : 'esta categoria';

    const resultadoAlterar = await Swal.fire({
      title: 'Vincular a esta categoria?',
      text: `Ao mudar para "${nomeCategoria}", o grupo poderá herdar e sincronizar os atributos específicos dela. Deseja continuar?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: brandColor,
      cancelButtonColor: '#637381',
      confirmButtonText: 'Sim, vincular!',
      cancelButtonText: 'Cancelar',
      background: '#ffffff',
    });

    if (resultadoAlterar.isConfirmed) {
      try {
        setLoading(true);
        const atributosHerdados = await getAtributosDaCategoria(novaCategoriaId, 1);

        const novosAtributosObrigatorios: AtributoConfig[] = atributosHerdados
          .filter((attr: any) => Boolean(attr.obrigatorio))
          .map((attr: any) => ({
            id: String(attr.id),
            nome: attr.nome,
            tipoDado: attr.tipoDado || 'texto',
            classificacao: attr.compoeSku ? 'dna' : 'ficha',
            separadorSufixo: attr.separadorSufixo || 'nenhum',
            sufixo: attr.sufixo || '',
            obrigatorio: true,
            geraVariacao: Boolean(attr.geraVariacao),
            compoeSku: Boolean(attr.compoeSku),
            ordemSku: 0,
            exemplos: attr.exemplos || '',
            valorHerdadoDoGrupo: false
          }));

        setGrupos(prev => prev.map(g => {
          if (g.id !== grupoSelecionadoId) return g;
          const atributosAtuaisFiltrados = g.atributos.filter(
            bancoAttr => !novosAtributosObrigatorios.some(novo => String(novo.id) === String(bancoAttr.id))
          );

          return {
            ...g,
            categoriaPai: novaCategoriaId,
            categoriaPaiNome: nomeCategoria,
            atributos: [...atributosAtuaisFiltrados, ...novosAtributosObrigatorios]
          };
        }));

        Swal.fire({
          title: 'Categoria Vinculada!',
          text: `Atributos obrigatórios herdados com sucesso.`,
          icon: 'success',
          timer: 2000,
          showConfirmButton: false
        });

      } catch (err: any) {
        console.error("Erro ao herdar atributos da categoria:", err);
        Swal.fire('Erro', 'Não foi possível buscar os atributos desta categoria.', 'error');
      } finally {
        setLoading(false);
      }
    }
  };

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

  const handleAdicionarAtributoAoGrupo = (novoAttr: Partial<AtributoConfig>) => {
    if (!grupoSelecionado) return;

    const oAtributoJaExiste = grupoSelecionado.atributos.some(a => a.nome.toLowerCase() === novoAttr.nome?.toLowerCase());
    if (oAtributoJaExiste) {
      alert("Este atributo já está associado a este grupo.");
      return;
    }

    const compoeSku = tabelaAlvoModal === 'dna';
    const geraVariacao = tabelaAlvoModal === 'grade';
    const classificacao = tabelaAlvoModal || 'ficha';

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
      exemplos: '',
      valorHerdadoDoGrupo: false
    };

    setGrupos(prev => prev.map(g => {
      if (g.id !== grupoSelecionadoId) return g;
      return { ...g, atributos: [...g.atributos, estruturaCompletaAtributo] };
    }));

    setIsModalAberto(false);
    setTabelaAlvoModal(null);
  };

  const handleCriarGrupo = async () => {
    setLoading(true);
    try {
      const payloadVazio = {
        nome: 'Nova Família de Produtos',
        categoriaPai: '',
        categoriaPaiNome: '',
        descricao: '',
        unidadeMedidaBase: 'PC',
        templateNome: '{GRUPO}',
        separadorSku: '-',
        cor: '#0050b3',
        imagem: '',
        atributos: []
      };

      const res = await createGroup(payloadVazio, 1);
      if (res.success && res.id) {
        await carregarDados();
        setGrupoSelecionadoId(res.id);
      }
    } catch (err: any) {
      alert(`Erro ao criar grupo: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSalvarGrupoNoBanco = async () => {
    if (!grupoSelecionado) return;
    setLoading(true);
    try {
      const nomeAtualNaTela = grupoSelecionado.categoriaPaiNome;
      const dadosParaSalvar = { ...grupoSelecionado, imagem: grupoImage };

      await updateGroup(grupoSelecionado.id, dadosParaSalvar, 1);
      alert(`Estrutura relacional do grupo "${grupoSelecionado.nome}" salva com sucesso!`);

      await carregarDados();

      setGrupos(prev => prev.map(g =>
        g.id === grupoSelecionado.id && !g.categoriaPaiNome
          ? { ...g, categoriaPaiNome: nomeAtualNaTela }
          : g
      ));

    } catch (err: any) {
      console.error("Erro ao salvar grupo:", err);
      alert(`Erro ao salvar alterações: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return {
    grupos, categorias, grupoSelecionado, valoresTeste, setValoresTeste, isModalAberto, abaAtiva,
    previewSkuSimulado, previewNomeSimulado, grupoImage, isSimuladorAberto, loading, error,
    atributosGlobaisDisponiveis, carregarDados, setIsSimuladorAberto, setIsModalAberto, setAbaAtiva,
    handleSelecionarGrupo, handleAtualizarGrupoDireto, handleAtualizarAtributoDireto,
    handleAdicionarAtributoAoGrupo, handleInputChange, handleCriarGrupo, handleSalvarGrupoNoBanco,
    handleAbrirModal, tabelaAlvoModal, atributoPendenteEdicao, handleMudarCategoriaComConfirmacao, brandColor,
    handleMoverAtributoDeEscopo
  };
};

export const FamilyManager: React.FC = () => {
  const {
    grupoSelecionado, grupos, categorias, valoresTeste, previewSkuSimulado,
    previewNomeSimulado, grupoImage, loading, error, isModalAberto, atributosGlobaisDisponiveis,
    setIsModalAberto, handleSelecionarGrupo, handleAtualizarGrupoDireto,
    handleAtualizarAtributoDireto, atributoPendenteEdicao, handleAdicionarAtributoAoGrupo,
    handleInputChange, handleCriarGrupo, handleSalvarGrupoNoBanco, handleAbrirModal,
    tabelaAlvoModal, handleMudarCategoriaComConfirmacao, brandColor,
    handleMoverAtributoDeEscopo
  } = useCatalogState();

  const dadosArvoreAntd = useMemo(() => {
    return construirArvoreAntd(categorias);
  }, [categorias]);

  const atributosDNA = useMemo(() => {
    return grupoSelecionado ? grupoSelecionado.atributos.filter(attr => attr.classificacao === 'dna') : [];
  }, [grupoSelecionado]);

  const atributosVariacao = useMemo(() => {
    return grupoSelecionado ? grupoSelecionado.atributos.filter(attr => attr.classificacao === 'grade') : [];
  }, [grupoSelecionado]);

  const atributosFichaTecnica = useMemo(() => {
    return grupoSelecionado ? grupoSelecionado.atributos.filter(attr => attr.classificacao === 'ficha') : [];
  }, [grupoSelecionado]);

  return (
    <div className={styles.container} style={{ '--brand-color': brandColor } as React.CSSProperties}>

      {/* BARRA DE AÇÕES CRUD SUPERIOR */}
      <div className={styles.crudBar}>
        <div className={styles.titleArea}>
          <h2>Gerenciador de Catálogo de Grupos</h2>
          <span className={`${styles.statusIndicator} ${loading ? styles.statusSync : styles.statusConnected}`}>
            {loading ? '🔄 Sincronizando com o banco...' : '🟢 Banco de dados conectado'}
          </span>
        </div>
        <div className={styles.actionButtons}>
          <Button onClick={handleCriarGrupo} variant="secondary" disabled={loading}>＋ Criar Novo Grupo</Button>
          {grupoSelecionado && (
            <Button onClick={handleSalvarGrupoNoBanco} disabled={loading} className={styles.btnSave}>
              {loading ? 'Salvando...' : '💾 Salvar Alterações'}
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className={styles.errorBanner}>
          <div><strong>⚠️ Falha de Integração:</strong> {error}</div>
          <Button onClick={() => window.location.reload()} style={{ backgroundColor: '#ff4d4f', color: '#fff', padding: '4px 12px', fontSize: '12px' }}>
            :arrows_counterclockwise: Recarregar Tela
          </Button>
        </div>
      )}

      <div className={styles.workspace}>
        <SidebarFamilias
          familias={grupos}
          familiaSelecionadaId={grupoSelecionado?.id || null}
          onSelecionarFamilia={handleSelecionarGrupo}
          onDeletarFamilia={() => { }}
        />

        <main className={styles.contentArea}>
          {grupoSelecionado ? (
            <>
              {/* CONFIGURAÇÕES BÁSICAS */}
              <section className={styles.card} style={{ borderTop: `3px solid var(--brand-color)` }}>
                <div className={styles.cardHeader}>
                  <span className={styles.cardTitle}>📌 Configurações Estruturais do Grupo</span>
                  <span className={styles.cardSubtitle}>Grupo ID: #{grupoSelecionado.id}</span>
                </div>

                <div className={styles.formLayout}>
                  <div className={styles.inputsGrid}>
                    
                    {/* Antd Input - Nome */}
                    <div className={styles.inputWrapper}>
                      <label>Nome Padrão do Grupo</label>
                      <Input
                        size="large"
                        value={grupoSelecionado.nome}
                        onChange={e => handleAtualizarGrupoDireto('nome', e.target.value)}
                        placeholder="Ex: Parafusos Sextavados"
                      />
                    </div>

                    {/* Antd Select - UoM */}
                    <div className={styles.inputWrapper}>
                      <label>Unidade de Medida Padrão (UoM)</label>
                      <Select
                        size="large"
                        style={{ width: '100%' }}
                        value={grupoSelecionado.unidadeMedidaBase || 'PC'}
                        onChange={valor => handleAtualizarGrupoDireto('unidadeMedidaBase', valor)}
                        options={[
                          { value: 'PC', label: 'PC - Peça' },
                          { value: 'UN', label: 'UN - Unidade' },
                          { value: 'MM', label: 'MM - Milímetro' },
                          { value: 'MT', label: 'MT - Metro' },
                        ]}
                      />
                    </div>

                    {/* Antd Select - Tipo Item */}
                    <div className={styles.inputWrapper}>
                      <label>Tipo de Item (Inventário)</label>
                      <Select
                        size="large"
                        style={{ width: '100%' }}
                        value={grupoSelecionado.tipoItem || 'PA'}
                        onChange={valor => handleAtualizarGrupoDireto('tipoItem', valor)}
                        options={[
                          { value: 'PA', label: 'Produto Acabado' },
                          { value: 'MP', label: 'Matéria-Prima' },
                          { value: 'KT', label: 'Kit / Combo' },
                        ]}
                      />
                    </div>

                    {/* Antd TreeSelect - Categoria Global */}
                    <div className={styles.inputWrapper}>
                      <label>Categoria Global</label>
                      <TreeSelect
                        size="large"
                        style={{ width: '100%' }}
                        value={grupoSelecionado?.categoriaPai ? String(grupoSelecionado.categoriaPai) : undefined}
                        onChange={(valor) => handleMudarCategoriaComConfirmacao(valor)}
                        treeData={dadosArvoreAntd}
                        dropdownStyle={{ maxHeight: 400, overflow: 'auto' }}
                        placeholder="-- Selecione uma Categoria --"
                        showSearch
                        treeNodeFilterProp="title"
                        allowClear
                      />
                    </div>
                  </div>

                  {/* MEDIA BLOC */}
                  <div className={styles.mediaPanel}>
                    <ImageDisplay size='80px' src={grupoImage || undefined} />
                    <Input
                      placeholder='URL da imagem...'
                      value={grupoImage}
                      onChange={handleInputChange}
                    />
                  </div>
                </div>
              </section>

              {/* PAINEL SIMULADOR */}
              <PainelSimulador
                grupoSelecionado={grupoSelecionado}
                valoresTeste={valoresTeste}
                previewNomeSimulado={previewNomeSimulado}
                previewSkuSimulado={previewSkuSimulado}
                brandColor={brandColor}
                onMudancaValorTeste={(id, valor) => {
                  setValoresTeste(prev => {
                    const novoEstado = { ...prev };
                    if (valor === '') delete novoEstado[id];
                    else novoEstado[id] = valor;
                    return novoEstado;
                  });
                }}
                onAtualizarTemplateComercial={(valor) => handleAtualizarGrupoDireto('templateNomeComercial', valor)}
                onAtualizarTemplateSku={(valor) => handleAtualizarGrupoDireto('templateSku', valor)}
                onAtualizarSiglaSku={(valor) => handleAtualizarGrupoDireto('siglaSku', valor)}
                onAtualizarSeparadorSku={(valor) => handleAtualizarGrupoDireto('separadorSku', valor)}
                onAtualizarOrdemSku={(atributoId, novaOrdem) => handleAtualizarAtributoDireto(atributoId, 'ordemSku', novaOrdem)}
              />

              {/* MATRIZ DE ATRIBUTOS */}
              <div className={styles.attributesMatrixThreeColumns}>
                
                {/* COLUNA 1: DNA */}
                <div className={styles.cardMatrixColumn} style={{ borderTop: '3px solid #1d39c4' }}>
                  <TabelaAtributos
                    titulo="🧬 Atributos de DNA"
                    tipo="dna"
                    mostrarExpansao={true}
                    atributoPendenteEdicao={atributoPendenteEdicao}
                    onAtualizarAtributo={handleAtualizarAtributoDireto}
                    onMoverEscopo={handleMoverAtributoDeEscopo}
                    onAbrirModal={handleAbrirModal}
                    atributos={atributosDNA}
                  />
                </div>

                {/* COLUNA 2: GRADE */}
                <div className={styles.cardMatrixColumn} style={{ borderTop: '3px solid #389e0d' }}>
                  <TabelaAtributos
                    titulo="🏁 Grade de Variações"
                    tipo="grade"
                    mostrarExpansao={true}
                    atributoPendenteEdicao={atributoPendenteEdicao}
                    onAtualizarAtributo={handleAtualizarAtributoDireto}
                    onMoverEscopo={handleMoverAtributoDeEscopo}
                    onAbrirModal={handleAbrirModal}
                    atributos={atributosVariacao}
                  />
                </div>

                {/* COLUNA 3: FICHA TÉCNICA */}
                <div className={styles.cardMatrixColumn} style={{ borderTop: '3px solid #d46b08' }}>
                  <TabelaAtributos
                    titulo="📋 Ficha Técnica comercial"
                    tipo="ficha"
                    mostrarExpansao={false}
                    atributoPendenteEdicao={atributoPendenteEdicao}
                    onAtualizarAtributo={handleAtualizarAtributoDireto}
                    onMoverEscopo={handleMoverAtributoDeEscopo}
                    onAbrirModal={handleAbrirModal}
                    atributos={atributosFichaTecnica}
                  />
                </div>

              </div>
            </>
          ) : (
            <div className={`${styles.card} ${styles.emptyState}`}>
              Nenhuma família selecionada ou cadastrada.
            </div>
          )}
        </main>
      </div>

      <ModalVinculoAtributos
        isModalAberto={isModalAberto}
        setIsModalAberto={setIsModalAberto}
        destinoModal={tabelaAlvoModal || 'ficha'}
        atributosGlobaisDisponiveis={atributosGlobaisDisponiveis}
        handleAdicionarAtributoAoGrupo={handleAdicionarAtributoAoGrupo}
        brandColor={brandColor}
      />
    </div>
  );
};