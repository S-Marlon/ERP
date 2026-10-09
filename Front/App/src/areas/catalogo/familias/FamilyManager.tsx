// FamilyManager.tsx
import React, { useMemo, useState, useEffect, useRef } from "react";
import {
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
Form,
Modal,
Radio,
Divider,
List,
Select,
} from "antd";
import {
  PlusOutlined,
  ThunderboltOutlined,
  InfoCircleOutlined,
  DeleteOutlined,
  AppstoreOutlined,
  FileTextOutlined,
  TagOutlined,
  UndoOutlined,
  ReadOutlined,
  SaveOutlined,
  ExclamationCircleOutlined,
} from "@ant-design/icons";
import Swal from "sweetalert2";
import { useSearchParams } from "react-router-dom";

import { updateFamilia, deleteFamilia, getMarcasCatalogo } from './FamilyManager.api';
import { STATUS_FAMILIA_CONFIG } from './CatalogManager.types'; // Ajuste o caminho do import conforme seu projeto

// Hook desacoplado
import { useCatalogState } from "./useCatalogState";

// Importações dos helpers
import {
gerarPreviewSku,
gerarPreviewNome,
construirArvoreAntd,
} from "./CatalogManager.helpers";

// Componentes externos
import { PainelSimulador } from "./components/PainelSimulador";
import { ModalVinculoAtributos } from "./components/ModalVinculoAtributos";
import { ImportarFamiliaModal } from "./ImportarFamiliaModal";
import { AttributeGuideModal } from "./guide/AttributeGuideModal";
import { FamiliaIdentidadeCard } from "./FamiliaIdentidadeCard";
import ListaFamiliasAtivas from "./ListaFamiliasAtivas";
import ItensFamiliaCard from "./ItensFamiliaCard";
import { AtributosCard } from "./AtributosCard";
import Paragraph from "antd/es/typography/Paragraph";

const { Title, Text } = Typography;

// Ferramenta de desenvolvimento: mostra o payload local x salvo
const MOSTRAR_DEBUG_PAYLOAD = false;

