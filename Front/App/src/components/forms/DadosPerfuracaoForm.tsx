import React from 'react';
const tipoSoloSuperficialOptions: string[] = [
    'Solo Argiloso (Alta Coesão)',
    'Solo Arenoso (Baixa Coesão/Solto)',
    'Solo Siltoso (Fino/Limoso)',
    'Solo Rochoso Alterado (Saprolito)', // Rocha alterada (saprolito)
    'Solo Misto/Colúvio' // Mistura de materiais
];



const DadosRevestimentoForm: React.FC = () => {
    return (
         <fieldset className="fieldset">
                            <legend className="legend">Dados de Perfuração e Solo</legend>
                            <div className="grid-3-cols">
                                <label className="label">Tipo de Solo Superficial:
                                    <select name="tipoSoloEncontrado" value={tipoSoloSuperficialOptions} required className="select">
                                        {tipoSoloSuperficialOptions.map(tipo => (
                                            <option key={tipo} value={tipo}>{tipo}</option>
                                        ))}
                                    </select>
                                </label>
                                <label className="label">Profundidade Total (m):
                                    <input type="number" step="0.1" name="profundidadeTotal"required className="input" />
                                </label>
                                <label className="label">Diâmetro Interno (mm):
                                    <input type="number" step="0.1" name="diametroInterno" required className="input" />
                                </label>
                            </div>
        
                            <h4 >Diâmetro de Perfuração (metros):</h4>
                            <fieldset className='fieldset'>
        
                                <legend >Perfuração Superficial</legend>
        
                                <div className="grid-4-cols">
                                    <label className="label">De:
                                        <input type="number" step="0.1" name="diametroPerfuracaoDe"  required className="input" />
                                    </label>
                                    <label className="label">Até:
                                        <input type="number" step="0.1" name="diametroPerfuracaoAte"  required className="input" />
                                    </label>
                                    <label className="label">Diâmetro (mm):
                                        <input type="number" step="0.1" name="diametroPerfuracaoDiametro"  required className="input" />
                                    </label>
                                    <label className="label">adcionar mais:
                                        <button className='btn'>+</button>
                                    </label>
        
                                </div>
                            </fieldset>
                            <fieldset className='fieldset'>
                                <legend >Perfuração em rocha</legend>
        
                                <div className="grid-4-cols">
                                    <label className="label">De:
                                        <input type="number" step="0.1" name="diametroPerfuracaoDe" required className="input" />
                                    </label>
                                    <label className="label">Até:
                                        <input type="number" step="0.1" name="diametroPerfuracaoAte"  required className="input" />
                                    </label>
                                    <label className="label">Diâmetro (mm):
                                        <input type="number" step="0.1" name="diametroPerfuracaoDiametro" required className="input" />
                                    </label>
                                    <label className="label">adcionar mais:
                                        <button className='btn'>+</button>
                                    </label>
                                </div>
                            </fieldset>
                        </fieldset>
    );
};
export default DadosRevestimentoForm;