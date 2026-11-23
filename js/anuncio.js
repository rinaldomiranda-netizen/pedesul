/* Proposta de propaganda para o PARCEIRO (pedido do Rinaldo, 22/11/2026).
   A dona da loja manda pelo WhatsApp o link anuncio.html?loja=..&a=ID&c=CODIGO. O parceiro vê o que vai aparecer no
   cardápio, os dias e o valor, e toca "Aceito" (a propaganda entra no ar sozinha nas datas) ou "Não aceito".
   Só quem tem o código vê a proposta; o pagamento é combinado direto com a loja (o site não cobra nada). */
(function () {
  'use strict';
  var N = window.AterrisseNucleo;
  var api = window.AterrisseBackend.criar(window.ATERRISSE_CONFIG);
  var q = new URLSearchParams(location.search), id = q.get('a') || '', codigo = q.get('c') || '';
  var $ = function (s) { return document.querySelector(s); };
  function esc(t) { return String(t === null || t === undefined ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function dataBr(iso) { return iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : ''; }
  function seguro(url) { return /^(https:\/\/|assets\/|data:image\/(png|jpeg|webp);base64,)/.test(url || '') ? url : ''; }

  function tela(d, aviso) {
    var l = d.loja || {}, a = d.anuncio || {}, cor = /^#[0-9a-fA-F]{6}$/.test(a.cor || '') ? a.cor : '#5b3a8f', img = seguro(a.imagem_url);
    document.title = 'Proposta de propaganda | ' + (l.nome || 'loja');
    var h = '<div class="prop-loja">' + (seguro(l.logo_url) ? '<img src="' + esc(seguro(l.logo_url)) + '" alt="">' : '') +
      '<div><small style="color:var(--texto-2)">Proposta de propaganda no cardápio da</small><h1 style="margin:0;font-size:22px">' + esc(l.nome) + '</h1></div></div>';
    h += '<p style="margin:0 0 8px">' + (a.anunciante ? 'Olá, <b>' + esc(a.anunciante) + '</b>! ' : '') + 'Assim a sua propaganda vai aparecer na faixa do cardápio:</p>';
    h += '<div class="prop-arte" style="background-color:' + esc(cor) + (img ? ';background-image:linear-gradient(transparent,rgba(0,0,0,.55)),url(\'' + esc(img) + '\')' : '') + '">' +
      '<b>' + esc(a.titulo) + '</b>' + (a.texto ? '<span>' + esc(a.texto) + '</span>' : '') + '</div>';
    h += '<div class="caixa" style="margin-top:14px">' +
      (a.inicio || a.fim ? '<div>📅 <b>' + (a.dias ? esc(a.dias) + ' dia(s)' : 'Período') + '</b>' + (a.inicio ? ': de ' + esc(dataBr(a.inicio)) : '') + (a.fim ? ' a ' + esc(dataBr(a.fim)) : '') + '</div>' : '') +
      (Number(a.valor) > 0 ? '<div class="prop-valor">' + esc(N.reais(Number(a.valor))) + '</div><small style="color:var(--texto-2)">Pagamento combinado direto com a loja.</small>' : '') + '</div>';
    if (aviso) h += '<div class="aviso-caixa" role="status">' + aviso + '</div>';
    if (a.situacao === 'proposta') {
      h += '<div class="prop-botoes"><button class="btn btn-ouro" type="button" data-resp="1">✅ Aceito</button><button class="btn btn-linha" type="button" data-resp="0">Não aceito</button></div>';
    } else if (a.situacao === 'aceita') {
      h += '<div class="aviso-caixa" role="status">✅ Proposta aceita. A propaganda aparece no cardápio nas datas combinadas. Obrigado pela parceria!</div>';
    } else {
      h += '<div class="aviso-caixa" role="status">Esta proposta não foi aceita. Se mudar de ideia, fale com a loja.</div>';
    }
    if (l.whatsapp) h += '<p style="margin-top:16px"><a class="btn btn-linha" href="https://wa.me/' + esc(String(l.whatsapp).replace(/\D/g, '')) + '" target="_blank" rel="noopener">Falar com a loja no WhatsApp</a></p>';
    $('#conteudo').innerHTML = h;
  }

  var dados = null;
  async function carregar(aviso) {
    if (!id || !codigo) { $('#conteudo').innerHTML = '<div class="erro-caixa">Link incompleto. Peça o link de novo à loja.</div>'; return; }
    try { dados = await api.verProposta(id, codigo); tela(dados, aviso); }
    catch (e) { $('#conteudo').innerHTML = '<div class="erro-caixa">' + esc(e.message || 'Não foi possível abrir a proposta.') + '</div>'; }
  }
  document.addEventListener('click', async function (ev) {
    var b = ev.target.closest('[data-resp]');
    if (!b) return;
    var aceita = b.dataset.resp === '1';
    if (!aceita && !confirm('Recusar esta proposta?')) return;
    document.querySelectorAll('[data-resp]').forEach(function (x) { x.disabled = true; });
    try { await api.responderProposta(id, codigo, aceita); await carregar(aceita ? 'Pronto! A loja já foi avisada no painel.' : 'Resposta enviada à loja.'); }
    catch (e) { alert(e.message || 'Não foi possível responder agora. Tente de novo.'); await carregar(); }
  });
  carregar();
})();
