import React, { useState } from "react";
import { searchProducts } from "../../../api/productsApi";
import CriarFornecedor from "../../../../../components/forms/CriarFornecedor";

interface NovoProdutoFormProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (product: any) => void;
}

const NovoProdutoForm: React.FC<NovoProdutoFormProps> = ({ isOpen, onClose, onSave }) => {
    // 1. TODOS os Hooks devem vir primeiro, sem nenhuma condição acima deles
    const [formData, setFormData] = useState({
        codigo_interno: "",
        codigo_barras: "",
        descricao: "",
        unidade: "UN",
        preco_venda: 0,
        estoque_minimo: 0,
        status: "Ativo" as "Ativo" | "Inativo",
    });

    const [skuExists, setSkuExists] = useState(false); // Esse é o hook que causou a diferença

    // NOVO: Estado para controlar a visibilidade do formulário de fornecedor
    const [showFornecedor, setShowFornecedor] = useState(false);
    // 2. Funções de manipulação

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;

        setFormData((prev) => {
            let newData = { ...prev, [name]: value };

            // Lógica: Se alterar o código de barras, o código interno assume o mesmo valor
            if (name === "codigo_barras" && value.trim() !== "") {
                newData.codigo_interno = value;
            }

            // Conversão numérica para campos específicos
            if (name === "estoque_minimo" || name === "preco_venda") {
                newData[name] = Number(value);
            }

            return newData;
        });
    };


    const handleBlurSku = async () => {
        if (formData.codigo_interno.length > 2) {
            try {
                const results = await searchProducts(formData.codigo_interno);
                // Verifica se algum resultado tem o SKU exato
                const exists = results.some((p: any) => p.sku === formData.codigo_interno);
                setSkuExists(exists);
                if (exists) alert("⚠️ Este SKU/EAN já está cadastrado!");
            } catch (e) {
                console.error("Erro ao validar SKU");
            }
        }
    };


    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData);
        onClose();
    };


    // 3. SÓ AGORA você faz a verificação de retorno condicional
    if (!isOpen) return null;








    return (
        <div style={modalStyles.overlay}>
            {/* Wrapper relativo para permitir o posicionamento do formulário lateral */}
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>

                {/* COMPONENTE CRIAR FORNECEDOR COM ANIMAÇÃO */}
                <div style={{
                    ...modalStyles.drawer,
                    transform: showFornecedor ? 'translateX(-100%)' : 'translateX(0)',
                    opacity: showFornecedor ? 1 : 0,
                    zIndex: showFornecedor ? 1 : -1, // Fica "atrás" e depois aparece
                }}>
                    <CriarFornecedor onClose={() => setShowFornecedor(false)} />
                </div>

                {/* MODAL PRINCIPAL */}
                <div style={{ ...modalStyles.modal, zIndex: 2 }}>
                    <div style={modalStyles.header}>
                        <h2 style={{ margin: 0 }}>📦 Novo Produto</h2>
                        <button onClick={onClose} style={modalStyles.closeButton}>&times;</button>
                    </div>

                    <form onSubmit={handleSubmit} style={modalStyles.form}>
                        <div style={modalStyles.row}>
                            <div style={modalStyles.field}>
                                <label style={modalStyles.label}>Código de Barras (EAN)</label>
                                <input
                                    name="codigo_barras"
                                    style={modalStyles.input}
                                    onChange={handleChange}
                                    placeholder="Bipe o produto aqui..."
                                    autoFocus
                                />
                            </div>
                            <div style={modalStyles.field}>
                                <label style={modalStyles.label}>Código Interno (SKU)</label>
                                <input
                                    name="codigo_interno"
                                    onBlur={handleBlurSku}
                                    required
                                    style={{ ...modalStyles.input, backgroundColor: formData.codigo_barras ? '#f0f0f0' : 'white' }}
                                    value={formData.codigo_interno}
                                    onChange={handleChange}
                                    placeholder="Gerado pelo EAN ou manual"
                                />
                            </div>
                        </div>

                        <div style={modalStyles.field}>
                            <label style={modalStyles.label}>Descrição do Produto</label>
                            <input name="descricao" required style={modalStyles.input} onChange={handleChange} placeholder="Ex: Mangueira SAE R2AT 3/8" />
                        </div>

                        <div style={modalStyles.row}>
                            <div style={modalStyles.field}>
                                <label style={modalStyles.label}>Unidade</label>
                                <select name="unidade" style={modalStyles.input} onChange={handleChange}>
                                    <option value="UN">Unidade (UN)</option>
                                    <option value="MT">Metro (MT)</option>
                                    <option value="KG">Quilo (KG)</option>
                                    <option value="CX">Caixa (CX)</option>
                                    <option value="PAR">Par (PAR)</option>
                                </select>
                            </div>
                            <div style={modalStyles.field}>
                                <label style={modalStyles.label}>Status</label>
                                <select name="status" style={modalStyles.input} onChange={handleChange}>
                                    <option value="Ativo">Ativo</option>
                                    <option value="Inativo">Inativo</option>
                                </select>
                            </div>
                        </div>

                        <div style={modalStyles.row}>
                            <div style={modalStyles.field}>
                                <label style={modalStyles.label}>Preço de Venda (R$)</label>
                                <input type="number" step="0.01" name="preco_venda" style={modalStyles.input} onChange={handleChange} />
                            </div>
                            <div style={modalStyles.field}>
                                <label style={modalStyles.label}>Estoque Mínimo</label>
                                <input type="number" name="estoque_minimo" style={modalStyles.input} onChange={handleChange} />
                            </div>
                        </div>

                        <div style={modalStyles.row}>
                            <div style={modalStyles.field}>
                                <label style={modalStyles.label}>Fornecedor Principal</label>
                                <select name="id_fornecedor" style={modalStyles.input} onChange={handleChange}>
                                    <option value="">Selecione um fornecedor...</option>
                                    {/* {fornecedores.map(f => (
                <option key={f.id} value={f.id}>{f.nome_fantasia || f.razao_social}</option>
            ))} */}
                                </select>
                            </div>
                            <div style={modalStyles.field}>
                                <label style={modalStyles.label}>SKU no Fornecedor</label>
                                <input
                                    name="sku_fornecedor"
                                    style={modalStyles.input}
                                    onChange={handleChange}
                                    placeholder="Código na nota fiscal"
                                    value={formData.codigo_interno}
                                />
                            </div>
                        </div>

                        <div style={modalStyles.footer}>
                            <button
                                type="button"
                                onClick={() => setShowFornecedor(true)} // ATIVA O DRAWER
                                style={modalStyles.secondaryBtn} // USE O ESTILO QUE VOCÊ ADICIONOU
                            >
                                + novo Fornecedor
                            </button>
                            <button type="button" onClick={onClose} style={modalStyles.cancelBtn}>Cancelar</button>
                            <button type="submit" style={modalStyles.saveBtn}>Salvar Produto</button>
                        </div>
                    </form>
                </div>
            </div>

        </div>
    );
};

