import React from 'react';
import FormControl from '../../ui/FormControl';
import Button from '../../ui/Button';
import Fieldset from '../../ui/Fieldset';
import Card from '../../ui/Card';
import Typography from '../../ui/Typography';
const Endereco: React.FC = () => {
  return (
    <Fieldset variant='standard' legend='Endereços'>


      <Card variant='highlight' >

        <div className="grid-2-cols">
          <Typography variant='h2'>Endereço #</Typography>
          

        <div className="grid-2-cols">

          <FormControl control='checkbox' label='Endereço Principal' ></FormControl>
          <Button variant='danger'>
            Remover Endereço
          </Button>
          
          </div>
        </div>

        {/* Linha 1: CEP, Número */}
        <div className="form-row">
          <FormControl
            label="CEP"
            required
          />
          <FormControl
            label="Número"
            required
          />
        </div>

        {/* Linha 2: Rua */}
        <FormControl
          label="Rua / Avenida"
          required
        />

        {/* Linha 3: Bairro, Complemento */}
        <div className="form-row">
          <FormControl
            label="Bairro"
            required
          />
          <FormControl
            label="Complemento (Opcional)"
          />
        </div>

        {/* Linha 4: Cidade, Estado */}
        <div className="form-row">
          <FormControl
            label="Cidade"
            required
          />
          <FormControl
            label="Estado (UF)"
            maxLength={2}
            required
          />
        </div>
        {/* Checkbox Principal e Botão de Remover */}


      </Card>

      <Button variant='primary' >
        + Adicionar Endereço
      </Button>
    </Fieldset>
  );
};
export default Endereco;