export const FamilyManager: React.FC = () => {
// Instância do formulário do Ant Design para o Modal de Pendências
const [formPendencia] = Form.useForm();

const catalogState = useCatalogState();
const [isModalRevisaoOpen, setIsModalRevisaoOpen] = useState<boolean>(false);

// 🛡️ ESTADO LOCAL INDEPENDENTE (Garante autonomia total à página)
const [familiaSelecionadaLocal, setFamiliaSelecionadaLocal] = useState<any>(null);
const [familiaOriginal, setFamiliaOriginal] = useState<any>(null);
const [temAlteracoes, setTemAlteracoes] = useState<boolean>(false);
const snapshotRef = useRef<string>("");
const isFamilyCompliant = true

const {
grupoSelecionado: familiaSelecionadaHook,
setGrupoSelecionado: setFamiliaSelecionadaHook,
atributosGlobaisDisponiveis,
categorias,
previewSkuSimulado,
previewNomeSimulado,
grupoImage,
loading,
error,
isModalAberto,
setIsModalAberto,
handleSelecionarGrupo: handleSelecionarFamilia,
handleCriarGrupo: handleCriarFamilia,
handleAbrirModal,
handleAdicionarAtributoAoGrupo: handleAdicionarAtributoÀFamilia,
tabelaAlvoModal,
brandColor,
itensFiltradosDoGrupo: itensFiltradosDaFamilia,
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
handleOpenGuideModal,
guideTab,
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
carregarDadosIniciais,
setGrupoSelecionadoId: setFamiliaSelecionadaId,
handlePadronizarNomesFamilia,
handlePadronizarSkusFamilia,
isModalPendenciaOpen,
setIsModalPendenciaOpen,
atributosPendentes,
handleTentarNormalizarIndividual,
handleNormalizarItemSku,
handleNormalizarItemNome,
handleSalvarAtributosPendentes,
handleEditarAtributosItem,
handleAtualizarAtributoItemEditado,
handleSalvarAtributosItem,
isModalAtributosItemOpen,
setIsModalAtributosItemOpen,
itemEmEdicaoAtributos,
itemEmEdicaoPendencia,
modalFormalizacaoAberto,
setModalFormalizacaoAberto,
itensPendentesFormalizacao,
handleProcessarFormalizacaoLote,
handleAtualizarAtributoItemPendente,
handleSalvarEContinuarFormalizacao,
atributosComMarcaInjetada, // <--- Adicione esta linha na desestruturação
handleAtualizarIdentidadeFamilia,
handleNovaFamiliaImportada 
} = catalogState;

// Papel da marca (ficha, dna ou grade): lido e gravado na família selecionada
const marcaComportamento: string = familiaSelecionadaLocal?.marcaComportamento || "ficha";
const setMarcaComportamento = (papel: string) =>
setFamiliaSelecionada((prev: any) => ({ ...prev, marcaComportamento: papel }));
const [isGuiaOpen, setIsGuiaOpen] = useState(false);

// Link vindo da tela de categorias (?familia=ID): abre a família direto
const [searchParams] = useSearchParams();
const familiaDoLink = searchParams.get('familia');
useEffect(() => {
if (familiaDoLink && catalogState.familias.some((f: any) => String(f.id) === familiaDoLink)) {
catalogState.handleSelecionarGrupo(familiaDoLink);
}
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [familiaDoLink, catalogState.familias.length]);

// Sincroniza os dados que vêm de fora para o estado local independente
useEffect(() => {
if (familiaSelecionadaHook) {
setFamiliaSelecionadaLocal(familiaSelecionadaHook);
}
}, [familiaSelecionadaHook]);

// Marcas do cadastro (para a marca da família e a marca de cada item)
const [marcasCatalogo, setMarcasCatalogo] = useState<Array<{ id: string; nome: string }>>([]);
useEffect(() => {
getMarcasCatalogo(1).then(setMarcasCatalogo).catch(() => setMarcasCatalogo([]));
}, []);

// Campo "Marca" do item: com marca DNA vale a da família (somente leitura)
const renderCampoMarcaItem = (valor: any, onChange: (v: string) => void, size: "small" | "middle" = "middle") => {
if (marcaComportamento === "dna") {
return (
<Tooltip title="A marca é DNA desta família: todos os itens recebem a marca da família.">
<Select size={size} disabled value={familiaSelecionadaLocal?.nomeMarca || undefined} placeholder="Defina a marca da família" style={{ width: "100%" }} />
</Tooltip>
);
}
return (
<Select
size={size}
showSearch
allowClear
style={{ width: "100%" }}
placeholder="Selecione a marca"
value={valor ? String(valor) : undefined}
onChange={(v) => onChange(v ?? "")}
options={marcasCatalogo.map(m => ({ value: m.nome, label: m.nome }))}
optionFilterProp="label"
/>
);
};
const ehCampoMarca = (attr: any) => attr?.isMarcaSistema || attr?.id === "atributo-marca-virtual";

// Função centralizada e segura para atualizar a família selecionada
const setFamiliaSelecionada = (updater: any) => {
if (typeof setFamiliaSelecionadaLocal === 'function') {
setFamiliaSelecionadaLocal(updater);
}
if (typeof setFamiliaSelecionadaHook === 'function') {
setFamiliaSelecionadaHook(updater);
}
};

// Função para mapear campos alterados de forma legível
const calcularAlteracoesPendentes = () => {
if (!familiaOriginal || !familiaSelecionadaLocal) return [];

const alteracoes: { campo: string; antes: any; depois: any; chave: string }[] = [];

// Mapeamento de chaves técnicas para nomes amigáveis na UI
const labelsCampos: Record<string, string> = {
nome: "Nome da Família",
codigo: "Código da Família",
categoriaPai: "Categoria",
templateNomeComercial: "Template Comercial (Nome)",
templateSku: "Template de SKU",
siglaSku: "Sigla do SKU",
separadorSku: "Separador de SKU",
imagem: "Imagem da Família",
ordemSku: "Ordem de SKU",
marcaComportamento: "Comportamento da Marca",
unidadeBase: "Unidade Base",
tipoItem: "Tipo SPED",
ncmPadrao: "NCM Padrão",
cestPadrao: "CEST Padrão",
margemMinima: "Margem Mínima",
margemMaxima: "Margem Máxima",
markupPadrao: "Markup Padrão",
estoqueMinimo: "Estoque Mínimo",
loteMinimo: "Lote Mínimo",
curvaAbc: "Curva ABC",
comportamentoMarca: "Comportamento da Marca (Identidade)",
prioridadeExposicao: "Prioridade de Exposição",
};

// Compara campos diretos da família
const chavesParaComparar = Object.keys(labelsCampos);
chavesParaComparar.forEach((chave) => {
const valorOriginal = familiaOriginal[chave];
const valorAtual = chave === 'marcaComportamento' ? marcaComportamento : familiaSelecionadaLocal[chave];

if (String(valorOriginal ?? '') !== String(valorAtual ?? '')) {
// Categoria: mostra o nome, não o id
const ehCategoria = chave === 'categoriaPai';
alteracoes.push({
chave,
campo: labelsCampos[chave] || chave,
antes: (ehCategoria ? familiaOriginal.categoriaPaiNome : valorOriginal) || "(vazio)",
depois: (ehCategoria ? familiaSelecionadaLocal.categoriaPaiNome : valorAtual) || "(vazio)",
});
}
});

// Compara atributos de forma inteligente e detalhada
const attrsOriginais = familiaOriginal.atributos || [];
const attrsAtuais = familiaSelecionadaLocal.atributos || [];




// Compara se houve alteração na quantidade ou nos itens da lista
if (JSON.stringify(attrsOriginais) !== JSON.stringify(attrsAtuais)) {
const idsOriginais = attrsOriginais.map((a: any) => String(a.id));
const idsAtuais = attrsAtuais.map((a: any) => String(a.id));

// Identifica por ID ou Nome os adicionados e removidos
const adicionados = attrsAtuais.filter((a: any) => !idsOriginais.includes(String(a.id)));
const removidos = attrsOriginais.filter((a: any) => !idsAtuais.includes(String(a.id)));

// Se houve adição de novos atributos
adicionados.forEach((attr: any) => {
alteracoes.push({
chave: `atributo_adicionado_${attr.id}`,
campo: `Atributo Adicionado`,
antes: `—`,
depois: `"${attr.nome}" (${attr.classificacao || 'ficha'} - ${attr.origem || 'local'})`,
});
});

// Se houve remoção de atributos
removidos.forEach((attr: any) => {
alteracoes.push({
chave: `atributo_removido_${attr.id}`,
campo: `Atributo Removido`,
antes: `"${attr.nome}"`,
depois: `—`,
});
});

// Verifica modificações internas em atributos que já existiam em ambos
attrsAtuais.forEach((attrAtual: any) => {
const attrOriginal = attrsOriginais.find((a: any) => String(a.id) === String(attrAtual.id));

if (attrOriginal && JSON.stringify(attrOriginal) !== JSON.stringify(attrAtual)) {
// Se mudou a classificação (ex: ficha para grade)
if (attrOriginal.classificacao !== attrAtual.classificacao) {
alteracoes.push({
chave: `atributo_classificacao_${attrAtual.id}`,
campo: `Atributo: ${attrAtual.nome} (Classificação)`,
antes: attrOriginal.classificacao,
depois: attrAtual.classificacao,
});
}
// Se mudou obrigatoriedade, sufixo ou outras configs importantes
if (attrOriginal.obrigatorio !== attrAtual.obrigatorio) {
alteracoes.push({
chave: `atributo_obrigatorio_${attrAtual.id}`,
campo: `Atributo: ${attrAtual.nome} (Obrigatório)`,
antes: attrOriginal.obrigatorio ? 'Sim' : 'Não',
depois: attrAtual.obrigatorio ? 'Sim' : 'Não',
});
}
}
});
}

return alteracoes;
};

// Sempre que a família selecionada mudar de fato ou for recarregada, atualizamos a snapshot de referência original
useEffect(() => {
if (familiaSelecionadaLocal) {
const snapshot = JSON.stringify({
...familiaSelecionadaLocal,
marcaComportamento,
});
// Apenas atualiza a origem se mudou de família (ID diferente)
if (!familiaOriginal || familiaOriginal.id !== familiaSelecionadaLocal.id) {
setFamiliaOriginal(familiaSelecionadaLocal);
snapshotRef.current = snapshot;
setTemAlteracoes(false);
} else {
// Se for a mesma família, checa se houve alteração comparando com o snapshot atual
const atualString = JSON.stringify({
...familiaSelecionadaLocal,
marcaComportamento,
});
setTemAlteracoes(atualString !== snapshotRef.current);
}
} else {
setFamiliaOriginal(null);
setTemAlteracoes(false);
}
}, [familiaSelecionadaLocal, marcaComportamento]);

// Função para desfazer alterações e retornar ao estado original salvo
const handleDesfazerAlteracoes = () => {
if (familiaOriginal) {
setIsModalRevisaoOpen(true);
}
};

// Função para confirmar o reset global pelo modal
const confirmarDesfazerTudo = () => {
Swal.fire({
title: "Desfazer todas as alterações?",
text: "Todas as modificações não salvas nesta família serão descartadas.",
icon: "warning",
showCancelButton: true,
confirmButtonColor: "#d33",
cancelButtonColor: "#64748b",
confirmButtonText: "Sim, desfazer tudo!",
cancelButtonText: "Cancelar",
}).then((result) => {
if (result.isConfirmed && familiaOriginal) {
setFamiliaSelecionada(JSON.parse(JSON.stringify(familiaOriginal)));

if (familiaOriginal.marcaComportamento && typeof setMarcaComportamento === 'function') {
setMarcaComportamento(familiaOriginal.marcaComportamento);
}

snapshotRef.current = JSON.stringify({
...familiaOriginal,
marcaComportamento: familiaOriginal.marcaComportamento,
});

setTemAlteracoes(false);
setIsModalRevisaoOpen(false);

Swal.fire({
title: "Desfeito!",
text: "Família revertida para o último estado salvo.",
icon: "success",
timer: 1500,
showConfirmButton: false,
});
}
});
};

// Wrapper para salvar que envia para o banco e limpa o estado de "sujo" (temAlteracoes = false)
// Wrapper para salvar que envia para o banco e limpa o estado de "sujo" (temAlteracoes = false)
const handleSalvarFamiliaNoBanco = async () => {
if (!familiaSelecionadaLocal?.id) {
Swal.fire("Atenção", "Nenhuma família selecionada para salvar.", "warning");
return false;
}

try {
// 1. Prepara o payload completo mapeando todos os campos editáveis da família
const payloadAtualizacao = {
nome: familiaSelecionadaLocal.nome,
descricao: familiaSelecionadaLocal.descricao,
status: familiaSelecionadaLocal.status,
// 🛠️ Ajustado para garantir que a categoria seja enviada corretamente para o backend
// A família guarda a categoria em 'categoriaPai' ('' = sem categoria, o backend limpa)
categoriaPai: familiaSelecionadaLocal.categoriaPai ?? '',
idMarca: familiaSelecionadaLocal.idMarca || familiaSelecionadaLocal.id_marca,
comportamentoMarca: marcaComportamento, // Salva o comportamento atual injetado

// Dados fiscais e sped
ncmPadrao: familiaSelecionadaLocal.ncmPadrao,
cestPadrao: familiaSelecionadaLocal.cestPadrao,
tipoItem: familiaSelecionadaLocal.tipoItem,
unidadeMedidaBase: familiaSelecionadaLocal.unidadeMedidaBase,

// Parâmetros comerciais e de estoque
margemMinima: familiaSelecionadaLocal.margemMinima ?? '',
margemMaxima: familiaSelecionadaLocal.margemMaxima ?? '',
markupPadrao: familiaSelecionadaLocal.markupPadrao ?? '',
estoqueMinimo: familiaSelecionadaLocal.estoqueMinimo ?? '',
loteMinimo: familiaSelecionadaLocal.loteMinimo ?? '',
curvaAbc: familiaSelecionadaLocal.curvaAbc ?? '',
prioridadeExposicao: familiaSelecionadaLocal.prioridadeExposicao ?? '',

// Templates de SKU e Nomes
templateNomeComercial: familiaSelecionadaLocal.templateNomeComercial || familiaSelecionadaLocal.template_nome,
templateSku: familiaSelecionadaLocal.templateSku || familiaSelecionadaLocal.template_sku,
siglaSku: familiaSelecionadaLocal.siglaSku || familiaSelecionadaLocal.sigla_sku,
separadorSku: familiaSelecionadaLocal.separadorSku || familiaSelecionadaLocal.separador_sku,

// Identidade visual e extras
cor: familiaSelecionadaLocal.cor,
imagem: familiaSelecionadaLocal.imagem,

// Só os atributos PRÓPRIOS da família: os herdados da categoria continuam vindo da categoria
atributos: (familiaSelecionadaLocal.atributos || []).filter(
  (attr: any) => (attr.origem ?? 'locais') === 'locais' && !attr.isMarcaSistema
),
};

const tenantId = 1; 

// 2. Chama a API real de atualização
const resposta: any = await updateFamilia(String(familiaSelecionadaLocal.id), payloadAtualizacao, tenantId);

// O backend recalcula a saúde: ATIVA com pendência vira BLOQUEADA (e volta a ATIVA quando corrigida)
const familiaSalva = {
...familiaSelecionadaLocal,
status: resposta?.status ?? familiaSelecionadaLocal.status,
saude: resposta?.saude ?? familiaSelecionadaLocal.saude,
};
setFamiliaSelecionada(familiaSalva);

// 3. Se houver função de salvamento vinda do hook, executa também
if (typeof hookSalvarFamilia === 'function') {
await hookSalvarFamilia();
}

// 4. Atualiza o snapshot de referência original com o estado atual salvo
const novoSnapshot = JSON.stringify({
...familiaSalva,
marcaComportamento,
});

snapshotRef.current = novoSnapshot;
setFamiliaOriginal(JSON.parse(JSON.stringify(familiaSalva)));
setTemAlteracoes(false);

// 5. Feedback: bloqueio mostra o que falta corrigir
if (familiaSalva.status === "BLOQUEADO_INCONSISTENCIA") {
Swal.fire({
title: "Salva, mas BLOQUEADA",
html: `A família não atende às regras mínimas para ficar ativa:<br><br>${(familiaSalva.saude?.bloqueios || [])
.map((b: any) => `• ${b.mensagem}`).join("<br>")}`,
icon: "warning",
});
} else {
Swal.fire({
title: "Sucesso!",
text: "Família salva e sincronizada com o banco de dados.",
icon: "success",
timer: 1500,
showConfirmButton: false,
});
}
// Quem chama (editor de variações) só segue se a família foi salva
return true;

} catch (error: any) {
console.error("Erro ao salvar família no banco:", error);
Swal.fire({
title: "Erro ao salvar",
text: error.response?.data?.error || error.message || "Não foi possível persistir as alterações.",
icon: "error",
});
return false;
}
};

const dadosArvoreAntd = useMemo(() => {
return construirArvoreAntd(categorias);
}, [categorias]);

// 🛡️ Mantém os atributos puros isolados para as tabelas visuais
  const atributosPuros = useMemo(() => {
    const lista = familiaSelecionadaLocal?.atributos || [];
    return lista.filter((attr: any) => attr.codigo !== 'MARCA' && attr.nome?.toLowerCase() !== 'marca');
  }, [familiaSelecionadaLocal?.atributos]);

  // ✅ As tabelas mostram estritamente os atributos puros, sem injetar a marca visualmente
  const atributosDNA = useMemo(() => {
    return atributosPuros.filter((attr: any) => (attr.classificacao || attr.escopo_padrao) === "dna");
  }, [atributosPuros]);

  const atributosVariacao = useMemo(() => {
    return atributosPuros.filter((attr: any) => (attr.classificacao || attr.escopo_padrao) === "grade");
  }, [atributosPuros]);

  const atributosFichaTecnica = useMemo(() => {
    return atributosPuros.filter((attr: any) => (attr.classificacao || attr.escopo_padrao) === "ficha");
  }, [atributosPuros]);







// Exclui a família (o backend recusa se houver itens vinculados)
const handleExcluirFamilia = async () => {
if (!familiaSelecionadaLocal?.id) return;
const totalItens = Number(familiaSelecionadaLocal.totalItens || 0);
if (totalItens > 0) {
Swal.fire("Exclusão bloqueada", `A família possui ${totalItens} produto(s). Mova ou desagrupe os itens antes de excluir.`, "info");
return;
}
const confirmacao = await Swal.fire({
title: "Excluir família?",
html: `A família <b>"${familiaSelecionadaLocal.nome}"</b> e a configuração de atributos dela serão removidas.`,
icon: "warning",
showCancelButton: true,
confirmButtonColor: "#d33",
confirmButtonText: "Sim, excluir",
cancelButtonText: "Cancelar",
});
if (!confirmacao.isConfirmed) return;

try {
await deleteFamilia(String(familiaSelecionadaLocal.id), 1);
setFamiliaSelecionadaId(null);
setFamiliaSelecionadaLocal(null);
setFamiliaOriginal(null);
setTemAlteracoes(false);
if (typeof carregarDadosIniciais === "function") await carregarDadosIniciais();
Swal.fire({ title: "Excluída!", icon: "success", timer: 1300, showConfirmButton: false });
} catch (error: any) {
Swal.fire("Não foi possível excluir", error?.message || "Erro ao excluir a família.", "error");
}
};

// Altera a configuração de um atributo próprio da família
const alterarAtributoFamilia = (idAtributo: string | number, patch: Record<string, unknown>) => {
setFamiliaSelecionada((prev: any) => ({
...prev,
atributos: (prev.atributos || []).map((a: any) => (String(a.id) === String(idAtributo) ? { ...a, ...patch } : a)),
}));
};

// Muda o papel: grade gera variação; DNA é herdado pelos itens (valor fixo da família)
const moverAtributo = (record: any, novoPapel: string) => {
alterarAtributoFamilia(record.id, {
classificacao: novoPapel,
geraVariacao: novoPapel === "grade",
valorHerdadoDaFamilia: novoPapel === "dna",
});
};

const handleExcluirAtributo = (tipo: string, record: any) => {
// 🛡️ Verifica se existem itens na família e se algum deles possui valor preenchido para este atributo
const itensComValor = (itensDaFamilia || []).filter((item: any) => {
const valor = item.valoresAtributos?.[record.id] || item.valoresAtributos?.[record.nome];
return valor !== undefined && valor !== null && String(valor).trim() !== "";
});

// ✅ Se nenhum item possui valor, prossegue com a remoção normal da lista local
Swal.fire({
title: "Remover atributo da família?",
html: itensComValor.length > 0
? `O atributo <b>"${record.nome}"</b> tem valor em <b>${itensComValor.length}</b> item(ns).<br><br>Ao remover, os valores <b>não são apagados</b>: continuam guardados nos itens como ficha técnica.`
: `Deseja remover o atributo "${record.nome}" da família?`,
icon: "warning",
showCancelButton: true,
confirmButtonColor: "#d33",
cancelButtonColor: "#637381",
confirmButtonText: "Sim, excluir!",
cancelButtonText: "Cancelar",
}).then((result) => {
if (result.isConfirmed) {
if (typeof setFamiliaSelecionada === 'function') {
setFamiliaSelecionada((prev: any) => ({
...prev,
atributos: (prev.atributos || []).filter((a: any) => String(a.id) !== String(record.id)),
}));
}

Swal.fire({
title: "Excluído!",
text: "Atributo removido com sucesso.",
icon: "success",
timer: 1500,
showConfirmButton: false,
});
}
});
};



return (
<div
style={{
backgroundColor: "#f8fafc",
padding: "4px 6px",
fontFamily:
'-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
}}
>
{/* Header unificado estilo SaaS */}
<Card
bordered={false}
style={{
marginBottom: 6,
borderRadius: 6,
boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.05)",
}}
>
<Row align="middle" justify="space-between" gutter={[2, 2]}>
<Col span={4}>
<Space direction="vertical" >
<Tooltip
title={
<Space >
<Badge status={loading ? "processing" : "success"} />
<Text type="secondary" style={{ fontSize: "12px" }}>
{loading
? "Sincronizando com o banco..."
: temAlteracoes
? "Existem alterações pendentes não salvas"
: "Banco de dados sincronizado e pronto"}
</Text>
</Space>
}
>
<Title
level={3}
style={{ margin: 0, fontWeight: 600, letterSpacing: "-0.08em" }}
>
Gerenciamento de Família PIM
</Title>
</Tooltip>
</Space>
<Space  style={{ marginTop: 4 }}>
{/* <Tag color="processing">
Família: {familiaSelecionadaLocal?.nome || "Nenhuma"}
</Tag> */}
{temAlteracoes && (
<Tag color="warning" icon={<InfoCircleOutlined />}>
Alterações não salvas
</Tag>
)}
</Space>
</Col>

<Col span={6}>
 {/* 0. verificações */}
  {!isFamilyCompliant ? (
    <Card 
      style={{ backgroundColor: '#fff2f0', borderColor: '#ffccc7', marginBottom: 4   }}
      size='small'
      title={
        <Space>
          <ExclamationCircleOutlined style={{ color: '#ff4d4f', fontSize: 20 }} />
          <span style={{ color: '#cf1322', fontWeight: 'bold' }}>
            Família Bloqueada por Inconsistência Cadastral
          </span>
        </Space>
      }
    >
      <Paragraph>
        Esta família de itens foi temporariamente <strong>bloqueada e retirada de publicação</strong> nos canais de venda (Marketplaces e E-commerce) porque a sua estrutura atual violou as regras de governança e integridade do PIM.
      </Paragraph>
      <Divider style={{ margin: '12px 0' }} />
      <Title level={5} style={{ color: '#cf1322', marginBottom: 8 }}>
        Pendências que precisam ser resolvidas para desbloquear a família:
      </Title>
      {/* <List
        size="small"
        dataSource={complianceErrors}
        renderItem={(item) => (
          <List.Item>
            <Space>
              <Badge status="error" />
              <Text type="danger">{item}</Text>
            </Space>
          </List.Item>
        )}
      /> */}
      <div style={{ marginTop: 16 }}>
        <Text type="secondary">
          Nota arquitetural: Os atributos antigos não foram apagados; eles foram movidos automaticamente para a ficha técnica dos SKUs afetados. Reative os atributos de DNA/Grade necessários acima para restaurar o funcionamento desta família.
        </Text>
      </div>
    </Card>
  ) : (
     ''
  )}



{/* <Space size={8}>
<Button
type="primary"
ghost
onClick={() => setIsImportModalOpen(true)}
style={{ fontWeight: 600 }}
>
✨ Importar Família por IA
</Button>
</Space> */}


</Col>

<Col span={12}>

<Button
type="primary"
ghost
onClick={() => setIsImportModalOpen(true)}
style={{ fontWeight: 600 }}
>
✨ Importar Família por IA
</Button> 
<Button
type="default"
onClick={handleCriarFamilia}
loading={loading}
icon={<PlusOutlined />}
style={{ borderRadius: 8, fontWeight: 500 }}
>
Nova Família
</Button>

{familiaSelecionadaLocal && (
<>
{/* Botão de debug: escondido; troque MOSTRAR_DEBUG_PAYLOAD para true ao depurar */}
{MOSTRAR_DEBUG_PAYLOAD && (
<Button
type="dashed"
icon={<InfoCircleOutlined />}
onClick={() => {
const payloadDebug = {
original: familiaOriginal,
atualLocal: familiaSelecionadaLocal,
marcaComportamentoAtual: marcaComportamento,
alteracoesCalculadas: calcularAlteracoesPendentes(),
snapshotRef: snapshotRef.current ? JSON.parse(snapshotRef.current) : null
};
console.table(calcularAlteracoesPendentes());
console.log("📦 PAYLOAD DEBUG COMPLETO:", payloadDebug);

Swal.fire({
title: "🔍 Debug de Payload",
html: `<pre style="text-align: left; font-size: 10px; max-height: 300px; overflow: auto; background: #1e293b; color: #38bdf8; padding: 10px; border-radius: 6px;">${JSON.stringify(payloadDebug, null, 2)}</pre>`,
width: 700,
confirmButtonText: "Fechar"
});
}}
style={{ borderRadius: 8, fontWeight: 500 }}
>
Debug Payload
</Button>
)}

<Tooltip
title={Number(familiaSelecionadaLocal?.totalItens || 0) > 0
? `A família tem ${familiaSelecionadaLocal?.totalItens} produto(s): mova-os antes de excluir`
: "Excluir esta família"}
>
<Button
danger
disabled={!familiaSelecionadaLocal?.id || Number(familiaSelecionadaLocal?.totalItens || 0) > 0}
icon={<DeleteOutlined />}
onClick={handleExcluirFamilia}
style={{ borderRadius: 8, fontWeight: 500 }}
>
Excluir Família
</Button>
</Tooltip>

<Tooltip title="Desfaz as alterações feitas e retorna ao último estado salvo no banco">
<Button
type="default"
disabled={!temAlteracoes}
icon={<UndoOutlined />}
onClick={handleDesfazerAlteracoes}
style={{ borderRadius: 8, fontWeight: 500 }}
>
Desfazer Alterações
</Button>
</Tooltip>

<Tooltip title={temAlteracoes ? "Clique para salvar as alterações pendentes" : "Nenhuma alteração pendente para salvar"}>
<Button
type="primary"
disabled={!temAlteracoes}
onClick={handleSalvarFamiliaNoBanco}
loading={loading}
icon={<SaveOutlined />}
style={{
backgroundColor: temAlteracoes ? brandColor : undefined,
borderColor: temAlteracoes ? brandColor : undefined,
borderRadius: 8,
fontWeight: 500,
}}
>
Salvar Alterações
</Button>
</Tooltip>
</>
)}
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

<Row gutter={[8, 8]}>

      <Col xs={24} md={4} lg={6}>

  
{/* Coluna 1: Famílias Ativas */}
<ListaFamiliasAtivas
brandColor={brandColor}
categoriaFiltroId={categoriaFiltroId}
setCategoriaFiltroId={setCategoriaFiltroId}
dadosArvoreAntd={dadosArvoreAntd}
pesquisaFamilia={pesquisaFamilia}
setPesquisaFamilia={setPesquisaFamilia}
familiasFiltradas={familiasFiltradas}
familiasAgrupadas={familiasAgrupadas}
grupoSelecionado={familiaSelecionadaLocal}
temAlteracoes={temAlteracoes}
handleSelecionarGrupo={handleSelecionarFamilia}
handleCriarGrupo={handleCriarFamilia}
/>

</Col>


{/* Coluna 2: Configuração Central */}
<Col xs={24} md={18} lg={12}>
{familiaSelecionadaLocal ? (
<Space direction="vertical" style={{ width: "100%" }}>
<Row gutter={[4, 4]}>

 
{/* 0. Papel da marca na família + guia de regras */}
<Col xs={24} lg={24}>

<Card size="small" style={{ borderRadius: 10, border: "1px solid #e2e8f0" }} styles={{ body: { padding: "8px 12px" } }}>
<div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
<Space size={6}>
<Text strong style={{ fontSize: 12 }}>Marca nesta família:</Text>
<Tooltip title="DNA: a marca identifica a família (todos os itens têm a mesma). Grade: a marca diferencia os itens (ex.: Ebara x Schneider). Ficha: só informação.">
<InfoCircleOutlined style={{ fontSize: 12, color: "#64748b" }} />
</Tooltip>
</Space>
<Radio.Group
buttonStyle="solid"
size="small"
value={marcaComportamento}
onChange={(e) => setMarcaComportamento(e.target.value)}
>
<Radio.Button value="dna"><TagOutlined /> DNA</Radio.Button>
<Radio.Button value="grade"><AppstoreOutlined /> Grade (SKU)</Radio.Button>
<Radio.Button value="ficha"><FileTextOutlined /> Ficha</Radio.Button>
</Radio.Group>
<Select
size="small"
showSearch
allowClear
style={{ width: 200 }}
placeholder={marcaComportamento === "dna" ? "Marca (obrigatória)" : "Marca da família (opcional)"}
status={marcaComportamento === "dna" && !familiaSelecionadaLocal?.nomeMarca ? "error" : undefined}
value={familiaSelecionadaLocal?.idMarca && familiaSelecionadaLocal?.nomeMarca ? String(familiaSelecionadaLocal.idMarca) : undefined}
onChange={(v) => {
const marca = marcasCatalogo.find(m => m.id === v);
// Sem marca = "Sem Marca" (id 1, padrão do banco)
setFamiliaSelecionada((prev: any) => ({ ...prev, idMarca: marca ? marca.id : "1", nomeMarca: marca ? marca.nome : "" }));
}}
options={marcasCatalogo.map(m => ({ value: m.id, label: m.nome }))}
optionFilterProp="label"
/>
<Text type="secondary" style={{ fontSize: 11, flex: 1, minWidth: 200 }}>
{marcaComportamento === "dna" && "Todos os itens recebem a marca da família."}
{marcaComportamento === "grade" && "Cada item tem a sua marca; use {MARCA} no template do código."}
{marcaComportamento === "ficha" && "Cada item pode ter a sua marca; a da família vale quando o item não tiver."}
</Text>
<Button size="small" icon={<ReadOutlined />} onClick={() => setIsGuiaOpen(true)}>
Guia de Regras
</Button>
</div>
</Card>
</Col>

{/* 1. Identidade da Família */}
<Col xs={24} lg={24}>
<FamiliaIdentidadeCard 
grupoSelecionado={familiaSelecionadaLocal}
grupoImage={grupoImage}
brandColor={brandColor}
arvoreCategorias={dadosArvoreAntd}
onMudarCategoria={catalogState.handleMudarCategoriaComConfirmacao}
onSalvarIdentidade={(valores) => {
// Usa a função dedicada ou garante que os atributos atuais não sejam perdidos
if (typeof handleAtualizarIdentidadeFamilia === 'function') {
handleAtualizarIdentidadeFamilia(valores);
} else if (typeof setFamiliaSelecionada === 'function') {
setFamiliaSelecionada((prev: any) => ({ 
...prev, 
...valores,
atributos: prev.atributos || [] // 🛡️ Protege os atributos contra sumiço
}));
}
}}
/>
</Col>




{/* 2. Painel do Simulador Unificado */}
<Col xs={24} lg={24}>
<PainelSimulador
familiaSelecionada={familiaSelecionadaLocal}
valoresTeste={valoresTeste}
onMudancaValorTeste={onMudancaValorTeste}
onAtualizarTemplateComercial={onAtualizarTemplateComercial}
onAtualizarTemplateSku={onAtualizarTemplateSku}
onAtualizarSiglaSku={onAtualizarSiglaSku}
onAtualizarSeparadorSku={onAtualizarSeparadorSku}
onAtualizarOrdemSku={onAtualizarOrdemSku}
previewNomeSimulado={previewNomeSimulado}
previewSkuSimulado={previewSkuSimulado}
brandColor={brandColor} 
itensDaFamilia={itensDaFamilia}
carregandoItens={carregandoItens}
temAlteracoes={temAlteracoes}
onSalvarFamilia={handleSalvarFamiliaNoBanco}
onVariacoesGravadas={catalogState.recarregarItensDaFamilia}
/>

 


</Col>
</Row>

<Row gutter={[8, 8]} align="stretch">





{/* Tabelas de Atributos */}



<Col span={10}>

<AtributosCard
titulo="Atributos DNA"
papel="dna"
cor={brandColor || "#1677ff"}
dataSource={atributosDNA}
onOpenModal={() => handleAbrirModal("dna")}
onDelete={(record) => handleExcluirAtributo("dna", record)}
onMover={moverAtributo}
onAlterar={(record, patch) => alterarAtributoFamilia(record.id, patch)}
tooltipText="DNA: igual em todos os itens da família (ex: Material = NBR). O valor fixo é definido aqui. Clique para ver o guia."
onInfoClick={() => handleOpenGuideModal("dna")}
emptyText="Nenhum atributo DNA"
showDelete={true}
/>

</Col>


<Col span={7}>

{/* Atributos Variação (Grade) */}
<AtributosCard
titulo="Atributos de Variação (Grade)"
papel="grade"
cor="#9333ea"
dataSource={atributosVariacao}
onOpenModal={() => handleAbrirModal("grade")}
onDelete={(record) => handleExcluirAtributo("grade", record)}
onMover={moverAtributo}
onAlterar={(record, patch) => alterarAtributoFamilia(record.id, patch)}
tooltipText="Atributos que geram quebra de estoque e variações de SKU (ex: Blindagem, Marca em Grade). Clique para ver o guia."
onInfoClick={() => handleOpenGuideModal("grade")}
emptyText="Nenhum atributo de variação"
showDelete={true}
/>

</Col>
<Col span={7}>

{/* Atributos Ficha Técnica */}
<AtributosCard
titulo="Atributos de Ficha Técnica"
papel="ficha"
cor="#0891b2"
dataSource={atributosFichaTecnica}
onOpenModal={() => handleAbrirModal("ficha")}
onDelete={(record) => handleExcluirAtributo("ficha", record)}
onMover={moverAtributo}
onAlterar={(record, patch) => alterarAtributoFamilia(record.id, patch)}
tooltipText="Atributos descritivos de apoio que não alteram o SKU principal. Clique para ver o guia."
onInfoClick={() => handleOpenGuideModal("ficha")}
emptyText="Nenhum atributo de ficha técnica"
showDelete={true}
/>
</Col>



</Row>
</Space>
) : (
<Card
style={{
borderRadius: 10,
textAlign: "center",
padding: "60px 0",
border: "1px dashed #cbd5e1",
background: "#fafafa",
}}
>
<Empty
description={
<span style={{ color: "#64748b", fontSize: "12px" }}>
Selecione ou crie uma família na barra lateral para começar a configurar.
</span>
}
/>
</Card>
)}
</Col>

    <Col xs={24} md={18} lg={6}>


     <Card 
  title="Diagnóstico de Conformidade e Regras de Bloqueio da Família" 
  bordered={false} 
  style={{ marginBottom: 24 }}
>
  {(() => {
const saude = familiaSelecionadaLocal?.saude;
const status = familiaSelecionadaLocal?.status as keyof typeof STATUS_FAMILIA_CONFIG | undefined;
const cfg = status ? STATUS_FAMILIA_CONFIG[status] : undefined;
return (
<Space direction="vertical" size={8} style={{ width: "100%" }}>
<Space>
<Text strong>Status:</Text>
<Tag color={cfg?.color}>{cfg?.label || status || "—"}</Tag>
{temAlteracoes && <Text type="secondary" style={{ fontSize: 11 }}>(recalculado ao salvar)</Text>}
</Space>
{!saude ? (
<Text type="secondary">Salve a família para calcular o diagnóstico.</Text>
) : saude.bloqueios.length === 0 && saude.avisos.length === 0 ? (
<Alert type="success" showIcon message="A família atende a todas as regras mínimas." />
) : (
<>
{saude.bloqueios.map((b: any) => (
<Alert key={b.codigo} type="error" showIcon message={b.mensagem} />
))}
{saude.avisos.map((a: any) => (
<Alert key={a.codigo} type="warning" showIcon message={a.mensagem} />
))}
</>
)}
<Text type="secondary" style={{ fontSize: 11 }}>
Regras: ao menos um atributo de grade (ou marca como grade); DNA com valor fixo; marca definida se ela é DNA; template só com atributos da família; sigla definida se o template usa {"{SIGLA}"}.
</Text>
</Space>
);
})()}
</Card>


{/* Coluna 3: Itens da Família */}
<ItensFamiliaCard
brandColor={brandColor}
grupoSelecionado={familiaSelecionadaLocal}
pesquisaItem={pesquisaItem}
setPesquisaItem={setPesquisaItem}
itensFiltradosDoGrupo={itensFiltradosDaFamilia}
temAlteracoes={temAlteracoes}
gerarPreviewSku={gerarPreviewSku}
gerarPreviewNome={gerarPreviewNome}
handleEditarAtributosItem={handleEditarAtributosItem}
handleNormalizarItemNome={handleNormalizarItemNome}
handleNormalizarItemSku={handleNormalizarItemSku}
handleTentarNormalizarIndividual={handleTentarNormalizarIndividual}
handleProcessarFormalizacaoLote={handleProcessarFormalizacaoLote}
handlePadronizarNomesFamilia={handlePadronizarNomesFamilia}
handlePadronizarSkusFamilia={handlePadronizarSkusFamilia}
onItensAlterados={catalogState.recarregarItensDaFamilia}
/>

</Col>

</Row>

{/* Modais auxiliares */}
<ImportarFamiliaModal
visible={isImportModalOpen}
onClose={() => setIsImportModalOpen(false)}
onImportarSucesso={handleNovaFamiliaImportada}
/>

<Modal
title="⚠️ Atributos Pendentes para Normalização"
open={isModalPendenciaOpen}
onCancel={() => setIsModalPendenciaOpen(false)}
onOk={() => {
formPendencia.validateFields().then((values) => {
handleSalvarAtributosPendentes(values);
Swal.fire("Sucesso!", "Atributos preenchidos e item normalizado.", "success");
});
}}
okText="Salvar e Normalizar"
cancelText="Cancelar"
>
<Alert
message="Atenção"
description="Existem atributos obrigatórios utilizados no template de SKU ou Nome que estão sem valor para este item. Preencha-os abaixo para prosseguir:"
type="warning"
showIcon
style={{ marginBottom: 16 }}
/>

<Form form={formPendencia} layout="vertical">
{(atributosPendentes ?? []).map((attr) => (
<Form.Item
key={attr.id}
name={attr.id}
label={attr.nome || attr.label}
rules={[{ required: !(ehCampoMarca(attr) && marcaComportamento === "dna"), message: `O campo ${attr.nome || attr.label} é obrigatório!` }]}
initialValue={itemEmEdicaoPendencia?.valoresAtributos?.[attr.id] || undefined}
>
{ehCampoMarca(attr)
? renderCampoMarcaItem(undefined, () => undefined)
: <Input placeholder={`Digite o valor para ${attr.nome || attr.label}...`} />}
</Form.Item>
))}
</Form>
</Modal>

<Modal
title={`Editar atributos: ${itemEmEdicaoAtributos?.sku || "item"}`}
open={isModalAtributosItemOpen}
onCancel={() => setIsModalAtributosItemOpen(false)}
onOk={handleSalvarAtributosItem}
okText="Salvar atributos"
cancelText="Cancelar"
destroyOnClose
>
<Alert
type="info"
showIcon
message="Alteração individual"
description="Os valores serão aplicados somente ao item selecionado. O SKU e o nome serão recalculados após o salvamento."
style={{ marginBottom: 16 }}
/>
<Form layout="vertical">
{(atributosComMarcaInjetada?.length > 0 ? atributosComMarcaInjetada : familiaSelecionadaLocal?.atributos || []).map((attr: any) => (
<Form.Item key={attr.id} label={attr.nome}>
{ehCampoMarca(attr)
? renderCampoMarcaItem(itemEmEdicaoAtributos?.valoresAtributos?.[attr.id], (v) => handleAtualizarAtributoItemEditado(attr.id, v))
: (
<Input
value={String(itemEmEdicaoAtributos?.valoresAtributos?.[attr.id] ?? "")}
placeholder={`Informe ${attr.nome}`}
onChange={(event) => handleAtualizarAtributoItemEditado(attr.id, event.target.value)}
/>
)}
</Form.Item>
))}
</Form>
</Modal>

<Modal
title={
<Space>
<ThunderboltOutlined style={{ color: brandColor || "#1677ff" }} />
<span>Formalização de Itens - Atributos Pendentes</span>
</Space>
}
open={modalFormalizacaoAberto}
onCancel={() => setModalFormalizacaoAberto(false)}
onOk={handleSalvarEContinuarFormalizacao}
okText="Salvar e Concluir Lote"
cancelText="Cancelar"
width={650}
destroyOnClose
>
<div style={{ marginBottom: "12px", fontSize: "13px", color: "#64748b" }}>
Identificamos itens na família <strong>{familiaSelecionadaLocal?.nome}</strong> que possuem atributos obrigatórios não preenchidos. Por favor, ajuste abaixo para concluir a formalização:
</div>

<div style={{ maxHeight: "400px", overflowY: "auto", paddingRight: "4px" }}>
<Space direction="vertical" size={12} style={{ width: "100%" }}>
{(itensPendentesFormalizacao || []).map((item, index) => (
<div
key={item.id || index}
style={{
padding: "12px",
backgroundColor: "#f8fafc",
borderRadius: "8px",
border: "1px solid #e2e8f0",
display: "flex",
flexDirection: "column",
gap: "8px",
}}
>
<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
<span style={{ fontWeight: 700, fontSize: "12px", color: "#0f172a", fontFamily: "monospace" }}>
SKU: {item.sku || `Item #${index + 1}`}
</span>
<span style={{ fontSize: "11px", color: "#ef4444", fontWeight: 600 }}>
Atributos incompletos
</span>
</div>

<span style={{ fontSize: "11.5px", color: "#334155", fontWeight: 500 }}>
{item.nome}
</span>

<div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "8px", marginTop: "4px" }}>
{(atributosComMarcaInjetada?.length > 0 ? atributosComMarcaInjetada : familiaSelecionadaLocal?.atributos || []).map((attr: any) => {
const valorAtual = item.valoresAtributos?.[attr.id || attr.nome] || "";
return (
<div key={attr.id || attr.nome} style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
<label style={{ fontSize: "10.5px", fontWeight: 600, color: "#475569" }}>
{attr.nome}:
</label>
{ehCampoMarca(attr)
? renderCampoMarcaItem(valorAtual, (v) => handleAtualizarAtributoItemPendente(item.id, attr.id, v), "small")
: (
<Input
size="small"
placeholder={`Preencher ${attr.nome}`}
defaultValue={valorAtual}
onChange={(e) => {
handleAtualizarAtributoItemPendente(item.id, attr.id || attr.nome, e.target.value);
}}
/>
)}
</div>
);
})}
</div>
</div>
))}
</Space>
</div>
</Modal>

