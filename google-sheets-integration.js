/**
 * ==========================================================================
 * GUIA DE INTEGRAÇÃO: Aero Market 24h & Google Planilhas (Sheets)
 * ==========================================================================
 * 
 * Este arquivo contém o código pronto do Google Apps Script e o passo a passo
 * em português para salvar as respostas da pesquisa diretamente em uma
 * planilha do Google em tempo real, de forma 100% gratuita.
 * 
 * ==========================================================================
 * PASSO A PASSO PARA CONFIGURAR:
 * ==========================================================================
 * 
 * 1. CRIE UMA NOVA PLANILHA NO GOOGLE:
 *    Acesse seu Google Drive (drive.google.com) ou acesse direto sheets.new 
 *    e crie uma nova planilha em branco. Nomeie-a como quiser (Ex: "Aero Market 24h - Pesquisa").
 * 
 * 2. ABRA O EDITOR DE APPS SCRIPT:
 *    No menu superior da sua planilha, clique em:
 *    -> Extensões (Extensions)
 *    -> Apps Script
 * 
 * 3. COLE O CÓDIGO DO APPS SCRIPT:
 *    Apague todo o código que vier no editor padrão e cole integralmente o 
 *    código contido na seção "CÓDIGO PARA COPIAR E COLAR" abaixo.
 * 
 * 4. SALVE O SCRIPT:
 *    Clique no ícone de disquete (Salvar projeto) no topo do editor.
 * 
 * 5. FAÇA A PUBLICAÇÃO (DEPLOY) COMO WEB APP:
 *    - Clique no botão azul "Implantar" (Deploy) no canto superior direito.
 *    - Selecione "Nova implantação" (New deployment).
 *    - Clique no ícone de engrenagem ao lado de "Selecionar tipo" e escolha "App da Web" (Web app).
 *    - Preencha as configurações:
 *      * Descrição: Conexão Pesquisa Aero Market
 *      * Executar como (Execute as): "Eu" (Seu e-mail)
 *      * Quem tem acesso (Who has access): "Qualquer pessoa" (Anyone) -> [IMPORTANTE: Escolha esta opção para permitir que as respostas enviadas do formulário entrem na planilha!]
 *    - Clique no botão azul "Implantar" (Deploy).
 * 
 * 6. AUTORIZE AS PERMISSÕES:
 *    O Google pedirá que você autorize o script a acessar a planilha.
 *    - Clique em "Autorizar acesso".
 *    - Escolha sua conta do Google.
 *    - Se aparecer uma tela de aviso do Google dizendo que o app não foi verificado, clique no link pequeno "Avançado" (Advanced) no canto inferior esquerdo e depois em "Acessar... (não seguro)" no final do texto. Isso é apenas um alerta de segurança do Google para scripts próprios criados por você.
 *    - Clique em "Permitir" (Allow).
 * 
 * 7. COPIE A URL DO WEB APP:
 *    Ao final do processo de implantação, o Google fornecerá a "URL do app da Web".
 *    - Clique no botão "Copiar" ao lado dessa URL.
 * 
 * 8. COLE NO SEU PAINEL ADMIN:
 *    - Abra o Aero Market Forms no seu navegador.
 *    - Clique no ícone de engrenagem no canto superior direito.
 *    - Digite a senha administrativa padrão: 2424
 *    - Expanda a seção "Integração com o Google Planilhas" no topo do painel.
 *    - Cole a URL copiada no campo de texto e clique em "Salvar URL".
 *    - Clique em "Testar Conexão". Uma resposta de teste será injetada automaticamente na sua planilha em segundos!
 * 
 */

/* ==========================================================================
   CÓDIGO DO GOOGLE APPS SCRIPT PARA COPIAR E COLAR (Code.gs)
   ========================================================================== */

/* Copie a partir da linha abaixo: */

/**
 * Retorna todas as respostas cadastradas na planilha em formato JSON (HTTP GET).
 * Usado pelo Painel Admin para exibir as estatísticas consolidadas de todos os moradores.
 */
