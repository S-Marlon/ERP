import React, { useState } from 'react';
import Typography from '../ui/Typography/Typography';
import FormControl from '../ui/FormControl/FormControl';
import Fieldset from '../ui/Fieldset/Fieldset';

export const estruturaSubterraneaOptions = [
    'Natural (Fraturas, pedras soltas, rochas caídas)',
    'Artificial (Fundações, tubos, entulhos, bueiros)',
];

const ChecklistOcorrenciasForm: React.FC = () => {
    // É uma boa prática adicionar o 'setFormData' se você pretende atualizar o estado.
    // Também é crucial usar o 'value' e 'onChange' nos FormControls.
    const [formData, setFormData] = useState({
        checklistPerdaTotalRetorno: false,
        checklistColapsoParede: false,
        checklistCaimento: false,
        checklistFerramentaPresa: false,
        checklistEstruturasSubterraneas: false,
        estruturaSubterraneaTipo: '',
        checklistBaixaVazao: false,
        checklistAguaNaoLimpou: false,
        checklistEnergiaRuim: false,
        checklistAcessoDificil: false,
        checklistClimaAdverso: false,
        relatorioManual: '',
    });

    // Função de handler (exemplo básico)
    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;
        
        // Lógica para checkbox (usa 'checked')
        if (type === 'checkbox' && e.target instanceof HTMLInputElement) {
            setFormData(prev => ({
                ...prev,
                [name]: e.target.checked,
            }));
        } else {
            // Lógica para outros inputs (usa 'value')
            setFormData(prev => ({
                ...prev,
                [name]: value,
            }));
        }
    };
    

    return (
        <Fieldset variant='standard' legend='Checklist de Ocorrências'>
            

            <Typography variant="h4">Problemas de Perfuração (Circulação)</Typography>
            <div className="checkbox-group">
                <FormControl
                    label="Perda de Retorno de Ar/Fluido (Fratura/Galeria)"
                    // CORRIGIDO: Deve ser 'control="checkbox"'
                    control="checkbox" 
                    name="checklistPerdaTotalRetorno"
                    checked={formData.checklistPerdaTotalRetorno}
                    onChange={handleChange}
                />
                <FormControl
                    label="Colapso / Instabilidade da Parede"
                    // CORRIGIDO: Deve ser 'control="checkbox"'
                    control="checkbox"
                    name="checklistColapsoParede"
                    checked={formData.checklistColapsoParede}
                    onChange={handleChange}
                />
                <FormControl
                    label="Caimento após revestir (Deslizamento de material)"
                    // CORRIGIDO: Deve ser 'control="checkbox"'
                    control="checkbox"
                    name="checklistCaimento"
                    onChange={handleChange}
                />
                <FormControl
                    label="Ferramenta Presa / Avariada"
                    // CORRIGIDO: Deve ser 'control="checkbox"'
                    control="checkbox"
                    name="checklistFerramentaPresa"
                    onChange={handleChange}
                />
                <FormControl
                    label="Estruturas Subterrâneas (Obstáculo)"
                    // CORRIGIDO: Deve ser 'control="checkbox"'
                    control="checkbox"
                    name="checklistEstruturasSubterraneas"
                    onChange={handleChange}
                />
                {formData.checklistEstruturasSubterraneas && (
                    <FormControl
                        label="Tipo de Obstáculo"
                        name="estruturaSubterraneaTipo"
                        control="select"
                        value={formData.estruturaSubterraneaTipo}
                        onChange={handleChange} // Adicionado o handler
                        options={estruturaSubterraneaOptions.map(tipo => ({
                            value: tipo,
                            label: tipo
                        }))}
                        required
                    />
                )}
            </div>

            <Typography variant="h4">Qualidade e Vazão</Typography>
            <div className="checkbox-group">
                <FormControl
                    label="Baixa Vazão Inesperada"
                    // CORRIGIDO: Deve ser 'control="checkbox"'
                    control="checkbox"
                    name="checklistBaixaVazao"
                    onChange={handleChange}
                    required
                />
                <FormControl
                    label="Água com Alta Turbidez (Não Limpou)"
                    // CORRIGIDO: Deve ser 'control="checkbox"'
                    control="checkbox"
                    name="checklistAguaNaoLimpou"
                    onChange={handleChange}
                />
            </div>

            <Typography variant="h4">Logística e Infraestrutura</Typography>
            <div className="checkbox-group">
                <FormControl
                    label="Energia Elétrica Insuficiente/Ruim"
                    // CORRIGIDO: Deve ser 'control="checkbox"'
                    control="checkbox"
                    name="checklistEnergiaRuim"
                    onChange={handleChange}
                />
                <FormControl
                    label="Acesso / Terreno Difícil (Mobilização)"
                    // CORRIGIDO: Deve ser 'control="checkbox"'
                    control="checkbox"
                    name="checklistAcessoDificil"
                    onChange={handleChange}
                />
                <FormControl
                    label="Clima Adverso (Interrupção por Chuva, etc.)"
                    // CORRIGIDO: Deve ser 'control="checkbox"'
                    control="checkbox"
                    name="checklistClimaAdverso"
                    onChange={handleChange}
                />
            </div>

            <FormControl
                label="Relatório Manual de Ocorrências"
                name="relatorioManual"
                control="textarea"
                value={formData.relatorioManual}
                onChange={handleChange} // Adicionado o handler
                rows={4}
                placeholder="Detalhe profundidade, causa e ações corretivas para problemas críticos."
            />
            <Typography variant="pMuted">
                Atenção: Preencha este campo detalhando a profundidade, a causa e as ações corretivas tomadas para todos os problemas críticos (especialmente Perda de Retorno, Colapso e Ferramenta Presa).
            </Typography>
        </Fieldset>
    );
};

export default ChecklistOcorrenciasForm;