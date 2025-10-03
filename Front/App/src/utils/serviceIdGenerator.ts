// NOVO: Função simples para gerar o ID de Contrato
const generateSimpleTestId = (titulo: string, endereco: string, dataInicio: string): string => {
    
    // 1. Tipo de Serviço (Primeira palavra do título)
    const tipoServico = titulo.split(' ')[0].toUpperCase().substring(0, 4); // Ex: 'PERF' de 'Perfuração'

    // 2. Data (DDMMYY)
    const dataObj = dataInicio ? new Date(dataInicio + 'T00:00:00') : new Date();
    const dia = dataObj.getDate().toString().padStart(2, '0');
    const mes = (dataObj.getMonth() + 1).toString().padStart(2, '0');
    const ano = dataObj.getFullYear().toString().slice(-2);
    const dataFormatada = `${dia}${mes}${ano}`;

    // 3. Sequencial de Teste (Mockado)
    // Usaremos um valor fixo ou baseado no timestamp para simular o sequencial para o teste
    const sequencialTeste = Math.floor(Math.random() * 900 + 100); // Número aleatório de 3 dígitos
    
    // 4. Cidade Abreviada
    // Tenta encontrar uma cidade/sigla no final do endereço
    const cidadeMatch = endereco.match(/,\s*([^,]+?)(?:\s*-\s*[A-Z]{2})?\s*$/i);
    let cidadeAbreviada = 'BR';
    
    if (cidadeMatch && cidadeMatch[1]) {
        const cidade = cidadeMatch[1].trim().toUpperCase().split(' ')[0];
        cidadeAbreviada = cidade.substring(0, 3);
    }
    
    // Formato: TIPO-SEQUENCIAL-DDMMYY-CID
    return `${tipoServico}-${sequencialTeste}-${dataFormatada}-${cidadeAbreviada}`;
};