import React from 'react';
import Card from '../../ui/Card';
import Typography from '../../ui/Typography';
import FormControl from '../../ui/FormControl';
const Topbar: React.FC = () => {
    return (
        <Card className='flex-row'>
            <div className='form-header-row'>

                <Typography variant="h1Alt">
                    Registro Técnico do Poço
                </Typography>
            </div>

                <Typography variant="pMuted" className="subtitle" >
                    Relatório pós-serviço (Perfuração/Manutenção)
                </Typography>
                <FormControl
                    label="Obra/Contrato de Origem"
                    name="contratoId"
                    control="select"
                   
                    required
                />
                <FormControl
                    label="Nome de Identificação do Poço"
                    name="nomeIdentificacao"
                   
                    placeholder="Ex: Poço Principal - Casa 1"
                    required
                />
                <FormControl
                    label="Data do Relatório"
                    name="dataConclusao"
                    type="date"
                    
                    required
                />
            </Card>
    );
};
export default Topbar;