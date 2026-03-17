import React, { useState, useEffect } from 'react';
import './Clientes.css';
import { Cliente, PrecoEspecial } from './types/types'; // Ajuste o caminho se necessário
import { clienteService } from './services/clienteService';

const Clientes = () => {

 const [clientes, setClientes] = useState<Cliente[]>([]);
  

  useEffect(() => {
    carregarClientes();
  }, []);

  const carregarClientes = async () => {
    const dados = await clienteService.listarTodos();
    setClientes(dados);
  };

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault();
    await clienteService.salvar(clienteSel);
    setClienteSel({ nome_razao: '', cpf_cnpj: '', tipo_cliente: 'CONSUMIDOR' });
    carregarClientes();
  };

  const [clienteSel, setClienteSel] = useState<Partial<Cliente>>({
  nome_razao: '',
  cpf_cnpj: '',
  tipo_cliente: 'CONSUMIDOR',
  
  endereco: '',
  bairro: '',
  cidade: '',
  estado: '',
  cep: '',
  limite_credito: 0,
  dia_vencimento: 10,
  status_credito: 'ANALISE'
});

// Adicione estes dois estados para os campos multivalorados
const [contatos, setContatos] = useState([{ tipo: 'CELULAR', numero: '', nome_referencia: '' }]);
const [emails, setEmails] = useState([{ tipo: 'PESSOAL', email: '' }]);

// Função para adicionar novo campo de telefone na tela
const adicionarCampoContato = () => {
  setContatos([...contatos, { tipo: 'CELULAR', numero: '', nome_referencia: '' }]);
};

// Função para adicionar novo campo de email na tela
const adicionarCampoEmail = () => {
  setEmails([...emails, { tipo: 'PESSOAL', email: '' }]);
};

  return (
    <div className="container-erp">
      <aside className="sidebar-clientes">
        <div className="sidebar-header">
          <h3>Clientes</h3>
          <button className="btn-novo" onClick={() => setClienteSel({ nome_razao: '', cpf_cnpj: '', tipo_cliente: 'CONSUMIDOR' })}>
            + Novo
          </button>

          
        </div>
        <ul className="lista-clientes">
          {clientes.map(c => (
            <li 
              key={c.id_cliente} 
              className={clienteSel?.id_cliente === c.id_cliente ? 'active' : ''}
              onClick={() => setClienteSel(c)}
            >
              <strong>{c.nome_razao}</strong>
              <span>{c.cpf_cnpj}</span>
            </li>
          ))}
        </ul>
      </aside>

      <main className="painel-cliente">
        

        <section className="card-cadastro">
  <div className="header-form">
    <h2>{clienteSel.id_cliente ? `Ficha de: ${clienteSel.nome_razao}` : 'Novo Cadastro de Cliente'}</h2>
    <span className={`status-badge ${clienteSel.status_credito}`}>{clienteSel.status_credito}</span>
  </div>

  <form onSubmit={handleSalvar} className="form-completo">
    {/* SEÇÃO 1: DADOS BÁSICOS */}
    <div className="form-section">
      <h3><i className="fas fa-user"></i> Identificação</h3>
      <div className="form-grid">
        <div className="input-group span-2">
          <label>Nome Completo / Razão Social</label>
          <input type="text" value={clienteSel.nome_razao} onChange={e => setClienteSel({...clienteSel, nome_razao: e.target.value})} required />
        </div>
        <div className="input-group">
          <label>CPF / CNPJ</label>
          <input type="text" value={clienteSel.cpf_cnpj} onChange={e => setClienteSel({...clienteSel, cpf_cnpj: e.target.value})} />
        </div>
        <div className="input-group">
          <label>Tipo</label>
          <select value={clienteSel.tipo_cliente} onChange={e => setClienteSel({...clienteSel, tipo_cliente: e.target.value})}>
            <option value="CONSUMIDOR">Consumidor</option>
            <option value="SERRALHERIA">Serralheria</option>
            <option value="OFICINA">Oficina</option>
          </select>
        </div>
        
      </div>
    </div>

    {/* SEÇÃO 2: ENDEREÇO (Para cobrança) */}
    <div className="form-section">
      <h3><i className="fas fa-map-marker-alt"></i> Endereço de Cobrança</h3>
      <div className="form-grid">
        <div className="input-group">
          <label>CEP</label>
          <input type="text" value={clienteSel.cep} onChange={e => setClienteSel({...clienteSel, cep: e.target.value})} />
        </div>
        <div className="input-group span-2">
          <label>Logradouro (Rua, Av, Número)</label>
          <input type="text" value={clienteSel.endereco} onChange={e => setClienteSel({...clienteSel, endereco: e.target.value})} />
        </div>
        <div className="input-group">
          <label>Bairro</label>
          <input type="text" value={clienteSel.bairro} onChange={e => setClienteSel({...clienteSel, bairro: e.target.value})} />
        </div>
        <div className="input-group">
          <label>Cidade</label>
          <input type="text" value={clienteSel.cidade} onChange={e => setClienteSel({...clienteSel, cidade: e.target.value})} />
        </div>
        <div className="input-group">
          <label>UF</label>
          <input type="text" maxLength={2} value={clienteSel.estado} onChange={e => setClienteSel({...clienteSel, estado: e.target.value.toUpperCase()})} />
        </div>
      </div>
    </div>

    <div className="form-section">
  <h3>Contatos para Cobrança</h3>
  {contatos.map((contato, index) => (
    <div key={index} className="grid-contato">
      <select value={contato.tipo}>
        <option value="WHATSAPP">WhatsApp</option>
        <option value="CELULAR">Celular</option>
      </select>
      <input type="text" value={contato.numero} placeholder="(00) 00000-0000" />
      <input type="text" value={contato.nome_referencia} placeholder="Falar com..." />
    </div>
  ))}
  <button type="button" onClick={adicionarCampoContato}>+ Adicionar Telefone</button>
</div>

    {/* SEÇÃO 3: FINANCEIRO E CRÉDITO */}
    <div className="form-section financeiro">
      <h3><i className="fas fa-wallet"></i> Parâmetros de Crédito (Carnê)</h3>
      <div className="form-grid">
        <div className="input-group">
          <label>Limite de Crédito (R$)</label>
          <input type="number" step="0.01" value={clienteSel.limite_credito} onChange={e => setClienteSel({...clienteSel, limite_credito: Number(e.target.value)})} />
        </div>
        <div className="input-group">
          <label>Dia de Vencimento</label>
          <input type="number" min="1" max="28" value={clienteSel.dia_vencimento} onChange={e => setClienteSel({...clienteSel, dia_vencimento: Number(e.target.value)})} />
        </div>
        <div className="input-group">
          <label>Status do Crédito</label>
          <select value={clienteSel.status_credito} onChange={e => setClienteSel({...clienteSel, status_credito: e.target.value as any})}>
            <option value="ANALISE">Em Análise</option>
            <option value="LIBERADO">Liberado para Compras</option>
            <option value="BLOQUEADO">Bloqueado / Inadimplente</option>
          </select>
        </div>
      </div>
    </div>

    <div className="form-actions">
      <button type="submit" className="btn-save">💾 Salvar Ficha do Cliente</button>
    </div>
  </form>
</section>
      </main>
    </div>
    )
};

export default Clientes;


