import React from 'react';

const PesquisaRapida: React.FC = () => {
    return (
        <div className="filter-sidebar">
          <h3>Busca rápida</h3>

          <div className="grid-1-cols">

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
                        placeholder="000.000.000-00 ou 00.000.000/0001-00"
                    />
                </label>
            </div>
             <div className="grid-1-cols">

                <label className="label">Codigo contrato                    <input
                        type="text"
                        name="clienteNome"

                        required
                        className="input-base input"
                    />
                </label>
                <label className="label">Telefone do Cliente:
                    <input
                        type="text"
                        name="clienteDocumento"
                        required
                        className="input-base input"
                        placeholder="000.000.000-00 ou 00.000.000/0001-00"
                    />
                </label>
            </div>
             <div className="grid-1-cols">

                <label className="label">Email do Cliente:
                    <input
                        type="text"
                        name="clienteNome"

                        required
                        className="input-base input"
                    />
                </label>
                <label className="label">CEP do Cliente:
                    <input
                        type="text"
                        name="clienteDocumento"
                        required
                        className="input-base input"
                        placeholder="000.000.000-00 ou 00.000.000/0001-00"
                    />
                </label>

                <button>
                    Limpar
                </button>
                <button>
                    Pesquisar
                </button>

            </div>
          
        </div>
    );
};

export default PesquisaRapida;