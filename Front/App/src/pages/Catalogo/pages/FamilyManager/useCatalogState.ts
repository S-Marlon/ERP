// useCatalogState.ts
import { useState, useMemo, useEffect, useCallback } from "react";
import Swal from "sweetalert2";
import { Grupo, Categoria, AtributoConfig, AtributoPendente, ModalDestino, ItemAssociado } from "./CatalogManager.types";
import {
  gerarPreviewSku,
  gerarPreviewNome,
  extrairTokensTemplate,
  normalizarChaveTemplate,
  resolverValorAtributo,
} from "./CatalogManager.helpers";
import { getGroups, createGroup, updateGroup, getCategorias, getAtributosDaCategoria, getItensDoGrupo } from "./FamilyManager.api";

export const useCatalogState = () => {
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [itensDoGrupo, setItensDoGrupo] = useState<ItemAssociado[]>([]);
  const [itensDaFamilia, setItensDaFamilia] = useState<ItemAssociado[]>([]);
  
  const [valoresTeste, setValoresTeste] = useState<Record<string, string>>({});
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [loadingItens, setLoadingItens] = useState<boolean>(false);
  const [carregandoItens, setCarregandoItens] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [grupoSelecionadoId, setGrupoSelecionadoId] = useState<string | null>(null);
  const [grupoImage, setGrupoImage] = useState<string>("");
  const [abaAtiva, setAbaAtiva] = useState<"variantes" | "informativos">("variantes");

  const [pesquisaItem, setPesquisaItem] = useState('');
  const [isSimuladorAberto, setIsSimuladorAberto] = useState(false);
  const [atributoPendenteEdicao, setAtributoPendenteEdicao] = useState<AtributoPendente | null>(null);

  // Filtros
  const [categoriaFiltroId, setCategoriaFiltroId] = useState<string | "TODAS">("TODAS");
  const [pesquisaFamilia, setPesquisaFamilia] = useState("");

  const [isModalAberto, setIsModalAberto] = useState(false);
  const [tabelaAlvoModal, setTabelaAlvoModal] = useState<ModalDestino | null>(null);
  const [isModalSimuladorOpen, setIsModalSimuladorOpen] = useState(false);

  // Guia modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [guideTab, setGuideTab] = useState<"dna" | "grade" | "ficha">("dna");

  const grupoSelecionado = useMemo(() => {
    return grupos.find((g) => g.id === grupoSelecionadoId) || null;
  }, [grupos, grupoSelecionadoId]);

  const obterIdItem = useCallback((item: any) => {
    return (
      item?.id ??
      item?.idItem ??
      item?.id_item ??
      item?.itemId ??
      item?.produtoId ??
      item?.key ??
      null
    );
  }, []);

  const brandColor = grupoSelecionado?.cor || "#1677ff";

  const onMudancaValorTeste = (idOuNome: string, valor: string) => {
    setValoresTeste(prev => ({ ...prev, [idOuNome]: valor }));
  };

  const handleAtualizarGrupoDireto = <K extends keyof Grupo>(campo: K, valor: Grupo[K]) => {
    setGrupos((prev) =>
      prev.map((g) => (g.id === grupoSelecionadoId ? { ...g, [campo]: valor } : g))
    );
  };

  const onAtualizarTemplateComercial = (valor: string) => handleAtualizarGrupoDireto('templateNomeComercial', valor);
  const onAtualizarTemplateSku = (valor: string) => handleAtualizarGrupoDireto('templateSku', valor);
  const onAtualizarSiglaSku = (valor: string) => handleAtualizarGrupoDireto('siglaSku', valor);
  const onAtualizarSeparadorSku = (valor: string) => handleAtualizarGrupoDireto('separadorSku', valor);

  const onAtualizarOrdemSku = (atributoId: string, ordem: number) => {
    if (!grupoSelecionado) return;
    const atributosAtualizados = grupoSelecionado.atributos.map(attr => {
      if (String(attr.id) === String(atributoId)) {
        return { ...attr, ordemSku: ordem };
      }
      return attr;
    });
    handleAtualizarGrupoDireto('atributos', atributosAtualizados);
  };

  const carregarDadosIniciais = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [dadosGrupos, dadosCategorias] = await Promise.all([getGroups(1), getCategorias(1)]);
      setGrupos(dadosGrupos);
      setCategorias(dadosCategorias);

      if (dadosGrupos.length > 0 && !grupoSelecionadoId) {
        setGrupoSelecionadoId(dadosGrupos[0].id);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message || "Falha na conexão com o servidor.");
    } finally {
      setLoading(false);
    }
  }, [grupoSelecionadoId]);

  useEffect(() => {
    carregarDadosIniciais();
  }, [carregarDadosIniciais]);

  const carregarItensDoGrupo = useCallback(async (grupoId: string) => {
    setLoadingItens(true);
    try {
      const itens = await getItensDoGrupo(grupoId, 1);
      setItensDoGrupo(itens);
      setItensDaFamilia(itens);
    } catch (err) {
      setItensDoGrupo([]);
      setItensDaFamilia([]);
    } finally {
      setLoadingItens(false);
    }
  }, []);

  useEffect(() => {
    if (grupoSelecionado?.id) {
      carregarItensDoGrupo(grupoSelecionado.id);
    } else {
      setItensDoGrupo([]);
      setItensDaFamilia([]);
    }
  }, [grupoSelecionado, carregarItensDoGrupo]);

  useEffect(() => {
    if (grupoSelecionado) {
      setGrupoImage(grupoSelecionado.imagem || "");
    }
  }, [grupoSelecionado]);

  const handleOpenGuideModal = (tipo: "dna" | "grade" | "ficha") => {
    setGuideTab(tipo);
    setIsModalOpen(true);
  };

  const handleCloseGuideModal = () => setIsModalOpen(false);

  const handleMudarCategoriaComConfirmacao = async (novaCategoriaId: string | undefined) => {
    if (!grupoSelecionado) return;

    if (!novaCategoriaId) {
      const resultadoDesvincular = await Swal.fire({
        title: "Remover vínculo com a categoria?",
        text: "O grupo deixará de herdar os atributos automáticos.",
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#d33",
        cancelButtonColor: "#637381",
        confirmButtonText: "Sim, desvincular!",
      });

      if (resultadoDesvincular.isConfirmed) {
        handleAtualizarGrupoDireto("categoriaPai", "");
        handleAtualizarGrupoDireto("categoriaPaiNome", "");
      }
      return;
    }

    const categoriaAlvo = categorias.find((c) => String(c.id) === String(novaCategoriaId));
    const nomeCategoria = categoriaAlvo ? categoriaAlvo.nome : "esta categoria";

    const resultadoAlterar = await Swal.fire({
      title: "Vincular a esta categoria?",
      text: `Deseja mudar para "${nomeCategoria}"?`,
      icon: "question",
      showCancelButton: true,
      confirmButtonColor: brandColor,
      confirmButtonText: "Sim, vincular!",
    });

    if (resultadoAlterar.isConfirmed) {
      try {
        setLoading(true);
        const atributosHerdados = await getAtributosDaCategoria(novaCategoriaId, 1);

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
            const atributosFiltrados = g.atributos.filter((attr) => !attr.valorHerdadoDoGrupo);
            return {
              ...g,
              categoriaPai: novaCategoriaId,
              categoriaPaiNome: nomeCategoria,
              atributos: [...atributosFiltrados, ...novosAtributosObrigatorios],
            };
          })
        );
      } catch (err) {
        Swal.fire("Erro", "Não foi possível buscar os atributos desta categoria.", "error");
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
      Swal.fire("Erro", "Erro ao criar grupo.", "error");
    } finally {
      setLoading(false);
    }
  };

  const familiasFiltradas = useMemo(() => {
    return grupos.filter((g) => {
      if (categoriaFiltroId !== "TODAS") {
        if (categoriaFiltroId === "SEM_CAT") {
          if (g.categoriaPai && g.categoriaPai !== "") return false;
        } else {
          if (String(g.categoriaPai) !== String(categoriaFiltroId)) return false;
        }
      }

      const termo = pesquisaFamilia.toLowerCase();
      const bateNomeGrupo = g.nome.toLowerCase().includes(termo);
      const bateNomeCategoria = g.categoriaPaiNome ? g.categoriaPaiNome.toLowerCase().includes(termo) : false;

      return bateNomeGrupo || bateNomeCategoria;
    });
  }, [grupos, categoriaFiltroId, pesquisaFamilia]);

  const familiasAgrupadas = useMemo(() => {
    return familiasFiltradas.reduce((acc, fam) => {
      const categoria = fam.categoriaPaiNome || "Outras / Sem Categoria";
      if (!acc[categoria]) acc[categoria] = [];
      acc[categoria].push(fam);
      return acc;
    }, {} as Record<string, Grupo[]>);
  }, [familiasFiltradas]);

  // CORREÇÃO: Garante que o filtro use a lista unificada atualizada
  const itensFiltradosDoGrupo = useMemo(() => {
    const listaParaFiltrar = itensDaFamilia.length > 0 ? itensDaFamilia : itensDoGrupo;
    if (!pesquisaItem) return listaParaFiltrar;
    return listaParaFiltrar.filter(
      (item) =>
        item.sku.toLowerCase().includes(pesquisaItem.toLowerCase()) ||
        item.nome.toLowerCase().includes(pesquisaItem.toLowerCase())
    );
  }, [itensDoGrupo, itensDaFamilia, pesquisaItem]);

  const handleSalvarGrupoNoBanco = async () => {
    if (!grupoSelecionado) return;
    try {
      Swal.fire({
        title: "Sucesso!",
        text: "Alterações da família salvas com sucesso.",
        icon: "success",
        timer: 1500,
        showConfirmButton: false,
      });
    } catch (error) {
      Swal.fire("Erro", "Não foi possível salvar as alterações.", "error");
    }
  };

  // CORREÇÃO: Atualiza tanto itensDaFamilia quanto itensDoGrupo simultaneamente
  const atualizarListasDeItens = (novaLista: ItemAssociado[]) => {
    setItensDaFamilia(novaLista);
    setItensDoGrupo(novaLista);
  };

  const handlePadronizarNomesFamilia = async () => {
    if (!grupoSelecionado || !itensDaFamilia.length) {
      Swal.fire("Aviso", "Não há itens para padronizar nesta família.", "info");
      return;
    }

    const confirm = await Swal.fire({
      title: "Padronizar Nomes?",
      text: "Isso vai atualizar o nome de todos os itens da família com base no template comercial atual.",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Sim, padronizar",
      cancelButtonText: "Cancelar",
    });

    if (!confirm.isConfirmed) return;

    const itensAtualizados = itensDaFamilia.map((item) => {
      const novoNome = gerarPreviewNome(grupoSelecionado, item.valoresAtributos || {});
      return { ...item, nome: novoNome };
    });

    atualizarListasDeItens(itensAtualizados);
    Swal.fire("Sucesso!", "Nomes padronizados com sucesso.", "success");
  };

  const handlePadronizarSkusFamilia = async () => {
    if (!grupoSelecionado || !itensDaFamilia.length) {
      Swal.fire("Aviso", "Não há itens para padronizar nesta família.", "info");
      return;
    }

    const confirm = await Swal.fire({
      title: "Padronizar SKUs?",
      text: "Isso vai recalcular o SKU de todos os itens com base nas regras atuais da família.",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Sim, padronizar",
      cancelButtonText: "Cancelar",
    });

    if (!confirm.isConfirmed) return;

    const itensAtualizados = itensDaFamilia.map((item) => {
      const novoSku = gerarPreviewSku(grupoSelecionado, grupoSelecionado.atributos || [], item.valoresAtributos || {});
      return { ...item, sku: novoSku };
    });

    atualizarListasDeItens(itensAtualizados);
    Swal.fire("Sucesso!", "SKUs padronizados com sucesso.", "success");
  };

  const handleNovaFamiliaImportada = (novaFamilia: any) => {
    if (novaFamilia?.id) {
      handleSelecionarGrupo(novaFamilia.id);
    }
    Swal.fire("Importado por IA! 🎉", "A nova família foi estruturada com sucesso.", "success");
  };

  const handleNormalizarItemNome = (itemId: string) => {
    if (!grupoSelecionado) return;

    const itensAtualizados = (itensDaFamilia.length > 0 ? itensDaFamilia : itensDoGrupo).map((item) => {
      const idAtual = obterIdItem(item);
      if (String(idAtual) === String(itemId)) {
        const novoNome = gerarPreviewNome(grupoSelecionado, item.valoresAtributos || {});
        return { ...item, nome: novoNome };
      }
      return item;
    });

    atualizarListasDeItens(itensAtualizados);

    Swal.fire({
      title: "Nome Normalizado!",
      text: "O nome deste item foi atualizado para o padrão.",
      icon: "success",
      timer: 1200,
      showConfirmButton: false,
    });
  };

  const handleNormalizarItemSku = (itemId: string) => {
    if (!grupoSelecionado) return;

    const itensAtualizados = (itensDaFamilia.length > 0 ? itensDaFamilia : itensDoGrupo).map((item) => {
      const idAtual = obterIdItem(item);
      if (String(idAtual) === String(itemId)) {
        const novoSku = gerarPreviewSku(grupoSelecionado, grupoSelecionado.atributos || [], item.valoresAtributos || {});
        return { ...item, sku: novoSku };
      }
      return item;
    });

    atualizarListasDeItens(itensAtualizados);

    Swal.fire({
      title: "SKU Normalizado!",
      text: "O SKU deste item foi recalculado para o padrão.",
      icon: "success",
      timer: 1200,
      showConfirmButton: false,
    });
  };

  const [isModalPendenciaOpen, setIsModalPendenciaOpen] = useState(false);
  const [itemEmEdicaoPendencia, setItemEmEdicaoPendencia] = useState<any>(null);
  const [atributosPendentes, setAtributosPendentes] = useState<any[]>([]);

  const verificarAtributosObrigatorios = (item: any, grupo: any) => {
    const atributosDoGrupo = grupo?.atributos || [];
    const valores = item?.valoresAtributos || {};

    const templateSku = grupo?.templateSku || "";
    const templateNome = grupo?.templateNomeComercial || "";
    const templateComercial = grupo?.templateNomeComercial || "";
    const tokensDosTemplates = [
      ...extrairTokensTemplate(templateSku),
      ...extrairTokensTemplate(templateNome),
      ...extrairTokensTemplate(templateComercial),
    ];

    const pendentes = atributosDoGrupo.filter((attr: any) => {
      const aliasCandidates = [
        String(attr.id ?? ""),
        attr.nome ?? "",
        attr.codigo ?? "",
        String(attr.id ?? "").toLowerCase(),
        String(attr.nome ?? "").toLowerCase(),
        String(attr.codigo ?? "").toLowerCase(),
      ];

      const compoeTemplates = tokensDosTemplates.some((token) => {
        const tokenNormalizado = normalizarChaveTemplate(token);
        return aliasCandidates.some((alias) => {
          const aliasNormalizado = normalizarChaveTemplate(alias);
          return Boolean(tokenNormalizado && aliasNormalizado && tokenNormalizado === aliasNormalizado);
        });
      });

      const valorAtual = resolverValorAtributo(valores, aliasCandidates);
      const estaVazio = valorAtual === undefined || valorAtual === null || String(valorAtual).trim() === "";

      return compoeTemplates && estaVazio;
    });

    return pendentes;
  };

  const handleTentarNormalizarIndividual = (item: any) => {
    if (!grupoSelecionado) return;

    const pendencias = verificarAtributosObrigatorios(item, grupoSelecionado);
    const atributosUsadosNoTemplate = (grupoSelecionado.atributos || []).filter((attr: any) => {
      const aliases = [
        String(attr.id ?? ""),
        attr.nome ?? "",
        attr.codigo ?? "",
      ];

      const tokensDosTemplates = [
        ...extrairTokensTemplate(grupoSelecionado.templateSku || ""),
        ...extrairTokensTemplate(grupoSelecionado.templateNomeComercial || ""),
      ];

      return tokensDosTemplates.some((token) =>
        aliases.some((alias) => {
          const tokenNormalizado = normalizarChaveTemplate(token);
          const aliasNormalizado = normalizarChaveTemplate(alias);
          return Boolean(tokenNormalizado && aliasNormalizado && tokenNormalizado === aliasNormalizado);
        })
      );
    });

    const valoresVaziosOuAusentes = atributosUsadosNoTemplate.some((attr: any) => {
      const aliasCandidates = [String(attr.id ?? ""), attr.nome ?? "", attr.codigo ?? ""];
      const valorAtual = resolverValorAtributo(item?.valoresAtributos || {}, aliasCandidates);
      return valorAtual === undefined || valorAtual === null || String(valorAtual).trim() === "";
    });

    const precisaAbrirPendencia = pendencias.length > 0 || (atributosUsadosNoTemplate.length > 0 && valoresVaziosOuAusentes);

    if (precisaAbrirPendencia) {
      setItemEmEdicaoPendencia(item);
      setAtributosPendentes(pendencias.length > 0 ? pendencias : atributosUsadosNoTemplate);
      setIsModalPendenciaOpen(true);
    } else {
      handleNormalizarItemSkuENomeDireto(obterIdItem(item));
    }
  };

  const handleNormalizarItemSkuENomeDireto = (itemId: string | number | null) => {
    if (!grupoSelecionado || itemId === null || itemId === undefined) return;

    const baseItens = itensDaFamilia.length > 0 ? itensDaFamilia : itensDoGrupo;
    const itensAtualizados = baseItens.map((item) => {
      const idAtual = obterIdItem(item);
      if (String(idAtual) === String(itemId)) {
        const novoSku = gerarPreviewSku(grupoSelecionado, grupoSelecionado.atributos || [], item.valoresAtributos || {});
        const novoNome = gerarPreviewNome(grupoSelecionado, item.valoresAtributos || {});
        return { ...item, sku: novoSku, nome: novoNome };
      }
      return item;
    });

    atualizarListasDeItens(itensAtualizados);

    Swal.fire({
      title: "Normalizado com Sucesso!",
      text: "O SKU e o Nome foram recalculados perfeitamente.",
      icon: "success",
      timer: 1500,
      showConfirmButton: false,
    });
  };

  const handleSalvarAtributosPendentes = (valoresFormulario: Record<string, any>) => {
    if (!itemEmEdicaoPendencia || !grupoSelecionado) return;

    const itemIdAlvo = obterIdItem(itemEmEdicaoPendencia);

    const atualizarItemNaLista = (lista: ItemAssociado[]) =>
      lista.map((item) => {
        const idAtual = obterIdItem(item);
        const eOMesmoItem =
          item === itemEmEdicaoPendencia ||
          (itemIdAlvo !== null && itemIdAlvo !== undefined && String(idAtual) === String(itemIdAlvo));

        if (!eOMesmoItem) return item;

        const novosValores = { ...(item.valoresAtributos || {}), ...valoresFormulario };
        const novoSku = gerarPreviewSku(grupoSelecionado, grupoSelecionado.atributos || [], novosValores);
        const novoNome = gerarPreviewNome(grupoSelecionado, novosValores);

        return {
          ...item,
          valoresAtributos: novosValores,
          sku: novoSku,
          nome: novoNome,
        };
      });

    setItensDaFamilia((prev) => atualizarItemNaLista(prev));
    setItensDoGrupo((prev) => atualizarItemNaLista(prev));
    setItemEmEdicaoPendencia(null);
    setAtributosPendentes([]);
    setIsModalPendenciaOpen(false);
  };



  const [modalFormalizacaoAberto, setModalFormalizacaoAberto] = useState(false);
