import React, { useState, ChangeEvent, FormEvent } from 'react';
// Importação do seu componente Table e tipagem
import Table from '../../ui/Table';
import { TableColumn } from '../ui/Table.types'; 
import Button from '../../ui/Button';
import FormControl from '../../ui/FormControl';
import Typography from '../../ui/Typography';
import Card from '../../ui/Card';
import { Link } from 'react-router-dom';
import FlexGridContainer from '../../Layout/FlexGridContainer/FlexGridContainer';
import ClienteSelect, { Cliente } from './BuscaCliente';

// ----------------- TIPOS DE DADOS E MOCKS -----------------

type UnidadeMedida = 'm2' | 'unidade' | 'hora' | 'servico';

interface ItemCombinado {
    id: number;
    descricao: string;
    unidade: UnidadeMedida;
    quantidade: number;
    valorUnitario: number;
}

interface ClienteSimples {
    id: string;
    nome: string;
}

// O tipo Cliente é importado de BuscaCliente.tsx (ver import acima)

interface ContratoData {
    clienteId: string;
    tituloContrato: string;
    dataAssinatura: string; 
    valorTotalContrato: number;
    dataPrevistaInicio: string;
    prazoEstimadoDias: number;
    observacoesAdicionais: string;
    itensCombinados: ItemCombinado[];
}

const CLIENTES_MOCK: ClienteSimples[] = [
    { id: '', nome: 'Selecione um Cliente' },
    { id: 'cli-001', nome: 'João da Silva (PF)' },
    // ...
];

const initialState: ContratoData = {
    // ...
    itensCombinados: [
        { id: Date.now(), descricao: '', unidade: 'servico', quantidade: 1, valorUnitario: 0 },
    ],
    // ...
};

// ----------------- COMPONENTE PRINCIPAL -----------------