<AttributeGuideModal
visible={isModalOpen}
onClose={handleCloseGuideModal}
defaultTab={guideTab}
/>

<ModalVinculoAtributos
isModalAberto={isModalAberto}
setIsModalAberto={setIsModalAberto}
destinoModal={tabelaAlvoModal || "ficha"}
atributosGlobaisDisponiveis={atributosGlobaisDisponiveis}
handleAdicionarAtributoAoGrupo={handleAdicionarAtributoÀFamilia}
brandColor={brandColor}
/>

<Modal
title={
<Space>
<ReadOutlined style={{ color: brandColor || "#1677ff" }} />
<span>Guia de Referência: O que a Família Herda, Exige e Controla</span>
</Space>
}
open={isGuiaOpen}
onCancel={() => setIsGuiaOpen(false)}
footer={<Button type="primary" onClick={() => setIsGuiaOpen(false)}>Fechar</Button>}
width={760}
>
  <Card bordered={false} style={{ marginBottom: 0 }} styles={{ body: { padding: 0 } }}>
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <div>
        <Text strong style={{ color: '#1890ff', fontSize: 16 }}>1. O que a Família HERDA da Categoria / Subcategoria Pai</Text>
        <List
          size="small"
          dataSource={[
            "Quais atributos de DNA existem (ex: Material, Série, Norma). A família fixa o valor (ex: Retentores NBR → Material = NBR).",
            "Atributos Globais de Negócio: Regras macro de conformidade, exigências fiscais básicas e restrições do segmento industrial."
          ]}
          renderItem={(item) => (
            <List.Item style={{ border: 'none', padding: '4px 0' }}>
              <Space>
                <Badge status="processing" />
                <Text>{item}</Text>
              </Space>
            </List.Item>
          )}
        />
      </div>

      <Divider style={{ margin: '4px 0' }} />

      <div>
        <Text strong style={{ color: '#fa8c16', fontSize: 16 }}>2. O que a Família EXIGE Obrigatoriamente dos SKUs Filhos (O Escopo Rígido)</Text>
        <List
          size="small"
          dataSource={[
            "Atributos de Grade / Variação: Eixos comerciais obrigatórios para gerar os filhos (ex: Medidas dimensionais, Diâmetros, Bitolas, Voltagem).",
            "Atributos de Ficha Técnica Críticos: Especificações que nenhum SKU pode nascer sem preencher (ex: Blindagem, Folga Radial, Pressão Máxima, Norma).",
            "Atributos de Identificação Comercial: Marca, Part Number / Código do Fabricante e Unidade de Medida."
          ]}
          renderItem={(item) => (
            <List.Item style={{ border: 'none', padding: '4px 0' }}>
              <Space>
                <Badge status="warning" />
                <Text>{item}</Text>
              </Space>
            </List.Item>
          )}
        />
      </div>

      <Divider style={{ margin: '4px 0' }} />

      <div>
        <Text strong style={{ color: '#52c41a', fontSize: 16 }}>3. Comportamento e Regras de Propagação</Text>
        <List
          size="small"
          dataSource={[
            "Herança Automática: Tudo o que é definido na Família desce em cascata para os SKUs filhos instantaneamente.",
            "Fallback de Segurança (Despromoção): Se um atributo deixa de ser obrigatório na Família, o valor preenchido nos filhos não é apagado; ele migra automaticamente para a Ficha Técnica estática do SKU.",
            "Bloqueio de Publicação: SKUs criados sem os atributos obrigatórios exigidos pela família ficam impedidos de ser exportados para os Marketplaces e E-commerce."
          ]}
          renderItem={(item) => (
            <List.Item style={{ border: 'none', padding: '4px 0' }}>
              <Space>
                <Badge status="success" />
                <Text>{item}</Text>
              </Space>
            </List.Item>
          )}
        />
      </div>
    </Space>
  </Card>
