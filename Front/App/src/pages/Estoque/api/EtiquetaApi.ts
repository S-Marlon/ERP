// EtiquetaApi.ts
const apiBase = (import.meta as any).env?.VITE_API_BASE || 'http://localhost:3001/api';

const normalizeProduct = (raw: any) => {
    const id = Number(raw?.id ?? raw?.id_item ?? raw?.id_produto ?? 0);
    const name = raw?.name ?? raw?.nome_item ?? raw?.descricao ?? 'Produto sem nome';
    const sku = raw?.sku ?? raw?.codigo_interno ?? '';
    const barcode = raw?.barcode ?? raw?.codigo_barras ?? raw?.gtin ?? '';
    const category = raw?.category ?? raw?.categoria ?? raw?.nome_categoria ?? '';
    const unitOfMeasure = raw?.unitOfMeasure ?? raw?.unidade ?? raw?.sigla ?? '';
    const salePrice = Number(raw?.salePrice ?? raw?.preco_venda ?? raw?.precoVenda ?? 0);
    const currentStock = Number(raw?.currentStock ?? raw?.estoque ?? raw?.quantidade ?? 0);
    const minStock = Number(raw?.minStock ?? raw?.estoque_minimo ?? 0);
    const status = raw?.status ?? 'ATIVO';
    const pictureUrl = raw?.pictureUrl ?? raw?.imagem_url ?? null;

    return {
        id,
        sku,
        barcode,
        name,
        category,
        unitOfMeasure,
        salePrice,
        currentStock,
        minStock,
        status,
        pictureUrl,
    };
};

export async function listProducts(tenantId = 1) {
    const res = await fetch(`${apiBase}/catalogo/produtos?tenant_id=${tenantId}`);

    if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || 'Erro ao listar produtos');
    }

    const payload = await res.json();
    const rows = Array.isArray(payload) ? payload : payload?.value ?? payload?.data ?? [];
    return rows.map(normalizeProduct);
}

export async function searchProducts(query: string, tenantId = 1) {
    if (!query) return listProducts(tenantId);

    const res = await fetch(`${apiBase}/catalogo/produtos/search?tenant_id=${tenantId}&term=${encodeURIComponent(query)}`);

    if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || 'Erro ao buscar produtos');
    }

    const payload = await res.json();
    const rows = Array.isArray(payload) ? payload : payload?.data ?? [];
    return rows.map(normalizeProduct);
}