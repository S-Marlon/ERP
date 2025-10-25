import React, { useState } from 'react';
import Typography from '../ui/Typography';
import Button from '../ui/Button';
import FormControl from '../ui/FormControl';
import Card from '../ui/Card';
import FlexGridItem from '../Layout/FlexGridContainer/FlexGridItem';
import FlexGridContainer from '../Layout/FlexGridContainer/FlexGridContainer';
// IMPORTAÇÕES DOS NOVOS COMPONENTES:

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
        <Card>
            <Typography variant="h3">Dados de Perfuração e Solo</Typography>
            
            {/* SUBSTITUIÇÃO 1: grid-3-cols -> FlexGridContainer */}
            {/* Assumimos que este é um único campo que deve ocupar 100% */}
            <FlexGridContainer layout="flex" gap="15px">
                <FlexGridItem> {/* Omitir colSpan assume 100% (colSpan=12) */}
                    <FormControl
                        label="Tipo de Solo Superficial"
                        name="tipoSoloEncontrado"
                        control="select"
                        options={tipoSoloSuperficialOptions.map(tipo => ({ value: tipo, label: tipo }))}
                        required
                    />
                </FlexGridItem>
            </FlexGridContainer>

            <Typography variant="h4" >
                Diâmetro de Perfuração (metros)
            </Typography>

            {/* Perfuração Superficial */}
            <fieldset className='fieldset'>
                <legend>
                    <Typography variant="h4">Perfuração Superficial</Typography>
                </legend>
                
                {superficialRows.map((row, idx) => (
                    // SUBSTITUIÇÃO 2: div className="grid-4-cols" -> FlexGridContainer (uma linha por iteração)
                    <FlexGridContainer layout="flex" gap="15px" key={`superficial-row-${idx}`}>
                        
                        {/* 3 Campos, cada um ocupando 4/12 (33.33%) */}
                        <FlexGridItem colSpan={3}> 
                            <FormControl
                                label="De"
                                name={`diametroPerfuracaoDe-${idx}`}
                                type="number"
                                step={0.1}
                                required
                            />
                        </FlexGridItem>
                        <FlexGridItem colSpan={3}>
                            <FormControl
                                label="Até"
                                name={`diametroPerfuracaoAte-${idx}`}
                                type="number"
                                step={0.1}
                                required
                            />
                        </FlexGridItem>
                        <FlexGridItem colSpan={3}>
                            <FormControl
                                label="Diâmetro (mm)"
                                name={`diametroPerfuracaoDiametro-${idx}`}
                                type="number"
                                step={0.1}
                                required
                            />
                        </FlexGridItem>
                        
                        {/* Botão de Adicionar: Usamos um wrapper simples, e deixamos o flex-grow do Button fazer o resto. */}
                        <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: '3px' }}>
                             {/* NOTA: Não usamos FlexGridItem aqui para o botão ser o menor possível e não crescer demais */}
                             {idx === superficialRows.length - 1 && (
                                <Button type="button" variant="success" onClick={addSuperficialRow}>
                                    +
                                </Button>
                            )}
                        </div>
                    </FlexGridContainer>
                ))}
            </fieldset>

            {/* Perfuração em Rocha (Lógica idêntica à Superficial) */}
            <fieldset className='fieldset'>
                <legend>
                    <Typography variant="h4">Perfuração em Rocha</Typography>
                </legend>
                
                {rochaRows.map((row, idx) => (
                    // SUBSTITUIÇÃO 3: div className="grid-4-cols" -> FlexGridContainer
                    <FlexGridContainer layout="flex" gap="15px" key={`rocha-row-${idx}`}>
                        
                        {/* 3 Campos, cada um ocupando 4/12 (33.33%) */}
                        <FlexGridItem colSpan={3}>
                            <FormControl
                                label="De"
                                name={`diametroPerfuracaoRochaDe-${idx}`}
                                type="number"
                                step={0.1}
                                required
                            />
                        </FlexGridItem>
                        <FlexGridItem colSpan={3}>
                            <FormControl
                                label="Até"
                                name={`diametroPerfuracaoRochaAte-${idx}`}
                                type="number"
                                step={0.1}
                                required
                            />
                        </FlexGridItem>
                        <FlexGridItem colSpan={3}>
                            <FormControl
                                label="Diâmetro (mm)"
                                name={`diametroPerfuracaoRochaDiametro-${idx}`}
                                type="number"
                                step={0.1}
                                required
                            />
                        </FlexGridItem>
                        
                        {/* Botão de Adicionar */}
                        <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: '3px' }}>
                             {idx === rochaRows.length - 1 && (
                                <Button type="button" variant="success" onClick={addRochaRow}>
                                    +
                                </Button>
                            )}
                        </div>
                    </FlexGridContainer>
                ))}
            </fieldset>
        </Card>
    );
};

export default DadosPerfuracaoForm;