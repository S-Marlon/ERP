import React, { useState, ChangeEvent, FormEvent } from 'react';
import Typography from '../ui/Typography';
import Button from '../ui/Button';
import FormControl from '../ui/FormControl';
import Card from '../ui/Card';
import DadosPerfuracaoForm from './DadosPerfuracaoForm';
import DadosRevestimentoForm from './DadosRevestimentoForm';
import ChecklistOcorrenciasForm from './ChecklistOcorrenciasForm';
import { BotaoVoltar } from '../ui/BotaoVoltar';

// ----------------- TIPOS DE DADOS E MOCKS -----------------

// Defina as interfaces de seção, se elas existirem em seus respectivos arquivos
// Exemplo:
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
    
    // DADOS DO CONJUNTO DE BOMBEAMENTO (Atualizados)
    marcaBomba: string;
    modeloBomba: string;
    dataInstalacaoBomba: string;
    profundidadeBombaMetros: number;
    tubulacaoEdutora: string;
    cabeamentoEletrico: string;
    cavaleteSaida: string;
    
    // DADOS DOS TESTES (Atualizados - Foco em Nível Estático/Dinâmico/Vazão do Teste)
    vazaoTesteM3Hora: number; 
    nivelEstaticoTesteMetros: number;
    nivelDinamicoTesteMetros: number;
    
    // Módulos de Lista (Para DadosPerfuracaoForm, RevestimentoForm, etc.)
    secoesPerfuracao: SecaoPerfuracao[];
    secoesRevestimento: SecaoRevestimento[];
    // ... outros arrays de dados (ocorrências, fotos, etc.)
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
    // DADOS GERAIS
    contratoId: '',
    nomeIdentificacao: '',
    dataConclusao: new Date().toISOString().split('T')[0],
    latitude: 0,
    longitude: 0,
    elevacaoMetros: 0,
    profundidadeTotalMetros: 0,
    diametroConstrucaoMm: 0,
    formacaoGeologica: '',
    observacoes: '',
    
    // DADOS DE BOMBEAMENTO E TESTE (Iniciados)
    marcaBomba: '',
    modeloBomba: '',
    dataInstalacaoBomba: new Date().toISOString().split('T')[0],
    profundidadeBombaMetros: 0,
    tubulacaoEdutora: '', 
    cabeamentoEletrico: '', 
    cavaleteSaida: '',
    vazaoTesteM3Hora: 0,
    nivelEstaticoTesteMetros: 0,
    nivelDinamicoTesteMetros: 0,
    
    // Módulos (Arrays vazios)
    secoesPerfuracao: [], 
    secoesRevestimento: [],
};

// ----------------- COMPONENTE PRINCIPAL -----------------

