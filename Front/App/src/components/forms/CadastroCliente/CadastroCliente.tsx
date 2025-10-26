import React, { useState, ChangeEvent, FormEvent } from "react";
import "./CadastroCliente.css";
import Button from "../../ui/Button";
import FlexGridContainer from "../../Layout/FlexGridContainer/FlexGridContainer";
import DadosGeraisFiscais from "./DadosGeraisFiscais";
import Contato from "./Contatos";
import Endereco from "./Endereco";
import Card from "../../ui/Card";
import Typography from "../../ui/Typography";



// ----------------- Tipos e Interfaces -----------------
interface Contato {
  id: number;
  tipo: "Telefone" | "Email";
  valor: string;
  referencia: string;
  principal: boolean;
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
  tipoPessoa: "PF" | "PJ";
  documento: string;
  inscricaoEstadual: string;
  dataNascimento: string;
  contatos: Contato[];
  enderecos: Endereco[];
}

// Estado inicial do cliente
const initialState: ClienteData = {
  nomeCompleto: "",
  tipoPessoa: "PF",
  documento: "",
  inscricaoEstadual: "",
  dataNascimento: "",
  contatos: [{ id: 1, tipo: "Email", valor: "", referencia: "", principal: false }],
  enderecos: [
    {
      id: 1,
      cep: "",
      rua: "",
      numero: "",
      complemento: "",
      bairro: "",
      cidade: "",
      estado: "",
      principal: true,
    },
  ],
};

const CadastroCliente: React.FC = () => {
  const [clienteData, setClienteData] = useState<ClienteData>(initialState);
  const [errors, setErrors] = useState<any>({});

  // Manipulador para campos simples
  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setClienteData(prevData => ({
      ...prevData,
      [name]: value,
    }));
  };

  // Manipulador para contatos
  const handleContatoChange = (id: number, name: keyof Contato, value: string | boolean) => {
    setClienteData(prevData => ({
      ...prevData,
      contatos: prevData.contatos.map(contato =>
        contato.id === id
          ? { ...contato, [name]: value }
          : contato
      ),
    }));
  };

  // Adicionar um novo contato
  const handleAddContato = () => {
    setClienteData(prevData => {
      const newId = prevData.contatos.length ? Math.max(...prevData.contatos.map(c => c.id)) + 1 : 1;
      const novoContato: Contato = { id: newId, tipo: "Email", valor: "", referencia: "", principal: false };
      return {
        ...prevData,
        contatos: [...prevData.contatos, novoContato],
      };
    });
  };

  // Remover um contato
  const handleRemoveContato = (id: number) => {
    setClienteData(prevData => ({
      ...prevData,
      contatos: prevData.contatos.filter(contato => contato.id !== id),
    }));
  };

  // Manipulador para endereços
  const handleEnderecoChange = (id: number, name: keyof Endereco, value: any) => {
    setClienteData(prevData => ({
      ...prevData,
      enderecos: prevData.enderecos.map(endereco =>
        endereco.id === id
          ? { ...endereco, [name]: value }
          : endereco
      ),
    }));
  };

  // Adicionar um novo endereço
  const handleAddEndereco = () => {
    setClienteData(prevData => {
      const newId = prevData.enderecos.length ? Math.max(...prevData.enderecos.map(e => e.id)) + 1 : 1;
      const novoEndereco: Endereco = {
        id: newId,
        cep: "",
        rua: "",
        numero: "",
        complemento: "",
        bairro: "",
        cidade: "",
        estado: "",
        principal: false
      };
      return {
        ...prevData,
        enderecos: [...prevData.enderecos, novoEndereco],
      };
    });
  };

  // Remover um endereço
  const handleRemoveEndereco = (id: number) => {
    setClienteData(prevData => ({
      ...prevData,
      enderecos: prevData.enderecos.filter(endereco => endereco.id !== id),
    }));
  };

  // Validação do formulário
  const validateForm = (data: ClienteData): boolean => {
    const newErrors: any = {};
    let isValid = true;

    // Validação de campos simples
    if (!data.nomeCompleto.trim()) {
      newErrors.nomeCompleto = "O Nome Completo é obrigatório.";
      isValid = false;
    }
    if (!data.documento.trim()) {
      newErrors.documento = "O Documento (CPF/CNPJ) é obrigatório.";
      isValid = false;
    }

    // Validação de contatos e endereços
    if (data.contatos.length === 0) {
      newErrors.contatos = "É necessário adicionar pelo menos um contato.";
      isValid = false;
    }
    if (data.enderecos.length === 0) {
      newErrors.enderecos = "É necessário adicionar pelo menos um endereço.";
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  // Envio do formulário
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validateForm(clienteData)) {
      alert("Por favor, preencha todos os campos obrigatórios.");
      return;
    }

    try {
      const response = await fetch('http://localhost:3001/clientes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(clienteData),
      });

      if (response.ok) {
        alert("Cliente salvo com sucesso!");
        setClienteData(initialState); // Limpar formulário
      } else {
        const errorData = await response.json();
        alert(`Erro: ${errorData.error}`);
      }
    } catch (error) {
      console.error("Erro ao salvar cliente:", error);
      alert("Erro ao salvar cliente.");
    }
  };

  return (
    <Card variant="highlight">
      <Typography variant="h1Alt">Registro de Novo Cliente</Typography>
      <Button variant="primary" onClick={handleSubmit}>Salvar Cliente</Button>

      <FlexGridContainer layout="grid" gap="5px" template="1fr 1fr" mobileTemplate="1fr">
        <div>
          <DadosGeraisFiscais
            data={clienteData}
            handleInputChange={handleInputChange}
            errors={{ nomeCompleto: errors.nomeCompleto, documento: errors.documento }}
          />

          {errors.contatos && <span className="ui-form-error">{errors.contatos}</span>}
          <Contato
            data={clienteData}
            handleContatoChange={handleContatoChange}
            handleAddContato={handleAddContato}
            handleRemoveContato={handleRemoveContato}
          />
        </div>

        <div>
          {errors.enderecos && <span className="ui-form-error">{errors.enderecos}</span>}
          <Endereco
            data={clienteData}
            handleEnderecoChange={handleEnderecoChange}
            handleAddEndereco={handleAddEndereco}
            handleRemoveEndereco={handleRemoveEndereco}
          />
        </div>
      </FlexGridContainer>
    </Card>
  );
};

export default CadastroCliente;
