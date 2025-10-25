import React, { ChangeEvent } from 'react';
import FormControl from '../../ui/FormControl';
import Button from '../../ui/Button';
import Fieldset from '../../ui/Fieldset';
import Card from '../../ui/Card';
import Typography from '../../ui/Typography';

// -----------------------------------------------------------------
// Interfaces (Você deve garantir que EnderecoItem tem todos os campos)
interface EnderecoItem {
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
    enderecos: EnderecoItem[];
}
interface EnderecoProps {
    data: ClienteData;
    handleEnderecoChange: (id: number, name: keyof EnderecoItem, value: any) => void;
    handleAddEndereco: () => void;
    handleRemoveEndereco: (id: number) => void;
}
// -----------------------------------------------------------------


const Endereco: React.FC<EnderecoProps> = ({ data, handleEnderecoChange, handleAddEndereco, handleRemoveEndereco }) => {
    
    // Handler UNIFICADO para inputs de texto (usa e.target.value)
    const getChangeHandler = (id: number) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        handleEnderecoChange(id, name as keyof EnderecoItem, value);
    };

    return (
        <Fieldset variant='standard' legend='Endereços'>

            {data.enderecos.map((endereco, index) => (
                // Usar o ID como key é crucial para listas dinâmicas
                <Card variant='highlight' key={endereco.id} >

                    {/* CABEÇALHO E CONTROLES (PRINCIPAL/REMOVER) */}
                    <div className="grid-2-cols" style={{ alignItems: 'center' }}>
                        <Typography variant='h2'>Endereço #{index + 1}</Typography>
                        
                        <div className="grid-2-cols">
                            {/* CHECKBOX: LIGAÇÃO DO ESTADO BOOLEANO */}
                            <FormControl 
                                control='checkbox' 
                                label='Endereço Principal' 
                                name="principal" // Nome do campo
                                checked={endereco.principal} // Usa 'checked'
                                // Handler específico para o checkbox, passando o booleano
                                onChange={(e: ChangeEvent<HTMLInputElement>) => {
                                    handleEnderecoChange(
                                        endereco.id, 
                                        e.target.name as keyof EnderecoItem, 
                                        e.target.checked
                                    );
                                }}
                            />
                            
                            {/* BOTÃO DE REMOVER */}
                            <Button 
                                variant='danger' 
                                onClick={() => handleRemoveEndereco(endereco.id)}
                            >
                                Remover Endereço
                            </Button>
                        </div>
                    </div>

                    {/* CAMPOS DE ENDEREÇO */}
                    
                    {/* Linha 1: CEP, Número */}
                    <div className="form-row">
                        <FormControl
                            label="CEP" name="cep" required
                            value={endereco.cep}
                            onChange={getChangeHandler(endereco.id)}
                        />
                        <FormControl
                            label="Número" name="numero" required
                            value={endereco.numero}
                            onChange={getChangeHandler(endereco.id)}
                        />
                    </div>

                    {/* Linha 2: Rua */}
                    <FormControl
                        label="Rua / Avenida" name="rua" required
                        value={endereco.rua}
                        onChange={getChangeHandler(endereco.id)}
                    />

                    {/* Linha 3: Bairro, Complemento */}
                    <div className="form-row">
                        <FormControl
                            label="Bairro" name="bairro" required
                            value={endereco.bairro}
                            onChange={getChangeHandler(endereco.id)}
                        />
                        <FormControl
                            label="Complemento (Opcional)" name="complemento"
                            value={endereco.complemento}
                            onChange={getChangeHandler(endereco.id)}
                        />
                    </div>

                    {/* Linha 4: Cidade, Estado */}
                    <div className="form-row">
                        <FormControl
                            label="Cidade" name="cidade" required
                            value={endereco.cidade}
                            onChange={getChangeHandler(endereco.id)}
                        />
                        <FormControl
                            label="Estado (UF)" name="estado" maxLength={2} required
                            value={endereco.estado}
                            onChange={getChangeHandler(endereco.id)}
                        />
                    </div>
                </Card>
            ))}

            {/* BOTÃO ADICIONAR */}
            <Button variant='primary' onClick={handleAddEndereco}>
                + Adicionar Endereço
            </Button>
            
        </Fieldset>
    );
};
export default Endereco;