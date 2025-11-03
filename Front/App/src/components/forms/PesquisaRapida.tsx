import React from "react";
import FormControl from "../ui/FormControl/FormControl";
import Button from "../ui/Button/Button";
import Typography from "../ui/Typography/Typography";
import Card from "../ui/Card/Card";

const PesquisaRapida: React.FC = () => {
  return (
    <Card variant="highlight">
    
      <Typography variant="h1Alt">Busca rápida</Typography>

      <div className="grid-1-cols">
        <FormControl
          label="Nome do Cliente"
          name="clienteNome"
          required
          placeholder="Digite o nome"
        />
        <FormControl
          label="CPF/CNPJ do Cliente"
          name="clienteDocumento"
          required
          placeholder="000.000.000-00 ou 00.000.000/0001-00"
        />
      
        <FormControl
          label="Código contrato"
          name="codigoContrato"
          required
          placeholder="Digite o código"
        />
        <FormControl
          label="Telefone do Cliente"
          name="telefoneCliente"
          required
          placeholder="(99) 99999-9999"
        />
      
        <FormControl
          label="Email do Cliente"
          name="emailCliente"
          required
          placeholder="email@exemplo.com"
          type="email"
        />
        <FormControl
          label="CEP do Cliente"
          name="cepCliente"
          required
          placeholder="00000-000"
        />

        <Button variant="outline" type="reset" style={{ marginTop: "1em" }}>
          Limpar
        </Button>
        <Button variant="primary" type="submit" style={{ marginTop: "1em" }}>
          Pesquisar
        </Button>
      </div>
    </Card>
  );
};

export default PesquisaRapida;