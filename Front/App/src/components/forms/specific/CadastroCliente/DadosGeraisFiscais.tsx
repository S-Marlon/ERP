import React, { ChangeEvent } from 'react';
import Fieldset from '../../../ui/Fieldset/Fieldset';
import FormControl from '../../../ui/FormControl/FormControl';

// 🛠️ NOVO: Interface para os erros (importada ou definida no topo)
interface DadosGeraisFiscaisErrors {
    nomeCompleto?: string;
    documento?: string;
    // Adicione outros campos simples required aqui (ex: dataNascimento)
}

// 1. DEFINA A INTERFACE CORRETA PARA AS PROPS
interface DadosGeraisFiscaisProps {
    data: {
        nomeCompleto: string;
        tipoPessoa: "PF" | "PJ";
        documento: string;
        inscricaoEstadual: string;
        dataNascimento: string;
    };
    handleInputChange: (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
    // 💡 RECEBENDO OS ERROS COMO UMA PROP SEPARADA
    errors: DadosGeraisFiscaisErrors; 
}

// 2. O COMPONENTE DEVE RECEBER E DESESTRUTURAR AS PROPS, INCLUINDO 'errors'
const DadosGeraisFiscais: React.FC<DadosGeraisFiscaisProps> = ({ data, handleInputChange, errors }) => {

    return (
        <Fieldset variant='standard' legend='Dados Gerais e Fiscais'>

            {/* Nome Completo / Razão Social */}
            <FormControl
                label="Nome Completo / Razão Social"
                name="nomeCompleto"
                value={data.nomeCompleto} 
                onChange={handleInputChange} 
                required
                // ✅ LIGANDO O ERRO CORRETO: errors.nomeCompleto
                error={errors.nomeCompleto} 
            />

            <div className="form-row">
                {/* Tipo de Pessoa */}
                <FormControl
                    label="Tipo de Pessoa"
                    name="tipoPessoa"
                    control="select"
                    value={data.tipoPessoa} 
                    onChange={handleInputChange} 
                    options={[
                        { value: 'PF', label: 'Pessoa Física (PF)' },
                        { value: 'PJ', label: 'Pessoa Jurídica (PJ)' },
                    ]}
                    required
                    // ✅ Não precisa de erro, pois é um Select com valor inicial
                />

                {/* Documento (CPF/CNPJ) */}
                <FormControl
                    label={data.tipoPessoa === 'PF' ? 'CPF' : 'CNPJ'}
                    name="documento"
                    value={data.documento} 
                    onChange={handleInputChange} 
                    required
                    // ✅ LIGANDO O ERRO CORRETO: errors.documento
                    error={errors.documento} 
                />
            </div>

            <div className="form-row">
                {/* Inscrição Estadual (IE) */}
                <FormControl
                    label="Inscrição Estadual (Opcional)"
                    name="inscricaoEstadual"
                    value={data.inscricaoEstadual} 
                    onChange={handleInputChange} 
                    placeholder="Ex: Isento ou 123.456.789.012"
                />

                {/* Data de Nascimento/Fundação */}
                <FormControl
                    label={data.tipoPessoa === 'PF' ? 'Data de Nascimento' : 'Data de Fundação'}
                    name="dataNascimento"
                    type="date"
                    value={data.dataNascimento} 
                    onChange={handleInputChange} 
                    // Se você definir 'dataNascimento' como required na validação, 
                    // deve passar o erro aqui também (ex: error={errors.dataNascimento})
                />
            </div>
          </Fieldset>
    );
};
export default DadosGeraisFiscais;