</Modal>

{/* 🔍 MODAL DE REVISÃO E DESFAZIMENTO DE ALTERAÇÕES */}
<Modal
title={
<Space>
<UndoOutlined style={{ color: brandColor || "#1677ff" }} />
<span>Revisão de Alterações Pendentes</span>
</Space>
}
open={isModalRevisaoOpen}
onCancel={() => setIsModalRevisaoOpen(false)}
width={750}
footer={[
<Button key="fechar" onClick={() => setIsModalRevisaoOpen(false)}>
Continuar Editando
</Button>,
<Button
key="desfazer"
danger
type="primary"
icon={<UndoOutlined />}
onClick={confirmarDesfazerTudo}
>
Desfazer Todas as Alterações
</Button>,
]}
>
<Alert
message="Auditoria de Modificações Locais"
description="Abaixo estão listados todos os campos que foram modificados e ainda não foram salvos no banco de dados."
type="info"
showIcon
style={{ marginBottom: 16 }}
/>

<Table
dataSource={calcularAlteracoesPendentes()}
rowKey="chave"
pagination={false}
size="small"
columns={[
{
title: "Campo Modificado",
dataIndex: "campo",
key: "campo",
render: (text) => <Text strong style={{ color: "#1e293b" }}>{text}</Text>,
},
{
title: "Valor Original (Salvo)",
dataIndex: "antes",
key: "antes",
render: (val) => <Tag color="default">{String(val)}</Tag>,
},
{
title: "Valor Atual (Pendente)",
dataIndex: "depois",
key: "depois",
render: (val, record) => {
if (record.chave === 'imagem' && val && val !== "(vazio)") {
return <img src={val} alt="Preview" style={{ width: 32, height: 32, objectFit: 'cover', borderRadius: 4 }} />;
}
return <Tag color="warning">{String(val)}</Tag>;
},
},
{
title: "Ação",
key: "acao",
align: "center" as const,
width: 100,
render: (_, record) => (
<Button
type="link"
size="small"
danger
icon={<UndoOutlined />}
onClick={() => {
if (record.chave === 'marcaComportamento') {
if (typeof setMarcaComportamento === 'function') {
setMarcaComportamento(familiaOriginal.marcaComportamento);
}
} else {
if (typeof setFamiliaSelecionada === 'function') {
setFamiliaSelecionada((prev: any) => ({
...prev,
[record.chave]: familiaOriginal[record.chave],
}));
} else {
console.error("A função setFamiliaSelecionada não está disponível no escopo.");
}
}

Swal.fire({
title: "Campo Revertido",
text: `O campo "${record.campo}" voltou ao original.`,
icon: "success",
timer: 1200,
showConfirmButton: false,
});
}}
>
Reverter
</Button>
),
},
]}
locale={{
emptyText: <Empty description="Nenhuma alteração pendente" />,
}}
/>
</Modal>


</div>
);
};