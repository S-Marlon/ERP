import React, { useState, ChangeEvent, FormEvent } from 'react';
import Typography from '../ui/Typography';
import Button from '../ui/Button';
import FormControl from '../ui/FormControl';
import Card from '../ui/Card';
// Importação dos Módulos (Sub-formulários)
import DadosPerfuracaoForm from './DadosPerfuracaoForm';
import DadosRevestimentoForm from './DadosRevestimentoForm';
import ChecklistOcorrenciasForm from './ChecklistOcorrenciasForm';
// Importação dos Componentes de Layout
import TabPanel from '../ui/TabPanel';
import VerticalTabs from '../ui/VerticalTabs';

// ----------------- TIPOS DE DADOS E MOCKS (MANTIDOS) -----------------

interface SecaoPerfuracao {
    deMetros: number;
    aMetros: number;
    litologia: string;
}
interface SecaoRevestimento {
    tipo: string;
    diametroMm: number;
    deMetros: number;
    aMetros: number;
}
interface PocoData {
    // DADOS GERAIS
    contratoId: string;
    nomeIdentificacao: string;
    dataConclusao: string;
    latitude: number;
    longitude: number;
    elevacaoMetros: number;
    profundidadeTotalMetros: number;
    diametroConstrucaoMm: number;
    formacaoGeologica: string;
    observacoes: string;

    // DADOS DO CONJUNTO DE BOMBEAMENTO
    marcaBomba: string;
    modeloBomba: string;
    dataInstalacaoBomba: string;
    profundidadeBombaMetros: number;
    tubulacaoEdutora: string;
    cabeamentoEletrico: string;
    cavaleteSaida: string;

    // DADOS DOS TESTES
    vazaoTesteM3Hora: number;
    nivelEstaticoTesteMetros: number;
    nivelDinamicoTesteMetros: number;

    // Módulos de Lista
    secoesPerfuracao: SecaoPerfuracao[];
    secoesRevestimento: SecaoRevestimento[];
}

interface ContratoSimples {
    id: string;
    titulo: string;
}

const CONTRATOS_MOCK: ContratoSimples[] = [
    { id: '', titulo: 'Selecione a Obra/Contrato' },
    { id: 'cont-005', titulo: 'Poço Novo - Fazenda Esperança' },
    { id: 'cont-008', titulo: 'Aprofundamento - Sítio da Pedra' },
];

const initialState: PocoData = {
    // ... (restante do seu initial state)
    contratoId: '',
    nomeIdentificacao: '',
    dataConclusao: new Date().toISOString().split('T')[0],
    latitude: 0, longitude: 0, elevacaoMetros: 0,
    profundidadeTotalMetros: 0, diametroConstrucaoMm: 0,
    formacaoGeologica: '', observacoes: '',
    marcaBomba: '', modeloBomba: '',
    dataInstalacaoBomba: new Date().toISOString().split('T')[0],
    profundidadeBombaMetros: 0,
    tubulacaoEdutora: '', cabeamentoEletrico: '', cavaleteSaida: '',
    vazaoTesteM3Hora: 0, nivelEstaticoTesteMetros: 0, nivelDinamicoTesteMetros: 0,
    secoesPerfuracao: [],
    secoesRevestimento: [],
};

// ----------------- COMPONENTE PRINCIPAL -----------------