const RelatorioPoco: React.FC = () => {
    const [formData, setFormData] = useState<PocoData>(initialState);
    const [showBombeamento, setShowBombeamento] = useState(false);

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

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        if (!formData.contratoId || !formData.nomeIdentificacao || formData.profundidadeTotalMetros <= 0) {
            alert("Erro: Preencha o Contrato, a Identificação e a Profundidade Total.");
            return;
        }
        console.log('Relatório de Poço Enviado:', formData);
        alert(`Relatório do poço "${formData.nomeIdentificacao}" salvo com sucesso!`);
    };

    return (
        <form onSubmit={handleSubmit} className="form-container">
            {/* HEADER COM BOTÃO DE VOLTAR */}
            <div className='form-header'>
                <BotaoVoltar />
                <Typography variant="h1Alt">Registro Técnico do Poço</Typography>
            </div>
            <Typography variant="pMuted" className="subtitle">
                Relatório pós-serviço (Perfuração/Manutenção)
            </Typography>

            {/* GRID PRINCIPAL DE DUAS COLUNAS */}
            <div className="grid-2-cols">
                {/* COLUNA PRINCIPAL */}
                <div className="coluna-principal">
                    <Card>
                        <Typography variant="h2Alt">Identificação da Obra</Typography>
                        <div className="form-row">
                            <FormControl
                                label="Obra/Contrato de Origem"
                                name="contratoId"
                                control="select"
                                value={formData.contratoId}
                                onChange={handleChange}
                                options={CONTRATOS_MOCK.map(c => ({
                                    value: c.id,
                                    label: c.titulo
                                }))}
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
                    </Card>

                    <DadosPerfuracaoForm /* Propriedades de controle de estado/data devem ser adicionadas */ />
                    <DadosRevestimentoForm /* Propriedades de controle de estado/data devem ser adicionadas */ />
                    <ChecklistOcorrenciasForm />
                </div>

                {/* COLUNA SECUNDÁRIA */}
                <div className="coluna-secundaria">
                    <Card>
                        <Typography variant="h2Alt">Ações e Detalhes</Typography>
                        <Button type="button" variant="outline" style={{ marginBottom: 10 }}>
                          Documentação Técnica (ex: ART, Laudos, etc.)
                        </Button><Button type="button" variant="outline" style={{ marginBottom: 10 }}>
                            📊 Registrar Testes hidraulicos de Campo
                        </Button>
                        <Button type="button" variant="outline" style={{ marginBottom: 10 }}>
                            analise da agua
                        </Button>
                        <Button type="button" variant="outline" style={{ marginBottom: 10 }}>
                            perfil geologico
                        </Button>
                        <Button type="button" variant="outline" style={{ marginBottom: 10 }}>
                            📸 Adicionar Fotos/Mídias
                        </Button>
                    </Card>
                    <Card>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setShowBombeamento(!showBombeamento)}
                            style={{ width: "100%", marginBottom: 10 }}
                        >
                            {showBombeamento ? '➖ Ocultar' : '➕ Adicionar'} Conjunto de Bombeamento
                        </Button>
                        {showBombeamento && (
                            <fieldset>
                                <legend>Dados do Conjunto de Bombeamento e Teste</legend>
                                <Typography variant="h3">Detalhes da Bomba Instalada</Typography>
                                <div className="form-row">
                                    <FormControl
                                        label="Marca da Bomba"
                                        name="marcaBomba"
                                        value={formData.marcaBomba}
                                        onChange={handleChange}
                                        placeholder="Ex: Grundfos, Schneider, Leão"
                                    />
                                    <FormControl
                                        label="Modelo da Bomba"
                                        name="modeloBomba"
                                        value={formData.modeloBomba}
                                        onChange={handleChange}
                                        placeholder="Ex: SP 5A-18, E-tech 4''"
                                    />
                                    <FormControl
                                        label="Data de Instalação"
                                        name="dataInstalacaoBomba"
                                        type="date"
                                        value={formData.dataInstalacaoBomba}
                                        onChange={handleChange}
                                    />
                                    <FormControl
                                        label="Profundidade da Bomba (m)"
                                        name="profundidadeBombaMetros"
                                        type="number"
                                        value={formData.profundidadeBombaMetros}
                                        onChange={handleChange}
                                        placeholder="60.00"
                                        min={0}
                                    />
                                </div>
                                <Typography variant="h3">Acessórios e Infraestrutura</Typography>
                                <div className="form-row">
                                    <FormControl
                                        label="Tubulação Edutora"
                                        name="tubulacaoEdutora"
                                        value={formData.tubulacaoEdutora}
                                        onChange={handleChange}
                                        placeholder="Ex: PVC Roscável 2'', Aço 3''"
                                    />
                                    <FormControl
                                        label="Cabeamento Elétrico"
                                        name="cabeamentoEletrico"
                                        value={formData.cabeamentoEletrico}
                                        onChange={handleChange}
                                        placeholder="Ex: Cabo 3 vias 6mm²"
                                    />
                                    <FormControl
                                        label="Cavalete de Saída"
                                        name="cavaleteSaida"
                                        value={formData.cavaleteSaida}
                                        onChange={handleChange}
                                        placeholder="Ex: PVC, Aço Galvanizado"
                                    />
                                </div>
                                <Typography variant="h3" style={{ marginTop: '20px' }}>
                                    Testes de Campo (Pós-Instalação)
                                </Typography>
                                <div className="form-row">
                                    <FormControl
                                        label="Vazão Aferida (m³/h)"
                                        name="vazaoTesteM3Hora"
                                        type="number"
                                        value={formData.vazaoTesteM3Hora}
                                        onChange={handleChange}
                                        placeholder="5.2"
                                        min={0}
                                    />
                                    <FormControl
                                        label="Nível Estático (Teste) (m)"
                                        name="nivelEstaticoTesteMetros"
                                        type="number"
                                        value={formData.nivelEstaticoTesteMetros}
                                        onChange={handleChange}
                                        placeholder="45.00"
                                        min={0}
                                    />
                                    <FormControl
                                        label="Nível Dinâmico (Teste) (m)"
                                        name="nivelDinamicoTesteMetros"
                                        type="number"
                                        value={formData.nivelDinamicoTesteMetros}
                                        onChange={handleChange}
                                        placeholder="55.50"
                                        min={0}
                                    />
                                </div>
                            </fieldset>
                        )}
                    </Card>
                </div>
            </div>
            <Button type="submit" variant="primary" style={{ width: "100%", marginTop: 30 }}>
                Finalizar Relatório e Salvar Dados do Poço
            </Button>
        </form>
    );
};

export default RelatorioPoco;