const modalStyles: { [key: string]: React.CSSProperties } = {
    overlay: {
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
    },
    modal: {
        backgroundColor: 'white',
        borderRadius: '8px',
        width: '500px',
        maxWidth: '90%',
        boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)',
        position: 'relative', // Importante
    },
    drawer: {
        position: 'absolute',
        top: '20px', // Um pouco abaixo do topo para dar estilo
        right: '0',  // Começa "atrás" do modal principal
        width: '400px',
        backgroundColor: '#f9fafb',
        borderRadius: '8px 0 0 8px', // Arredonda só a esquerda
        boxShadow: '-10px 0 15px -3px rgba(0,0,0,0.1)',
        transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)', // Efeito suave
        padding: '20px',
        border: '1px solid #e5e7eb',
        height: 'fit-content',
    },
    secondaryBtn: {
        padding: '10px 16px',
        borderRadius: '6px',
        border: '1px solid #d1d5db',
        backgroundColor: 'white',
        cursor: 'pointer',
        marginRight: 'auto', // Joga o botão para a esquerda do footer
        fontSize: '0.875rem'
    },
    header: {
        padding: '16px 24px',
        borderBottom: '1px solid #e5e7eb',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    closeButton: {
        background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#80746b'
    },
    form: { padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' },
    row: { display: 'flex', gap: '12px' },
    field: { display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 },
    label: { fontSize: '0.875rem', fontWeight: 500, color: '#374151' },
    input: {
        padding: '8px 12px',
        borderRadius: '6px',
        border: '1px solid #d1d5db',
        fontSize: '1rem',
    },
    footer: {
        marginTop: '12px',
        display: 'flex',
        justifyContent: 'flex-end',
        gap: '12px',
    },
    cancelBtn: {
        padding: '10px 16px', borderRadius: '6px', border: '1px solid #873030',
        backgroundColor: 'darkred', cursor: 'pointer', fontWeight: 500
    },
    saveBtn: {
        padding: '10px 16px', borderRadius: '6px', border: 'none',
        backgroundColor: '#2563eb', color: 'white', cursor: 'pointer', fontWeight: 500
    }
};

export default NovoProdutoForm;