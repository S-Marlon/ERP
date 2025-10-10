import React, { useState, ChangeEvent, FormEvent } from 'react';
import { BotaoVoltar } from '../ui/BotaoVoltar';
// Importe os componentes modulares (Você deve garantir que estão exportando seus tipos, se aplicável)
import DadosPerfuracaoForm from './DadosPerfuracaoForm';
import DadosRevestimentoForm from './DadosRevestimentoForm';
import ChecklistOcorrenciasForm from './ChecklistOcorrenciasForm';
// import { DadosGeraisForm } from './DadosGeraisForm'; // 🆕 Novo componente criado

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
    
    // 🆕 Estado para controlar a visibilidade do módulo de bombeamento
    const [showBombeamento, setShowBombeamento] = useState(false);

    const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;
        
        // Define quais campos devem ser tratados como números (ATUALIZADO)
        const numericFields = [
            'latitude', 'longitude', 'elevacaoMetros', 'profundidadeTotalMetros', 
            'diametroConstrucaoMm', 'profundidadeBombaMetros',
            'vazaoTesteM3Hora', 'nivelEstaticoTesteMetros', 'nivelDinamicoTesteMetros'
        ];
        
        const isNumeric = numericFields.includes(name) || type === 'number';

        const finalValue: string | number = isNumeric 
            ? parseFloat(value) || 0 
            : value;
            
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

    // ----------------- RENDERIZAÇÃO -----------------

    return (
        <form onSubmit={handleSubmit} className="form-container">
            
            {/* HEADER COM BOTÃO DE VOLTAR */}
            <div className='form-header'>
                <BotaoVoltar />
                <h1>Registro Técnico do Poço</h1>
            </div>
            <p className="subtitle">Relatório pós-serviço (Perfuração/Manutenção)</p>

            {/* GRID PRINCIPAL DE DUAS COLUNAS */}
            <div className="grid-2-cols">

                {/* =========== COLUNA 1: DADOS GERAIS E MÓDULOS DE CONSTRUÇÃO =========== */}
                <div className="coluna-principal">
                    
                     {/* ----------------- SEÇÃO: REFERÊNCIA E IDENTIFICAÇÃO ----------------- */}
            <fieldset>
                <legend>Identificação da Obra</legend>
                
                <div className="form-row">
                    <div className='flex-1-2'>
                        <label htmlFor="contratoId">Obra/Contrato de Origem</label>
                        <select
                            id="contratoId"
                            name="contratoId"
                            value={formData.contratoId}
                            onChange={handleChange}
                            required
                        >
                            {CONTRATOS_MOCK.map(c => (
                                <option key={c.id} value={c.id} disabled={c.id === ''}>
                                    {c.titulo}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className='flex-1-2'>
                        <label htmlFor="nomeIdentificacao">Nome de Identificação do Poço</label>
                        <input
                            type="text"
                            id="nomeIdentificacao"
                            name="nomeIdentificacao"
                            value={formData.nomeIdentificacao}
                            onChange={handleChange}
                            placeholder="Ex: Poço Principal - Casa 1"
                            required
                        />
                    </div>
                    
                    <div className='flex-1-4'>
                        <label htmlFor="dataConclusao">Data do Relatório</label>
                        <input
                            type="date"
                            id="dataConclusao"
                            name="dataConclusao"
                            value={formData.dataConclusao}
                            onChange={handleChange}
                            required
                        />
                    </div>
                </div>
            </fieldset>

                    <DadosPerfuracaoForm /* Propriedades de controle de estado/data devem ser adicionadas */ />
                    <DadosRevestimentoForm /* Propriedades de controle de estado/data devem ser adicionadas */ />
                    
                    {/* Observações GERAIS */}
                    <ChecklistOcorrenciasForm/>
                    
                </div>

                {/* =========== COLUNA 2: BOTÕES DE AÇÃO E MÓDULOS SECUNDÁRIOS =========== */}
                <div className="coluna-secundaria">
                    
                    <fieldset className="actions-fieldset">
                        <legend>Ações e Detalhes</legend>
                        
                        
                        {/* Botões para Testes e Fotos */}
                        <button type="button" className="action-button" onClick={() => {/* Abrir Modal ou Seção de Testes */}}>
                            📊 Registrar Testes de Campo
                        </button>
                        
                        <button type="button" className="action-button" onClick={() => {/* Abrir Galeria de Fotos */}}>
                            📸 Adicionar Fotos/Mídias
                        </button>
                        
                    </fieldset>
                    
                    {/* ----------------- MÓDULO CONJUNTO DE BOMBEAMENTO (Expandido) ----------------- */}
                        {/* Botão de Ação para o Módulo de Bombeamento */}
                        <button type="button" className="action-button" onClick={() => setShowBombeamento(!showBombeamento)}>
                            {showBombeamento ? '➖ Ocultar' : '➕ Adicionar'} Conjunto de Bombeamento
                        </button>
                    {showBombeamento && (
                        <fieldset>
                            <legend>Dados do Conjunto de Bombeamento e Teste</legend>
                            
                            <h3>Detalhes da Bomba Instalada</h3>
                            <div className="form-row">
                                {/* Marca e Modelo da Bomba */}
                                <div>
                                    <label htmlFor="marcaBomba">Marca da Bomba</label>
                                    <input type="text" id="marcaBomba" name="marcaBomba" value={formData.marcaBomba} onChange={handleChange} placeholder="Ex: Grundfos, Schneider, Leão" />
                                </div>
                                <div>
                                    <label htmlFor="modeloBomba">Modelo da Bomba</label>
                                    <input type="text" id="modeloBomba" name="modeloBomba" value={formData.modeloBomba} onChange={handleChange} placeholder="Ex: SP 5A-18, E-tech 4''" />
                                </div>
                                {/* Data de Instalação e Profundidade */}
                                <div className='flex-1-4'>
                                    <label htmlFor="dataInstalacaoBomba">Data de Instalação</label>
                                    <input type="date" id="dataInstalacaoBomba" name="dataInstalacaoBomba" value={formData.dataInstalacaoBomba} onChange={handleChange} />
                                </div>
                                <div className='input-with-unit flex-1-4'>
                                    <label htmlFor="profundidadeBombaMetros">Profundidade da Bomba</label>
                                    <input type="number" id="profundidadeBombaMetros" name="profundidadeBombaMetros" value={formData.profundidadeBombaMetros} onChange={handleChange} placeholder="60.00" step="0.01" min="0" />
                                    <span className="unit-label">m</span>
                                </div>
                            </div>

                            <h3>Acessórios e Infraestrutura</h3>
                            <div className="form-row">
                                {/* Tubulação Edutora */}
                                <div>
                                    <label htmlFor="tubulacaoEdutora">Tubulação Edutora</label>
                                    <input type="text" id="tubulacaoEdutora" name="tubulacaoEdutora" value={formData.tubulacaoEdutora} onChange={handleChange} placeholder="Ex: PVC Roscável 2'', Aço 3''" />
                                </div>
                                {/* Cabeamento Elétrico */}
                                <div>
                                    <label htmlFor="cabeamentoEletrico">Cabeamento Elétrico</label>
                                    <input type="text" id="cabeamentoEletrico" name="cabeamentoEletrico" value={formData.cabeamentoEletrico} onChange={handleChange} placeholder="Ex: Cabo 3 vias 6mm²" />
                                </div>
                                {/* Cavalete de Saída */}
                                <div>
                                    <label htmlFor="cavaleteSaida">Cavalete de Saída</label>
                                    <input type="text" id="cavaleteSaida" name="cavaleteSaida" value={formData.cavaleteSaida} onChange={handleChange} placeholder="Ex: PVC, Aço Galvanizado" />
                                </div>
                            </div>

                            <h3 style={{marginTop: '20px'}}>Testes de Campo (Pós-Instalação)</h3>
                            <div className="form-row">
                                {/* Vazão Teste */}
                                <div className='input-with-unit'>
                                    <label htmlFor="vazaoTesteM3Hora">Vazão Aferida</label>
                                    <input type="number" id="vazaoTesteM3Hora" name="vazaoTesteM3Hora" value={formData.vazaoTesteM3Hora} onChange={handleChange} placeholder="5.2" step="0.01" min="0" />
                                    <span className="unit-label">m³/h</span>
                                </div>
                                {/* Nível Estático Teste */}
                                <div className='input-with-unit'>
                                    <label htmlFor="nivelEstaticoTesteMetros">Nível Estático (Teste)</label>
                                    <input type="number" id="nivelEstaticoTesteMetros" name="nivelEstaticoTesteMetros" value={formData.nivelEstaticoTesteMetros} onChange={handleChange} placeholder="45.00" step="0.01" min="0" />
                                    <span className="unit-label">m</span>
                                </div>
                                {/* Nível Dinâmico Teste */}
                                <div className='input-with-unit'>
                                    <label htmlFor="nivelDinamicoTesteMetros">Nível Dinâmico (Teste)</label>
                                    <input type="number" id="nivelDinamicoTesteMetros" name="nivelDinamicoTesteMetros" value={formData.nivelDinamicoTesteMetros} onChange={handleChange} placeholder="55.50" step="0.01" min="0" />
                                    <span className="unit-label">m</span>
                                </div>
                            </div>
                        </fieldset>
                    )}
                </div>

            </div> {/* Fim do grid-2-cols */}

            <button type="submit" className="submit-button">
                Finalizar Relatório e Salvar Dados do Poço
            </button>
        </form>
    );
};

// ----------------- ESTILOS (CSS) REFINADOS -----------------
const style = `
.form-container {
    max-width: 90%; /* Ajustei para 90% para dar mais espaço */
    margin: 30px auto;
    padding: 30px;
    border: 1px solid #e0e0e0;
    border-radius: 10px;
    box-shadow: 0 6px 15px rgba(0,0,0,0.1);
    background-color: #ffffff;
    font-family: Arial, sans-serif;
}
.form-header {
    display: flex;
    align-items: center;
    margin-bottom: 5px;
}
.form-header h1 { 
    margin: 0 0 0 15px; 
    color: #17a2b8; 
    font-size: 1.8em;
    border-bottom: none;
    padding-bottom: 0;
    flex-grow: 1;
}
.subtitle { text-align: center; color: #6c757d; margin-bottom: 25px; margin-top: 0;}

fieldset { border: 1px solid #17a2b855; padding: 20px; margin-bottom: 25px; border-radius: 8px; }
legend { font-weight: bold; color: #17a2b8; padding: 0 10px; font-size: 1.1em; background-color: #ffffff; margin-left: -5px; }

label { display: block; margin-bottom: 5px; font-weight: 600; color: #495057; }
input[type="text"],
input[type="number"],
input[type="date"],
select,
textarea {
    width: 100%;
    padding: 10px;
    border: 1px solid #ced4da;
    border-radius: 4px;
    box-sizing: border-box;
    margin-bottom: 5px;
    transition: border-color 0.2s;
}
textarea { resize: vertical; }

/* Layout de Linhas */
.form-row { display: flex; gap: 15px; margin-bottom: 10px; }
.form-row > div { flex: 1; }
.flex-1-2 { flex: 2; } /* Ocupa o dobro do espaço dos vizinhos de 1-4 */
.flex-1-4 { flex: 1; } /* Ocupa um quarto do espaço total da linha de 4 colunas */


/* Layout de Duas Colunas (Principal Feature) */
.grid-2-cols {
    display: grid;
    grid-template-columns: 2fr 1fr; /* Coluna Principal (2/3) e Coluna Secundária (1/3) */
    gap: 25px;
    align-items: flex-start; /* Alinha o conteúdo ao topo */
}
.coluna-principal fieldset {
    margin-bottom: 15px; /* Mais compacto na coluna principal */
}
.coluna-principal h3,
.coluna-secundaria h3 {
    font-size: 1.05em;
    color: #495057;
    margin-top: 15px;
    margin-bottom: 10px;
    padding-bottom: 5px;
    border-bottom: 1px dashed #ced4da;
}

/* Unidades de Medida ao lado do Input */
.input-with-unit {
    position: relative;
    padding-right: 35px;
}
.input-with-unit input {
    padding-right: 40px;
}
.unit-label {
    position: absolute;
    right: 15px;
    bottom: 15px; 
    font-weight: bold;
    color: #6c757d;
    pointer-events: none;
}

/* Estilos dos Botões de Ação */
.actions-fieldset {
    margin-bottom: 25px;
    padding-bottom: 15px;
}
.actions-fieldset legend {
    color: #6c757d; 
}
.action-button {
    width: 100%;
    padding: 12px 15px;
    margin-bottom: 10px;
    background-color: #f8f9fa;
    color: #17a2b8;
    border: 1px solid #17a2b8;
    border-radius: 6px;
    cursor: pointer;
    font-weight: 600;
    transition: background-color 0.2s, color 0.2s;
    text-align: left;
}
.action-button:hover {
    background-color: #17a2b8;
    color: white;
}

/* Submissão */
.submit-button {
    display: block;
    width: 100%;
    padding: 15px;
    background-color: #17a2b8;
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 1.2em;
    cursor: pointer;
    transition: background-color 0.3s ease;
    margin-top: 30px;
    font-weight: bold;
}
.submit-button:hover {
    background-color: #117a8b;
}
`;

// Opcional: Adicionar estilos ao DOM para visualização
if (typeof document !== 'undefined') {
    const styleTag = document.createElement('style');
    styleTag.textContent = style;
    document.head.appendChild(styleTag);
}

export default RelatorioPoco;