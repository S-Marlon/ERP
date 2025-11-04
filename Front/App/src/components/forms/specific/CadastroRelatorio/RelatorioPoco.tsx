import React, { useState, ChangeEvent, FormEvent } from 'react';
import Button from '../../../ui/Button/Button';
// Importação dos Módulos (Sub-formulários)
// Importação dos Componentes de Layout
import Column from './rigtsidebar';
import Tabss from './Left-sidebar';
import Topbar from './TopBar';
import FlexGridContainer from '../../../Layout/FlexGridContainer/FlexGridContainer';

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


const initialState: PocoData = {
    // ... (restante do seu initial state)
    contratoId: '12345-EXEMPLO', // Exemplo
    nomeIdentificacao: 'Poço de Teste 001', // Exemplo
    dataConclusao: new Date().toISOString().split('T')[0],
    latitude: -23.5505, longitude: -46.6333, elevacaoMetros: 760, // Exemplo
    profundidadeTotalMetros: 150.5, diametroConstrucaoMm: 200, // Exemplo
    formacaoGeologica: 'Arenito Bauru', observacoes: 'Primeiro teste de preenchimento.',
    marcaBomba: 'Grundfos', modeloBomba: 'SP 123-A',
    dataInstalacaoBomba: new Date().toISOString().split('T')[0],
    profundidadeBombaMetros: 50,
    tubulacaoEdutora: 'PVC 2"', cabeamentoEletrico: 'Cabo Submersível 3x4mm', cavaleteSaida: 'Válvula Esfera',
    vazaoTesteM3Hora: 20, nivelEstaticoTesteMetros: 15.5, nivelDinamicoTesteMetros: 25.8,
    // Exemplo para visualização das listas:
    secoesPerfuracao: [
        { deMetros: 0, aMetros: 10, litologia: 'Solo' },
        { deMetros: 10, aMetros: 50, litologia: 'Argilito' },
    ],
    secoesRevestimento: [
        { tipo: 'Aço Carbono', diametroMm: 200, deMetros: 0, aMetros: 6 },
    ],
};

// ----------------- COMPONENTE PRINCIPAL -----------------

const RelatorioPoco: React.FC = () => {
    // 1. Integrar o Estado (useState)
    const [pocoData, setPocoData] = useState<PocoData>(initialState);

    // Função de exemplo para demonstração (você deve ter algo assim nos seus inputs)
    // const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    //     const { name, value, type } = e.target;
    //     setPocoData(prevData => ({
    //         ...prevData,
    //         [name]: type === 'number' ? parseFloat(value) : value
    //     }));
    // };

    // 2. Adicionar a Função de Submissão
    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        console.log("Dados prontos para envio:", pocoData);
        // Aqui você faria a chamada para o backend (ex: axios.post)
        alert('Formulário Submetido (Verifique o console para os dados)');
    };

    return (
        <form className="relatorio-poco-form" onSubmit={handleSubmit}>
            {/* ------------------ HEADER AJUSTADO ------------------ */}
            <Topbar/>

            {/* ------------------ GRID PRINCIPAL (8fr 3fr) ------------------ */}
            <FlexGridContainer layout='grid' template='8fr 3fr'>

                {/* COLUNA PRINCIPAL (8fr) - ABAS VERTICAIS */}
                <Tabss/>

                {/* COLUNA SECUNDÁRIA (3fr) - AÇÕES E BOMBEAMENTO */}
                <Column/>
            </FlexGridContainer>

            {/* ------------------ BOTÕES DE SUBMISSÃO ------------------ */}
            <Button type="submit" variant="success" style={{ width: "100%", marginTop: 30, fontSize: '1.2em' }}>
                ✅ Finalizar Relatório e Salvar Dados do Poço
            </Button>

            <Button type="button" variant="outline" style={{ width: "100%", marginTop: 30, fontSize: '1.2em' }}>
                💾 Salvar Rascunho do Relatório
            </Button>
            
            {/* ------------------ 3. NOVA SEÇÃO DE VISUALIZAÇÃO DE DADOS ------------------ */}
            <div style={{ 
                marginTop: '40px', 
                padding: '20px', 
                border: '1px solid #ccc', 
                borderRadius: '8px',
                backgroundColor: '#f9f9f9'
            }}>
                <h3 style={{ borderBottom: '2px solid #ddd', paddingBottom: '10px', marginBottom: '15px' }}>
                    👀 Visualização de Variáveis (Pré-envio)
                </h3>
                
                {/* Oculta se pocoData estiver vazio (embora com o initialState isso não ocorra) */}
                {pocoData && (
                    <pre style={{ 
                        whiteSpace: 'pre-wrap', // Quebra as linhas longas
                        wordBreak: 'break-word', // Quebra palavras longas
                        backgroundColor: '#000000ff', 
                        padding: '15px', 
                        borderRadius: '4px',
                        fontSize: '0.85em',
                        overflowX: 'auto' // Adiciona barra de rolagem horizontal se necessário
                    }}>
                        {/* JSON.stringify(valor, replacer, espaço)
                            O 'null' é o replacer (não estamos usando).
                            O '2' formata com 2 espaços de indentação, tornando-o legível.
                        */}
                        {JSON.stringify(pocoData, null, 2)}
                    </pre>
                )}
                {!pocoData && <p>Nenhum dado do poço disponível para visualização.</p>}
            </div>
            {/* ------------------------------------------------------------------------------------ */}
        </form>
    );
};

export default RelatorioPoco;