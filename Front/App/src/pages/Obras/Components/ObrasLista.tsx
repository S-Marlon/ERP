// src/modules/Obras/ObrasLista.tsx
import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {  StatusObra, mockObras, mockClientes } from '../../../types/Obras';

const statusOptions: StatusObra[] = ['Em Andamento', 'Concluída', 'Pendente', 'Cancelada'];

export const ObrasLista: React.FC = () => {
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<StatusObra | 'Todos'>('Todos');
  const [filtroClienteId, setFiltroClienteId] = useState<string | 'Todos'>('Todos');

  // Lógica de Filtragem e Busca
  const obrasFiltradas = useMemo(() => {
    return mockObras.filter(obra => {
      // 1. Filtro por Status
      const statusMatch = filtroStatus === 'Todos' || obra.status === filtroStatus;
      
      // 2. Filtro por Cliente
      const clienteMatch = filtroClienteId === 'Todos' || obra.clienteId === filtroClienteId;

      // 3. Busca por Título (ou ID, Endereço, etc.)
      const buscaMatch = obra.titulo.toLowerCase().includes(busca.toLowerCase());

      return statusMatch && clienteMatch && buscaMatch;
    });
  }, [busca, filtroStatus, filtroClienteId]);

  return (
    <div>
      <h1>Lista de Obras</h1>
      <Link to="/obras/novo"><button>+ Nova Obra</button></Link>
      
      <div style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
        {/* Busca por Título */}
        <input
          type="text"
          placeholder="Buscar por Título..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />

        {/* Filtro por Status */}
        <select
          value={filtroStatus}
          onChange={(e) => setFiltroStatus(e.target.value as StatusObra | 'Todos')}
        >
          <option value="Todos">Filtrar por Status (Todos)</option>
          {statusOptions.map(status => (
            <option key={status} value={status}>{status}</option>
          ))}
        </select>

        {/* Filtro por Cliente */}
        <select
          value={filtroClienteId}
          onChange={(e) => setFiltroClienteId(e.target.value)}
        >
          <option value="Todos">Filtrar por Cliente (Todos)</option>
          {mockClientes.map(cliente => (
            <option key={cliente.id} value={cliente.id}>{cliente.nome}</option>
          ))}
        </select>
      </div>

      <table>
        <thead>
          <tr>
                    <th>Código do Contrato</th>
                    <th>Cliente</th>
                    <th>Tipo de Serviço</th>
                    <th>Data Início</th>
                    <th>Status</th>
                    <th>Data Fim -Prevista- </th>
                    <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          {obrasFiltradas.map((obra) => {
            const cliente = mockClientes.find(c => c.id === obra.clienteId);
            return (
              <tr key={obra.id} style={{fontSize:'16px'}}>
                <td>{obra.titulo}</td>
                <td>{cliente ? cliente.nome : 'N/A'}</td>

                <td>Perfuração</td>

                <td>12/02/20025</td>
                <td  style={{textAlign:'center', background: 'orange', borderRadius:'4px', padding: '2px' }}>{obra.status}</td>
                <td>12/02/20025</td>

                <td>
                  <Link to={`/obras/${obra.id}`}>Ver Detalhes</Link>
                </td>

              </tr>
            );
          })}
        </tbody>
      </table>
      
      {obrasFiltradas.length === 0 && <p>Nenhuma obra encontrada com os filtros aplicados.</p>}
    </div>
  );
};