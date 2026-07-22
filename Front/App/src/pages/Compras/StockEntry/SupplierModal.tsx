import React from 'react';

interface SupplierModalProps {
    isOpen: boolean;
    loading: boolean;
    name: string;
    fantasyName: string;
    cnpj: string;
    setName: (val: string) => void;
    setFantasyName: (val: string) => void;
    onCancel: () => void;
    onSubmit: () => void;
}

export const SupplierModal: React.FC<SupplierModalProps> = ({
    isOpen, loading, name, fantasyName, cnpj, setName, setFantasyName, onCancel, onSubmit
}) => {
    if (!isOpen) return null;

    return (
        <div className="modal-backdrop">
            <div className="modal-content">
                <h3 className="modal-title">Criar Fornecedor</h3>
                <p className="modal-subtitle">O parceiro deste XML não existe no banco de dados.</p>
                <div className="modal-form-grid">
                    <div className="form-group">
                        <label className="form-label">Razão Social</label>
                        <input className="form-input" value={name} onChange={(e) => setName(e.target.value)} />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Nome Fantasia</label>
                        <input className="form-input" value={fantasyName} onChange={(e) => setFantasyName(e.target.value)} />
                    </div>
                    <div className="form-group">
                        <label className="form-label">CNPaaJ</label>
                        <input className="form-input read-only" value={cnpj} readOnly />
                    </div>
                </div>
                <div className="modal-actions">
                    <button type="button" className="btn-modal-cancel" onClick={onCancel}>Cancelar</button>
                    <button className="btn-modal-save" onClick={onSubmit} disabled={loading}>
                        {loading ? 'Salvando...' : 'Salvar Fornecedor'}
                    </button>
                </div>
            </div>
        </div>
    );
};