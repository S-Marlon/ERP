import Typography from '../../ui/Typography';
import FormControl from '../../ui/FormControl';
import VerticalTabs, { TabPanel } from '../../ui/VerticalTabs';
import DadosPerfuracaoForm from '../DadosPerfuracaoForm';
import DadosRevestimentoForm from '../DadosRevestimentoForm';
import ChecklistOcorrenciasForm from '../ChecklistOcorrenciasForm';
const Tabss: React.FC = () => {

   


    return (
       <div className="coluna-principal">
                    <VerticalTabs defaultActiveIndex={0}>

                         <TabPanel label="1. Dados Gerais do poço">
                            <Typography variant="h3">Localização e Características</Typography>
                            <div className="form-row">
                                <FormControl label="Latitude" name="latitude" type="number" placeholder="00.000000" />
                                <FormControl label="Longitude" name="longitude" type="number"  placeholder="00.000000" />
                            </div>
                            <div className="form-row">
                                <FormControl label="Profundidade Total (m)" name="profundidadeTotalMetros" type="number" placeholder="100.00" min={0} required />
                                <FormControl label="Diâmetro Construção (mm)" name="diametroConstrucaoMm" type="number" placeholder="203.2 (8'')" min={0} />
                                <FormControl label="Formação Geológica Predominante" name="formacaoGeologica"  placeholder="Ex: Cristalino, Sedimentar, Arenito" />
                            </div>
                           
                        </TabPanel>

                        <TabPanel label="2. Dados da P  erfuração">
                            <DadosPerfuracaoForm
                            />
                        </TabPanel>

                        <TabPanel label="3. Dados do Revestimento">
                            <DadosRevestimentoForm
                            />
                        </TabPanel>

                        <TabPanel label="4. Checklist e Observações">
                            {/* Passar observações e ocorrências se houver */}
                            <ChecklistOcorrenciasForm />
                        </TabPanel>

                        <TabPanel label="5. Conjunto de Bombeamento ">
                            <fieldset style={{ border: '1px solid #ddd', padding: '15px', borderRadius: '4px' }}>
                                <legend style={{ fontWeight: 'bold', padding: '0 10px' }}>Detalhes da Instalação</legend>
                                <Typography variant="h4" >Detalhes da Bomba</Typography>
                                <div className="form-row">
                                    <FormControl label="Marca" name="marcaBomba"placeholder="Grundfos, Leão" />
                                    <FormControl label="Modelo" name="modeloBomba" placeholder="SP 5A-18" />
                                </div>
                                <div className="form-row">
                                    <FormControl label="Profundidade (m)" name="profundidadeBombaMetros" type="number" placeholder="60.00" min={0} />
                                    <FormControl label="Data Instalação" name="dataInstalacaoBomba" type="date" />
                                </div>
                                <Typography variant="h4" >Testes de Campo</Typography>
                                <div className="form-row">
                                    <FormControl label="Vazão (m³/h)" name="vazaoTesteM3Hora" type="number" placeholder="5.2" min={0} />
                                    <FormControl label="Nível Estático (m)" name="nivelEstaticoTesteMetros" type="number"  placeholder="45.00" min={0} />
                                    <FormControl label="Nível Dinâmico (m)" name="nivelDinamicoTesteMetros" type="number"  placeholder="55.50" min={0} />
                                </div>
                            </fieldset>
                        </TabPanel>
                    </VerticalTabs>
                </div>
    );
};
export default Tabss;