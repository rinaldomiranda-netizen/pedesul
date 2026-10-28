/* Pede Sul — tela individual do entregador (celular). Copiada do Aterrisse; do CONIS vieram:
   "Estou trabalhando" (online), a oferta de entrega (aceitar / recusar, passa ao próximo), Waze e ocorrência de entrega.
   Mostra só as entregas dele. Sem rastreamento: os botões de mapa só levam o endereço ao Google Maps ou ao Waze.
   Modo demonstração: o celular escolhe "quem sou eu" na lista de entregadores da loja (não há login).
   Com o banco: o entregador entra com o usuário e a senha que o dono criou; o banco só mostra o que é dele. */
(function () {
  'use strict';
  var N = window.AterrisseNucleo;
  var api = window.AterrisseBackend.criar(window.ATERRISSE_CONFIG);
  var esc = N.escaparHtml;
  var LOJA = (window.ATERRISSE_CONFIG && window.ATERRISSE_CONFIG.LOJA) || 'aterrisse';
  var CHAVE_EU = 'pedesul_entregador_' + LOJA;
  var OCORRENCIAS = window.AterrisseBackend.OCORRENCIAS || {};
  function $(s) { return document.querySelector(s); }
  var st = { eu: null, entregas: [], ofertas: [], timer: null, erro: null, loja: null, pixAberto: {}, ocorrencia: null };

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
  function lerEu() { try { return localStorage.getItem(CHAVE_EU); } catch (e) { return null; } }
  function gravarEu(id) { try { if (id) localStorage.setItem(CHAVE_EU, id); else localStorage.removeItem(CHAVE_EU); } catch (e) { /* sem armazenamento */ } }

  // Demonstração: escolher quem é o entregador deste celular.
  async function telaQuemSou() {
    $('#btn-sair').classList.add('oculto');
    if (st.timer) { clearInterval(st.timer); st.timer = null; }
    var lista = [];
    try { lista = (await api.entregadoresDaLoja()).filter(function (e) { return e.ativo !== false; }); } catch (e) { /* segue vazio */ }
    var h = '<div class="login caixa"><h2>Quem é você?</h2>' +
      '<div class="aviso-caixa">Modo demonstração: cada celular escolhe o entregador. No sistema real, cada um entra com usuário e senha.</div>';
    h += lista.length ? '<div class="opcoes-radio">' + lista.map(function (e) {
      return '<button class="btn btn-linha btn-bloco" type="button" data-acao="sou" data-id="' + esc(e.id) + '">🛵 ' + esc(e.nome) + '</button>';
    }).join('') + '</div>' : '<p>Nenhum entregador cadastrado nesta loja. O dono cadastra em Painel → Equipe.</p>';
    $('#conteudo').innerHTML = h + '</div>';
  }

  var COM_LOGIN = api.modo === 'supabase';
  // Senha: loja em teste aceita a provisória simples (ex.: 1234); loja vendendo de verdade pede senha forte.
  function erroSenha(senha, real) {
    var s = String(senha || '');
    if (!real) return s.length < 4 ? 'A senha precisa ter pelo menos 4 caracteres.' : null;
    return s.length < 8 || !/[0-9]/.test(s) || !/[a-zA-Z]/.test(s) ? 'A senha precisa ter pelo menos 8 caracteres, com letras e números.' : null;
  }
  // Loja vendendo de verdade e a pessoa ainda com a senha provisória: cria a senha definitiva (o banco não libera nada antes).
  function telaNovaSenha(msg) {
    $('#conteudo').innerHTML = '<div class="login caixa"><h2>Crie a sua senha definitiva</h2>' +
      '<p>A loja já está funcionando de verdade. Troque a senha provisória por uma só sua: pelo menos 8 caracteres, com letras e números.</p>' +
      (msg ? '<div class="erro-caixa">' + esc(msg) + '</div>' : '') +
      '<form id="form-nova-senha"><div class="campo"><label for="ns-1">Nova senha</label><input id="ns-1" type="password" required minlength="8" maxlength="72" autocomplete="new-password"></div>' +
      '<div class="campo"><label for="ns-2">Repita a nova senha</label><input id="ns-2" type="password" required minlength="8" maxlength="72" autocomplete="new-password"></div>' +
      '<button class="btn btn-ouro btn-bloco" type="submit">Salvar e entrar</button></form></div>';
    $('#ns-1').focus();
  }
  async function salvarNovaSenha() {
    var a = $('#ns-1').value, b = $('#ns-2').value, e = erroSenha(a, true);
    if (e) return telaNovaSenha(e);
    if (a !== b) return telaNovaSenha('As senhas não são iguais.');
    try { await api.criarMinhaSenha(a); toast('Senha definitiva salva.'); iniciar(); } catch (er) { telaNovaSenha(er.message); }
  }

  function telaLogin(msg) {
    $('#btn-sair').classList.add('oculto');
    if (st.timer) { clearInterval(st.timer); st.timer = null; }
    $('#conteudo').innerHTML = '<div class="login caixa"><h2>Entrar · entregador</h2>' + (msg ? '<div class="erro-caixa">' + esc(msg) + '</div>' : '') +
      '<form id="form-login"><div class="campo"><label for="l-usuario">Usuário</label><input id="l-usuario" autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false" required maxlength="60"></div>' +
      '<div class="campo"><label for="l-senha">Senha</label><input id="l-senha" type="password" autocomplete="current-password" required></div>' +
      '<button class="btn btn-ouro btn-bloco" type="submit">Entrar</button></form>' +
      '<p style="font-size:14px;color:var(--texto-2);margin-top:14px">O usuário e a senha são criados pelo dono da loja (Painel → Equipe, papel “Entregador”).</p></div>';
    $('#l-usuario').focus();
  }

  async function iniciar() {
    try { st.loja = (await api.cardapio()).loja; } catch (e) { /* sem a loja: o QR do Pix não aparece */ }
    if (st.loja) $('#quem').textContent = st.loja.nome;
    if (COM_LOGIN) {
      if (!api.sessao()) return telaLogin();
      try { st.eu = await api.entregadorEu(); } catch (e) {
        if (e.codigo === 'REDE') { $('#conteudo').innerHTML = '<div class="erro-caixa">' + esc(e.message) + '</div>'; return; }
        if (e.codigo === 'TROCAR_SENHA') { $('#btn-sair').textContent = 'Sair'; $('#btn-sair').classList.remove('oculto'); return telaNovaSenha(); }
        await api.sair(); return telaLogin(e.message);
      }
      return comecar();
    }
    var lista = [];
    try { lista = await api.entregadoresDaLoja(); } catch (e) { /* segue */ }
    var eu = lerEu() || (api.vitrine && lista[0] ? lista[0].id : null);
    st.eu = lista.filter(function (e) { return e.id === eu; })[0] || null;
    if (!st.eu) return telaQuemSou();
    return comecar();
  }

  async function comecar() {
    $('#quem').textContent = st.eu.nome + (st.loja ? ' · ' + st.loja.nome : '');
    $('#btn-sair').textContent = COM_LOGIN ? 'Sair' : 'Trocar'; $('#btn-sair').classList.remove('oculto');
    window.AterrissePrazo.aoAtrasar(function (id, numero) { bip(); toast('⚠ Entrega #' + numero + ' passou do prazo!'); });
    await carregar();
    if (st.timer) clearInterval(st.timer);
    st.timer = setInterval(carregar, 10000);
  }

  async function carregar() {
    try {
      var lista = await api.entregadoresDaLoja();
      st.eu = lista.filter(function (e) { return e.id === st.eu.id; })[0] || st.eu;
      var novas = await api.minhasEntregas(st.eu.id);
      var ofertas = await api.ofertasPara(st.eu.id);
      var antes = st.ofertas.map(function (e) { return e.id; });
      if (ofertas.some(function (o) { return antes.indexOf(o.id) < 0; })) { bip(); toast('Nova entrega oferecida para você!'); }
      st.entregas = novas; st.ofertas = ofertas; st.erro = null;
    } catch (e) { st.erro = e.message; }
    if (!document.querySelector('#form-ocorrencia')) render();
  }

  function enderecoTexto(e) { return (e.rua || '') + ', ' + (e.numero || '') + ' — ' + (e.bairro || ''); }

  function cartaoOferta(p) {
    var e = p.endereco || {};
    return '<article class="caixa oferta-caixa"><h3 style="margin-top:0">📣 Entrega oferecida · #' + esc(p.numero) + '</h3>' +
      '<div style="font-size:17px">📍 ' + esc(enderecoTexto(e)) + '</div>' + (e.referencia ? '<div>Ref.: ' + esc(e.referencia) + '</div>' : '') +
      '<div style="margin:6px 0">Receber: <b>' + N.reais(p.total) + '</b> · ' + esc(nomePagamento(p.pagamento)) + (p.status === 'PRONTO' ? ' · <b>pronto para buscar</b>' : '') + '</div>' +
      '<div class="barra-acoes" style="margin:8px 0 0"><button class="btn btn-ouro" style="flex:1;min-height:54px;font-size:18px" type="button" data-acao="aceitar" data-id="' + esc(p.id) + '">✔ Aceitar</button>' +
      '<button class="btn btn-linha" style="flex:1;min-height:54px" type="button" data-acao="recusar" data-id="' + esc(p.id) + '">Recusar</button></div></article>';
  }

  function cartao(p) {
    var e = p.endereco || {};
    var pronta = p.status === 'PRONTO', saiu = p.status === 'SAIU_PARA_ENTREGA';
    var troco = p.troco_para ? Number(p.troco_para) - Number(p.total) : 0;
    var h = '<article class="caixa" style="overflow-wrap:anywhere">' +
      '<div class="barra-acoes" style="margin:0 0 6px;justify-content:space-between"><h3 style="margin:0;font-size:22px">#' + esc(p.numero) + '</h3>' + window.AterrissePrazo.html(p) + '</div>' +
      '<div style="margin-bottom:8px"><span class="status st-' + p.status + '">' + N.STATUS_NOMES[p.status] + '</span>' + (p.teste ? ' <span class="status st-TESTE">TESTE</span>' : '') +
      (p.prazo_em ? ' <small style="color:var(--texto-2)">prazo até ' + esc(N.horaCurta(p.prazo_em)) + '</small>' : '') + '</div>' +
      '<div style="font-size:17px"><b>' + esc(p.nome) + '</b></div>' +
      '<div style="font-size:17px;margin:4px 0">📍 ' + esc(enderecoTexto(e)) + '</div>' +
      (e.complemento ? '<div>' + esc(e.complemento) + '</div>' : '') +
      (e.referencia ? '<div><b>Referência:</b> ' + esc(e.referencia) + '</div>' : '') +
      '<div class="barra-acoes" style="margin:10px 0">' +
      '<a class="btn btn-linha" href="' + esc(N.linkMapa(e)) + '" target="_blank" rel="noopener">🗺️ Google Maps</a>' +
      '<a class="btn btn-linha" href="' + esc(N.linkWaze(e)) + '" target="_blank" rel="noopener">🚗 Waze</a>' +
      (p.telefone ? '<a class="btn btn-linha" href="tel:+' + esc(N.normalizarTelefone(p.telefone)) + '">📞 Ligar</a>' : '') + '</div>' +
      '<div class="resumo-bloco"><b>Itens</b><ul style="margin:6px 0;padding-left:18px">' + (p.itens || []).map(function (i) {
        var d = (i.adicionais || []).map(function (a) { return a.nome; }).join(', ');
        return '<li>' + i.quantidade + '× ' + esc(i.nome) + (d ? ' <small>(' + esc(d) + ')</small>' : '') + '</li>';
      }).join('') + '</ul>' + (p.observacoes ? '<div style="color:var(--aviso)">Obs.: ' + esc(p.observacoes) + '</div>' : '') + '</div>' +
      '<div class="resumo-bloco" style="font-size:17px">Receber: <b>' + N.reais(p.total) + '</b> · ' + esc(nomePagamento(p.pagamento)) +
      (troco > 0 ? '<br>Levar troco: <b>' + N.reais(troco) + '</b> (para ' + N.reais(p.troco_para) + ')' : '') + htmlPagamento(p) + '</div>';
    if (pronta) h += '<button class="btn btn-ouro btn-bloco" style="min-height:58px;font-size:18px" type="button" data-acao="status" data-id="' + esc(p.id) + '" data-para="SAIU_PARA_ENTREGA" data-numero="' + esc(p.numero) + '">🛵 Saí para entrega</button>';
    else if (saiu) h += '<button class="btn btn-ouro btn-bloco" style="min-height:58px;font-size:18px" type="button" data-acao="status" data-id="' + esc(p.id) + '" data-para="ENTREGUE" data-numero="' + esc(p.numero) + '">📦 Entregue</button>';
    else h += '<div class="aviso-caixa" style="margin-bottom:0">Ainda em preparo na cozinha. Aguarde ficar “Pronto”.</div>';
    h += st.ocorrencia === p.id ? htmlOcorrencia(p) : '<button class="btn btn-linha btn-bloco" style="margin-top:8px" type="button" data-acao="ocorrencia" data-id="' + esc(p.id) + '">🚨 Comunicar ocorrência</button>';
    return h + '</article>';
  }

  function htmlOcorrencia(p) {
    return '<form id="form-ocorrencia" class="erro-caixa" data-id="' + esc(p.id) + '" style="margin-top:8px"><b>🚨 Ocorrência da entrega #' + esc(p.numero) + '</b>' +
      '<p style="margin:4px 0 8px">Vai para o painel da loja na hora' + (p.telefone ? ', e depois abre a conversa com o cliente no WhatsApp' : '') + '.</p>' +
      '<div class="campo"><label for="oc-tipo">O que aconteceu?</label><select id="oc-tipo" required><option value="">Escolha…</option>' +
      Object.keys(OCORRENCIAS).map(function (k) { return '<option value="' + k + '">' + esc(OCORRENCIAS[k]) + '</option>'; }).join('') + '</select></div>' +
      '<div class="campo"><label for="oc-texto">Detalhe (opcional)</label><input id="oc-texto" maxlength="300"></div>' +
      '<div class="barra-acoes"><button class="btn btn-ouro" type="submit">Enviar</button><button class="btn btn-linha" type="button" data-acao="ocorrencia-cancelar">Cancelar</button></div></form>';
  }

  // Pagamento recebido pessoalmente: o entregador confirma e o painel do restaurante vê na hora.
  function htmlPagamento(p) {
    if (p.pagamento_status === 'CONFIRMADO') return '<div class="ok-caixa" style="margin:8px 0 0">✔ Pagamento recebido' + (p.pago_como ? ' (' + esc(nomePagamento(p.pago_como)) + ')' : '') + '</div>';
    if (p.pagamento_status === 'CANCELADO') return '';
    var h = '';
    if (st.loja && st.loja.pix_chave) {
      h += '<button class="btn btn-linha btn-bloco" style="margin-top:8px" type="button" data-acao="pix" data-id="' + esc(p.id) + '">' + (st.pixAberto[p.id] ? 'Esconder QR do Pix' : '📱 Mostrar QR do Pix ao cliente') + '</button>';
      if (st.pixAberto[p.id]) h += window.AterrissePix.bloco(st.loja, Number(p.total), p.numero, 'O cliente lê com o app do banco. Confira o Pix recebido antes de confirmar.');
    }
    if (p.status !== 'SAIU_PARA_ENTREGA') return h + '<div style="font-size:13px;color:var(--texto-2);margin-top:6px">Confirme o pagamento depois de sair para a entrega.</div>';
    return h + '<div style="margin-top:10px;font-size:14px;font-weight:800">Recebi o pagamento em:</div><div class="barra-acoes" style="margin:6px 0 0">' +
      [['dinheiro', '💵 Dinheiro'], ['cartao', '💳 Cartão'], ['pix', '📱 Pix']].map(function (f) {
        return '<button class="btn btn-linha" style="flex:1;min-width:90px" type="button" data-acao="pago" data-id="' + esc(p.id) + '" data-forma="' + f[0] + '" data-numero="' + esc(p.numero) + '">' + f[1] + '</button>';
      }).join('') + '</div>';
  }

  function nomePagamento(id) {
    return { pix: 'Pix', dinheiro: 'Dinheiro', cartao: 'Cartão' }[id] || id;
  }

  function render() {
    var on = !!(st.eu && st.eu.online);
    var h = '<div class="caixa trabalho ' + (on ? 'ligado' : '') + '"><div><b>' + (on ? '🟢 Trabalhando' : '⚪ Parado') + '</b><br><small>' +
      (on ? 'Você recebe ofertas de entrega.' : 'Ligue para receber ofertas de entrega.') + '</small></div>' +
      '<button class="btn ' + (on ? 'btn-linha' : 'btn-ouro') + '" type="button" data-acao="trabalho">' + (on ? 'Parar' : 'Estou trabalhando') + '</button></div>';
    if (st.erro) h += '<div class="erro-caixa" role="alert">Falha de comunicação: ' + esc(st.erro) + '</div>';
    h += st.ofertas.map(cartaoOferta).join('');
    if (!st.entregas.length && !st.ofertas.length) h += '<div class="vazio">Nenhuma entrega com você agora.<br><small>A lista atualiza sozinha.</small></div>';
    else if (st.entregas.length) h += '<div class="lista-entregas">' + st.entregas.map(cartao).join('') + '</div>';
    $('#conteudo').innerHTML = h;
  }

  document.addEventListener('click', async function (ev) {
    var el = ev.target.closest('[data-acao]');
    if (!el) return;
    var a = el.dataset.acao;
    if (a === 'sair') {
      // saiu do celular: para de receber ofertas (elas passam ao próximo entregador)
      if (COM_LOGIN) { if (st.eu && st.eu.online) { try { await api.definirOnline(null, false); } catch (e) { /* segue */ } } st.eu = null; await api.sair(); telaLogin(); return; }
      st.eu = null; gravarEu(null); telaQuemSou(); return;
    }
    if (a === 'sou') { gravarEu(el.dataset.id); iniciar(); return; }
    if (a === 'trabalho') {
      try { await api.definirOnline(st.eu.id, !st.eu.online); toast(st.eu.online ? 'Você parou. Não recebe ofertas.' : 'Bom trabalho! Você vai receber ofertas.'); } catch (e) { alert(e.message); }
      carregar(); return;
    }
    if (a === 'aceitar' || a === 'recusar') {
      el.disabled = true;
      try { await api.responderOferta(el.dataset.id, st.eu.id, a === 'aceitar'); toast(a === 'aceitar' ? 'Entrega aceita. Está na sua lista.' : 'Recusada. Vai para o próximo entregador.'); }
      catch (e) { alert(e.message); }
      carregar(); return;
    }
    if (a === 'ocorrencia') { st.ocorrencia = el.dataset.id; render(); var t = $('#oc-tipo'); if (t) t.focus(); return; }
    if (a === 'ocorrencia-cancelar') { st.ocorrencia = null; render(); return; }
    if (a === 'pix') { st.pixAberto[el.dataset.id] = !st.pixAberto[el.dataset.id]; render(); return; }
    if (a === 'pago') {
      if (!confirm('Confirmar que recebeu o pagamento da entrega #' + el.dataset.numero + ' em ' + nomePagamento(el.dataset.forma) + '?')) return;
      el.disabled = true;
      try { await api.entregadorPagamento(el.dataset.id, st.eu.id, el.dataset.forma); toast('Pagamento registrado ✔'); st.pixAberto[el.dataset.id] = false; }
      catch (e) { alert(e.message); }
      carregar();
      return;
    }
    if (a === 'status') {
      var pedido = st.entregas.filter(function (x) { return x.id === el.dataset.id; })[0];
      var txt = el.dataset.para === 'ENTREGUE' ? 'Confirmar que a entrega #' + el.dataset.numero + ' foi feita?' : 'Confirmar que saiu com a entrega #' + el.dataset.numero + '?';
      if (el.dataset.para === 'ENTREGUE' && pedido && pedido.pagamento_status === 'PENDENTE') txt = 'O pagamento da entrega #' + el.dataset.numero + ' ainda NÃO foi marcado como recebido. Marcar como entregue mesmo assim?';
      if (!confirm(txt)) return;
      el.disabled = true;
      try { await api.entregadorStatus(el.dataset.id, st.eu.id, el.dataset.para); toast(el.dataset.para === 'ENTREGUE' ? 'Entrega concluída ✔' : 'Boa entrega! 🛵'); }
      catch (e) { alert(e.message); }
      carregar();
    }
  });

  document.addEventListener('submit', async function (ev) {
    ev.preventDefault();
    if (ev.target.id === 'form-nova-senha') { salvarNovaSenha(); return; }
    if (ev.target.id === 'form-login') {
      try { await api.entrar($('#l-usuario').value.trim(), $('#l-senha').value); iniciar(); } catch (e) { telaLogin(e.message); }
      return;
    }
    if (ev.target.id === 'form-ocorrencia') {
      var id = ev.target.dataset.id, tipo = $('#oc-tipo').value, texto = $('#oc-texto').value.trim();
      var p = st.entregas.filter(function (x) { return x.id === id; })[0];
      try { await api.entregadorOcorrencia(id, st.eu.id, tipo, texto); } catch (e) { alert(e.message); return; }
      st.ocorrencia = null;
      toast('Ocorrência enviada para a loja.');
      if (p && p.telefone) {
        var msg = 'Olá, ' + p.nome.split(' ')[0] + '! Aqui é o entregador do ' + ((st.loja && st.loja.nome) || 'restaurante') + ', sobre o pedido nº ' + p.numero + '. ' + (OCORRENCIAS[tipo] || '') + '.';
        window.open(N.linkWhatsApp(N.normalizarTelefone(p.telefone), msg), '_blank', 'noopener');
      }
      carregar();
    }
  });

  iniciar();
})();
