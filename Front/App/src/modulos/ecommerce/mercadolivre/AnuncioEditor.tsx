// Editor do anúncio do ML (modal): as mudanças de texto, preço, estoque, atributos e faixas ficam num rascunho, aparecem
// no painel "Alterações não salvas" (antes → depois, com desfazer) e só vão para o banco/ML ao salvar.
// Fotos, itens, categoria e as ações no ML (conferir, publicar, pausar, encerrar) valem na hora.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge, Button, Col, Flex, InputNumber, Modal, Row, Space, Spin, Tabs, Tag, Tooltip, Typography, message } from 'antd';
import { CheckCircleOutlined, CloudUploadOutlined, LinkOutlined, SaveOutlined, ShopOutlined, UndoOutlined } from '@ant-design/icons';
import { adicionarAnexo, enviarArquivoAnexo, updateProduto } from '../../../areas/catalogo/skus/CatalogSku.service';
import { AnuncioDetalhe, anunciosApi, ConferenciaItem, DivergenciasLinha, ItemDoAnuncio, resumoSincronizacao, SecaoPreco } from './mercadoLivreApi';
import { destinoDa, DestinoSugestao } from './SugestoesMl';
import { agruparPendencias, PendenciaAgrupada } from './pendencias';
import {
  comRascunho, corposParaSalvar, desfazer, limparIguais, listarAlteracoes, mudarAnuncio, mudarAtributo, mudarItem,
  Rascunho, RASCUNHO_VAZIO, RascunhoAnuncio, RascunhoItem,
} from './rascunhoAnuncio';
import AbaDados from './editor/AbaDados';
import AbaItens from './editor/AbaItens';
import AbaFotos from './editor/AbaFotos';
import AbaAtributos from './editor/AbaAtributos';
import PainelAlteracoes from './editor/PainelAlteracoes';
import PainelLateral, { AcaoMl } from './editor/PainelLateral';
import CatalogoMlCard from './CatalogoMlCard';
import AbaPreco from './editor/AbaPreco';
import NavegacaoAnuncio, { SelecaoEditor } from './editor/NavegacaoAnuncio';
import FormasDoProduto from './editor/FormasDoProduto';
import CategoriaMlModal from './CategoriaMlModal';
import AdicionarAnuncioModal from './AdicionarAnuncioModal';
import SituacaoTag from './SituacaoTag';

const { Text } = Typography;

interface Props {
  id: number | null;
  onFechar: () => void;
  onAlterado: () => void;
  abrirEm?: DestinoSugestao | null;       // aba/linha/seção vinda da central de sugestões
}

