// hooks/usePDVState.ts
import { useState } from 'react';
import { CartItem } from '../types/cart.types';

type PDVStep = 'SELECAO' | 'PAGAMENTO';

// Cliente da venda: do cadastro (pessoas) ou consumidor final (id null)
export interface ClientePdv {
  id: number;
  nome: string;
  documento?: string;
  tipo?: string;
}

export const usePDVState = () => {
  const [estagio, setEstagio] = useState<PDVStep>('SELECAO');
  const [cliente, setCliente] = useState('');
  const [clienteId, setClienteId] = useState<number | null>(null);
  const [clienteDocumento, setClienteDocumento] = useState('');
  const [identificadorCliente, setIdentificadorCliente] = useState("");
  const [mostrarModalCliente, setMostrarModalCliente] = useState(false);

  // OS state (a OS ainda não é gravada pelo PDV novo; mantido para o módulo de OS)
  const [osItems, setOsItems] = useState<CartItem[]>([]);
  const [osServices, setOsServices] = useState<any[]>([]);
  const [osData, setOsData] = useState({
    equipment: '',
    application: '',
    gauge: '',
    layers: '',
    finalLength: '',
    laborType: 'fixed' as 'fixed' | 'percent' | 'service' | 'per_point' | 'table',
    laborValue: 0,
    selectedServiceId: ''
  });

  // null = Consumidor final
  const selecionarCliente = (c: ClientePdv | null) => {
    setClienteId(c ? c.id : null);
    setCliente(c ? c.nome : 'Consumidor Final');
    setClienteDocumento(c?.documento || '');
    setIdentificadorCliente('');
    setMostrarModalCliente(false);
  };

  // Compatibilidade: confirma o texto digitado sem vínculo com o cadastro
  const confirmarCliente = () => {
    setCliente(identificadorCliente || "Consumidor Final");
    setClienteId(null);
    setClienteDocumento('');
    setMostrarModalCliente(false);
  };

  return {
    estagio,
    setEstagio,
    cliente,
    setCliente,
    clienteId,
    clienteDocumento,
    selecionarCliente,
    identificadorCliente,
    setIdentificadorCliente,
    mostrarModalCliente,
    setMostrarModalCliente,
    confirmarCliente,
    osItems,
    setOsItems,
    osServices,
    setOsServices,
    osData,
    setOsData
  };
};
