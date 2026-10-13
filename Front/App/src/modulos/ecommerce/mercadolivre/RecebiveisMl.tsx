// Cliente dos títulos a receber das vendas do ML (ex.: "Mercado Livre" ou "Mercado Pago" no cadastro).
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Button, Select, Space, Spin, Typography, message } from 'antd';
import { ConfigMl, pedidosApi } from './mercadoLivreApi';

const { Text } = Typography;

const RecebiveisMl: React.FC<{ onAlterado: () => void }> = ({ onAlterado }) => {
  const [config, setConfig] = useState<ConfigMl | null>(null);
  const [opcoes, setOpcoes] = useState<{ value: number; label: string }[]>([]);
  const [escolhido, setEscolhido] = useState<number | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const temporizador = useRef<number>();

  useEffect(() => {
    pedidosApi.config().then(c => {
      setConfig(c);
      setEscolhido(c.idClienteRecebiveis);
      if (c.idClienteRecebiveis) setOpcoes([{ value: c.idClienteRecebiveis, label: c.clienteNome || `#${c.idClienteRecebiveis}` }]);
    }).catch(() => null);
  }, []);

  const buscar = (texto: string) => {
    window.clearTimeout(temporizador.current);
    if (texto.trim().length < 2) return;
    temporizador.current = window.setTimeout(async () => {
      setBuscando(true);
      try {
        const r = await pedidosApi.clientes(texto);
        setOpcoes(r.map(c => ({ value: c.id, label: `${c.nome}${c.fantasia && c.fantasia !== c.nome ? ` (${c.fantasia})` : ''}${c.documento ? ` · ${c.documento}` : ''}` })));
      } catch (e) {
        message.error(e instanceof Error ? e.message : 'Erro.');
      } finally {
        setBuscando(false);
      }
    }, 300);
  };

  const salvar = async () => {
    setSalvando(true);
    try {
      const r = await pedidosApi.salvarConfig(escolhido);
      setConfig(r);
      message.success(escolhido
        ? `Títulos a receber no cliente "${r.clienteNome}".${r.titulosCriados ? ` ${r.titulosCriados} venda(s) já feitas ganharam o título.` : ''}`
        : 'Títulos a receber desligados.');
      onAlterado();
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Erro.');
    } finally {
      setSalvando(false);
    }
  };

  if (!config) return null;
  const mudou = escolhido !== config.idClienteRecebiveis;

  return (
    <Alert
      type={config.idClienteRecebiveis ? 'success' : 'info'} showIcon style={{ marginBottom: 16 }}
      message={config.idClienteRecebiveis
        ? <>O líquido de cada venda do ML entra em <b>Contas a Receber</b> no cliente <b>{config.clienteNome}</b>, vencendo na data em que o ML libera o dinheiro.</>
        : <>Escolha o cliente do cadastro que representa o Mercado Livre (ex.: "Mercado Pago"): o líquido de cada venda entra em <b>Contas a Receber</b> na data de liberação.</>}
      description={
        <Space wrap style={{ marginTop: 4 }}>
          <Select
            showSearch allowClear style={{ width: 380 }} placeholder="Buscar cliente (nome ou CNPJ)" value={escolhido ?? undefined}
            filterOption={false} onSearch={buscar} options={opcoes} notFoundContent={buscando ? <Spin size="small" /> : <Text type="secondary">Digite para buscar. Não existe? Cadastre em Clientes.</Text>}
            onChange={(v: number | undefined) => setEscolhido(v ?? null)} popupMatchSelectWidth={false}
          />
          <Button type="primary" disabled={!mudou} loading={salvando} onClick={salvar}>Salvar</Button>
          {config.pedidosDesde && <Text type="secondary" style={{ fontSize: 12 }}>Pedidos entram a partir de {new Date(config.pedidosDesde.replace(' ', 'T')).toLocaleString('pt-BR')}.</Text>}
        </Space>
      }
    />
  );
};

export default RecebiveisMl;
