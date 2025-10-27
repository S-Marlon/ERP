
import React, { useState } from 'react';
import Card from '../../ui/Card';
import Typography from '../../ui/Typography';
import FormControl from '../../ui/FormControl';
import ClienteSelect from '../CadastroContrato/BuscaCliente';
import { Cliente } from '../../../types/newtypes';
import FlexGridContainer from '../../Layout/FlexGridContainer/FlexGridContainer';

const Topbar: React.FC = () => {
    const [clienteSelecionado, setClienteSelecionado] = useState<Cliente | null>(null);
    // Você pode usar este estado para simular um loading externo se precisar
    const [isSaving, setIsSaving] = useState(false);

    const handleClienteChange = (cliente: Cliente | null) => {
        setClienteSelecionado(cliente);
        console.log('Cliente selecionado mudou:', cliente);
    };
    return (
        <Card className='flex-row'>
            <FlexGridContainer layout="grid" template='1fr 1fr' >


                <FlexGridContainer layout="flex" template='column' >
                    <Typography variant="h1Alt">
                        Registro Técnico do Poço
                    </Typography>
                    <Typography variant="pMuted" className="subtitle" >
                        Relatório pós-serviço (Perfuração/Manutenção)
                    </Typography>

                    <FlexGridContainer layout="grid" template='1fr 1fr'>


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
                    </FlexGridContainer>

                </FlexGridContainer>


                <ClienteSelect
                    clienteSelecionado={clienteSelecionado}
                    onClienteSelecionadoChange={handleClienteChange}
                    // Passando o estado de loading externo
                    isLoading={isSaving}
                />

            </FlexGridContainer>

        </Card>
    );
};
export default Topbar;