const RelatorioPoco: React.FC = () => {
    const [formData, setFormData] = useState<PocoData>(initialState);
    const [showBombeamento, setShowBombeamento] = useState(false);

    // Função genérica para campos simples (mantida)
    const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;
        const numericFields = [
            'latitude', 'longitude', 'elevacaoMetros', 'profundidadeTotalMetros',
            'diametroConstrucaoMm', 'profundidadeBombaMetros',
            'vazaoTesteM3Hora', 'nivelEstaticoTesteMetros', 'nivelDinamicoTesteMetros'
        ];
        const isNumeric = numericFields.includes(name) || type === 'number';
        const finalValue: string | number = isNumeric ? parseFloat(value) || 0 : value;
        setFormData(prevData => ({
            ...prevData,
            [name as keyof PocoData]: finalValue,
        }));
    };

    // Função específica para atualizar dados de lista (Perfuracao, Revestimento, etc.)
    const handleListChange = <K extends keyof PocoData>(name: K, list: PocoData[K]) => {
        setFormData(prevData => ({
            ...prevData,
            [name]: list,
        }));
    };

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        // ... (lógica de validação)
        console.log('Relatório de Poço Enviado:', formData);
        alert(`Relatório do poço "${formData.nomeIdentificacao}" salvo com sucesso!`);
    };

    return (
        <form onSubmit={handleSubmit} className="relatorio-poco-form">
            {/* ------------------ HEADER AJUSTADO ------------------ */}
            <div className='form-header-row'>

                <Typography variant="h1Alt">
                    Registro Técnico do Poço
                </Typography>
            </div>

            <div className='flex-row'>
                <Typography variant="pMuted" className="subtitle" >
                    Relatório pós-serviço (Perfuração/Manutenção)
                </Typography>
                <FormControl
                    label="Obra/Contrato de Origem"
                    name="contratoId"
                    control="select"
                    value={formData.contratoId}
                    onChange={handleChange}
                    options={CONTRATOS_MOCK.map(c => ({ value: c.id, label: c.titulo }))}
                    required
                />
                <FormControl
                    label="Nome de Identificação do Poço"
                    name="nomeIdentificacao"
                    value={formData.nomeIdentificacao}
                    onChange={handleChange}
                    placeholder="Ex: Poço Principal - Casa 1"
                    required
                />
                <FormControl
                    label="Data do Relatório"
                    name="dataConclusao"
                    type="date"
                    value={formData.dataConclusao}
                    onChange={handleChange}
                    required
                />
            </div>

            {/* ------------------ GRID PRINCIPAL (7fr 3fr) ------------------ */}
            <div className="grid-container">

                {/* COLUNA PRINCIPAL (7fr) - ABAS VERTICAIS */}
                <div className="coluna-principal">
                    <VerticalTabs defaultActiveIndex={0}>

                         <TabPanel label="1. Dados Gerais do poço">
                            <Typography variant="h3">Localização e Características</Typography>
                            <div className="form-row">
                                <FormControl label="Latitude" name="latitude" type="number" value={formData.latitude} onChange={handleChange} placeholder="00.000000" />
                                <FormControl label="Longitude" name="longitude" type="number" value={formData.longitude} onChange={handleChange} placeholder="00.000000" />
                            </div>
                            <div className="form-row">
                                <FormControl label="Profundidade Total (m)" name="profundidadeTotalMetros" type="number" value={formData.profundidadeTotalMetros} onChange={handleChange} placeholder="100.00" min={0} required />
                                <FormControl label="Diâmetro Construção (mm)" name="diametroConstrucaoMm" type="number" value={formData.diametroConstrucaoMm} onChange={handleChange} placeholder="203.2 (8'')" min={0} />
                                <FormControl label="Formação Geológica Predominante" name="formacaoGeologica" value={formData.formacaoGeologica} onChange={handleChange} placeholder="Ex: Cristalino, Sedimentar, Arenito" />
                            </div>
                           
                        </TabPanel>

                        <TabPanel label="2. Dados da P  erfuração">
                            <DadosPerfuracaoForm
                                data={formData.secoesPerfuracao}
                                onChange={(list) => handleListChange('secoesPerfuracao', list)}
                            />
                        </TabPanel>

                        <TabPanel label="3. Dados do Revestimento">
                            <DadosRevestimentoForm
                                data={formData.secoesRevestimento}
                                onChange={(list) => handleListChange('secoesRevestimento', list)}
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
                                    <FormControl label="Marca" name="marcaBomba" value={formData.marcaBomba} onChange={handleChange} placeholder="Grundfos, Leão" />
                                    <FormControl label="Modelo" name="modeloBomba" value={formData.modeloBomba} onChange={handleChange} placeholder="SP 5A-18" />
                                </div>
                                <div className="form-row">
                                    <FormControl label="Profundidade (m)" name="profundidadeBombaMetros" type="number" value={formData.profundidadeBombaMetros} onChange={handleChange} placeholder="60.00" min={0} />
                                    <FormControl label="Data Instalação" name="dataInstalacaoBomba" type="date" value={formData.dataInstalacaoBomba} onChange={handleChange} />
                                </div>
                                <Typography variant="h4" >Testes de Campo</Typography>
                                <div className="form-row">
                                    <FormControl label="Vazão (m³/h)" name="vazaoTesteM3Hora" type="number" value={formData.vazaoTesteM3Hora} onChange={handleChange} placeholder="5.2" min={0} />
                                    <FormControl label="Nível Estático (m)" name="nivelEstaticoTesteMetros" type="number" value={formData.nivelEstaticoTesteMetros} onChange={handleChange} placeholder="45.00" min={0} />
                                    <FormControl label="Nível Dinâmico (m)" name="nivelDinamicoTesteMetros" type="number" value={formData.nivelDinamicoTesteMetros} onChange={handleChange} placeholder="55.50" min={0} />
                                </div>
                            </fieldset>
                        </TabPanel>
                    </VerticalTabs>
                </div>

                {/* COLUNA SECUNDÁRIA (3fr) - AÇÕES E BOMBEAMENTO */}
                <div className="coluna-secundaria">

                    {/* COLUNA SECUNDÁRIA (3fr) */}
                    <div className="coluna-secundaria">

                        {/* CARD 1: AÇÕES PRINCIPAIS E EDIÇÃO DE METADADOS */}
                        <Card >
                            <Typography variant="h2Alt">Ações Essenciais</Typography>

                            
                            <Button type="button" variant="outline" style={{ width: '100%', marginBottom: 10 }}>
                                📊 Registrar Testes Hidráulicos de Campo {/* Ação de registro de dados */}
                            </Button>

                            <Typography variant="h3" >Documentação e Mídia</Typography>

                            
                            <Button type="button" variant="outline" style={{ width: '100%', marginBottom: 10 }}>
                                📁 Anexar Documentos/Laudos
                            </Button>
                            <Button type="button" variant="outline" style={{ width: '100%', marginBottom: 10 }}>
                                📸 Adicionar Fotos/Mídias
                            </Button>
                        </Card>


                        {/* CARD 3: INFORMAÇÕES TÉCNICAS E MONITORAMENTO (Menos Frequentes) */}
                        <Card>
                            <Typography variant="h2Alt">Dados Técnicos e Históricos</Typography>

                            {/* DADOS DETALHADOS E HISTÓRICOS */}
                            <Button type="button" variant="outline" style={{ width: '100%', marginBottom: 10 }}>
                                Perfil geológico detalhado
                            </Button>
                            <Button type="button" variant="outline" style={{ width: '100%', marginBottom: 10 }}>
                                documentação técnica do poço
                            </Button>
                            <Button type="button" variant="outline" style={{ width: '100%', marginBottom: 10 }}>
                                análises de qualidade da água
                            </Button>
                            <Button type="button" variant="outline" style={{ width: '100%', marginBottom: 10 }}>
                                monitoramento de níveis e vazões
                            </Button>

                           
                            
                            
                           
                        </Card>

                        {/* AÇÕES DE RISCO (MANTIDAS FORA DO CARD PRINCIPAL OU COM VISUAL DIFERENCIADO) */}
                        <Card style={{ marginTop: 20, backgroundColor: '#ffe6e6', border: '1px solid #ff4d4f' }}>
                            <Typography variant="h2Alt" style={{ color: '#ff4d4f' }}>Zona de Risco</Typography>
                            <Button type="button" variant="danger" style={{ width: '100%', marginBottom: 10 }}>
                                🗑️ Excluir Relatório do Poço
                            </Button>
                        </Card>

                    </div>




                    {/* CARD DE BOMBEAMENTO E TESTES (toggle) */}
                    <Card>
                        <Button
                            type="button"
                            variant="primary"
                            onClick={() => setShowBombeamento(!showBombeamento)}
                            style={{ width: "100%", marginBottom: showBombeamento ? 15 : 0 }}
                        >
                            {showBombeamento ? '➖ Ocultar' : '➕ Adicionar'} Conjunto de Bombeamento
                        </Button>
                        {showBombeamento && (
                            <fieldset style={{ border: '1px solid #ddd', padding: '15px', borderRadius: '4px' }}>
                                <legend style={{ fontWeight: 'bold', padding: '0 10px' }}>Detalhes da Instalação</legend>
                                <Typography variant="h4" >Detalhes da Bomba</Typography>
                                <div className="form-row">
                                    <FormControl label="Marca" name="marcaBomba" value={formData.marcaBomba} onChange={handleChange} placeholder="Grundfos, Leão" />
                                    <FormControl label="Modelo" name="modeloBomba" value={formData.modeloBomba} onChange={handleChange} placeholder="SP 5A-18" />
                                </div>
                                <div className="form-row">
                                    <FormControl label="Profundidade (m)" name="profundidadeBombaMetros" type="number" value={formData.profundidadeBombaMetros} onChange={handleChange} placeholder="60.00" min={0} />
                                    <FormControl label="Data Instalação" name="dataInstalacaoBomba" type="date" value={formData.dataInstalacaoBomba} onChange={handleChange} />
                                </div>
                                <Typography variant="h4" >Testes de Campo</Typography>
                                <div className="form-row">
                                    <FormControl label="Vazão (m³/h)" name="vazaoTesteM3Hora" type="number" value={formData.vazaoTesteM3Hora} onChange={handleChange} placeholder="5.2" min={0} />
                                    <FormControl label="Nível Estático (m)" name="nivelEstaticoTesteMetros" type="number" value={formData.nivelEstaticoTesteMetros} onChange={handleChange} placeholder="45.00" min={0} />
                                    <FormControl label="Nível Dinâmico (m)" name="nivelDinamicoTesteMetros" type="number" value={formData.nivelDinamicoTesteMetros} onChange={handleChange} placeholder="55.50" min={0} />
                                </div>
                            </fieldset>
                        )}
                    </Card>
                </div>
            </div>

            {/* ------------------ BOTÃO DE SUBMISSÃO ------------------ */}
            <Button type="submit" variant="success" style={{ width: "100%", marginTop: 30, fontSize: '1.2em' }}>
                ✅ Finalizar Relatório e Salvar Dados do Poço
            </Button>


            <Button type="button" variant="outline" style={{ width: "100%", marginTop: 30, fontSize: '1.2em' }}>
                💾 Salvar Rascunho do Relatório
            </Button>
        </form>
    );
};

