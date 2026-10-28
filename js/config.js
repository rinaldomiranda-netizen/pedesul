/* Configuração do Pede Sul (plataforma de delivery da RMD).
   Aqui só entram dados PÚBLICOS. NUNCA coloque aqui senha de banco, token de WhatsApp ou chave de pagamento.

   MODO:
     'demo' -> modo demonstração: tudo fica só neste navegador (nada vai a um servidor).
               É o único modo do Pede Sul por enquanto: o banco com várias lojas ainda não foi criado na nuvem.

   LOJA: cada loja da plataforma tem um código (ex.: aterrisse, conis-burger, ohane).
   Toda tela da loja abre com ?loja=codigo; o aparelho lembra a última loja aberta. */
window.ATERRISSE_CONFIG = {
  MODO: 'demo',
  PLATAFORMA: 'Pede Sul',
  // Só a página de vendas usa o servidor: as inscrições vão para a mesma lista da RMD (promoção de lançamento).
  SUPABASE_URL: 'https://cxzzutbijljjteapowuv.supabase.co',
  SUPABASE_CHAVE_PUBLICA: 'sb_publishable_aMDO3LAivnM7dSonKxzOKg_3eLGaNwy',
  // Senha de teste que já vem preenchida ao criar acesso numa loja em teste (pedido do Rinaldo).
  // Na nuvem o Supabase exige pelo menos 6 caracteres; o servidor de teste deste computador troca para 1234.
  SENHA_TESTE: '123456'
};

(function () {
  var q = location.search;
  var m = /[?&]loja=([a-z0-9-]{2,40})/.exec(q);
  var loja = m ? m[1] : null;
  try {
    if (loja) localStorage.setItem('pedesul_loja', loja);
    else loja = localStorage.getItem('pedesul_loja');
  } catch (e) { /* sem armazenamento: usa o que veio no endereço */ }
  window.ATERRISSE_CONFIG.LOJA = loja || 'aterrisse';

  // ?demo=1: demonstração para apresentar ao cliente (sem senha, com pedidos de exemplo). ?demo=0 volta ao normal.
  try {
    if (/[?&]demo=0\b/.test(q)) sessionStorage.removeItem('pedesul_vitrine');
    else if (/[?&]demo=1\b/.test(q)) sessionStorage.setItem('pedesul_vitrine', '1');
    if (sessionStorage.getItem('pedesul_vitrine') === '1') window.ATERRISSE_CONFIG.VITRINE = true;
  } catch (e) { /* sem armazenamento: segue normal */ }
})();

// Site publicado (GitHub Pages): usa o banco da nuvem do Pede Sul (projeto beta-cloud).
window.ATERRISSE_CONFIG.MODO = 'supabase';
