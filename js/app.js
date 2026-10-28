/* Comum a todas as páginas do Mini Delivery Aterrisse:
   - permite instalar como aplicativo (PWA). O navegador só libera isso em https ou em localhost;
   - envia erros técnicos da tela para o desenvolvedor RMD (sem dados de clientes; o servidor ainda limpa e-mails e números). */
(function () {
  'use strict';
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    navigator.serviceWorker.register('sw.js').catch(function () { /* sem app instalável, o site funciona igual */ });
  }

  if (!window.AterrisseBackend) return;
  var api = window.AterrisseBackend.criar(window.ATERRISSE_CONFIG);
  // ATERRISSE_PAGINA: nas pastas demo-*/ o endereço termina em "/", então a página diz quem ela é
  var pagina = (window.ATERRISSE_PAGINA || location.pathname.split('/').pop() || 'index.html').slice(0, 60);

  // Pastas demo-*/ usam <base href="../">: links "#..." seguiriam a base e sairiam do app; aqui ficam na própria página.
  if (window.ATERRISSE_APP_DEMO) {
    document.addEventListener('click', function (ev) {
      var a = ev.target.closest && ev.target.closest('a[href^="#"]');
      if (!a) return;
      ev.preventDefault();
      location.hash = a.getAttribute('href');
    });
  }

  // ---- vitrine de demonstração (?demo=1): só um aviso "DEMONSTRAÇÃO"; cada tela mostra só a sua função, igual ao real.
  //      "Recomeçar" fica só no painel da loja. Ícone "DEMO" instalável.
  if (window.ATERRISSE_CONFIG && window.ATERRISSE_CONFIG.VITRINE) {
    var tela = /painel/.test(pagina) ? 'painel' : /entregador/.test(pagina) ? 'entregador' : /cozinha/.test(pagina) ? 'cozinha' : 'cardapio';
    var link = document.querySelector('link[rel="manifest"]');
    // nas pastas demo-*/ (um app separado por tela) o manifesto já é o da pasta
    if (link && !window.ATERRISSE_APP_DEMO) link.setAttribute('href', 'manifest-demo-' + tela + '.webmanifest');
    var barra = document.createElement('div');
    barra.className = 'barra-vitrine';
    barra.setAttribute('role', 'navigation');
    barra.setAttribute('aria-label', 'Demonstração');
    barra.innerHTML = '<span class="vitrine-titulo">🎬 DEMONSTRAÇÃO · ' + (tela === 'cardapio' ? 'use nomes e endereços de exemplo' : 'dados de exemplo') + '</span>' +
      (tela === 'painel' ? '<span class="vitrine-botoes"><button class="btn btn-linha btn-peq" type="button" id="vitrine-recomecar">↺ Recomeçar demonstração</button></span>' : '');
    document.body.insertBefore(barra, document.body.firstChild);
    if (tela === 'painel') document.getElementById('vitrine-recomecar').addEventListener('click', function () {
      if (!confirm('Recomeçar a demonstração com os pedidos de exemplo do início?')) return;
      Promise.resolve(api.recomecarVitrine ? api.recomecarVitrine() : null).then(function () { location.reload(); }, function (e) { alert(e.message || 'Não foi possível recomeçar.'); });
    });
  }
  var enviados = {}, total = 0;

  function enviar(mensagem, detalhe) {
    mensagem = String(mensagem || '').slice(0, 300);
    if (!mensagem || enviados[mensagem] || total >= 10) return; // no máximo 10 por visita, sem repetir
    enviados[mensagem] = true; total++;
    try { api.registrarErro(pagina, mensagem, String(detalhe || '').slice(0, 1000)).catch(function () { /* sem rede: deixa para lá */ }); } catch (e) { /* idem */ }
  }

  window.addEventListener('error', function (ev) {
    if (!ev.message) return;
    enviar(ev.message, (ev.filename || '').split('/').pop() + ':' + ev.lineno + ':' + ev.colno);
  });
  window.addEventListener('unhandledrejection', function (ev) {
    var r = ev.reason || {};
    if (r.codigo && r.codigo !== 'ERRO') return; // recusas normais do servidor (validação, permissão) não são erro do sistema
    enviar('Promessa recusada: ' + (r.message || r), r.stack ? String(r.stack).split('\n').slice(0, 3).join(' | ') : '');
  });
  window.AterrisseErros = { enviar: enviar };
})();
