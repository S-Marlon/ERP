import React, { useState, ChangeEvent, FormEvent } from 'react';
import { BotaoVoltar } from '../ui/BotaoVoltar'; // Componente de Voltar
import { Link } from 'react-router-dom'; // Adicionado para "Novo Cliente"
import PesquisaRapida from './PesquisaRapida';
import Button from '../ui/Button';
import Card from '../ui/Card';
import Typography from '../ui/Typography';
import FormControl from '../ui/FormControl';

// ----------------- TIPOS DE DADOS E MOCKS (Mantidos) -----------------
// ... (Interfaces e MOCKS permanecem aqui) ...

interface ItemCombinado {
    id: number;
    descricao: string;
    unidade: 'm2' | 'unidade' | 'hora' | 'servico';
    quantidade: number;
    valorUnitario: number;
}
// ... (ContratoData, ClienteSimples, CLIENTES_MOCK, initialState permanecem aqui) ...
const CLIENTES_MOCK = [
    { id: '', nome: 'Selecione um Cliente' },
    { id: 'cli-001', nome: 'João da Silva (PF)' },
    { id: 'cli-002', nome: 'Empresa Alpha Ltda (PJ)' },
    { id: 'cli-003', nome: 'Construtora Beta' },
];
const initialState: ContratoData = {
    clienteId: '',
    tituloContrato: '',
    dataAssinatura: new Date().toISOString().split('T')[0],
    valorTotalContrato: 0,
    dataPrevistaInicio: '',
    prazoEstimadoDias: 0,
    observacoesAdicionais: '',
    itensCombinados: [
        { id: Date.now(), descricao: '', unidade: 'servico', quantidade: 1, valorUnitario: 0 },
    ],
};


