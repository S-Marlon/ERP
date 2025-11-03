import React, { useState, ChangeEvent, FormEvent } from 'react';
import Button from '../../ui/Button/Button';
// Importação dos Módulos (Sub-formulários)
// Importação dos Componentes de Layout
import Column from './rigtsidebar';
import Tabss from './Left-sidebar';
import Topbar from './TopBar';
import FlexGridContainer from '../../Layout/FlexGridContainer/FlexGridContainer';

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

    return (
        <form className="relatorio-poco-form">
            {/* ------------------ HEADER AJUSTADO ------------------ */}
            
            <Topbar/>

            {/* ------------------ GRID PRINCIPAL (7fr 3fr) ------------------ */}
            <FlexGridContainer layout='grid' template='8fr 3fr'>

                {/* COLUNA PRINCIPAL (7fr) - ABAS VERTICAIS */}
                <Tabss/>

                {/* COLUNA SECUNDÁRIA (3fr) - AÇÕES E BOMBEAMENTO */}
                <Column/>
            </FlexGridContainer>

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