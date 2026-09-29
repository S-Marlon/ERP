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
import {
getFamilies,
createFamily,
updateFamily,
getCategorias,
getAtributosDaCategoria,
getAtributosGlobais,
getDiagnosticoFormalizacao,
formalizarItensDaFamilia,
} from "./FamilyManager.api";

type ItemFormalizacao = ItemAssociado & {
id: string;
idItem: string;
atributosPendentes?: Array<{ atributoId: string; nome: string; codigo?: string; motivo: string }>;
podeFormalizar?: boolean;
skuCalculado?: string | null;
nomeCalculado?: string | null;
};

export const useCatalogState = () => {
const [familias, setFamilias] = useState<Grupo[]>([]);
const [categorias, setCategorias] = useState<Categoria[]>([]);
const [itensDaFamiliaAtual, setItensDaFamiliaAtual] = useState<ItemAssociado[]>([]);
const [itensDaFamilia, setItensDaFamilia] = useState<ItemAssociado[]>([]);
const [atributosGlobaisDisponiveis, setAtributosGlobaisDisponiveis] = useState<AtributoConfig[]>([]);

const [valoresTeste, setValoresTeste] = useState<Record<string, string>>({});
const [isImportModalOpen, setIsImportModalOpen] = useState(false);
const [loading, setLoading] = useState<boolean>(false);
const [loadingItens, setLoadingItens] = useState<boolean>(false);
const [carregandoItens, setCarregandoItens] = useState<boolean>(false);
const [error, setError] = useState<string | null>(null);

const [familiaSelecionadaId, setFamiliaSelecionadaId] = useState<string | null>(null);
const [familiaImage, setFamiliaImage] = useState<string>("");
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

const familiaSelecionada = useMemo(() => {
return familias.find((g) => g.id === familiaSelecionadaId) || null;
}, [familias, familiaSelecionadaId]);

const marcaComportamento = familiaSelecionada?.marcaComportamento || 'ficha';

const setMarcaComportamento = (novoComportamento: string) => {
handleAtualizarFamiliaDireto('marcaComportamento', novoComportamento);
};

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

const brandColor = familiaSelecionada?.cor || "#1677ff";

const onMudancaValorTeste = (idOuNome: string, valor: string) => {
setValoresTeste(prev => ({ ...prev, [idOuNome]: valor }));
};

const handleAtualizarFamiliaDireto = <K extends keyof Grupo>(campo: K, valor: Grupo[K]) => {
setFamilias((prev) =>
prev.map((g) => (g.id === familiaSelecionadaId ? { ...g, [campo]: valor } : g))
);
};

const onAtualizarTemplateComercial = (valor: string) => {
  handleAtualizarFamiliaDireto('templateNomeComercial', valor);
};

const onAtualizarTemplateSku = (valor: string) => {
  handleAtualizarFamiliaDireto('templateSku', valor);
};

const onAtualizarSiglaSku = (valor: string) => {
  handleAtualizarFamiliaDireto('siglaSku', valor);
};
const onAtualizarSeparadorSku = (valor: string) => handleAtualizarFamiliaDireto('separadorSku', valor);

const onAtualizarOrdemSku = (atributoId: string, ordem: number) => {
if (!familiaSelecionada) return;
const atributosAtualizados = familiaSelecionada.atributos.map(attr => {
if (String(attr.id) === String(atributoId)) {
return { ...attr, ordemSku: ordem };
}
return attr;
});
handleAtualizarFamiliaDireto('atributos', atributosAtualizados);
};

const carregarDadosIniciais = useCallback(async () => {
setLoading(true);
setError(null);
try {
const [dadosFamilias, dadosCategorias, dadosAtributos] = await Promise.all([
getFamilies(1),
getCategorias(1),
getAtributosGlobais(1),
]);
setFamilias(dadosFamilias);
setCategorias(dadosCategorias);
setAtributosGlobaisDisponiveis(dadosAtributos);

if (dadosFamilias.length > 0 && !familiaSelecionadaId) {
setFamiliaSelecionadaId(dadosFamilias[0].id);
}
} catch (err) {
const message = err instanceof Error ? err.message : String(err);
setError(message || "Falha na conexão com o servidor.");
} finally {
setLoading(false);
}
}, [familiaSelecionadaId]);

useEffect(() => {
carregarDadosIniciais();
}, [carregarDadosIniciais]);

const carregarItensDaFamilia = useCallback(async (familiaId: string) => {
setLoadingItens(true);
try {
const diagnostico = await getDiagnosticoFormalizacao(familiaId, 1);
const itens = diagnostico.itens || [];
setItensDaFamiliaAtual(itens);
setItensDaFamilia(itens);
} catch (err) {
setItensDaFamiliaAtual([]);
setItensDaFamilia([]);
} finally {
setLoadingItens(false);
}
}, []);

useEffect(() => {
if (familiaSelecionada?.id) {
carregarItensDaFamilia(familiaSelecionada.id);
} else {
setItensDaFamiliaAtual([]);
setItensDaFamilia([]);
}
}, [familiaSelecionada, carregarItensDaFamilia]);


useEffect(() => {
if (familiaSelecionada) {
setFamiliaImage(familiaSelecionada.imagem || "");
}
}, [familiaSelecionada]);


const handleOpenGuideModal = (tipo: "dna" | "grade" | "ficha") => {
setGuideTab(tipo);
setIsModalOpen(true);
};

const handleCloseGuideModal = () => setIsModalOpen(false);
const handleAbrirModal = (tipo: ModalDestino) => {
setTabelaAlvoModal(tipo);
setIsModalAberto(true);
};

const handleAdicionarAtributoAFamilia = (atributo: Partial<AtributoConfig>) => {
if (!familiaSelecionada || !atributo.nome) return;
const existe = familiaSelecionada.atributos.some((item) =>
(atributo.id && String(item.id) === String(atributo.id)) ||
item.nome.trim().toLowerCase() === atributo.nome?.trim().toLowerCase()
);
if (existe) {
Swal.fire("Atenção", `O atributo "${atributo.nome}" já está vinculado à família.`, "info");
return;
}

const tipoDadoRecebido = String(atributo.tipoDado || 'texto');
const novoAtributo: AtributoConfig = {
id: String(atributo.id || `novo-${Date.now()}`),
nome: atributo.nome.trim(),
codigo: atributo.codigo || '',
classificacao: tabelaAlvoModal || atributo.classificacao || 'ficha',
tipoDado: tipoDadoRecebido === 'opcoes' ? 'lista' : (tipoDadoRecebido as AtributoConfig['tipoDado']),
opcoesValidas: atributo.opcoesValidas || [],
separadorSufixo: atributo.separadorSufixo || 'nenhum',
sufixo: atributo.sufixo || '',
obrigatorio: Boolean(atributo.obrigatorio),
geraVariacao: Boolean(atributo.geraVariacao),
compoeSku: Boolean(atributo.compoeSku),
ordemSku: Number(atributo.ordemSku || 0),
exemplos: atributo.exemplos || '',
valorHerdadoDaFamilia: Boolean(atributo.valorHerdadoDaFamilia),
valorPadraoFamilia: atributo.valorPadraoFamilia || '',
pesquisavel: atributo.pesquisavel !== false,
bloqueado: Boolean(atributo.bloqueado),
retransmitir: atributo.retransmitir !== false,
origem: atributo.origem || 'locais',
};

handleAtualizarFamiliaDireto('atributos', [...familiaSelecionada.atributos, novoAtributo]);
setIsModalAberto(false);
};

const handleMudarCategoriaComConfirmacao = async (novaCategoriaId: string | undefined) => {
if (!familiaSelecionada) return;

if (!novaCategoriaId) {
const resultadoDesvincular = await Swal.fire({
title: "Remover vínculo com a categoria?",
text: "A família deixará de herdar os atributos automáticos.",
icon: "warning",
showCancelButton: true,
confirmButtonColor: "#d33",
cancelButtonColor: "#637381",
confirmButtonText: "Sim, desvincular!",
});

if (resultadoDesvincular.isConfirmed) {
handleAtualizarFamiliaDireto("categoriaPai", "");
handleAtualizarFamiliaDireto("categoriaPaiNome", "");
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
    valorHerdadoDaFamilia: false,
  }));

setFamilias((prev) =>
  prev.map((g) => {
    if (String(g.id) !== String(familiaSelecionadaId)) return g;
    const atributosFiltrados = g.atributos.filter((attr) => !attr.valorHerdadoDaFamilia);
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
if (!familiaSelecionada) return [];
return familiaSelecionada.atributos
.filter((attr) => attr.compoeSku && attr.ordemSku > 0)
.sort((a, b) => a.ordemSku - b.ordemSku);
}, [familiaSelecionada]);

const previewSkuSimulado = useMemo(() => {
return gerarPreviewSku(familiaSelecionada, atributosDoSku, valoresTeste);
}, [familiaSelecionada, atributosDoSku, valoresTeste]);

const previewNomeSimulado = useMemo(() => {
return gerarPreviewNome(familiaSelecionada, valoresTeste);
}, [familiaSelecionada, valoresTeste]);

const handleSelecionarFamilia = (id: string | null) => {
setFamiliaSelecionadaId(id);
setValoresTeste({});
};

const atributosComMarcaInjetada = useMemo(() => {
if (!familiaSelecionada) return [];

const atributosAtuais = familiaSelecionada.atributos || [];

const atributoMarcaVirtual: AtributoConfig & { isMarcaSistema?: boolean } = {
id: 'atributo-marca-virtual',
nome: 'Marca',
codigo: 'MARCA',
classificacao: (marcaComportamento as any) || 'ficha',
tipoDado: 'texto',
obrigatorio: false,
geraVariacao: marcaComportamento === 'grade',
compoeSku: marcaComportamento === 'dna',
ordemSku: marcaComportamento === 'dna' ? 1 : 0,
origem: 'sistema',
bloqueado: true,
isMarcaSistema: true,
};

const atributosFiltrados = atributosAtuais.filter(
(attr) => attr.codigo !== 'MARCA' && attr.nome.toLowerCase() !== 'marca'
);

return [atributoMarcaVirtual, ...atributosFiltrados];
}, [familiaSelecionada, marcaComportamento]);

// ==========================================
// TRECHO CORRIGIDO: handleCriarFamilia
// ==========================================
const handleCriarFamilia = async () => {
setLoading(true);
try {
const payloadVazio = {
nome: "Nova Família de Produtos",
categoriaPai: "",
categoriaPaiNome: "",
descricao: "",
unidadeMedidaBase: "PC",
templateNomeComercial: "{FAMILIA}",
separadorSku: "-",
cor: "#1677ff",
imagem: "",
atributos: [],
};

// Passando tenantId (1) e o payload em seguida conforme nossa flexibilidade da API
const res = await createFamily(1, payloadVazio);
if (res.success && res.id) {
await carregarDadosIniciais();
setFamiliaSelecionadaId(res.id);
}
} catch (err) {
Swal.fire("Erro", "Erro ao criar família.", "error");
} finally {
setLoading(false);
}
};

const familiasFiltradas = useMemo(() => {
return familias.filter((g) => {
if (categoriaFiltroId !== "TODAS") {
if (categoriaFiltroId === "SEM_CAT") {
  if (g.categoriaPai && g.categoriaPai !== "") return false;
} else {
  if (String(g.categoriaPai) !== String(categoriaFiltroId)) return false;
}
}

const termo = pesquisaFamilia.toLowerCase();
const bateNomeFamilia = g.nome.toLowerCase().includes(termo);
const bateNomeCategoria = g.categoriaPaiNome ? g.categoriaPaiNome.toLowerCase().includes(termo) : false;

return bateNomeFamilia || bateNomeCategoria;
});
}, [familias, categoriaFiltroId, pesquisaFamilia]);

const familiasAgrupadas = useMemo(() => {
return familiasFiltradas.reduce((acc, fam) => {
const categoria = fam.categoriaPaiNome || "Outras / Sem Categoria";
if (!acc[categoria]) acc[categoria] = [];
acc[categoria].push(fam);
return acc;
}, {} as Record<string, Grupo[]>);
}, [familiasFiltradas]);

const itensFiltradosDaFamilia = useMemo(() => {
const listaParaFiltrar = itensDaFamilia.length > 0 ? itensDaFamilia : itensDaFamiliaAtual;
if (!pesquisaItem) return listaParaFiltrar;
return listaParaFiltrar.filter(
(item) =>
item.sku.toLowerCase().includes(pesquisaItem.toLowerCase()) ||
item.nome.toLowerCase().includes(pesquisaItem.toLowerCase())
);
}, [itensDaFamiliaAtual, itensDaFamilia, pesquisaItem]);



const atualizarListasDeItens = (novaLista: ItemAssociado[]) => {
setItensDaFamilia(novaLista);
setItensDaFamiliaAtual(novaLista);
};

const handlePadronizarNomesFamilia = async () => {
if (!familiaSelecionada || !itensDaFamilia.length) {
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
const novoNome = gerarPreviewNome(familiaSelecionada, item.valoresAtributos || {});
return { ...item, nome: novoNome };
});

atualizarListasDeItens(itensAtualizados);
Swal.fire("Sucesso!", "Nomes padronizados com sucesso.", "success");
};

const handlePadronizarSkusFamilia = async () => {
if (!familiaSelecionada || !itensDaFamilia.length) {
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
const novoSku = gerarPreviewSku(familiaSelecionada, familiaSelecionada.atributos || [], item.valoresAtributos || {});
return { ...item, sku: novoSku };
});

atualizarListasDeItens(itensAtualizados);
Swal.fire("Sucesso!", "SKUs padronizados com sucesso.", "success");
};

