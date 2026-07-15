import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { TreeSelect, Select, Input, Row, Col, Card, Typography, Space, Button, Alert, Tooltip, Table, Tag, Empty, Badge } from 'antd';
import { EditOutlined, ArrowRightOutlined, PlusOutlined, SearchOutlined, ShoppingCartOutlined, ThunderboltOutlined, FolderOpenOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';

import { Grupo, AtributoConfig, Categoria, AtributoPendente, ModalDestino } from './CatalogManager.types';
import { gerarPreviewSku, gerarPreviewNome } from './CatalogManager.helpers';
import { PainelSimulador } from './components/PainelSimulador';
import ImageDisplay from '../../../../components/ui/ImageGallery/ImageDysplay';

// Importações dos métodos da API oficiais corrigidos
import { getGroups, createGroup, updateGroup, getCategorias, getAtributosDaCategoria } from './FamilyManager.api';
import { ModalVinculoAtributos } from './components/ModalVinculoAtributos';
import Swal from 'sweetalert2';

const { Title, Text } = Typography;

type CategoriaTreeNode = {
  value: string;
  title: string;
  children?: CategoriaTreeNode[];
};

// 🌳 Versão blindada contra tipos numéricos/strings do banco
const construirArvoreAntd = (lista: Categoria[], paiId: string | null = null): CategoriaTreeNode[] => {
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

type AtributoHerdado = Partial<AtributoConfig> & {
  obrigatorio?: boolean;
  compoeSku?: boolean;
  separadorSufixo?: string;
  sufixo?: string;
  exemplos?: string;
};

interface ItemAssociado {
  id: string;
  sku: string;
  nome: string;
  ativo: boolean;
}

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
  const [atributosGlobaisDisponiveis] = useState<AtributoConfig[]>([]);

  // Estados de pesquisa para as colunas laterais
  const [pesquisaFamilia, setPesquisaFamilia] = useState('');
  const [pesquisaItem, setPesquisaItem] = useState('');

  // Mock ou estado de itens vinculados para a terceira coluna
  const [itensMockados, setItensMockados] = useState<Record<string, ItemAssociado[]>>({
    "1": [
      { id: '101', sku: 'PAR-SEX-M8-45', nome: 'Parafuso Sextavado M8 x 45mm', ativo: true },
      { id: '102', sku: 'PAR-SEX-M8-50', nome: 'Parafuso Sextavado M8 x 50mm', ativo: true },
      { id: '103', sku: 'PAR-SEX-M10-60', nome: 'Parafuso Sextavado M10 x 60mm', ativo: false },
    ]
  });

  const grupoSelecionado = useMemo(() => {
    return grupos.find(g => g.id === grupoSelecionadoId) || null;
  }, [grupos, grupoSelecionadoId]);

  const brandColor = grupoSelecionado?.cor || '#1677ff';

  const handleAtualizarGrupoDireto = <K extends keyof Grupo>(campo: K, valor: Grupo[K]) => {
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
      confirmButtonColor: brandColor,
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

  const handleAtualizarAtributoDireto = async <K extends keyof AtributoConfig>(atributoId: string, campo: K, valor: AtributoConfig[K]) => {
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
  const [tabelaAlvoModal, setTabelaAlvoModal] = useState<ModalDestino | null>(null);

  const handleAbrirModal = (tipo: ModalDestino) => {
    setTabelaAlvoModal(tipo);
    setIsModalAberto(true);
  };

  const carregarDados = useCallback(async () => {
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
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("Erro ao buscar dados iniciais:", err);
      setError(message || 'Falha na conexão com o servidor de estoque.');
    } finally {
      setLoading(false);
    }
  }, [grupoSelecionadoId]);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

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
        const atributosHerdados = await getAtributosDaCategoria(novaCategoriaId, 1) as AtributoHerdado[];

        const novosAtributosObrigatorios: AtributoConfig[] = atributosHerdados
          .filter(attr => Boolean(attr.obrigatorio))
          .map(attr => {
            const item = attr;
            return {
              id: String(item.id || ''),
              nome: item.nome || 'Atributo',
              tipoDado: item.tipoDado || 'texto',
              classificacao: item.compoeSku ? 'dna' : 'ficha',
              separadorSufixo: item.separadorSufixo || 'nenhum',
              sufixo: item.sufixo || '',
              obrigatorio: true,
              geraVariacao: Boolean(item.geraVariacao),
              compoeSku: Boolean(item.compoeSku),
              ordemSku: 0,
              exemplos: item.exemplos || '',
              valorHerdadoDoGrupo: false
            };
          });

        setGrupos(prev => prev.map(g => {
          if (String(g.id) !== String(grupoSelecionadoId)) return g;

          const atributosAtuaisFiltrados = g.atributos.filter(attr => !attr.valorHerdadoDoGrupo);

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

      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error("Erro ao herdar atributos da categoria:", err);
        Swal.fire('Erro', message || 'Não foi possível buscar os atributos desta categoria.', 'error');
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
      Swal.fire('Aviso', 'Este atributo já está associado a este grupo.', 'warning');
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
        cor: '#1677ff',
        imagem: '',
        atributos: []
      };

      const res = await createGroup(payloadVazio, 1);
      if (res.success && res.id) {
        await carregarDados();
        setGrupoSelecionadoId(res.id);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      Swal.fire('Erro', `Erro ao criar grupo: ${message}`, 'error');
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
      Swal.fire('Sucesso', `Estrutura relacional do grupo "${grupoSelecionado.nome}" salva com sucesso!`, 'success');

      await carregarDados();

      setGrupos(prev => prev.map(g =>
        g.id === grupoSelecionado.id && !g.categoriaPaiNome
          ? { ...g, categoriaPaiNome: nomeAtualNaTela }
          : g
      ));

    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("Erro ao salvar grupo:", err);
      Swal.fire('Erro', `Erro ao salvar alterações: ${message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Filtragem das Famílias Ativas na Sidebar esquerda
  const familiasFiltradas = useMemo(() => {
    if (!pesquisaFamilia) return grupos;
    return grupos.filter(g => 
      g.nome.toLowerCase().includes(pesquisaFamilia.toLowerCase()) ||
      (g.categoriaPaiNome && g.categoriaPaiNome.toLowerCase().includes(pesquisaFamilia.toLowerCase()))
    );
  }, [grupos, pesquisaFamilia]);

  // Listar itens associados dinamicamente baseado na família
  const itensDoGrupoAtivo = useMemo(() => {
    if (!grupoSelecionado) return [];
    const lista = itensMockados[grupoSelecionado.id] || [];
    if (!pesquisaItem) return lista;
    return lista.filter(item => 
      item.sku.toLowerCase().includes(pesquisaItem.toLowerCase()) || 
      item.nome.toLowerCase().includes(pesquisaItem.toLowerCase())
    );
  }, [itensMockados, grupoSelecionado, pesquisaItem]);

  return {
    grupos, categorias, grupoSelecionado, valoresTeste, setValoresTeste, isModalAberto, abaAtiva,
    previewSkuSimulado, previewNomeSimulado, grupoImage, isSimuladorAberto, loading, error,
    atributosGlobaisDisponiveis, carregarDados, setIsSimuladorAberto, setIsModalAberto, setAbaAtiva,
    handleSelecionarGrupo, handleAtualizarGrupoDireto, handleAtualizarAtributoDireto,
    handleAdicionarAtributoAoGrupo, handleInputChange, handleCriarGrupo, handleSalvarGrupoNoBanco,
    handleAbrirModal, tabelaAlvoModal, atributoPendenteEdicao, handleMudarCategoriaComConfirmacao, brandColor,
    handleMoverAtributoDeEscopo, itensDoGrupoAtivo, pesquisaItem, setPesquisaItem, familiasFiltradas,
    pesquisaFamilia, setPesquisaFamilia
  };
};

export const FamilyManager: React.FC = () => {
  const {
    grupoSelecionado, categorias, valoresTeste, previewSkuSimulado,
    previewNomeSimulado, grupoImage, loading, error, isModalAberto, atributosGlobaisDisponiveis,
    setValoresTeste, setIsModalAberto, handleSelecionarGrupo, handleAtualizarGrupoDireto,
    handleAtualizarAtributoDireto, handleAdicionarAtributoAoGrupo,
    handleInputChange, handleCriarGrupo, handleSalvarGrupoNoBanco, handleAbrirModal,
    tabelaAlvoModal, handleMudarCategoriaComConfirmacao, brandColor,
    handleMoverAtributoDeEscopo, itensDoGrupoAtivo, pesquisaItem, setPesquisaItem,
    familiasFiltradas, pesquisaFamilia, setPesquisaFamilia
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
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', padding: '24px 32px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif' }}>
      
      {/* Header unificado estilo SaaS */}
      <Card bordered={false} style={{ marginBottom: 24, borderRadius: 12, boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)' }}>
        <Row align="middle" justify="space-between" gutter={[16, 16]}>
          <Col>
            <Space direction="vertical" size={2}>
              <Title level={3} style={{ margin: 0, fontWeight: 700, letterSpacing: '-0.02em' }}>Parâmetros de Catálogo</Title>
              <Space size={8}>
                <Badge status={loading ? "processing" : "success"} />
                <Text type="secondary" style={{ fontSize: '13px' }}>
                  {loading ? 'Sincronizando com o banco...' : 'Banco de dados sincronizado e pronto'}
                </Text>
              </Space>
            </Space>
          </Col>

          <Col>
            <Space size={12}>
              <Button type="default" size="large" onClick={handleCriarGrupo} loading={loading} icon={<PlusOutlined />} style={{ borderRadius: 8, fontWeight: 500 }}>
                Nova Família
              </Button>
              {grupoSelecionado && (
                <Button type="primary" size="large" onClick={handleSalvarGrupoNoBanco} loading={loading} style={{ backgroundColor: brandColor, borderColor: brandColor, borderRadius: 8, fontWeight: 500 }}>
                  Salvar Alterações
                </Button>
              )}
            </Space>
          </Col>
        </Row>
      </Card>

      {error && (
        <Alert
          type="error"
          showIcon
          message="Falha de Sincronização"
          description={error}
          style={{ marginBottom: 24, borderRadius: 8 }}
          action={
            <Button size="small" danger onClick={() => window.location.reload()}>
              Recarregar
            </Button>
          }
        />
      )}

      <Row gutter={[24, 24]}>
        {/* Coluna 1: Famílias Ativas (Idêntica estruturalmente à Coluna de Itens) */}
        <Col xs={24} md={6} lg={5}>
          <Card 
            title={
              <Space size={8}>
                <FolderOpenOutlined style={{ color: brandColor }} />
                <span style={{ fontWeight: 700, fontSize: '14px' }}>Famílias Ativas</span>
              </Space>
            }
            style={{ borderRadius: 12, boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)' }}
            headStyle={{ borderBottom: '1px solid #f1f5f9' }}
            bodyStyle={{ padding: '16px' }}
          >
            <Space direction="vertical" size={16} style={{ width: '100%' }}>
              <Input
                prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
                placeholder="Filtrar famílias..."
                value={pesquisaFamilia}
                onChange={e => setPesquisaFamilia(e.target.value)}
                allowClear
                style={{ borderRadius: 6 }}
              />

              <div style={{ maxHeight: '420px', overflowY: 'auto', paddingRight: '4px' }}>
                {familiasFiltradas.length > 0 ? (
                  <Space direction="vertical" size={12} style={{ width: '100%' }}>
                    {familiasFiltradas.map(fam => {
                      const estaSelecionado = fam.id === grupoSelecionado?.id;
                      return (
                        <div 
                          key={fam.id} 
                          onClick={() => handleSelecionarGrupo(fam.id)}
                          style={{ 
                            padding: '12px', 
                            backgroundColor: estaSelecionado ? '#f0f7ff' : '#f8fafc', 
                            borderRadius: '8px', 
                            border: estaSelecionado ? `1px solid ${brandColor}` : '1px solid #e2e8f0',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                            <span style={{ fontWeight: 700, fontSize: '13px', color: estaSelecionado ? brandColor : '#0f172a' }}>
                              {fam.nome}
                            </span>
                            <Badge 
                              count={fam.atributos?.length || 0} 
                              showZero 
                              style={{ 
                                backgroundColor: estaSelecionado ? brandColor : '#94a3b8',
                                fontSize: '10px' 
                              }} 
                            />
                          </div>
                          {fam.categoriaPaiNome && (
                            <div style={{ fontSize: '11px', color: '#64748b' }}>
                              {fam.categoriaPaiNome}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </Space>
                ) : (
                  <Empty 
                    image={Empty.PRESENTED_IMAGE_SIMPLE} 
                    description={<span style={{ fontSize: '12px', color: '#94a3b8' }}>Nenhuma família encontrada</span>} 
                  />
                )}
              </div>

              <Button 
                type="dashed" 
                block 
                icon={<PlusOutlined />} 
                style={{ borderColor: brandColor, color: brandColor, borderRadius: 8 }}
                onClick={handleCriarGrupo}
              >
                Nova Família
              </Button>
            </Space>
          </Card>
        </Col>

        {/* Coluna 2: Configuração Central */}
        <Col xs={24} md={18} lg={14}>
          {grupoSelecionado ? (
            <Space direction="vertical" size={24} style={{ width: '100%' }}>
              
              {/* Configurações Estruturais */}
              <Card
                title="Configurações de Identidade"
                headStyle={{ borderBottom: '1px solid #f1f5f9', fontWeight: 600, fontSize: '15px' }}
                bodyStyle={{ padding: 24 }}
                style={{ borderRadius: 12, borderTop: `4px solid ${brandColor}`, boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)' }}
              >
                <Row gutter={[24, 24]}>
                  <Col xs={24} xl={16}>
                    <Row gutter={[16, 16]}>
                      <Col xs={24} sm={12}>
                        <Space direction="vertical" size={6} style={{ width: '100%' }}>
                          <Text strong style={{ color: '#475569', fontSize: '13px' }}>Nome da Família</Text>
                          <Input
                            size="large"
                            style={{ borderRadius: 6 }}
                            value={grupoSelecionado.nome}
                            onChange={e => handleAtualizarGrupoDireto('nome', e.target.value)}
                            placeholder="Ex: Parafusos Sextavados"
                          />
                        </Space>
                      </Col>

                      <Col xs={24} sm={12}>
                        <Space direction="vertical" size={6} style={{ width: '100%' }}>
                          <Text strong style={{ color: '#475569', fontSize: '13px' }}>Tipo de Inventário (SPED)</Text>
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
                        </Space>
                      </Col>

                      <Col xs={24} sm={12}>
                        <Space direction="vertical" size={6} style={{ width: '100%' }}>
                          <Text strong style={{ color: '#475569', fontSize: '13px' }}>Unidade de Medida</Text>
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
                        </Space>
                      </Col>

                      <Col xs={24} sm={12}>
                        <Space direction="vertical" size={6} style={{ width: '100%' }}>
                          <Text strong style={{ color: '#475569', fontSize: '13px' }}>Categoria de Vínculo</Text>
                          <TreeSelect
                            size="large"
                            style={{ width: '100%' }}
                            value={grupoSelecionado?.categoriaPai ? String(grupoSelecionado.categoriaPai) : undefined}
                            onChange={handleMudarCategoriaComConfirmacao}
                            treeData={dadosArvoreAntd}
                            dropdownStyle={{ maxHeight: 300, overflow: 'auto' }}
                            placeholder="Vincular à árvore global..."
                            showSearch
                            treeNodeFilterProp="title"
                            allowClear
                          />
                        </Space>
                      </Col>
                    </Row>
                  </Col>

                  {/* Upload/Imagem */}
                  <Col xs={24} xl={8}>
                    <Card type="inner" bodyStyle={{ padding: 16 }} style={{ borderRadius: 8, backgroundColor: '#f8fafc', border: '1px dashed #cbd5e1' }}>
                      <Space direction="vertical" size={12} style={{ width: '100%' }}>
                        <Text strong style={{ color: '#475569', fontSize: '13px' }}>Imagem de Capa</Text>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
                          <ImageDisplay size="80px" src={grupoImage || undefined} style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid #e2e8f0' }} />
                          <Input
                            placeholder="URL absoluta do ícone/imagem"
                            value={grupoImage}
                            onChange={handleInputChange}
                            style={{ borderRadius: 6 }}
                          />
                        </div>
                      </Space>
                    </Card>
                  </Col>
                </Row>
              </Card>

              {/* Painel do Simulador de SKU */}
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
                onAtualizarTemplateComercial={valor => handleAtualizarGrupoDireto('templateNomeComercial', valor)}
                onAtualizarTemplateSku={valor => handleAtualizarGrupoDireto('templateSku', valor)}
                onAtualizarSiglaSku={valor => handleAtualizarGrupoDireto('siglaSku', valor)}
                onAtualizarSeparadorSku={valor => handleAtualizarGrupoDireto('separadorSku', valor)}
                onAtualizarOrdemSku={(atributoId, novaOrdem) => handleAtualizarAtributoDireto(atributoId, 'ordemSku', novaOrdem)}
              />

              {/* Grid de Atributos e Especificações */}
              <Row gutter={[16, 16]}>
                {[
                  { title: 'Atributos de DNA', tipo: 'dna', exp: true, dados: atributosDNA },
                  { title: 'Grade de Variações', tipo: 'grade', exp: true, dados: atributosVariacao },
                  { title: 'Ficha Técnica Comercial', tipo: 'ficha', exp: false, dados: atributosFichaTecnica }
                ].map((tab) => {
                  
                  const columns: ColumnsType<AtributoConfig> = [
                    {
                      title: 'Nome',
                      dataIndex: 'nome',
                      key: 'nome',
                      ellipsis: true,
                      render: (text) => <span style={{ fontWeight: 600, color: '#1e293b' }}>{text}</span>,
                    },
                    {
                      title: 'Tipo',
                      dataIndex: 'tipoDado',
                      key: 'tipoDado',
                      width: 90,
                      render: (tipo) => <Tag color="blue" style={{ fontSize: '10px', borderRadius: 4 }}>{String(tipo).toUpperCase() || 'TEXTO'}</Tag>,
                    },
                    {
                      title: 'Ações',
                      key: 'acoes',
                      width: 80,
                      align: 'right',
                      render: (_, record) => (
                        <Space size={2}>
                          <Tooltip title="Configurações">
                            <Button 
                              type="text" 
                              size="small" 
                              icon={<EditOutlined style={{ color: '#475569' }} />} 
                              onClick={() => handleAbrirModal(tab.tipo as ModalDestino)}
                            />
                          </Tooltip>

                          {tab.exp && (
                            <Tooltip title="Inverter escopo">
                              <Button 
                                type="text" 
                                size="small" 
                                icon={<ArrowRightOutlined style={{ color: brandColor }} />} 
                                onClick={() => handleMoverAtributoDeEscopo(record.id, tab.tipo === 'dna' ? 'grade' : 'dna')}
                              />
                            </Tooltip>
                          )}
                        </Space>
                      ),
                    },
                  ];

                  return (
                    <Col xs={24} xl={8} key={tab.tipo}>
                      <Card 
                        title={<span style={{ fontSize: '14px', fontWeight: 600 }}>{tab.title}</span>} 
                        headStyle={{ borderBottom: '1px solid #f1f5f9', minHeight: '48px' }} 
                        bodyStyle={{ padding: 0 }}
                        style={{ borderRadius: 10, overflow: 'hidden', boxShadow: '0 1px 2px 0 rgba(0,0,0,0.05)' }}
                        extra={
                          <Tooltip title={`Vincular Atributo`}>
                            <Button
                              type="link"
                              size="small"
                              icon={<PlusOutlined />}
                              style={{ color: brandColor, display: 'flex', alignItems: 'center' }}
                              onClick={() => handleAbrirModal(tab.tipo as ModalDestino)}
                            />
                          </Tooltip>
                        }
                      >
                        <Table
                          size="small"
                          dataSource={tab.dados}
                          columns={columns}
                          rowKey="id"
                          pagination={false}
                          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={<span style={{ fontSize: '12px', color: '#94a3b8' }}>Vazio</span>} /> }}
                          style={{ minHeight: 180 }}
                        />
                      </Card>
                    </Col>
                  );
                })}
              </Row>
            </Space>
          ) : (
            <Card style={{ borderRadius: 12, textAlign: 'center', padding: '40px 0' }}>
              <Empty description="Selecione ou crie uma família na barra lateral para começar a configurar." />
            </Card>
          )}
        </Col>

        {/* Coluna 3: Gerenciamento Ativo de SKUs Vinculados */}
        <Col xs={24} md={24} lg={5}>
          <Card 
            title={
              <Space size={8}>
                <ShoppingCartOutlined style={{ color: brandColor }} />
                <span style={{ fontWeight: 700, fontSize: '14px' }}>Itens da Família</span>
              </Space>
            }
            style={{ borderRadius: 12, boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)' }}
            headStyle={{ borderBottom: '1px solid #f1f5f9' }}
            bodyStyle={{ padding: '16px' }}
          >
            {grupoSelecionado ? (
              <Space direction="vertical" size={16} style={{ width: '100%' }}>
                <Input
                  prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
                  placeholder="Filtrar SKU ou nome..."
                  value={pesquisaItem}
                  onChange={e => setPesquisaItem(e.target.value)}
                  allowClear
                  style={{ borderRadius: 6 }}
                />

                <div style={{ maxHeight: '420px', overflowY: 'auto', paddingRight: '4px' }}>
                  {itensDoGrupoAtivo.length > 0 ? (
                    <Space direction="vertical" size={12} style={{ width: '100%' }}>
                      {itensDoGrupoAtivo.map(item => (
                        <div 
                          key={item.id} 
                          style={{ 
                            padding: '12px', 
                            backgroundColor: '#f8fafc', 
                            borderRadius: '8px', 
                            border: '1px solid #e2e8f0',
                            transition: 'all 0.2s'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                            <span style={{ fontWeight: 700, fontSize: '12px', color: '#0f172a', fontFamily: 'monospace' }}>
                              {item.sku}
                            </span>
                            <Tag color={item.ativo ? 'success' : 'default'} style={{ fontSize: '9px', borderRadius: '4px', margin: 0 }}>
                              {item.ativo ? 'Ativo' : 'Inativo'}
                            </Tag>
                          </div>
                          <div style={{ fontSize: '12px', color: '#64748b', lineHeight: '1.4' }}>
                            {item.nome}
                          </div>
                        </div>
                      ))}
                    </Space>
                  ) : (
                    <Empty 
                      image={Empty.PRESENTED_IMAGE_SIMPLE} 
                      description={<span style={{ fontSize: '12px', color: '#94a3b8' }}>Nenhum SKU encontrado</span>} 
                    />
                  )}
                </div>

                <Button 
                  type="dashed" 
                  block 
                  icon={<ThunderboltOutlined />} 
                  style={{ borderColor: brandColor, color: brandColor, borderRadius: 8 }}
                  onClick={() => Swal.fire('Novo Item', 'Geração de novos SKUs com base nos atributos do DNA e Grade.', 'info')}
                >
                  Gerar Variação SKU
                </Button>
              </Space>
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Sem família ativa" />
            )}
          </Card>
        </Col>
      </Row>

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