import React, { useState, useMemo } from 'react';
import {
Card,
Button,
Input,
Table,
Badge,
Modal,
Select,
Space,
Typography,
Row,
Col,
Statistic,
message,
List,
Tag
} from 'antd';
import {
FileTextOutlined,
SearchOutlined,
SettingOutlined,
EyeOutlined,
PrinterOutlined,
CheckCircleOutlined,
PlusOutlined,
ShoppingCartOutlined,
DeleteOutlined,
ArrowRightOutlined,
UserOutlined
} from '@ant-design/icons';

const { Title, Text } = Typography;

/* Tipos */
type VendaStatus = 'disponivel' | 'editando' | 'pagamento' | 'aprovado' | 'faturado' | 'pendente';
type VendaType = 'pdv' | 'os' | 'b2b';

type CanalOrigem = 'balcão' | 'whatsapp' | 'telefone' | 'externo';

/* Interfaces */
interface Venda {
id: number;
cliente: string;
vendedor?: string;
itens: string[];
valorTotal: number;
ultimaAlteracao?: Date;
status: VendaStatus;
type: VendaType;
editadoPor?: string;
formaPagamento?: string;
horario?: string;
}

interface EstoqueItem {
id: number;
nome: string;
preco: number;
estoque: number;
}

interface ItemCarrinhoRascunho {
id: string | number;
nome: string;
preco: number;
quantidade: number;
isAvulso?: boolean;
}

interface ItemCarrinho {
id: number;
nome: string;
preco: number;
quantidade: number;
}

/* Interfaces */
interface AtendimentoHub {
id: number;
cliente: string;
canal: CanalOrigem;
itens: string[];
valorTotal: number;
status: VendaStatus;
type: VendaType;
horario?: string;
}

/* Props */
interface HubVendasProps {
onCreateVenda?: (tipo: 'pdv' | 'b2b') => void;
onOpenVenda?: (id: number) => void;
onEditVenda?: (id: number) => void;
onCollect?: (id: number) => void;
onBack?: () => void;
initialData?: Venda[];
}

/* Mock Data Inicial */
const MOCK_VENDAS: Venda[] = [
{ id: 101, cliente: "João Silva", vendedor: "Carlos", itens: ["Camiseta Polo (R$ 100)", "Calça Jeans (R$ 150)"], valorTotal: 250.00, status: 'aprovado', type: 'pdv', horario: '14:22', formaPagamento: 'PIX à vista' },
{ id: 102, cliente: "Transportes Alfa LTDA", vendedor: "Bruno", itens: ["Reparo hidráulico (R$ 1.200)", "Mangueira industrial (R$ 690.50)"], valorTotal: 1890.50, status: 'faturado', type: 'os', horario: '13:50', formaPagamento: 'Boleto 30 dias' },
{ id: 103, cliente: "Maria Oliveira", vendedor: "Ana", itens: ["Troca de óleo (R$ 380)", "Filtro de óleo (R$ 100.90)"], valorTotal: 480.90, status: 'aprovado', type: 'pdv', horario: '12:15', editadoPor: "Marlon", formaPagamento: 'Cartão 2x' },
{ id: 104, cliente: "Construtora Norte", vendedor: "Carlos", itens: ["Manutenção cilindro hidráulico (R$ 5.200)"], valorTotal: 5200.00, status: 'pendente', type: 'os', horario: '11:05', editadoPor: "João Técnico" },
{ id: 105, cliente: "Consumidor Final", vendedor: "Carlos", itens: ["Boné promocional (R$ 35)", "Camiseta básica (R$ 45)"], valorTotal: 80.00, status: 'aprovado', type: 'pdv', horario: '10:40' },
{ id: 106, cliente: "Indústria Mecânica Delta", vendedor: "Bruno", itens: ["Revisão sistema hidráulico (R$ 4.000)"], valorTotal: 4000.00, status: 'pendente', type: 'os', horario: '09:20' }
];

const ESTOQUE_MOCK: EstoqueItem[] = [
{ id: 1, nome: 'Camiseta Polo', preco: 100.00, estoque: 45 },
{ id: 2, nome: 'Calça Jeans', preco: 150.00, estoque: 28 },
{ id: 3, nome: 'Reparo hidráulico', preco: 1200.00, estoque: 5 },
{ id: 4, nome: 'Mangueira industrial', preco: 690.50, estoque: 12 },
{ id: 5, nome: 'Troca de óleo', preco: 380.00, estoque: 50 },
{ id: 6, nome: 'Filtro de óleo', preco: 100.90, estoque: 30 },
{ id: 1, nome: 'Camiseta Polo', preco: 100.00, estoque: 45 },
{ id: 2, nome: 'Calça Jeans', preco: 150.00, estoque: 28 },
{ id: 3, nome: 'Reparo hidráulico', preco: 1200.00, estoque: 5 },
{ id: 4, nome: 'Mangueira industrial', preco: 690.50, estoque: 12 },
{ id: 5, nome: 'Mão de Obra Técnica (Hora)', preco: 150.00, estoque: 999 }
];


