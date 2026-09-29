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
Table,
Space,
Spin,
Card,
Tag,
message,
Modal,
Tooltip,
Badge
} from 'antd';
import {
PlusOutlined,
DeleteOutlined,
SaveOutlined,
DeploymentUnitOutlined,
CloseOutlined,
ThunderboltOutlined,
InfoCircleOutlined,
LockOutlined,
UnlockOutlined,
FileTextOutlined,
SafetyCertificateOutlined,
EditOutlined,
EyeOutlined
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
import { TabelaDnaProduto } from './TabelaDnaProduto';

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

const handleMudarEscopoAtributo = (atributoId: string, novoEscopo: string) => {
setCategorias(prev => prev.map(c => {
if (c.id !== categoriaSelecionadaId) return c;

const listaAtual = c.atributosHeranca || [];
const existeLocal = listaAtual.some(a => a.id === atributoId);

// Se o atributo já existir na categoria local, atualizamos o escopo e garantimos o 'sobrescreve'
if (existeLocal) {
return {
...c,
atributosHeranca: listaAtual.map(attr =>
attr.id === atributoId
? { ...attr, escopoComercial: novoEscopo as any, sobrescreve: true }
: attr
)
};
}

// Se o atributo for herdado do pai (ainda não existe no estado local da subcategoria),
// criamos uma "camada de sobrescrita" local para ele.
const novoVinculoCustomizado: AtributoHerdavel = {
id: atributoId,
nome: '', // O nome visual vem do mapeamento "obterAtributosTudo"
tipoDado: 'texto',
escopoComercial: novoEscopo as any,
pesquisavel: true,
obrigatorio: false,
herdar: true,
sobrescreve: true, // Garante que não siga mais a regra do pai
ordem: listaAtual.length + 1,
};

return { ...c, atributosHeranca: [...listaAtual, novoVinculoCustomizado] };
}));
};

const handleAtualizarSufixoAtributo = (atributoId: string, valor: string) => {
handleAtualizarAtributoHerdado(atributoId, 'sufixo', valor);
};

const handleToggleTravarSufixo = (atributoId: string) => {
setCategorias(prev => prev.map(c => {
if (c.id !== categoriaSelecionadaId) return c;
return {
...c,
atributosHeranca: (c.atributosHeranca || []).map(attr =>
attr.id === atributoId
? { ...attr, sufixoTravadoCategoria: !attr.sufixoTravadoCategoria }
: attr
)
};
}));
};

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
// 👇 Adicione aqui:
handleMudarEscopoAtributo,
handleAtualizarSufixoAtributo,
handleToggleTravarSufixo
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
title: 'Tipo de Dado',
dataIndex: 'tipoDado',
key: 'tipoDado',
render: (tipoDado: string) => (
<Select size='small' value={tipoDado} disabled style={{ width: '100%' }}>
<Select.Option value="texto">Texto Livre</Select.Option>
<Select.Option value="numero">Numérico</Select.Option>
<Select.Option value="decimal">Decimal</Select.Option>
<Select.Option value="boolean">Booleano</Select.Option>
<Select.Option value="lista">Lista (Dropdown)</Select.Option>
</Select>
)
},
];


