import React, { useState, ChangeEvent, FormEvent } from 'react';
import Button from '../../ui/Button';
// Importação dos Módulos (Sub-formulários)
// Importação dos Componentes de Layout
import Column from './rigtsidebar';
import Tabss from './Left-sidebar';
import Topbar from './TopBar';

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
            <div className="grid-container">

                {/* COLUNA PRINCIPAL (7fr) - ABAS VERTICAIS */}
                <Tabss/>

                {/* COLUNA SECUNDÁRIA (3fr) - AÇÕES E BOMBEAMENTO */}
                <Column/>
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