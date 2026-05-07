import React, { useState, ChangeEvent, FormEvent, useEffect } from 'react';
import './CriarFornecedor.css';
import FormControl from '../../components/ui/FormControl/FormControl';
import { createSupplier } from '../../pages/Estoque/api/productsApi';

interface CriarFornecedorProps {
  onClose: () => void;
  onCreated?: (supplier: any) => void;
}

interface SupplierData {
  cnpj: string;
  name: string;
  nomeFantasia: string;
  siglaGerada: string;
}

interface Feedback {
  message: string;
  type: 'success' | 'error' | '';
}

const CriarFornecedor: React.FC<CriarFornecedorProps> = ({ onClose, onCreated }) => {
  const [formData, setFormData] = useState<SupplierData>({
    cnpj: '',
    name: '',
    nomeFantasia: '',
    siglaGerada: ''
  });

  const [loading, setLoading] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<Feedback>({ message: '', type: '' });

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Gera um hash SHA-256 do CNPJ e retorna hex string
  async function gerarHashCNPJ(cnpj: string): Promise<string> {
    const cnpjLimpo = cnpj.replace(/\D/g, '');
    const msgUint8 = new TextEncoder().encode(cnpjLimpo);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // Atualiza a siglaGerada automaticamente quando o CNPJ estiver completo
  useEffect(() => {
    const cnpj = formData.cnpj || '';
    if (cnpj.replace(/\D/g, '').length >= 14) {
      let mounted = true;
      gerarHashCNPJ(cnpj).then(hash => {
        if (!mounted) return;
        const sigla = hash.substring(0, 4).toUpperCase();
        setFormData(prev => ({ ...prev, siglaGerada: sigla }));
      }).catch(err => {
        console.error('Erro ao gerar sigla:', err);
      });
      return () => { mounted = false };
    } else {
      // Limpa a sigla enquanto CNPJ incompleto
      setFormData(prev => ({ ...prev, siglaGerada: '' }));
    }
  }, [formData.cnpj]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setFeedback({ message: '', type: '' });

    try {
      const data = await createSupplier({
        cnpj: formData.cnpj,
        name: formData.name,
        nomeFantasia: formData.nomeFantasia,
        siglaGerada: formData.siglaGerada
      });

      setFeedback({ message: 'Fornecedor cadastrado com sucesso!', type: 'success' });
      setFormData({ cnpj: '', name: '', nomeFantasia: '', siglaGerada: '' });
      if (typeof onCreated === 'function') onCreated(data);
      onClose();
    } catch (err: any) {
      const message = err?.message || String(err) || 'Erro ao conectar com o servidor';
      setFeedback({ message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <form className="supplier-form" onSubmit={handleSubmit}>
        <div>

        <h2 className="title">Cadastrar Fornecedor</h2>
        <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', backgroundColor: '#ff0000', padding: '0.5rem', borderRadius: '50%' }}>X</button>
        </div>
        
        <div className="form-group">
          <label htmlFor="cnpj">CNPJ *</label>
          <input
            type="text"
            id="cnpj"
            name="cnpj"
            value={formData.cnpj}
            onChange={handleChange}
            required
            placeholder="00.000.000/0000-00"
          />
        </div>

        <div className="form-group">
          <label htmlFor="name">Razão Social *</label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
            placeholder="Nome oficial da empresa"
          />
        </div>

        <div className="form-group">
          <label htmlFor="nomeFantasia">Nome Fantasia</label>
          <input
            type="text"
            id="nomeFantasia"
            name="nomeFantasia"
            value={formData.nomeFantasia}
            onChange={handleChange}
            placeholder="Como a empresa é conhecida"
          />
        </div>

        <div className="form-group">
          <label htmlFor="siglaGerada">Sigla</label>
          <input
            type="text"
            readOnly
            id="siglaGerada"
            name="siglaGerada"
            value={formData.siglaGerada}
            onChange={handleChange}
            placeholder="Ex: ABC"
          />
        </div>

        {feedback.message && (
          <div className={`alert ${feedback.type}`}>
            {feedback.message}
          </div>
        )}

        <button type="submit" className="submit-btn" disabled={loading}>
          {loading ? 'Enviando...' : 'Salvar Fornecedor'}
        </button>
      </form>
       
    </div>
  );
};

export default CriarFornecedor;