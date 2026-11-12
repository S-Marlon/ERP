// Módulo Obras de poços: grupo próprio na barra lateral ("Poços artesianos"), uma seção por endereço
// (/modulos/hidraulica/pocos/<secao>, ver secoesPocos.ts). A Central é a entrada. Os atalhos internos ("abrir obra",
// "ver no mapa", os cartões da Central) mudam a seção pelo navPocos e o endereço acompanha; as partes de cobrança,
// materiais, processo e orçamento/contrato vivem dentro da obra.
import React, { useEffect, useRef } from 'react';
import { Breadcrumb, Button, Flex, Segmented, Tooltip, Typography } from 'antd';
import { AimOutlined, ArrowUpOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import CentralPocos from './CentralPocos';
import ObrasAba from './ObrasAba';
import MapaPocos from './MapaPocos';
import AgendaPocos from './AgendaPocos';
import PainelPocos from './PainelPocos';
import { ManutencoesPocos } from './ManutencaoPocos';
import MonitoramentoPocos from './MonitoramentoPocos';
import AtendimentoPocos from './AtendimentoPocos';
import { navPocos, useNavPocos, useNiveisPocos } from './navPocos';
import { enderecoDaSecao, GRUPOS_POCOS, secaoDaAba, secaoDoEndereco, secoesDoGrupo, trilhaDaSecao } from './secoesPocos';
import { MaisFerramentas } from './InicioPocos';
import CentralDocumentos from './CentralDocumentos';
import PlanoMensalPocos from './PlanoMensalPocos';
import { secaoLigada, useRecursosPocos } from './recursosPocos';
import BuscaPocos from './BuscaPocos';
import { FichasPocos } from './FichaPoco';

const { Title, Text } = Typography;
const TELAS: Record<string, React.ReactNode> = {
  central: <CentralPocos />, atendimento: <AtendimentoPocos />, obras: <ObrasAba />, agenda: <AgendaPocos />, manutencao: <ManutencoesPocos />,
  iot: <MonitoramentoPocos />, mapa: <MapaPocos />, resultado: <PainelPocos />, ferramentas: <MaisFerramentas />, documentos: <CentralDocumentos />,
  plano: <PlanoMensalPocos />,
};

const ObrasPocosPagina: React.FC = () => {
  const { secao } = useParams<{ secao?: string }>();
  const navigate = useNavigate();
  const nav = useNavPocos();
  const atual = secaoDoEndereco(secao);
  const ultimoPedido = useRef(nav.pedido);

  // endereço → seção interna (clique na barra lateral, voltar do navegador, link salvo)
  useEffect(() => {
    // endereço antigo (kit-visita, relatorio): abre a aba certa de Documentos e troca o endereço pelo novo
    if (atual.subvista) { navPocos.ir({ aba: atual.aba, subvista: atual.subvista }); navigate(enderecoDaSecao(atual), { replace: true }); return; }
    if (nav.aba === atual.aba && (!atual.vista || nav.vista === atual.vista)) return;
    if (atual.vista) navPocos.ir({ aba: atual.aba, vista: atual.vista }); else navPocos.trocarAba(atual.aba);
  }, [secao]);   // eslint-disable-line react-hooks/exhaustive-deps

  // pedido interno ("abrir obra", "ver no mapa", atalhos da Central) → endereço
  useEffect(() => {
    if (nav.pedido === ultimoPedido.current) return;
    ultimoPedido.current = nav.pedido;
    const destino = secaoDaAba(nav.aba, nav.vista);
    if (destino.secao !== atual.secao) navigate(enderecoDaSecao(destino));
  }, [nav.pedido]);   // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => navPocos.trocarAba('central'), []);   // ao sair do módulo, volta a abrir pela Central
  // as outras telas do mesmo grupo da barra lateral viram abas no topo (ex.: Obras · A receber · Materiais)
  const recursos = useRecursosPocos();
  const doGrupo = secoesDoGrupo(atual.grupo).filter(s => s.secao === atual.secao || secaoLigada(s.secao, recursos));
  const tituloGrupo = GRUPOS_POCOS.find(g => g.grupo === atual.grupo)?.titulo || atual.titulo;

  // trilha do topo: Central › seção › sub-telas abertas (obra, configuração...). Cada degrau leva de volta àquele nível.
  const niveis = useNiveisPocos();
  const degraus = [
    ...trilhaDaSecao(atual).map(d => ({
      titulo: d.titulo,
      // a própria seção: fecha as sub-telas abertas (fechar a primeira fecha as de dentro)
      ir: () => (d.secao === atual.secao ? niveis[0]?.fechar() : navigate(enderecoDaSecao(d))),
    })),
    ...niveis.map((n, i) => ({ titulo: n.titulo, ir: () => niveis[i + 1]?.fechar() })),
  ];
  const acima = degraus.length > 1 ? degraus[degraus.length - 2] : null;
  const subirRef = useRef<(() => void) | null>(null);
  subirRef.current = acima ? acima.ir : null;
  // Alt+↑ sobe um nível (como a seta da trilha)
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => { if (e.altKey && e.key === 'ArrowUp' && subirRef.current) { e.preventDefault(); subirRef.current(); } };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, []);

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 12 }}>
        <Flex align="center" gap={8} style={{ marginBottom: 4, minHeight: 24 }}>
          {acima && (
            <Tooltip title={`Subir para ${acima.titulo} (Alt+↑)`}>
              <Button size="small" icon={<ArrowUpOutlined />} onClick={acima.ir}>{acima.titulo}</Button>
            </Tooltip>
          )}
          <Breadcrumb items={degraus.map((d, i) => ({
            title: i < degraus.length - 1 ? <a onClick={d.ir}>{d.titulo}</a> : <Text strong>{d.titulo}</Text>,
          }))} />
        </Flex>
        <Flex justify="space-between" align="center" wrap gap={8}>
          <Title level={3} style={{ margin: 0 }}><AimOutlined /> Poços artesianos · {tituloGrupo}</Title>
          <BuscaPocos />
        </Flex>
        {atual.aba === 'central' && <Text type="secondary">Do primeiro contato à manutenção: contratos, obras, poços, agenda, monitoramento e pós-venda.</Text>}
        {doGrupo.length > 1 && (
          <Segmented style={{ marginTop: 10 }} value={atual.secao} onChange={v => navigate(enderecoDaSecao({ secao: String(v) }))}
            options={doGrupo.map(s => ({ value: s.secao, label: s.titulo }))} />
        )}
      </div>
      <React.Fragment key={atual.aba}>{TELAS[atual.aba]}</React.Fragment>
      <FichasPocos />
    </div>
  );
};

export default ObrasPocosPagina;