const handleNovaFamiliaImportada = (novaFamilia: any) => {
if (novaFamilia?.id) {
handleSelecionarFamilia(novaFamilia.id);
}
Swal.fire("Importado por IA! 🎉", "A nova família foi estruturada com sucesso.", "success");
};

const handleNormalizarItemNome = (itemOuId: any) => {
if (!familiaSelecionada) return;
const itemId = obterIdItem(itemOuId) ?? itemOuId;

const itensAtualizados = (itensDaFamilia.length > 0 ? itensDaFamilia : itensDaFamiliaAtual).map((item) => {
const idAtual = obterIdItem(item);
if (String(idAtual) === String(itemId)) {
const novoNome = gerarPreviewNome(familiaSelecionada, item.valoresAtributos || {});
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

const handleNormalizarItemSku = (itemOuId: any) => {
if (!familiaSelecionada) return;
const itemId = obterIdItem(itemOuId) ?? itemOuId;

const itensAtualizados = (itensDaFamilia.length > 0 ? itensDaFamilia : itensDaFamiliaAtual).map((item) => {
const idAtual = obterIdItem(item);
if (String(idAtual) === String(itemId)) {
const novoSku = gerarPreviewSku(familiaSelecionada, familiaSelecionada.atributos || [], item.valoresAtributos || {});
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
const [isModalAtributosItemOpen, setIsModalAtributosItemOpen] = useState(false);
const [itemEmEdicaoAtributos, setItemEmEdicaoAtributos] = useState<ItemFormalizacao | null>(null);

const verificarAtributosObrigatorios = (item: any, familia: any) => {
const atributosDaFamilia = familia?.atributos || [];
const valores = item?.valoresAtributos || {};

const templateSku = familia?.templateSku || "";
const templateNome = familia?.templateNomeComercial || "";
const templateComercial = familia?.templateNomeComercial || "";
const tokensDosTemplates = [
...extrairTokensTemplate(templateSku),
...extrairTokensTemplate(templateNome),
...extrairTokensTemplate(templateComercial),
];

const pendentes = atributosDaFamilia.filter((attr: any) => {
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
if (!familiaSelecionada) return;

const pendencias = verificarAtributosObrigatorios(item, familiaSelecionada);
const atributosUsadosNoTemplate = (familiaSelecionada.atributos || []).filter((attr: any) => {
const aliases = [
String(attr.id ?? ""),
attr.nome ?? "",
attr.codigo ?? "",
];

const tokensDosTemplates = [
...extrairTokensTemplate(familiaSelecionada.templateSku || ""),
...extrairTokensTemplate(familiaSelecionada.templateNomeComercial || ""),
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
if (!familiaSelecionada || itemId === null || itemId === undefined) return;

const baseItens = itensDaFamilia.length > 0 ? itensDaFamilia : itensDaFamiliaAtual;
const itensAtualizados = baseItens.map((item) => {
const idAtual = obterIdItem(item);
if (String(idAtual) === String(itemId)) {
const novoSku = gerarPreviewSku(familiaSelecionada, familiaSelecionada.atributos || [], item.valoresAtributos || {});
const novoNome = gerarPreviewNome(familiaSelecionada, item.valoresAtributos || {});
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

const handleSalvarAtributosPendentes = async (valoresFormulario: Record<string, any>) => {
if (!itemEmEdicaoPendencia || !familiaSelecionada) return;

const itemIdAlvo = obterIdItem(itemEmEdicaoPendencia);
const valoresAtualizados = {
...(itemEmEdicaoPendencia.valoresAtributos || {}),
...valoresFormulario,
};

try {
await formalizarItensDaFamilia(familiaSelecionada.id, [{
idItem: String(itemIdAlvo),
atributos: valoresAtualizados,
}]);
await carregarItensDaFamilia(familiaSelecionada.id);
} catch (error) {
Swal.fire("Erro", error instanceof Error ? error.message : "Não foi possível formalizar o item.", "error");
return;
}

const atualizarItemNaLista = (lista: ItemAssociado[]) =>
lista.map((item) => {
const idAtual = obterIdItem(item);
const eOMesmoItem =
  item === itemEmEdicaoPendencia ||
  (itemIdAlvo !== null && itemIdAlvo !== undefined && String(idAtual) === String(itemIdAlvo));

if (!eOMesmoItem) return item;

const novosValores = valoresAtualizados;
const novoSku = gerarPreviewSku(familiaSelecionada, familiaSelecionada.atributos || [], novosValores);
const novoNome = gerarPreviewNome(familiaSelecionada, novosValores);

return {
  ...item,
  valoresAtributos: novosValores,
  sku: novoSku,
  nome: novoNome,
};
});

setItensDaFamilia((prev) => atualizarItemNaLista(prev));
setItensDaFamiliaAtual((prev) => atualizarItemNaLista(prev));
setItemEmEdicaoPendencia(null);
setAtributosPendentes([]);
setIsModalPendenciaOpen(false);
};

const handleEditarAtributosItem = (item: ItemAssociado) => {
setItemEmEdicaoAtributos(item as ItemFormalizacao);
setIsModalAtributosItemOpen(true);
};

const handleAtualizarAtributoItemEditado = (atributoId: string, valor: string) => {
setItemEmEdicaoAtributos((itemAtual) => itemAtual ? {
...itemAtual,
valoresAtributos: {
...(itemAtual.valoresAtributos || {}),
[atributoId]: valor,
},
} : itemAtual);
};

const handleSalvarAtributosItem = async () => {
if (!familiaSelecionada || !itemEmEdicaoAtributos) return;
try {
await formalizarItensDaFamilia(familiaSelecionada.id, [{
idItem: itemEmEdicaoAtributos.idItem || itemEmEdicaoAtributos.id,
atributos: itemEmEdicaoAtributos.valoresAtributos || {},
}]);
await carregarItensDaFamilia(familiaSelecionada.id);
setIsModalAtributosItemOpen(false);
setItemEmEdicaoAtributos(null);
Swal.fire("Sucesso", "Atributos do item atualizados com sucesso.", "success");
} catch (error) {
Swal.fire("Erro", error instanceof Error ? error.message : "Não foi possível atualizar os atributos do item.", "error");
}
};

const [modalFormalizacaoAberto, setModalFormalizacaoAberto] = useState(false);
const [itensPendentesFormalizacao, setItensPendentesFormalizacao] = useState<ItemFormalizacao[]>([]);

const handleProcessarFormalizacaoLote = async () => {
if (!familiaSelecionada) return;
const diagnostico = await getDiagnosticoFormalizacao(familiaSelecionada.id, 1);
const listaItens = diagnostico.itens || [];
setItensDaFamiliaAtual(listaItens);
setItensDaFamilia(listaItens);
const pendentes = listaItens.filter((item: ItemFormalizacao) => !item.podeFormalizar);

if (pendentes.length > 0) {
setItensPendentesFormalizacao(pendentes);
setModalFormalizacaoAberto(true);
} else {
await formalizarItensDaFamilia(
familiaSelecionada.id,
listaItens.map((item: ItemFormalizacao) => ({ idItem: item.idItem || item.id, atributos: item.valoresAtributos || {} }))
);
await carregarItensDaFamilia(familiaSelecionada.id);
Swal.fire("Sucesso!", "Todos os itens da família foram formalizados e gerados com sucesso.", "success");
}
};

const handleAtualizarAtributoItemPendente = (itemId: string | number, atributoId: string, novoValor: string) => {
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

const handleSalvarEContinuarFormalizacao = async () => {
if (!familiaSelecionada) return;
try {
await formalizarItensDaFamilia(
familiaSelecionada.id,
itensPendentesFormalizacao.map(item => ({
  idItem: item.idItem || item.id,
  atributos: item.valoresAtributos || {}
}))
);
await carregarItensDaFamilia(familiaSelecionada.id);
setModalFormalizacaoAberto(false);
setItensPendentesFormalizacao([]);
Swal.fire("Formalizado!", "Atributos salvos e lote processado com sucesso.", "success");
} catch (error) {
Swal.fire("Erro", error instanceof Error ? error.message : "Não foi possível formalizar os itens.", "error");
}
};

// Adicione esta função no useCatalogState.ts
const handleAtualizarIdentidadeFamilia = (valores: Record<string, any>) => {
  if (!familiaSelecionadaId) return;

  setFamilias((prev) =>
    prev.map((g) => {
      if (g.id === familiaSelecionadaId) {
        return {
          ...g,
          ...valores,
          // Garante que se o objeto de valores não trouxer atributos, mantemos os anteriores
          atributos: valores.atributos !== undefined ? valores.atributos : (g.atributos || []),
        };
      }
      return g;
    })
  );

  if (valores.imagem !== undefined) {
    setFamiliaImage(valores.imagem);
  }
};

return {
familias,
categorias,
familiaSelecionada,
setFamiliaSelecionadaId,

// 🛡️ ALIASES DE COMPATIBILIDADE PARA O FamilyManager.tsx:
grupoSelecionado: familiaSelecionada,
setGrupoSelecionado: setFamiliaSelecionadaId,
setGrupoSelecionadoId: setFamiliaSelecionadaId,
grupoImage: familiaImage,
handleCriarGrupo: handleCriarFamilia,
handleAdicionarAtributoAoGrupo: handleAdicionarAtributoAFamilia,
itensFiltradosDoGrupo: itensFiltradosDaFamilia,

// ALIASES JÁ EXISTENTES:
handleSelecionarGrupo: handleSelecionarFamilia, 
handleSelecionarGrupoId: setFamiliaSelecionadaId,

atributosGlobaisDisponiveis,
setValoresTeste,
isModalAberto,
abaAtiva,
previewSkuSimulado,
previewNomeSimulado,
familiaImage,
isSimuladorAberto,
loading,
loadingItens,
error,
carregarDadosIniciais,
setIsSimuladorAberto,
setIsModalAberto,
setAbaAtiva,
handleSelecionarFamilia,
handleAtualizarFamiliaDireto,
handleCriarFamilia,
handleMudarCategoriaComConfirmacao,
brandColor,
itensFiltradosDaFamilia,
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
handleAbrirModal,
handleAdicionarAtributoAFamilia,
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
handleEditarAtributosItem,
handleAtualizarAtributoItemEditado,
handleSalvarAtributosItem,
isModalAtributosItemOpen,
setIsModalAtributosItemOpen,
itemEmEdicaoAtributos,
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
marcaComportamento,
setMarcaComportamento,
atributosComMarcaInjetada,
handleAtualizarIdentidadeFamilia,

};
};