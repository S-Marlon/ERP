import React, { ChangeEvent } from 'react';
import Fieldset from '../../ui/Fieldset';
import FormControl from '../../ui/FormControl';

// 1. DEFINA A INTERFACE FORA DO COMPONENTE
// (A interface ClienteData completa deve vir do seu arquivo CadastroCliente.tsx)
interface DadosGeraisFiscaisProps {
  data: {
    nomeCompleto: string;
    tipoPessoa: "PF" | "PJ";
    documento: string;
    inscricaoEstadual: string;
    dataNascimento: string;
    // ... inclua aqui todos os campos que este componente precisa do ClienteData
  };
  handleInputChange: (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
}

// 2. O COMPONENTE DEVE RECEBER AS PROPS
const DadosGeraisFiscais: React.FC<DadosGeraisFiscaisProps> = ({ data, handleInputChange }) => {

    return (
        <Fieldset variant='standard' legend='Dados Gerais e Fiscais'>

            {/* Nome Completo / Razão Social */}
            <FormControl
              label="Nome Completo / Razão Social"
              name="nomeCompleto"
              // 3. LIGAR O INPUT AO ESTADO (value) E AO HANDLER (onChange)
              value={data.nomeCompleto} 
              onChange={handleInputChange} 
              required
            />

            <div className="form-row">
              {/* Tipo de Pessoa */}
              <FormControl
                label="Tipo de Pessoa"
                name="tipoPessoa"
                control="select"
                // 3. LIGAR O INPUT AO ESTADO (value) E AO HANDLER (onChange)
                value={data.tipoPessoa} 
                onChange={handleInputChange} 
                options={[
                  { value: 'PF', label: 'Pessoa Física (PF)' },
                  { value: 'PJ', label: 'Pessoa Jurídica (PJ)' },
                ]}
                required
              />

              {/* Documento (CPF/CNPJ) */}
              <FormControl
                label={data.tipoPessoa === 'PF' ? 'CPF' : 'CNPJ'} // Label dinâmico
                name="documento"
                // 3. LIGAR O INPUT AO ESTADO (value) E AO HANDLER (onChange)
                value={data.documento} 
                onChange={handleInputChange} 
                required
              />
            </div>

            <div className="form-row">
              {/* Inscrição Estadual (IE) */}
              <FormControl
                label="Inscrição Estadual (Opcional)"
                name="inscricaoEstadual"
                // 3. LIGAR O INPUT AO ESTADO (value) E AO HANDLER (onChange)
                value={data.inscricaoEstadual} 
                onChange={handleInputChange} 
                placeholder="Ex: Isento ou 123.456.789.012"
              />

              {/* Data de Nascimento/Fundação */}
              <FormControl
                // Label dinâmico
                label={data.tipoPessoa === 'PF' ? 'Data de Nascimento' : 'Data de Fundação'}
                name="dataNascimento"
                type="date"
                // 3. LIGAR O INPUT AO ESTADO (value) E AO HANDLER (onChange)
                value={data.dataNascimento} 
                onChange={handleInputChange} 
              />
            </div>
          </Fieldset>
    );
};
export default DadosGeraisFiscais;