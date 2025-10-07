import React, { useState, ChangeEvent, FormEvent } from 'react';

// ----------------- TIPOS DE DADOS -----------------

interface Contato {
  id: number;
  tipo: 'Telefone' | 'Email';
  valor: string;
}

interface Endereco {
  id: number;
  cep: string;
  rua: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  estado: string;
  principal: boolean;
}

interface ClienteData {
  // Dados Básicos e Fiscais
  nomeCompleto: string;
  tipoPessoa: 'PF' | 'PJ';
  documento: string;
  inscricaoEstadual: string;
  
  // Listas Dinâmicas
  contatos: Contato[];
  enderecos: Endereco[];
}

// ----------------- ESTADO INICIAL -----------------

const initialState: ClienteData = {
  nomeCompleto: '',
  tipoPessoa: 'PF',
  documento: '',
  inscricaoEstadual: '',
  contatos: [
    // Inicia com um contato e um endereço vazio
    { id: 1, tipo: 'Email', valor: '' },
  ],
  enderecos: [
    { id: 1, cep: '', rua: '', numero: '', complemento: '', bairro: '', cidade: '', estado: '', principal: true },
  ],
};

// ----------------- COMPONENTE PRINCIPAL -----------------

const CadastroCliente: React.FC = () => {
  const [formData, setFormData] = useState<ClienteData>(initialState);

  const documentoLabel = formData.tipoPessoa === 'PF' ? 'CPF' : 'CNPJ';
  const documentoPlaceholder = formData.tipoPessoa === 'PF' ? '000.000.000-00' : '00.000.000/0000-00';

  // Handler para campos simples (não arrays)
  const handleSimpleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prevData => ({
      ...prevData,
      [name as keyof ClienteData]: value,
    }));
  };

  // ----------------- LÓGICA DE CONTATOS -----------------
  
  const handleContatoChange = (id: number, field: keyof Contato, value: string) => {
    setFormData(prevData => ({
      ...prevData,
      contatos: prevData.contatos.map(contato => 
        contato.id === id ? { ...contato, [field]: value } : contato
      ),
    }));
  };

  const addContato = () => {
    setFormData(prevData => ({
      ...prevData,
      contatos: [
        ...prevData.contatos,
        { id: Date.now(), tipo: 'Telefone', valor: '' }, // Novo ID para a key
      ],
    }));
  };

  const removeContato = (id: number) => {
    if (formData.contatos.length <= 1) {
        alert("É necessário manter pelo menos um contato.");
        return;
    }
    setFormData(prevData => ({
      ...prevData,
      contatos: prevData.contatos.filter(contato => contato.id !== id),
    }));
  };
  
  // ----------------- LÓGICA DE ENDEREÇOS -----------------

  const handleEnderecoChange = (id: number, field: keyof Endereco, value: string | boolean) => {
    setFormData(prevData => ({
      ...prevData,
      enderecos: prevData.enderecos.map(endereco => 
        endereco.id === id ? { ...endereco, [field]: value } : endereco
      ),
    }));
  };

  const addEndereco = () => {
    setFormData(prevData => ({
      ...prevData,
      enderecos: [
        ...prevData.enderecos,
        { id: Date.now(), cep: '', rua: '', numero: '', complemento: '', bairro: '', cidade: '', estado: '', principal: false },
      ],
    }));
  };

  const removeEndereco = (id: number) => {
    if (formData.enderecos.length <= 1) {
        alert("É necessário manter pelo menos um endereço.");
        return;
    }
    setFormData(prevData => ({
      ...prevData,
      enderecos: prevData.enderecos.filter(endereco => endereco.id !== id),
    }));
  };


  // ----------------- LÓGICA DE SUBMISSÃO -----------------

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    
    // Validações básicas antes de enviar
    const contatoValido = formData.contatos.some(c => c.valor.trim() !== '');
    if (!formData.nomeCompleto || !formData.documento || !contatoValido) {
        alert("Por favor, preencha o Nome Completo, Documento e pelo menos um Contato.");
        return;
    }

    // Apenas para demonstração
    console.log('Dados do Cliente Enviados:', formData);
    alert(`Cliente ${formData.nomeCompleto} pronto para envio ao servidor!`);
  };

  // ----------------- RENDERIZAÇÃO -----------------

  return (
    <form onSubmit={handleSubmit} className="form-container">
      <h1>Registro de Novo Cliente</h1>
      
      {/* ----------------- SEÇÃO: DADOS BÁSICOS E FISCAIS ----------------- */}
      <fieldset>
        <legend>Dados Gerais e Fiscais</legend>
        
        {/* Nome Completo */}
        <div>
          <label htmlFor="nomeCompleto">Nome Completo / Razão Social</label>
          <input
            type="text"
            id="nomeCompleto"
            name="nomeCompleto"
            value={formData.nomeCompleto}
            onChange={handleSimpleChange}
            required
          />
        </div>

        {/* Tipo de Pessoa */}
        <div className="form-row">
            <div>
              <label htmlFor="tipoPessoa">Tipo de Pessoa</label>
              <select
                id="tipoPessoa"
                name="tipoPessoa"
                value={formData.tipoPessoa}
                onChange={handleSimpleChange}
              >
                <option value="PF">Pessoa Física (PF)</option>
                <option value="PJ">Pessoa Jurídica (PJ)</option>
              </select>
            </div>
            
            {/* Documento (CPF/CNPJ) */}
            <div>
              <label htmlFor="documento">{documentoLabel}</label>
              <input
                type="text"
                id="documento"
                name="documento"
                value={formData.documento}
                onChange={handleSimpleChange}
                placeholder={documentoPlaceholder}
                required
              />
            </div>
        </div>

        {/* Inscrição Estadual (IE) */}
        <div className="form-row">

        <div>
          <label htmlFor="inscricaoEstadual">Inscrição Estadual (Opcional)</label>
          <input
            type="text"
            id="inscricaoEstadual"
            name="inscricaoEstadual"
            value={formData.inscricaoEstadual}
            onChange={handleSimpleChange}
          />
        </div>
        <div>
          <label htmlFor="inscricaoEstadual">data de nascimento</label>
          <input
            type="date"
            
            
           
          />
        </div>
        </div>
      </fieldset>

      {/* ----------------- SEÇÃO: CONTATOS (DINÂMICO) ----------------- */}
      <fieldset>
        <legend>Contatos</legend>
        
        {formData.contatos.map((contato) => (
          <div key={contato.id} className="dynamic-item-row">
            
            {/* Tipo de Contato */}

            <select
              value={contato.tipo}
              onChange={(e) => handleContatoChange(contato.id, 'tipo', e.target.value)}
              className="contato-select"
            >
              <option value="Email">E-mail</option>
              <option value="Telefone">Telefone</option>
            </select>
            
            {/* Valor do Contato */}
            <input
              type={contato.tipo === 'Email' ? 'email' : 'tel'}
              value={contato.valor}
              onChange={(e) => handleContatoChange(contato.id, 'valor', e.target.value)}
              placeholder={`Digite o ${contato.tipo}...`}
              required
            />
            <input
              type='text'
              placeholder={`Digite o nome da referencia...`}
              required
            />

            <label className="checkbox-label">
                    <input
                      type="checkbox"
                    />
                    Principal
                </label>

            
            
            {/* Botão de Remover */}
            <button 
                type="button" 
                onClick={() => removeContato(contato.id)}
                className="remove-button"
            >
                Remover
            </button>
          </div>
        ))}
        
        <button type="button" onClick={addContato} className="add-button">
          + Adicionar Contato
        </button>
      </fieldset>

      {/* ----------------- SEÇÃO: ENDEREÇOS (DINÂMICO) ----------------- */}
      <fieldset>
        <legend>Endereços</legend>
        
        {formData.enderecos.map((endereco, index) => (
          <div key={endereco.id} className="endereco-card">
            <h4>Endereço #{index + 1}</h4>
            
            {/* Linha 1: CEP, Número, Principal */}
            <div className="form-row">
                <input
                  type="text"
                  value={endereco.cep}
                  onChange={(e) => handleEnderecoChange(endereco.id, 'cep', e.target.value)}
                  placeholder="CEP"
                  required
                />
                <input
                  type="text"
                  value={endereco.numero}
                  onChange={(e) => handleEnderecoChange(endereco.id, 'numero', e.target.value)}
                  placeholder="Número"
                  required
                />
                <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={endereco.principal}
                      onChange={(e) => handleEnderecoChange(endereco.id, 'principal', e.target.checked)}
                    />
                    Principal
                </label>
            </div>
            
            {/* Linha 2: Rua */}
            <div>
                <input
                  type="text"
                  value={endereco.rua}
                  onChange={(e) => handleEnderecoChange(endereco.id, 'rua', e.target.value)}
                  placeholder="Rua / Avenida"
                  required
                />
            </div>

            {/* Linha 3: Bairro, Complemento */}
            <div className="form-row">
                <input
                  type="text"
                  value={endereco.bairro}
                  onChange={(e) => handleEnderecoChange(endereco.id, 'bairro', e.target.value)}
                  placeholder="Bairro"
                  required
                />
                <input
                  type="text"
                  value={endereco.complemento}
                  onChange={(e) => handleEnderecoChange(endereco.id, 'complemento', e.target.value)}
                  placeholder="Complemento"
                />
            </div>
            
            {/* Linha 4: Cidade, Estado */}
            <div className="form-row">
                <input
                  type="text"
                  value={endereco.cidade}
                  onChange={(e) => handleEnderecoChange(endereco.id, 'cidade', e.target.value)}
                  placeholder="Cidade"
                  required
                />
                <input
                  type="text"
                  value={endereco.estado}
                  onChange={(e) => handleEnderecoChange(endereco.id, 'estado', e.target.value)}
                  placeholder="Estado (Ex: SP)"
                  maxLength={2}
                  required
                />
            </div>
            
            <button 
                type="button" 
                onClick={() => removeEndereco(endereco.id)}
                className="remove-button-endereco"
            >
                Remover Endereço
            </button>
            <hr />
          </div>
        ))}

        <button type="button" onClick={addEndereco} className="add-button">
          + Adicionar Endereço
        </button>
      </fieldset>


      <button type="submit" className="submit-button">
        Salvar Cliente
      </button>
    </form>
  );
};

