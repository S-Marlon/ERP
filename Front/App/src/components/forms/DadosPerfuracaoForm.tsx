import React, { useState } from 'react';
import Typography from '../ui/Typography';
import Button from '../ui/Button';
import FormControl from '../ui/FormControl';

const tipoSoloSuperficialOptions: string[] = [
    'Solo Argiloso (Alta Coesão)',
    'Solo Arenoso (Baixa Coesão/Solto)',
    'Solo Siltoso (Fino/Limoso)',
    'Solo Rochoso Alterado (Saprolito)',
    'Solo Misto/Colúvio'
];

const DadosPerfuracaoForm: React.FC = () => {
    // Exemplo de estado para campos dinâmicos
    const [superficialRows, setSuperficialRows] = useState([{ de: '', ate: '', diametro: '' }]);
    const [rochaRows, setRochaRows] = useState([{ de: '', ate: '', diametro: '' }]);

    const addSuperficialRow = () => setSuperficialRows([...superficialRows, { de: '', ate: '', diametro: '' }]);
    const addRochaRow = () => setRochaRows([...rochaRows, { de: '', ate: '', diametro: '' }]);

    return (
        <fieldset className="fieldset">
            <legend className="legend">
                <Typography variant="h3">Dados de Perfuração e Solo</Typography>
            </legend>
            <div className="grid-3-cols">
                <FormControl
                    label="Tipo de Solo Superficial"
                    name="tipoSoloEncontrado"
                    control="select"
                    options={tipoSoloSuperficialOptions.map(tipo => ({ value: tipo, label: tipo }))}
                    required
                />
               
            </div>

            <Typography variant="h4" >
                Diâmetro de Perfuração (metros)
            </Typography>

            <fieldset className='fieldset'>
                <legend>
                    <Typography variant="h4">Perfuração Superficial</Typography>
                </legend>
                {superficialRows.map((row, idx) => (
                    <div className="grid-4-cols" key={idx}>
                        <FormControl
                            label="De"
                            name={`diametroPerfuracaoDe-${idx}`}
                            type="number"
                            step={0.1}
                            required
                        />
                        <FormControl
                            label="Até"
                            name={`diametroPerfuracaoAte-${idx}`}
                            type="number"
                            step={0.1}
                            required
                        />
                        <FormControl
                            label="Diâmetro (mm)"
                            name={`diametroPerfuracaoDiametro-${idx}`}
                            type="number"
                            step={0.1}
                            required
                        />
                        <div style={{ display: 'flex', alignItems: 'flex-end', height: '100%' }}>
                            {idx === superficialRows.length - 1 && (
                                <Button type="button" variant="success" onClick={addSuperficialRow}>
                                    +
                                </Button>
                            )}
                        </div>
                    </div>
                ))}
            </fieldset>

            <fieldset className='fieldset'>
                <legend>
                    <Typography variant="h4">Perfuração em Rocha</Typography>
                </legend>
                {rochaRows.map((row, idx) => (
                    <div className="grid-4-cols" key={idx}>
                        <FormControl
                            label="De"
                            name={`diametroPerfuracaoRochaDe-${idx}`}
                            type="number"
                            step={0.1}
                            required
                        />
                        <FormControl
                            label="Até"
                            name={`diametroPerfuracaoRochaAte-${idx}`}
                            type="number"
                            step={0.1}
                            required
                        />
                        <FormControl
                            label="Diâmetro (mm)"
                            name={`diametroPerfuracaoRochaDiametro-${idx}`}
                            type="number"
                            step={0.1}
                            required
                        />
                        <div style={{ display: 'flex', alignItems: 'flex-end', height: '100%' }}>
                            {idx === rochaRows.length - 1 && (
                                <Button type="button" variant="success" onClick={addRochaRow}>
                                    +
                                </Button>
                            )}
                        </div>
                    </div>
                ))}
            </fieldset>
        </fieldset>
    );
};

export default DadosPerfuracaoForm;