return (
<Layout style={{ minHeight: '100vh', background: '#f8fafc' }}>

{/* LATERAL ESQUERDA: ÁRVORE TAXONOMIA */}
<Sider
width={300}
theme="light"
style={{
padding: '16px 12px',
borderRight: '1px solid #e2e8f0',
background: '#ffffff',
boxShadow: '1px 0 3px rgba(0, 0, 0, 0.02)'
}}
>
<Space direction="vertical" style={{ width: '100%' }} size={12}>
<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
<span style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
🌿 Matriz de Taxonomia
</span>
<Badge count={state.categorias?.length || 0} style={{ backgroundColor: '#0284c7' }} />
</div>

<Button
type="primary"
block
icon={<PlusOutlined />}
onClick={state.handleAdicionarCategoriaNova}
style={{ backgroundColor: '#0f766e', borderColor: '#0f766e', fontWeight: 600, height: '36px' }}
>
Nova Categoria
</Button>

<div style={{
border: '1px solid #f1f5f9',
borderRadius: '8px',
padding: '8px',
maxHeight: 'calc(100vh - 140px)',
overflowY: 'auto',
background: '#fafafa'
}}>
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
<Content style={{ padding: '8px', flex: 1, overflowY: 'auto', maxWidth: 'calc(100vw - 640px)' }}>
{state.categoriaSelecionada ? (
<Space direction="vertical" style={{ width: '100%' }} size={6}>

{/* HEADER EXECUTIVO DA CATEGORIA SELECIONADA */}
<Card
size="small"
style={{ background: '#ffffff', borderRadius: '6px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}
>
<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
<div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
<div style={{ padding: '10px', background: '#f0fdf4', borderRadius: '8px', color: '#166534', border: '1px solid #bbf7d0' }}>
<DeploymentUnitOutlined style={{ fontSize: '20px' }} />
</div>
<div>
<h2 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>
{state.categoriaSelecionada.nome || 'Categoria sem Nome'}
</h2>
<span style={{ fontSize: '12px', color: '#64748b', fontFamily: 'monospace' }}>
Slug: /{state.categoriaSelecionada.slug || 'pendente'}
</span>
</div>
</div>

<Space size="middle">
<Tag color={state.categoriaSelecionada.ativa ? 'success' : 'error'} style={{ padding: '4px 10px', fontWeight: 600, borderRadius: '12px' }}>
{state.categoriaSelecionada.ativa ? '🟢 CATEGORIA ATIVA' : '🔴 CATEGORIA INATIVA'}
</Tag>
</Space>

<Row gutter={[16, 8]} orientation={'vertical'} style={{ background: '#f8fafc', padding: '5px 6px', borderRadius: '6px', border: '1px solid #f1f5f9' }}>



</Row>
{/* BLOCO DIREITO: BOTÃO DE EDITAR (ABRE O MODAL) */}

<Col xs={24} sm={12} md={8}>
<span style={{ fontSize: '11px', color: '#64748b', display: 'block', fontWeight: 600 }}>NÍVEL / CATEGORIA PAI</span>
<span style={{ fontSize: '12px', color: '#0f172a', fontWeight: 500 }}>
{state.categoriaSelecionada.parentId
? (state.categorias.find(c => c.id === state.categoriaSelecionada.parentId)?.nome || 'Subcategoria')
: 'Root / Raiz 🌍'}
</span>
</Col>
<Button
type="primary"
ghost
icon={<EditOutlined />}
onClick={() => state.handleAbrirModalEdicao?.()} // Ajuste para a função que abre o seu modal
style={{ fontWeight: 600, borderColor: '#0284c7', color: '#0284c7' }}
>
Editar Categoria
</Button>
<Col xs={24} md={24} style={{ marginTop: 4 }}>
{/* <span style={{ fontSize: '11px', color: '#64748b', display: 'block', fontWeight: 600 }}>DESCRIÇÃO DE ESCOPO TÉCNICO</span> */}
<span style={{ fontSize: '12px', color: '#334155', fontStyle: state.categoriaSelecionada.descricao ? 'normal' : 'italic' }}>
{state.categoriaSelecionada.descricao || 'Nenhuma descrição técnica informada para esta categoria.'}
</span>
</Col>
<Col xs={24} sm={12} md={8}>

</Col>

</div>

</Card>

{/* CONTAINER PRINCIPAL DE ABAS */}
<Collapse
activeKey={abasAbertas}
onChange={(keys) => setAbasAbertas(keys as string[])}
expandIconPosition="end"
style={{ background: 'transparent', border: 'none' }}
items={[


{
key: 'atributos',
style: { background: '#ffffff', borderRadius: '8px', marginBottom: 2, border: '1px solid #e2e8f0' },

label: (
<div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
<Card size="small" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px' }}>
<div style={{ display: 'flex', gap: 4, alignItems: 'flex-start' }}>
<InfoCircleOutlined style={{ fontSize: '16px', color: '#166534', marginTop: 2 }} />
<div>
<span style={{ fontWeight: 700, color: '#14532d', fontSize: '12px' }}>Governança de Taxonomia e Sufixos PIM</span>
<p style={{ margin: '4px 0 0 0', fontSize: '11px', color: '#166534', lineHeight: 1.5 }}>
Atributos dividem-se em <strong>DNA</strong> (obrigatório), <strong>Grade</strong> (variantes) e <strong>Ficha Técnica</strong>. O travamento de sufixo na categoria impede alterações unilaterais nas filhas.
</p>
</div>
</div>
</Card>
<div onClick={e => e.stopPropagation()}>
<Space size="small" wrap orientation='vertical'>
<Select
size="small"
style={{ width: '100%' }}
placeholder="Incluir Grupo..."
showSearch
optionFilterProp="children"
value={state.grupoSelecionadoLote || undefined}
onChange={(grupoId) => state.handleAssociarGrupoEmLote(grupoId)}
allowClear
>
{state.gruposDisponiveis?.map((g) => (
<Select.Option key={g.id} value={g.id}>{g.nome}</Select.Option>
))}
</Select>
<Space size="small" wrap orientation='horizontal'>

<Button
size="small"
type={state.mostrarCriarRapido ? 'primary' : 'dashed'}
danger={!state.mostrarCriarRapido}
icon={<ThunderboltOutlined />}
onClick={() => state.setMostrarCriarRapido(!state.mostrarCriarRapido)}
>
{state.mostrarCriarRapido ? 'Fechar' : 'Criar Inline'}
</Button>
<Button
size="small"
type="primary"
ghost
icon={<PlusOutlined />}
onClick={state.handleAdicionarAtributo}
>
Selecionar
</Button>
</Space>
</Space>
</div>
</div>
),
children: (
<Space direction="vertical" style={{ width: '100%' }} size={16}>


{/* FORMULÁRIO EXPRESS */}
{state.mostrarCriarRapido && (
<Card size="small" title={<span style={{ fontSize: '12px', fontWeight: 600, color: '#db2777' }}>✨ Cadastro Rápido de Atributo Global</span>} style={{ background: '#fff1f2', borderColor: '#fecdd3', borderRadius: '8px' }}>
<Row gutter={[12, 12]} align="bottom">
<Col xs={24} sm={12} md={6}>
<label style={{ fontSize: '11px', fontWeight: 600, display: 'block', marginBottom: 4, color: '#475569' }}>Nome Global</label>
<Input size="small" placeholder="Ex: Espessura" value={state.novoAttrRapido.nome} onChange={e => state.setNovoAttrRapido(p => ({ ...p, nome: e.target.value }))} />
</Col>
<Col xs={12} sm={6} md={4}>
<label style={{ fontSize: '11px', fontWeight: 600, display: 'block', marginBottom: 4, color: '#475569' }}>Tipo</label>
<Select size="small" style={{ width: '100%' }} value={state.novoAttrRapido.tipo} onChange={val => state.setNovoAttrRapido(p => ({ ...p, tipo: val }))}>
<Select.Option value="texto">Texto</Select.Option>
<Select.Option value="numero">Número</Select.Option>
<Select.Option value="decimal">Decimal</Select.Option>
</Select>
</Col>
<Col xs={12} sm={6} md={5}>
<label style={{ fontSize: '11px', fontWeight: 600, display: 'block', marginBottom: 4, color: '#475569' }}>Grupo</label>
<Select size="small" style={{ width: '100%' }} placeholder="Grupo" value={state.novoAttrRapido.grupo_id} onChange={val => state.setNovoAttrRapido(p => ({ ...p, grupo_id: val }))}>
{state.gruposDisponiveis.map(g => <Select.Option key={g.id} value={g.id}>{g.nome}</Select.Option>)}
</Select>
</Col>
<Col xs={24} sm={12} md={5}>
<label style={{ fontSize: '11px', fontWeight: 600, display: 'block', marginBottom: 4, color: '#475569' }}>Unidade</label>
<Select size="small" style={{ width: '100%' }} placeholder="Unidade" value={state.novoAttrRapido.unidade_id} onChange={val => state.setNovoAttrRapido(p => ({ ...p, unidade_id: val }))} allowClear>
{state.unidadesMedida.map(u => <Select.Option key={u.id} value={u.id}>{u.simbolo}</Select.Option>)}
</Select>
</Col>
<Col xs={24} sm={12} md={4}>
<Button size="small" type="primary" block style={{ background: '#db2777', borderColor: '#db2777', fontWeight: 500 }} onClick={state.handleCriarEAssociarAtributoRapido}>
🚀 Injetar
</Button>
</Col>
</Row>
</Card>
)}

{/* RENDERIZAÇÃO DAS TABELAS DE ATRIBUTOS */}
{(() => {
const colunasTabela = [
{
title: 'Açoes',
key: 'acoesEscopo',
width: 100,
align: 'center' as const,
render: (_: string, record: any) => {
const configEscopo: Record<string, { icon: React.ReactNode; color: string; label: string; proximo: string }> = {
dna: { icon: <DeploymentUnitOutlined />, color: '#0891b2', label: 'DNA', proximo: 'grade' },
grade: { icon: <ThunderboltOutlined />, color: '#7c3aed', label: 'Grade', proximo: 'ficha' },
ficha: { icon: <FileTextOutlined />, color: '#2563eb', label: 'Ficha', proximo: 'dna' }
};
const escopoAtual = record.escopoComercial || 'dna';
const atual = configEscopo[escopoAtual] || configEscopo['dna'];

return (
<Space size={6} align="center">
{/* Botão de Excluir Atributo */}
<Tooltip title="Remover atributo desta categoria">
<Button
type="text"
danger
size="small"
icon={<CloseOutlined style={{ fontSize: '12px' }} />}
onClick={() => state.handleRemoverAtributoLocal(record.id)}
style={{ width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
/>
</Tooltip>

{/* Botão de Alternar Escopo Dinâmico */}
<Tooltip title={`Escopo atual: ${atual.label}. Clique para mover para o próximo escopo.`}>
<Button
type="text"
size="small"
style={{
color: '#fff',
backgroundColor: atual.color,
borderRadius: '6px',
width: 26,
height: 26,
display: 'flex',
alignItems: 'center',
justifyContent: 'center',
boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
}}
icon={atual.icon}
onClick={() => state.handleMudarEscopoAtributo(record.id, atual.proximo)}
/>
</Tooltip>
</Space>
);
}
},
{
title: 'Atributo',
dataIndex: 'nome',
key: 'nome',
render: (nome: string, record: any) => (
<div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
<span style={{ fontWeight: 600, color: '#0f172a', fontSize: '12px' }}>{nome}</span>
{/* <span style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
Tipo: {record.tipo || 'texto'}
</span> */}
</div>
)
},
{
title: 'Sufixo',
dataIndex: 'sufixo',
key: 'sufixo',
width: 140,
render: (_: string, record: any) => (
<Input
size="small"
value={record.sufixo || ''}
disabled={record.sufixoTravadoCategoria}
placeholder="ex: mm, un"
onChange={(e) => state.handleAtualizarSufixoAtributo(record.id, e.target.value)}
style={{ fontSize: '12px' }}
addonAfter={
<Tooltip title={record.sufixoTravadoCategoria ? "Sufixo travado na categoria (Herança restrita)" : "Sufixo livre para alteração na família"}>
<Button
type="text"
size="small"
style={{ padding: 0, height: 'auto', border: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
icon={
record.sufixoTravadoCategoria ? (
<LockOutlined style={{ color: '#dc2626', fontSize: '12px' }} />
) : (
<UnlockOutlined style={{ color: '#16a34a', fontSize: '12px' }} />
)
}
onClick={() => state.handleToggleTravarSufixo(record.id)}
/>
</Tooltip>
}
/>
)
},
...columns
];

const attrsDna = todosAtributosCalculados.filter(a => a.escopoComercial === 'dna');
const attrsGrade = todosAtributosCalculados.filter(a => a.escopoComercial === 'grade');
const attrsFicha = todosAtributosCalculados.filter(a => a.escopoComercial === 'ficha');

return (
<Space direction="vertical" style={{ width: '100%' }} size={6}>
<h4 style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#0f172a', fontWeight: 700 }}>
⚙️ Arquitetura de Atributos: O Papel de Cada Bloco
</h4>



<TabelaDnaProduto />


<Row gutter={6}>
<Col xs={24} md={12}>
<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
<Tag color="purple" style={{ fontWeight: 700, margin: 0, padding: '2px 8px' }}>⚡ GRADE E VARIANTES</Tag>
<span style={{ fontSize: '11px', color: '#64748b' }}>{attrsGrade.length} atributo(s)</span>
</div>
<Table
dataSource={attrsGrade}
columns={colunasTabela}
rowKey="id"
pagination={false}
size="small"
bordered
locale={{ emptyText: 'Nenhum atributo de Grade.' }}
/>
</Col>
<Col xs={24} md={12}>
<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
<Tag color="blue" style={{ fontWeight: 700, margin: 0, padding: '2px 8px' }}>📄 FICHA TÉCNICA</Tag>
<span style={{ fontSize: '11px', color: '#64748b' }}>{attrsFicha.length} atributo(s)</span>
</div>
<Table
dataSource={attrsFicha}
columns={colunasTabela}
rowKey="id"
pagination={false}
size="small"
bordered
locale={{ emptyText: 'Nenhum atributo de Ficha.' }}
/>
</Col>
</Row>
</Space>
);
})()}
</Space>
)
}
]}
/>

{/* RODAPÉ DO CONTROLADOR FIXO / STICKY */}
<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', padding: '12px 16px', borderRadius: '8px', border: '1px solid #e2e8f0', marginTop: 8 }}>
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
style={{ background: '#16a34a', borderColor: '#16a34a', fontWeight: 600, paddingInline: 24 }}
loading={state.saving}
onClick={state.handleSalvarNoServidor}
>
Salvar Alterações
</Button>
</div>

</Space>
) : (
<div style={{ padding: '80px 20px', textAlign: 'center', border: '2px dashed #cbd5e1', borderRadius: '8px', background: '#fff' }}>
<DeploymentUnitOutlined style={{ fontSize: '48px', color: '#94a3b8', marginBottom: 12 }} />
<h3 style={{ color: '#334155', margin: '0 0 4px 0' }}>Nenhuma Categoria Selecionada</h3>
<p style={{ color: '#64748b', fontSize: '13px', margin: 0 }}>Selecione um item na árvore de taxonomia à esquerda para gerenciar propriedades, mapeamentos e heranças.</p>
</div>
)}
</Content>

{/* LATERAL DIREITA: FAMÍLIAS FILHAS ASSOCIADAS E HERANÇA */}
{state.categoriaSelecionada && (
<Sider
width={340}
theme="light"
style={{
padding: '16px 12px',
borderLeft: '1px solid #e2e8f0',
background: '#ffffff',
boxShadow: '-1px 0 3px rgba(0, 0, 0, 0.02)',
height: '100vh',
position: 'sticky',
top: 0,
overflowY: 'auto'
}}
>
<Space direction="vertical" style={{ width: '100%' }} size={12}>
<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
<span style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
🔗 Famílias Filhas & Herança
</span>
<Tag color="cyan" style={{ fontWeight: 600 }}>
{state.familiasAssociadas?.length || 0}
</Tag>
</div>

<p style={{ fontSize: '11px', color: '#64748b', margin: 0, lineHeight: 1.4 }}>
As famílias abaixo herdam obrigatoriamente o DNA e as travas desta categoria.
</p>

<div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
{state.familiasAssociadas && state.familiasAssociadas.length > 0 ? (
state.familiasAssociadas.map((fam: any) => {
const isSincronizado = fam.statusHeranca !== 'divergente';
return (
<Card
key={fam.id}
size="small"
style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px' }}
>
<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
<span style={{ fontWeight: 600, color: '#0f172a', fontSize: '12px' }}>{fam.nome}</span>
<Button
type="link"
size="small"
icon={<EyeOutlined />}
style={{ padding: 0, height: 'auto' }}
onClick={() => state.handleVisualizarDetalhesFamilia(fam.id)}
>
Ver
</Button>
</div>
<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px' }}>
<span style={{ color: '#64748b', fontFamily: 'monospace' }}>SK: {fam.codigoSkuBase || 'N/A'}</span>
<Tag color="purple" style={{ margin: 0, fontSize: '10px', fontFamily: 'monospace' }}>
{fam.dnaBase || 'DNA Padrão'}
</Tag>
</div>
<div style={{ marginTop: 6, paddingTop: 4, borderTop: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
<span style={{ fontSize: '10px', color: '#64748b' }}>Herança:</span>
<Badge
status={isSincronizado ? 'success' : 'warning'}
text={<span style={{ fontSize: '10px' }}>{isSincronizado ? 'Sincronizado' : 'Divergente'}</span>}
/>
</div>
</Card>
);
})
) : (
<div style={{ padding: '24px 12px', textAlign: 'center', background: '#fafafa', borderRadius: '6px', border: '1px dashed #cbd5e1' }}>
<span style={{ fontSize: '11px', color: '#64748b' }}>Nenhuma família vinculada a esta categoria.</span>
</div>
)}
</div>

<Card size="small" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', marginTop: 8 }}>
<div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
<SafetyCertificateOutlined style={{ fontSize: '14px', color: '#166534', marginTop: 2 }} />
<p style={{ margin: 0, fontSize: '10px', color: '#166534', lineHeight: 1.4 }}>
Atributos de <strong>DNA</strong> definidos na matriz central tornam-se obrigatórios na criação de SKUs destas famílias.
</p>
</div>
</Card>
</Space>
</Sider>
)}


<Modal>
<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px' }}>

{/* 1. DNA DO PRODUTO */}
<div style={{ background: '#ecfeff', border: '1px solid #cffafe', borderRadius: '6px', padding: '12px' }}>
<div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
<span style={{ fontSize: '16px' }}>🧬</span>
<span style={{ fontWeight: 700, color: '#0e7490', fontSize: '12px' }}>DNA DO PRODUTO (OBRIGATÓRIO)</span>
</div>
<p style={{ margin: '0 0 8px 0', fontSize: '11px', color: '#155e75', lineHeight: '1.4' }}>
Define a identidade imutável, engenharia e conformidade técnica herdada da família.
</p>
<div style={{ background: '#ffffff', borderRadius: '4px', padding: '6px 8px', fontSize: '11px', border: '1px solid #e0f2fe' }}>
<span style={{ fontWeight: 600, color: '#0369a1', display: 'block', marginBottom: '2px' }}>Campos e Regras:</span>
<ul style={{ margin: 0, paddingLeft: '14px', color: '#334155' }}>
<li>Material Base / Norma Construtiva</li>
<li>Imutável pelo lojista (Herança Rígida)</li>
<li>Obrigatório para gerar SKU</li>
<li>Domínio travado (Whitelist)</li>
</ul>
</div>
</div>

{/* 2. GRADE E VARIANTES */}
<div style={{ background: '#f3e8ff', border: '1px solid #e9d5ff', borderRadius: '6px', padding: '12px' }}>
<div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
<span style={{ fontSize: '16px' }}>⚡</span>
<span style={{ fontWeight: 700, color: '#7e22ce', fontSize: '12px' }}>GRADE E VARIANTES</span>
</div>
<p style={{ margin: '0 0 8px 0', fontSize: '11px', color: '#6b21a8', lineHeight: '1.4' }}>
Atributos que se combinam para gerar as variações físicas do produto no estoque.
</p>
<div style={{ background: '#ffffff', borderRadius: '4px', padding: '6px 8px', fontSize: '11px', border: '1px solid #f3e8ff' }}>
<span style={{ fontWeight: 600, color: '#7e22ce', display: 'block', marginBottom: '2px' }}>Campos e Regras:</span>
<ul style={{ margin: 0, paddingLeft: '14px', color: '#334155' }}>
<li>Dimensões, Diâmetros e Comprimento</li>
<li>Variações de Cor ou Voltagem</li>
<li>Geradores diretos de SKU e Grade Matrix</li>
</ul>
</div>
</div>

{/* 3. FICHA TÉCNICA */}
<div style={{ background: '#eff6ff', border: '1px solid #dbeafe', borderRadius: '6px', padding: '12px' }}>
<div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
<span style={{ fontSize: '16px' }}>📄</span>
<span style={{ fontWeight: 700, color: '#1d4ed8', fontSize: '12px' }}>FICHA TÉCNICA</span>
</div>
<p style={{ margin: '0 0 8px 0', fontSize: '11px', color: '#1e40af', lineHeight: '1.4' }}>
Atributos descritivos e complementares para enriquecimento de catálogo e SEO.
</p>
<div style={{ background: '#ffffff', borderRadius: '4px', padding: '6px 8px', fontSize: '11px', border: '1px solid #e0e7ff' }}>
<span style={{ fontWeight: 600, color: '#1d4ed8', display: 'block', marginBottom: '2px' }}>Campos e Regras:</span>
<ul style={{ margin: 0, paddingLeft: '14px', color: '#334155' }}>
<li>Características complementares (Peso, Acabamento)</li>
<li>Preenchimento opcional ou customizável</li>
<li>Foco em especificações de vitrine e Marketplaces</li>
</ul>
</div>
</div>

</div>
</Modal>


</Layout>

);

};