// ----------------- ESTILOS (CSS) -----------------
const style = `
.form-container {
    max-width: 700px;
    margin: 20px auto;
    padding: 20px;
    border: 1px solid #ddd;
    border-radius: 8px;
    box-shadow: 0 4px 8px rgba(0,0,0,0.05);
    font-family: Arial, sans-serif;
}
h1 {
    text-align: center;
    color: #1a1a1a;
    border-bottom: 3px solid #007bff;
    padding-bottom: 10px;
    margin-bottom: 25px;
}
fieldset {
    border: 1px solid #007bff55;
    padding: 15px;
    margin-bottom: 25px;
    border-radius: 6px;
}
legend {
    font-weight: bold;
    color: #007bff;
    padding: 0 10px;
    font-size: 1.1em;
}
label {
    display: block;
    margin-bottom: 5px;
    font-weight: 500;
}
input[type="text"],
input[type="email"],
input[type="tel"],
select {
    width: 100%;
    padding: 10px;
    border: 1px solid #ccc;
    border-radius: 4px;
    box-sizing: border-box;
    margin-bottom: 10px;
}
.form-row {
    display: flex;
    gap: 10px;
}
.form-row > div, .form-row > input {
    flex: 1;
}

/* Estilos para Itens Dinâmicos (Contatos e Endereços) */
.dynamic-item-row {
    display: flex;
    gap: 10px;
    align-items: center;
    margin-bottom: 15px;
}
.dynamic-item-row input, .contato-select {
    margin-bottom: 0;
}
.dynamic-item-row .contato-select {
    flex: 0 0 120px; /* Largura fixa para o select */
}
.dynamic-item-row input {
    flex: 1;
}

.endereco-card {
    border: 1px solid #eee;
    padding: 15px;
    margin-bottom: 15px;
    border-radius: 6px;
}
.endereco-card h4 {
    margin-top: 0;
    margin-bottom: 10px;
    color: #333;
}
.form-row input {
    margin-bottom: 0;
}
.checkbox-label {
    display: flex;
    align-items: center;
    font-weight: normal;
    white-space: nowrap;
}
.checkbox-label input {
    width: auto;
    margin-right: 5px;
}

/* Botões */
.add-button, .remove-button, .remove-button-endereco {
    padding: 8px 12px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-weight: bold;
    transition: background-color 0.3s ease;
}
.add-button {
    background-color: #28a745; /* Verde */
    color: white;
    width: 100%;
    margin-top: 10px;
}
.add-button:hover {
    background-color: #1e7e34;
}
.remove-button {
    background-color: #dc3545; /* Vermelho */
    color: white;
    padding: 10px 10px; /* Mais preenchimento para o botão de contato */
    flex-shrink: 0;
}
.remove-button-endereco {
    background-color: #dc3545; /* Vermelho */
    color: white;
    display: block;
    width: 100%;
    margin-top: 10px;
}
.remove-button:hover, .remove-button-endereco:hover {
    background-color: #c82333;
}
.submit-button {
    display: block;
    width: 100%;
    padding: 15px;
    background-color: #007bff;
    color: white;
    border: none;
    border-radius: 4px;
    font-size: 1.1em;
    cursor: pointer;
}
.submit-button:hover {
    background-color: #0056b3;
}
`;

// Opcional: Adicionar estilos ao DOM para visualização
if (typeof document !== 'undefined') {
  const styleTag = document.createElement('style');
  styleTag.textContent = style;
  document.head.appendChild(styleTag);
}

export default CadastroCliente;