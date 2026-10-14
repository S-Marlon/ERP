// Editor do anúncio do ML (modal): as mudanças de texto, preço, estoque, atributos e faixas ficam num rascunho, aparecem
// no painel "Alterações não salvas" (antes → depois, com desfazer) e só vão para o banco/ML ao salvar.
// Fotos, itens, categoria e as ações no ML (conferir, publicar, pausar, encerrar) valem na hora.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Badge, Button, Card, Col, Flex, Modal, Row, Space, Spin, Tabs, Tag, Tooltip, Typography, message } from 'antd';
import { CheckCircleOutlined, CloudUploadOutlined, LinkOutlined, SaveOutlined, ShopOutlined, UndoOutlined } from '@ant-design/icons';
import { adicionarAnexo, enviarArquivoAnexo } from '../../../areas/catalogo/skus/CatalogSku.service';
import { AnuncioDetalhe, anunciosApi, ConferenciaItem, ItemDoAnuncio, resumoSincronizacao } from './mercadoLivreApi';
import { agruparPendencias, PendenciaAgrupada } from './pendencias';
import {
  comRascunho, corposParaSalvar, desfazer, limparIguais, listarAlteracoes, mudarAnuncio, mudarAtributo, mudarItem,
  Rascunho, RASCUNHO_VAZIO, RascunhoAnuncio, RascunhoItem,
} from './rascunhoAnuncio';
import AbaDados from './editor/AbaDados';
import AbaItens from './editor/AbaItens';
import AbaAtributos from './editor/AbaAtributos';
import TabelaPrecos from './editor/TabelaPrecos';
import PainelAlteracoes from './editor/PainelAlteracoes';
import PainelLateral, { AcaoMl } from './editor/PainelLateral';
import FaixasQuantidadeCard from './FaixasQuantidadeCard';
import CatalogoMlCard from './CatalogoMlCard';
import PrecoMlCard from './PrecoMlCard';
import CategoriaMlModal from './CategoriaMlModal';
import AdicionarAnuncioModal from './AdicionarAnuncioModal';
import SituacaoTag from './SituacaoTag';

const { Text } = Typography;

interface Props {
  id: number | null;
  onFechar: () => void;
  onAlterado: () => void;
}

type Aba = 'anuncio' | 'itens' | 'atributos' | 'preco' | 'catalogo';
const ABA_DA_AREA: Record<string, Aba> = { dados: 'anuncio', itens: 'itens', cadastro: 'itens', atributos: 'atributos' };
const CAMPOS_DA_ABA: Record<Aba, (keyof RascunhoAnuncio)[]> = {
  anuncio: ['titulo', 'modeloTitulo', 'tipoAnuncio', 'condicao', 'descricao', 'ajustePreco'],
  itens: ['estoqueReserva', 'estoqueMaximo', 'estoqueAutomatico'],
  atributos: ['atributos'],
  preco: ['faixasQuantidade', 'tipoAnuncio', 'freteGratis'],
  catalogo: [],
};

const erroMsg = (e: unknown) => (e instanceof Error ? e.message : 'Erro.');

// O ML recusa foto com menos de 500 px no maior lado: avisa já no envio (a foto fica no catálogo do mesmo jeito)
const avisarFotoPequena = (arquivo: File) => new Promise<void>(resolve => {
  const url = URL.createObjectURL(arquivo);
  const img = new Image();
  img.onload = () => {
    if (Math.max(img.naturalWidth, img.naturalHeight) < 500) {
      message.warning(`Foto com ${img.naturalWidth}×${img.naturalHeight} px: o Mercado Livre pede ao menos 500 px num dos lados (o ideal é 1200).`, 6);
    }
    URL.revokeObjectURL(url);
    resolve();
  };
  img.onerror = () => { URL.revokeObjectURL(url); resolve(); };
  img.src = url;
});

