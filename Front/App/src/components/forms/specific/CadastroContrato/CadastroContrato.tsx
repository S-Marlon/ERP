import React, { useState, ChangeEvent, FormEvent } from 'react';
// Importação do seu componente Table e tipagem
import Table from '../../../ui/Table/Table';
import { TableColumn } from '../ui/Table.types'; 
import Button from '../../../ui/Button/Button';
import FormControl from '../../../ui/FormControl/FormControl';
import Typography from '../../../ui/Typography/Typography';
import Card from '../../../ui/Card/Card';
import { Link } from 'react-router-dom';
import FlexGridContainer from '../../../Layout/FlexGridContainer/FlexGridContainer';
import ClienteSelect from '../../search/BuscaCliente';
// Importação do tipo Cliente (presumindo que está em outro lugar ou no ClienteSelect)
// type Cliente = any; 

// ----------------- TIPOS DE DADOS E MOCKS -----------------

type UnidadeMedida = 'm2' | 'unidade' | 'hora' | 'servico';
type StatusContrato = 'Rascunho' | 'Aguardando Aprovação' | 'Assinado' | 'Em Execução' | 'Concluído' | 'Cancelado';
// NOVO TIPO DE CONTRATO ADICIONADO para resolver o problema de duplicidade de 'tituloContrato'
type TipoContratoEnum = 'Formal' | 'Informal';

interface ItemCombinado {
    id: number;
    descricao: string;
    unidade: UnidadeMedida;
    quantidade: number;
    valorUnitario: number;
}

interface ContratoData {
    clienteId: string;
    tituloContrato: string;
    dataAssinatura: string; 
    prazoEstimadoDias: number;
    observacoesAdicionais: string;
    itensCombinados: ItemCombinado[];
    
    // === CAMPOS DE ENDEREÇO (Adicionados anteriormente) ===
  
    // === NOVOS CAMPOS FINANCEIROS E DE PAGAMENTO ===
    valorTotalContrato: number; // MANTIDO: movido para essa seção lógica
    condicoesPagamento: string; // MANTIDO: movido para essa seção lógica
    descontoTotal: number;
    
    // === NOVOS CAMPOS DE GERENCIAMENTO E ESCOPO ===
    responsavelTecnicoId: string; // Ex: ID do usuário interno
    statusContrato: StatusContrato;
    numeroContrato: string; // Pode ser gerado pelo backend, mas pre-visualizado aqui
    tipoContrato: TipoContratoEnum; // NOVO CAMPO ADICIONADO
    dataPrevistaInicio: string; // FALHA 1 CORRIGIDA: Campo de data ausente
    
    // === NOVOS CAMPOS DE DOCUMENTAÇÃO ===
    linkContratoDigital: string;
}

// ----------------- ESTADO INICIAL -----------------

// Função auxiliar para gerar um item inicial
const createInitialItem = (): ItemCombinado => ({
    id: Date.now(), 
    descricao: 'Perfuração inicial/Serviço principal', 
    unidade: 'servico', 
    quantidade: 1, 
    valorUnitario: 0
});

const initialState: ContratoData = {
    clienteId: '',
    tituloContrato: 'Perfuração',
    dataAssinatura: new Date().toISOString().substring(0, 10), // Data de hoje como default
    dataPrevistaInicio: new Date().toISOString().substring(0, 10), // FALHA 1 CORRIGIDA: Data de hoje como default
    prazoEstimadoDias: 30,
    observacoesAdicionais: '',
    itensCombinados: [
        createInitialItem(),
    ],
    
   
    // Valores Iniciais - Financeiros
    valorTotalContrato: 0,
    condicoesPagamento: 'À vista',
    descontoTotal: 0,
    
    // Valores Iniciais - Gerenciamento
    statusContrato: 'Rascunho',
    numeroContrato: '', // Será preenchido ou gerado
    tipoContrato: 'Formal', // FALHA 2 CORRIGIDA: Valor inicial para novo campo
    
    // Valores Iniciais - Documentação
    linkContratoDigital: '',
};

// ----------------- COMPONENTE PRINCIPAL -----------------

