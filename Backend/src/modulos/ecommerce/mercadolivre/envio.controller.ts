// Aba Envio do ML: cada forma de venda (unidade, kit c/N) com o pacote que está no anúncio e o do ERP (embalagem
// recomendada + produto × quantidade), o frete hoje e com o pacote do ERP, o custo da embalagem e o lucro com ela, e o
// que falta para o envio. "Enviar pacote" manda só os atributos de peso e medidas ao anúncio publicado.
import { Request, Response } from 'express';
import pool from '../../../infra/db';
import { carregarAnuncios, responderErro, tenantDe } from './anuncios.controller';
import { foraDoMl, ItemAnuncio, precoNoMl } from './anuncios';
import { contextoVenda } from './precificacao.controller';
import { esquecerItemNoMl } from './freteMl';
import { embalagensNoMl } from './sugestoes.controller';
import { esquecerDivergencias } from './publicacao.controller';
import { ErroML, ml } from './mercadolivreApi';
import { faltasDoEnvio, situacaoDoPacote } from './envio';

const r2 = (v: number) => Math.round((Number(v) + Number.EPSILON) * 100) / 100;
const numeroMl = (n: number) => String(Math.round(n * 100) / 100);

/** Os 4 atributos de pacote do ML a partir do pacote de envio do ERP. */
const atributosDoPacote = (p: NonNullable<ItemAnuncio['pacoteEnvio']>) => [
  { id: 'SELLER_PACKAGE_HEIGHT', value_name: `${numeroMl(p.medidas!.altura)} cm` },
  { id: 'SELLER_PACKAGE_WIDTH', value_name: `${numeroMl(p.medidas!.largura)} cm` },
  { id: 'SELLER_PACKAGE_LENGTH', value_name: `${numeroMl(p.medidas!.comprimento)} cm` },
  { id: 'SELLER_PACKAGE_WEIGHT', value_name: `${Math.max(1, Math.round(p.pesoKg! * 1000))} g` },
];

// GET /anuncios/envio
export const envioDosAnuncios = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    const anuncios = (await carregarAnuncios(pool as any, tenant)).filter(c => c.dados.categoriaMl && c.itens.length);
    const mlbs = anuncios.flatMap(c => [...c.noMl.values()].filter(m => m.mlbId && !foraDoMl(m.status)).map(m => m.mlbId!));
    const noMl = mlbs.length ? await embalagensNoMl(tenant, mlbs) : new Map();
    const linhas: any[] = [];
    for (const c of anuncios) {
      // as linhas de um anúncio em paralelo (cada uma consulta tarifa e frete no ML)
      const doAnuncio = await Promise.all(c.itens.map(async item => {
        const m = c.noMl.get(item.idLinha);
        const publicado = !!m?.mlbId && !foraDoMl(m.status);
        if (item.linhaAtiva === false && !publicado) return null;
        const fator = item.unidadeMl?.fator || 1;
        const pacote = item.pacoteEnvio || null;
        const erp = pacote ? { pesoG: pacote.pesoKg ? Math.round(pacote.pesoKg * 1000) : null, caixa: pacote.medidas } : null;
        const lido = publicado ? noMl.get(m!.mlbId!) || null : null;
        let lucro = null, frete = null, freteComPacote = null, tipo = null, freteGratis = null;
        const preco = precoNoMl(item, c.dados.ajustePreco);
        try {
          const ctx = await contextoVenda(tenant, c, item);
          tipo = ctx.tipo; freteGratis = ctx.freteGratis;
          if (preco > 0) {
            const l = await ctx.avaliar(preco);
            lucro = l.lucro; frete = l.freteDesconhecido ? null : l.frete;
            // frete se o anúncio tiver o pacote do ERP (no publicado o de hoje é o que o ML calcula pelo pacote de lá): a mesma
            // conta da aba Preço, como se a linha não estivesse publicada (aí o peso vem do pacote do ERP)
            if (pacote?.medidas && pacote.pesoKg) {
              const semMl = { ...c, registro: { ...c.registro, tipo_anuncio: ctx.tipo }, noMl: new Map() };
              const ctxPacote = await contextoVenda(tenant, semMl, item);
              freteComPacote = await ctxPacote.freteEstimadoDe(preco, 1, ctx.freteGratis);
            }
          }
        } catch { /* sem dado suficiente: fica sem a conta */ }
        const custoEmbalagem = pacote ? r2(pacote.custo) : 0;
        return {
          idAnuncio: Number(c.registro.id), titulo: item.tituloMl || c.dados.titulo || `Anúncio #${c.registro.id}`, idLinha: item.idLinha,
          idItem: item.idItem, idFamilia: item.idFamilia ?? null, sku: item.sku, nome: item.nome, quantidade: fator,
          forma: item.unidadeMl ? item.unidadeMl.nome : 'Unidade', mlbId: m?.mlbId || null, status: m?.status || null, publicado,
          linhaAtiva: item.linhaAtiva !== false, preco, tipo, freteGratis,
          produto: { pesoKg: item.pesoKg, medidas: item.medidasCm },
          embalagem: pacote ? { ...pacote.embalagem, custo: custoEmbalagem } : null,
          pacoteErp: erp, pacoteMl: lido,
          situacaoPacote: situacaoDoPacote(lido, erp, publicado),
          frete, freteComPacote, lucro,
          lucroComEmbalagem: lucro === null ? null : r2(lucro - custoEmbalagem),
          faltas: faltasDoEnvio({ pesoKg: item.pesoKg, medidas: item.medidasCm, temEmbalagem: !!pacote, fotos: item.fotos, fotoFamilia: !!c.dados.fotoFamilia }),
        };
      }));
      linhas.push(...doAnuncio.filter(Boolean));
    }
    return res.json(linhas);
  } catch (error) {
    return responderErro(res, error, 'Erro ao montar o envio dos anúncios.');
  }
};

// POST /anuncios/:id/itens/:idLinha/pacote — manda ao anúncio publicado só o peso e as medidas do pacote do ERP
export const enviarPacote = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    const id = Number(req.params.id);
    const [c] = await carregarAnuncios(pool as any, tenant, id);
    if (!c) throw new ErroML('Anúncio não encontrado.', 404);
    const item = c.itens.find(i => i.idLinha === Number(req.params.idLinha));
    if (!item) throw new ErroML('Linha do anúncio não encontrada.', 404);
    const m = c.noMl.get(item.idLinha);
    if (!m?.mlbId || foraDoMl(m.status)) throw new ErroML('Esta forma de venda não está publicada no ML.');
    const p = item.pacoteEnvio;
    if (!p?.medidas || !p.pesoKg) throw new ErroML('Sem pacote completo no ERP: precisa da embalagem recomendada (com medidas) e do peso do produto (Catálogo › Logística em lote).');
    await ml(tenant, 'PUT', `/items/${m.mlbId}`, { attributes: atributosDoPacote(p) });
    esquecerItemNoMl(m.mlbId);
    esquecerDivergencias(tenant, id);
    return res.json({ success: true, mlbId: m.mlbId });
  } catch (error) {
    return responderErro(res, error, 'Erro ao enviar o pacote ao ML.');
  }
};
