import React, { useState, ChangeEvent, FormEvent } from 'react';

// ----------------- TIPOS DE DADOS E MOCKS (Reaproveitados ou definidos acima) -----------------

interface PocoData {
  contratoId: string;
  nomeIdentificacao: string;
  dataConclusao: string;
  latitude: number;
  longitude: number;
  elevacaoMetros: number;
  profundidadeTotalMetros: number;
  diametroConstrucaoMm: number;
  nivelDinamicoMetros: number;
  nivelEstaticoMetros: number;
  vazaoMaximaM3Hora: number;
  tipoBomba: string;
  modeloBomba: string;
  profundidadeBombaMetros: number;
  formacaoGeologica: string;
  observacoes: string;
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

// ----------------- ESTADO INICIAL -----------------

const initialState: PocoData = {
  contratoId: '',
  nomeIdentificacao: '',
  dataConclusao: new Date().toISOString().split('T')[0], // Data de hoje
  latitude: 0,
  longitude: 0,
  elevacaoMetros: 0,
  profundidadeTotalMetros: 0,
  diametroConstrucaoMm: 0,
  nivelDinamicoMetros: 0,
  nivelEstaticoMetros: 0,
  vazaoMaximaM3Hora: 0,
  tipoBomba: 'Submersa',
  modeloBomba: '',
  profundidadeBombaMetros: 0,
  formacaoGeologica: '',
  observacoes: '',
};

// ----------------- COMPONENTE PRINCIPAL -----------------

const RelatorioPoco: React.FC = () => {
  const [formData, setFormData] = useState<PocoData>(initialState);

  // Handler de mudança unificado
  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    
    // Para campos numéricos, converte para float; caso contrário, mantém como string
    const isNumeric = type === 'number' || [
        'latitude', 'longitude', 'elevacaoMetros', 'profundidadeTotalMetros', 
        'diametroConstrucaoMm', 'nivelDinamicoMetros', 'nivelEstaticoMetros', 
        'vazaoMaximaM3Hora', 'profundidadeBombaMetros'
    ].includes(name);

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
        alert("Preencha o Contrato, a Identificação e a Profundidade Total para continuar.");
        return;
    }

    // Lógica para salvar o relatório no sistema
    console.log('Relatório de Poço Enviado:', formData);
    alert(`Relatório do poço "${formData.nomeIdentificacao}" salvo com sucesso!`);
    