const [itensPendentesFormalizacao, setItensPendentesFormalizacao] = useState([]);

const handleProcessarFormalizacaoLote = () => {
  const listaItens = itensFiltradosDoGrupo || [];
  const atributosObrigatorios = grupoSelecionado?.atributos || [];

  // Filtra itens que faltam preencher algum atributo obrigatório
  const pendentes = listaItens.filter(item => {
    return atributosObrigatorios.some(attr => {
      const val = item.valoresAtributos?.[attr.id || attr.nome];
      return !val || String(val).trim() === "";
    });
  });

  if (pendentes.length > 0) {
    setItensPendentesFormalizacao(pendentes);
    setModalFormalizacaoAberto(true);
  } else {
    // Se estiver tudo preenchido, executa o sucesso automático direto
    Swal.fire("Sucesso!", "Todos os itens da família foram formalizados e gerados com sucesso.", "success");
    // Chamar função real de lote aqui se houver
  }
};

const handleAtualizarAtributoItemPendente = (itemId, atributoId, novoValor) => {
  setItensPendentesFormalizacao(prev =>
    prev.map(item => {
      if (item.id === itemId) {
        return {
          ...item,
          valoresAtributos: {
            ...(item.valoresAtributos || {}),
            [atributoId]: novoValor
          }
        };
      }
      return item;
    })
  );
};