/* Mock Data Inicial */
const MOCK_ATENDIMENTOS: AtendimentoHub[] = [
{ id: 101, cliente: "João Silva", canal: "balcão", itens: ["Camiseta Polo (R$ 100) x1", "Calça Jeans (R$ 150) x1"], valorTotal: 250.00, status: 'aprovado', type: 'pdv', horario: '14:22' },
{ id: 102, cliente: "Transportes Alfa LTDA", canal: "whatsapp", itens: ["Reparo hidráulico (R$ 1.200) x1"], valorTotal: 1200.00, status: 'pendente', type: 'b2b', horario: '13:50' },
{ id: 103, cliente: "Construtora Norte", canal: "telefone", itens: ["Manutenção cilindro hidráulico (R$ 5.200) x1", "Mão de obra técnica (R$ 800) x2"], valorTotal: 6800.00, status: 'pendente', type: 'os', horario: '11:05' }
];



const HubVendas: React.FC<HubVendasProps> = ({
onCreateVenda,
onOpenVenda,
initialData
}) => {
const [vendas, setVendas] = useState<Venda[]>(initialData || MOCK_VENDAS);

// Carrinho Geral Compartilhado
const [clienteCarrinho, setClienteCarrinho] = useState('Consumidor Final');

// Modais State
const [isNovaVendaOpen, setIsNovaVendaOpen] = useState(false);
const [novaVendaTipo, setNovaVendaTipo] = useState<'pdv' | 'b2b'>('pdv');
const [novoCliente, setNovoCliente] = useState('Consumidor Final');
const [itemInput, setItemInput] = useState('');
const [valorItemInput, setValorItemInput] = useState<number | ''>('');
const [tempItens, setTempItens] = useState<{ nome: string; valor: number }[]>([]);

const [isConsultaOpen, setIsConsultaOpen] = useState(false);
const [consultaQuery, setConsultaQuery] = useState('');



const [atendimentos, setAtendimentos] = useState<AtendimentoHub[]>(MOCK_ATENDIMENTOS);
const [searchTerm, setSearchTerm] = useState('');
const [activeTab, setActiveTab] = useState<'todos' | 'pdv' | 'b2b' | 'os'>('todos');
// Estado do Carrinho de Triagem (Rascunho)
const [carrinhoItens, setCarrinhoItens] = useState<ItemCarrinhoRascunho[]>([]);
const [clienteAtendimento, setClienteAtendimento] = useState('Consumidor Final');
const [canalOrigem, setCanalOrigem] = useState<CanalOrigem>('balcão');
const [descontoGlobal, setDescontoGlobal] = useState<number>(0);
// Estados para itens avulsos / editáveis no rascunho
const [itemAvulsoNome, setItemAvulsoNome] = useState('');
const [itemAvulsoPreco, setItemAvulsoPreco] = useState<number | ''>('');
// Modais de Apoio
const [isCaixaOpen, setIsCaixaOpen] = useState(false);
/* Manipulação do Rascunho */
const handleAdicionarProdutoEstoque = (prodId: number) => {
const produto = ESTOQUE_MOCK.find(p => p.id === prodId);
if (produto) {
const existe = carrinhoItens.find(i => i.id === produto.id);
if (existe) {
setCarrinhoItens(carrinhoItens.map(i => i.id === produto.id ? { ...i, quantidade: i.quantidade + 1 } : i));
} else {
setCarrinhoItens([...carrinhoItens, { id: produto.id, nome: produto.nome, preco: produto.preco, quantidade: 1 }]);
}
message.success(`${produto.nome} adicionado ao rascunho!`);
}
};
const handleAdicionarItemAvulso = () => {
if (!itemAvulsoNome.trim() || typeof itemAvulsoPreco !== 'number' || itemAvulsoPreco <= 0) {
message.warning('Informe um nome e um valor válido para o item avulso/serviço!');
return;
}
const novoItem: ItemCarrinhoRascunho = {
id: `avulso_${Date.now()}`,
nome: itemAvulsoNome.trim(),
preco: itemAvulsoPreco,
quantidade: 1,
isAvulso: true
};
setCarrinhoItens([...carrinhoItens, novoItem]);
setItemAvulsoNome('');
setItemAvulsoPreco('');
message.success('Item avulso/serviço adicionado ao rascunho!');
};
const handleMudarQtdCarrinho = (id: string | number, delta: number) => {
setCarrinhoItens(
carrinhoItens.map(item => {
if (item.id === id) {
const novaQtd = item.quantidade + delta;
return novaQtd > 0 ? { ...item, quantidade: novaQtd } : null;
}
return item;
}).filter(Boolean) as ItemCarrinhoRascunho[]
);
};
const handleRemoverDoCarrinho = (id: string | number) => {
setCarrinhoItens(carrinhoItens.filter(item => item.id !== id));
};
const valorSubtotalCarrinho = useMemo(() => {
return carrinhoItens.reduce((acc, item) => acc + (item.preco * item.quantidade), 0);
}, [carrinhoItens]);
const valorTotalCarrinho = useMemo(() => {
return Math.max(0, valorSubtotalCarrinho - descontoGlobal);
}, [valorSubtotalCarrinho, descontoGlobal]);






const handleDespacharAtendimento = (destino: VendaType) => {
if (carrinhoItens.length === 0) {
message.warning('O rascunho de atendimento está vazio!');
return;
}
const now = new Date();
const horarioStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
const novoRegistro: AtendimentoHub = {
id: Math.floor(Math.random() * 900) + 110,
type: destino,
cliente: clienteAtendimento || 'Consumidor Final',
canal: canalOrigem,
itens: carrinhoItens.map(i => `${i.nome} (R$ ${i.preco.toFixed(2)}) x${i.quantidade}`),
valorTotal: valorTotalCarrinho,
status: destino === 'pdv' ? 'aprovado' : 'pendente',
horario: horarioStr
};
setAtendimentos([novoRegistro, ...atendimentos]);
setCarrinhoItens([]);
setDescontoGlobal(0);
setClienteAtendimento('Consumidor Final');

const mensagensDestino = {
pdv: 'Encaminhado para o Caixa (PDV Rápido)!',
b2b: 'Orçamento B2B gerado com sucesso!',
os: 'Ordem de Serviço (OS) aberta com sucesso!'
};
message.success(mensagensDestino[destino]);
};

/* Filtros da Tabela */
const filteredAtendimentos = useMemo(() => {
const normalized = searchTerm.toLowerCase();
return atendimentos.filter(a => {
const matchTab = activeTab === 'todos' ? true : a.type === activeTab;
const matchSearch =
a.cliente.toLowerCase().includes(normalized) ||
a.id.toString().includes(normalized) ||
a.itens.some(item => item.toLowerCase().includes(normalized));
return matchTab && matchSearch;
});
}, [atendimentos, searchTerm, activeTab]);




const handleDespacharCarrinho = (tipoDestino: 'pdv' | 'b2b') => {
if (carrinhoItens.length === 0) {
message.warning('O carrinho geral está vazio!');
return;
}

const now = new Date();
const horarioStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

const novaTransacao: Venda = {
id: Math.floor(Math.random() * 900) + 110,
type: tipoDestino === 'pdv' ? 'pdv' : 'os',
cliente: clienteCarrinho || 'Consumidor Final',
itens: carrinhoItens.map(i => `${i.nome} (R$ ${i.preco.toFixed(2)}) x${i.quantidade}`),
valorTotal: valorTotalCarrinho,
status: tipoDestino === 'pdv' ? 'aprovado' : 'pendente',
horario: horarioStr,
vendedor: 'João Silva'
};

setVendas([novaTransacao, ...vendas]);
setCarrinhoItens([]);
onCreateVenda?.(tipoDestino);

if (tipoDestino === 'pdv') {
message.success(`Venda PDV #${novaTransacao.id} finalizada com sucesso no Caixa!`);
} else {
message.success(`Orçamento B2B #${novaTransacao.id} gerado e salvo em aberto!`);
}
};

/* Filtros e Cálculos Globais */
const filteredVendas = useMemo(() => {
const normalized = searchTerm.toLowerCase();
return vendas.filter(v => {
const matchTab = activeTab === 'pdv' ? v.type === 'pdv' : v.type === 'os' || v.type === 'b2b';
const matchSearch =
v.cliente.toLowerCase().includes(normalized) ||
v.id.toString().includes(normalized) ||
v.itens.some(item => item.toLowerCase().includes(normalized));
return matchTab && matchSearch;
});
}, [vendas, searchTerm, activeTab]);

const stats = useMemo(() => {
const totalHoje = vendas.filter(v => v.type === 'pdv').reduce((acc, v) => acc + v.valorTotal, 0);
const orcamentosAberto = vendas.filter(v => v.type === 'os' && v.status === 'pendente');
const valorOrcamentos = orcamentosAberto.reduce((acc, v) => acc + v.valorTotal, 0);
return {
vendasHojeTotal: totalHoje,
vendasCount: vendas.filter(v => v.type === 'pdv').length,
orcamentosCount: orcamentosAberto.length,
orcamentosValor: valorOrcamentos
};
}, [vendas]);

/* Handlers de Ações */
const handleOpenNovaVendaModal = (tipo: 'pdv' | 'b2b') => {
setNovaVendaTipo(tipo);
setNovoCliente(tipo === 'pdv' ? 'Consumidor Final' : 'Empresa Parceira S/A');
setTempItens([]);
setIsNovaVendaOpen(true);
onCreateVenda?.(tipo);
};

const handleAddItemTemp = () => {
if (!itemInput.trim() || typeof valorItemInput !== 'number' || valorItemInput <= 0) {
message.warning('Informe um nome de item e valor válido!');
return;
}
setTempItens([...tempItens, { nome: itemInput.trim(), valor: valorItemInput }]);
setItemInput('');
setValorItemInput('');
};

const handleSaveTransaction = () => {
if (tempItens.length === 0) {
message.warning('Adicione pelo menos um item à transação!');
return;
}

const now = new Date();
const horarioStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
const totalCalculado = tempItens.reduce((acc, i) => acc + i.valor, 0);

const novaTransacao: Venda = {
id: Math.floor(Math.random() * 900) + 110,
type: novaVendaTipo === 'pdv' ? 'pdv' : 'os',
cliente: novoCliente || 'Consumidor Final',
itens: tempItens.map(i => `${i.nome} (R$ ${i.valor.toFixed(2)})`),
valorTotal: totalCalculado,
status: novaVendaTipo === 'pdv' ? 'aprovado' : 'pendente',
horario: horarioStr,
vendedor: 'João Silva'
};

setVendas([novaTransacao, ...vendas]);
setIsNovaVendaOpen(false);
message.success(`Transação #${novaTransacao.id} registrada com sucesso!`);
};

const handleFaturarOrcamento = (id: number) => {
setVendas(vendas.map(v => v.id === id ? { ...v, status: 'faturado', type: 'pdv' } : v));
message.success(`Orçamento #${id} faturado e convertido para Venda PDV!`);
};

const handleVerDetalhes = (venda: Venda) => {
onOpenVenda?.(venda.id);
message.info(`Visualizando detalhes da venda #${venda.id}`);
};

/* Colunas da Tabela */
const columns = [
{
title: 'ID / Tipo',
dataIndex: 'id',
key: 'id',
render: (id: number, record: Venda) => (
<Space direction="vertical" size={2}>
<Text strong>#{id}</Text>
<Tag color={record.type === 'pdv' ? 'success' : 'processing'}>
{record.type === 'pdv' ? 'PDV' : 'B2B/OS'}
</Tag>
</Space>
),
},
{
title: 'Cliente',
dataIndex: 'cliente',
key: 'cliente',
render: (cliente: string) => <Text>{cliente}</Text>
},
{
title: 'Resumo dos Itens',
dataIndex: 'itens',
key: 'itens',
render: (itens: string[]) => (
<Text type="secondary" ellipsis={{ tooltip: itens.join(', ') }} style={{ maxWidth: 220 }}>
{itens.join(', ')}
</Text>
),
},
{
title: 'Valor Total',
dataIndex: 'valorTotal',
key: 'valorTotal',
render: (val: number) => (
<Text strong style={{ color: '#0f172a' }}>
{val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
</Text>
),
},
{
title: 'Status',
dataIndex: 'status',
key: 'status',
render: (status: VendaStatus) => {
const isSuccess = status === 'aprovado' || status === 'faturado';
return (
<Badge
status={isSuccess ? 'success' : 'warning'}
text={<span style={{ textTransform: 'capitalize', fontWeight: 500 }}>{status}</span>}
/>
);
},
},
{
title: 'Horário',
dataIndex: 'horario',
key: 'horario',
render: (horario: string) => <Text>{horario || 'Agora'}</Text>
},
{
title: 'Ações Rápidas',
key: 'acoes',
align: 'right' as const,
render: (_: unknown, record: Venda) => (
<Space size="small">
<Button
icon={<EyeOutlined />}
size="small"
onClick={() => handleVerDetalhes(record)}
title="Detalhes"
/>
<Button
icon={<PrinterOutlined />}
size="small"
onClick={() => message.info(`Imprimindo comprovante #${record.id}...`)}
title="Imprimir"
/>
{record.type === 'os' && record.status === 'pendente' && (
<Button
type="primary"
ghost
size="small"
icon={<CheckCircleOutlined />}
onClick={() => handleFaturarOrcamento(record.id)}
>
Faturar
</Button>
)}
</Space>
),
},
];

return (
<div style={{ background: '#f8fafc', minHeight: '100vh', display: 'flex', flexDirection: 'column', fontFamily: 'Inter, sans-serif' }}>

{/* CABEÇALHO GLOBAL */}
<header style={{ background: '#0f172a', color: '#fff', borderBottom: '1px solid #1e293b', padding: '0 24px' }}>
<div style={{ maxWidth: 1280, margin: '0 auto', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
<Space size="middle">
<div style={{ background: '#4f46e5', padding: '8px 12px', borderRadius: 8, fontWeight: 'bold', color: '#fff' }}>
⚡ ERP
</div>
<div>
<Title level={4} style={{ color: '#fff', margin: 0, fontSize: '16px' }}>Módulo de Vendas & PDV Híbrido</Title>
<Text type="secondary" style={{ fontSize: '12px', color: '#94a3b8' }}>Frente de Caixa Ágil & Gestão B2B/Orçamentos Integrados</Text>
</div>
</Space>

<Space size="large">
<div style={{ background: '#1e293b', border: '1px solid #334155', padding: '6px 12px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
<span style={{ width: 10, height: 10, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
<Text style={{ color: '#cbd5e1', fontSize: '13px' }}>Operador: <strong style={{ color: '#fff' }}>João Silva</strong></Text>
<Text style={{ color: '#64748b' }}>|</Text>
<Text style={{ color: '#cbd5e1', fontSize: '13px' }}>Caixa: <strong style={{ color: '#34d399' }}>02 (Aberto)</strong></Text>
</div>
<Button 
ghost 
icon={<SettingOutlined />} 
onClick={() => setIsCaixaOpen(true)}
style={{ borderColor: '#334155', color: '#cbd5e1' }}
>
Gerir Caixa
</Button>
</Space>
</div>
</header>

{/* BARRA DE ESTATÍSTICAS E ATALHOS */}
<div style={{ padding: '18px 18px 0 18px', maxWidth: '90%', width: '100%', margin: '0 auto' }}>
<Row gutter={[16, 16]}>
<Col xs={24} sm={8} md={4}>
<Card bordered={false} style={{ borderRadius: 12, boxShadow: '0 1px 2px 0 rgba(0,0,0,0.05)', height: '100%' }}>
<Statistic
title={<Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase' }}>Vendas Hoje</Text>}
value={stats.vendasHojeTotal}
precision={2}
formatter={(value) => Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
valueStyle={{ color: '#0f172a', fontWeight: 700, fontSize: 16 }}
/>
<Text type="success" style={{ fontSize: 11 }}>↑ {stats.vendasCount} concluídas</Text>
</Card>
</Col>
<Col xs={24} sm={8} md={4}>
<Card bordered={false} style={{ borderRadius: 12, boxShadow: '0 1px 2px 0 rgba(0,0,0,0.05)', height: '100%' }}>
<Statistic
title={<Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase' }}>Orçamentos Aberto</Text>}
value={stats.orcamentosValor}
precision={2}
formatter={(value) => Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
valueStyle={{ color: '#d97706', fontWeight: 700, fontSize: 16 }}
/>
<Text type="warning" style={{ fontSize: 11 }}>{stats.orcamentosCount} pendentes</Text>
</Card>
</Col>
<Col xs={24} sm={8} md={4}>
<Card bordered={false} style={{ borderRadius: 12, boxShadow: '0 1px 2px 0 rgba(0,0,0,0.05)', height: '100%' }}>
<Statistic
title={<Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase' }}>Status do Caixa</Text>}
value="ABERTO"
valueStyle={{ color: '#059669', fontWeight: 700, fontSize: 16 }}
/>
<Text type="secondary" style={{ fontSize: 11 }}>Troco: R$ 150,00</Text>
</Card>
</Col>

<Col xs={24} md={6}>
<div 
onClick={() => handleOpenNovaVendaModal('pdv')}
style={{
background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
borderRadius: 12,
padding: 20,
color: '#fff',
cursor: 'pointer',
boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
display: 'flex',
justifyContent: 'space-between',
alignItems: 'center'
}}
>
<div>
<Tag color="green" style={{ marginBottom: 8, fontWeight: 600 }}>Foco em Agilidade</Tag>
<Title level={4} style={{ color: '#fff', margin: 0 }}>🛒 + Nova Venda PDV</Title>
<Text style={{ color: '#d1fae5', fontSize: '12px', display: 'block', marginTop: 4 }}>Abre frente de caixa rápida para balcão.</Text>
</div>
<PlusOutlined style={{ fontSize: 28, background: 'rgba(255,255,255,0.2)', padding: 12, borderRadius: 10 }} />
</div>
</Col>

<Col xs={24} md={6}>
<div 
onClick={() => handleOpenNovaVendaModal('b2b')}
style={{
background: 'linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)',
borderRadius: 12,
padding: 20,
color: '#fff',
cursor: 'pointer',
boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
display: 'flex',
justifyContent: 'space-between',
alignItems: 'center'
}}
>
<div>
<Tag color="geekblue" style={{ marginBottom: 8, fontWeight: 500 }}>Foco Comercial</Tag>
<Title level={4} style={{ color: '#fff', margin: 0 }}>📋 Novo Orçamento</Title>
<Text style={{ color: '#e0e7ff', fontSize: '12px', display: 'block', marginTop: 4 }}>Orçamentos, pedidos complexos e prazos.</Text>
</div>
<FileTextOutlined style={{ fontSize: 28, background: 'rgba(255,255,255,0.2)', padding: 12, borderRadius: 10 }} />
</div>
</Col>


</Row>
</div>


{/* CONTEÚDO PRINCIPAL: O RASCUNHO / CARRINHO DE ENTRADA */}
<main style={{ flex: 1, maxWidth: '95%', width: '100%', margin: '0 auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: 24 }}>
<Row>




{/* LISTA / HISTÓRICO DE ATENDIMENTOS RECENTES (HUB) */}
<Col xs={24} md={12}>
<Card 
bordered={false} 
style={{ borderRadius: 12, boxShadow: '0 1px 2px 0 rgba(0,0,0,0.05)' }}
styles={{ body: { padding: 0 } }}
>
<div style={{ padding: '16px 24px', borderBottom: '1px solid #f1f5f9', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
<Space>
<Button type={activeTab === 'todos' ? 'primary' : 'text'} onClick={() => setActiveTab('todos')} style={activeTab === 'todos' ? { background: '#0f172a' } : {}}>
Todos
</Button>
<Button type={activeTab === 'pdv' ? 'primary' : 'text'} onClick={() => setActiveTab('pdv')} style={activeTab === 'pdv' ? { background: '#0f172a' } : {}}>
⚡ PDV
</Button>
<Button type={activeTab === 'b2b' ? 'primary' : 'text'} onClick={() => setActiveTab('b2b')} style={activeTab === 'b2b' ? { background: '#0f172a' } : {}}>
📑 Orçamentos B2B
</Button>
<Button type={activeTab === 'os' ? 'primary' : 'text'} onClick={() => setActiveTab('os')} style={activeTab === 'os' ? { background: '#0f172a' } : {}}>
🛠️ Ordens de Serviço (OS)
</Button>
</Space>

<Input
placeholder="Buscar cliente, ID ou item..."
prefix={<SearchOutlined style={{ color: '#cbd5e1' }} />}
value={searchTerm}
onChange={e => setSearchTerm(e.target.value)}
style={{ width: 260, borderRadius: 8 }}
allowClear
/>
</div>

<Table 
dataSource={filteredAtendimentos} 
columns={[
{
title: 'ID / Destino',
dataIndex: 'id',
key: 'id',
render: (id: number, record: AtendimentoHub) => {
const colors: Record<VendaType, string> = { pdv: 'success', b2b: 'processing', os: 'warning' };
const labels: Record<VendaType, string> = { pdv: 'PDV', b2b: 'Orçamento', os: 'Ordem de Serviço' };
return (
<Space direction="vertical" size={2}>
<Text strong>#{id}</Text>
<Tag color={colors[record.type]}>{labels[record.type]}</Tag>
</Space>
);
},
},
{
title: 'Cliente & Canal',
key: 'cliente',
render: (_: unknown, record: AtendimentoHub) => (
<Space direction="vertical" size={2}>
<Text strong>{record.cliente}</Text>
<Text type="secondary" style={{ fontSize: 11, textTransform: 'capitalize' }}>Origem: {record.canal}</Text>
</Space>
)
},
{
title: 'Resumo dos Itens',
dataIndex: 'itens',
key: 'itens',
render: (itens: string[]) => (
<Text type="secondary" ellipsis={{ tooltip: itens.join(', ') }} style={{ maxWidth: 240 }}>
{itens.join(', ')}
</Text>
),
},
{
title: 'Valor Total',
dataIndex: 'valorTotal',
key: 'valorTotal',
render: (val: number) => (
<Text strong style={{ color: '#0f172a' }}>
{val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
</Text>
),
},
{
title: 'Horário',
dataIndex: 'horario',
key: 'horario',
render: (horario: string) => <Text>{horario || 'Agora'}</Text>
},
{
title: 'Ações',
key: 'acoes',
align: 'right' as const,
render: (_: unknown, record: AtendimentoHub) => (
<Space size="small">
<Button icon={<EyeOutlined />} size="small" onClick={() => message.info(`Abrindo detalhes de #${record.id}`)} title="Ver Detalhes" />
<Button icon={<PrinterOutlined />} size="small" onClick={() => message.info(`Imprimindo rascunho #${record.id}...`)} title="Imprimir" />
</Space>
),
},
]} 
rowKey="id" 
pagination={{ pageSize: 5 }} 
style={{ padding: '0 8px' }} 
/>

<div style={{ padding: '12px 24px', background: '#f8fafc', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between' }}>
<Text type="secondary" style={{ fontSize: 12 }}>Exibindo {filteredAtendimentos.length} registro(s) no Hub de Triagem</Text>
<Text type="secondary" style={{ fontSize: 12 }}>Módulo Comercial v3.0</Text>
</div>
</Card>
</Col>








<Col xs={24} md={12}>
<Card 
title={
<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
<Space><ShoppingCartOutlined style={{ color: '#4f46e5' }} /><Text strong>Rascunho de Atendimento Ativo (Triagem)</Text></Space>
<Tag color="geekblue">{carrinhoItens.length} item(ns) no rascunho</Tag>
</div>
}
bordered={false} 
style={{ borderRadius: 12, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', border: '2px solid #e0e7ff' , height: '90%'}}
>
<Row gutter={24}>
{/* COLUNA ESQUERDA: DADOS DO CLIENTE, CANAL E ADIÇÃO DE ITENS */}
<Col xs={24} md={12}>
<Space direction="vertical" size="middle" style={{ width: '100%' }}>


  <Col xs={24} md={24}>
<div 
onClick={() => setIsConsultaOpen(true)}
style={{
background: 'linear-gradient(135deg, #334155 0%, #1e293b 100%)',
borderRadius: 12,
padding: 10,
color: '#fff',
cursor: 'pointer',
boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
display: 'flex',
justifyContent: 'space-between',
alignItems: 'center',
height: '100%'
}}
>
<div>
<Tag style={{ marginBottom: 8, fontWeight: 600, background: '#475569', color: '#fff', border: 'none' }}>Consulta Instantânea</Tag>
<Title level={4} style={{ color: '#fff', margin: 0 }}>🔍 Consulta Rápida</Title>
<Text style={{ color: '#cbd5e1', fontSize: '12px', display: 'block', marginTop: 4 }}>Pesquise preços e estoque sem abrir venda.</Text>
</div>
<SearchOutlined style={{ fontSize: 28, background: 'rgba(255,255,255,0.2)', padding: 12, borderRadius: 10 }} />
</div>
</Col>

{/* Linha Cliente e Canal */}
<Row gutter={12}>
<Col span={14}>
<Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>Cliente / Prospect</Text>
<Input 
value={clienteAtendimento} 
onChange={e => setClienteAtendimento(e.target.value)} 
placeholder="Nome do cliente..." 
size="middle"
prefix={<UserOutlined style={{ color: '#94a3b8' }} />}
/>
</Col>
<Col span={10}>
<Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>Canal de Origem</Text>
<Select
value={canalOrigem}
onChange={val => setCanalOrigem(val)}
style={{ width: '100%' }}
options={[
{ value: 'balcão', label: '🏪 Balcão' },
{ value: 'whatsapp', label: '💬 WhatsApp' },
{ value: 'telefone', label: '📞 Telefone' },
{ value: 'externo', label: '🌐 Externo' }
]}
/>
</Col>
</Row>

{/* Busca de Produtos do Estoque */}
<div>
<Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>Adicionar Produto do Estoque</Text>
<Select
showSearch
placeholder="Selecione ou busque no estoque..."
style={{ width: '100%' }}
optionFilterProp="children"
value={null}
onChange={(prodId) => handleAdicionarProdutoEstoque(prodId)}
options={ESTOQUE_MOCK.map(prod => ({
value: prod.id,
label: `${prod.nome} — R$ ${prod.preco.toFixed(2)}`
}))}
/>
</div>

{/* Adicionar Item Avulso / Serviço Manual */}
<div style={{ background: '#f8fafc', padding: 10, borderRadius: 8, border: '1px solid #e2e8f0' }}>
<Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>Adicionar Serviço ou Item Avulso (Negociação Livre)</Text>
<Space.Compact style={{ width: '100%' }}>
<Input 
placeholder="Ex: Instalação, taxa extra..." 
value={itemAvulsoNome} 
onChange={e => setItemAvulsoNome(e.target.value)} 
/>
<Input 
type="number" 
placeholder="Valor R$" 
style={{ width: 110 }} 
value={itemAvulsoPreco} 
onChange={e => setItemAvulsoPreco(e.target.value ? Number(e.target.value) : '')} 
/>
<Button type="primary" onClick={handleAdicionarItemAvulso}>Add</Button>
</Space.Compact>
</div>
</Space>
</Col>

{/* COLUNA DIREITA: ITENS LANÇADOS, DESCONTO E ENCRUZILHADA DE DESTINOS */}
<Col xs={24} md={12} style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', borderLeft: '1px solid #f1f5f9', paddingLeft: '16px' }}>
<div>

<div style={{ maxHeight: 150, overflowY: 'auto', background: '#f8fafc', padding: 8, borderRadius: 8, border: '1px solid #e2e8f0', marginBottom: 10 }}>
{carrinhoItens.length === 0 ? (
<Text type="secondary" italic style={{ fontSize: 12, textAlign: 'center', display: 'block', padding: '20px 0' }}>
Nenhum item adicionado ao rascunho.
</Text>
) : (
<List
size="small"
dataSource={carrinhoItens}
renderItem={item => (
<List.Item style={{ padding: '4px 4px', borderBottom: '1px solid #f1f5f9' }}>
<div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
<div>
<Text style={{ fontSize: 12 }} strong>{item.nome} {item.isAvulso && <Tag color="orange" style={{ fontSize: 9 }}>Avulso</Tag>}</Text>
<br />
<Text type="secondary" style={{ fontSize: 11 }}>R$ {item.preco.toFixed(2)} un | Subtotal: <strong>R$ {(item.preco * item.quantidade).toFixed(2)}</strong></Text>
</div>
<Space size="small">
<Button size="small" onClick={() => handleMudarQtdCarrinho(item.id, -1)}>-</Button>
<Text style={{ fontSize: 12, fontWeight: 600, minWidth: 16, textAlign: 'center' }}>{item.quantidade}</Text>
<Button size="small" onClick={() => handleMudarQtdCarrinho(item.id, 1)}>+</Button>
<Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => handleRemoverDoCarrinho(item.id)} />
</Space>
</div>
</List.Item>
)}
/>
)}
</div>

{/* Desconto Global */}
<div style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'center' }}>
<Text type="secondary" style={{ fontSize: 11, minWidth: 90 }}>Desconto (R$):</Text>
<Input 
type="number" 
value={descontoGlobal === 0 ? '' : descontoGlobal} 
onChange={e => setDescontoGlobal(e.target.value ? Number(e.target.value) : 0)} 
placeholder="0,00" 
size="small"
/>
</div>
</div>

<div>
<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, background: '#f1f5f9', padding: '10px 12px', borderRadius: 8 }}>
<div>
<Text type="secondary" style={{ fontSize: 11, display: 'block' }}>Valor Estimado do Atendimento</Text>
<Title level={4} style={{ margin: 0, color: '#0f172a' }}>
{valorTotalCarrinho.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
</Title>
</div>
</div>

{/* A ENCRUZILHADA: PARA ONDE EVOLUIR ESTE ATENDIMENTO? */}
<Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 6 }}>Encaminhar Atendimento Para:</Text>
<Row gutter={8}>
<Col span={8}>
<Button 
type="primary" 
block 
size="middle"
onClick={() => handleDespacharAtendimento('pdv')}
style={{ background: '#059669', fontWeight: 600, fontSize: 12, height: 38 }}
>
⚡ Caixa PDV
</Button>
</Col>
<Col span={8}>
<Button 
block 
size="middle"
onClick={() => handleDespacharAtendimento('b2b')}
style={{ background: '#4f46e5', color: '#fff', fontWeight: 600, border: 'none', fontSize: 12, height: 38 }}
>
📑 Orçamento
</Button>
</Col>
<Col span={8}>
<Button 
block 
size="middle"
onClick={() => handleDespacharAtendimento('os')}
style={{ background: '#d97706', color: '#fff', fontWeight: 600, border: 'none', fontSize: 12, height: 38 }}
>
🛠️ Abrir OS
</Button>
</Col>
</Row>
</div>
</Col>
</Row>
</Card>
</Col>





</Row>


</main>

{/* MODAL DE CAIXA / TURNO */}
<Modal
title="⚙️ Status do Caixa & Turno Atual"
open={isCaixaOpen}
onCancel={() => setIsCaixaOpen(false)}
footer={[<Button key="close" type="primary" onClick={() => setIsCaixaOpen(false)}>Fechar</Button>]}
>
<Space direction="vertical" style={{ width: '100%', marginTop: 8 }} size="middle">
<Text>O operador <strong>João Silva</strong> está com o turno aberto.</Text>
<Card size="small" style={{ background: '#f8fafc' }}>
<Text type="secondary">Fundo de Caixa Inicial: R$ 150,00</Text><br />
<Text type="secondary">Atendimentos Iniciados Hoje: {atendimentos.length}</Text>
</Card>
</Space>
</Modal>


{/* CONTEÚDO PRINCIPAL */}
<main style={{ flex: 1, maxWidth: 1280, width: '100%', margin: '0 auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: 24 }}>




</main>

{/* MODAL: NOVA VENDA / ORÇAMENTO */}
<Modal
title={novaVendaTipo === 'pdv' ? '🛒 Nova Venda PDV (Caixa)' : '📋 Novo Orçamento / Pedido B2B'}
open={isNovaVendaOpen}
onCancel={() => setIsNovaVendaOpen(false)}
footer={[
<Button key="back" onClick={() => setIsNovaVendaOpen(false)}>Cancelar</Button>,
<Button key="submit" type="primary" onClick={handleSaveTransaction} style={{ background: '#4f46e5' }}>
Finalizar & Salvar
</Button>
]}
width={600}
>
<Space direction="vertical" size="middle" style={{ width: '100%', marginTop: 8 }}>
<Row gutter={12}>
<Col span={12}>
<Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Tipo de Operação</Text>
<Select 
value={novaVendaTipo} 
onChange={(val) => setNovaVendaTipo(val)}
style={{ width: '100%' }}
options={[
{ value: 'pdv', label: 'PDV (Venda Direta)' },
{ value: 'b2b', label: 'Orçamento / B2B' }
]}
/>
</Col>
<Col span={12}>
<Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Cliente / Razão Social</Text>
<Input 
value={novoCliente} 
onChange={e => setNovoCliente(e.target.value)} 
placeholder="Ex: Consumidor Final" 
/>
</Col>
</Row>

<div>
<Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Adicionar Produto / Item</Text>
<Space.Compact style={{ width: '100%' }}>
<Input 
placeholder="Nome do item..." 
value={itemInput} 
onChange={e => setItemInput(e.target.value)} 
/>
<Input 
type="number" 
placeholder="Valor R$" 
style={{ width: 130 }} 
value={valorItemInput} 
onChange={e => setValorItemInput(e.target.value ? Number(e.target.value) : '')} 
/>
<Button type="primary" onClick={handleAddItemTemp}>Adicionar</Button>
</Space.Compact>
</div>

<div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0', maxHeight: 150, overflowY: 'auto' }}>
<Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>Itens na Lista Atual:</Text>
{tempItens.length === 0 ? (
<Text type="secondary" italic style={{ fontSize: 12 }}>Nenhum item adicionado ainda.</Text>
) : (
<List
size="small"
dataSource={tempItens}
renderItem={(item) => (
<List.Item style={{ padding: '4px 0' }}>
<Text>{item.nome}</Text>
<Text strong>R$ {item.valor.toFixed(2)}</Text>
</List.Item>
)}
/>
)}
</div>

<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, borderTop: '1px solid #e2e8f0' }}>
<Text type="secondary">Total Calculado:</Text>
<Title level={4} style={{ margin: 0, color: '#0f172a' }}>
R$ {tempItens.reduce((acc, i) => acc + i.valor, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
</Title>
</div>
</Space>
</Modal>

{/* MODAL: CONSULTA RÁPIDA */}
<Modal
title="🔍 Consulta Rápida de Estoque e Preços"
open={isConsultaOpen}
onCancel={() => setIsConsultaOpen(false)}
footer={[<Button key="close" onClick={() => setIsConsultaOpen(false)}>Fechar</Button>]}
>
<Space direction="vertical" style={{ width: '100%', marginTop: 8 }} size="middle">
<Input 
placeholder="Digite o nome do produto..." 
value={consultaQuery}
onChange={e => setConsultaQuery(e.target.value)}
allowClear
/>
<div style={{ maxHeight: 250, overflowY: 'auto' }}>
{ESTOQUE_MOCK.filter(e => e.nome.toLowerCase().includes(consultaQuery.toLowerCase())).length === 0 ? (
<Text type="secondary" italic style={{ textAlign: 'center', display: 'block', padding: '16px 0' }}>
Nenhum produto encontrado.
</Text>
) : (
<List
dataSource={ESTOQUE_MOCK.filter(e => e.nome.toLowerCase().includes(consultaQuery.toLowerCase()))}
renderItem={item => (
<List.Item style={{ background: '#f8fafc', padding: 12, marginBottom: 8, borderRadius: 8, border: '1px solid #e2e8f0' }}>
<div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
<div>
<Text strong>{item.nome}</Text>
<br />
<Text type="secondary" style={{ fontSize: 12 }}>Estoque disponível: <strong>{item.estoque} un</strong></Text>
</div>
<Text strong style={{ color: '#059669', fontSize: 15 }}>
{item.preco.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
</Text>
</div>
</List.Item>
)}
/>
)}
</div>
</Space>
</Modal>

{/* MODAL: GERIR CAIXA */}
<Modal
title="⚙️ Gestão de Caixa"
open={isCaixaOpen}
onCancel={() => setIsCaixaOpen(false)}
footer={[<Button key="close" type="primary" onClick={() => setIsCaixaOpen(false)}>Fechar</Button>]}
>
<Space direction="vertical" style={{ width: '100%', marginTop: 8 }} size="middle">
<Text>O Caixa atual encontra-se <strong>ABERTO</strong> na Operação 02.</Text>
<Card size="small" style={{ background: '#f8fafc' }}>
<Text type="secondary">Saldo Inicial: R$ 150,00</Text><br />
<Text type="secondary">Total Entradas (Hoje): {stats.vendasHojeTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</Text>
</Card>
</Space>
</Modal>

</div>
);
};

export default HubVendas;