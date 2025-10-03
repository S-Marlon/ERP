import React from 'react';
export const revestimentoMaterialOptions: string[] = [
    'PVC (Série Reforçada)',
    'Aço Carbono',
    'Aço Galvanizado',
    'Aço Inox 304',
    'Aço Inox 316',
    'Geomecânico',
    'Outro / Não Revestido',
];

export const revestimentoUniaoOptions: string[] = [
    'Rosca (Roscado)',
    'Solda',
    'Cola (Adesivo Branco/PVC)',
    'Cola (Adesivo Vermelho/CPVC)',
    'Encaixe Simples',
    'Parafusado / Flangeado',
];



const DadosRevestimentoForm: React.FC = () => {
    return (
         <fieldset className="fieldset">
                    <legend className="legend">Dados de Revestimento</legend>
                    <div className="grid-6-cols">
                        <label className="label">De (m):
                            <input type="number" step="0.1" name="revestimentoDe"  className="input" />
                        </label>
                        <label className="label">Até (m):
                            <input type="number" step="0.1" name="revestimentoAte"className="input" />
                        </label>

                        <label className="label">Material Utilizado:
                            {/* Substituímos o input por select. Usamos a classe 'select' e 'input-base' se você estiver usando herança. */}
                            <select
                                name="revestimentoMaterial"
                                required // Adicione 'required' se este campo for obrigatório
                                className="input-base select"
                            >
                                {/* Opção inicial/padrão, se necessário */}
                                <option value="" disabled>Selecione o Material</option>

                                {/* Mapeia a lista de opções importada */}
                                {revestimentoMaterialOptions.map(material => (
                                    <option key={material} value={material}>
                                        {material}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <label className="label">Diâmetro (pol):
                            {/* CLASSE: input */}
                            <input type="number" step="0.1" name="revestimentoDiametroPolegadas" className="input" />
                        </label>

                        <label className="label">União Por:
                            {/* Usamos a classe 'select' e 'input-base' para estilizar o campo */}
                            <select
                                name="revestimentoUniao"
                                required // Adicione 'required' se este campo for obrigatório
                                className="input-base select"
                            >
                                {/* Opção inicial/padrão */}
                                <option value="" disabled>Selecione o Método de União</option>

                                {/* Mapeia a lista de opções importada */}
                                {revestimentoUniaoOptions.map(uniao => (
                                    <option key={uniao} value={uniao}>
                                        {uniao}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label className="label">adcionar mais:
                            <button className='btn'>+</button>
                        </label>
                    </div>


                </fieldset>
    );
};
export default DadosRevestimentoForm;