    // Opcional: setFormData(initialState);
  };

  // ----------------- RENDERIZAÇÃO -----------------

  return (
    <form onSubmit={handleSubmit} className="form-container">
      <h1>Registro Técnico do Poço</h1>
      <p className="subtitle">Relatório pós-serviço (Perfuração/Manutenção)</p>

      {/* ----------------- SEÇÃO: REFERÊNCIA E IDENTIFICAÇÃO ----------------- */}
      <fieldset>
        <legend>Referência</legend>
        
        <div className="form-row">
            <div>
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

            <div>
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
            
            <div>
              <label htmlFor="dataConclusao">Data do Relatório/Conclusão</label>
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
      
      {/* ----------------- SEÇÃO: LOCALIZAÇÃO E ELEVAÇÃO ----------------- */}
      <fieldset>
        <legend>Localização e Nível</legend>
        
        <div className="form-row">
            <div>
              <label htmlFor="latitude">Latitude</label>
              <input
                type="number"
                id="latitude"
                name="latitude"
                value={formData.latitude}
                onChange={handleChange}
                placeholder="-23.55"
              />
            </div>

            <div>
              <label htmlFor="longitude">Longitude</label>
              <input
                type="number"
                id="longitude"
                name="longitude"
                value={formData.longitude}
                onChange={handleChange}
                placeholder="-46.63"
              />
            </div>
            
            <div>
              <label htmlFor="elevacaoMetros">Elevação (m)</label>
              <input
                type="number"
                id="elevacaoMetros"
                name="elevacaoMetros"
                value={formData.elevacaoMetros}
                onChange={handleChange}
                placeholder="Ex: 800"
                min="0"
              />
            </div>
        </div>
      </fieldset>

      {/* ----------------- SEÇÃO: DADOS FÍSICOS DO POÇO ----------------- */}
      <fieldset>
        <legend>Características Físicas e Hidráulicas</legend>
        
        <div className="form-row">
            <div>
              <label htmlFor="profundidadeTotalMetros">Profundidade Total (m)</label>
              <input
                type="number"
                id="profundidadeTotalMetros"
                name="profundidadeTotalMetros"
                value={formData.profundidadeTotalMetros}
                onChange={handleChange}
                placeholder="Ex: 150.50"
                step="0.01"
                min="0"
                required
              />
            </div>

            <div>
              <label htmlFor="diametroConstrucaoMm">Diâmetro (mm)</label>
              <input
                type="number"
                id="diametroConstrucaoMm"
                name="diametroConstrucaoMm"
                value={formData.diametroConstrucaoMm}
                onChange={handleChange}
                placeholder="Ex: 152"
                min="0"
              />
            </div>
            
            <div>
              <label htmlFor="vazaoMaximaM3Hora">Vazão Máxima (m³/h)</label>
              <input
                type="number"
                id="vazaoMaximaM3Hora"
                name="vazaoMaximaM3Hora"
                value={formData.vazaoMaximaM3Hora}
                onChange={handleChange}
                placeholder="Ex: 5.2"
                step="0.1"
                min="0"
              />
            </div>
        </div>
        
        <div className="form-row">
            <div>
              <label htmlFor="nivelEstaticoMetros">Nível Estático (m)</label>
              <input
                type="number"
                id="nivelEstaticoMetros"
                name="nivelEstaticoMetros"
                value={formData.nivelEstaticoMetros}
                onChange={handleChange}
                placeholder="Ex: 45.00"
                step="0.01"
                min="0"
              />
            </div>
            
            <div>
              <label htmlFor="nivelDinamicoMetros">Nível Dinâmico (m)</label>
              <input
                type="number"
                id="nivelDinamicoMetros"
                name="nivelDinamicoMetros"
                value={formData.nivelDinamicoMetros}
                onChange={handleChange}
                placeholder="Ex: 55.50"
                step="0.01"
                min="0"
              />
            </div>
        </div>

        <div>
            <label htmlFor="formacaoGeologica">Formação Geológica</label>
            <input
                type="text"
                id="formacaoGeologica"
                name="formacaoGeologica"
                value={formData.formacaoGeologica}
                onChange={handleChange}
                placeholder="Ex: Cristalina com fraturas | Sedimentar arenito"
            />
        </div>
      </fieldset>

      {/* ----------------- SEÇÃO: EQUIPAMENTOS ----------------- */}
      <fieldset>
        <legend>Equipamentos Instalados</legend>
        
        <div className="form-row">
            <div>
              <label htmlFor="tipoBomba">Tipo de Bomba</label>
              <input
                type="text"
                id="tipoBomba"
                name="tipoBomba"
                value={formData.tipoBomba}
                onChange={handleChange}
                placeholder="Ex: Submersa multiestágio"
              />
            </div>
            <div>
              <label htmlFor="modeloBomba">Modelo da Bomba</label>
              <input
                type="text"
                id="modeloBomba"
                name="modeloBomba"
                value={formData.modeloBomba}
                onChange={handleChange}
                placeholder="Ex: Grundfos SP 5A-18"
              />
            </div>
            <div>
              <label htmlFor="profundidadeBombaMetros">Profundidade da Bomba (m)</label>
              <input
                type="number"
                id="profundidadeBombaMetros"
                name="profundidadeBombaMetros"
                value={formData.profundidadeBombaMetros}
                onChange={handleChange}
                placeholder="Ex: 60.00"
                step="0.01"
                min="0"
              />
            </div>
        </div>
      </fieldset>

      {/* ----------------- OBSERVAÇÕES GERAIS ----------------- */}
      <fieldset>
        <legend>Observações Gerais do Relatório</legend>
        <textarea
          name="observacoes"
          value={formData.observacoes}
          onChange={handleChange}
          rows={4}
          placeholder="Detalhes adicionais sobre o serviço, problemas encontrados, recomendações de manutenção, etc."
        />
      </fieldset>

      <button type="submit" className="submit-button">
        Finalizar Relatório e Salvar Dados do Poço
      </button>
    </form>
  );
};

// ----------------- ESTILOS (CSS) -----------------
const style = `
.form-container {
    max-width: 800px;
    margin: 20px auto;
    padding: 20px;
    border: 1px solid #ddd;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.08);
    font-family: Arial, sans-serif;
}
h1 { text-align: center; color: #17a2b8; border-bottom: 3px solid #17a2b8; padding-bottom: 10px; margin-bottom: 5px; }
.subtitle { text-align: center; color: #6c757d; margin-bottom: 25px; }
fieldset { border: 1px solid #17a2b855; padding: 15px; margin-bottom: 25px; border-radius: 6px; }
legend { font-weight: bold; color: #17a2b8; padding: 0 10px; font-size: 1.1em; }

label { display: block; margin-bottom: 5px; font-weight: 500; }
input[type="text"],
input[type="number"],
input[type="date"],
select,
textarea {
    width: 100%;
    padding: 10px;
    border: 1px solid #ccc;
    border-radius: 4px;
    box-sizing: border-box;
    margin-bottom: 10px;
}
textarea { resize: vertical; }

.form-row { display: flex; gap: 10px; margin-bottom: 10px; }
.form-row > div { flex: 1; }

.submit-button {
    display: block;
    width: 100%;
    padding: 15px;
    background-color: #17a2b8; /* Ciano/Azul claro */
    color: white;
    border: none;
    border-radius: 4px;
    font-size: 1.1em;
    cursor: pointer;
    transition: background-color 0.3s ease;
    margin-top: 20px;
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