const AnuncioEditor: React.FC<Props> = ({ id, onFechar, onAlterado }) => {
  const [modal, contextoModal] = Modal.useModal();
  const [salvo, setSalvo] = useState<AnuncioDetalhe | null>(null);
  const [rascunho, setRascunho] = useState<Rascunho>(RASCUNHO_VAZIO);
  const [aba, setAba] = useState<Aba>('anuncio');
  const [carregando, setCarregando] = useState(false);
  const [ocupado, setOcupado] = useState(false);                       // ação imediata (foto, itens, categoria)
  const [salvando, setSalvando] = useState(false);
  const [acaoMl, setAcaoMl] = useState<AcaoMl | null>(null);
  const [categoriaAberta, setCategoriaAberta] = useState(false);
  const [adicionarItens, setAdicionarItens] = useState(false);
  const [filtroItens, setFiltroItens] = useState<{ texto: string; ids: number[] } | null>(null);
  const [enviandoFoto, setEnviandoFoto] = useState<number | 'todos' | null>(null);
  const [conferencia, setConferencia] = useState<ConferenciaItem[] | null>(null);
  const [falhas, setFalhas] = useState<{ sku: string; erro: string }[]>([]);
  const [sincronizando, setSincronizando] = useState(false);
  const [itemPreco, setItemPreco] = useState<number | null>(null);    // item aberto no painel de preço
  const painelPreco = useRef<HTMLDivElement>(null);

  /** Detalhe novo do servidor: o rascunho perde o que ficou igual ao salvo (ou o que não existe mais). */
  const aplicar = useCallback((d: AnuncioDetalhe) => {
    setSalvo(d);
    setRascunho(r => limparIguais(r, d));
  }, []);

  const recarregar = useCallback(async () => {
    if (!id) return;
    setCarregando(true);
    try { aplicar(await anunciosApi.detalhe(id)); }
    catch (e) { message.error(erroMsg(e)); }
    finally { setCarregando(false); }
  }, [id, aplicar]);

  useEffect(() => {
    setSalvo(null);
    setRascunho(RASCUNHO_VAZIO);
    setAba('anuncio');
    setItemPreco(null);
    setFiltroItens(null);
    setConferencia(null);
    setFalhas([]);
    if (id) recarregar();
  }, [id, recarregar]);

  const det = useMemo(() => (salvo ? comRascunho(salvo, rascunho) : null), [salvo, rascunho]);
  const alteracoes = useMemo(() => (salvo ? listarAlteracoes(salvo, rascunho, {
    atributo: idA => salvo.atributosCategoria.find(a => a.id === idA)?.nome || idA,
    erp: idE => salvo.atributosErp.find(e => e.id === idE)?.nome || `#${idE}`,
  }) : []), [salvo, rascunho]);
  const temRascunho = alteracoes.length > 0;
  const vaiPeloBotao = alteracoes.some(a => a.vaiAoMl === 'BOTAO');

  const skuDoItem = useMemo(() => new Map((salvo?.itens || []).map(i => [i.idItem, i.sku])), [salvo]);
  const pendencias = useMemo(() => agruparPendencias(salvo?.pendencias || [], skuDoItem), [salvo, skuDoItem]);
  const atributoComErro = useMemo(() => new Set((salvo?.pendencias || []).filter(p => p.nivel === 'erro' && p.atributo).map(p => p.atributo!)), [salvo]);
  const itemComErro = useMemo(() => new Set((salvo?.pendencias || []).filter(p => p.nivel === 'erro' && p.idItem).map(p => p.idItem!)), [salvo]);
  const errosConferencia = useMemo(() => new Map((conferencia || []).filter(c => !c.ok).map(c => [c.idItem, c.erros])), [conferencia]);

  // ---------------------------------------------------------------------------
  // Rascunho
  // ---------------------------------------------------------------------------

  const mudarCampo = <K extends Exclude<keyof RascunhoAnuncio, 'atributos'>>(campo: K, valor: RascunhoAnuncio[K]) => {
    if (salvo) setRascunho(r => mudarAnuncio(r, salvo, campo, valor));
  };
  const mudarEstoque = (corpo: { estoqueReserva?: number; estoqueMaximo?: number | null; estoqueAutomatico?: boolean }) =>
    salvo && setRascunho(r => (Object.entries(corpo) as [keyof typeof corpo, never][]).reduce((acc, [c, v]) => mudarAnuncio(acc, salvo, c, v), r));
  const mudarDoItem = (idItem: number, corpo: RascunhoItem) =>
    salvo && setRascunho(r => (Object.entries(corpo) as [keyof RascunhoItem, never][]).reduce((acc, [c, v]) => mudarItem(acc, salvo, idItem, c, v), r));

  const desfazerTudo = () => setRascunho(RASCUNHO_VAZIO);

  /** Grava o rascunho: anúncio, depois cada item; com enviarMl manda atributos/fotos/descrição aos itens no ML. */
  const salvar = async (enviarMl: boolean) => {
    if (!salvo || !temRascunho) return;
    const corpos = corposParaSalvar(rascunho);
    setSalvando(true);
    let atual = salvo;
    try {
      if (corpos.anuncio) atual = await anunciosApi.salvar(salvo.id, corpos.anuncio);
      for (const i of corpos.itens) if (Object.keys(i.corpo).length) atual = await anunciosApi.salvarItem(salvo.id, i.idItem, i.corpo);
      setSalvo(atual);
      setRascunho(RASCUNHO_VAZIO);
      if (enviarMl) {
        const r = await anunciosApi.atualizarNoMl(salvo.id);
        aplicar(r.detalhe);
        const recusados = r.itens.filter(x => !x.ok);
        setConferencia(recusados.length ? r.itens : null);
        if (recusados.length) message.warning(`Salvo. No ML: ${r.itens.length - recusados.length} atualizado(s), ${recusados.length} recusado(s) (veja ao lado).`, 6);
        else message.success(`Salvo e enviado aos ${r.itens.length} anúncio(s) no Mercado Livre.`);
      } else {
        message.success(atual.publicados > 0 ? 'Alterações salvas. Preço e estoque já seguem para o ML.' : 'Alterações salvas.');
      }
      onAlterado();
    } catch (e) {
      // o que já gravou sai do rascunho; o resto fica para tentar de novo
      message.error(erroMsg(e), 6);
      try { aplicar(await anunciosApi.detalhe(salvo.id)); } catch { /* fica o que tinha */ }
    } finally {
      setSalvando(false);
    }
  };

  const fechar = () => {
    if (!temRascunho) { onFechar(); return; }
    modal.confirm({
      title: `Descartar ${alteracoes.length} alteração(ões) não salva(s)?`,
      content: 'O que você mudou e não salvou será perdido.',
      okText: 'Descartar e fechar', okButtonProps: { danger: true }, cancelText: 'Continuar editando',
      onOk: onFechar,
    });
  };

  // Ctrl+S salva
  useEffect(() => {
    if (!id) return;
    const tecla = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); if (!salvando) salvar(false); }
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  });

  // ---------------------------------------------------------------------------
  // Ações que valem na hora
  // ---------------------------------------------------------------------------

  const executar = async (acao: () => Promise<AnuncioDetalhe>, ok?: string) => {
    setOcupado(true);
    try {
      aplicar(await acao());
      if (ok) message.success(ok);
      onAlterado();
    } catch (e) {
      message.error(erroMsg(e));
    } finally {
      setOcupado(false);
    }
  };

  const comFoto = async (alvo: number | 'todos', envio: () => Promise<unknown>, ok: string) => {
    setEnviandoFoto(alvo);
    try {
      await envio();
      message.success(ok);
      await recarregar();
      onAlterado();
    } catch (e) {
      message.error(erroMsg(e));
    } finally {
      setEnviandoFoto(null);
    }
  };
  const enviarFoto = (item: ItemDoAnuncio, arquivo: File) => comFoto(item.idItem, async () => {
    await avisarFotoPequena(arquivo);
    await enviarArquivoAnexo(item.idItem, arquivo, item.fotos === 0 ? 'IMAGEM_PRINCIPAL' : 'FOTO_GALERIA');
  }, `Foto enviada para ${item.sku}.`);
  const fotoPorLink = (item: ItemDoAnuncio, url: string) =>
    comFoto(item.idItem, () => adicionarAnexo(item.idItem, url, item.fotos === 0 ? 'IMAGEM_PRINCIPAL' : 'FOTO_GALERIA'), `Foto colocada em ${item.sku}.`);
  const fotoParaTodos = (arquivo: File) => {
    const alvo = (salvo?.itens || []).filter(i => i.fotos === 0 && !i.ml.mlbId);
    return comFoto('todos', async () => {
      await avisarFotoPequena(arquivo);
      for (const i of alvo) await enviarArquivoAnexo(i.idItem, arquivo, 'IMAGEM_PRINCIPAL');
    }, `Foto colocada em ${alvo.length} item(ns).`);
  };

  const trocarCategoria = async (categoriaMl: string) => {
    if (!salvo) return;
    await executar(() => anunciosApi.salvar(salvo.id, { categoriaMl }), 'Categoria trocada: atributos ligados pelo nome quando deu.');
    // a categoria nova pede outros atributos: o rascunho de atributos deixa de valer
    setRascunho(r => { const anuncio = { ...r.anuncio }; delete anuncio.atributos; return { ...r, anuncio }; });
    setCategoriaAberta(false);
  };
  const pedirCategoria = () => {
    if (!rascunho.anuncio.atributos) { setCategoriaAberta(true); return; }
    modal.confirm({
      title: 'Trocar a categoria?', content: 'As mudanças nos atributos ainda não salvas serão descartadas (a categoria nova pede outros atributos).',
      okText: 'Trocar', onOk: () => setCategoriaAberta(true),
    });
  };

  const sincronizarAgora = async () => {
    if (!salvo) return;
    setSincronizando(true);
    try {
      const r = await anunciosApi.sincronizarAnuncio(salvo.id);
      aplicar(r.detalhe);
      const resumo = resumoSincronizacao(r.enviados);
      message[resumo.tipo](resumo.texto, 6);
      onAlterado();
    } catch (e) {
      message.error(erroMsg(e));
    } finally {
      setSincronizando(false);
    }
  };

  const acaoNoMl = async (acao: AcaoMl) => {
    if (!salvo) return;
    setAcaoMl(acao);
    try {
      if (acao === 'conferir') {
        const r = await anunciosApi.validar(salvo.id);
        aplicar(r.detalhe);
        setConferencia(r.itens);
        const comErro = r.itens.filter(i => !i.ok).length;
        if (comErro) message.warning(`O ML apontou problema em ${comErro} item(ns): veja ao lado.`);
        else message.success('O ML aceitou todos os itens: pode publicar.');
      } else if (acao === 'publicar') {
        const r = await anunciosApi.publicar(salvo.id);
        aplicar(r.detalhe);
        setFalhas(r.falhas);
        setConferencia(null);
        if (r.publicados.length && !r.falhas.length) message.success(`${r.publicados.length} anúncio(s) criados no Mercado Livre.`);
        else if (r.publicados.length) message.warning(`${r.publicados.length} publicado(s); ${r.falhas.length} não subiram (veja ao lado).`);
        else message.error('Nenhum item subiu: veja o motivo ao lado.');
      } else if (acao === 'enviar') {
        const r = await anunciosApi.atualizarNoMl(salvo.id);
        aplicar(r.detalhe);
        const recusados = r.itens.filter(i => !i.ok);
        setConferencia(recusados.length ? r.itens : null);
        if (recusados.length) message.warning(`${r.itens.length - recusados.length} atualizado(s) no ML; ${recusados.length} recusado(s): veja ao lado.`);
        else message.success(`Atributos, fotos e descrição enviados aos ${r.itens.length} anúncio(s) no ML.`);
      } else if (acao === 'pausar' || acao === 'reativar') {
        aplicar(await anunciosApi.pausarNoMl(salvo.id, acao === 'pausar'));
        message.success(acao === 'pausar' ? 'Pausado no Mercado Livre.' : 'Reativado no Mercado Livre.');
      } else if (acao === 'encerrar') {
        aplicar(await anunciosApi.encerrarNoMl(salvo.id));
        message.success('Encerrados e excluídos no ML: os itens voltaram a "a publicar".');
      }
      onAlterado();
    } catch (e) {
      message.error(erroMsg(e));
    } finally {
      setAcaoMl(null);
    }
  };

  const irParaPendencia = (p: PendenciaAgrupada) => {
    const destino = ABA_DA_AREA[p.area] || 'anuncio';
    if (p.idItens.length) { setFiltroItens({ texto: p.texto, ids: p.idItens }); setAba('itens'); return; }
    setAba(destino);
  };

  // ---------------------------------------------------------------------------
  // Abas
  // ---------------------------------------------------------------------------

  const errosDaAba = (a: Aba) => (salvo?.pendencias || []).filter(p => p.nivel === 'erro' && ABA_DA_AREA[p.area] === a).length;
  // preço do item fica na aba Preço e lucro; unidade e regra de estoque, na aba Itens e estoque
  const itensMudados = Object.values(rascunho.itens);
  const mudouNaAba = (a: Aba) => CAMPOS_DA_ABA[a].some(c => c in rascunho.anuncio)
    || (a === 'itens' && itensMudados.some(c => Object.keys(c).some(k => k !== 'precoMl')))
    || (a === 'preco' && itensMudados.some(c => 'precoMl' in c));
  const rotuloAba = (a: Aba, texto: string) => {
    const erros = errosDaAba(a);
    return (
      <Space size={6}>
        {texto}
        {erros > 0 && <Badge count={erros} size="small" />}
        {mudouNaAba(a) && <Tooltip title="Tem alteração não salva"><Badge color="#1677ff" /></Tooltip>}
      </Space>
    );
  };

  const abas = !det || !salvo ? [] : [
    {
      key: 'anuncio', label: rotuloAba('anuncio', 'Anúncio'),
      children: <AbaDados salvo={salvo} det={det} rascunho={rascunho.anuncio} onMudar={mudarCampo} onTrocarCategoria={pedirCategoria} />,
    },
    {
      key: 'itens', label: rotuloAba('itens', `Itens e estoque (${det.itens.length})`),
      children: (
        <AbaItens
          salvo={salvo} det={det} rascunhoItens={rascunho.itens} onMudarEstoque={mudarEstoque} onMudarItem={mudarDoItem}
          filtro={filtroItens} onLimparFiltro={() => setFiltroItens(null)} comErro={itemComErro} errosConferencia={errosConferencia}
          enviandoFoto={enviandoFoto} onFoto={enviarFoto} onFotoLink={fotoPorLink} onFotoTodos={fotoParaTodos}
          onFotoFamilia={() => { recarregar(); onAlterado(); }}
          onAdicionarItens={() => setAdicionarItens(true)}
          onRemoverItem={i => executar(() => anunciosApi.removerItem(salvo.id, i.idItem), `${i.sku} saiu do anúncio.`)}
          onDesligar={i => executar(() => anunciosApi.desligarDoMl(salvo.id, i.idItem), 'Item desligado do ML.')}
          sincronizando={sincronizando} onSincronizar={sincronizarAgora}
        />
      ),
    },
    {
      key: 'atributos', label: rotuloAba('atributos', 'Atributos'),
      children: <AbaAtributos salvo={salvo} det={det} comErro={atributoComErro} onMudar={(idA, v) => setRascunho(r => mudarAtributo(r, salvo, idA, v))} />,
    },
    {
      key: 'preco', label: rotuloAba('preco', 'Preço e lucro'),
      children: (
        <>
          {det.categoria && det.itens.length > 0 && (
            <>
              <div ref={painelPreco} style={{ scrollMarginTop: 8 }}>
                <PrecoMlCard
                  salvo={salvo} det={det} idItem={itemPreco ?? det.itens[0].idItem} onTrocarItem={setItemPreco}
                  onMudarPreco={(idItem, preco) => mudarDoItem(idItem, { precoMl: preco })}
                  onEscolherCenario={(tipo, gratis) => {
                    mudarCampo('tipoAnuncio', tipo);
                    if (gratis !== undefined) mudarCampo('freteGratis', gratis);
                    message.info('Modo de venda posto nas alterações: confira ao lado e salve para mandar ao ML.');
                  }}
                />
              </div>
              <TabelaPrecos
                salvo={salvo} det={det} rascunhoItens={rascunho.itens}
                onMudarPreco={(idItem, preco) => mudarDoItem(idItem, { precoMl: preco })}
                selecionado={itemPreco ?? det.itens[0].idItem}
                onSelecionar={idItem => { setItemPreco(idItem); painelPreco.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}
              />
            </>
          )}
          {!det.categoria && <Card size="small" style={{ marginBottom: 16 }}><Text type="secondary">Escolha a categoria do ML (aba Anúncio): a tarifa depende dela.</Text></Card>}
          <FaixasQuantidadeCard det={det} onMudar={faixas => mudarCampo('faixasQuantidade', faixas)} />
        </>
      ),
    },
    ...(salvo.publicados > 0 ? [{ key: 'catalogo', label: rotuloAba('catalogo', 'Catálogo'), children: <CatalogoMlCard det={salvo} /> }] : []),
  ];

  // ---------------------------------------------------------------------------
  // Tela
  // ---------------------------------------------------------------------------

  const titulo = salvo && (
    <Flex align="center" gap={10} wrap style={{ paddingRight: 32 }}>
      <ShopOutlined style={{ fontSize: 20, color: '#1677ff' }} />
      <div style={{ minWidth: 0 }}>
        <Text strong style={{ fontSize: 16 }}>{salvo.titulo || 'Anúncio sem título'}</Text>
        <div style={{ fontSize: 12, fontWeight: 400 }}>
          <Text type="secondary">
            {salvo.modo === 'FAMILIA' ? 'Um anúncio com variações' : salvo.itens.length > 1 ? 'Um anúncio por item' : 'Anúncio de um item'}
            {salvo.categoria ? ` · ${salvo.categoria.caminho}` : ''}
          </Text>
        </div>
      </div>
      <SituacaoTag a={salvo} />
      {salvo.familia && <Tag>{salvo.familia}</Tag>}
      {salvo.permalink && <Button size="small" type="link" icon={<LinkOutlined />} href={salvo.permalink} target="_blank">Ver no ML</Button>}
    </Flex>
  );

  const rodape = salvo && (
    <Flex justify="space-between" align="center" gap={8} wrap>
      {temRascunho
        ? <Text style={{ color: '#1677ff' }}><Badge color="#1677ff" /> {alteracoes.length} alteração(ões) não salva(s)<Text type="secondary" style={{ fontSize: 12 }}> · Ctrl+S salva</Text></Text>
        : <Text type="secondary"><CheckCircleOutlined style={{ color: '#52c41a' }} /> Tudo salvo</Text>}
      <Space wrap>
        <Button onClick={fechar}>Fechar</Button>
        <Button icon={<UndoOutlined />} disabled={!temRascunho || salvando} onClick={desfazerTudo}>Desfazer tudo</Button>
        <Button type={vaiPeloBotao ? 'default' : 'primary'} icon={<SaveOutlined />} disabled={!temRascunho} loading={salvando} onClick={() => salvar(false)}>Salvar</Button>
        {vaiPeloBotao && (
          <Tooltip title="Grava e já manda atributos, fotos e descrição para os anúncios no Mercado Livre">
            <Button type="primary" icon={<CloudUploadOutlined />} disabled={!temRascunho} loading={salvando} onClick={() => salvar(true)}>Salvar e enviar ao ML</Button>
          </Tooltip>
        )}
      </Space>
    </Flex>
  );

  return (
    <Modal
      open={id !== null} onCancel={fechar} destroyOnHidden maskClosable={false} centered={false}
      width="min(1440px, 96vw)" style={{ top: 16, paddingBottom: 0 }}
      title={titulo || 'Anúncio'} footer={rodape}
      styles={{
        container: { padding: 0, overflow: 'hidden' },
        header: { padding: '14px 20px', margin: 0, borderBottom: '1px solid #f0f0f0' },
        body: { background: '#f5f6f8', padding: 16, height: 'calc(100vh - 160px)', overflowY: 'auto' },
        footer: { padding: '10px 20px', margin: 0, borderTop: '1px solid #f0f0f0' },
      }}
    >
      {contextoModal}
      <style>{`
        .ml-linha-erro > td { background: #fff7f6 !important; }
        .ml-linha-alterada > td { background: #f0f7ff !important; }
        .ml-linha-alterada > td:first-child { box-shadow: inset 3px 0 0 #1677ff; }
        .ml-linha-selecionada > td { background: #e6f4ff !important; }
        .ml-linha-selecionada > td:first-child { box-shadow: inset 4px 0 0 #1677ff; }
        .ml-editor-abas > .ant-tabs-nav { background: #fff; padding: 0 12px; border-radius: 8px; margin-bottom: 12px; }
      `}</style>
      <Spin spinning={carregando || ocupado}>
        {!det || !salvo ? <div style={{ minHeight: 400 }} /> : (
          <Row gutter={16}>
            <Col xs={24} xl={17}>
              <Tabs className="ml-editor-abas" activeKey={aba} onChange={k => setAba(k as Aba)} items={abas} />
            </Col>
            <Col xs={24} xl={7}>
              <div style={{ position: 'sticky', top: 0 }}>
                <PainelAlteracoes alteracoes={alteracoes} onDesfazer={chave => setRascunho(r => desfazer(r, salvo, chave))} onDesfazerTudo={desfazerTudo} />
                <PainelLateral
                  det={salvo} temRascunho={temRascunho} ocupado={acaoMl} conferencia={conferencia} falhas={falhas}
                  pendencias={pendencias} onAcao={acaoNoMl} onPendencia={irParaPendencia}
                />
              </div>
            </Col>
          </Row>
        )}
      </Spin>

      {salvo && (
        <>
          <CategoriaMlModal aberto={categoriaAberta} titulo={salvo.titulo || ''} atual={salvo.categoriaMl} onFechar={() => setCategoriaAberta(false)} onEscolher={trocarCategoria} />
          <AdicionarAnuncioModal
            aberto={adicionarItens} modo="itens" onFechar={() => setAdicionarItens(false)}
            onEscolherItens={ids => { setAdicionarItens(false); executar(() => anunciosApi.adicionarItens(salvo.id, ids), 'Itens adicionados.'); }}
          />
        </>
      )}
    </Modal>
  );
};

export default AnuncioEditor;
