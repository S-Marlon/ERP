import React, { useState, useMemo, useEffect, useCallback } from "react";
import {
  TreeSelect,
  Select,
  Input,
  Row,
  Col,
  Card,
  Typography,
  Space,
  Button,
  Alert,
  Tooltip,
  Table,
  Tag,
  Empty,
  Badge,
} from "antd";
import {
  EditOutlined,
  ArrowRightOutlined,
  PlusOutlined,
  FolderOpenOutlined,
  ShoppingCartOutlined,
  SearchOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import Swal from "sweetalert2";

// Importações dos tipos desacoplados
import { Grupo, AtributoConfig, Categoria } from "./CatalogManager.types";
import {
  AtributoPendente,
  ModalDestino,
  ItemAssociado,
} from "./CatalogManager.types";

// Importações dos helpers
import {
  gerarPreviewSku,
  gerarPreviewNome,
  construirArvoreAntd,
  CAMPOS_NAO_INTEGRADOS,
} from "./CatalogManager.helpers";

// Componentes externos
import { PainelSimulador } from "./components/PainelSimulador";
import ImageDisplay from "../../../../components/ui/ImageGallery/ImageDysplay";
import { ModalVinculoAtributos } from "./components/ModalVinculoAtributos";

// Métodos da API reais
import {
  getGroups,
  createGroup,
  updateGroup,
  getCategorias,
  getAtributosDaCategoria,
  getItensDoGrupo,
} from "./FamilyManager.api";

const { Title, Text } = Typography;

const useCatalogState = () => {
  // Inicializando estados vazios (Sem Mock Data)
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [itensDoGrupo, setItensDoGrupo] = useState<ItemAssociado[]>([]);

  const [loading, setLoading] = useState<boolean>(false);
  const [loadingItens, setLoadingItens] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [grupoSelecionadoId, setGrupoSelecionadoId] = useState<string | null>(
    null,
  );
  const [valoresTeste, setValoresTeste] = useState<Record<string, string>>({});
  const [grupoImage, setGrupoImage] = useState<string>("");
  const [abaAtiva, setAbaAtiva] = useState<"variantes" | "informativos">(
    "variantes",
  );
  const [isSimuladorAberto, setIsSimuladorAberto] = useState(false);
  const [atributoPendenteEdicao, setAtributoPendenteEdicao] =
    useState<AtributoPendente | null>(null);

  // Filtros de pesquisa
  const [categoriaFiltroId, setCategoriaFiltroId] = useState<string | "TODAS">(
    "TODAS",
  );
  const [pesquisaFamilia, setPesquisaFamilia] = useState("");
  const [pesquisaItem, setPesquisaItem] = useState("");

  const [isModalAberto, setIsModalAberto] = useState(false);
  const [tabelaAlvoModal, setTabelaAlvoModal] = useState<ModalDestino | null>(
    null,
  );

  const grupoSelecionado = useMemo(() => {
    return grupos.find((g) => g.id === grupoSelecionadoId) || null;
  }, [grupos, grupoSelecionadoId]);

  const brandColor = grupoSelecionado?.cor || "#1677ff";

  // --- CARREGAMENTO DE DADOS DO BACKEND ---

  // 1. Carga inicial: Grupos e Categorias
  const carregarDadosIniciais = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [dadosGrupos, dadosCategorias] = await Promise.all([
        getGroups(1),
        getCategorias(1),
      ]);

      setGrupos(dadosGrupos);
      setCategorias(dadosCategorias);

      if (dadosGrupos.length > 0 && !grupoSelecionadoId) {
        setGrupoSelecionadoId(dadosGrupos[0].id);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("Erro ao buscar dados do backend:", err);
      setError(message || "Falha na conexão com o servidor de estoque.");
    } finally {
      setLoading(false);
    }
  }, [grupoSelecionadoId]);

  useEffect(() => {
    carregarDadosIniciais();
  }, [carregarDadosIniciais]);

  // 2. Carga sob demanda: Itens/Produtos da família selecionada
  const carregarItensDoGrupo = useCallback(async (grupoId: string) => {
    setLoadingItens(true);
    try {
      const itens = await getItensDoGrupo(grupoId, 1);
      setItensDoGrupo(itens);
    } catch (err) {
      console.error("Erro ao carregar itens da família:", err);
      setItensDoGrupo([]);
    } finally {
      setLoadingItens(false);
    }
  }, []);

  useEffect(() => {
    if (grupoSelecionadoId) {
      carregarItensDoGrupo(grupoSelecionadoId);
    } else {
      setItensDoGrupo([]);
    }
  }, [grupoSelecionadoId, carregarItensDoGrupo]);

  useEffect(() => {
    if (grupoSelecionado) {
      setGrupoImage(grupoSelecionado.imagem || "");
    }
  }, [grupoSelecionado]);

  // --- HANDLERS E REGRAS DE NEGÓCIO ---

  const handleAtualizarGrupoDireto = <K extends keyof Grupo>(
    campo: K,
    valor: Grupo[K],
  ) => {
    setGrupos((prev) =>
      prev.map((g) =>
        g.id === grupoSelecionadoId ? { ...g, [campo]: valor } : g,
      ),
    );
  };

  const handleMoverAtributoDeEscopo = async (
    atributoId: string,
    novoEscopo: "dna" | "grade" | "ficha",
  ) => {
    if (!grupoSelecionado) return;

    const atributoAtual = grupoSelecionado.atributos.find(
      (attr) => String(attr.id) === String(atributoId),
    );
    if (!atributoAtual) return;

    const nomesEscopo = {
      dna: "DNA (Fixo do SKU)",
      grade: "Grade (Variador de SKU)",
      ficha: "Ficha Técnica",
    };

    const resultado = await Swal.fire({
      title: `Mover para ${nomesEscopo[novoEscopo]}?`,
      text: `Deseja alterar o comportamento do atributo "${atributoAtual.nome}"? Isso reconfigurará as regras de geração de SKU.`,
      icon: "info",
      showCancelButton: true,
      confirmButtonColor: brandColor,
      cancelButtonColor: "#637381",
      confirmButtonText: "Sim, mover!",
      cancelButtonText: "Cancelar",
    });

    if (resultado.isConfirmed) {
      setGrupos((prev) =>
        prev.map((g) => {
          if (String(g.id) !== String(grupoSelecionadoId)) return g;

          const atributosAtualizados = g.atributos.map((attr) => {
            if (String(attr.id) !== String(atributoId)) return attr;

            const atributoModificado = { ...attr, classificacao: novoEscopo };

            if (novoEscopo === "dna") {
              atributoModificado.compoeSku = true;
              atributoModificado.geraVariacao = false;
              atributoModificado.obrigatorio = true;
              if (atributoModificado.ordemSku === 0) {
                atributoModificado.ordemSku =
                  g.atributos.filter((a) => a.classificacao === "dna").length +
                  1;
              }
            } else if (novoEscopo === "grade") {
              atributoModificado.compoeSku = false;
              atributoModificado.geraVariacao = true;
              atributoModificado.obrigatorio = true;
              atributoModificado.ordemSku = 0;
            } else if (novoEscopo === "ficha") {
              atributoModificado.compoeSku = false;
              atributoModificado.geraVariacao = false;
              atributoModificado.obrigatorio = false;
              atributoModificado.ordemSku = 0;
            }

            return atributoModificado;
          });

          return { ...g, atributos: atributosAtualizados };
        }),
      );

      Swal.fire({
        title: "Movido!",
        text: `Atributo configurado como ${nomesEscopo[novoEscopo]}.`,
        icon: "success",
        timer: 1500,
        showConfirmButton: false,
      });
    }
  };

  const handleAtualizarAtributoDireto = async <K extends keyof AtributoConfig>(
    atributoId: string,
    campo: K,
    valor: AtributoConfig[K],
  ) => {
    if (!grupoSelecionado) return;

    const atributoAtual = grupoSelecionado.atributos.find(
      (attr) => String(attr.id) === String(atributoId),
    );
    const nomeAtributo = atributoAtual ? atributoAtual.nome : "este atributo";

    setAtributoPendenteEdicao({ atributoId, campo, valor });

    const resultado = await Swal.fire({
      title: "Confirmar alteração?",
      text: `Deseja realmente alterar o campo "${String(campo)}" do atributo "${nomeAtributo}"?`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: brandColor,
      cancelButtonColor: "#637381",
      confirmButtonText: "Sim, alterar!",
      cancelButtonText: "Cancelar",
      background: "#ffffff",
    });

    if (resultado.isConfirmed) {
      setGrupos((prev) =>
        prev.map((g) => {
          if (String(g.id) !== String(grupoSelecionadoId)) return g;

          const atributosAtualizados = g.atributos.map((attr) => {
            if (String(attr.id) !== String(atributoId)) return attr;

            const novoAtributo = { ...attr, [campo]: valor };

            if (campo === "classificacao") {
              if (valor === "dna") {
                novoAtributo.compoeSku = true;
                novoAtributo.geraVariacao = false;
              } else if (valor === "grade") {
                novoAtributo.compoeSku = false;
                novoAtributo.geraVariacao = true;
              } else if (valor === "ficha") {
                novoAtributo.compoeSku = false;
                novoAtributo.geraVariacao = false;
              }
            }

            if (campo === "compoeSku" && valor === true) {
              novoAtributo.obrigatorio = true;
              novoAtributo.classificacao = "dna";
            }

            if (campo === "geraVariacao" && valor === true) {
              novoAtributo.classificacao = "grade";
            }

            return novoAtributo;
          });

          return { ...g, atributos: atributosAtualizados };
        }),
      );

      Swal.fire({
        title: "Alterado!",
        text: "O atributo foi movido/atualizado com sucesso.",
        icon: "success",
        timer: 1500,
        showConfirmButton: false,
      });
    }

    setAtributoPendenteEdicao(null);
  };

  const handleAbrirModal = (tipo: ModalDestino) => {
    setTabelaAlvoModal(tipo);
    setIsModalAberto(true);
  };

  const handleMudarCategoriaComConfirmacao = async (
    novaCategoriaId: string | undefined,
  ) => {
    if (!grupoSelecionado) return;

    if (!novaCategoriaId) {
      const resultadoDesvincular = await Swal.fire({
        title: "Remover vínculo com a categoria?",
        text: "Ao desvincular, este grupo deixará de herdar os atributos automáticos desta árvore.",
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#d33",
        cancelButtonColor: "#637381",
        confirmButtonText: "Sim, desvincular!",
        cancelButtonText: "Cancelar",
      });

      if (resultadoDesvincular.isConfirmed) {
        handleAtualizarGrupoDireto("categoriaPai", "");
        handleAtualizarGrupoDireto("categoriaPaiNome", "");
      }
      return;
    }

    if (String(grupoSelecionado.categoriaPai) === String(novaCategoriaId))
      return;

    const categoriaAlvo = categorias.find(
      (c) => String(c.id) === String(novaCategoriaId),
    );
    const nomeCategoria = categoriaAlvo ? categoriaAlvo.nome : "esta categoria";

    const resultadoAlterar = await Swal.fire({
      title: "Vincular a esta categoria?",
      text: `Ao mudar para "${nomeCategoria}", o grupo poderá herdar e sincronizar os atributos específicos dela.`,
      icon: "question",
      showCancelButton: true,
      confirmButtonColor: brandColor,
      cancelButtonColor: "#637381",
      confirmButtonText: "Sim, vincular!",
      cancelButtonText: "Cancelar",
    });

    if (resultadoAlterar.isConfirmed) {
      try {
        setLoading(true);
        const atributosHerdados = await getAtributosDaCategoria(
          novaCategoriaId,
          1,
        );

        const novosAtributosObrigatorios: AtributoConfig[] = atributosHerdados
          .filter((attr) => Boolean(attr.obrigatorio))
          .map((attr) => ({
            id: String(attr.id || ""),
            nome: attr.nome || "Atributo",
            tipoDado: attr.tipoDado || "texto",
            classificacao: attr.compoeSku ? "dna" : "ficha",
            separadorSufixo: attr.separadorSufixo || "nenhum",
            sufixo: attr.sufixo || "",
            obrigatorio: true,
            geraVariacao: Boolean(attr.geraVariacao),
            compoeSku: Boolean(attr.compoeSku),
            ordemSku: 0,
            exemplos: attr.exemplos || "",
            valorHerdadoDoGrupo: false,
          }));

        setGrupos((prev) =>
          prev.map((g) => {
            if (String(g.id) !== String(grupoSelecionadoId)) return g;
            const atributosFiltrados = g.atributos.filter(
              (attr) => !attr.valorHerdadoDoGrupo,
            );
            return {
              ...g,
              categoriaPai: novaCategoriaId,
              categoriaPaiNome: nomeCategoria,
              atributos: [...atributosFiltrados, ...novosAtributosObrigatorios],
            };
          }),
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        Swal.fire(
          "Erro",
          message || "Não foi possível buscar os atributos desta categoria.",
          "error",
        );
      } finally {
        setLoading(false);
      }
    }
  };

  const atributosDoSku = useMemo(() => {
    if (!grupoSelecionado) return [];
    return grupoSelecionado.atributos
      .filter((attr) => attr.compoeSku && attr.ordemSku > 0)
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

  const handleAdicionarAtributoAoGrupo = (
    novoAttr: Partial<AtributoConfig>,
  ) => {
    if (!grupoSelecionado) return;

    const oAtributoJaExiste = grupoSelecionado.atributos.some(
      (a) => a.nome.toLowerCase() === novoAttr.nome?.toLowerCase(),
    );
    if (oAtributoJaExiste) {
      Swal.fire(
        "Aviso",
        "Este atributo já está associado a este grupo.",
        "warning",
      );
      return;
    }

    const compoeSku = tabelaAlvoModal === "dna";
    const geraVariacao = tabelaAlvoModal === "grade";
    const classificacao = tabelaAlvoModal || "ficha";

    const estruturaCompletaAtributo: AtributoConfig = {
      id: novoAttr.id || `temp-${Date.now()}`,
      nome: novoAttr.nome || "Novo Atributo",
      tipoDado: novoAttr.tipoDado || "texto",
      classificacao: classificacao,
      separadorSufixo: "nenhum",
      sufixo: "",
      obrigatorio: compoeSku,
      geraVariacao: geraVariacao,
      compoeSku: compoeSku,
      ordemSku: grupoSelecionado.atributos.length + 1,
      exemplos: "",
      valorHerdadoDoGrupo: false,
    };

    setGrupos((prev) =>
      prev.map((g) => {
        if (g.id !== grupoSelecionadoId) return g;
        return { ...g, atributos: [...g.atributos, estruturaCompletaAtributo] };
      }),
    );

    setIsModalAberto(false);
    setTabelaAlvoModal(null);
  };

  const handleCriarGrupo = async () => {
    setLoading(true);
    try {
      const payloadVazio = {
        nome: "Nova Família de Produtos",
        categoriaPai: "",
        categoriaPaiNome: "",
        descricao: "",
        unidadeMedidaBase: "PC",
        templateNome: "{FAMILIA}",
        separadorSku: "-",
        cor: "#1677ff",
        imagem: "",
        atributos: [],
      };

      const res = await createGroup(payloadVazio, 1);
      if (res.success && res.id) {
        await carregarDadosIniciais();
        setGrupoSelecionadoId(res.id);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      Swal.fire("Erro", `Erro ao criar grupo: ${message}`, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleSalvarGrupoNoBanco = async () => {
    if (!grupoSelecionado) return;
    setLoading(true);
    try {
      const dadosParaSalvar = { ...grupoSelecionado, imagem: grupoImage };

      await updateGroup(grupoSelecionado.id, dadosParaSalvar, 1);
      Swal.fire(
        "Sucesso",
        `Estrutura relacional da família "${grupoSelecionado.nome}" salva com sucesso!`,
        "success",
      );
      await carregarDadosIniciais();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      Swal.fire("Erro", `Erro ao salvar alterações: ${message}`, "error");
    } finally {
      setLoading(false);
    }
  };

  // --- FILTRAGENS E AGRUPAMENTOS DE INTERFACE ---

  const familiasFiltradas = useMemo(() => {
    return grupos.filter((g) => {
      if (categoriaFiltroId !== "TODAS") {
        if (categoriaFiltroId === "SEM_CAT") {
          if (g.categoriaPai && g.categoriaPai !== "") return false;
        } else {
          if (String(g.categoriaPai) !== String(categoriaFiltroId))
            return false;
        }
      }

      const termo = pesquisaFamilia.toLowerCase();
      const bateNomeGrupo = g.nome.toLowerCase().includes(termo);
      const bateNomeCategoria = g.categoriaPaiNome
        ? g.categoriaPaiNome.toLowerCase().includes(termo)
        : false;

      return bateNomeGrupo || bateNomeCategoria;
    });
  }, [grupos, categoriaFiltroId, pesquisaFamilia]);

  const familiasAgrupadas = useMemo(() => {
    return familiasFiltradas.reduce(
      (acc, fam) => {
        const categoria = fam.categoriaPaiNome || "Outras / Sem Categoria";
        if (!acc[categoria]) acc[categoria] = [];
        acc[categoria].push(fam);
        return acc;
      },
      {} as Record<string, Grupo[]>,
    );
  }, [familiasFiltradas]);

  const itensFiltradosDoGrupo = useMemo(() => {
    if (!pesquisaItem) return itensDoGrupo;
    return itensDoGrupo.filter(
      (item) =>
        item.sku.toLowerCase().includes(pesquisaItem.toLowerCase()) ||
        item.nome.toLowerCase().includes(pesquisaItem.toLowerCase()),
    );
  }, [itensDoGrupo, pesquisaItem]);

  // Lista simples de atributos globais dinâmicos para a modal
  const atributosGlobaisDisponiveis = useMemo(() => {
    const todosAtributos = grupos.flatMap((g) => g.atributos || []);
    const unicos = new Map<string, AtributoConfig>();
    todosAtributos.forEach((a) => {
      if (!unicos.has(a.id)) unicos.set(a.id, a);
    });
    return Array.from(unicos.values());
  }, [grupos]);

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
    loadingItens,
    error,
    carregarDadosIniciais,
    setIsSimuladorAberto,
    setIsModalAberto,
    setAbaAtiva,
    handleSelecionarGrupo,
    handleAtualizarGrupoDireto,
    handleAtualizarAtributoDireto,
    handleAdicionarAtributoAoGrupo,
    handleCriarGrupo,
    handleSalvarGrupoNoBanco,
    handleAbrirModal,
    tabelaAlvoModal,
    atributoPendenteEdicao,
    handleMudarCategoriaComConfirmacao,
    brandColor,
    handleMoverAtributoDeEscopo,
    itensFiltradosDoGrupo,
    pesquisaItem,
    setPesquisaItem,
    familiasFiltradas,
    pesquisaFamilia,
    setPesquisaFamilia,
    familiasAgrupadas,
    categoriaFiltroId,
    setCategoriaFiltroId,
    atributosGlobaisDisponiveis,
  };
};

export const FamilyManager: React.FC = () => {
  const {
    grupoSelecionado,
    categorias,
    valoresTeste,
    previewSkuSimulado,
    previewNomeSimulado,
    grupoImage,
    loading,
    error,
    isModalAberto,
    setValoresTeste,
    setIsModalAberto,
    handleSelecionarGrupo,
    handleAtualizarGrupoDireto,
    handleAtualizarAtributoDireto,
    handleAdicionarAtributoAoGrupo,
    handleCriarGrupo,
    handleSalvarGrupoNoBanco,
    handleAbrirModal,
    tabelaAlvoModal,
    handleMudarCategoriaComConfirmacao,
    brandColor,
    handleMoverAtributoDeEscopo,
    itensFiltradosDoGrupo,
    pesquisaItem,
    setPesquisaItem,
    familiasFiltradas,
    pesquisaFamilia,
    setPesquisaFamilia,
    familiasAgrupadas,
    categoriaFiltroId,
    setCategoriaFiltroId,
    atributosGlobaisDisponiveis,
  } = useCatalogState();

  const dadosArvoreAntd = useMemo(() => {
    return construirArvoreAntd(categorias);
  }, [categorias]);

  const atributosDNA = useMemo(() => {
    return grupoSelecionado
      ? grupoSelecionado.atributos.filter(
          (attr) => attr.classificacao === "dna",
        )
      : [];
  }, [grupoSelecionado]);

  const atributosVariacao = useMemo(() => {
    return grupoSelecionado
      ? grupoSelecionado.atributos.filter(
          (attr) => attr.classificacao === "grade",
        )
      : [];
  }, [grupoSelecionado]);

  const atributosFichaTecnica = useMemo(() => {
    return grupoSelecionado
      ? grupoSelecionado.atributos.filter(
          (attr) => attr.classificacao === "ficha",
        )
      : [];
  }, [grupoSelecionado]);

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#f8fafc",
        padding: "8px 12px",
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      }}
    >
      {/* Header unificado estilo SaaS */}
      <Card
        bordered={false}
        style={{
          marginBottom: 12,
          borderRadius: 12,
          boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.05)",
        }}
      >
        <Row align="middle" justify="space-between" gutter={[12, 12]}>
          <Col>
            <Space direction="vertical" size={2}>
              <Title
                level={3}
                style={{ margin: 0, fontWeight: 700, letterSpacing: "-0.02em" }}
              >
                Parâmetros de Catálogo
              </Title>
              <Space size={8}>
                <Badge status={loading ? "processing" : "success"} />
                <Text type="secondary" style={{ fontSize: "13px" }}>
                  {loading
                    ? "Sincronizando com o banco..."
                    : "Banco de dados sincronizado e pronto"}
                </Text>
              </Space>
            </Space>
          </Col>

          <Col>
            <Space size={12}>
              <Button
                type="default"
                size="large"
                onClick={handleCriarGrupo}
                loading={loading}
                icon={<PlusOutlined />}
                style={{ borderRadius: 8, fontWeight: 500 }}
              >
                Nova Família
              </Button>
              {grupoSelecionado && (
                <Button
                  type="primary"
                  size="large"
                  onClick={handleSalvarGrupoNoBanco}
                  loading={loading}
                  style={{
                    backgroundColor: brandColor,
                    borderColor: brandColor,
                    borderRadius: 8,
                    fontWeight: 500,
                  }}
                >
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
            <Button
              size="small"
              danger
              onClick={() => window.location.reload()}
            >
              Recarregar
            </Button>
          }
        />
      )}

      <Row gutter={[24, 24]}>
        {/* Coluna 1: Famílias Ativas */}
        <Col xs={24} md={6} lg={4}>
          <Card
            title={
              <Space size={8}>
                <FolderOpenOutlined style={{ color: brandColor }} />
                <span style={{ fontWeight: 700, fontSize: "14px" }}>
                  Famílias Ativas
                </span>
              </Space>
            }
            style={{
              borderRadius: 12,
              boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.05)",
            }}
            styles={{
              header: { borderBottom: "1px solid #f1f5f9" },
              body: { padding: "12px" },
            }}
          >
            <Space direction="vertical" size={12} style={{ width: "100%" }}>
              {/* FILTRO 1: Seleção de Categoria Dinâmica */}
              <div style={{ width: "100%" }}>
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 600,
                    color: "#64748b",
                    display: "block",
                    marginBottom: "4px",
                  }}
                >
                  Filtrar por Categoria:
                </span>
                <TreeSelect
                  style={{ width: "100%" }}
                  value={categoriaFiltroId}
                  onChange={(val) => setCategoriaFiltroId(val)}
                  treeData={[
                    { value: "TODAS", title: "📂 Todas as Categorias" },
                    ...(dadosArvoreAntd || []),
                  ]}
                  placeholder="Selecionar Categoria..."
                  treeDefaultExpandAll={false}
                  allowClear
                  showSearch
                  treeNodeFilterProp="title"
                />
              </div>

              {/* FILTRO 2: Busca por texto */}
              <Input.Search
                placeholder="Buscar família..."
                value={pesquisaFamilia}
                onChange={(e) => setPesquisaFamilia(e.target.value)}
                allowClear
                enterButton={false}
                style={{ borderRadius: 6 }}
              />

              <hr
                style={{
                  border: "none",
                  borderTop: "1px solid #f1f5f9",
                  margin: "4px 0",
                }}
              />

              {/* Lista de Famílias Resultantes */}
              <div
                style={{
                  maxHeight: "380px",
                  overflowY: "auto",
                  paddingRight: "4px",
                }}
              >
                {familiasFiltradas.length > 0 ? (
                  <Space
                    direction="vertical"
                    size={16}
                    style={{ width: "100%" }}
                  >
                    {Object.entries(familiasAgrupadas).map(
                      ([categoria, listaFamilias]) => (
                        <div key={categoria}>
                          <div
                            style={{
                              fontSize: "10px",
                              fontWeight: 700,
                              color: "#94a3b8",
                              textTransform: "uppercase",
                              marginBottom: "6px",
                              letterSpacing: "0.5px",
                            }}
                          >
                            {categoria} ({listaFamilias.length})
                          </div>

                          <Space
                            direction="vertical"
                            size={6}
                            style={{ width: "100%" }}
                          >
                            {listaFamilias.map((fam) => {
                              const estaSelecionado =
                                fam.id === grupoSelecionado?.id;
                              return (
                                <div
                                  key={fam.id}
                                  onClick={() => handleSelecionarGrupo(fam.id)}
                                  style={{
                                    padding: "10px 12px",
                                    backgroundColor: estaSelecionado
                                      ? "#f0f7ff"
                                      : "#f8fafc",
                                    borderRadius: "8px",
                                    border: estaSelecionado
                                      ? `1px solid ${brandColor}`
                                      : "1px solid #e2e8f0",
                                    cursor: "pointer",
                                    transition: "all 0.2s",
                                  }}
                                >
                                  <div
                                    style={{
                                      display: "flex",
                                      justifyContent: "space-between",
                                      alignItems: "center",
                                    }}
                                  >
                                    <span
                                      style={{
                                        fontWeight: 600,
                                        fontSize: "13px",
                                        color: estaSelecionado
                                          ? brandColor
                                          : "#0f172a",
                                        whiteSpace: "nowrap",
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        marginRight: "8px",
                                      }}
                                    >
                                      {fam.nome}
                                    </span>
                                    <Badge
                                      count={fam.atributos?.length || 0}
                                      showZero
                                      style={{
                                        backgroundColor: estaSelecionado
                                          ? brandColor
                                          : "#94a3b8",
                                        fontSize: "10px",
                                      }}
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </Space>
                        </div>
                      ),
                    )}
                  </Space>
                ) : (
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description={
                      <span style={{ fontSize: "12px" }}>
                        Nenhuma família encontrada
                      </span>
                    }
                  />
                )}
              </div>

              <Button
                type="dashed"
                block
                icon={<PlusOutlined />}
                style={{
                  borderColor: brandColor,
                  color: brandColor,
                  borderRadius: 8,
                  marginTop: "4px",
                }}
                onClick={handleCriarGrupo}
              >
                Nova Família
              </Button>
            </Space>
          </Card>
        </Col>

        {/* Coluna 2: Configuração Central */}
        <Col xs={24} md={18} lg={16}>
          {grupoSelecionado ? (
            <Space direction="vertical" size={12}>
              <Row gutter={[24, 24]}>
                <Col xs={24} xl={24}>
                  {/* Configurações Estruturais */}
                  <Card
                    title="Configurações de Identidade"
                    size="small"
                    style={{
                      borderRadius: 12,
                      borderTop: `4px solid ${brandColor || "#1677ff"}`,
                      boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.05)",
                    }}
                  >
                    <Row gutter={[4, 4]}>
                      {/* Upload / Imagem Preview */}
                      <Col xs={24} md={8} lg={1}>
                        <Space
                          direction="vertical"
                          size={8}
                          style={{
                            width: "90%",
                            alignItems: "center",
                            textAlign: "center",
                          }}
                        >
                          <ImageDisplay
                            size="50px"
                            src={grupoImage || undefined}
                            style={{
                              borderRadius: 8,
                              overflow: "hidden",
                              border: "1px solid #e2e8f0",
                              boxShadow: "0 1px 2px 0 rgba(0,0,0,0.05)",
                              background: "#fff",
                            }}
                          />
                        </Space>
                      </Col>

                      {/* Nome da Família */}
                      <Col xs={8}>
                        <Space
                          direction="vertical"
                          size={2}
                          style={{ width: "100%" }}
                        >
                          <Text
                            strong
                            style={{ color: "#475569", fontSize: "12px" }}
                          >
                            Nome da Família
                          </Text>
                          <Input
                            size="middle"
                            style={{ borderRadius: 6 }}
                            value={grupoSelecionado?.nome}
                            onChange={(e) =>
                              handleAtualizarGrupoDireto("nome", e.target.value)
                            }
                            placeholder="Ex: Parafusos Sextavados"
                          />
                        </Space>
                      </Col>

                      {/* Categoria de Vínculo */}
                      <Col xs={24} sm={8}>
                        <Space
                          direction="vertical"
                          size={2}
                          style={{ width: "100%" }}
                        >
                          <Text
                            strong
                            style={{ color: "#475569", fontSize: "12px" }}
                          >
                            Categoria de Vínculo
                          </Text>
                          <TreeSelect
                            size="middle"
                            style={{ width: "100%" }}
                            value={
                              grupoSelecionado?.categoriaPai
                                ? String(grupoSelecionado.categoriaPai)
                                : undefined
                            }
                            onChange={handleMudarCategoriaComConfirmacao}
                            treeData={dadosArvoreAntd}
                            dropdownStyle={{ maxHeight: 300, overflow: "auto" }}
                            placeholder="Vincular à árvore global..."
                            showSearch
                            treeNodeFilterProp="title"
                            allowClear
                          />
                        </Space>
                      </Col>

                      {/* Unidade de Medida */}
                      <Col xs={24} sm={3}>
                        <Space
                          direction="vertical"
                          size={2}
                          style={{ width: "100%" }}
                        >
                          <Text
                            strong
                            style={{ color: "#475569", fontSize: "12px" }}
                          >
                            Unidade de Medida
                          </Text>
                          <Select
                            size="middle"
                            style={{ width: "100%" }}
                            value={grupoSelecionado?.unidadeMedidaBase || "PC"}
                            onChange={(valor) =>
                              handleAtualizarGrupoDireto(
                                "unidadeMedidaBase",
                                valor,
                              )
                            }
                            options={[
                              { value: "PC", label: "PC - Peça" },
                              { value: "UN", label: "UN - Unidade" },
                              { value: "MM", label: "MM - Milímetro" },
                              { value: "MT", label: "MT - Metro" },
                            ]}
                          />
                        </Space>
                      </Col>

                      {/* Tipo de Inventário (SPED) */}
                      <Col xs={4}>
                        <Space
                          direction="vertical"
                          size={2}
                          style={{ width: "100%" }}
                        >
                          <Text
                            strong
                            style={{ color: "#475569", fontSize: "12px" }}
                          >
                            Tipo de Inventário (SPED)
                          </Text>
                          <Select
                            size="middle"
                            style={{ width: "100%" }}
                            value={grupoSelecionado?.tipoItem || "PA"}
                            onChange={(valor) =>
                              handleAtualizarGrupoDireto("tipoItem", valor)
                            }
                            options={[
                              { value: "PA", label: "Produto Acabado" },
                              { value: "MP", label: "Matéria-Prima" },
                              { value: "KT", label: "Kit / Combo" },
                            ]}
                          />
                        </Space>
                      </Col>

                      {/* Tipo de Inventário (SPED) */}
                      <Col xs={4}>
                        <Space
                          direction="vertical"
                          size={2}
                          style={{ width: "100%" }}
                        >
                          <Text
                            strong
                            style={{ color: "#475569", fontSize: "12px" }}
                          >
                            ncmPadrao
                          </Text>
                        </Space>
                      </Col>

                      {/* Tipo de Inventário (SPED) */}
                      <Col xs={4}>
                        <Space
                          direction="vertical"
                          size={2}
                          style={{ width: "100%" }}
                        >
                          <Text
                            strong
                            style={{ color: "#475569", fontSize: "12px" }}
                          >
                            cestPadrao
                          </Text>
                        </Space>
                      </Col>
                    </Row>
                  </Card>
                </Col>

                <Col xs={24} xl={24}>
                  {/* Painel do Simulador de SKU */}
                  <PainelSimulador
                    grupoSelecionado={grupoSelecionado}
                    valoresTeste={valoresTeste}
                    previewNomeSimulado={previewNomeSimulado}
                    previewSkuSimulado={previewSkuSimulado}
                    brandColor={brandColor}
                    onMudancaValorTeste={(id, valor) => {
                      setValoresTeste((prev) => {
                        const novoEstado = { ...prev };
                        if (valor === "") delete novoEstado[id];
                        else novoEstado[id] = valor;
                        return novoEstado;
                      });
                    }}
                    onAtualizarTemplateComercial={(valor) =>
                      handleAtualizarGrupoDireto("templateNomeComercial", valor)
                    }
                    onAtualizarTemplateSku={(valor) =>
                      handleAtualizarGrupoDireto("templateSku", valor)
                    }
                    onAtualizarSiglaSku={(valor) =>
                      handleAtualizarGrupoDireto("siglaSku", valor)
                    }
                    onAtualizarSeparadorSku={(valor) =>
                      handleAtualizarGrupoDireto("separadorSku", valor)
                    }
                    onAtualizarOrdemSku={(atributoId, novaOrdem) =>
                      handleAtualizarAtributoDireto(
                        atributoId,
                        "ordemSku",
                        novaOrdem,
                      )
                    }
                  />
                </Col>
              </Row>

              {/* Grid de Atributos e Especificações */}
              <Row gutter={[16, 16]}>
                {[
                  {
                    title: "Atributos de DNA",
                    tipo: "dna",
                    exp: true,
                    dados: atributosDNA,
                  },
                  {
                    title: "Grade de Variações",
                    tipo: "grade",
                    exp: true,
                    dados: atributosVariacao,
                  },
                  {
                    title: "Ficha Técnica Comercial",
                    tipo: "ficha",
                    exp: false,
                    dados: atributosFichaTecnica,
                  },
                ].map((tab) => {
                  const columns: ColumnsType<AtributoConfig> = [
                    {
                      title: "Nome",
                      dataIndex: "nome",
                      key: "nome",
                      ellipsis: true,
                      render: (text) => (
                        <span style={{ fontWeight: 600, color: "#1e293b" }}>
                          {text}
                        </span>
                      ),
                    },
                    {
                      title: "Tipo",
                      dataIndex: "tipoDado",
                      key: "tipoDado",
                      width: 90,
                      render: (tipo) => (
                        <Tag
                          color="blue"
                          style={{ fontSize: "10px", borderRadius: 4 }}
                        >
                          {String(tipo).toUpperCase() || "TEXTO"}
                        </Tag>
                      ),
                    },
                    {
                      title: "Ações",
                      key: "acoes",
                      width: 80,
                      align: "right",
                      render: (_, record) => (
                        <Space size={2}>
                          <Tooltip title="Configurações">
                            <Button
                              type="text"
                              size="small"
                              icon={
                                <EditOutlined style={{ color: "#475569" }} />
                              }
                              onClick={() =>
                                handleAbrirModal(tab.tipo as ModalDestino)
                              }
                            />
                          </Tooltip>

                          {tab.exp && (
                            <Tooltip title="Inverter escopo">
                              <Button
                                type="text"
                                size="small"
                                icon={
                                  <ArrowRightOutlined
                                    style={{ color: brandColor }}
                                  />
                                }
                                onClick={() =>
                                  handleMoverAtributoDeEscopo(
                                    record.id,
                                    tab.tipo === "dna" ? "grade" : "dna",
                                  )
                                }
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
                        title={
                          <span style={{ fontSize: "14px", fontWeight: 600 }}>
                            {tab.title}
                          </span>
                        }
                        style={{
                          borderRadius: 10,
                          overflow: "hidden",
                          boxShadow: "0 1px 2px 0 rgba(0,0,0,0.05)",
                        }}
                        styles={{
                          header: {
                            borderBottom: "1px solid #f1f5f9",
                            minHeight: "48px",
                          },
                          body: { padding: 0 },
                        }}
                        extra={
                          <Tooltip title={`Vincular Atributo`}>
                            <Button
                              type="link"
                              size="small"
                              icon={<PlusOutlined />}
                              style={{
                                color: brandColor,
                                display: "flex",
                                alignItems: "center",
                              }}
                              onClick={() =>
                                handleAbrirModal(tab.tipo as ModalDestino)
                              }
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
                          locale={{
                            emptyText: (
                              <Empty
                                image={Empty.PRESENTED_IMAGE_SIMPLE}
                                description={
                                  <span
                                    style={{
                                      fontSize: "12px",
                                      color: "#94a3b8",
                                    }}
                                  >
                                    Vazio
                                  </span>
                                }
                              />
                            ),
                          }}
                          style={{ minHeight: 180 }}
                        />
                      </Card>
                    </Col>
                  );
                })}
              </Row>
            </Space>
          ) : (
            <Card
              style={{
                borderRadius: 12,
                textAlign: "center",
                padding: "40px 0",
              }}
            >
              <Empty description="Selecione ou crie uma família na barra lateral para começar a configurar." />
            </Card>
          )}
        </Col>

        {/* Coluna 3: Gerenciamento Ativo de SKUs Vinculados */}
        <Col xs={24} md={24} lg={4}>
          <Card
            title={
              <Space size={8}>
                <ShoppingCartOutlined style={{ color: brandColor }} />
                <span style={{ fontWeight: 700, fontSize: "14px" }}>
                  Itens da Família
                </span>
              </Space>
            }
            style={{
              borderRadius: 12,
              boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.05)",
            }}
            styles={{
              header: { borderBottom: "1px solid #f1f5f9" },
              body: { padding: "16px" },
            }}
          >
            {grupoSelecionado ? (
              <Space direction="vertical" size={16} style={{ width: "100%" }}>
                <Input
                  prefix={<SearchOutlined style={{ color: "#94a3b8" }} />}
                  placeholder="Filtrar SKU ou nome..."
                  value={pesquisaItem}
                  onChange={(e) => setPesquisaItem(e.target.value)}
                  allowClear
                  style={{ borderRadius: 6 }}
                />

                <div
                  style={{
                    maxHeight: "420px",
                    overflowY: "auto",
                    paddingRight: "4px",
                  }}
                >
                  {itensFiltradosDoGrupo.length > 0 ? (
                    <Space
                      direction="vertical"
                      size={12}
                      style={{ width: "100%" }}
                    >
                      {itensFiltradosDoGrupo.map((item) => (
                        <div
                          key={item.id}
                          style={{
                            padding: "12px",
                            backgroundColor: "#f8fafc",
                            borderRadius: "8px",
                            border: "1px solid #e2e8f0",
                            transition: "all 0.2s",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              marginBottom: "4px",
                            }}
                          >
                            <span
                              style={{
                                fontWeight: 700,
                                fontSize: "12px",
                                color: "#0f172a",
                                fontFamily: "monospace",
                              }}
                            >
                              {item.sku}
                            </span>
                            <Tag
                              color={item.ativo ? "success" : "default"}
                              style={{
                                fontSize: "9px",
                                borderRadius: "4px",
                                margin: 0,
                              }}
                            >
                              {item.ativo ? "Ativo" : "Inativo"}
                            </Tag>
                          </div>
                          <div
                            style={{
                              fontSize: "12px",
                              color: "#64748b",
                              lineHeight: "1.4",
                            }}
                          >
                            {item.nome}
                          </div>
                        </div>
                      ))}
                    </Space>
                  ) : (
                    <Empty
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                      description={
                        <span style={{ fontSize: "12px", color: "#94a3b8" }}>
                          Nenhum SKU encontrado
                        </span>
                      }
                    />
                  )}
                </div>

                <Button
                  type="dashed"
                  block
                  icon={<ThunderboltOutlined />}
                  style={{
                    borderColor: brandColor,
                    color: brandColor,
                    borderRadius: 8,
                  }}
                  onClick={() =>
                    Swal.fire(
                      "Novo Item",
                      "Geração de novos SKUs com base nos atributos do DNA e Grade.",
                      "info",
                    )
                  }
                >
                  Gerar Variação SKU
                </Button>
              </Space>
            ) : (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="Sem família ativa"
              />
            )}
          </Card>
        </Col>
      </Row>

      <ModalVinculoAtributos
        isModalAberto={isModalAberto}
        setIsModalAberto={setIsModalAberto}
        destinoModal={tabelaAlvoModal || "ficha"}
        atributosGlobaisDisponiveis={atributosGlobaisDisponiveis}
        handleAdicionarAtributoAoGrupo={handleAdicionarAtributoAoGrupo}
        brandColor={brandColor}
      />
    </div>
  );
};