type Aba = 'anuncio' | 'formas' | 'itens' | 'fotos' | 'atributos' | 'preco' | 'catalogo';
const ABA_DA_AREA: Record<string, Aba> = { dados: 'anuncio', itens: 'itens', cadastro: 'itens', atributos: 'atributos' };
const CAMPOS_DA_ABA: Record<Aba, (keyof RascunhoAnuncio)[]> = {
  anuncio: ['titulo', 'modeloTitulo', 'tipoAnuncio', 'condicao', 'descricao', 'ajustePreco'],
  itens: ['estoqueReserva', 'estoqueMaximo', 'estoqueAutomatico'],
  formas: [],
  fotos: [],
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

const AnuncioEditor: React.FC<Props> = ({ id, onFechar, onAlterado, abrirEm }) => {
  const [modal, contextoModal] = Modal.useModal();
  const [salvo, setSalvo] = useState<AnuncioDetalhe | null>(null);
  const [rascunho, setRascunho] = useState<Rascunho>(RASCUNHO_VAZIO);
  const [aba, setAba] = useState<Aba>('anuncio');
  const [selecao, setSelecao] = useState<SelecaoEditor>('geral');   // Geral ou um produto (idItem) do anúncio
  const [carregando, setCarregando] = useState(false);
  const [ocupado, setOcupado] = useState(false);                       // ação imediata (foto, itens, categoria)
  const [salvando, setSalvando] = useState(false);
  const [acaoMl, setAcaoMl] = useState<AcaoMl | null>(null);
  const [categoriaAberta, setCategoriaAberta] = useState(false);
  const [adicionarItens, setAdicionarItens] = useState(false);
  const [filtroItens, setFiltroItens] = useState<{ texto: string; ids: number[] } | null>(null);
  const [enviandoFoto, setEnviandoFoto] = useState<number | 'todos' | null>(null);
  const [conferencia, setConferencia] = useState<ConferenciaItem[] | null>(null);
  // ERP × ML dos itens publicados: refeita a cada vez que o anúncio salvo muda (salvar, enviar, publicar...)
  const [divergencias, setDivergencias] = useState<DivergenciasLinha[] | null | undefined>(undefined);
  const [falhas, setFalhas] = useState<{ sku: string; erro: string }[]>([]);
  const [sincronizando, setSincronizando] = useState(false);
  const [itemPreco, setItemPreco] = useState<number | null>(null);    // item aberto no painel de preço
  const [secaoPreco, setSecaoPreco] = useState<{ secao: SecaoPreco; vez: number } | null>(null);   // seção pedida no painel de preço

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
    setSelecao('geral');
    setItemPreco(null);
    setSecaoPreco(null);
    setFiltroItens(null);
    setConferencia(null);
    setFalhas([]);
    if (id) recarregar();
  }, [id, recarregar]);

  useEffect(() => {
    if (!salvo || !salvo.publicados) { setDivergencias(undefined); return; }
    let vivo = true;
    setDivergencias(null);
    anunciosApi.divergencias(salvo.id, true).then(r => vivo && setDivergencias(r.linhas)).catch(() => vivo && setDivergencias(undefined));
    return () => { vivo = false; };
  }, [salvo]);

  // vindo de uma sugestão: abre direto na aba, na linha e na seção dela (depois do efeito acima, que zera tudo)
  const irPara = useCallback((d: DestinoSugestao) => {
    setSelecao('geral');
    if (d.aba === 'itens') { setFiltroItens({ texto: d.sku, ids: [d.idLinha] }); setAba('itens'); return; }
    setItemPreco(d.idLinha);
    if (d.secao) setSecaoPreco({ secao: d.secao, vez: d.vez });
    setAba('preco');
  }, []);
  useEffect(() => { if (id && abrirEm) irPara(abrirEm); }, [id, abrirEm?.vez]);   // eslint-disable-line react-hooks/exhaustive-deps

  const det = useMemo(() => (salvo ? comRascunho(salvo, rascunho) : null), [salvo, rascunho]);
  const alteracoes = useMemo(() => (salvo ? listarAlteracoes(salvo, rascunho, {
    atributo: idA => salvo.atributosCategoria.find(a => a.id === idA)?.nome || idA,
    erp: idE => salvo.atributosErp.find(e => e.id === idE)?.nome || `#${idE}`,
  }) : []), [salvo, rascunho]);
  const temRascunho = alteracoes.length > 0;
  const vaiPeloBotao = alteracoes.some(a => a.vaiAoMl === 'BOTAO');

  const skuDaLinha = useMemo(() => new Map((salvo?.itens || []).map(i => [i.idLinha, i.sku])), [salvo]);
  const pendencias = useMemo(() => agruparPendencias(salvo?.pendencias || [], skuDaLinha), [salvo, skuDaLinha]);
  const atributoComErro = useMemo(() => new Set((salvo?.pendencias || []).filter(p => p.nivel === 'erro' && p.atributo).map(p => p.atributo!)), [salvo]);
  // por linha do anúncio (o mesmo item pode estar em mais de uma unidade)
  const itemComErro = useMemo(() => new Set((salvo?.pendencias || []).filter(p => p.nivel === 'erro' && (p.idLinha ?? p.idItem)).map(p => (p.idLinha ?? p.idItem)!)), [salvo]);
  const errosConferencia = useMemo(() => new Map((conferencia || []).filter(c => !c.ok).map(c => [c.idLinha ?? c.idItem, c.erros])), [conferencia]);

  // ---------------------------------------------------------------------------
  // Rascunho
  // ---------------------------------------------------------------------------

  const mudarCampo = <K extends Exclude<keyof RascunhoAnuncio, 'atributos'>>(campo: K, valor: RascunhoAnuncio[K]) => {
    if (salvo) setRascunho(r => mudarAnuncio(r, salvo, campo, valor));
  };
  const mudarEstoque = (corpo: { estoqueReserva?: number; estoqueMaximo?: number | null; estoqueAutomatico?: boolean }) =>
    salvo && setRascunho(r => (Object.entries(corpo) as [keyof typeof corpo, never][]).reduce((acc, [c, v]) => mudarAnuncio(acc, salvo, c, v), r));
  const mudarDoItem = (idLinha: number, corpo: RascunhoItem) =>
    salvo && setRascunho(r => (Object.entries(corpo) as [keyof RascunhoItem, never][]).reduce((acc, [c, v]) => mudarItem(acc, salvo, idLinha, c, v), r));

  const desfazerTudo = () => setRascunho(RASCUNHO_VAZIO);

  /** Grava o rascunho: anúncio, depois cada item; com enviarMl manda atributos/fotos/descrição aos itens no ML. */
  const salvar = async (enviarMl: boolean) => {
    if (!salvo || !temRascunho) return;
    const corpos = corposParaSalvar(rascunho);
    setSalvando(true);
    let atual = salvo;
    try {
      if (corpos.anuncio) atual = await anunciosApi.salvar(salvo.id, corpos.anuncio);
      for (const i of corpos.itens) if (Object.keys(i.corpo).length) atual = await anunciosApi.salvarItem(salvo.id, i.idLinha, i.corpo);
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

  /** Vende o item da linha escolhida também em conjunto de `quantidade` (ou volta o unitário), já com o preço simulado. */
  const criarForma = (idLinha: number, quantidade: number, preco: number | null) => salvo && executar(async () => {
    const idItem = salvo.itens.find(i => i.idLinha === idLinha)?.idItem;
    let r: AnuncioDetalhe = await anunciosApi.criarKit(salvo.id, idLinha, quantidade);
    const nova = r.itens.find(i => i.idItem === idItem && (i.unidadeMl?.fator ?? 1) === quantidade);
    if (preco && nova) r = await anunciosApi.precoItem(salvo.id, nova.idLinha, preco);
    return r;
  }, quantidade > 1 ? `Kit c/${quantidade} no anúncio: confira e publique (ele tem SKU e título próprios).` : 'Unitário de volta ao anúncio.');

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
    // a foto é do item: com o item em duas unidades, vai uma vez só
    const alvo = [...new Map((salvo?.itens || []).filter(i => i.fotos === 0 && !i.ml.mlbId).map(i => [i.idItem, i])).values()];
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
    setSelecao('geral');
    if (p.idLinhas.length) { setFiltroItens({ texto: p.texto, ids: p.idLinhas }); setAba('itens'); return; }
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

  // produto escolhido: as abas mostram só as linhas dele (as formas de venda: unidade, kit c/2, kit c/10...)
  const doProduto = <T extends { itens: ItemDoAnuncio[] }>(x: T): T => (selecao === 'geral' ? x : { ...x, itens: x.itens.filter(i => i.idItem === selecao) });
  const detVista = det && doProduto(det);
  const salvoVista = salvo && doProduto(salvo);
  const linhaPreco = itemPreco !== null && detVista?.itens.some(i => i.idLinha === itemPreco) ? itemPreco : null;
  const noProduto = selecao !== 'geral';

  const abas = !det || !salvo || !detVista || !salvoVista ? [] : [
    ...(noProduto ? [{
      key: 'formas', label: rotuloAba('formas', 'Formas e escada'),
      children: (
        <FormasDoProduto
          det={detVista}
          onAtivar={(idLinha, ativo) => executar(() => anunciosApi.ativarLinha(salvo.id, idLinha, ativo), ativo ? 'Forma de venda ativada.' : 'Forma de venda tirada da venda.')}
          onSalvarEscada={async (idLinha, faixas) => {
            // erro: o editor da escada fica aberto (não usa o executar, que engole o erro)
            try {
              aplicar(await anunciosApi.salvarEscada(salvo.id, idLinha, faixas));
              message.success(faixas === null ? 'A forma voltou a seguir a escada do anúncio.' : faixas.length ? 'Escada salva.' : 'Forma sem escada.');
              onAlterado();
            } catch (e) {
              message.error(erroMsg(e), 6);
              throw e;
            }
          }}
          onCriarKit={(idLinha, quantidade) => criarForma(idLinha, quantidade, null)}
          onAnalise={idLinha => { setItemPreco(idLinha); setAba('preco'); }}
        />
      ),
    }] : [{
      key: 'anuncio', label: rotuloAba('anuncio', 'Anúncio'),
      children: <AbaDados salvo={salvo} det={det} rascunho={rascunho.anuncio} onMudar={mudarCampo} onTrocarCategoria={pedirCategoria} />,
    }]),
    {
      key: 'itens', label: rotuloAba('itens', noProduto ? 'Cadastro e estoque' : `Itens e estoque (${det.itens.length})`),
      children: (
        <AbaItens
          salvo={salvoVista} det={detVista} rascunhoItens={rascunho.itens} onMudarEstoque={mudarEstoque} onMudarItem={mudarDoItem}
          filtro={filtroItens} onLimparFiltro={() => setFiltroItens(null)} comErro={itemComErro} errosConferencia={errosConferencia}
          enviandoFoto={enviandoFoto} onFoto={enviarFoto} onFotoLink={fotoPorLink} onFotoTodos={fotoParaTodos}
          onFotoFamilia={() => { recarregar(); onAlterado(); }}
          onAdicionarItens={() => setAdicionarItens(true)}
          onRemoverItem={i => executar(() => anunciosApi.removerItem(salvo.id, i.idLinha), `${i.sku} saiu do anúncio.`)}
          onDesligar={i => executar(() => anunciosApi.desligarDoMl(salvo.id, i.idLinha), 'Item desligado do ML.')}
          onOutraUnidade={(i, idUnidade) => executar(() => anunciosApi.adicionarUnidade(salvo.id, i.idLinha, idUnidade),
            'Nova linha no anúncio: confira o preço e publique (ela tem SKU e título próprios).')}
          onCorrigirUnidade={i => {
            let quantidade = i.unidadeMl && i.unidadeMl.fator > 1 ? i.unidadeMl.fator : 2;
            modal.confirm({
              title: `Quantas unidades o anúncio ${i.ml.mlbId} vende por venda?`, okText: 'Corrigir', cancelText: 'Cancelar', width: 480,
              content: (
                <div>
                  <p style={{ marginBottom: 8 }}>
                    Para quando o anúncio que já está no ML vende outra quantidade (ex.: o par a R$ 24,90 cadastrado como 1 unidade).
                    O anúncio do ML continua o mesmo; o preço de lá fica como preço desta linha e o estoque passa a ir dividido.
                  </p>
                  <InputNumber min={1} max={999} precision={0} defaultValue={quantidade} onChange={v => { quantidade = Number(v) || 1; }} addonAfter="unidades" />
                </div>
              ),
              onOk: () => executar(() => anunciosApi.corrigirUnidade(salvo.id, i.idLinha, quantidade),
                'Unidade corrigida. Use "Enviar atributos, fotos e descrição" para o título, as unidades por pacote e a foto do kit irem ao ML.'),
            });
          }}
          onAtivar={(i, ativo) => executar(() => anunciosApi.ativarLinha(salvo.id, i.idLinha, ativo),
            ativo ? `${i.sku} ativado${i.ml.mlbId ? ' e reativado no ML' : ''}.` : `${i.sku} desativado${i.ml.mlbId ? ' e pausado no ML' : ': não vai ser publicado'}.`)}
          sincronizando={sincronizando} onSincronizar={sincronizarAgora}
        />
      ),
    },
    ...(noProduto ? [] : [{
      key: 'fotos', label: rotuloAba('fotos', 'Fotos'),
      children: <AbaFotos salvo={salvo} det={det} onAlterado={() => { recarregar(); onAlterado(); }} />,
    }]),
    {
      key: 'atributos', label: rotuloAba('atributos', noProduto ? 'Ficha' : 'Atributos'),
      children: <AbaAtributos salvo={salvoVista} det={detVista} comErro={atributoComErro} onMudar={(idA, v) => setRascunho(r => mudarAtributo(r, salvo, idA, v))} />,
    },
    {
      key: 'preco', label: rotuloAba('preco', noProduto ? 'Análise de preço' : 'Preço e lucro'),
      children: (
        <AbaPreco
          salvo={salvoVista} det={detVista} rascunhoItens={rascunho.itens} idLinha={linhaPreco} onSelecionar={setItemPreco} ocupado={ocupado}
          secaoPedida={secaoPreco} onIrParaItens={s => irPara(destinoDa(s))}
          onMudarPreco={(idLinha, preco) => mudarDoItem(idLinha, { precoMl: preco })}
          onEscolherCenario={(tipo, gratis) => {
            // só avisa "posto nas alterações" quando muda de verdade (escolher o que já está não entra na lista)
            const mudaTipo = tipo !== salvo.tipoAnuncio;
            const mudaFrete = gratis !== undefined && gratis !== (salvo.vendaMl?.freteGratis ?? null);
            mudarCampo('tipoAnuncio', tipo);
            if (gratis !== undefined) mudarCampo('freteGratis', gratis);
            if (mudaTipo || mudaFrete) message.info('Modo de venda posto nas alterações: confira ao lado e salve para mandar ao ML.');
            else message.info('Nada a mudar: o anúncio já está assim (as alterações de modo de venda foram desfeitas).');
          }}
          onMudarFaixas={faixas => mudarCampo('faixasQuantidade', faixas)}
          onCriarForma={criarForma}
          onAtivar={(idLinha, ativo) => executar(() => anunciosApi.ativarLinha(salvo.id, idLinha, ativo), ativo ? 'Forma de venda ativada.' : 'Forma de venda desativada.')}
        />
      ),
    },
    ...(salvo.publicados > 0 && !noProduto ? [{ key: 'catalogo', label: rotuloAba('catalogo', 'Catálogo'), children: <CatalogoMlCard det={salvo} /> }] : []),
  ];

  const ORDEM_PRODUTO = ['formas', 'preco', 'itens', 'atributos'];
  if (noProduto) abas.sort((a, b) => ORDEM_PRODUTO.indexOf(a.key) - ORDEM_PRODUTO.indexOf(b.key));
  // a aba escolhida não existe nesta seleção (ex.: Fotos num produto): abre a primeira
  const abaVista: Aba = abas.some(a => a.key === aba) ? aba : ((abas[0]?.key as Aba) || 'anuncio');
  const escolher = (s: SelecaoEditor) => {
    setSelecao(s);
    if (s !== 'geral' && !['formas', 'preco', 'itens', 'atributos'].includes(aba)) setAba('formas');
  };

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
      width="min(1680px, 98vw)" style={{ top: 16, paddingBottom: 0 }}
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
        .ml-linha-desativada > td { opacity: 0.55; }
        .ml-linha-alterada > td { background: #f0f7ff !important; }
        .ml-linha-alterada > td:first-child { box-shadow: inset 3px 0 0 #1677ff; }
        .ml-linha-selecionada > td { background: #e6f4ff !important; }
        .ml-linha-selecionada > td:first-child { box-shadow: inset 4px 0 0 #1677ff; }
        .ml-editor-abas > .ant-tabs-nav { background: #fff; padding: 0 12px; border-radius: 8px; margin-bottom: 12px; }
      `}</style>
      <Spin spinning={carregando || ocupado}>
        {!det || !salvo ? <div style={{ minHeight: 400 }} /> : (
          <Row gutter={16}>
            <Col xs={24} xl={4}>
              {/* rolagem própria: família grande (as abraçadeiras) rola sem depender do meio */}
              <div style={{ position: 'sticky', top: 0, maxHeight: 'calc(100vh - 192px)', overflowY: 'auto', overscrollBehavior: 'contain' }}>
                <NavegacaoAnuncio det={det} selecao={selecao} onSelecionar={escolher} divergencias={divergencias} />
              </div>
            </Col>
            {/* no preço o painel pede mais largura: a coluna das alterações estreita */}
            <Col xs={24} xl={abaVista === 'preco' ? 15 : 13}>
              <Tabs className="ml-editor-abas" activeKey={abaVista} onChange={k => setAba(k as Aba)} items={abas} />
            </Col>
            <Col xs={24} xl={abaVista === 'preco' ? 5 : 7}>
              <div style={{ position: 'sticky', top: 0 }}>
                <PainelAlteracoes alteracoes={alteracoes} onDesfazer={chave => setRascunho(r => desfazer(r, salvo, chave))} onDesfazerTudo={desfazerTudo} />
                <PainelLateral
                  det={salvo} temRascunho={temRascunho} ocupado={acaoMl} conferencia={conferencia} falhas={falhas}
                  pendencias={pendencias} onAcao={acaoNoMl} onPendencia={irParaPendencia} divergencias={divergencias}
                  onTrazerPacote={l => {
                    const p = l.pacoteMl!;
                    modal.confirm({
                      title: `Trazer a embalagem do ML para o cadastro de ${l.sku}?`, okText: 'Gravar no cadastro', cancelText: 'Cancelar',
                      content: `O cadastro passa a ter ${p.alturaCm} × ${p.larguraCm} × ${p.comprimentoCm} cm e ${p.pesoG} g (como está no ML). Confira se é o pacote real, como ele sai.`,
                      onOk: async () => {
                        try {
                          await updateProduto(l.idItem, { peso_bruto: p.pesoG / 1000, altura_cm: p.alturaCm, largura_cm: p.larguraCm, comprimento_cm: p.comprimentoCm });
                          message.success(`Embalagem de ${l.sku} gravada no cadastro.`);
                          await recarregar();
                        } catch (e) {
                          message.error(e instanceof Error ? e.message : 'Erro ao gravar a embalagem.');
                        }
                      },
                    });
                  }}
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
