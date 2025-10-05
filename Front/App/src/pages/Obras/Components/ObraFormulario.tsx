import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { mockObras, mockClientes } from '../../../types/Obras';
import DadosGeraisForm from '../../../components/forms/DadosGeraisForm';
import ClienteForm from '../../../components/forms/ClienteForm';
import DadosPerfuracaoForm from '../../../components/forms/DadosPerfuracaoForm';
import DadosRevestimentoForm from '../../../components/forms/DadosRevestimentoForm';
import ChecklistOcorrenciasForm from '../../../components/forms/ChecklistOcorrenciasForm';

const outorgaOptions: string[] = ['Aprovada', 'Em Análise', 'Pendente de Documentação', 'Não Requerido'];
// NOVAS OPÇÕES DE SOLO SUPERFICIAL



// **ATUALIZADO com TODOS os campos de Perfuração, Produção, Qualidade e Componentes**
const INITIAL_FORM_STATE = {

    // 1. DADOS BÁSICOS E LOCALIZAÇÃO
    titulo: '',
    clienteId: mockClientes[0]?.id || '',
    status: 'Pendente',
    endereco: '',
    latitude: 0,
    longitude: 0,

    // NOVOS CAMPOS DE ENDEREÇO:
    endereco_cep: '',
    endereco_logradouro: '',
    endereco_numero: '', // Adicionando número, que é essencial
    endereco_complemento: '',
    endereco_bairro: '',
    endereco_cidade: '',
    endereco_estado: '',

    // 2. DATAS E GARANTIA
    dataInicio: '',
    dataFimPrevista: '',
    dataLimpeza: '',
    garantiaAte: '', // Calculado


    // 3. ESTRUTURA E SOLO
    // tipoSoloEncontrado: tipoSoloSuperficialOptions[0], // Usando a nova lista


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
    // revestimentoMaterialOptions: revestimentoMaterialOptions[0],
    // revestimentoUniaoOptions: revestimentoUniaoOptions[0],
    revestimentoUniao: '',

    // 5. CHECKLIST (Booleanos)
    checklistCaimento: false,
    checklistEstruturasSubterraneas: false,
    // NOVO CAMPO para o sub-checklist (pode ser string ou null)
    estruturaSubterraneaTipo: '',
    checklistAguaNaoLimpou: false,
    checklistEnergiaRuim: false,
    checklistpedranocaminho: false,

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


    return (
        <div className="obraform-container">
            
            <form onSubmit={handleSubmit} className="form">

                {/* Seções do formulário divididas em componentes */}
                {/* 1. cliente */}
                <div className='flex-row'>
                    <div className='flex-column'>
                        <div>
                            <fieldset className='fieldset-principal'>
                                <legend className='legend'>
                                    identificação da Obra
                                </legend>
                                <label className="label">código do contrato:
                            <input type="text" placeholder='P0001-0825AT' name="titulo"  required className="input" />
                        </label>
                         <label className="label">CPF/CNPJ do Cliente:
                    <input
                        type="text"
                        name="clienteDocumento"
                        required
                        className="input-base input"
                        placeholder="000.000.000-00 ou 00.000.000/0001-00"
                    />
                </label>
                <label className="label">Telefone
                    <input type="text" name="clienteTelefone" required className="input-base input" placeholder="(00) 00000-0000"
                    />
                </label>
                <label className="label">Email:
                    <input type="email" name="clienteEmail" required className="input-base input" placeholder="email@email.com"
                    />
                </label>
                            </fieldset>
                            </div>
                        <ClienteForm  />
                     </div>
                    <div className='flex-column'>
                        {/* 2. Dados Gerais e Localização */}
                <DadosGeraisForm  />

                {/* 3. Dados de Perfuração e Solo */}
                <DadosPerfuracaoForm  />
                {/* Outras seções como DadosRevestimentoForm, ChecklistOcorrenciasForm, etc. */}

                <DadosRevestimentoForm  />


                <ChecklistOcorrenciasForm  />

                 {/* BOTÕES */}
                {/* CLASSE: button-container */}
                <div className="button-container">
                    {/* CLASSE: submit-button */}
                    <button type="submit" className="submit-button">
                        {isEditing ? 'Salvar Edição do Relatório' : 'Cadastrar Relatório Completo'}
                    </button>
                    {/* CLASSE: cancel-button */}
                    <button type="button" onClick={handleCancel} className="cancel-button">Cancelar</button>
                </div>
                </div>
                </div>

                


                




               
            </form>
        </div>
    );
}