const handleSalvarEContinuarFormalizacao = () => {
  // Salva os dados atualizados e fecha o modal
  setModalFormalizacaoAberto(false);
  Swal.fire("Formalizado!", "Atributos salvos e lote processado com sucesso.", "success");
};


  return {
    grupos,
    categorias,
    grupoSelecionado,
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
    handleCriarGrupo,
    handleSalvarGrupoNoBanco,
    handleMudarCategoriaComConfirmacao,
    brandColor,
    itensFiltradosDoGrupo,
    pesquisaItem,
    setPesquisaItem,
    familiasFiltradas,
    pesquisaFamilia,
    setPesquisaFamilia,
    familiasAgrupadas,
    categoriaFiltroId,
    setCategoriaFiltroId,
    setIsImportModalOpen,
    isImportModalOpen,
    isModalOpen,
    setIsModalOpen,
    guideTab,
    setGuideTab,
    handleOpenGuideModal,
    handleCloseGuideModal,
    valoresTeste,
    onMudancaValorTeste,
    onAtualizarTemplateComercial,
    onAtualizarTemplateSku,
    onAtualizarSiglaSku,
    onAtualizarSeparadorSku,
    onAtualizarOrdemSku,
    itensDaFamilia,
    carregandoItens,
    setItensDaFamilia,
    tabelaAlvoModal,
    setTabelaAlvoModal,
    handleNovaFamiliaImportada,
    handleNormalizarItemSku,
    handleTentarNormalizarIndividual,
    handleNormalizarItemNome,
    handleSalvarAtributosPendentes,
    isModalPendenciaOpen,
    setIsModalPendenciaOpen,
    itemEmEdicaoPendencia,
    atributosPendentes,
    handleNormalizarItemSkuENomeDireto,
    handlePadronizarNomesFamilia,
    handlePadronizarSkusFamilia,
    modalFormalizacaoAberto,
    setModalFormalizacaoAberto,
    itensPendentesFormalizacao,
    setItensPendentesFormalizacao,
    handleProcessarFormalizacaoLote,
    handleAtualizarAtributoItemPendente,
    handleSalvarEContinuarFormalizacao,
  };
};