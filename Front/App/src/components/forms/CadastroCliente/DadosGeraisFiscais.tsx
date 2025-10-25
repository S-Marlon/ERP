import React from 'react';
import Fieldset from '../../ui/Fieldset';
import FormControl from '../../ui/FormControl';
const DadosGeraisFiscais: React.FC = () => {
    return (
        <Fieldset variant='standard' legend='Dados Gerais e Fiscais'>

            {/* Nome Completo */}
            <FormControl
              label="Nome Completo / Razão Social"
              name="nomeCompleto"
              
              required
            />

            <div className="form-row">
              {/* Tipo de Pessoa */}
              <FormControl
                label="Tipo de Pessoa"
                name="tipoPessoa"
                control="select"
               
                options={[
                  { value: 'PF', label: 'Pessoa Física (PF)' },
                  { value: 'PJ', label: 'Pessoa Jurídica (PJ)' },
                ]}
                required
              />

              {/* Documento (CPF/CNPJ) */}
              <FormControl
                label='d'
                name="documento"
               
                required
              />
            </div>

            <div className="form-row">
              {/* Inscrição Estadual (IE) */}
              <FormControl
                label="Inscrição Estadual (Opcional)"
                name="inscricaoEstadual"
                
                placeholder="Ex: Isento ou 123.456.789.012"
              />

              {/* Data de Nascimento/Fundação */}
              <FormControl
                label='ta'
                name="dataNascimento"
                type="date"
                
              />
            </div>
          </Fieldset>
    );
};
export default DadosGeraisFiscais;