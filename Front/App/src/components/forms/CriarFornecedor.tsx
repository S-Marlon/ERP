import React, { useState, ChangeEvent, FormEvent } from 'react';
import './CriarFornecedor.css';

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

const CriarFornecedor: React.FC = () => {
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

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setFeedback({ message: '', type: '' });

    try {
      const response = await fetch('/api/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.ok) {
        setFeedback({ message: 'Fornecedor cadastrado com sucesso!', type: 'success' });
        setFormData({ cnpj: '', name: '', nomeFantasia: '', siglaGerada: '' });
      } else {
        setFeedback({ 
          message: data.error || 'Erro ao processar requisição', 
          type: 'error' 
        });
      }
    } catch (err) {
      setFeedback({ message: 'Erro ao conectar com o servidor', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <form className="supplier-form" onSubmit={handleSubmit}>
        <h2 className="title">Cadastrar Fornecedor</h2>
        
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