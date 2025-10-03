// src/modules/Obras/ObraFormulario.tsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
// IMPORTANTE: Adapte os tipos Obra, StatusObra, mockObras, mockClientes
// para incluir TODOS os campos abaixo.
import { Obra, StatusObra, mockObras, mockClientes } from '../../../types/Obras';

const statusOptions: StatusObra[] = ['Em Andamento', 'Concluída', 'Pendente', 'Cancelada'];
const outorgaOptions: string[] = ['Aprovada', 'Em Análise', 'Pendente de Documentação', 'Não Requerido'];
// NOVAS OPÇÕES DE SOLO SUPERFICIAL
const tipoSoloSuperficialOptions: string[] = [
  'Solo Argiloso (Alta Coesão)',
  'Solo Arenoso (Baixa Coesão/Solto)',
  'Solo Siltoso (Fino/Limoso)',
  'Solo Rochoso Alterado (Saprolito)', // Rocha alterada (saprolito)
  'Solo Misto/Colúvio' // Mistura de materiais
];

// Estado inicial para um novo cadastro
// **ATUALIZADO com TODOS os campos de Perfuração, Produção, Qualidade e Componentes**
const INITIAL_FORM_STATE = {
    
    // 1. DADOS BÁSICOS E LOCALIZAÇÃO
    titulo: '',
    clienteId: mockClientes[0]?.id || '',
    status: 'Pendente',
    endereco: '',
    latitude: 0,
    longitude: 0,
    
    // 2. DATAS E GARANTIA
    dataInicio: '',
    dataFimPrevista: '',
    dataLimpeza: '',
    garantiaAte: '', // Calculado
    

    // 3. ESTRUTURA E SOLO
   tipoSoloEncontrado: tipoSoloSuperficialOptions[0], // Usando a nova lista
    profundidadeTotal: 0,
    diametroInterno: 0,
    diametroPerfuracaoDe: 0, 
    diametroPerfuracaoAte: 0, 
    diametroPerfuracaoDiametro: 0, 

    // 4. REVESTIMENTO
    revestimentoDe: 0,
    revestimentoAte: 0,
    revestimentoDiametroPolegadas: 0,
    revestimentoMaterial: '',
    revestimentoUniao: '',
    
    // 5. CHECKLIST (Booleanos)
    checklistCaimento: false,
    checklistEstruturasSubterraneas: false,
    checklistAguaNaoLimpou: false,
    checklistEnergiaRuim: false,
    
    // 6. PRODUÇÃO E TESTES (Recomendação)
    vazao: 0, // Litros/Hora
    nivelEstatico: 0, // Metros
    nivelDinamico: 0, // Metros
    tempoTeste: 0, // Horas

    // 7. QUALIDADE DA ÁGUA (Recomendação)
    phAgua: 7.0,
    turbidez: 0,
    dataAnaliseLaboratorial: '',
    laboratorioResponsavel: '',

    // 8. DOCUMENTAÇÃO E MÍDIA (URLs/Referências)
    linkFotosConcluido: '',
    linkLaudoAnalise: '',
    linkVideoInspecao: '',

    // 9. COMPONENTES E EQUIPAMENTOS
    modeloPotenciaBomba: '',
    profundidadeInstalacaoBomba: 0,

    // 10. EQUIPE E GERAIS
    equipePerfuracao: '',
    responsavelServicoSupervisor: '',
    observacoesGerais: '',
    
    // 11. LOGÍSTICA / OUTORGA
    statusOutorgaLicenca: outorgaOptions[2], // Ex: Pendente de Documentação
    numeroOutorgaProcesso: '',
};

// Usa um tipo que inclui todos os campos e o 'id' opcional
type ObraFormState = typeof INITIAL_FORM_STATE & { id?: string };

