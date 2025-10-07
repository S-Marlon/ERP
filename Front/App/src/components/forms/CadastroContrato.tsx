import React, { useState, ChangeEvent, FormEvent } from 'react';

// ----------------- TIPOS DE DADOS E MOCKS -----------------

// Definições de tipos (Interfaces) - as mesmas definidas acima
interface ItemCombinado {
  id: number;
  descricao: string;
  unidade: 'm2' | 'unidade' | 'hora' | 'servico';
  quantidade: number;
  valorUnitario: number;
}

interface ContratoData {
  clienteId: string;
  tituloContrato: string;
  dataAssinatura: string;
  valorTotalContrato: number; // Será calculado dinamicamente ou preenchido manualmente
  dataPrevistaInicio: string;
  prazoEstimadoDias: number;
  itensCombinados: ItemCombinado[];
  observacoesAdicionais: string;
}

interface ClienteSimples {
    id: string;
    nome: string;
}

const CLIENTES_MOCK: ClienteSimples[] = [
    { id: '', nome: 'Selecione um Cliente' }, // Opção padrão
    { id: 'cli-001', nome: 'João da Silva (PF)' },
    { id: 'cli-002', nome: 'Empresa Alpha Ltda (PJ)' },
    { id: 'cli-003', nome: 'Construtora Beta' },
];

// ----------------- ESTADO INICIAL -----------------

const initialState: ContratoData = {
  clienteId: '',
  tituloContrato: '',
  dataAssinatura: new Date().toISOString().split('T')[0], // Data de hoje
  valorTotalContrato: 0,
  dataPrevistaInicio: '',
  prazoEstimadoDias: 0,
  observacoesAdicionais: '',
  itensCombinados: [
    { id: Date.now(), descricao: '', unidade: 'servico', quantidade: 1, valorUnitario: 0 },
  ],
};

// ----------------- COMPONENTE PRINCIPAL -----------------

