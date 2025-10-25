import React, { useState } from 'react';
import Typography from '../ui/Typography';
import Button from '../ui/Button';
import FormControl from '../ui/FormControl';
import FlexGridItem from '../Layout/FlexGridContainer/FlexGridItem';
import FlexGridContainer from '../Layout/FlexGridContainer/FlexGridContainer';
import Card from '../ui/Card';
// IMPORTAÇÕES DOS NOVOS COMPONENTES

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

    // Para 5 campos + 1 botão em uma linha (6 itens), cada item deve ter colSpan = 12 / 6 = 2.
    const COL_SPAN_ITEM = 3;

    return (
        <div>

            <Typography variant="h3">Dados de Revestimento</Typography>
            {rows.map((row, idx) => (
        <Card variant='highlight'>


                <FlexGridContainer layout="flex" gap="010px" key={`revestimento-row-${idx}`}>

                    {/* 1. De (2/12) */}
                    <FlexGridItem colSpan={COL_SPAN_ITEM}>
                        <FormControl
                            label="De (m)"
                            name={`revestimentoDe-${idx}`}
                            type="number"
                            step={0.1}
                            value={row.de}
                            onChange={e => handleChange(idx, 'de', e.target.value)}
                            required
                        />
                    </FlexGridItem>

                    {/* 2. Até (2/12) */}
                    <FlexGridItem colSpan={COL_SPAN_ITEM}>
                        <FormControl
                            label="Até (m)"
                            name={`revestimentoAte-${idx}`}
                            type="number"
                            step={0.1}
                            value={row.ate}
                            onChange={e => handleChange(idx, 'ate', e.target.value)}
                            required
                        />
                    </FlexGridItem>

                    {/* 3. Material (2/12) */}
                    <FlexGridItem colSpan={COL_SPAN_ITEM}>
                       
                       <FormControl
                            label="Diâmetro (pol)"
                            name={`revestimentoDiametroPolegadas-${idx}`}
                            type="number"
                            step={0.1}
                            value={row.diametro}
                            onChange={e => handleChange(idx, 'diametro', e.target.value)}
                            required
                        />
                    </FlexGridItem>

                    {/* 4. Diâmetro (2/12) */}
                    <FlexGridItem colSpan={COL_SPAN_ITEM}>
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
                    </FlexGridItem>

                    {/* 5. União (2/12) */}
                    <FlexGridItem colSpan={COL_SPAN_ITEM}>
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
                    </FlexGridItem>

                    <FlexGridItem colSpan={1}>


                        <Button type="button" variant="success" onClick={addRow}>
                            +
                        </Button>
<Button type="button" variant="danger" onClick={addRow}>
                           x
                        </Button>


                    </FlexGridItem>
                </FlexGridContainer>
        </Card>

            ))}
        </div>
    );
};

export default DadosRevestimentoForm;