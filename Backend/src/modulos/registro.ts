// Módulos plugáveis: cada um vive em src/modulos/<area>/<assunto>, usa tabelas modulo_<area>_<assunto>_*
// e só é alcançado por aqui. O núcleo (vendas, estoque, caixa) não importa nada de módulo.
// Para remover um módulo: tirar a pasta e a linha dele em MODULOS (as tabelas podem ficar).
import { NextFunction, Request, Response, Router } from 'express';
import pool from '../routes/Estoque/db.config';
import hidraulicaMontagensRoutes from './hidraulica/montagens/montagens.routes';

export interface ModuloRegistrado {
  codigo: string;      // padrão AREA_ASSUNTO (sistema_modulos.codigo)
  nome: string;
  area: string;
  descricao: string;
  rotaBase: string;    // montado em /api/modulos<rotaBase>
  router: Router;
}

export const MODULOS: ModuloRegistrado[] = [
  {
    codigo: 'HIDRAULICA_MONTAGENS',
    nome: 'Montagem de mangueiras',
    area: 'Hidráulica',
    descricao: 'Montagem de mangueiras hidráulicas no PDV, OS com sinal e ficha técnica para refazer igual.',
    rotaBase: '/hidraulica/montagens',
    router: hidraulicaMontagensRoutes,
  },
];

const tenantDe = (req: Request): number => Number(req.query.tenant_id || req.headers['x-tenant-id'] || req.body?.tenant_id || 1);

export const modulosAtivos = async (tenant: number): Promise<Set<string>> => {
  const [rows]: any = await pool.execute(`SELECT codigo FROM sistema_modulos WHERE tenant_id = ? AND ativo = 1`, [tenant]);
  return new Set(rows.map((r: any) => String(r.codigo)));
};

/** Bloqueia as rotas do módulo quando ele está desligado na loja. */
const exigirModulo = (codigo: string) => async (req: Request, res: Response, next: NextFunction) => {
  try {
    if ((await modulosAtivos(tenantDe(req))).has(codigo)) return next();
    return res.status(403).json({ error: 'Módulo desativado nesta loja (Configurações › Módulos).', detalhes: { codigo: 'MODULO_DESATIVADO', modulo: codigo } });
  } catch (error: any) {
    return res.status(500).json({ error: 'Erro ao verificar o módulo.', details: error?.message });
  }
};

const router = Router();

/** GET /api/sistema/modulos — módulos disponíveis e se estão ligados na loja */
router.get('/sistema/modulos', async (req: Request, res: Response) => {
  try {
    const ativos = await modulosAtivos(tenantDe(req));
    return res.json(MODULOS.map(m => ({ codigo: m.codigo, nome: m.nome, area: m.area, descricao: m.descricao, ativo: ativos.has(m.codigo) })));
  } catch (error: any) {
    return res.status(500).json({ error: 'Erro ao listar os módulos.', details: error?.message });
  }
});

/** PUT /api/sistema/modulos/:codigo { ativo } — liga/desliga (os dados do módulo ficam guardados) */
router.put('/sistema/modulos/:codigo', async (req: Request, res: Response) => {
  const codigo = String(req.params.codigo || '').toUpperCase();
  if (!MODULOS.some(m => m.codigo === codigo)) return res.status(404).json({ error: 'Módulo desconhecido.' });
  try {
    await pool.execute(
      `INSERT INTO sistema_modulos (tenant_id, codigo, ativo) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE ativo = VALUES(ativo)`,
      [tenantDe(req), codigo, req.body?.ativo ? 1 : 0]
    );
    return res.json({ success: true, codigo, ativo: Boolean(req.body?.ativo) });
  } catch (error: any) {
    return res.status(500).json({ error: 'Erro ao salvar o módulo.', details: error?.message });
  }
});

for (const m of MODULOS) router.use(`/modulos${m.rotaBase}`, exigirModulo(m.codigo), m.router);

export default router;
