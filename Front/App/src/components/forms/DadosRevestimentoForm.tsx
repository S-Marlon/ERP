import React, { useState } from 'react';
import Typography from '../ui/Typography';
import Button from '../ui/Button';
import FormControl from '../ui/FormControl';

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
    const [rows, setRows] = useState([
        {
            de: '',
            ate: '',
            material: '',
            diametro: '',
            uniao: ''
        }
    ]);

    const addRow = () => {
        setRows([...rows, { de: '', ate: '', material: '', diametro: '', uniao: '' }]);
    };

    const handleChange = (idx: number, field: string, value: string) => {
        const newRows = rows.map((row, i) =>
            i === idx ? { ...row, [field]: value } : row
        );
        setRows(newRows);
    };

    return (
        <fieldset className="fieldset">
            <legend className="legend">
                <Typography variant="h3">Dados de Revestimento</Typography>
            </legend>
            {rows.map((row, idx) => (
                <div className="grid-6-cols" key={idx}>
                    <FormControl
                        label="De (m)"
                        name={`revestimentoDe-${idx}`}
                        type="number"
                        step={0.1}
                        value={row.de}
                        onChange={e => handleChange(idx, 'de', e.target.value)}
                        required
                    />
                    <FormControl
                        label="Até (m)"
                        name={`revestimentoAte-${idx}`}
                        type="number"
                        step={0.1}
                        value={row.ate}
                        onChange={e => handleChange(idx, 'ate', e.target.value)}
                        required
                    />
                    <FormControl
                        label="Material Utilizado"
                        name={`revestimentoMaterial-${idx}`}
                        control="select"
                        value={row.material}
                        onChange={e => handleChange(idx, 'material', e.target.value)}
                        options={revestimentoMaterialOptions.map(material => ({
                            value: material,
                            label: material
                        }))}
                        required
                    />
                    <FormControl
                        label="Diâmetro (pol)"
                        name={`revestimentoDiametroPolegadas-${idx}`}
                        type="number"
                        step={0.1}
                        value={row.diametro}
                        onChange={e => handleChange(idx, 'diametro', e.target.value)}
                        required
                    />
                    <FormControl
                        label="União Por"
                        name={`revestimentoUniao-${idx}`}
                        control="select"
                        value={row.uniao}
                        onChange={e => handleChange(idx, 'uniao', e.target.value)}
                        options={revestimentoUniaoOptions.map(uniao => ({
                            value: uniao,
                            label: uniao
                        }))}
                        required
                    />
                    <div style={{ display: 'flex', alignItems: 'flex-end', height: '100%' }}>
                        {idx === rows.length - 1 && (
                            <Button type="button" variant="success" onClick={addRow}>
                                +
                            </Button>
                        )}
                    </div>
                </div>
            ))}
        </fieldset>
    );
};

export default DadosRevestimentoForm;