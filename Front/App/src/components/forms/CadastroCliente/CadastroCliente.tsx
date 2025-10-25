import React, { useState, ChangeEvent, FormEvent } from "react";
import "./CadastroCliente.css";
import Button from "../../ui/Button";
import FlexGridContainer from "../../Layout/FlexGridContainer/FlexGridContainer";
import DadosGeraisFiscais from "./DadosGeraisFiscais";
import Contato from "./Contatos";
import Endereco from "./Endereco";
import Card from "../../ui/Card";
import Typography from "../../ui/Typography";

interface Contato {
  id: number;
  tipo: "Telefone" | "Email";
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
  tipoPessoa: "PF" | "PJ";
  documento: string;
  inscricaoEstadual: string;
  dataNascimento: string;

  contatos: Contato[];
  enderecos: Endereco[];
}

const initialState: ClienteData = {
  nomeCompleto: "",
  tipoPessoa: "PF",
  documento: "",
  inscricaoEstadual: "",
  dataNascimento: "",
  contatos: [{ id: 1, tipo: "Email", valor: "" }],
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
  // ----------------- RENDERIZAÇÃO -----------------

  return (
    <Card variant="highlight">
      <div className="form-row">
        <Typography variant="h1Alt">Registro de Novo Cliente</Typography>
        <div>
          <Button variant="primary">Salvar Cliente</Button>
          <Button variant="success">Salvar Cliente e Adicionar Contrato</Button>
        </div>
      </div>

      <FlexGridContainer
        layout="grid"
        gap="5px"
        template="1fr 1fr"
        mobileTemplate="1fr" // No mobile, força 1 coluna
      >
        {/* ======================= COLUNA 1 ======================= */}
        <div>
          <DadosGeraisFiscais />
          <Contato />
        </div>
        {/* ======================= COLUNA 2 ======================= */}
        <div>
          <Endereco />
        </div>
      </FlexGridContainer>

      </Card>
  );
};
export default CadastroCliente;