const CadastroContrato: React.FC = () => {
  const [formData, setFormData] = useState<ContratoData>(initialState);

  // Calcula o valor total dos itens, mas não o total final do contrato.
  const subtotalItens = formData.itensCombinados.reduce(
    (acc, item) => acc + item.quantidade * item.valorUnitario,
    0
  );

  // Handler para campos simples (não arrays)
  const handleSimpleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    
    // Converte valor para número se o campo for numérico
    const finalValue = (type === 'number' || name === 'prazoEstimadoDias') 
        ? parseFloat(value) || 0 
        : value;
        
    setFormData(prevData => ({
      ...prevData,
      [name as keyof ContratoData]: finalValue,
    }));
  };

  // ----------------- LÓGICA DE ITENS COMBINADOS -----------------
  
  const handleItemChange = (id: number, field: keyof ItemCombinado, value: string | number) => {
    setFormData(prevData => ({
      ...prevData,
      itensCombinados: prevData.itensCombinados.map(item => {
        if (item.id === id) {
            // Garante que quantidade e valorUnitario sejam números
            const finalValue = (field === 'quantidade' || field === 'valorUnitario') 
                ? parseFloat(value as string) || 0 
                : value;
                
            return { ...item, [field]: finalValue };
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
  
  // ----------------- LÓGICA DE SUBMISSÃO -----------------

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    
    if (!formData.clienteId) {
        alert("Por favor, selecione um cliente para o contrato.");
        return;
    }

    // Monta o objeto final com o valor total recalculado ou preenchido
    const contratoFinal: ContratoData = {
        ...formData,
        // Garante que o valor total seja preenchido (se não foi alterado manualmente)
        valorTotalContrato: formData.valorTotalContrato || subtotalItens,
    };

    // Ação principal: Envio para o backend e Adição à Fila de Obra
    console.log('CONTRATO CRIADO E ADICIONADO À FILA DE OBRAS:', contratoFinal);
    alert(`Contrato "${contratoFinal.tituloContrato}" criado e processo de obra iniciado para o cliente ${contratoFinal.clienteId}!`);
    
    // Opcional: setFormData(initialState); para limpar
  };

  // ----------------- RENDERIZAÇÃO -----------------

  return (
    <form onSubmit={handleSubmit} className="form-container">
      <h1>Criação de Contrato de Obra</h1>
      
      {/* ----------------- SEÇÃO: DADOS ESSENCIAIS E CLIENTE ----------------- */}
      <fieldset>
        <legend>Dados Contratuais Essenciais</legend>
        
        {/* Seleção do Cliente */}
        <div>
          <label htmlFor="clienteId">Cliente Associado</label>
          <select
            id="clienteId"
            name="clienteId"
            value={formData.clienteId}
            onChange={handleSimpleChange}
            required
          >
            {CLIENTES_MOCK.map(c => (
                <option key={c.id} value={c.id} disabled={c.id === ''}>
                    {c.nome}
                </option>
            ))}
          </select>
        </div>
        
        {/* Título do Contrato */}
        <div>
          <label htmlFor="tituloContrato">Título/Assunto do Contrato</label>
          <input
            type="text"
            id="tituloContrato"
            name="tituloContrato"
            value={formData.tituloContrato}
            onChange={handleSimpleChange}
            placeholder="Ex: Reforma Cobertura | Construção Residencial"
            required
          />
        </div>
        
        {/* Datas e Prazo */}
        <div className="form-row">
            <div>
              <label htmlFor="dataAssinatura">Data de Assinatura</label>
              <input
                type="date"
                id="dataAssinatura"
                name="dataAssinatura"
                value={formData.dataAssinatura}
                onChange={handleSimpleChange}
                required
              />
            </div>
            <div>
              <label htmlFor="dataPrevistaInicio">Previsão de Início</label>
              <input
                type="date"
                id="dataPrevistaInicio"
                name="dataPrevistaInicio"
                value={formData.dataPrevistaInicio}
                onChange={handleSimpleChange}
                required
              />
            </div>
            <div>
              <label htmlFor="prazoEstimadoDias">Prazo Est. (dias)</label>
              <input
                type="number"
                id="prazoEstimadoDias"
                name="prazoEstimadoDias"
                value={formData.prazoEstimadoDias}
                onChange={handleSimpleChange}
                min="1"
                required
              />
            </div>
        </div>
        
        {/* Valor Total do Contrato */}
        <div>
          <label htmlFor="valorTotalContrato">Valor Total do Contrato (R$)</label>
          <input
            type="number"
            id="valorTotalContrato"
            name="valorTotalContrato"
            value={formData.valorTotalContrato || subtotalItens}
            onChange={handleSimpleChange}
            placeholder={`Sugestão: ${subtotalItens.toFixed(2)}`}
            min="0"
          />
          <small>Preencha com o valor final acordado. O subtotal dos itens é R$ {subtotalItens.toFixed(2)}</small>
        </div>
      </fieldset>

      {/* ----------------- SEÇÃO: ITENS COMBINADOS (ESCOPO) ----------------- */}
      <fieldset>
        <legend>Itens e Serviços Combinados (Escopo)</legend>
        
        {formData.itensCombinados.map((item, index) => (
          <div key={item.id} className="dynamic-item-card">
            <h4>Item #{index + 1}</h4>
            
            {/* Descrição */}
            <div>
              <input
                type="text"
                value={item.descricao}
                onChange={(e) => handleItemChange(item.id, 'descricao', e.target.value)}
                placeholder="Descrição do serviço/etapa"
                required
              />
            </div>

            {/* Quantidade, Unidade, Valor Unitário */}
            <div className="form-row three-cols">
                {/* Quantidade */}
                <input
                    type="number"
                    value={item.quantidade}
                    onChange={(e) => handleItemChange(item.id, 'quantidade', e.target.value)}
                    placeholder="Qtd"
                    min="1"
                    required
                />
                
                {/* Unidade */}
                <select
                    value={item.unidade}
                    onChange={(e) => handleItemChange(item.id, 'unidade', e.target.value as ItemCombinado['unidade'])}
                >
                    <option value="servico">Serviço</option>
                    <option value="unidade">Unidade</option>
                    <option value="m2">m²</option>
                    <option value="hora">Hora</option>
                </select>
                
                {/* Valor Unitário */}
                <input
                    type="number"
                    value={item.valorUnitario}
                    onChange={(e) => handleItemChange(item.id, 'valorUnitario', e.target.value)}
                    placeholder="R$ Unitário"
                    min="0"
                />
            </div>
            
            <div className="item-subtotal">
                Subtotal: R$ {(item.quantidade * item.valorUnitario).toFixed(2)}
            </div>
            
            <button 
                type="button" 
                onClick={() => removeItem(item.id)}
                className="remove-button"
            >
                Remover Item
            </button>
            <hr />
          </div>
        ))}
        
        <button type="button" onClick={addItem} className="add-button">
          + Adicionar Item Combinado
        </button>
      </fieldset>

      {/* ----------------- OBSERVAÇÕES ----------------- */}
      <fieldset>
        <legend>Observações Adicionais</legend>
        <textarea
          name="observacoesAdicionais"
          value={formData.observacoesAdicionais}
          onChange={handleSimpleChange}
          rows={4}
          placeholder="Registre informações importantes não cobertas pelos itens, como condições de pagamento, garantias, etc."
        />
      </fieldset>

      <button type="submit" className="submit-button">
        Salvar Contrato e **Adicionar à Fila de Obras**
      </button>
    </form>
  );
};

// ----------------- ESTILOS (CSS) -----------------
const style = `
.form-container {
    max-width: 750px;
    margin: 20px auto;
    padding: 20px;
    border: 1px solid #ddd;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.08);
    font-family: Arial, sans-serif;
}
h1 { text-align: center; color: #007bff; border-bottom: 3px solid #007bff; padding-bottom: 10px; margin-bottom: 25px; }
fieldset { border: 1px solid #007bff55; padding: 15px; margin-bottom: 25px; border-radius: 6px; }
legend { font-weight: bold; color: #007bff; padding: 0 10px; font-size: 1.1em; }

label { display: block; margin-bottom: 5px; font-weight: 500; }
input[type="text"],
input[type="number"],
input[type="date"],
select,
textarea {
    width: 100%;
    padding: 10px;
    border: 1px solid #ccc;
    border-radius: 4px;
    box-sizing: border-box;
    margin-bottom: 10px;
}
textarea { resize: vertical; }

.form-row { display: flex; gap: 10px; margin-bottom: 10px; }
.form-row > div { flex: 1; }

.dynamic-item-card {
    border: 1px dashed #ccc;
    padding: 15px;
    margin-bottom: 15px;
    border-radius: 4px;
}
.dynamic-item-card h4 { margin-top: 0; margin-bottom: 10px; color: #333; }

.three-cols input, .three-cols select {
    margin-bottom: 0; 
    flex: 1;
}

.item-subtotal {
    text-align: right;
    font-weight: bold;
    color: #28a745;
    margin: 5px 0;
}

/* Botões */
.add-button, .remove-button, .submit-button {
    padding: 10px 15px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-weight: bold;
    transition: background-color 0.3s ease;
    margin-top: 10px;
}
.add-button { background-color: #28a745; color: white; width: 100%; }
.add-button:hover { background-color: #1e7e34; }

.remove-button { background-color: #dc3545; color: white; float: right; }
.remove-button:hover { background-color: #c82333; }

.submit-button { background-color: #007bff; color: white; width: 100%; font-size: 1.1em; padding: 15px; margin-top: 20px; }
.submit-button:hover { background-color: #0056b3; }

small {
    display: block;
    margin-top: -5px;
    margin-bottom: 10px;
    color: #6c757d;
}
hr { border: 0; border-top: 1px solid #eee; margin: 15px 0; clear: both; }
`;

// Opcional: Adicionar estilos ao DOM para visualização
if (typeof document !== 'undefined') {
  const styleTag = document.createElement('style');
  styleTag.textContent = style;
  document.head.appendChild(styleTag);
}

export default CadastroContrato;