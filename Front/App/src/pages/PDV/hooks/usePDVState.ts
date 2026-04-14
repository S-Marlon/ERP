// hooks/usePDVState.ts
import { useState, useMemo } from 'react';
import { CartItem } from '../types/cart.types';
import { calculateCartTotals, calculateLabor } from '../utils/calculations';

type PDVStep = 'SELECAO' | 'PAGAMENTO';

export const usePDVState = () => {
  const [estagio, setEstagio] = useState<PDVStep>('SELECAO');
  const [cliente, setCliente] = useState('');
  const [identificadorCliente, setIdentificadorCliente] = useState("");
  const [mostrarModalCliente, setMostrarModalCliente] = useState(false);

  // OS state
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

  const confirmarCliente = () => {
    setCliente(identificadorCliente || "Consumidor Final");
    setMostrarModalCliente(false);
  };

  return {
    estagio,
    setEstagio,
    cliente,
    setCliente,
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