export const ObraFormulario: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const isEditing = !!id;
    
    // Calcula a data de garantia (90 dias após a limpeza)
    const calculateGarantiaDate = (dataLimpeza: string): string => {
        if (!dataLimpeza) return '';
        const date = new Date(dataLimpeza + 'T00:00:00');
        date.setDate(date.getDate() + 90);
        return date.toISOString().split('T')[0];
    };

    const initialObraBase = isEditing 
        ? mockObras.find((o: any) => o.id === id)
        : null;

    const initialObraState: ObraFormState = {
        ...INITIAL_FORM_STATE,
        ...(initialObraBase || {}),
        garantiaAte: isEditing && initialObraBase?.dataLimpeza 
            ? calculateGarantiaDate(initialObraBase.dataLimpeza)
            : INITIAL_FORM_STATE.garantiaAte,
    } as ObraFormState;

    const [formData, setFormData] = useState<ObraFormState>(initialObraState);
    
    // Atualiza a garantia quando a dataLimpeza muda
    useEffect(() => {
        const novaGarantia = calculateGarantiaDate(formData.dataLimpeza);
        if (formData.garantiaAte !== novaGarantia) {
            setFormData(prev => ({ ...prev, garantiaAte: novaGarantia }));
        }
    }, [formData.dataLimpeza]); 

    // Efeito para tratar a navegação em caso de obra não encontrada
    useEffect(() => {
        if (isEditing && !initialObraBase) {
            alert('Obra não encontrada para edição!');
            navigate('/obras');
        }
    }, [isEditing, initialObraBase, navigate]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value, type, checked } = e.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
        
        // Trata campos de checklist (booleanos)
        if (type === 'checkbox' && 'checked' in e.target) {
            setFormData(prev => ({ ...prev, [name]: checked }));
            return;
        }

        // Campos que devem ser tratados como números
        const numericFields = [
            'latitude', 'longitude', 'profundidadeTotal', 'diametroInterno', 
            'diametroPerfuracaoDe', 'diametroPerfuracaoAte', 'diametroPerfuracaoDiametro',
            'revestimentoDe', 'revestimentoAte', 'revestimentoDiametroPolegadas',
            // Novos campos numéricos (Produção, Qualidade, Componentes)
            'vazao', 'nivelEstatico', 'nivelDinamico', 'tempoTeste', 
            'phAgua', 'turbidez', 'profundidadeInstalacaoBomba'
        ];
        
        const isNumericField = numericFields.includes(name) || type === 'number';

        const finalValue = isNumericField 
            ? parseFloat(value) || 0 // Converte para número ou 0 se falhar
            : value;

        setFormData(prev => ({ ...prev, [name]: finalValue }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        // Remove a 'garantiaAte' (calculada)
        const { garantiaAte, ...dataToSave } = formData; 

        if (isEditing) {
            console.log('Obra Editada:', { id, ...dataToSave });
            alert(`Obra ${id} atualizada com sucesso!`);
        } else {
            const newId = `obra-${Date.now()}`;
            console.log('Nova Obra Cadastrada:', { id: newId, ...dataToSave });
            alert('Nova Obra cadastrada com sucesso!');
        }
        
        navigate('/obras'); 
    };
    
    const handleCancel = (e: React.MouseEvent<HTMLButtonElement>) => {
        e.preventDefault();
        navigate('/obras');
    }

    // Estilo básico para o formulário
    const fieldsetContainerStyle = { display: 'flex', gap: '20px', flexWrap: 'wrap' as const };
    const fieldsetStyle = { border: '1px solid #ccc', padding: '15px', flex: '1 1 350px' };

    return (
        <div style={{ padding: '20px' }}>
            <h1>{isEditing ? `Editar Obra: ${formData.titulo}` : 'Nova Obra'}</h1>
            <form onSubmit={handleSubmit} style={{display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '800px', margin: '0 auto'}}>
                
                {/* --- SEÇÃO DADOS GERAIS, LOCALIZAÇÃO E DATAS --- */}
                <fieldset style={{ border: '2px solid #007bff', padding: '20px' }}>
                    <legend style={{ fontWeight: 'bold', color: '#007bff' }}>Dados Gerais e Localização</legend>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                        <label>Título: <input type="text" name="titulo" value={formData.titulo} onChange={handleChange} required /></label>
                        <label>Cliente:
                            <select name="clienteId" value={formData.clienteId} onChange={handleChange} required>
                                {mockClientes.map(cliente => (<option key={cliente.id} value={cliente.id}>{cliente.nome}</option>))}
                            </select>
                        </label>
                        <label>Status:
                            <select name="status" value={formData.status} onChange={handleChange} required>
                                {statusOptions.map(status => (<option key={status} value={status}>{status}</option>))}
                            </select>
                        </label>
                    </div>
                    <label style={{ marginTop: '10px' }}>Endereço:
                        <textarea name="endereco" value={formData.endereco} onChange={handleChange} required />
                    </label>
                    <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                        <label>Latitude: <input type="number" step="any" name="latitude" value={formData.latitude} onChange={handleChange} /></label>
                        <label>Longitude: <input type="number" step="any" name="longitude" value={formData.longitude} onChange={handleChange} /></label>
                    </div>
                    
                    <h4 style={{ marginTop: '15px', marginBottom: '5px' }}>Datas da Obra/Poço</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
                        <label>Início: <input type="date" name="dataInicio" value={formData.dataInicio} onChange={handleChange} required /></label>
                        <label>Fim Prevista: <input type="date" name="dataFimPrevista" value={formData.dataFimPrevista} onChange={handleChange} required /></label>
                        <label>Limpeza: <input type="date" name="dataLimpeza" value={formData.dataLimpeza} onChange={handleChange} required /></label>
                        <label>Garantia (90 dias): <input type="date" name="garantiaAte" value={formData.garantiaAte} onChange={handleChange} readOnly style={{ backgroundColor: '#f0f0f0' }} title="Calculado automaticamente" /></label>
                    </div>
                </fieldset>

                {/* --- SEÇÃO DADOS ESTRUTURAIS (Poço e Revestimento) --- */}
                <div style={fieldsetContainerStyle}>
                    <fieldset style={fieldsetStyle}>
                        <legend>Dados de Perfuração e Solo</legend>
                        <label>Tipo de Solo Superficial: <select name="tipoSoloEncontrado" value={formData.tipoSoloEncontrado} onChange={handleChange} required >
                    {tipoSoloSuperficialOptions.map(tipo => (
                        <option key={tipo} value={tipo}>{tipo}</option>
                    ))}
                </select></label>
                        <label>Profundidade Total (m): <input type="number" step="0.1" name="profundidadeTotal" value={formData.profundidadeTotal} onChange={handleChange} required /></label>
                        <label>Diâmetro Interno (mm): <input type="number" step="0.1" name="diametroInterno" value={formData.diametroInterno} onChange={handleChange} required /></label>
                        
                        <h4>Diâmetro de Perfuração (metros)</h4>
                        <div style={{ display: 'flex', gap: '5px' }}>
                            <label style={{ flex: 1 }}>De: <input type="number" step="0.1" name="diametroPerfuracaoDe" value={formData.diametroPerfuracaoDe} onChange={handleChange} required /></label>
                            <label style={{ flex: 1 }}>Até: <input type="number" step="0.1" name="diametroPerfuracaoAte" value={formData.diametroPerfuracaoAte} onChange={handleChange} required /></label>
                            <label style={{ flex: 1 }}>Diâmetro (mm): <input type="number" step="0.1" name="diametroPerfuracaoDiametro" value={formData.diametroPerfuracaoDiametro} onChange={handleChange} required /></label>
                        </div>
                    </fieldset>
                    
                    <fieldset style={fieldsetStyle}>
                        <legend>Dados de Revestimento</legend>
                        <div style={{ display: 'flex', gap: '5px' }}>
                            <label style={{ flex: 1 }}>De (m): <input type="number" step="0.1" name="revestimentoDe" value={formData.revestimentoDe} onChange={handleChange} /></label>
                            <label style={{ flex: 1 }}>Até (m): <input type="number" step="0.1" name="revestimentoAte" value={formData.revestimentoAte} onChange={handleChange} /></label>
                            <label style={{ flex: 1 }}>Diâmetro (pol): <input type="number" step="0.1" name="revestimentoDiametroPolegadas" value={formData.revestimentoDiametroPolegadas} onChange={handleChange} /></label>
                        </div>
                        <label style={{ marginTop: '10px' }}>Material Utilizado: <input type="text" name="revestimentoMaterial" value={formData.revestimentoMaterial} onChange={handleChange} /></label>
                        <label>União Por: <input type="text" name="revestimentoUniao" value={formData.revestimentoUniao} onChange={handleChange} /></label>

                        <h4 style={{ marginTop: '15px', marginBottom: '5px' }}>Checklist de Ocorrências</h4>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '15px' }}>
                            <label><input type="checkbox" name="checklistCaimento" checked={formData.checklistCaimento} onChange={handleChange} /> Caimento</label>
                            <label><input type="checkbox" name="checklistEstruturasSubterraneas" checked={formData.checklistEstruturasSubterraneas} onChange={handleChange} /> Estrut. Subterrâneas</label>
                            <label><input type="checkbox" name="checklistAguaNaoLimpou" checked={formData.checklistAguaNaoLimpou} onChange={handleChange} /> Água Não Limpou</label>
                            <label><input type="checkbox" name="checklistEnergiaRuim" checked={formData.checklistEnergiaRuim} onChange={handleChange} /> Energia Ruim</label>
                        </div>
                    </fieldset>
                </div>

                {/* --- SEÇÃO PRODUÇÃO, QUALIDADE, DOCUMENTAÇÃO E COMPONENTES --- */}
                <div style={fieldsetContainerStyle}>
                    <fieldset style={fieldsetStyle}>
                        <legend>Dados de Produção e Testes</legend>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                            <label>Vazão (L/h): <input type="number" step="0.1" name="vazao" value={formData.vazao} onChange={handleChange} /></label>
                            <label>Tempo Teste (h): <input type="number" step="1" name="tempoTeste" value={formData.tempoTeste} onChange={handleChange} /></label>
                            <label>Nível Estático (m): <input type="number" step="0.1" name="nivelEstatico" value={formData.nivelEstatico} onChange={handleChange} /></label>
                            <label>Nível Dinâmico (m): <input type="number" step="0.1" name="nivelDinamico" value={formData.nivelDinamico} onChange={handleChange} /></label>
                        </div>
                        
                        <h4 style={{ marginTop: '15px', marginBottom: '5px' }}>Componentes e Equipamentos</h4>
                        <label>Modelo/Potência da Bomba: <input type="text" name="modeloPotenciaBomba" value={formData.modeloPotenciaBomba} onChange={handleChange} /></label>
                        <label>Profundidade Instalação Bomba (m): <input type="number" step="0.1" name="profundidadeInstalacaoBomba" value={formData.profundidadeInstalacaoBomba} onChange={handleChange} /></label>
                    </fieldset>

                    <fieldset style={fieldsetStyle}>
                        <legend>Qualidade da Água e Documentação</legend>
                        <h4 style={{ marginBottom: '5px' }}>Qualidade da Água</h4>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <label style={{ flex: 1 }}>pH da Água: <input type="number" step="0.1" name="phAgua" value={formData.phAgua} onChange={handleChange} /></label>
                            <label style={{ flex: 1 }}>Turbidez (NTU): <input type="number" step="0.1" name="turbidez" value={formData.turbidez} onChange={handleChange} /></label>
                        </div>
                        <label>Data da Análise Laboratorial: <input type="date" name="dataAnaliseLaboratorial" value={formData.dataAnaliseLaboratorial} onChange={handleChange} /></label>
                        <label>Laboratório Responsável: <input type="text" name="laboratorioResponsavel" value={formData.laboratorioResponsavel} onChange={handleChange} /></label>
                        
                        <h4 style={{ marginTop: '15px', marginBottom: '5px' }}>Documentação (Links/Referência)</h4>
                        <label>Link Fotos Poço Concluído: <input type="text" name="linkFotosConcluido" value={formData.linkFotosConcluido} onChange={handleChange} /></label>
                        <label>Link Laudo Análise: <input type="text" name="linkLaudoAnalise" value={formData.linkLaudoAnalise} onChange={handleChange} /></label>
                        <label>Link Vídeo Inspeção Interna: <input type="text" name="linkVideoInspecao" value={formData.linkVideoInspecao} onChange={handleChange} /></label>
                    </fieldset>
                </div>
                
                {/* --- SEÇÃO EQUIPE, OUTORGA E OBSERVAÇÕES --- */}
                <fieldset style={{ border: '1px solid #ccc', padding: '15px' }}>
                    <legend>Equipe, Outorga e Observações</legend>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                        <label>Equipe de Perfuração: <input type="text" name="equipePerfuracao" value={formData.equipePerfuracao} onChange={handleChange} required /></label>
                        <label>Responsável / Supervisor: <input type="text" name="responsavelServicoSupervisor" value={formData.responsavelServicoSupervisor} onChange={handleChange} required /></label>
                        
                        <label>Status da Outorga/Licença:
                            <select name="statusOutorgaLicenca" value={formData.statusOutorgaLicenca} onChange={handleChange}>
                                {outorgaOptions.map(status => (<option key={status} value={status}>{status}</option>))}
                            </select>
                        </label>
                        <label>Número Outorga/Processo: <input type="text" name="numeroOutorgaProcesso" value={formData.numeroOutorgaProcesso} onChange={handleChange} /></label>
                    </div>

                    <label style={{ marginTop: '10px' }}>Observações Gerais:
                        <textarea name="observacoesGerais" value={formData.observacoesGerais} onChange={handleChange} rows={3} />
                    </label>
                </fieldset>

                {/* BOTÕES */}
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button type="submit" style={{ padding: '10px', flex: 1, backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px' }}>
                        {isEditing ? 'Salvar Edição do Relatório' : 'Cadastrar Relatório Completo'}
                    </button>
                    <button type="button" onClick={handleCancel} style={{ padding: '10px', flex: 1, backgroundColor: '#ccc', border: 'none', borderRadius: '4px' }}>Cancelar</button>
                </div>
            </form>
        </div>
    );
};