function doGet(e) {
  try {
    const spreadSheet = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = spreadSheet.getSheetByName("Respostas");
    
    if (!sheet || sheet.getLastRow() <= 1) {
      return ContentService.createTextOutput(
        JSON.stringify([])
      ).setMimeType(ContentService.MimeType.JSON);
    }
    
    const dataRange = sheet.getDataRange();
    const values = dataRange.getValues();
    const headers = values[0];
    const jsonArray = [];
    
    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      const data = {};
      
      data.id = row[0];
      data.timestamp = row[1]; 
      data.q1_store = row[2];
      data.q2_freq = row[3];
      data.q3_sectors = row[4] ? String(row[4]).split("; ") : [];
      data.q4_lack = row[5];
      data.q5_aspect_variety = row[6] !== "" ? Number(row[6]) : "";
      data.q5_aspect_price = row[7] !== "" ? Number(row[7]) : "";
      data.q5_aspect_organization = row[8] !== "" ? Number(row[8]) : "";
      data.q5_aspect_supply = row[9] !== "" ? Number(row[9]) : "";
      data.q6_see_more = row[10] ? String(row[10]).split("; ") : [];
      data.q7_hour = row[11];
      data.q8_favorites = row[12] ? String(row[12]).split("; ") : [];
      data.q8_favorites_other = row[13];
      data.q9_external = row[14];
      data.q10_wine_type = row[15];
      data.q11_wine_price = row[16];
      data.q12_promo_interest = row[17];
      data.q13_promo_type = row[18] ? String(row[18]).split("; ") : [];
      data.q14_convenient = row[19];
      data.q15_rating = row[20] !== "" ? Number(row[20]) : "";
      data.q16_nps_recommend = row[21];
      data.q12_influence_factor = row[22];
      data.q18_feedback = row[23];
      
      jsonArray.push(data);
    }
    
    return ContentService.createTextOutput(
      JSON.stringify(jsonArray)
    ).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    return ContentService.createTextOutput(
      JSON.stringify({ status: "error", message: error.message })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Recebe as requisições HTTP POST do formulário e insere na planilha em tempo real.
 */
function doPost(e) {
  try {
    // 1. Obtém a planilha ativa e a aba "Respostas"
    const spreadSheet = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = spreadSheet.getSheetByName("Respostas");
    
    // Se a aba "Respostas" não existir, cria uma automaticamente
    if (!sheet) {
      sheet = spreadSheet.insertSheet("Respostas");
    }
    
    // 2. Analisa os dados recebidos (JSON)
    const data = JSON.parse(e.postData.contents);
    
    // 3. Define os cabeçalhos das colunas (se a planilha estiver vazia)
    if (sheet.getLastRow() === 0) {
      const headers = [
        "ID da Resposta", 
        "Data e Hora", 
        "Loja",
        "Frequência de Visita", 
        "Setores Mais Utilizados", 
        "O que mais sente falta", 
        "Avaliação - Variedade", 
        "Avaliação - Preço", 
        "Avaliação - Organização", 
        "Avaliação - Abastecimento", 
        "Deseja ver mais de", 
        "Horário que mais compra", 
        "Produtos Favoritos", 
        "Produtos Favoritos (Outros)",
        "Compra fora do condomínio", 
        "Tipo de Vinho mais consumido", 
        "Preço médio do Vinho", 
        "Compraria com Promoções", 
        "Promoções que chamam atenção", 
        "Conveniente para saídas rápidas", 
        "Nota do Minimercado (0-10)", 
        "Indicaria para outros condomínios", 
        "O que mais influencia a escolha", 
        "Sugestões Livres de Melhoria"
      ];
      sheet.appendRow(headers);
      
      // Estilização bonita do cabeçalho da planilha
      const headerRange = sheet.getRange(1, 1, 1, headers.length);
      headerRange.setBackground("#3f51b5") // Azul escuro moderno
                 .setFontColor("#ffffff")
                 .setFontWeight("bold")
                 .setHorizontalAlignment("center");
      sheet.setFrozenRows(1); // Congela a primeira linha
    }
    
    // 4. Formata a data recebida no padrão brasileiro
    let formattedDate = "";
    try {
      const timestamp = new Date(data.timestamp);
      // Converte para fuso horário de Brasília (-3) de forma legível
      formattedDate = Utilities.formatDate(timestamp, "America/Sao_Paulo", "dd/MM/yyyy HH:mm:ss");
    } catch(err) {
      formattedDate = new Date().toLocaleString();
    }
    
    // 5. Prepara a linha com as respostas mapeadas
    const row = [
      data.id || "",
      formattedDate,
      data.q1_store || "",
      data.q2_freq || "",
      Array.isArray(data.q3_sectors) ? data.q3_sectors.join("; ") : (data.q3_sectors || ""),
      data.q4_lack || "",
      data.q5_aspect_variety !== undefined ? data.q5_aspect_variety : "",
      data.q5_aspect_price !== undefined ? data.q5_aspect_price : "",
      data.q5_aspect_organization !== undefined ? data.q5_aspect_organization : "",
      data.q5_aspect_supply !== undefined ? data.q5_aspect_supply : "",
      Array.isArray(data.q6_see_more) ? data.q6_see_more.join("; ") : (data.q6_see_more || ""),
      data.q7_hour || "",
      Array.isArray(data.q8_favorites) ? data.q8_favorites.join("; ") : (data.q8_favorites || ""),
      data.q8_favorites_other || "",
      data.q9_external || "",
      data.q10_wine_type || "",
      data.q11_wine_price || "",
      data.q12_promo_interest || "",
      Array.isArray(data.q13_promo_type) ? data.q13_promo_type.join("; ") : (data.q13_promo_type || ""),
      data.q14_convenient || "",
      data.q15_rating !== undefined ? data.q15_rating : "",
      data.q16_nps_recommend || "",
      data.q12_influence_factor || "",
      data.q18_feedback || ""
    ];
    
    // 6. Insere os dados como uma nova linha no final da planilha
    sheet.appendRow(row);
    
    // Auto-ajusta a largura das colunas para manter tudo organizado
    sheet.autoResizeColumns(1, row.length);
    
    // 7. Retorna uma mensagem de sucesso para a requisição
    return ContentService.createTextOutput(
      JSON.stringify({ status: "success", message: "Resposta adicionada na linha " + sheet.getLastRow() })
    ).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    // Retorna erro caso ocorra qualquer falha no processamento
    return ContentService.createTextOutput(
      JSON.stringify({ status: "error", message: error.message })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}
