import React from 'react';

// Crie a lista de opções para o sub-checklist
export const estruturaSubterraneaOptions = [
    'Natural (Fraturas, pedras soltas, rochas caídas)',
    'Artificial (Fundações, tubos, entulhos, bueiros)',
];

const ChecklistOcorrenciasForm: React.FC = () => {
    return (
        <fieldset className="fieldset">
                    {/* ... Dados de Revestimento (acima deste bloco) ... */}

                    <legend className="legend">Checklist de ocorrencias</legend>

                    {/* ... Inputs de Revestimento (acima deste bloco) ... */}

                    <h4 >Problemas de Perfuração (Circulação)</h4>
                    <div className="checkbox-group">
                        {/* PROBLEMAS DE CIRCULAÇÃO E ESTRUTURA */}
                        <label className="checkbox-label red">
                            <input type="checkbox" name="checklistPerdaTotalRetorno"/> Perda de Retorno de Ar/Fluido (Fratura/Galeria)
                        </label>
                        <label className="checkbox-label red">
                            <input type="checkbox" name="checklistColapsoParede"  /> Colapso / Instabilidade da Parede
                        </label>
                        <label className="checkbox-label yellow">
                            <input type="checkbox" name="checklistCaimento" /> Caimento após revestir (Deslizamento de material)
                        </label>
                        <label className="checkbox-label red">
                            <input type="checkbox" name="checklistFerramentaPresa" /> Ferramenta Presa / Avariada
                        </label>
                        <label className="checkbox-label red">
                            <input type="checkbox" name="checklistEstruturasSubterraneas" /> Estruturas Subterrâneas (Obstáculo)
                        </label>
                        
                        

                        {/* SUB-CHECKLIST CONDICIONAL */}
                        {/* {formData.checklistEstruturasSubterraneas && (
                            <div
                                // Usa style inline para não interferir no checkbox-group, 
                                // garantindo que ele vá para uma nova linha e se destaque.
                                style={{
                                    width: '100%',
                                    marginTop: '10px',
                                    padding: '10px',
                                    borderLeft: '3px solid #ffc107',
                                    backgroundColor: '#fffbe6',
                                    color: '#333'
                                }}
                            >
                                <label className="label">
                                    **Tipo de Obstáculo:**
                                    <select
                                        name="estruturaSubterraneaTipo"
                                        value={formData.estruturaSubterraneaTipo}
                                        onChange={handleChange}
                                        required
                                        className="input-base select"
                                    >
                                        <option value="" disabled>Selecione a Natureza do Obstáculo</option>
                                        {estruturaSubterraneaOptions.map(tipo => (
                                            <option key={tipo} value={tipo}>{tipo}</option>
                                        ))}
                                    </select>
                                </label>
                            </div>
                        )} */}
                    </div>

                    <h4>Qualidade e Vazão</h4>
                    <div className="checkbox-group">
                        {/* PROBLEMAS DE ÁGUA E VAZÃO */}
                        <label className="checkbox-label">
                            <input type="checkbox" name="checklistBaixaVazao"  /> Baixa Vazão Inesperada
                        </label>
                        <label className="checkbox-label">
                            <input type="checkbox" name="checklistAguaNaoLimpou" /> Água com Alta Turbidez (Não Limpou)
                        </label>
                    </div>

                    <h4>Logística e Infraestrutura</h4>
                    <div className="checkbox-group">
                        {/* PROBLEMAS EXTERNOS */}
                        <label className="checkbox-label">
                            <input type="checkbox" name="checklistEnergiaRuim" /> Energia Elétrica Insuficiente/Ruim
                        </label>
                        <label className="checkbox-label yellow">
                            <input type="checkbox" name="checklistAcessoDificil" /> Acesso / Terreno Difícil (Mobilização)
                        </label>
                        <label className="checkbox-label">
                            <input type="checkbox" name="checklistClimaAdverso" /> Clima Adverso (Interrupção por Chuva, etc.)
                        </label>
                    </div>

                    <textarea className='textarea' placeholder='Relatório Manual de Ocorrências: Detalhes adicionais sobre o serviço, perfil do furo, recomendações e próximos passos.'></textarea>
                    Relatório Manual de Ocorrências:

                    Atenção: Preencha este campo detalhando a profundidade, a causa e as ações corretivas tomadas para todos os problemas críticos (especialmente Perda de Retorno, Colapso e Ferramenta Presa).
                </fieldset>
    );
};
export default ChecklistOcorrenciasForm;