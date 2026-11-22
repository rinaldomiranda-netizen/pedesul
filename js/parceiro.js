/* Pede Sul — tela do ENTREGADOR PARCEIRO da RMD (celular). 22/11/2026.
   O parceiro é um motoboy cadastrado pela RMD, de fora das lojas (conta da "loja" escondida rmd-parceiros).
   Quando "Estou trabalhando" está ligado, ele vê os chamados das lojas do plano Entrega Total: loja, endereço de retirada,
   bairro do cliente, taxa de entrega (que fica com ele) e o valor a receber. Sem nome, telefone nem endereço do cliente antes de aceitar.
   O primeiro que aceitar leva. Depois de aceitar, vê o endereço completo e o telefone, com Google Maps e Waze.
   Só funciona com o banco (site publicado): o banco confere tudo de novo e só mostra o que é dele. */
(function () {
  'use strict';
  var N = window.AterrisseNucleo;
  var cfg = Object.assign({}, window.ATERRISSE_CONFIG || {}, { LOJA: 'rmd-parceiros', VITRINE: false });
  var api = window.AterrisseBackend.criar(cfg);
  var esc = N.escaparHtml;
  function $(s) { return document.querySelector(s); }
  var st = { eu: null, chamados: [], entregas: [], timer: null, erro: null };

  function toast(msg) {
    var t = document.createElement('div');
    t.className = 'aviso-toast'; t.setAttribute('role', 'status'); t.textContent = msg;
    document.body.appendChild(t); setTimeout(function () { t.remove(); }, 2800);
  }
  function bip() {
    try {
      var ctx = new (window.AudioContext || window.webkitAudioContext)();
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = 660; o.connect(g); g.connect(ctx.destination); g.gain.value = 0.15;
      o.start(); o.stop(ctx.currentTime + 0.3);
    } catch (e) { /* sem som */ }
  }
  function nomePagamento(id) { return { pix: 'Pix', dinheiro: 'Dinheiro', cartao: 'Cartão' }[id] || id; }
  function enderecoTexto(e) { return (e.rua || '') + ', ' + (e.numero || '') + ' — ' + (e.bairro || ''); }

  function telaLogin(msg) {
    $('#btn-sair').classList.add('oculto');
    if (st.timer) { clearInterval(st.timer); st.timer = null; }
    $('#conteudo').innerHTML = '<div class="login caixa"><h2>Entrar · entregador parceiro</h2>' + (msg ? '<div class="erro-caixa">' + esc(msg) + '</div>' : '') +
      '<form id="form-login"><div class="campo"><label for="l-usuario">Usuário</label><input id="l-usuario" autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false" required maxlength="60"></div>' +
      '<div class="campo"><label for="l-senha">Senha</label><input id="l-senha" type="password" autocomplete="current-password" required></div>' +
      '<button class="btn btn-ouro btn-bloco" type="submit">Entrar</button></form>' +
      '<p style="font-size:14px;color:var(--texto-2);margin-top:14px">O usuário e a senha são criados pela RMD. Quer ser entregador parceiro? Fale com a RMD.</p></div>';
    $('#l-usuario').focus();
  }

  async function iniciar() {
    if (api.modo !== 'supabase') {
      $('#conteudo').innerHTML = '<div class="aviso-caixa">A tela do entregador parceiro funciona só com o banco (site publicado ou banco de teste deste computador).</div>';
      return;
    }
    if (!api.sessao()) return telaLogin();
    try { st.eu = await api.parceiroEu(); } catch (e) {
      if (e.codigo === 'REDE') { $('#conteudo').innerHTML = '<div class="erro-caixa">' + esc(e.message) + '</div>'; return; }
      await api.sair(); return telaLogin(e.message);
    }
    $('#quem').textContent = st.eu.nome + ' · parceiro RMD';
    $('#btn-sair').classList.remove('oculto');
    window.AterrissePrazo.aoAtrasar(function (id, numero) { bip(); toast('⚠ Entrega #' + numero + ' passou do prazo!'); });
    await carregar();
    if (st.timer) clearInterval(st.timer);
    st.timer = setInterval(carregar, 10000);
  }

  async function carregar() {
    try {
      st.eu = await api.parceiroEu();
      var chamados = await api.parceiroChamados();
      var antes = st.chamados.map(function (c) { return c.id; });
      if (chamados.some(function (c) { return antes.indexOf(c.id) < 0; })) { bip(); toast('Novo chamado de entrega!'); }
      st.chamados = chamados; st.entregas = await api.parceiroEntregas(); st.erro = null;
    } catch (e) {
      st.erro = e.message;
      if (e.codigo === 'SEM_PERMISSAO') { if (st.timer) clearInterval(st.timer); st.timer = null; await api.sair(); return telaLogin(e.message); }
    }
    render();
  }

  function cartaoChamado(c) {
    return '<article class="caixa oferta-caixa"><h3 style="margin-top:0">📣 ' + esc(c.loja) + ' · pedido #' + esc(c.numero) + (c.teste ? ' <span class="status st-TESTE">TESTE</span>' : '') + '</h3>' +
      '<div>🏪 Buscar em: <b>' + esc(c.loja_endereco || 'endereço da loja') + '</b></div>' +
      '<div style="font-size:17px;margin:4px 0">📍 Entregar no bairro <b>' + esc(c.bairro || '—') + '</b></div>' +
      '<div style="margin:6px 0">Sua taxa: <b>' + N.reais(c.taxa_entrega) + '</b> · cliente paga ' + N.reais(c.total) + ' (' + esc(nomePagamento(c.pagamento)) + ')' +
      (c.status === 'PRONTO' ? ' · <b>pronto para buscar</b>' : ' · em preparo') + '</div>' +
      '<button class="btn btn-ouro btn-bloco" style="min-height:54px;font-size:18px" type="button" data-acao="aceitar" data-id="' + esc(c.id) + '">✔ Aceitar esta entrega</button></article>';
  }

  function cartaoEntrega(p) {
    var e = p.endereco || {}, pronta = p.status === 'PRONTO', saiu = p.status === 'SAIU_PARA_ENTREGA';
    var troco = p.troco_para ? Number(p.troco_para) - Number(p.total) : 0;
    var h = '<article class="caixa" style="overflow-wrap:anywhere">' +
      '<div class="barra-acoes" style="margin:0 0 6px;justify-content:space-between"><h3 style="margin:0;font-size:20px">' + esc(p.loja) + ' · #' + esc(p.numero) + '</h3>' + window.AterrissePrazo.html(p) + '</div>' +
      '<div style="margin-bottom:8px"><span class="status st-' + p.status + '">' + N.STATUS_NOMES[p.status] + '</span>' + (p.teste ? ' <span class="status st-TESTE">TESTE</span>' : '') + '</div>' +
      '<div class="resumo-bloco">🏪 <b>Buscar:</b> ' + esc(p.loja_endereco || '') +
      (p.loja_whatsapp ? '<br><a href="' + esc(N.linkWhatsApp(p.loja_whatsapp, 'Olá! Sou o entregador parceiro do pedido nº ' + p.numero + '.')) + '" target="_blank" rel="noopener">WhatsApp da loja</a>' : '') + '</div>' +
      '<div style="font-size:17px"><b>' + esc(p.nome) + '</b></div>' +
      '<div style="font-size:17px;margin:4px 0">📍 ' + esc(enderecoTexto(e)) + '</div>' +
      (e.complemento ? '<div>' + esc(e.complemento) + '</div>' : '') + (e.referencia ? '<div><b>Referência:</b> ' + esc(e.referencia) + '</div>' : '') +
      '<div class="barra-acoes" style="margin:10px 0">' +
      '<a class="btn btn-linha" href="' + esc(N.linkMapa(e)) + '" target="_blank" rel="noopener">🗺️ Google Maps</a>' +
      '<a class="btn btn-linha" href="' + esc(N.linkWaze(e)) + '" target="_blank" rel="noopener">🚗 Waze</a>' +
      (p.telefone ? '<a class="btn btn-linha" href="tel:+' + esc(N.normalizarTelefone(p.telefone)) + '">📞 Ligar</a>' : '') + '</div>' +
      (p.observacoes ? '<div style="color:var(--aviso)">Obs.: ' + esc(p.observacoes) + '</div>' : '') +
      '<div class="resumo-bloco" style="font-size:17px">Receber do cliente: <b>' + N.reais(p.total) + '</b> · ' + esc(nomePagamento(p.pagamento)) +
      (troco > 0 ? '<br>Levar troco: <b>' + N.reais(troco) + '</b> (para ' + N.reais(p.troco_para) + ')' : '') +
      '<br><small>Sua taxa de entrega: ' + N.reais(p.taxa_entrega) + '</small>' + htmlPagamento(p) + '</div>';
    if (pronta) h += '<button class="btn btn-ouro btn-bloco" style="min-height:58px;font-size:18px" type="button" data-acao="status" data-id="' + esc(p.id) + '" data-para="SAIU_PARA_ENTREGA" data-numero="' + esc(p.numero) + '">🛵 Peguei e saí para entrega</button>';
    else if (saiu) h += '<button class="btn btn-ouro btn-bloco" style="min-height:58px;font-size:18px" type="button" data-acao="status" data-id="' + esc(p.id) + '" data-para="ENTREGUE" data-numero="' + esc(p.numero) + '">📦 Entregue</button>';
    else h += '<div class="aviso-caixa" style="margin-bottom:0">Ainda em preparo na loja. Pode ir indo buscar; o botão aparece quando ficar “Pronto”.</div>';
    return h + '</article>';
  }

  function htmlPagamento(p) {
    if (p.pagamento_status === 'CONFIRMADO') return '<div class="ok-caixa" style="margin:8px 0 0">✔ Pagamento recebido' + (p.pago_como ? ' (' + esc(nomePagamento(p.pago_como)) + ')' : '') + '</div>';
    if (p.pagamento_status === 'CANCELADO' || p.status !== 'SAIU_PARA_ENTREGA') return '';
    return '<div style="margin-top:10px;font-size:14px;font-weight:800">Recebi o pagamento em:</div><div class="barra-acoes" style="margin:6px 0 0">' +
      [['dinheiro', '💵 Dinheiro'], ['cartao', '💳 Cartão'], ['pix', '📱 Pix']].map(function (f) {
        return '<button class="btn btn-linha" style="flex:1;min-width:90px" type="button" data-acao="pago" data-id="' + esc(p.id) + '" data-forma="' + f[0] + '" data-numero="' + esc(p.numero) + '">' + f[1] + '</button>';
      }).join('') + '</div>';
  }

  function render() {
    var on = !!(st.eu && st.eu.online);
    var h = '<div class="caixa trabalho ' + (on ? 'ligado' : '') + '"><div><b>' + (on ? '🟢 Trabalhando' : '⚪ Parado') + '</b><br><small>' +
      (on ? 'Você recebe os chamados das lojas.' : 'Ligue para receber chamados de entrega.') + '</small></div>' +
      '<button class="btn ' + (on ? 'btn-linha' : 'btn-ouro') + '" type="button" data-acao="trabalho">' + (on ? 'Parar' : 'Estou trabalhando') + '</button></div>';
    if (st.erro) h += '<div class="erro-caixa" role="alert">Falha de comunicação: ' + esc(st.erro) + '</div>';
    if (st.entregas.length) h += '<h2>Minhas entregas</h2><div class="lista-entregas">' + st.entregas.map(cartaoEntrega).join('') + '</div>';
    if (on) h += '<h2>Chamados</h2>' + (st.chamados.length ? st.chamados.map(cartaoChamado).join('') : '<div class="vazio">Nenhum chamado agora.<br><small>A lista atualiza sozinha a cada 10 segundos.</small></div>');
    else if (!st.entregas.length) h += '<div class="vazio">Toque em “Estou trabalhando” para ver os chamados.</div>';
    h += '<p style="font-size:13px;color:var(--texto-2);text-align:center">Corridas neste mês: <b>' + ((st.eu && st.eu.corridas_mes) || 0) + '</b></p>';
    $('#conteudo').innerHTML = h;
  }

  document.addEventListener('click', async function (ev) {
    var el = ev.target.closest('[data-acao]');
    if (!el) return;
    var a = el.dataset.acao;
    if (a === 'sair') {
      if (st.eu && st.eu.online) { try { await api.parceiroOnline(false); } catch (e) { /* segue */ } }
      if (st.timer) clearInterval(st.timer); st.timer = null; st.eu = null; await api.sair(); telaLogin(); return;
    }
    if (a === 'trabalho') {
      try { await api.parceiroOnline(!st.eu.online); toast(st.eu.online ? 'Você parou. Não recebe chamados.' : 'Bom trabalho! Os chamados aparecem aqui.'); } catch (e) { alert(e.message); }
      carregar(); return;
    }
    if (a === 'aceitar') {
      el.disabled = true;
      try { await api.parceiroAceitar(el.dataset.id); toast('Entrega aceita. Vá buscar na loja.'); } catch (e) { alert(e.message); }
      carregar(); return;
    }
    if (a === 'pago') {
      if (!confirm('Confirmar que recebeu o pagamento da entrega #' + el.dataset.numero + ' em ' + nomePagamento(el.dataset.forma) + '?')) return;
      el.disabled = true;
      try { await api.parceiroPagamento(el.dataset.id, el.dataset.forma); toast('Pagamento registrado ✔'); } catch (e) { alert(e.message); }
      carregar(); return;
    }
    if (a === 'status') {
      var p = st.entregas.filter(function (x) { return x.id === el.dataset.id; })[0];
      var txt = el.dataset.para === 'ENTREGUE' ? 'Confirmar que a entrega #' + el.dataset.numero + ' foi feita?' : 'Confirmar que pegou o pedido #' + el.dataset.numero + ' e saiu para entrega?';
      if (el.dataset.para === 'ENTREGUE' && p && p.pagamento_status === 'PENDENTE') txt = 'O pagamento da entrega #' + el.dataset.numero + ' ainda NÃO foi marcado como recebido. Marcar como entregue mesmo assim?';
      if (!confirm(txt)) return;
      el.disabled = true;
      try { await api.parceiroStatus(el.dataset.id, el.dataset.para); toast(el.dataset.para === 'ENTREGUE' ? 'Entrega concluída ✔' : 'Boa entrega! 🛵'); } catch (e) { alert(e.message); }
      carregar();
    }
  });

  document.addEventListener('submit', async function (ev) {
    ev.preventDefault();
    if (ev.target.id === 'form-login') {
      try { await api.entrar($('#l-usuario').value.trim(), $('#l-senha').value); iniciar(); } catch (e) { telaLogin(e.message); }
    }
  });

  iniciar();
})();
