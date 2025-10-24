import React, { useState, ChangeEvent, FormEvent } from 'react';
import FormControl from '../../ui/FormControl';
import './CadastroCliente.css';
import Typography from '../../ui/Typography';
import Card from '../../ui/Card';
import Button from '../../ui/Button';
import Fieldset from '../../ui/Fieldset';

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
  nomeCompleto: string;
  tipoPessoa: 'PF' | 'PJ';
  documento: string;
  inscricaoEstadual: string;
  dataNascimento: string; 

  contatos: Contato[];
  enderecos: Endereco[];
}

const initialState: ClienteData = {
  nomeCompleto: '',
  tipoPessoa: 'PF',
  documento: '',
  inscricaoEstadual: '',
  dataNascimento: '', 
  contatos: [
    { id: 1, tipo: 'Email', valor: '' },
  ],
  enderecos: [
    { id: 1, cep: '', rua: '', numero: '', complemento: '', bairro: '', cidade: '', estado: '', principal: true },
  ],
};

const CadastroCliente: React.FC = () => {
  const [formData, setFormData] = useState<ClienteData>(initialState);

  const documentoLabel = formData.tipoPessoa === 'PF' ? 'CPF' : 'CNPJ';
  const documentoPlaceholder = formData.tipoPessoa === 'PF' ? '000.000.000-00' : '00.000.000/0000-00';

  // Inclui a 'dataNascimento' no handler simples
  const handleSimpleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prevData => ({
      ...prevData,
      [name as keyof ClienteData]: value,
    }));
  };

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
        { id: Date.now(), tipo: 'Telefone', valor: '' },
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


  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    const contatoValido = formData.contatos.some(c => c.valor.trim() !== '');
    if (!formData.nomeCompleto || !formData.documento || !contatoValido) {
      alert("Por favor, preencha o Nome Completo, Documento e pelo menos um Contato.");
      return;
    }

    console.log('Dados do Cliente Enviados:', formData);
    alert(`Cliente ${formData.nomeCompleto} pronto para envio ao servidor!`);
  };

  // ----------------- RENDERIZAÇÃO -----------------

  return (
    <form onSubmit={handleSubmit} className="cliente-form-container">
      <div className="form-row">
        <h1>Registro de Novo Cliente</h1>
        <div>
          <Button variant="primary">
            Salvar Cliente
          </Button>
          <Button variant="success">
            Salvar Cliente e Adicionar Contrato
          </Button>
        </div>
      </div>

      <div className="grid-2-cols"> {/* Reajustado para 2 colunas para melhor organização */}

        {/* ======================= COLUNA 1 ======================= */}
        <div >
          <Fieldset variant='standard' legend='Dados Gerais e Fiscais'>

            {/* Nome Completo */}
            <FormControl
              label="Nome Completo / Razão Social"
              name="nomeCompleto"
              value={formData.nomeCompleto}
              onChange={handleSimpleChange}
              required
            />

            <div className="form-row">
              {/* Tipo de Pessoa */}
              <FormControl
                label="Tipo de Pessoa"
                name="tipoPessoa"
                control="select"
                value={formData.tipoPessoa}
                onChange={handleSimpleChange}
                options={[
                  { value: 'PF', label: 'Pessoa Física (PF)' },
                  { value: 'PJ', label: 'Pessoa Jurídica (PJ)' },
                ]}
                required
              />

              {/* Documento (CPF/CNPJ) */}
              <FormControl
                label={documentoLabel}
                name="documento"
                value={formData.documento}
                onChange={handleSimpleChange}
                placeholder={documentoPlaceholder}
                required
              />
            </div>

            <div className="form-row">
              {/* Inscrição Estadual (IE) */}
              <FormControl
                label="Inscrição Estadual (Opcional)"
                name="inscricaoEstadual"
                value={formData.inscricaoEstadual}
                onChange={handleSimpleChange}
                placeholder="Ex: Isento ou 123.456.789.012"
              />

              {/* Data de Nascimento/Fundação */}
              <FormControl
                label={formData.tipoPessoa === 'PF' ? "Data de Nascimento" : "Data de Fundação"}
                name="dataNascimento"
                type="date"
                value={formData.dataNascimento}
                onChange={handleSimpleChange}
              />
            </div>
          </Fieldset>

         
          <Fieldset variant='standard' legend='Contatos'>

            {formData.contatos.map((contato) => (
            <Card  variant='highlight' >

              <div key={contato.id} className="form-row">

                {/* Tipo de Contato */}
                <FormControl
                  label="Tipo"
                  control="select"
                  value={contato.tipo}
                  onChange={(e) => handleContatoChange(contato.id, 'tipo', e.target.value)}
                  options={[
                    { value: 'Email', label: 'E-mail' },
                    { value: 'Telefone', label: 'Telefone' },
                  ]}

                />

                {/* Valor do Contato */}
                <FormControl
                  label="Valor"
                  type={contato.tipo === 'Email' ? 'email' : 'tel'}
                  value={contato.valor}
                  onChange={(e) => handleContatoChange(contato.id, 'valor', e.target.value)}
                  placeholder={`Digite o ${contato.tipo}...`}
                  required

                />


                <div className='flex-column xcol'>


                <div >
                  <label className="ui-form-label">Nome de Referência</label>
                  <input
                    type='text'
                    placeholder={`Ex: Comercial, Diretor...`}
                    className="ui-form-input"
                  />
                </div>
                {/* Botão de Remover */}

                {/* Nova: Checkbox Principal */}
                <label className="checkbox-label is-principal-contact">
                  <input type="checkbox" />
                  Principal
                </label>
                </div>
                <Button
                  style={{maxWidth:'30px'}}
                  variant='danger'
                  onClick={() => removeContato(contato.id)}>
                  X
                </Button>

              </div>
                </Card>
            ))}

            <Button variant='primary' onClick={addContato}>
              + Adicionar Contato
            </Button>
          </Fieldset>

        </div>
        {/* ======================= COLUNA 2 ======================= */}
        <div>
          <Fieldset variant='standard' legend='Endereços'>

            {formData.enderecos.map((endereco, index) => (

              <Card key={endereco.id} variant='highlight' >

                <div className="grid-2-cols">
                  <Typography variant='h2'>Endereço #{index + 1}</Typography>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={endereco.principal}
                      onChange={(e) => handleEnderecoChange(endereco.id, 'principal', e.target.checked)}
                    />
                    Endereço Principal
                  </label>
                </div>

                {/* Linha 1: CEP, Número */}
                <div className="form-row">
                  <FormControl
                    label="CEP"
                    value={endereco.cep}
                    onChange={(e) => handleEnderecoChange(endereco.id, 'cep', e.target.value)}
                    required
                  />
                  <FormControl
                    label="Número"
                    value={endereco.numero}
                    onChange={(e) => handleEnderecoChange(endereco.id, 'numero', e.target.value)}
                    required
                  />
                </div>

                {/* Linha 2: Rua */}
                <FormControl
                  label="Rua / Avenida"
                  value={endereco.rua}
                  onChange={(e) => handleEnderecoChange(endereco.id, 'rua', e.target.value)}
                  required
                />

                {/* Linha 3: Bairro, Complemento */}
                <div className="form-row">
                  <FormControl
                    label="Bairro"
                    value={endereco.bairro}
                    onChange={(e) => handleEnderecoChange(endereco.id, 'bairro', e.target.value)}
                    required
                  />
                  <FormControl
                    label="Complemento (Opcional)"
                    value={endereco.complemento}
                    onChange={(e) => handleEnderecoChange(endereco.id, 'complemento', e.target.value)}
                  />
                </div>

                {/* Linha 4: Cidade, Estado */}
                <div className="form-row">
                  <FormControl
                    label="Cidade"
                    value={endereco.cidade}
                    onChange={(e) => handleEnderecoChange(endereco.id, 'cidade', e.target.value)}
                    required
                  />
                  <FormControl
                    label="Estado (UF)"
                    value={endereco.estado}
                    onChange={(e) => handleEnderecoChange(endereco.id, 'estado', e.target.value)}
                    maxLength={2}
                    required
                  />
                </div>
                {/* Checkbox Principal e Botão de Remover */}
                <div>
                  <Button variant='danger'
                    onClick={() => removeEndereco(endereco.id)}>
                    Remover Endereço
                  </Button>
                </div>

              </Card>
            ))}

            <Button variant='primary' onClick={addEndereco} >
              + Adicionar Endereço
            </Button>
          </Fieldset>
        </div>
      </div>

    </form>
  );
};
export default CadastroCliente;