const CadastroContrato: React.FC = () => {
    const [formData, setFormData] = useState<ContratoData>(initialState);

    const subtotalItens = formData.itensCombinados.reduce(
        (acc, item) => acc + item.quantidade * item.valorUnitario,
        0
    );

    // --- Handlers ---
    
    const handleSimpleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;
        const finalValue = (type === 'number' || name === 'prazoEstimadoDias' || name === 'valorTotalContrato')
            ? parseFloat(value) || 0
            : value;

        setFormData(prevData => ({
            ...prevData,
            [name as keyof ContratoData]: finalValue,
            valorTotalContrato: name === 'valorTotalContrato' ? finalValue as number : prevData.valorTotalContrato
        }));
    };

    const handleItemChange = (id: number, field: keyof ItemCombinado, value: string | number) => {
        setFormData(prevData => ({
            ...prevData,
            itensCombinados: prevData.itensCombinados.map(item => {
                if (item.id === id) {
                    const finalValue = (field === 'quantidade' || field === 'valorUnitario')
                        ? parseFloat(value as string) || 0
                        : value;

                    // O 'as any' é necessário porque `value` pode ser string, e TypeScript reclama da atribuição.
                    return { ...item, [field]: finalValue as any }; 
                }
                return item;
            }),
        }));
    };

    const addItem = () => {
        setFormData(prevData => ({
            ...prevData,
            itensCombinados: [
                ...prevData.itensCombinados,
                { id: Date.now(), descricao: '', unidade: 'servico', quantidade: 1, valorUnitario: 0 },
            ],
        }));
    };

    const removeItem = (id: number) => {
        if (formData.itensCombinados.length <= 1) {
            alert("O contrato deve ter pelo menos um item combinado.");
            return;
        }
        setFormData(prevData => ({
            ...prevData,
            itensCombinados: prevData.itensCombinados.filter(item => item.id !== id),
        }));
    };

    const handleSubmit = (e: FormEvent) => {
        // ... (lógica do handleSubmit) ...
        e.preventDefault();
        if (!formData.clienteId) {
             alert("Por favor, selecione um cliente para o contrato.");
             return;
        }
        const contratoFinal: ContratoData = {
            ...formData,
            valorTotalContrato: formData.valorTotalContrato > 0 ? formData.valorTotalContrato : subtotalItens,
        };
        console.log('CONTRATO CRIADO E ADICIONADO À FILA DE OBRAS:', contratoFinal);
        alert(`Contrato "${contratoFinal.tituloContrato}" criado!`);
    };

    const formatCurrency = (value: number) =>
        new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

    // ----------------- DEFINIÇÃO DAS COLUNAS PARA <Table> -----------------
    
    // Define as colunas, tipando com ItemCombinado
    const colunasItens: TableColumn<ItemCombinado>[] = [
        {
            key: 'descricao',
            header: 'Descrição do Item/Serviço',
            // Renderiza o FormControl para a descrição
            render: (item: ItemCombinado) => (
                <FormControl
                    name={`descricao-${item.id}`}
                    value={item.descricao}
                    onChange={e => handleItemChange(item.id, 'descricao', e.target.value)}
                    placeholder="Descrição do serviço/etapa"
                    // required 
                    label={''} 
                />
            ),
        },
        {
            key: 'quantidade',
            header: 'Qtd.',
            style: { width: '80px' }, // Definindo largura opcionalmente via style
            render: (item: ItemCombinado) => (
                <FormControl
                    name={`quantidade-${item.id}`}
                    type="number"
                    value={item.quantidade}
                    onChange={e => handleItemChange(item.id, 'quantidade', e.target.value)}
                    min={1}
                    // required
                    label={''}
                />
            ),
        },
        {
            key: 'unidade',
            header: 'Unidade',
            style: { width: '100px' },
            render: (item: ItemCombinado) => (
                <FormControl
                    name={`unidade-${item.id}`}
                    control="select"
                    value={item.unidade}
                    onChange={e => handleItemChange(item.id, 'unidade', e.target.value)}
                    options={[
                        { value: "servico", label: "Serviço" },
                        { value: "unidade", label: "Unidade" },
                        { value: "m2", label: "m²" },
                        { value: "hora", label: "Hora" }
                    ]} 
                    label={''} 
                />
            ),
        },
        {
            key: 'valorUnitario',
            header: 'Valor Unitário',
            style: { width: '120px' },
            render: (item: ItemCombinado) => (
                <FormControl
                    name={`valorUnitario-${item.id}`}
                    type="number"
                    value={item.valorUnitario}
                    onChange={e => handleItemChange(item.id, 'valorUnitario', e.target.value)}
                    placeholder="0.00"
                    min={0}
                    label={''}
                />
            ),
        },
        {
            // Coluna virtual (não existe no ItemCombinado, mas exibe um valor calculado)
            key: 'subtotal' as keyof ItemCombinado, 
            header: 'Subtotal',
            style: { width: '120px', textAlign: 'right', fontWeight: 'bold' },
            cellClass: 'subtotal-cell',
            render: (item: ItemCombinado) => (
                formatCurrency(item.quantidade * item.valorUnitario)
            ),
        },
        {
            key: 'actions' as keyof ItemCombinado,
            header: '', // Cabeçalho vazio para a coluna de ações
            style: { width: '40px' },
            render: (item: ItemCombinado) => (
                <Button
                    type="button"
                    variant="danger"
                    onClick={() => removeItem(item.id)}
                    style={{ width: "100%" }}
                >
                    <span role="img" aria-label="Remover">🗑️</span>
                </Button>
            ),
        },
    ];


    const [clienteSelecionado, setClienteSelecionado] = useState<Cliente | null>(null);
    // Você pode usar este estado para simular um loading externo se precisar
    const [isSaving, setIsSaving] = useState(false); 

    const handleClienteChange = (cliente: Cliente | null) => {
        setClienteSelecionado(cliente);
        console.log('Cliente selecionado mudou:', cliente);
    };
    // ----------------- RENDERIZAÇÃO -----------------
    return (
        <form onSubmit={handleSubmit} className="cliente-form-container">
            <div className='form-header'>
                <Typography variant="h1Alt">Criação de Contrato de Obra</Typography>
            </div>

            <FlexGridContainer layout='grid' template='1fr 2fr'>
                {/* COLUNA ESQUERDA */}
                <div className='col-left'>
                    {/* ... (Seção de Dados Contratuais e Prazos) ... */}
                    <Card>
                        <Typography variant="h2Alt">Dados Contratuais e Prazos</Typography>
                        
                            <ClienteSelect
                clienteSelecionado={clienteSelecionado}
                onClienteSelecionadoChange={handleClienteChange}
                // Passando o estado de loading externo
                isLoading={isSaving} 
            />
                           
                        
                        <FormControl
                            label="Serviço prestado"
                            name="tituloContrato"
                            control="select"
                            value={formData.tituloContrato}
                            onChange={handleSimpleChange}
                            options={[
                                { value: "Perfuração", label: "Perfuração" },
                                { value: "Manutenção", label: "Manutenção" },
                                { value: "Consultoria", label: "Consultoria" },
                                { value: "Radiestesia", label: "Radiestesia" }
                            ]}
                            required
                        />

                        <FlexGridContainer layout='grid' template='1fr 1fr 1fr'>

                       
                            <FormControl
                                label="Assinatura"
                                name="dataAssinatura"
                                type="date"
                                value={formData.dataAssinatura}
                                onChange={handleSimpleChange}
                                required
                            />
                            <FormControl
                                label="Início Previsto"
                                name="dataPrevistaInicio"
                                type="date"
                                value={formData.dataPrevistaInicio}
                                onChange={handleSimpleChange}
                                required
                            />
                            <FormControl
                                label="Prazo Est. (dias)"
                                name="prazoEstimadoDias"
                                type="number"
                                value={formData.prazoEstimadoDias}
                                onChange={handleSimpleChange}
                                min={1}
                                required
                            />
                        </FlexGridContainer>
                    </Card>
                    <Card>
                        <Typography variant="h2Alt">Observações Adicionais</Typography>
                        <FormControl
                            label="Observações"
                            name="observacoesAdicionais"
                            control="textarea"
                            value={formData.observacoesAdicionais}
                            onChange={handleSimpleChange}
                            rows={6}
                            placeholder="Registre informações importantes, condições de pagamento, garantias, e demais detalhes..."
                        />
                    </Card>
                </div>

                {/* COLUNA DIREITA */}
                <div className='col-right'>
                    <Card>
                        <Typography variant="h2Alt">Itens e Serviços Combinados (Escopo)</Typography>
                        
                        {/* Removido: O uso do componente Table genérico que estava com tipagem incorreta/faltante */}
                        {/* <Table<Produto> data={produtos} columns={colunasProdutos} caption="Lista de produtos disponíveis na loja." /> */}
                        
                         <Table<ItemCombinado> 
                            data={formData.itensCombinados} 
                            columns={colunasItens} 
                            variant="borderless" // Você pode escolher a variante
                        />
                        <Button type="button" variant="success" onClick={addItem} style={{ width: "100%", marginTop: 10 }}>
                            + Adicionar Novo Item
                        </Button>
                        <FormControl
                            label="Inserir Valor Total do Contrato (R$) Manualmente"
                            name="valorTotalContrato"
                            type="number"
                            // Se formData.valorTotalContrato for 0 (default), mostra o subtotal
                            value={formData.valorTotalContrato || subtotalItens} 
                            onChange={handleSimpleChange}
                            placeholder={`Sugestão: ${subtotalItens.toFixed(2)}`}
                            min={0}
                        />
                        <Typography variant="small" className='valor-total-info'>
                            Preencha com o valor final acordado, que pode incluir impostos ou descontos não detalhados nos itens.
                        </Typography>
                    </Card>
                    <Card>
                        <div className='valor-total-section'>
                            <Typography variant="strong" className='subtotal-info'>
                                Subtotal dos Itens: {formatCurrency(subtotalItens)}
                            </Typography>
                        </div>
                    </Card>
                </div>
            </FlexGridContainer>
            <Button type="submit" variant="primary" style={{ width: "100%", marginTop: 20 }}>
                Salvar Contrato e Iniciar Processo de Obra
            </Button>
        </form>
    );
};

export default CadastroContrato;