const CadastroContrato: React.FC = () => {
    
    const [formData, setFormData] = useState<ContratoData>(initialState);
    const [clienteSelecionado, setClienteSelecionado] = useState<any | null>(null); // Use 'Cliente' se estiver importado
    const [isSaving, setIsSaving] = useState(false); 

   

    // Calcula a soma dos subtotais dos itens
    const subtotalItens = formData.itensCombinados.reduce(
        (acc, item) => acc + item.quantidade * item.valorUnitario,
        0
    );
    
    // Calcula o valor total sugerido
    const valorSugerido = subtotalItens - formData.descontoTotal;

    const formatCurrency = (value: number) =>
        new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);


    // --- Handlers ---
    
    const handleClienteChange = (cliente: any | null) => { 
        setClienteSelecionado(cliente);
        setFormData(prevData => ({
            ...prevData,
            clienteId: cliente?.id || '',
        }));
    };

    
    
    const handleSimpleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;

        let finalValue: string | number;

        // FALHA 3 CORRIGIDA: Refinado para incluir todos os campos numéricos.
        // O TSX infere 'ChangeEvent<HTMLSelectElement | HTMLTextAreaElement>' se for select/textarea,
        // mas é seguro verificar o 'name' para valores numéricos que vêm de input[type="number"] ou select/textarea que armazenam número.
        if (type === 'number' || name === 'prazoEstimadoDias' || name === 'valorTotalContrato' || name === 'descontoTotal') {
            // Garante que campos numéricos sejam tratados como números
            finalValue = parseFloat(value) || 0;
        } else {
            finalValue = value;
        }

        setFormData(prevData => ({
            ...prevData,
            // O 'as any' é necessário porque o `name` é 'string', mas o TS precisa saber que é uma chave válida de ContratoData
            [name as keyof ContratoData]: finalValue as any, 
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
                createInitialItem(),
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
        e.preventDefault();
        
        if (!clienteSelecionado?.id) {
             alert("Por favor, selecione um cliente para o contrato.");
             return;
        }
        
        const contratoFinal: ContratoData = {
            ...formData,
            clienteId: clienteSelecionado.id, 
            // Define o valor total, se for 0 usa o valor sugerido (subtotal - desconto)
            valorTotalContrato: formData.valorTotalContrato > 0 ? formData.valorTotalContrato : valorSugerido, 
        };
        
        console.log('CONTRATO CRIADO E ADICIONADO À FILA DE OBRAS:', contratoFinal);
        alert(`Contrato "${contratoFinal.tituloContrato}" criado!`);
        // Lógica de envio da API aqui
    };

    // ... Definição de colunas (omitida para brevidade, mas igual à anterior) ...
    const colunasItens: TableColumn<ItemCombinado>[] = [
        { key: 'descricao', header: 'Descrição do Item/Serviço', render: (item: ItemCombinado) => ( <FormControl name={`descricao-${item.id}`} value={item.descricao} onChange={e => handleItemChange(item.id, 'descricao', e.target.value)} placeholder="Descrição do serviço/etapa" label={''} /> ) },
        { key: 'quantidade', header: 'Qtd.', style: { width: '20px' }, render: (item: ItemCombinado) => ( <FormControl name={`quantidade-${item.id}`} type="number" value={item.quantidade} onChange={e => handleItemChange(item.id, 'quantidade', e.target.value)} min={1} label={''} /> ) },
        { key: 'unidade', header: 'Unidade', style: { width: '100px' }, render: (item: ItemCombinado) => ( <FormControl name={`unidade-${item.id}`} control="select" value={item.unidade} onChange={e => handleItemChange(item.id, 'unidade', e.target.value)} options={[ { value: "servico", label: "Serviço" }, { value: "unidade", label: "Unidade" }, { value: "m2", label: "m²" }, { value: "hora", label: "Hora" } ]} label={''} /> ) },
        { key: 'valorUnitario', header: 'Valor Unitário', style: { width: '120px' }, render: (item: ItemCombinado) => ( <FormControl name={`valorUnitario-${item.id}`} type="number" value={item.valorUnitario} onChange={e => handleItemChange(item.id, 'valorUnitario', e.target.value)} placeholder="0.00" min={0} label={''} /> ) },
        { key: 'subtotal' as keyof ItemCombinado, header: 'Subtotal', style: { width: '120px', textAlign: 'right', fontWeight: 'bold' }, cellClass: 'subtotal-cell', render: (item: ItemCombinado) => ( formatCurrency(item.quantidade * item.valorUnitario) ) },
        { key: 'actions' as keyof ItemCombinado, header: '', style: { width: '20px' }, render: (item: ItemCombinado) => ( <Button type="button" variant="danger" onClick={() => removeItem(item.id)} style={{ width: "100%" }}><span role="img" aria-label="Remover">🗑️</span></Button> ) },
    ];
    // ----------------- RENDERIZAÇÃO -----------------
    return (
        <form onSubmit={handleSubmit} >
            <div>
                <Typography variant="h1Alt">Criação de Contrato de Obra</Typography>
                <Button variant='outline'>Relacionar com poço existente</Button>
            </div>

            <FlexGridContainer layout='grid' template='2fr 3fr'  gap='10px'>
                {/* COLUNA ESQUERDA */}
                <FlexGridContainer layout='flex' template='column' gap='10px'>
                    {/* SEÇÃO 1: CLIENTE E SERVIÇO */}
                    <Card>
                        <Typography variant="h2Alt">Cliente Relacionado</Typography>
                        
                        <ClienteSelect
                                entitySelecionada={clienteSelecionado}
                                onEntitySelecionadaChange={handleClienteChange}
                                isLoading={isSaving}
                            />
                        
                        
                    </Card>

                    

                    

                    {/* SEÇÃO 3: GERENCIAMENTO E PRAZOS (Novo/Ajustado) */}
                    <Card>
                        <Typography variant="h2Alt">Gerenciamento e Prazos</Typography>
                        
                        <FlexGridContainer layout='grid' template='1fr 1fr 1fr 1fr' gap='10px'>

                            <FormControl
                                label="Codigo do Contrato"
                                name="numeroContrato"
                                value={formData.numeroContrato}
                                onChange={handleSimpleChange}
                                placeholder="Auto-gerado"
                                readOnlyDisplay={true}
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


                            <FormControl
                                // FALHA 2 CORRIGIDA: Usa a nova propriedade 'tipoContrato'
                                label="Tipo de contrato"
                                name="tipoContrato" 
                                control="select"
                                value={formData.tipoContrato}
                                onChange={handleSimpleChange}
                                options={[
                                    { value: "Formal", label: "Formal" },
                                    { value: "Informal", label: "Informal" },
                                    
                                ]}
                                required
                            />
                            <FormControl
                                label="Status Inicial"
                                name="statusContrato"
                                control="select"
                                value={formData.statusContrato}
                                onChange={handleSimpleChange}
                                options={[
                                    { value: 'Rascunho', label: 'Rascunho' },
                                    { value: 'Aguardando Aprovação', label: 'Aguardando Aprovação' },
                                    { value: 'Assinado', label: 'Assinado' },
                                    { value: 'Em Execução', label: 'Em Execução' },
                                ]}
                                required
                            />
                        </FlexGridContainer>
                        
                        

                        <FlexGridContainer layout='grid' template='1fr 1fr 1fr' gap='10px'>
                            <FormControl
                                label="Assinatura"
                                name="dataAssinatura"
                                type="date"
                                value={formData.dataAssinatura}
                                onChange={handleSimpleChange}
                                required
                            />
                            <FormControl
                                // FALHA 1 CORRIGIDA: Acesso à nova propriedade
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

                    {/* SEÇÃO 5: DOCUMENTAÇÃO E OBSERVAÇÕES (Novo/Ajustado) */}
                    <Card>
                        <Typography variant="h2Alt">Documentação e Observações</Typography>
                        <FormControl
                            label="Link para Contrato Assinado (Drive, Dropbox, etc.)"
                            name="linkContratoDigital"
                            value={formData.linkContratoDigital}
                            onChange={handleSimpleChange}
                            placeholder="URL do arquivo PDF/digitalizado"
                        />
                        <FormControl
                            label="Observações Adicionais"
                            name="observacoesAdicionais"
                            control="textarea"
                            value={formData.observacoesAdicionais}
                            onChange={handleSimpleChange}
                            rows={4}
                            placeholder="Detalhes sobre pagamento, garantias, especificações técnicas não listadas no escopo..."
                        />
                    </Card>
                </FlexGridContainer>

                {/* COLUNA DIREITA - ESCOPO E TOTAIS */}
                <FlexGridContainer layout='flex' template='column' gap='10px'>
                    <Card>
                        <Typography variant="h2Alt">Itens e Serviços Combinados (Escopo)</Typography>
                        
                        
                           <Table<ItemCombinado> 
                                data={formData.itensCombinados} 
                                columns={colunasItens} 
                                variant="borderless" 
                            />
                        <Button type="button" variant="success" onClick={addItem} style={{ width: "100%", marginTop: 10 }}>
                            + Adicionar Novo Item
                        </Button>
                        
                        {/* Valor Total Manual */}
                        <FormControl
                            label="Valor Total do Contrato (R$) FINAL"
                            name="valorTotalContrato"
                            type="number"
                            // Exibe o valor total preenchido, ou o sugerido se nada for preenchido
                            value={formData.valorTotalContrato > 0 ? formData.valorTotalContrato : valorSugerido} 
                            onChange={handleSimpleChange}
                            placeholder={`Valor Sugerido: ${valorSugerido.toFixed(2)}`}
                            min={0}
                        />
                        <Typography variant="small">
                            Use o valor final que aparecerá no contrato. Se deixado em branco, será **{formatCurrency(valorSugerido)}**.
                        </Typography>
                    </Card>

                        <FlexGridContainer layout='grid' template='1fr 1fr'>
{/* SEÇÃO 4: FINANCEIROS E PAGAMENTO (Novo) */}
                    <Card>
                        <Typography variant="h2Alt">Dados Financeiros e Faturamento</Typography>

                        <FormControl
                            label="Condições de Pagamento"
                            name="condicoesPagamento"
                            value={formData.condicoesPagamento}
                            control="select"
                            onChange={handleSimpleChange}
                            options={[
                                { value: 'À vista', label: 'À vista' },
                                { value: '2x', label: 'Parcelado em 2x' },
                                { value: '3x', label: 'Parcelado em 3x' },
                                { value: 'Customizado', label: 'Personalizado (detalhar nas observações)' }
                            ]}
                            required
                        />
                           <FlexGridContainer layout='grid' template='1fr 1fr'>
                                
                                <FormControl
                                    label="Desconto Total (R$)"
                                    name="descontoTotal"
                                    type="number"
                                    value={formData.descontoTotal}
                                    onChange={handleSimpleChange}
                                    placeholder="0.00"
                                    min={0}
                                />
                           </FlexGridContainer>
                        <Typography variant="small" >
                            Valor Sugerido: **{formatCurrency(valorSugerido)}** (Subtotal menos desconto).
                        </Typography>
                    </Card>

                    <Card>
                        
                            <Typography variant="strong">
                                Subtotal Bruto (Itens): {formatCurrency(subtotalItens)}
                            </Typography>
                            <Typography variant="strong" style={{ color: 'red' }}>
                                Desconto Aplicado: - {formatCurrency(formData.descontoTotal)}
                            </Typography>
                             <Typography variant="h3" style={{ borderTop: '1px dashed #ccc', paddingTop: '10px' }}>
                                 VALOR TOTAL FINAL: {formatCurrency(formData.valorTotalContrato > 0 ? formData.valorTotalContrato : valorSugerido)}
                            </Typography>
                        

                        
                    </Card>

                     <Button 
                type="submit" 
                variant="primary" 
                
                disabled={isSaving} 
            >
                {isSaving ? 'Salvando...' : 'Salvar Contrato e Iniciar Processo de Obra'}
            </Button>
                     <Button 
                type="submit" 
                variant="primary" 
                disabled={isSaving} 
            >
                {isSaving ? 'Salvando...' : 'Salvar Contrato e Iniciar Processo de Obra'}
            </Button>
                    
                    </FlexGridContainer>


                    

                </FlexGridContainer>
            </FlexGridContainer>
            
           

            {/* SNIPPET DE DEBUG */}
            <Card style={{ marginTop: 30, backgroundColor: '#f0f0f0', border: '1px solid #ccc' }}>
                <Typography variant="h3" style={{ color: '#000000' }}>🔍 DEBUG: Dados Atuais do Formulário</Typography>
                <pre style={{ 
                    whiteSpace: 'pre-wrap', 
                    wordBreak: 'break-all', 
                    maxHeight: '400px',
                    overflowY: 'auto',
                    backgroundColor: 'white',
                    padding: '10px',
                    borderRadius: '4px',
                    color: '#000000'
                }}>
                    {JSON.stringify(formData, null, 2)}
                </pre>
            </Card>
        </form>
    );
};

export default CadastroContrato;