import React, { useState } from "react";

interface NovoProdutoFormProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (product: any) => void;
}

const NovoProdutoForm: React.FC<NovoProdutoFormProps> = ({ isOpen, onClose, onSave }) => {
    const [formData, setFormData] = useState({
        sku: "",
        name: "",
        category: "Geral",
        currentStock: 0,
        minStock: 5,
        salePrice: 0,
        status: "Ativo" as "Ativo" | "Inativo",
    });

    if (!isOpen) return null;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData((prev) => ({
            ...prev,
            [name]: name === "currentStock" || name === "minStock" || name === "salePrice" 
                ? Number(value) 
                : value,
        }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData);
        onClose();
    };

    return (
        <div style={modalStyles.overlay}>
            <div style={modalStyles.modal}>
                <div style={modalStyles.header}>
                    <h2 style={{ margin: 0 }}>📦 Novo Produto</h2>
                    <button onClick={onClose} style={modalStyles.closeButton}>&times;</button>
                </div>

                <form onSubmit={handleSubmit} style={modalStyles.form}>
                    <div style={modalStyles.row}>
                        <div style={modalStyles.field}>
                            <label style={modalStyles.label}>Código Interno (SKU)</label>
                            <input name="sku" required style={modalStyles.input} onChange={handleChange} />
                        </div>
                        <div style={modalStyles.field}>
                            <label style={modalStyles.label}>Status</label>
                            <select name="status" style={modalStyles.input} onChange={handleChange}>
                                <option value="Ativo">Ativo</option>
                                <option value="Inativo">Inativo</option>
                            </select>
                        </div>
                    </div>

                    <div style={modalStyles.field}>
                        <label style={modalStyles.label}>Nome do Produto</label>
                        <input name="name" required style={modalStyles.input} onChange={handleChange} />
                    </div>

                    <div style={modalStyles.row}>
                        <div style={modalStyles.field}>
                            <label style={modalStyles.label}>Estoque Atual</label>
                            <input type="number" name="currentStock" style={modalStyles.input} onChange={handleChange} />
                        </div>
                        <div style={modalStyles.field}>
                            <label style={modalStyles.label}>Estoque Mínimo</label>
                            <input type="number" name="minStock" style={modalStyles.input} onChange={handleChange} />
                        </div>
                    </div>

                    <div style={modalStyles.row}>
                        <div style={modalStyles.field}>
                            <label style={modalStyles.label}>Preço de Venda (R$)</label>
                            <input type="number" step="0.01" name="salePrice" style={modalStyles.input} onChange={handleChange} />
                        </div>
                        <div style={modalStyles.field}>
                            <label style={modalStyles.label}>Categoria</label>
                            <input name="category" style={modalStyles.input} onChange={handleChange} placeholder="Ex: Acessórios" />
                        </div>
                    </div>

                    <div style={modalStyles.footer}>
                        <button type="button" onClick={onClose} style={modalStyles.cancelBtn}>Cancelar</button>
                        <button type="submit" style={modalStyles.saveBtn}>Salvar Produto</button>
                    </div>
                </form>
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
        overflow: 'hidden',
    },
    header: {
        padding: '16px 24px',
        borderBottom: '1px solid #e5e7eb',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    closeButton: {
        background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#6b7280'
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
        padding: '10px 16px', borderRadius: '6px', border: '1px solid #d1d5db',
        backgroundColor: 'white', cursor: 'pointer', fontWeight: 500
    },
    saveBtn: {
        padding: '10px 16px', borderRadius: '6px', border: 'none',
        backgroundColor: '#2563eb', color: 'white', cursor: 'pointer', fontWeight: 500
    }
};

export default NovoProdutoForm;