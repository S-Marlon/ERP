import React from 'react';
import {  StatusObra,  } from '../../types/Obras';



const statusOptions: StatusObra[] = ['Em Andamento', 'Concluída', 'Pendente', 'Cancelada'];

const DadosGeraisForm: React.FC = () => {
    return (
        <fieldset className="fieldset-principal">
                    <legend className="legend">Dados Gerais</legend>
                    <div className="grid-2d-cols">
                        <label className="label">Tipo de serviço:
                            <select className='input'>
                                <option>Perfuração</option>
                                <option>Manutenção</option>
                                <option>outro</option>
                            </select>
                        </label>

                        <label className="label">Status:
                            <select name="status"  required className="select">
                                {statusOptions.map(status => (<option key={status} value={status}>{status}</option>))}
                            </select>
                        </label>
                        
                    </div>



                    <fieldset className='fieldset'>
                        <legend className='legend'>Datas da Obra/Poço</legend>


                        <div className="grid-3-cols">
                            <label className="label">Início:
                                <input type="date" name="dataLimpeza" required className="input" />
                            </label>
                            <label className="label">Fim Prevista:
                                <input type="date" name="dataFimPrevista"  required className="input" />
                            </label>
                            <label className="label">Garantia (90 dias):
                                <input type="date" name="garantiaAte"  readOnly
                                    className="input read-only-input" title="Calculado automaticamente" />
                            </label>

                        </div>
                    </fieldset>
                    {/* Campos de Latitude e Longitude, movidos para o final da seção de endereço */}
                    <fieldset className='fieldset'>
                        <legend className='legend'>Coordenadas</legend>
                        <div className="grid-2-cols">
                            <label className="label">Latitude:
                                <input type="number" step="any" name="latitude" className="input-base input" />
                            </label>

                            <label className="label">Longitude:
                                <input type="number" step="any" name="longitude" className="input-base input" />
                            </label>
                        </div>
                    </fieldset>
                </fieldset>
    );
};

export default DadosGeraisForm;