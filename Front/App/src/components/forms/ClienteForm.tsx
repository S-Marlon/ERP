import React from 'react';

const ClienteForm: React.FC = () => {
    return (
        <fieldset className="fieldset-principal">
                    <legend className="legend">Cliente e Localização</legend>
                    <div className="grid-2-cols">

                        <label className="label">Nome do Cliente:
                            <input
                                type="text"
                                name="clienteNome"

                                required
                                className="input-base input"
                            />
                        </label>
                        <label className="label">CPF/CNPJ do Cliente:
                            <input
                                type="text"
                                name="clienteDocumento"
                                required
                                className="input-base input"
                                placeholder="Ex: 000.000.000-00 ou 00.000.000/0001-00"
                            />
                        </label>
                    </div>
                    {/* --- Bloco de Endereço Estruturado --- */}
                    <div className="grid-4-cols">
                        <label className="label" style={{ gridColumn: 'span 1' }}>CEP:
                            <input
                                type="text"
                                name="endereco_cep"
                                
                                required
                                className="input-base input"
                                maxLength={9} // Limita o CEP
                                placeholder="Ex: 00000-000"
                            />
                        </label>
                        <label className="label" style={{ gridColumn: 'span 3' }}>Logradouro:
                            <input
                                type="text"
                                name="endereco_logradouro"
                                required
                                className="input-base input"
                                placeholder="Rua / Avenida..."
                            />
                        </label>
                    </div>

                    <div className="grid-4-cols">
                        <label className="label">Número:
                            <input
                                type="text"
                                name="endereco_numero"
                                required
                                className="input-base input"
                            />
                        </label>
                        {/* Bairro ocupa 2 colunas para ser mais legível */}
                        <label className="label" style={{ gridColumn: 'span 2' }}>Bairro:
                            <input
                                type="text"
                                name="endereco_bairro"
                                required
                                className="input-base input"
                            />
                        </label>
                        <label className="label">Complemento:
                            <input
                                type="text"
                                name="endereco_complemento"
                                className="input-base input"
                            />
                        </label>
                    </div>

                    <div className="grid-4-cols">
                        <label className="label" style={{ gridColumn: 'span 3' }}>Cidade:
                            <input
                                type="text"
                                name="endereco_cidade"
                                required
                                className="input-base input"
                            />
                        </label>
                        <label className="label">Estado:
                            <input
                                type="text"
                                name="endereco_estado"
                                required
                                className="input-base input"
                                maxLength={2}
                            />
                        </label>
                    </div>

                    
                </fieldset>
    );
};

export default ClienteForm;