export default RelatorioPoco;


// ----------------- ESTILOS CSS INLINE PARA DEMONSTRAÇÃO -----------------

// Adicione este bloco de estilos ao seu arquivo CSS global ou CSS Module
const style = `
.relatorio-poco-form {
    max-width: 1600px; /* Ajuste o máximo para melhor visualização */
    margin: 0 auto 50px auto;
}

.form-header-row {
    display: flex;
    align-items: center;
    margin-bottom: 5px;
    border-bottom: 2px solid #eee;
}



.form-row {
    display: flex;
    gap: 10px;
}
.form-row > * {
    flex: 1; /* Faz com que os FormControls ocupem o mesmo espaço */
}

.grid-container {
    display: grid; 
    grid-template-columns: 8fr 3fr; 
    gap: 10px; /* Mais espaço entre as colunas */
    width: 100%;
}

.coluna-principal {
    /* Sem bordas de debug. O VerticalTabs deve ter suas próprias bordas. */
}

.coluna-secundaria {
    /* Sem bordas de debug. Os Cards devem ter suas próprias sombras/bordas. */
}

/* Opcional: Responsividade para telas menores */
@media (max-width: 1024px) {
    .grid-container {
        grid-template-columns: 1fr; /* Volta para coluna única */
    }
}
@media (max-width: 768px) {
   
}
`;

// *******************************************************************
// ADICIONANDO O STYLE AO DOCUMENTO (Mantenha este bloco no final do arquivo .tsx para a demo)
// Em produção, mova os estilos acima para um arquivo CSS Module ou componente de Estilo.
if (typeof document !== "undefined" && !document.querySelector('style#relatorio-poco-styles')) {
    const styleTag = document.createElement("style");
    styleTag.id = 'relatorio-poco-styles';
    styleTag.innerHTML = style;
    document.head.appendChild(styleTag);
}
// *******************************************************************