const CadastroContrato: React.FC = () => {
    const [formData, setFormData] = useState<ContratoData>(initialState);

    const subtotalItens = formData.itensCombinados.reduce(
        (acc, item) => acc + item.quantidade * item.valorUnitario,
        0
    );
    // ... (Handlers handleSimpleChange, handleItemChange, addItem, removeItem, handleSubmit permanecem aqui) ...

    const handleSimpleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;
        const finalValue = (type === 'number' || name === 'prazoEstimadoDias') 
            ? parseFloat(value) || 0 
            : value;
            
        setFormData(prevData => ({
          ...prevData,
          [name as keyof ContratoData]: finalValue,
          // Se o usuário mexer no valor total, ele assume a prioridade
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
        alert(`Contrato "${contratoFinal.tituloContrato}" criado e processo de obra iniciado para o cliente ${contratoFinal.clienteId}!`);
    };

    // Formatação de moeda
    const formatCurrency = (value: number) => 
        new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);


    return (
        <form onSubmit={handleSubmit} className="form-container">
            <div className='form-header'>
                <BotaoVoltar />
                <Typography variant="h1Alt">Criação de Contrato de Obra</Typography>
            </div>

            <div className='grid-main-layout'>
                {/* COLUNA ESQUERDA */}
                <div className='col-left'>
                    {/* <PesquisaRapida/> */}
                    <Card>
                        <Typography variant="h2Alt">Dados Contratuais e Prazos</Typography>
                        <FormControl
                            label="Cliente Associado"
                            name="clienteId"
                            control="select"
                            value={formData.clienteId}
                            onChange={handleSimpleChange}
                            options={CLIENTES_MOCK.map(c => ({ value: c.id, label: c.nome }))}
                            required
                        />
                        <div className='input-group'>
                            <Typography variant="pMuted">
                                Campo de busca de cliente abrirá um modal para pesquisa de cliente
                            </Typography>
                            <Link to="/clientes/novo" className='new-action-link'>+ Novo</Link>
                        </div>
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
                        <div className="form-row three-cols-mini">
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
                        </div>
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
                        <table className="itens-table">
                            <thead>
                                <tr>
                                    <th>Descrição do Item/Serviço</th>
                                    <th style={{ width: '80px' }}>Qtd.</th>
                                    <th style={{ width: '100px' }}>Unidade</th>
                                    <th style={{ width: '120px' }}>Valor Unitário</th>
                                    <th style={{ width: '120px' }}>Subtotal</th>
                                    <th style={{ width: '40px' }}></th>
                                </tr>
                            </thead>
                            <tbody>
                                {formData.itensCombinados.map(item => (
                                    <tr key={item.id}>
                                        <td>
                                            <FormControl
                                                name={`descricao-${item.id}`}
                                                value={item.descricao}
                                                onChange={e => handleItemChange(item.id, 'descricao', e.target.value)}
                                                placeholder="Descrição do serviço/etapa"
                                                required label={''}                                            />
                                        </td>
                                        <td>
                                            <FormControl
                                                name={`quantidade-${item.id}`}
                                                type="number"
                                                value={item.quantidade}
                                                onChange={e => handleItemChange(item.id, 'quantidade', e.target.value)}
                                                min={1}
                                                required
                                            />
                                        </td>
                                        <td>
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
                                                ]} label={''}                                            />
                                        </td>
                                        <td>
                                            <FormControl
                                                name={`valorUnitario-${item.id}`}
                                                type="number"
                                                value={item.valorUnitario}
                                                onChange={e => handleItemChange(item.id, 'valorUnitario', e.target.value)}
                                                placeholder="0.00"
                                                min={0}
                                            />
                                        </td>
                                        <td className="subtotal-cell">
                                            {formatCurrency(item.quantidade * item.valorUnitario)}
                                        </td>
                                        <td>
                                            <Button
                                                type="button"
                                                variant="danger"
                                                onClick={() => removeItem(item.id)}
                                                style={{ width: "100%" }}
                                            >
                                                <span role="img" aria-label="Remover">🗑️</span>
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <Button type="button" variant="success" onClick={addItem} style={{ width: "100%", marginTop: 10 }}>
                            + Adicionar Novo Item
                        </Button>
                        <FormControl
                            label="Inserir Valor Total do Contrato (R$) Manualmente"
                            name="valorTotalContrato"
                            type="number"
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
            </div>
            <Button type="submit" variant="primary" style={{ width: "100%", marginTop: 20 }}>
                Salvar Contrato e Iniciar Processo de Obra
            </Button>
        </form>
    );
};


// ----------------- ESTILOS (CSS) REFINADOS -----------------
const style = `
.form-container {
    max-width: 90%;
    margin: 20px auto;
    padding: 30px;
    border: 1px solid #e0e0e0;
    border-radius: 12px;
    box-shadow: 0 8px 20px rgba(0,0,0,0.1);
    background-color: #ffffff;
    font-family: Arial, sans-serif;
}
.form-header {
    display: flex;
    align-items: center;
    margin-bottom: 25px;
}
.form-header h1 { 
    margin: 0 0 0 15px; 
    color: #007bff; 
    font-size: 1.8em;
    border-bottom: none;
    padding-bottom: 0;
    flex-grow: 1; /* Permite que o título ocupe o espaço restante */
}

label { display: block; margin-bottom: 5px; font-weight: 600; color: #495057; }
input[type="text"],
input[type="number"],
input[type="date"],
select,
textarea {
    width: 100%;
    padding: 10px;
    border: 1px solid #ced4da;
    border-radius: 4px;
    box-sizing: border-box;
    margin-bottom: 15px; /* Aumentado o espaçamento */
    transition: border-color 0.2s;
}
input:focus, select:focus, textarea:focus {
    border-color: #007bff;
    box-shadow: 0 0 0 0.2rem rgba(0,123,255,.25);
    outline: none;
}
textarea { resize: vertical; }

/* Layout Principal e Colunas */
.grid-main-layout { 
    display: grid; 
    grid-template-columns: 1fr 1.5fr; /* 1ª Coluna menor, 2ª Coluna maior para itens */
    gap: 30px; 
    align-items: start;
}
.form-row { display: flex; gap: 10px; margin-bottom: 10px; }
.form-row > div { flex: 1; }
.three-cols-mini > div { flex: 1; }

/* Campo com Link/Botão Adicional (Cliente) */
.field-with-action .input-group {
    display: flex;
    gap: 5px;
}
.field-with-action select {
    flex-grow: 1;
    margin-bottom: 0;
}
.new-action-link {
    display: flex;
    align-items: center;
    padding: 0 10px;
    background-color: #17a2b8; /* Cor secundária/informativa */
    color: white;
    text-decoration: none;
    border-radius: 4px;
    font-weight: bold;
    height: 40px; /* Alinhar com o input */
    margin-bottom: 15px;
}
.new-action-link:hover { background-color: #138496; }


.itens-table th {
    background-color: #292f34ff;
    border-bottom: 2px solid #007bff;
    padding: 10px;
    text-align: left;
    font-size: 0.9em;
}
.itens-table td {
    padding: 0; /* Remove padding da célula */
    vertical-align: top;
}
.itens-table td input, 
.itens-table td select {
    margin: 0; /* Remove margin do input dentro da célula */
    border: none;
    border-radius: 0;
    padding: 10px;
    height: 100%;
}
.itens-table tr:nth-child(even) td { background-color: #fbfbfb; }

.subtotal-cell {
    font-weight: bold;
    color: #28a745;
    text-align: right;
    padding: 10px;
    background-color: #e6ffed; /* Fundo suave para subtotal */
}

/* Botões de Adicionar/Remover (Refinados) */
.add-button { 
    background-color: #28a745; 
    color: white; 
    width: 100%; 
    margin-top: 15px; 
}
.add-button:hover { background-color: #1e7e34; }

.remove-button-icon { 
    background: none; 
    border: none; 
    cursor: pointer; 
    color: #dc3545; 
    font-size: 1.1em;
    padding: 8px; 
    line-height: 1;
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
}
.remove-button-icon:hover { background-color: #ffe8e8; }

/* Seção de Valor Total */
.valor-total-section {
    background-color: #f0f8ff; /* Azul clarinho para destaque */
    padding: 20px;
    border-radius: 8px;
    margin-top: 20px;
    border: 1px solid #b3d7ff;
}
.subtotal-info {
    text-align: right;
    font-size: 1.2em;
    color: #28a745;
    margin-bottom: 10px;
    padding-bottom: 10px;
    border-bottom: 1px dashed #b3d7ff;
}
.valor-total-info {
    display: block;
    margin-top: -5px;
    color: #6c757d;
}

.submit-button { 
    background-color: #007bff; 
    color: white; 
    font-size: 1.2em; 
    padding: 15px; 
    margin-top: 25px;
    width: 100%;
}
.submit-button:hover { background-color: #0056b3; }
`;

// Opcional: Adicionar estilos ao DOM para visualização
if (typeof document !== 'undefined') {
    const styleTag = document.createElement('style');
    styleTag.textContent = style;
    document.head.appendChild(styleTag);
}


export default CadastroContrato;