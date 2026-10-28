/* Pede Sul — painel da equipe de cada loja (login obrigatório). Copiado do Aterrisse; caixa, mesas, clientes,
   oferta ao entregador, ocorrências e impressão da comanda vieram do CONIS. */
(function () {
  'use strict';
  var N = window.AterrisseNucleo;
  var api = window.AterrisseBackend.criar(window.ATERRISSE_CONFIG);
  var esc = N.escaparHtml;
  function $(s) { return document.querySelector(s); }

  var ABAS = {
    admin: ['inicio', 'pedidos', 'caixa', 'mesas', 'cozinha', 'entregas', 'clientes', 'cardapio', 'post', 'horarios', 'loja', 'qrcode', 'relatorios', 'equipe'],
    atendente: ['inicio', 'pedidos', 'caixa', 'mesas', 'cozinha', 'entregas', 'clientes', 'post'],
    caixa: ['caixa', 'pedidos', 'mesas', 'clientes'],
    garcom: ['mesas'],
    cozinha: ['cozinha'],
    entregador: ['minhas']
  };
  var NOMES_ABA = { inicio: 'Início', pedidos: 'Pedidos', caixa: '💰 Caixa', mesas: '🍽️ Mesas', cozinha: 'Cozinha', entregas: 'Entregas', clientes: 'Clientes', minhas: 'Minhas entregas',
    cardapio: 'Cardápio', post: '📣 Post do dia', horarios: 'Horários', loja: 'Loja', qrcode: 'QR Code', relatorios: 'Relatórios', equipe: 'Equipe' };
  var NOMES_PAPEL = { admin: 'Administrador', atendente: 'Atendente', caixa: 'Caixa', garcom: 'Garçom', cozinha: 'Cozinha', entregador: 'Entregador' };
  var LOJA = (window.ATERRISSE_CONFIG && window.ATERRISSE_CONFIG.LOJA) || 'aterrisse';
  var SENHA_TESTE = (window.ATERRISSE_CONFIG && window.ATERRISSE_CONFIG.SENHA_TESTE) || '123456';
  function comLoja(pagina) { return pagina + '?loja=' + encodeURIComponent(LOJA); }
  var NOMES_PAG = { pix: 'Pix', dinheiro: 'Dinheiro', cartao: 'Cartão' };

  var st = { papel: null, aba: null, pedidos: [], fila: [], minhas: [], adm: null, entregadores: [], equipe: [],
    filtro: 'abertos', busca: '', vistos: null, timer: null, erro: null, msg: null };

  function toast(msg) {
    var t = document.createElement('div');
    t.className = 'aviso-toast'; t.setAttribute('role', 'status'); t.textContent = msg;
    document.body.appendChild(t); setTimeout(function () { t.remove(); }, 2800);
  }
  async function tentar(fn, ok) {
    try { var r = await fn(); if (ok) toast(ok); return r; } catch (e) { alert(e.message || 'Erro.'); throw e; }
  }

  function renderFaixas() {
    var l = st.lojaPub, h = '';
    if (api.modo === 'demo' && !api.vitrine) h += '<div class="faixa faixa-demo" role="note">⚠️ MODO DEMONSTRAÇÃO — dados só neste navegador. Nada aqui é o servidor do restaurante.</div>';
    else if (l && l.modo === 'demo' && !api.vitrine) h += '<div class="faixa faixa-demo" role="note">🧪 Versão de demonstração: os pedidos chegam marcados como TESTE.</div>';
    if (l && l.liberada === false) h += '<div class="faixa faixa-fechado" role="alert">Loja suspensa: o cardápio está indisponível para os clientes. Fale com a RMD.</div>';
    $('#faixas').innerHTML = h;
  }

  // Abas que o desenvolvedor RMD deixou liberadas (recursos desligados somem do painel; o servidor também recusa).
  var RECURSO_DA_ABA = { cozinha: 'cozinha', entregas: 'entregadores', minhas: 'entregadores', qrcode: 'qrcode', relatorios: 'relatorios',
    caixa: 'caixa', mesas: 'mesas', clientes: 'clientes', post: 'post' };
  // cozinha.html: tela separada da cozinha (só a fila, sem valores), para o tablet/monitor da cozinha.
  var TELA_COZINHA = window.ATERRISSE_TELA === 'cozinha';
  function abasLiberadas() {
    var rec = (st.lojaPub && st.lojaPub.recursos) || {};
    return (TELA_COZINHA ? ['cozinha'] : ABAS[st.papel]).filter(function (a) { return !RECURSO_DA_ABA[a] || rec[RECURSO_DA_ABA[a]] !== false; });
  }
  function pedidosQueContam() {
    // no modo real, pedidos de teste (feitos na demonstração) não entram nos números
    return st.lojaPub && st.lojaPub.modo === 'real' ? st.pedidos.filter(function (p) { return !p.teste; }) : st.pedidos;
  }

  // ================================================================ login
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

  function telaLogin(mensagem) {
    $('#nav').classList.add('oculto'); $('#btn-sair').classList.add('oculto'); $('#quem').textContent = 'Área da equipe';
    var h = '<div class="login caixa"><h2>' + (TELA_COZINHA ? 'Entrar na cozinha' : 'Entrar no painel') + '</h2>';
    if (mensagem) h += '<div class="erro-caixa">' + esc(mensagem) + '</div>';
    if (api.modo === 'demo') {
      if (!api.temSenhaDemo()) {
        h += '<p>Primeiro acesso do modo demonstração neste navegador: crie uma senha (mínimo 6 caracteres). Ela fica só neste navegador.</p>' +
          '<form id="form-login" data-tipo="criar"><div class="campo"><label for="l-senha">Nova senha</label><input id="l-senha" type="password" autocomplete="new-password" minlength="6" required></div>' +
          '<div class="campo"><label for="l-senha2">Repita a senha</label><input id="l-senha2" type="password" autocomplete="new-password" minlength="6" required></div>' +
          '<button class="btn btn-ouro btn-bloco" type="submit">Criar senha e entrar</button></form>';
      } else {
        h += '<form id="form-login" data-tipo="entrar"><div class="campo"><label for="l-senha">Senha do modo demonstração</label><input id="l-senha" type="password" autocomplete="current-password" required></div>' +
          '<button class="btn btn-ouro btn-bloco" type="submit">Entrar</button></form>';
      }
    } else {
      h += '<form id="form-login" data-tipo="entrar">' + '<div class="campo"><label for="l-usuario">Usuário</label><input id="l-usuario" autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false" required maxlength="120"></div>' +
        '<div class="campo"><label for="l-senha">Senha</label><input id="l-senha" type="password" autocomplete="current-password" required></div>' +
        '<button class="btn btn-ouro btn-bloco" type="submit">Entrar</button></form>' +
        '<p style="font-size:14px;color:var(--texto-2);margin-top:14px">Use o usuário desta loja. Não tem acesso ou esqueceu a senha? Peça ao dono da loja: ele cria o seu usuário e define uma senha nova no painel (Equipe).</p>';
    }
    h += '</div>';
    $('#conteudo').innerHTML = h;
    var f = $('#conteudo input'); if (f) f.focus();
  }

  async function iniciar() {
    renderFaixas();
    if (!api.sessao()) return telaLogin();
    try { st.papel = await api.papel(); } catch (e) { return telaLogin(e.codigo === 'REDE' ? e.message : null); }
    if (!st.papel) {
      $('#btn-sair').classList.remove('oculto');
      var rmd = false;
      try { rmd = await api.souRmd(); } catch (e) { /* segue */ }
      $('#conteudo').innerHTML = rmd
        ? '<div class="login caixa"><h2>Conta do desenvolvedor RMD</h2><p>Esta conta não acessa o painel do restaurante (vendas e clientes são do restaurante). Use a <a href="rmd.html">área do desenvolvedor</a>.</p></div>'
        : '<div class="login caixa"><h2>Acesso não liberado</h2><p>Sua conta ainda não faz parte da equipe desta loja. Peça ao administrador para liberar em Painel → Equipe.</p></div>';
      return;
    }
    if (api.trocarSenhaPendente) { $('#btn-sair').classList.remove('oculto'); return telaNovaSenha(); }
    if (api.vitrine && TELA_COZINHA) st.papel = 'cozinha'; // demonstração: a tela da cozinha age como a conta da cozinha
    if (st.papel === 'entregador') { location.href = comLoja('entregador.html'); return; }
    if (st.papel === 'cozinha' && !TELA_COZINHA) { location.href = comLoja('cozinha.html'); return; }
    try { st.lojaPub = (await api.cardapio()).loja; } catch (e) { /* sem conexão: segue com o padrão */ }
    aplicarMarcaLoja();
    renderFaixas();
    window.AterrissePrazo.aoAtrasar(function (id, numero) { bip(); toast('⚠ Pedido #' + numero + ' passou do prazo!'); });
    var s = api.sessao() || {};
    $('#quem').textContent = (s.usuario || N.usuarioVisivel(s.email || '')) + ' · ' + NOMES_PAPEL[st.papel];
    if (!api.vitrine) $('#btn-sair').classList.remove('oculto'); // na demonstração não há login para sair
    var abas = abasLiberadas();
    var pedida = (location.hash || '').slice(1);
    irPara(abas.indexOf(pedida) >= 0 ? pedida : abas[0]);
    if (st.timer) clearInterval(st.timer);
    st.timer = setInterval(atualizarPeriodico, 10000);
  }

  // Nome e cor da loja no topo (cada loja com a sua cara).
  function aplicarMarcaLoja() {
    var l = st.lojaPub;
    if (!l) return;
    var forte = $('.topo .marca-texto strong');
    if (forte && !TELA_COZINHA) forte.textContent = 'Painel · ' + l.nome;
    else if (forte) forte.textContent = 'Cozinha · ' + l.nome;
    if (l.cor && /^#[0-9a-fA-F]{6}$/.test(l.cor)) document.documentElement.style.setProperty('--cor-loja', l.cor);
  }

  // ================================================================ navegação

  function renderNav() {
    var nav = $('#nav');
    if (TELA_COZINHA) return; // tela da cozinha: uma tela só, sem abas
    nav.classList.remove('oculto');
    var novos = st.pedidos.filter(function (p) { return p.status === 'RECEBIDO'; }).length;
    nav.innerHTML = abasLiberadas().map(function (a) {
      return '<button type="button" data-acao="aba" data-aba="' + a + '"' + (st.aba === a ? ' aria-current="page"' : '') + '>' + NOMES_ABA[a] +
        (a === 'pedidos' && novos ? '<span class="badge-novo" aria-label="' + novos + ' novos">' + novos + '</span>' : '') + '</button>';
    }).join('');
  }

  async function irPara(aba) {
    st.aba = aba; st.msg = null;
    if (history.replaceState) history.replaceState(null, '', location.pathname + location.search + '#' + aba); // endereço completo: funciona também com <base> das pastas demo-*/
    renderNav();
    $('#conteudo').innerHTML = '<div class="estado">Carregando…</div>';
    try {
      await carregarAba(aba);
      st.erro = null;
    } catch (e) { st.erro = e.message; }
    render();
  }

  async function carregarAba(aba) {
    if (aba === 'inicio' || aba === 'pedidos' || aba === 'entregas') {
      st.pedidos = await api.listarPedidos(2);
      st.entregadores = await api.listarEntregadores();
      if (!st.lojaPub) st.lojaPub = (await api.cardapio()).loja;
      marcarVistos();
    }
    if (aba === 'cozinha') { st.fila = await api.filaCozinha(); if (st.papel !== 'cozinha') st.pedidos = await api.listarPedidos(2); }

    if (aba === 'minhas') st.minhas = await api.minhasEntregas();
    if (aba === 'cardapio' || aba === 'horarios' || aba === 'loja' || aba === 'qrcode') st.adm = await api.cardapioCompleto();
    if (aba === 'post') { st.cardPub = await api.cardapio(); try { st.adm = await api.cardapioCompleto(); } catch (e) { st.adm = null; } }
    if (aba === 'equipe') { st.entregadores = await api.listarEntregadores(); st.equipe = await api.listarEquipe(); }
    if (aba === 'caixa') { st.caixa = await api.caixa(); st.pedidos = await api.listarPedidos(2); if (!st.cardPub) st.cardPub = await api.cardapio(); }
    if (aba === 'mesas') { st.mesas = await api.mesas(); st.cardPub = await api.cardapio(); }
    if (aba === 'clientes') st.clientes = await api.clientes();
  }

  // Aviso de pedido novo (som curto + título da aba).
  function marcarVistos() {
    var ids = st.pedidos.filter(function (p) { return p.status === 'RECEBIDO'; }).map(function (p) { return p.id; });
    if (st.vistos) {
      var novos = ids.filter(function (id) { return st.vistos.indexOf(id) < 0; });
      if (novos.length) { bip(); toast(novos.length === 1 ? 'Chegou um pedido novo!' : 'Chegaram ' + novos.length + ' pedidos novos!'); }
    }
    st.vistos = ids;
    document.title = (ids.length ? '(' + ids.length + ') ' : '') + 'Painel | ' + ((st.lojaPub && st.lojaPub.nome) || 'Pede Sul');
    var abertas = st.pedidos.filter(function (p) { return (p.ocorrencias || []).some(function (o) { return !o.resolvida; }); }).length;
    if (abertas > (st.ocorrenciasVistas || 0)) { bip(); toast('⚠ Ocorrência de entrega! Veja em Pedidos.'); }
    st.ocorrenciasVistas = abertas;
  }
  function bip() {
    try {
      var ctx = new (window.AudioContext || window.webkitAudioContext)();
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = 880; o.connect(g); g.connect(ctx.destination); g.gain.value = 0.15;
      o.start(); o.stop(ctx.currentTime + 0.25);
    } catch (e) { /* sem som */ }
  }

  async function atualizarPeriodico() {
    if (document.querySelector('#janela-raiz .fundo') && st.aba !== 'pedidos') return;
    if (['inicio', 'pedidos', 'cozinha', 'entregas', 'minhas', 'mesas'].indexOf(st.aba) < 0) {
      if (st.papel === 'admin' || st.papel === 'atendente') { try { st.pedidos = await api.listarPedidos(2); marcarVistos(); renderNav(); } catch (e) { /* tenta depois */ } }
      return;
    }
    try { await carregarAba(st.aba); st.erro = null; } catch (e) { st.erro = e.message; }
    if (!document.querySelector('#janela-raiz .fundo')) render();
    else atualizarJanelaPedido();
    renderNav();
  }

  function render() {
    var c = $('#conteudo');
    var topo = st.erro ? '<div class="erro-caixa" role="alert">Falha de comunicação: ' + esc(st.erro) + ' <button class="btn btn-linha btn-peq" type="button" data-acao="aba" data-aba="' + st.aba + '">Tentar de novo</button></div>' : '';
    var f = { inicio: telaInicio, pedidos: telaPedidos, cozinha: telaCozinha, entregas: telaEntregas, minhas: telaMinhas, cardapio: telaCardapio,
      horarios: telaHorarios, loja: telaLoja, qrcode: telaQr, relatorios: telaRelatorios, equipe: telaEquipe, post: telaPost,
      caixa: telaCaixa, mesas: telaMesas, clientes: telaClientes }[st.aba];
    c.innerHTML = topo + (f ? f() : '');
    if (st.aba === 'qrcode') desenharQr();
    if (st.aba === 'horarios') previaHorarios();
    if (st.aba === 'post') desenharPost();
  }

  // ================================================================ início (dashboard)

  function telaInicio() {
    var hoje = N.diaNoFuso(new Date());
    var r = N.resumoPedidos(pedidosQueContam(), hoje);
    var andamento = st.pedidos.filter(function (p) { return ['ACEITO', 'EM_PREPARACAO', 'PRONTO', 'SAIU_PARA_ENTREGA'].indexOf(p.status) >= 0; }).length;
    var h = '<h2>Hoje</h2><div class="cartoes-resumo">' +
      '<div class="cartao-num"><span>Pedidos novos</span><strong>' + r.novos + '</strong></div>' +
      '<div class="cartao-num"><span>Em andamento</span><strong>' + andamento + '</strong></div>' +
      '<div class="cartao-num"><span>Vendas do dia</span><strong>' + N.reais(r.vendas) + '</strong></div>' +
      '<div class="cartao-num"><span>Ticket médio</span><strong>' + (r.pedidos ? N.reais(r.ticket_medio) : '—') + '</strong></div></div>';
    h += '<p style="color:var(--texto-2);font-size:13px;margin-top:-6px">Vendas e ticket contam os pedidos de hoje (horário de Maceió), sem os cancelados. Pagamento é conferido pela equipe.</p>';
    var statusHoje = Object.keys(r.por_status);
    h += '<div class="caixa"><h3 style="margin-top:0">Pedidos de hoje por status</h3>' + (statusHoje.length
      ? statusHoje.map(function (s) { return '<span class="status st-' + s + '" style="margin:0 6px 6px 0">' + N.STATUS_NOMES[s] + ': ' + r.por_status[s] + '</span>'; }).join('')
      : '<p class="vazio" style="margin:0">Nenhum pedido hoje ainda.</p>') + '</div>';
    var ultimos = st.pedidos.slice(0, 5);
    h += '<h3>Últimos pedidos</h3>' + (ultimos.length ? '<div class="lista-pedidos">' + ultimos.map(linhaPedido).join('') + '</div>' : '<div class="vazio">Sem pedidos nos últimos dias.</div>');
    return h;
  }

  // ================================================================ pedidos

  function nomeEntregador(p) {
    if (p.entregador) return p.entregador; // a fila da cozinha já vem com o nome
    var e = st.entregadores.filter(function (x) { return x.id === p.entregador_id; })[0];
    return e ? e.nome : '';
  }

  function linhaPedido(p) {
    var ent = p.modalidade === 'entrega' ? nomeEntregador(p) : '';
    var onde = p.modalidade === 'entrega' ? (p.endereco ? p.endereco.bairro : '') : p.modalidade === 'local' ? (p.mesa ? 'Mesa ' + p.mesa : 'Na loja') : 'Balcão';
    return '<button class="pedido-linha" type="button" data-acao="abrir-pedido" data-id="' + esc(p.id) + '"><span class="num">#' + esc(p.numero) + '</span>' +
      '<span class="info"><b>' + (p.teste ? '<span class="status st-TESTE">TESTE</span> ' : '') + esc(p.nome) + '</b><small>' + esc(N.dataHora(p.criado_em)) + ' · ' + esc(N.MODALIDADE_NOMES[p.modalidade]) + (onde ? ' · ' + esc(onde) : '') + '</small>' +
      (ent ? '<small>🛵 ' + esc(ent) + '</small>' : (p.modalidade === 'entrega' && ['ENTREGUE', 'CANCELADO'].indexOf(p.status) < 0 ? '<small style="color:var(--aviso)">' + esc(textoOferta(p)) + '</small>' : '')) +
      ((p.ocorrencias || []).some(function (o) { return !o.resolvida; }) ? '<small style="color:var(--erro);font-weight:800">⚠ ocorrência de entrega</small>' : '') + '</span>' +
      '<span class="lado">' + (window.AterrissePrazo.html(p) ? window.AterrissePrazo.html(p) + '<br>' : '') + '<span class="status st-' + p.status + '">' + N.STATUS_NOMES[p.status] + '</span><br><b>' + N.reais(p.total) + '</b></span></button>';
  }

  function textoOferta(p) {
    if (!p.oferta) return 'sem entregador';
    if (p.oferta.sem_ninguem) return 'ninguém online para aceitar';
    var e = st.entregadores.filter(function (x) { return x.id === p.oferta.entregador_id; })[0];
    return 'oferecida a ' + (e ? e.nome : 'um entregador') + ', aguardando';
  }

  function telaPedidos() {
    var filtros = [['abertos', 'Em aberto'], ['RECEBIDO', 'Novos'], ['todos', 'Todos (2 dias)'], ['finalizados', 'Finalizados']];
    var lista = st.pedidos.filter(function (p) {
      if (st.filtro === 'abertos') return ['ENTREGUE', 'CONCLUIDO', 'CANCELADO'].indexOf(p.status) < 0;
      if (st.filtro === 'finalizados') return ['ENTREGUE', 'CONCLUIDO', 'CANCELADO'].indexOf(p.status) >= 0;
      if (st.filtro === 'todos') return true;
      return p.status === st.filtro;
    });
    var b = st.busca.trim().toLowerCase();
    if (b) lista = lista.filter(function (p) { return String(p.numero) === b.replace('#', '') || String(p.nome).toLowerCase().indexOf(b) >= 0; });
    var h = '<h2>Pedidos</h2><div class="barra-acoes">' + filtros.map(function (f) {
      return '<button class="btn btn-peq ' + (st.filtro === f[0] ? 'btn-ouro' : 'btn-linha') + '" type="button" data-acao="filtro" data-filtro="' + f[0] + '">' + f[1] + '</button>';
    }).join('') + '<input class="entrada" type="search" id="busca-pedido" placeholder="Nº ou nome" value="' + esc(st.busca) + '" aria-label="Buscar pedido"></div>';
    h += '<p style="color:var(--texto-2);font-size:13px">Atualiza sozinho a cada 10 segundos.</p>';
    h += lista.length ? '<div class="lista-pedidos">' + lista.map(linhaPedido).join('') + '</div>' : '<div class="vazio">Nenhum pedido neste filtro.</div>';
    return h;
  }

  var pedidoAberto = null;

  function acharPedido(id) { return st.pedidos.filter(function (p) { return p.id === id; })[0]; }

  function abrirJanela(html) {
    $('#janela-raiz').innerHTML = '<div class="fundo" data-acao="fundo"><div class="janela" role="dialog" aria-modal="true" aria-labelledby="janela-titulo">' + html + '</div></div>';
    document.body.style.overflow = 'hidden';
    var f = document.querySelector('#janela-raiz .fechar'); if (f) f.focus();
  }
  function fecharJanela() { $('#janela-raiz').innerHTML = ''; document.body.style.overflow = ''; pedidoAberto = null; montar = null; }

  var NOMES_BOTAO = { ACEITO: '✔ Aceitar', EM_PREPARACAO: '🍳 Em preparação', PRONTO: '✅ Pronto', SAIU_PARA_ENTREGA: '🛵 Saiu para entrega', ENTREGUE: '📦 Entregue', CONCLUIDO: '🏁 Concluído', CANCELADO: 'Cancelar pedido' };

  function htmlPedido(p) {
    var h = '<div class="janela-cab"><h2 id="janela-titulo">Pedido #' + esc(p.numero) + ' <span class="status st-' + p.status + '">' + N.STATUS_NOMES[p.status] + '</span>' + (p.teste ? ' <span class="status st-TESTE">TESTE</span>' : '') + '</h2>' +
      '<button class="fechar" type="button" data-acao="fechar" aria-label="Fechar">×</button></div>';
    if (p.prazo_em) h += '<div class="resumo-bloco" style="display:flex;flex-wrap:wrap;gap:8px;align-items:center"><span>Prazo: até <b>' + esc(N.horaCurta(p.prazo_em)) + '</b></span>' + window.AterrissePrazo.html(p) + '</div>';
    h += '<div class="resumo-bloco"><h3>' + esc(N.MODALIDADE_NOMES[p.modalidade]) + ' · ' + esc(N.dataHora(p.criado_em)) + '</h3><div><b>' + esc(p.nome) + '</b></div>';
    if (p.telefone) {
      h += '<div>📞 <a href="tel:+' + esc(N.normalizarTelefone(p.telefone)) + '">' + esc(p.telefone) + '</a> · <a href="' + esc(N.linkWhatsApp(N.normalizarTelefone(p.telefone), 'Olá, ' + p.nome.split(' ')[0] + '! Aqui é do Restaurante Aterrisse, sobre o seu pedido nº ' + p.numero + '.')) + '" target="_blank" rel="noopener">WhatsApp do cliente</a></div>';
    }
    if (p.endereco) { var e = p.endereco; h += '<div>📍 ' + esc(e.rua + ', ' + e.numero + ' — ' + e.bairro) + (e.complemento ? ' · ' + esc(e.complemento) : '') + (e.referencia ? '<br>Ref.: ' + esc(e.referencia) : '') + '</div>'; }
    if (p.mesa) h += '<div>🍽️ Mesa/código: <b>' + esc(p.mesa) + '</b></div>';
    if (p.modalidade === 'entrega' && nomeEntregador(p)) h += '<div>🛵 Entregador: <b>' + esc(nomeEntregador(p)) + '</b></div>';
    h += '</div>';
    h += '<div class="resumo-bloco"><h3>Itens</h3>' + p.itens.map(function (i) {
      var d = (i.adicionais || []).map(function (a) { return a.nome + (Number(a.preco) ? ' (+' + N.reais(a.preco) + ')' : ''); }).join(', ');
      return '<div style="margin-bottom:8px"><b>' + i.quantidade + '× ' + esc(i.nome) + '</b> — ' + N.reais(i.total) + (d ? '<br><small>' + esc(d) + '</small>' : '') +
        (i.removidos && i.removidos.length ? '<br><small>Sem: ' + esc(i.removidos.join(', ')) + '</small>' : '') + (i.observacao ? '<br><small style="color:var(--aviso)">Obs.: ' + esc(i.observacao) + '</small>' : '') + '</div>';
    }).join('') + (p.observacoes ? '<div class="aviso-caixa">Obs. do pedido: ' + esc(p.observacoes) + '</div>' : '') +
      '<div class="totais"><div><span>Subtotal</span><span>' + N.reais(p.subtotal) + '</span></div><div><span>Taxa</span><span>' + N.reais(p.taxa_entrega) + '</span></div><div class="total"><span>Total</span><span>' + N.reais(p.total) + '</span></div></div></div>';
    var pag = ((st.adm && st.adm.loja.pagamentos) || (st.lojaPub && st.lojaPub.pagamentos) || []).filter(function (x) { return x.id === p.pagamento; })[0];
    h += '<div class="resumo-bloco"><h3>Pagamento</h3><div>' + esc(pag ? pag.nome : p.pagamento) + (p.troco_para ? ' · troco para ' + N.reais(p.troco_para) + ' (levar ' + N.reais(p.troco_para - p.total) + ')' : '') + '</div>' +
      '<div>Situação: <b>' + (p.pagamento_status === 'CONFIRMADO' ? 'recebido ✔' + (p.pago_como ? ' (' + esc(({ pix: 'Pix', dinheiro: 'dinheiro', cartao: 'cartão' })[p.pago_como] || p.pago_como) + ')' : '') : p.pagamento_status === 'CANCELADO' ? 'cancelado' : 'a receber') + '</b></div>' +
      (p.pagamento_status === 'PENDENTE' ? '<div style="margin-top:8px;font-size:14px">Recebido em:</div><div class="barra-acoes" style="margin:4px 0 0">' +
        [['dinheiro', '💵 Dinheiro'], ['cartao', '💳 Cartão'], ['pix', '📱 Pix']].map(function (f) {
          return '<button class="btn btn-linha btn-peq" type="button" data-acao="confirmar-pagamento" data-id="' + esc(p.id) + '" data-forma="' + f[0] + '">' + f[1] + '</button>';
        }).join('') + '</div>' +
        (window.AterrissePix && (st.lojaPub || {}).pix_chave ? '<button class="btn btn-linha btn-peq" type="button" data-acao="pix-pedido" data-id="' + esc(p.id) + '" style="margin-top:6px">' + (st.pixAberto === p.id ? 'Esconder QR do Pix' : '📱 Mostrar QR do Pix') + '</button>' +
          (st.pixAberto === p.id ? window.AterrissePix.bloco(st.lojaPub, Number(p.total), p.numero, 'Mostre ao cliente no balcão ou na mesa.') : '') : '') : '') + '</div>';
    (p.ocorrencias || []).forEach(function (o, i) {
      h += '<div class="' + (o.resolvida ? 'resumo-bloco' : 'erro-caixa') + '"><b>' + (o.resolvida ? '✔ ' : '⚠ ') + esc(o.nome) + '</b> · ' + esc(N.dataHora(o.em)) + (o.texto ? '<br>' + esc(o.texto) : '') +
        (o.resolvida ? '' : '<div class="barra-acoes" style="margin:6px 0 0">' + (p.telefone ? '<a class="btn btn-linha btn-peq" target="_blank" rel="noopener" href="' + esc(N.linkWhatsApp(N.normalizarTelefone(p.telefone), 'Olá, ' + p.nome.split(' ')[0] + '! Aqui é do ' + ((st.lojaPub && st.lojaPub.nome) || 'restaurante') + ', sobre a entrega do pedido nº ' + p.numero + '.')) + '">WhatsApp do cliente</a>' : '') +
          '<button class="btn btn-linha btn-peq" type="button" data-acao="resolver-ocorrencia" data-id="' + esc(p.id) + '" data-i="' + i + '">Marcar resolvida</button></div>') + '</div>';
    });
    if (p.modalidade === 'entrega' && ['ENTREGUE', 'CANCELADO'].indexOf(p.status) < 0) {
      if (!p.entregador_id && p.status !== 'SAIU_PARA_ENTREGA' && ((st.lojaPub || {}).recursos || {}).oferta !== false) {
        h += '<div class="resumo-bloco"><b>🛵 ' + esc(textoOferta(p)) + '</b>' + (p.oferta && p.oferta.recusados && p.oferta.recusados.length ? ' · ' + p.oferta.recusados.length + ' recusa(s)' : '') +
          '<div class="barra-acoes" style="margin:6px 0 0"><button class="btn btn-linha btn-peq" type="button" data-acao="oferecer" data-id="' + esc(p.id) + '">📣 Oferecer aos entregadores online</button></div>' +
          '<small style="color:var(--texto-2)">A entrega vai para o entregador online com menos entregas. Se ele recusar, passa para o próximo. Ou escolha abaixo.</small></div>';
      }
      h += '<div class="campo"><label for="sel-entregador">Entregador</label><select id="sel-entregador" data-acao="entregador" data-id="' + esc(p.id) + '"><option value="">— sem entregador —</option>' +
        st.entregadores.filter(function (e) { return e.ativo !== false; }).map(function (e) { return '<option value="' + esc(e.id) + '"' + (p.entregador_id === e.id ? ' selected' : '') + '>' + esc(e.nome) + '</option>'; }).join('') +
        '</select>' + (st.entregadores.length ? '' : '<span class="ajuda">Cadastre entregadores em Equipe.</span>') + '</div>';
    }
    var prox = N.proximosStatus(p.modalidade, p.status);
    if (prox.length) {
      h += '<div class="barra-acoes">' + prox.map(function (s) {
        return '<button class="btn ' + (s === 'CANCELADO' ? 'btn-perigo' : 'btn-ouro') + '" type="button" data-acao="status" data-id="' + esc(p.id) + '" data-para="' + s + '">' + NOMES_BOTAO[s] + '</button>';
      }).join('') + '</div>';
    }
    h += '<div class="barra-acoes"><button class="btn btn-linha btn-peq" type="button" data-acao="imprimir-comanda" data-id="' + esc(p.id) + '">🖨️ Imprimir comanda</button></div>';
    h += '<h3>Histórico</h3><ul class="linha-tempo">' + (p.historico || []).map(function (x) {
      return '<li class="feito">' + esc(N.STATUS_NOMES[x.para]) + ' · ' + esc(N.dataHora(x.em)) + (x.motivo ? ' — ' + esc(x.motivo) : '') + '</li>';
    }).join('') + '</ul>';
    return h;
  }

  function abrirPedido(id) {
    var p = acharPedido(id);
    if (!p) return;
    pedidoAberto = id;
    abrirJanela(htmlPedido(p));
  }
  function atualizarJanelaPedido() {
    if (!pedidoAberto) return;
    var p = acharPedido(pedidoAberto);
    var j = document.querySelector('#janela-raiz .janela');
    if (p && j) { var r = j.scrollTop; j.innerHTML = htmlPedido(p); j.scrollTop = r; }
  }

  async function mudarStatus(id, para) {
    var motivo = null;
    var p = acharPedido(id) || st.fila.filter(function (x) { return x.id === id; })[0] || st.minhas.filter(function (x) { return x.id === id; })[0];
    var rotulo = '#' + (p ? p.numero : '');
    if (para === 'CANCELADO') {
      motivo = prompt('Cancelar o pedido ' + rotulo + '? Informe o motivo:');
      if (motivo === null) return;
      if (motivo.trim().length < 3) { alert('Informe o motivo (pelo menos 3 letras).'); return; }
    } else if (['ENTREGUE', 'CONCLUIDO'].indexOf(para) >= 0) {
      if (!confirm('Confirmar que o pedido ' + rotulo + ' foi ' + (para === 'ENTREGUE' ? 'entregue' : 'concluído') + '? Depois não dá para voltar.')) return;
    }
    await tentar(function () { return api.mudarStatus(id, para, motivo); }, 'Pedido ' + rotulo + ': ' + N.STATUS_NOMES[para]);
    await carregarAba(st.aba).catch(function () {});
    if (pedidoAberto) atualizarJanelaPedido(); else render();
    renderNav();
  }

  // ================================================================ cozinha

  function ticket(p) {
    var prox = N.proximosStatus(p.modalidade, p.status).filter(function (s) { return s !== 'CANCELADO'; });
    return '<div class="ticket"><div style="float:right">' + window.AterrissePrazo.html(p) + '</div><h4>#' + esc(p.numero) + ' · ' + esc(p.primeiro_nome || p.nome || '') + '</h4>' +
      (p.modalidade === 'entrega' && nomeEntregador(p) ? '<div><b>🛵 ' + esc(nomeEntregador(p)) + '</b></div>' : '') + '<div>' + esc(N.MODALIDADE_NOMES[p.modalidade]) + (p.mesa ? ' · Mesa ' + esc(p.mesa) : '') + ' · ' + esc(N.dataHora(p.criado_em)) + '</div><ul>' +
      p.itens.map(function (i) {
        var d = (i.adicionais || []).map(function (a) { return a.nome; }).join(', ');
        return '<li><b>' + i.quantidade + '× ' + esc(i.nome) + '</b>' + (d ? '<br>' + esc(d) : '') + (i.removidos && i.removidos.length ? '<br>SEM: ' + esc(i.removidos.join(', ')) : '') +
          (i.observacao ? '<div class="obs">' + esc(i.observacao) + '</div>' : '') + '</li>';
      }).join('') + '</ul>' + (p.observacoes ? '<div class="obs">Pedido: ' + esc(p.observacoes) + '</div>' : '') +
      prox.map(function (s) { return '<button class="btn btn-ouro btn-bloco" type="button" data-acao="status" data-id="' + esc(p.id) + '" data-para="' + s + '">' + NOMES_BOTAO[s] + '</button>'; }).join('') + '</div>';
  }

  function telaCozinha() {
    var aguardando = st.pedidos.filter(function (p) { return p.status === 'RECEBIDO'; }).length;
    var h = '<h2>Cozinha</h2>';
    if (st.papel !== 'cozinha' && aguardando) h += '<div class="aviso-caixa">' + aguardando + ' pedido(s) aguardando aceite em Pedidos. A cozinha só vê pedidos aceitos.</div>';
    var a = st.fila.filter(function (p) { return p.status === 'ACEITO'; }), b = st.fila.filter(function (p) { return p.status === 'EM_PREPARACAO'; });
    h += '<div class="colunas"><section><h3>A preparar (' + a.length + ')</h3>' + (a.length ? a.map(ticket).join('') : '<div class="vazio">Nada na fila.</div>') + '</section>' +
      '<section><h3>Preparando (' + b.length + ')</h3>' + (b.length ? b.map(ticket).join('') : '<div class="vazio">Nada em preparo.</div>') + '</section></div>';
    return h;
  }

  // ================================================================ entregas

  function telaEntregas() {
    var lista = st.pedidos.filter(function (p) { return p.modalidade === 'entrega' && ['ACEITO', 'EM_PREPARACAO', 'PRONTO', 'SAIU_PARA_ENTREGA'].indexOf(p.status) >= 0; });
    var h = '<h2>Entregas</h2><p style="color:var(--texto-2);font-size:13px">Quando o pedido fica pronto, a entrega é oferecida sozinha ao entregador online (ele aceita ou recusa no celular). Você também pode escolher o entregador no pedido. Sem rastreamento: o status é atualizado por quem faz a entrega.</p>';
    if (!st.entregadores.length) h += '<div class="aviso-caixa">Nenhum entregador cadastrado. Cadastre em Equipe.</div>';
    else h += '<div class="caixa"><h3 style="margin-top:0">Entregadores agora</h3><div class="barra-acoes" style="margin:0">' + st.entregadores.filter(function (e) { return e.ativo !== false; }).map(function (e) {
      var n = st.pedidos.filter(function (p) { return p.entregador_id === e.id && ['ENTREGUE', 'CANCELADO'].indexOf(p.status) < 0; }).length;
      return '<span class="status ' + (e.online ? 'st-PRONTO' : 'st-CANCELADO') + '">' + (e.online ? '🟢 ' : '⚪ ') + esc(e.nome) + ' · ' + n + ' entrega(s)</span>';
    }).join('') + '</div><small style="color:var(--texto-2)">Cada entregador liga “Estou trabalhando” na tela dele: <a href="' + esc(comLoja('entregador.html')) + '" target="_blank" rel="noopener">entregador.html</a></small></div>';
    h += lista.length ? '<div class="lista-pedidos">' + lista.map(function (p) {
      var ent = st.entregadores.filter(function (e) { return e.id === p.entregador_id; })[0];
      return linhaPedido(p);
    }).join('') + '</div>' : '<div class="vazio">Nenhuma entrega em andamento.</div>';
    return h;
  }

  function telaMinhas() {
    var h = '<h2>Minhas entregas</h2>';
    if (!st.minhas.length) return h + '<div class="vazio">Nenhuma entrega com você agora.</div>';
    return h + st.minhas.map(function (p) {
      var e = p.endereco || {};
      var prox = N.proximosStatus('entrega', p.status).filter(function (s) { return s === 'SAIU_PARA_ENTREGA' || s === 'ENTREGUE'; });
      return '<div class="caixa"><h3 style="margin-top:0">#' + esc(p.numero) + ' · ' + esc(p.nome) + ' <span class="status st-' + p.status + '">' + N.STATUS_NOMES[p.status] + '</span></h3>' +
        '<div>📍 ' + esc(e.rua + ', ' + e.numero + ' — ' + e.bairro) + (e.complemento ? ' · ' + esc(e.complemento) : '') + (e.referencia ? '<br>Ref.: ' + esc(e.referencia) : '') + '</div>' +
        (p.telefone ? '<div>📞 <a href="tel:+' + esc(N.normalizarTelefone(p.telefone)) + '">' + esc(p.telefone) + '</a></div>' : '') +
        '<div>Cobrar: <b>' + N.reais(p.total) + '</b>' + (p.troco_para ? ' · troco para ' + N.reais(p.troco_para) : '') + '</div><div class="barra-acoes" style="margin-top:8px">' +
        prox.map(function (s) { return '<button class="btn btn-ouro" type="button" data-acao="status" data-id="' + esc(p.id) + '" data-para="' + s + '">' + NOMES_BOTAO[s] + '</button>'; }).join('') + '</div></div>';
    }).join('');
  }

  // ================================================================ cardápio do dia (tem / não tem)
  // Os grupos "do dia" (carne, feijão, acompanhamentos, salada…: obrigatórios ou sem preço) de cada categoria,
  // juntos numa lista só. Quentinha P e G têm os mesmos grupos: marcar "não tem" vale para as duas.
  // É o mesmo dado do cardápio: muda o que o cliente vê para escolher e o que sai no Post do dia.
  function gruposDoDia() {
    if (!st.adm) return [];
    var doDia = function (g) { return Number(g.minimo) >= 1 || (g.opcoes || []).every(function (o) { return !Number(o.preco); }); };
    var lista = [], porChave = {};
    st.adm.categorias.slice().sort(function (x, y) { return x.ordem - y.ordem; }).forEach(function (c) {
      st.adm.produtos.filter(function (p) { return p.categoria_id === c.id && p.ativo !== false; }).sort(function (x, y) { return x.ordem - y.ordem; }).forEach(function (p) {
        (p.grupos || []).filter(doDia).forEach(function (g) {
          var chave = c.id + '|' + g.nome + '|' + (g.opcoes || []).map(function (o) { return o.nome; }).sort().join('/');
          var item = porChave[chave];
          if (!item) { item = porChave[chave] = { categoria: c, nome: g.nome, opcoes: g.opcoes || [], produtos: [] }; lista.push(item); }
          item.produtos.push(p);
        });
      });
    });
    return lista;
  }

  function htmlCardapioDoDia() {
    var lista = gruposDoDia();
    st.diaGrupos = lista;
    if (!lista.length) return '';
    var h = '<div class="caixa dia-caixa"><h3 style="margin-top:0">🍛 Cardápio do dia: o que tem hoje</h3>' +
      '<p class="dia-ajuda">Toque no item para trocar entre <b>Tem</b> e <b>Não tem</b>. O cliente só consegue escolher o que tem, e o Post do dia mostra só o que tem. Faltou um item? Escreva no fim do grupo e toque em Acrescentar.</p>';
    var cat = null;
    lista.forEach(function (it, k) {
      if (it.categoria !== cat) { cat = it.categoria; h += '<h4 class="dia-cat">' + esc((cat.icone ? cat.icone + ' ' : '') + cat.nome) + '</h4>'; }
      var nomes = it.produtos.map(function (p) { return p.nome; });
      h += '<div class="dia-grupo"><div class="dia-nome">' + esc(it.nome) + ' <small>(' + esc(nomes.join(', ')) + ')</small></div><div class="dia-opcoes">' +
        it.opcoes.map(function (o) {
          var tem = o.disponivel !== false;
          return '<button type="button" class="dia-op' + (tem ? ' tem' : '') + '" data-acao="dia-tem" data-k="' + k + '" data-nome="' + esc(o.nome) + '" aria-pressed="' + tem + '">' +
            '<span aria-hidden="true">' + (tem ? '✅' : '⛔') + '</span><b>' + esc(o.nome) + '</b><em>' + (tem ? 'Tem' : 'Não tem') + '</em></button>';
        }).join('') + '</div>' +
        '<div class="dia-novo"><input type="text" id="dia-novo-' + k + '" maxlength="60" placeholder="Novo item em ' + esc(it.nome) + '" aria-label="Novo item em ' + esc(it.nome) + '">' +
        '<button class="btn btn-linha btn-peq" type="button" data-acao="dia-acrescentar" data-k="' + k + '">+ Acrescentar</button></div></div>';
    });
    return h + '</div>';
  }

  // Grava a mudança em todos os produtos do grupo (ex.: Quentinha P e G) e redesenha a aba atual.
  async function mudarDoDia(k, mudar, ok) {
    var it = st.diaGrupos[k];
    if (!it) return;
    try {
      for (var i = 0; i < it.produtos.length; i++) {
        var p = JSON.parse(JSON.stringify(it.produtos[i]));
        var g = p.grupos.filter(function (x) { return x.nome === it.nome; })[0];
        if (g) { mudar(g); await api.salvarProduto(p); }
      }
      toast(ok);
    } catch (e) { alert(e.message || 'Não foi possível salvar.'); }
    await irPara(st.aba);
  }

  // ================================================================ cardápio (admin)

  function telaCardapio() {
    var a = st.adm;
    var h = '<h2>Cardápio</h2><div class="barra-acoes"><button class="btn btn-ouro btn-peq" type="button" data-acao="novo-produto">+ Novo produto</button>' +
      '<button class="btn btn-linha btn-peq" type="button" data-acao="nova-categoria">+ Nova categoria</button>' +
      (abasLiberadas().indexOf('post') >= 0 ? '<button class="btn btn-linha btn-peq" type="button" data-acao="aba" data-aba="post">📣 Post do dia para o Status</button>' : '') + '</div>';
    h += htmlCardapioDoDia();
    h += '<div class="aviso-caixa">Itens com a etiqueta <b>Exemplo</b> são fictícios (preço a confirmar). Edite ou apague antes de divulgar o cardápio. Fotos: cole o endereço de uma imagem própria/autorizada no produto; sem foto, aparece o ícone.</div>';
    a.categorias.slice().sort(function (x, y) { return x.ordem - y.ordem; }).forEach(function (c) {
      var prods = a.produtos.filter(function (p) { return p.categoria_id === c.id; }).sort(function (x, y) { return x.ordem - y.ordem; });
      h += '<div class="caixa"><div class="barra-acoes" style="margin:0"><h3 style="margin:0;flex:1">' + esc((c.icone || '') + ' ' + c.nome) + (c.ativa === false ? ' <small>(oculta)</small>' : '') + '</h3>' +
        '<button class="btn btn-linha btn-peq" type="button" data-acao="editar-categoria" data-id="' + esc(c.id) + '">Editar categoria</button></div>';
      h += prods.length ? prods.map(function (p) {
        return '<div class="prod-adm"><div class="ic" aria-hidden="true">' + esc(p.icone || '🍽️') + '</div><div><b>' + esc(p.nome) + '</b> — ' + N.reais(p.preco) + '<br>' +
          (p.demonstracao ? '<span class="etiqueta etiqueta-demo">Exemplo</span>' : '<span class="etiqueta etiqueta-real">Confirmado</span>') +
          (p.disponivel === false ? '<span class="etiqueta etiqueta-esgotado">Esgotado</span>' : '') + (p.ativo === false ? '<span class="etiqueta etiqueta-esgotado">Oculto</span>' : '') +
          ((p.grupos || []).length ? '<small style="color:var(--texto-2)">' + p.grupos.length + ' grupo(s) de opções</small>' : '') + '</div>' +
          '<div class="acoes-prod"><button class="btn btn-linha btn-peq" type="button" data-acao="disponivel" data-id="' + esc(p.id) + '">' + (p.disponivel === false ? 'Marcar disponível' : 'Marcar esgotado') + '</button>' +
          '<button class="btn btn-linha btn-peq" type="button" data-acao="editar-produto" data-id="' + esc(p.id) + '">Editar</button>' +
          '<button class="btn btn-perigo btn-peq" type="button" data-acao="apagar-produto" data-id="' + esc(p.id) + '">Apagar</button></div></div>';
      }).join('') : '<p style="color:var(--texto-2)">Sem produtos.</p>';
      h += '</div>';
    });
    return h;
  }

  function editorCategoria(c) {
    c = c || { id: 'novo', nome: '', slug: '', descricao: '', icone: '', ordem: (st.adm.categorias.length + 1), ativa: true };
    abrirJanela('<div class="janela-cab"><h2 id="janela-titulo">' + (c.id === 'novo' ? 'Nova categoria' : 'Editar categoria') + '</h2><button class="fechar" type="button" data-acao="fechar" aria-label="Fechar">×</button></div>' +
      '<form id="form-categoria" data-id="' + esc(c.id) + '">' +
      '<div class="campo"><label for="c-nome">Nome *</label><input id="c-nome" required minlength="2" maxlength="60" value="' + esc(c.nome) + '"></div>' +
      '<div class="campo"><label for="c-slug">Código (sem espaço, usado nos horários) *</label><input id="c-slug" required pattern="[a-z0-9_\\-]{2,40}" maxlength="40" value="' + esc(c.slug) + '"' + (c.id !== 'novo' ? ' readonly' : '') + '><span class="ajuda">Ex.: almoco, lanches, jantar. Não muda depois de criado.</span></div>' +
      '<div class="campo"><label for="c-desc">Descrição</label><input id="c-desc" maxlength="300" value="' + esc(c.descricao || '') + '"></div>' +
      '<div class="linha-2"><div class="campo"><label for="c-icone">Ícone (emoji)</label><input id="c-icone" maxlength="8" value="' + esc(c.icone || '') + '"></div>' +
      '<div class="campo"><label for="c-ordem">Ordem</label><input id="c-ordem" type="number" min="0" max="999" value="' + esc(c.ordem) + '"></div></div>' +
      '<label class="chk"><input type="checkbox" id="c-ativa"' + (c.ativa !== false ? ' checked' : '') + '> Mostrar no cardápio</label>' +
      '<div class="rodape-janela">' + (c.id !== 'novo' ? '<button class="btn btn-perigo" type="button" data-acao="apagar-categoria" data-id="' + esc(c.id) + '">Apagar</button>' : '') +
      '<button class="btn btn-ouro" type="submit">Salvar</button></div></form>');
  }

  var produtoEditando = null;
  var seqNovo = 0;
  function idNovo() { seqNovo++; return 'novo-' + seqNovo; }

  function editorProduto(p) {
    produtoEditando = p ? JSON.parse(JSON.stringify(p)) : { id: idNovo(), categoria_id: st.adm.categorias[0] && st.adm.categorias[0].id, nome: '', descricao: '', preco: 0, icone: '🍽️', imagem_url: '',
      imagem_ilustrativa: true, disponivel: true, ativo: true, destaque: false, demonstracao: false, ingredientes_removiveis: [], permite_observacao: true, ordem: 99, grupos: [] };
    desenharEditorProduto();
  }

  function desenharEditorProduto() {
    var p = produtoEditando;
    var h = '<div class="janela-cab"><h2 id="janela-titulo">' + (String(p.id).indexOf('novo') === 0 ? 'Novo produto' : 'Editar produto') + '</h2><button class="fechar" type="button" data-acao="fechar" aria-label="Fechar">×</button></div><form id="form-produto">';
    h += '<div class="campo"><label for="p-nome">Nome *</label><input id="p-nome" required minlength="2" maxlength="80" value="' + esc(p.nome) + '"></div>';
    h += '<div class="campo"><label for="p-cat">Categoria *</label><select id="p-cat">' + st.adm.categorias.map(function (c) { return '<option value="' + esc(c.id) + '"' + (c.id === p.categoria_id ? ' selected' : '') + '>' + esc(c.nome) + '</option>'; }).join('') + '</select></div>';
    h += '<div class="campo"><label for="p-desc">Descrição</label><textarea id="p-desc" maxlength="400">' + esc(p.descricao || '') + '</textarea></div>';
    h += '<div class="linha-2"><div class="campo"><label for="p-preco">Preço (R$) *</label><input id="p-preco" type="number" step="0.01" min="0" max="5000" required value="' + esc(p.preco) + '"></div>' +
      '<div class="campo"><label for="p-ordem">Ordem</label><input id="p-ordem" type="number" min="0" max="999" value="' + esc(p.ordem) + '"></div></div>';
    h += '<div class="linha-2"><div class="campo"><label for="p-icone">Ícone (emoji)</label><input id="p-icone" maxlength="8" value="' + esc(p.icone || '') + '"></div>' +
      '<div class="campo"><label for="p-img">Endereço da foto (opcional)</label><input id="p-img" maxlength="500" placeholder="https://… ou assets/fotos/x.jpg" value="' + esc(p.imagem_url || '') + '"></div></div>';
    h += '<div class="campo"><label for="p-rem">Ingredientes que o cliente pode retirar (separe por vírgula)</label><input id="p-rem" maxlength="300" value="' + esc((p.ingredientes_removiveis || []).join(', ')) + '"></div>';
    h += '<div style="display:flex;flex-wrap:wrap;gap:4px 16px">' +
      '<label class="chk"><input type="checkbox" id="p-disp"' + (p.disponivel !== false ? ' checked' : '') + '> Disponível</label>' +
      '<label class="chk"><input type="checkbox" id="p-ativo"' + (p.ativo !== false ? ' checked' : '') + '> Mostrar no cardápio</label>' +
      '<label class="chk"><input type="checkbox" id="p-dest"' + (p.destaque ? ' checked' : '') + '> Destaque</label>' +
      '<label class="chk"><input type="checkbox" id="p-obs"' + (p.permite_observacao !== false ? ' checked' : '') + '> Aceita observação</label>' +
      '<label class="chk"><input type="checkbox" id="p-ilus"' + (p.imagem_ilustrativa !== false ? ' checked' : '') + '> Foto ilustrativa</label>' +
      '<label class="chk"><input type="checkbox" id="p-demo"' + (p.demonstracao ? ' checked' : '') + '> Exemplo (preço a confirmar)</label></div>';
    h += '<h3>Opções e adicionais</h3><p style="font-size:13px;color:var(--texto-2)">Ex.: “Carne” (mínimo 1, máximo 2). Máximo 1 vira escolha única.</p>';
    (p.grupos || []).forEach(function (g, gi) {
      h += '<div class="grupo-editor"><div class="linha-3"><div class="campo"><label>Nome do grupo</label><input data-g="' + gi + '" data-campo="nome" maxlength="60" value="' + esc(g.nome) + '"></div>' +
        '<div class="linha-2"><div class="campo"><label>Mín.</label><input type="number" min="0" max="20" data-g="' + gi + '" data-campo="minimo" value="' + esc(g.minimo) + '"></div>' +
        '<div class="campo"><label>Máx.</label><input type="number" min="1" max="20" data-g="' + gi + '" data-campo="maximo" value="' + esc(g.maximo) + '"></div></div></div>';
      (g.opcoes || []).forEach(function (o, oi) {
        h += '<div class="opcao-editor"><input type="text" aria-label="Nome da opção" maxlength="60" data-g="' + gi + '" data-o="' + oi + '" data-campo="nome" value="' + esc(o.nome) + '">' +
          '<input type="number" aria-label="Preço extra" step="0.01" min="0" data-g="' + gi + '" data-o="' + oi + '" data-campo="preco" value="' + esc(o.preco) + '">' +
          '<label class="chk" title="Disponível"><input type="checkbox" data-g="' + gi + '" data-o="' + oi + '" data-campo="disponivel"' + (o.disponivel !== false ? ' checked' : '') + '>tem</label>' +
          '<button class="btn btn-perigo btn-peq" type="button" data-acao="tirar-opcao" data-g="' + gi + '" data-o="' + oi + '" aria-label="Remover opção">×</button></div>';
      });
      h += '<div class="barra-acoes" style="margin:6px 0 0"><button class="btn btn-linha btn-peq" type="button" data-acao="mais-opcao" data-g="' + gi + '">+ Opção</button>' +
        '<button class="btn btn-perigo btn-peq" type="button" data-acao="tirar-grupo" data-g="' + gi + '">Remover grupo</button></div></div>';
    });
    h += '<button class="btn btn-linha btn-peq" type="button" data-acao="mais-grupo">+ Grupo de opções</button>';
    h += '<div class="erros-lista" id="erros-produto" role="alert"></div><div class="rodape-janela"><button class="btn btn-ouro" type="submit">Salvar produto</button></div></form>';
    var j = document.querySelector('#janela-raiz .janela');
    if (j) { var r = j.scrollTop; j.innerHTML = h; j.scrollTop = r; } else abrirJanela(h);
  }

  function lerEditorProduto() {
    var p = produtoEditando, v = function (id) { return document.getElementById(id); };
    if (!v('p-nome')) return;
    p.nome = v('p-nome').value.trim(); p.categoria_id = v('p-cat').value; p.descricao = v('p-desc').value.trim();
    p.preco = Number(v('p-preco').value); p.ordem = Number(v('p-ordem').value) || 0; p.icone = v('p-icone').value.trim() || null;
    p.imagem_url = v('p-img').value.trim() || null;
    p.ingredientes_removiveis = v('p-rem').value.split(',').map(function (x) { return x.trim(); }).filter(Boolean);
    p.disponivel = v('p-disp').checked; p.ativo = v('p-ativo').checked; p.destaque = v('p-dest').checked;
    p.permite_observacao = v('p-obs').checked; p.imagem_ilustrativa = v('p-ilus').checked; p.demonstracao = v('p-demo').checked;
    document.querySelectorAll('#form-produto [data-g]').forEach(function (el) {
      if (!el.dataset.campo) return;
      var g = p.grupos[Number(el.dataset.g)];
      var alvo = el.dataset.o !== undefined ? g.opcoes[Number(el.dataset.o)] : g;
      var c = el.dataset.campo;
      alvo[c] = el.type === 'checkbox' ? el.checked : (el.type === 'number' ? Number(el.value) : el.value.trim());
    });
  }

  function errosProduto(p) {
    var e = [];
    if (p.nome.length < 2) e.push('Nome do produto com pelo menos 2 letras.');
    if (!(p.preco >= 0 && p.preco <= 5000)) e.push('Preço inválido.');
    if (p.imagem_url && !/^(https?:\/\/|assets\/)/.test(p.imagem_url)) e.push('Endereço da foto deve começar com https:// ou assets/.');
    p.grupos.forEach(function (g) {
      if (String(g.nome).length < 2) e.push('Todo grupo precisa de nome.');
      if (!(g.maximo >= 1) || g.minimo < 0 || g.minimo > g.maximo) e.push('Grupo "' + g.nome + '": mínimo deve ser ≤ máximo e máximo ≥ 1.');
      if (!g.opcoes.length) e.push('Grupo "' + g.nome + '" sem opções.');
      if (g.minimo > g.opcoes.length) e.push('Grupo "' + g.nome + '": mínimo maior que o número de opções.');
      g.opcoes.forEach(function (o) { if (!String(o.nome).trim()) e.push('Opção sem nome em "' + g.nome + '".'); if (!(o.preco >= 0)) e.push('Preço de opção inválido.'); });
    });
    return e;
  }

  // ================================================================ horários (admin)

  function telaHorarios() {
    var a = st.adm;
    var h = '<h2>Horários do destaque</h2><p style="color:var(--texto-2);font-size:14px">O cardápio sempre mostra todas as categorias; aqui você escolhe qual fica em destaque em cada horário (fuso de Maceió). Intervalo que passa da meia-noite funciona (ex.: 18:00 às 05:59).</p>';
    h += '<form id="form-horarios">';
    a.destaques.slice().sort(function (x, y) { return x.ordem - y.ordem; }).forEach(function (d) {
      h += '<div class="caixa" data-periodo="' + esc(d.periodo) + '"><div class="campo"><label>Nome do destaque</label><input data-campo="titulo" maxlength="60" required value="' + esc(d.titulo) + '"></div>' +
        '<div class="linha-2"><div class="campo"><label>Início</label><input type="time" data-campo="inicio" required value="' + esc(d.inicio) + '"></div>' +
        '<div class="campo"><label>Fim (inclui este minuto)</label><input type="time" data-campo="fim" required value="' + esc(d.fim) + '"></div></div>' +
        '<div class="rotulo">Categorias em destaque</div><div style="display:flex;flex-wrap:wrap;gap:4px 14px">' + a.categorias.map(function (c) {
          return '<label class="chk"><input type="checkbox" data-campo="cat" value="' + esc(c.slug) + '"' + ((d.categorias || []).indexOf(c.slug) >= 0 ? ' checked' : '') + '> ' + esc(c.nome) + '</label>';
        }).join('') + '</div><label class="chk"><input type="checkbox" data-campo="ativo"' + (d.ativo !== false ? ' checked' : '') + '> Ativo</label></div>';
    });
    h += '<div id="previa-horarios"></div><button class="btn btn-ouro" type="submit">Salvar horários</button></form>';
    return h;
  }

  function lerHorarios() {
    return Array.prototype.map.call(document.querySelectorAll('#form-horarios [data-periodo]'), function (el, i) {
      var q = function (c) { return el.querySelector('[data-campo="' + c + '"]'); };
      var orig = st.adm.destaques.filter(function (d) { return d.periodo === el.dataset.periodo; })[0];
      return { periodo: el.dataset.periodo, titulo: q('titulo').value.trim(), inicio: q('inicio').value, fim: q('fim').value, ordem: orig ? orig.ordem : i + 1, ativo: q('ativo').checked,
        categorias: Array.prototype.filter.call(el.querySelectorAll('[data-campo="cat"]'), function (c) { return c.checked; }).map(function (c) { return c.value; }) };
    });
  }

  function previaHorarios() {
    var alvo = $('#previa-horarios');
    if (!alvo) return;
    var lista = lerHorarios();
    var agora = N.destaqueAtual(lista, new Date());
    var min = N.minutosNoFuso(new Date());
    var hora = ('0' + Math.floor(min / 60)).slice(-2) + ':' + ('0' + (min % 60)).slice(-2);
    var avisos = N.conferirHorarios(lista);
    alvo.innerHTML = '<div class="ok-caixa">Agora em Maceió: <b>' + hora + '</b> → destaque: <b>' + esc(agora ? agora.titulo : 'nenhum (cardápio completo)') + '</b></div>' +
      avisos.map(function (a) { return '<div class="aviso-caixa">' + esc(a) + '</div>'; }).join('');
  }

  // ================================================================ loja (admin)

  function telaLoja() {
    var l = st.adm.loja;
    var ch = function (id, rot, v) { return '<label class="chk"><input type="checkbox" id="' + id + '"' + (v ? ' checked' : '') + '> ' + rot + '</label>'; };
    var h = '<h2>Configurações da loja</h2><form id="form-loja">';
    h += '<div class="caixa">' + ch('lj-aberto', '<b>Recebendo pedidos agora</b> (desmarque para fechar a loja)', l.aberto) +
      '<div class="campo"><label for="lj-aviso">Aviso no topo do cardápio (opcional)</label><input id="lj-aviso" maxlength="200" value="' + esc(l.aviso || '') + '"></div></div>';
    h += '<div class="caixa"><div class="campo"><label for="lj-nome">Nome *</label><input id="lj-nome" required minlength="2" maxlength="80" value="' + esc(l.nome) + '"></div>' +
      htmlLogo(l.logo_url) +
      '<div class="campo"><label for="lj-zap">WhatsApp (com 55 e DDD) *</label><input id="lj-zap" inputmode="numeric" pattern="[0-9]{12,13}" required value="' + esc(l.whatsapp) + '"></div>' +
      '<div class="campo"><label for="lj-func">Horário de funcionamento (texto do rodapé)</label><input id="lj-func" maxlength="200" placeholder="Ex.: Todos os dias, 6h às 23h" value="' + esc(l.horario_funcionamento || '') + '"></div>' +
      '<div class="linha-2"><div class="campo"><label for="lj-cor">Cor da loja</label><input id="lj-cor" type="color" value="' + esc(/^#[0-9a-fA-F]{6}$/.test(l.cor || '') ? l.cor : '#f2552c') + '"><span class="ajuda">Aparece no cardápio e na vitrine do Pede Sul.</span></div>' +
      '<div class="campo"><label for="lj-mesas">Quantidade de mesas</label><input id="lj-mesas" type="number" min="0" max="200" value="' + esc(l.mesas_qtd || 0) + '"><span class="ajuda">Para a aba Mesas e o garçom.</span></div></div></div>';
    h += '<div class="caixa"><h3 style="margin-top:0">Modalidades</h3>' + ch('lj-ent', 'Entrega', l.aceita_entrega) + '<br>' + ch('lj-ret', 'Retirada no balcão', l.aceita_retirada) + '<br>' + ch('lj-loc', 'Consumo na loja', l.aceita_local) +
      '<div class="linha-2" style="margin-top:10px"><div class="campo"><label for="lj-taxa">Taxa de entrega (R$)</label><input id="lj-taxa" type="number" step="0.01" min="0" max="200" value="' + esc(l.taxa_entrega) + '"></div>' +
      '<div class="campo"><label for="lj-min">Pedido mínimo (R$)</label><input id="lj-min" type="number" step="0.01" min="0" value="' + esc(l.pedido_minimo) + '"></div></div>' +
      '<div class="linha-2"><div class="campo"><label for="lj-pent">Previsão de entrega (min)</label><input id="lj-pent" type="number" min="0" max="240" value="' + esc(l.previsao_entrega_min || '') + '"></div>' +
      '<div class="campo"><label for="lj-pret">Previsão de retirada (min)</label><input id="lj-pret" type="number" min="0" max="240" value="' + esc(l.previsao_retirada_min || '') + '"></div></div>' +
      '<div class="campo"><label for="lj-ploc">Previsão do consumo na loja (min)</label><input id="lj-ploc" type="number" min="0" max="240" value="' + esc(l.previsao_local_min || '') + '">' +
      '<span class="ajuda">O prazo de cada pedido (contagem regressiva) = hora em que chegou + estes minutos. Vazio = sem prazo. Mudar aqui não altera pedidos que já chegaram.</span></div>' +
      '<div class="campo"><label for="lj-mesa">Mesa no consumo na loja</label><select id="lj-mesa">' + [['desligado', 'Não perguntar mesa'], ['opcional', 'Mesa opcional'], ['obrigatoria', 'Mesa obrigatória']].map(function (o) {
        return '<option value="' + o[0] + '"' + (l.mesa_modo === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></div></div>';
    h += '<div class="caixa"><h3 style="margin-top:0">Formas de pagamento</h3><p style="font-size:13px;color:var(--texto-2)">Nenhum pagamento é cobrado pelo site. Pix online fica desligado até haver um provedor configurado e testado.</p><div id="lista-pag">' +
      (l.pagamentos || []).map(function (p, i) {
        return '<div class="opcao-editor" style="grid-template-columns:1fr auto"><input type="text" data-pag="' + i + '" data-campo="nome" maxlength="40" value="' + esc(p.nome) + '" aria-label="Nome da forma de pagamento">' +
          '<label class="chk"><input type="checkbox" data-pag="' + i + '" data-campo="ativo"' + (p.ativo !== false ? ' checked' : '') + '> ativa</label></div>';
      }).join('') + '</div><div class="barra-acoes"><input class="entrada" id="novo-pag" maxlength="40" placeholder="Outra forma (ex.: Vale-refeição)"><button class="btn btn-linha btn-peq" type="button" data-acao="mais-pag">+ Adicionar</button></div></div>';
    h += '<div class="caixa"><h3 style="margin-top:0">Pix do restaurante</h3><p style="font-size:13px;color:var(--texto-2)">O cardápio e o entregador mostram um QR Code com o valor do pedido para esta chave. O site não confirma pagamentos: a equipe ou o entregador marcam "recebido".</p>' +
      '<div class="campo"><label for="lj-pixchave">Chave Pix (telefone, e-mail, CPF/CNPJ ou chave aleatória)</label><input id="lj-pixchave" maxlength="77" value="' + esc(l.pix_chave || '') + '"><span class="ajuda">Telefone: escreva com DDD, ex.: 79996899727. Vazio = sem QR do Pix.</span></div>' +
      '<div class="linha-2"><div class="campo"><label for="lj-pixnome">Nome do recebedor</label><input id="lj-pixnome" maxlength="25" value="' + esc(l.pix_nome || '') + '"></div>' +
      '<div class="campo"><label for="lj-pixcidade">Cidade</label><input id="lj-pixcidade" maxlength="15" value="' + esc(l.pix_cidade || '') + '"></div></div></div>';
    h += '<div class="caixa"><div class="campo"><label for="lj-url">Endereço público do cardápio (para o QR Code)</label><input id="lj-url" maxlength="300" placeholder="https://…" value="' + esc(l.url_publica || '') + '"></div></div>';
    h += '<button class="btn btn-ouro" type="submit">Salvar configurações</button></form>';
    return h;
  }

  var LOGOS = { nova: 'assets/marca/selo_256.png', whatsapp: 'assets/marca/whatsapp_256.png' };

  function tipoLogo(url) {
    if (!url) return 'nenhuma';
    if (url === LOGOS.nova) return 'nova';
    if (url === LOGOS.whatsapp) return 'whatsapp';
    return 'outra';
  }

  function htmlLogo(url) {
    var t = tipoLogo(url);
    var op = function (v, rot) { return '<label class="opcao"><input type="radio" name="lj-logo-tipo" value="' + v + '"' + (t === v ? ' checked' : '') + '> ' + rot + '</label>'; };
    return '<div class="campo"><span class="rotulo">Logotipo</span><div style="display:flex;gap:14px;align-items:center;flex-wrap:wrap">' +
      '<span class="marca-selo" style="width:84px;height:84px" id="lj-logo-previa">' + (url ? '<img src="' + esc(url) + '" alt="Logo atual">' : 'A') + '</span>' +
      '<div class="opcoes-radio" style="flex:1;min-width:220px">' + op('nova', 'Logo nova (selo)') + op('whatsapp', 'Logo original do WhatsApp') +
      op('outra', 'Outra imagem (enviar arquivo ou endereço https)') + op('nenhuma', 'Sem logo (só o nome)') + '</div></div>' +
      '<div id="lj-logo-outra" class="' + (t === 'outra' ? '' : 'oculto') + '" style="margin-top:10px"><input type="file" id="lj-logo-arquivo" accept="image/png,image/jpeg,image/webp" aria-label="Enviar imagem do logotipo">' +
      '<span class="ajuda">A imagem é reduzida para 256 px. Ou cole um endereço https:</span><input id="lj-logo-url" class="entrada" maxlength="500" placeholder="https://…" value="' + esc(t === 'outra' && /^https:/.test(url || '') ? url : '') + '"></div>' +
      '<input type="hidden" id="lj-logo" value="' + esc(url || '') + '"></div>';
  }

  function mostrarLogo(url) {
    $('#lj-logo').value = url || '';
    $('#lj-logo-previa').innerHTML = url ? '<img src="' + esc(url) + '" alt="Logo escolhida">' : 'A';
  }

  // Reduz a imagem enviada para no máximo 256 px e guarda como data:image (sem depender de serviço de arquivos).
  function lerArquivoLogo(arquivo) {
    return new Promise(function (ok, falha) {
      if (!/^image\/(png|jpeg|webp)$/.test(arquivo.type)) return falha(new Error('Use uma imagem PNG, JPG ou WEBP.'));
      if (arquivo.size > 8 * 1024 * 1024) return falha(new Error('Imagem muito grande (máximo 8 MB).'));
      var img = new Image(), url = URL.createObjectURL(arquivo);
      img.onload = function () {
        var lado = Math.min(256, Math.max(img.width, img.height));
        var esc2 = lado / Math.max(img.width, img.height);
        var c = document.createElement('canvas');
        c.width = Math.round(img.width * esc2); c.height = Math.round(img.height * esc2);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        var dados = c.toDataURL('image/png');
        if (dados.length > 390000) dados = c.toDataURL('image/jpeg', 0.85);
        ok(dados);
      };
      img.onerror = function () { URL.revokeObjectURL(url); falha(new Error('Não foi possível ler a imagem.')); };
      img.src = url;
    });
  }

  function lerLoja() {
    var v = function (id) { return document.getElementById(id); };
    var l = st.adm.loja;
    document.querySelectorAll('#lista-pag [data-pag]').forEach(function (el) {
      var p = l.pagamentos[Number(el.dataset.pag)];
      if (el.dataset.campo === 'ativo') p.ativo = el.checked; else p.nome = el.value.trim() || p.nome;
    });
    return {
      aberto: v('lj-aberto').checked, aviso: v('lj-aviso').value.trim() || null, nome: v('lj-nome').value.trim(), logo_url: v('lj-logo').value.trim() || null,
      whatsapp: N.soDigitos(v('lj-zap').value), horario_funcionamento: v('lj-func').value.trim() || null,
      aceita_entrega: v('lj-ent').checked, aceita_retirada: v('lj-ret').checked, aceita_local: v('lj-loc').checked,
      taxa_entrega: Number(v('lj-taxa').value) || 0, pedido_minimo: Number(v('lj-min').value) || 0,
      previsao_entrega_min: v('lj-pent').value ? Number(v('lj-pent').value) : null, previsao_retirada_min: v('lj-pret').value ? Number(v('lj-pret').value) : null,
      previsao_local_min: v('lj-ploc').value ? Number(v('lj-ploc').value) : null,
      mesa_modo: v('lj-mesa').value, pagamentos: l.pagamentos, url_publica: v('lj-url').value.trim() || null,
      pix_chave: v('lj-pixchave').value.trim() || null, pix_nome: v('lj-pixnome').value.trim() || null, pix_cidade: v('lj-pixcidade').value.trim() || null,
      cor: v('lj-cor').value, mesas_qtd: Math.max(0, Math.min(200, Number(v('lj-mesas').value) || 0))
    };
  }

  // ================================================================ QR Code (admin)

  function urlCardapioPadrao() {
    var l = st.adm.loja;
    if (l.url_publica) return l.url_publica;
    return location.href.replace(/painel\.html.*$/, '').replace(/#.*$/, '') + comLoja('loja.html');
  }

  function telaQr() {
    var h = '<h2>QR Code do cardápio</h2><div class="caixa"><div class="campo"><label for="qr-url">Endereço do cardápio</label><input id="qr-url" value="' + esc(st.qrUrl || urlCardapioPadrao()) + '"></div>' +
      '<div class="campo"><label for="qr-mesa">Mesa (opcional — o QR já abre com “consumo na loja” e a mesa preenchida)</label><input id="qr-mesa" maxlength="20" value="' + esc(st.qrMesa || '') + '"></div>' +
      '<div class="barra-acoes"><button class="btn btn-linha btn-peq" type="button" data-acao="gerar-qr">Atualizar QR</button><button class="btn btn-ouro btn-peq" type="button" data-acao="imprimir-qr">🖨️ Imprimir cartaz</button>' +
      '<button class="btn btn-linha btn-peq" type="button" data-acao="salvar-url">Salvar este endereço como oficial</button></div><div id="aviso-qr"></div></div><div class="qr-area" id="qr-area"></div>';
    return h;
  }

  function urlQr() {
    var base = ($('#qr-url') ? $('#qr-url').value : urlCardapioPadrao()).trim();
    var mesa = ($('#qr-mesa') ? $('#qr-mesa').value : '').trim();
    if (!mesa) return base;
    return base + (base.indexOf('?') >= 0 ? '&' : '?') + 'mesa=' + encodeURIComponent(mesa);
  }

  function svgQr(texto) {
    var qr = window.qrcode(0, 'M');
    qr.addData(texto);
    qr.make();
    return qr.createSvgTag({ cellSize: 6, margin: 2, scalable: true });
  }

  function desenharQr() {
    var url = urlQr();
    st.qrUrl = $('#qr-url').value; st.qrMesa = $('#qr-mesa').value;
    var tipo = N.enderecoLocal(url);
    var aviso = '';
    if (tipo === 'invalido') aviso = '<div class="erro-caixa">Endereço inválido. Use algo como https://seusite/…</div>';
    else if (tipo === 'computador') aviso = '<div class="erro-caixa">Este endereço só abre NESTE computador. Um QR com ele não funciona no celular dos clientes. Publique o cardápio e use o endereço público (https).</div>';
    else if (tipo === 'rede') aviso = '<div class="aviso-caixa">Endereço da rede local: só funciona em celulares conectados ao mesmo Wi-Fi deste computador, e com este computador ligado.</div>';
    else if (!/^https:\/\//.test(url)) aviso = '<div class="aviso-caixa">Prefira um endereço https.</div>';
    if (api.modo === 'demo') aviso += '<div class="aviso-caixa">Modo demonstração: pedidos feitos por este QR ficam só no aparelho de quem pedir; não chegam ao restaurante.</div>';
    $('#aviso-qr').innerHTML = aviso;
    if (tipo === 'invalido') { $('#qr-area').innerHTML = ''; return; }
    var mesa = st.qrMesa.trim();
    $('#qr-area').innerHTML = '<h3>' + esc(st.adm.loja.nome) + '</h3><p style="margin:0 0 8px">Escaneie para ver o cardápio e fazer o pedido' + (mesa ? ' · Mesa ' + esc(mesa) : '') + '</p>' + svgQr(url) +
      '<p style="font-size:12px;word-break:break-all;margin:8px 0 0">' + esc(url) + '</p>';
  }

  function imprimirQr() {
    desenharQr();
    if (N.enderecoLocal(urlQr()) === 'computador' && !confirm('Este endereço só funciona neste computador. Imprimir mesmo assim?')) return;
    var mesa = st.qrMesa.trim();
    var logo = st.adm.loja.logo_url;
    $('#area-impressao').innerHTML = '<div class="cartaz-qr">' + (logo ? '<img src="' + esc(logo) + '" alt="" style="width:4cm;height:4cm;object-fit:contain;margin:0 auto 10px;display:block">' : '') + '<h1>' + esc(st.adm.loja.nome) + '</h1><p>Aponte a câmera do celular para ver o cardápio e pedir</p>' +
      (mesa ? '<p><b>Mesa ' + esc(mesa) + '</b></p>' : '') + svgQr(urlQr()) + '<p style="font-size:14px">' + esc(urlQr()) + '</p></div>';
    window.print();
  }

  // ================================================================ post do dia (Status do WhatsApp)

  var PD = window.AterrissePostDia;
  var CHAVE_POST = 'aterrisse_post_dia';
  function opcoesPostSalvas() { try { return JSON.parse(localStorage.getItem(CHAVE_POST) || '{}') || {}; } catch (e) { return {}; } }

  function telaPost() {
    var c = st.cardPub, l = c.loja, s = opcoesPostSalvas();
    var dest = N.destaqueAtual(c.destaques, new Date());
    var catPadrao = (dest && c.categorias.filter(function (x) { return (dest.categorias || []).indexOf(x.slug) >= 0; })[0]) || c.categorias[0];
    var catSel = c.categorias.filter(function (x) { return x.id === s.categoria; })[0] || catPadrao;
    var link = l.url_publica || location.href.replace(/painel\.html.*$/, '').replace(/#.*$/, '') + comLoja('loja.html');
    var op = function (v, rot, atual) { return '<option value="' + esc(v) + '"' + (v === atual ? ' selected' : '') + '>' + esc(rot) + '</option>'; };
    return '<h2>📣 Post do dia para o Status</h2>' +
      '<p style="color:var(--texto-2);font-size:14px;margin-top:0">A arte sai do próprio cardápio: só entram as opções e produtos <b>disponíveis</b>. Marcou algo como esgotado no Cardápio? Ele some do post. Depois toque em <b>Compartilhar</b> → WhatsApp → <b>Meu status</b>.</p>' +
      htmlCardapioDoDia() +
      '<div class="post-grade"><form id="form-post" class="caixa" onsubmit="return false">' +
      '<div class="campo"><label for="pd-cat">O que divulgar</label><select id="pd-cat">' + c.categorias.map(function (x) { return op(x.id, (x.icone ? x.icone + ' ' : '') + x.nome, catSel && catSel.id); }).join('') + '</select></div>' +
      '<div class="campo"><label for="pd-titulo">Título</label><input id="pd-titulo" maxlength="40" value="' + esc(s.titulo || 'Cardápio do Dia') + '"></div>' +
      '<div class="campo"><label for="pd-dia">Dia</label><input id="pd-dia" maxlength="24" value="' + esc(PD.diaDaSemana(new Date())) + '"></div>' +
      '<div class="campo"><label for="pd-chamada">Frase de propaganda</label><input id="pd-chamada" maxlength="60" value="' + esc(s.chamada || 'Peça pelo nosso delivery, sem fila e sem ligação!') + '"></div>' +
      '<div class="campo"><label for="pd-whats">WhatsApp do pedido</label><input id="pd-whats" maxlength="20" inputmode="tel" value="' + esc(PD.telefoneVisivel(s.whatsapp || l.whatsapp || '')) + '"></div>' +
      '<div class="campo"><label for="pd-link">Endereço do delivery</label><input id="pd-link" value="' + esc(s.link || link) + '"></div>' +
      '<div class="campo"><label for="pd-tema">Visual</label><select id="pd-tema">' + Object.keys(PD.TEMAS).map(function (k) { return op(k, PD.TEMAS[k].nome, s.tema || 'madeira'); }).join('') + '</select></div>' +
      '<div id="pd-aviso"></div>' +
      '<div class="barra-acoes"><button class="btn btn-ouro" type="button" data-acao="post-compartilhar">📲 Compartilhar (Status)</button>' +
      '<button class="btn btn-linha" type="button" data-acao="post-baixar">⬇ Baixar imagem</button>' +
      '<button class="btn btn-linha" type="button" data-acao="post-texto">📋 Copiar texto</button></div>' +
      '<p style="color:var(--texto-2);font-size:13px;margin:6px 0 0">No computador, use <b>Baixar imagem</b> e poste pelo celular. O texto copiado serve de legenda ou para mandar em grupos.</p>' +
      '</form><div class="post-previa"><canvas id="pd-canvas" width="1080" height="1920" aria-label="Prévia do post"></canvas></div></div>';
  }

  function lerPost() {
    var v = function (id) { var e = document.getElementById(id); return e ? e.value.trim() : ''; };
    var o = { categoria: v('pd-cat'), titulo: v('pd-titulo'), dia: v('pd-dia').toUpperCase(), chamada: v('pd-chamada'), whatsapp: v('pd-whats'), link: v('pd-link'), tema: v('pd-tema') };
    try { localStorage.setItem(CHAVE_POST, JSON.stringify({ categoria: o.categoria, titulo: o.titulo, chamada: o.chamada, whatsapp: o.whatsapp, link: o.link, tema: o.tema })); } catch (e) { /* sem memória local: segue */ }
    var post = PD.montar(st.cardPub, o.categoria);
    o.loja = st.cardPub.loja.nome; o.logo = st.cardPub.loja.logo_url;
    return { post: post, op: o };
  }

  var vezPost = 0;
  async function desenharPost() {
    var cv = $('#pd-canvas'); if (!cv) return;
    var d = lerPost(), minha = ++vezPost;
    var avisos = [];
    if (d.post.vazio) avisos.push('Nada disponível nesta categoria. Confira no Cardápio se os produtos estão marcados como disponíveis.');
    if (N.enderecoLocal(d.op.link)) avisos.push('O endereço do delivery é deste computador/rede: o cliente não vai conseguir abrir. Use o endereço público (https).');
    $('#pd-aviso').innerHTML = avisos.map(function (a) { return '<div class="aviso-caixa">' + esc(a) + '</div>'; }).join('');
    var tmp = document.createElement('canvas');
    await PD.desenhar(tmp, d.post, d.op);
    if (minha !== vezPost || !$('#pd-canvas')) return; // já pediram outro desenho
    var c2 = $('#pd-canvas').getContext('2d'); c2.clearRect(0, 0, 1080, 1920); c2.drawImage(tmp, 0, 0);
  }

  function nomeArquivoPost() { return 'cardapio-do-dia-' + N.diaNoFuso(new Date()) + '.png'; }

  // ================================================================ relatórios (admin)

  function telaRelatorios() {
    var hoje = N.diaNoFuso(new Date());
    var ini = st.relIni || N.diaNoFuso(new Date(Date.now() - 6 * 86400000));
    var fim = st.relFim || hoje;
    var h = '<h2>Relatórios</h2><form id="form-rel" class="barra-acoes"><label class="sr" for="r-ini">Início</label><input class="entrada" type="date" id="r-ini" value="' + ini + '">' +
      '<label class="sr" for="r-fim">Fim</label><input class="entrada" type="date" id="r-fim" value="' + fim + '"><button class="btn btn-ouro btn-peq" type="submit">Gerar</button></form>';
    var r = st.rel;
    if (!r) return h + '<div class="vazio">Escolha o período e toque em Gerar.</div>';
    var vendas = Number(r.vendas);
    h += '<div class="cartoes-resumo"><div class="cartao-num"><span>Pedidos</span><strong>' + r.pedidos + '</strong></div><div class="cartao-num"><span>Vendas</span><strong>' + N.reais(vendas) + '</strong></div>' +
      '<div class="cartao-num"><span>Ticket médio</span><strong>' + (r.pedidos ? N.reais(vendas / r.pedidos) : '—') + '</strong></div><div class="cartao-num"><span>Cancelados</span><strong>' + r.cancelados + '</strong></div></div>';
    if (!r.pedidos) return h + '<div class="vazio">Nenhum pedido no período.</div>';
    h += '<div class="caixa rolagem-x"><h3 style="margin-top:0">Por dia</h3><table class="tabela"><thead><tr><th>Dia</th><th>Pedidos</th><th>Vendas</th></tr></thead><tbody>' +
      r.por_dia.map(function (d) { return '<tr><td>' + esc(String(d.dia).split('-').reverse().join('/')) + '</td><td>' + d.pedidos + '</td><td>' + N.reais(d.vendas) + '</td></tr>'; }).join('') + '</tbody></table></div>';
    h += '<div class="caixa rolagem-x"><h3 style="margin-top:0">Mais pedidos</h3><table class="tabela"><thead><tr><th>Produto</th><th>Qtd.</th><th>Valor</th></tr></thead><tbody>' +
      r.mais_pedidos.map(function (m) { return '<tr><td>' + esc(m.nome) + '</td><td>' + m.quantidade + '</td><td>' + N.reais(m.valor) + '</td></tr>'; }).join('') + '</tbody></table></div>';
    h += '<p style="font-size:13px;color:var(--texto-2)">Contam só pedidos reais gravados (cancelados ficam fora das vendas). Datas no horário de Maceió.</p>';
    return h;
  }

  // ================================================================ equipe (admin)

  function telaEquipe() {
    var h = '<h2>Equipe</h2>';
    if (api.modo === 'demo' || api.vitrine) h += '<div class="aviso-caixa">No modo demonstração não há contas de equipe: o painel usa só a senha deste navegador.</div>';
    else {
      h += '<div class="caixa"><h3 style="margin-top:0">Pessoas com acesso</h3>' + (st.equipe.length ? '<div class="rolagem-x"><table class="tabela"><thead><tr><th>Nome</th><th>Papel</th><th>Ativo</th></tr></thead><tbody>' +
        st.equipe.map(function (m) {
          return '<tr><td>' + esc(m.nome) + (m.usuario ? '<br><small style="color:var(--texto-2)">usuário: ' + esc(m.usuario) + '</small>' : '') +
            (m.usuario ? '<br><button class="btn btn-linha btn-peq" type="button" data-acao="trocar-senha" data-id="' + esc(m.user_id) + '" data-nome="' + esc(m.nome) + '" style="margin-top:4px">Nova senha</button>' : '') + '</td><td><select data-acao="papel-membro" data-id="' + esc(m.user_id) + '" aria-label="Papel de ' + esc(m.nome) + '">' + Object.keys(NOMES_PAPEL).map(function (p) {
            return '<option value="' + p + '"' + (m.papel === p ? ' selected' : '') + '>' + NOMES_PAPEL[p] + '</option>'; }).join('') + '</select></td>' +
            '<td><input type="checkbox" data-acao="ativo-membro" data-id="' + esc(m.user_id) + '"' + (m.ativo ? ' checked' : '') + ' aria-label="Ativo"></td></tr>';
        }).join('') + '</tbody></table></div>' : '<p>Ninguém além de você.</p>') +
        '<h3>Criar acesso</h3><p style="font-size:13px;color:var(--texto-2)">Sem e-mail: você escolhe o usuário e a senha e passa para a pessoa. Ela entra com eles no painel (ou na tela do entregador).</p>' +
        '<form id="form-membro"><div class="linha-2"><div class="campo"><label for="m-nome">Nome</label><input id="m-nome" required minlength="2" maxlength="80"></div>' +
        '<div class="campo"><label for="m-papel">Papel</label><select id="m-papel">' + Object.keys(NOMES_PAPEL).map(function (p) { return '<option value="' + p + '"' + (p === 'atendente' ? ' selected' : '') + '>' + NOMES_PAPEL[p] + '</option>'; }).join('') + '</select></div></div>' +
        '<div class="linha-2"><div class="campo"><label for="m-usuario">Usuário</label><input id="m-usuario" required minlength="3" maxlength="30" autocapitalize="none" autocorrect="off" spellcheck="false" placeholder="ex.: maria"><span class="ajuda">Sem acento e sem espaço.</span></div>' +
        '<div class="campo"><label for="m-senha">Senha</label><input id="m-senha" type="text" required minlength="4" maxlength="72" autocomplete="new-password" value="' + (st.lojaPub && st.lojaPub.modo === 'real' ? '' : SENHA_TESTE) + '"><span class="ajuda">' + (st.lojaPub && st.lojaPub.modo === 'real' ? 'Loja vendendo de verdade: 8 ou mais, com letras e números. A pessoa cria a definitiva no primeiro acesso.' : 'Loja em teste: senha ' + SENHA_TESTE + '. A definitiva é pedida quando a loja vender de verdade.') + '</span></div></div>' +
        '<button class="btn btn-ouro btn-peq" type="submit">Criar acesso</button></form></div>';
    }
    h += '<div class="caixa"><h3 style="margin-top:0">Entregadores</h3>' + (st.entregadores.length ? st.entregadores.map(function (e) {
      return '<div class="barra-acoes" style="margin-bottom:6px"><span style="flex:1">🛵 ' + esc(e.nome) + (e.telefone ? ' · ' + esc(e.telefone) : '') + (e.user_id ? ' · tem login' : '') + (e.ativo === false ? ' (inativo)' : '') + '</span>' +
        '<button class="btn btn-linha btn-peq" type="button" data-acao="ativo-entregador" data-id="' + esc(e.id) + '">' + (e.ativo === false ? 'Ativar' : 'Desativar') + '</button></div>';
    }).join('') : '<p>Nenhum entregador.</p>') +
      '<form id="form-entregador" class="barra-acoes"><input class="entrada" id="e-nome" required minlength="2" maxlength="80" placeholder="Nome" aria-label="Nome do entregador">' +
      '<input class="entrada" id="e-tel" inputmode="tel" maxlength="20" placeholder="Telefone (opcional)" aria-label="Telefone do entregador"><button class="btn btn-ouro btn-peq" type="submit">+ Entregador</button></form>' +
      '<p style="font-size:13px;color:var(--texto-2)">Cada entregador tem tela própria no celular: <a href="' + esc(comLoja('entregador.html')) + '" target="_blank" rel="noopener">entregador.html</a>. Crie o acesso dele acima com o papel “Entregador”. Ele vê só as entregas dele, com prazo, endereço e botão do mapa.</p>' +
      '<p style="font-size:13px;color:var(--texto-2)">A cozinha também tem tela própria (tablet ou monitor): <a href="' + esc(comLoja('cozinha.html')) + '" target="_blank" rel="noopener">cozinha.html</a>, com acesso de papel “Cozinha”. Ela vê só os pedidos a preparar, sem valores nem dados do cliente.</p></div>';
    return h;
  }

  // ================================================================ montar pedido (venda no balcão e garçom) — do CONIS
  // Lista de produtos com botão +; produto com opções abre a escolha das opções. Usa as mesmas regras do cardápio do cliente.

  var montar = null; // { tipo: 'balcao' | 'mesa', mesa, itens: [{produto_id, quantidade, adicionais, removidos, observacao}], escolhendo: produto_id, marcadas: [] }

  function abrirMontador(tipo, mesa) {
    montar = { tipo: tipo, mesa: mesa || null, itens: [], escolhendo: null, marcadas: [], busca: '' };
    desenharMontador();
  }
  function totalMontador() { return N.totaisSacola(montar.itens, st.cardPub, null).subtotal; }
  function desenharMontador() {
    var c = st.cardPub, m = montar;
    var titulo = m.tipo === 'mesa' ? 'Lançar pedido · Mesa ' + esc(m.mesa) : 'Venda no balcão';
    var h = '<div class="janela-cab"><h2 id="janela-titulo">' + titulo + '</h2><button class="fechar" type="button" data-acao="fechar" aria-label="Fechar">×</button></div>';
    if (m.escolhendo) {
      var p = N.acharProduto(c, m.escolhendo);
      h += '<div class="resumo-bloco"><b>' + esc(p.nome) + '</b> — ' + N.reais(p.preco) + '</div>';
      (p.grupos || []).forEach(function (g) {
        h += '<div class="rotulo" style="margin-top:8px">' + esc(g.nome) + ' <small>(' + (g.minimo ? 'escolha ' + (g.minimo === g.maximo ? g.minimo : g.minimo + ' a ' + g.maximo) : 'até ' + g.maximo) + ')</small></div><div style="display:flex;flex-wrap:wrap;gap:4px 14px">' +
          g.opcoes.map(function (o) {
            return '<label class="chk' + (o.disponivel === false ? ' desativada' : '') + '"><input type="checkbox" data-acao="montar-opcao" value="' + esc(o.id) + '"' + (m.marcadas.indexOf(o.id) >= 0 ? ' checked' : '') + (o.disponivel === false ? ' disabled' : '') + '> ' +
              esc(o.nome) + (Number(o.preco) ? ' (+' + N.reais(o.preco) + ')' : '') + (o.disponivel === false ? ' (acabou)' : '') + '</label>';
          }).join('') + '</div>';
      });
      h += '<div class="erros-lista" id="erros-montar" role="alert"></div><div class="rodape-janela"><button class="btn btn-linha" type="button" data-acao="montar-voltar">Voltar</button>' +
        '<button class="btn btn-ouro" type="button" data-acao="montar-confirmar">Adicionar</button></div>';
    } else {
      h += '<input class="entrada" type="search" id="montar-busca" placeholder="Buscar produto" value="' + esc(m.busca) + '" aria-label="Buscar produto" style="width:100%;margin-bottom:8px">';
      var termo = m.busca.trim().toLowerCase();
      c.categorias.forEach(function (cat) {
        var ps = c.produtos.filter(function (x) { return x.categoria_id === cat.id && (!termo || x.nome.toLowerCase().indexOf(termo) >= 0); });
        if (!ps.length) return;
        h += '<div class="rotulo" style="margin-top:8px">' + esc((cat.icone ? cat.icone + ' ' : '') + cat.nome) + '</div><div class="montar-lista">' + ps.map(function (x) {
          return '<button type="button" class="montar-prod" data-acao="montar-produto" data-id="' + esc(x.id) + '"' + (x.disponivel === false ? ' disabled' : '') + '><span>' + esc(x.icone || '🍽️') + ' ' + esc(x.nome) + '</span><b>' + (x.disponivel === false ? 'esgotado' : N.reais(x.preco)) + '</b></button>';
        }).join('') + '</div>';
      });
      h += '<h3>Itens</h3>' + (m.itens.length ? m.itens.map(function (it, i) {
        var pr = N.acharProduto(c, it.produto_id);
        var op = N.opcoesEscolhidas(pr, it.adicionais).map(function (o) { return o.nome; }).join(', ');
        return '<div class="item-sacola" style="grid-template-columns:1fr auto"><div><b>' + it.quantidade + '× ' + esc(pr.nome) + '</b>' + (op ? '<div class="det">' + esc(op) + '</div>' : '') + '</div>' +
          '<div class="qtd"><button type="button" data-acao="montar-qtd" data-i="' + i + '" data-delta="-1" aria-label="Diminuir">−</button><span>' + it.quantidade + '</span><button type="button" data-acao="montar-qtd" data-i="' + i + '" data-delta="1" aria-label="Aumentar">+</button></div></div>';
      }).join('') : '<div class="vazio">Toque nos produtos para adicionar.</div>');
      h += '<div class="totais"><div class="total"><span>Total</span><span>' + N.reais(totalMontador()) + '</span></div></div>';
      if (m.tipo === 'balcao') {
        h += '<div class="linha-2"><div class="campo"><label for="mt-nome">Nome do cliente (opcional)</label><input id="mt-nome" maxlength="80"></div>' +
          '<div class="campo"><label for="mt-tel">Telefone (opcional)</label><input id="mt-tel" inputmode="tel" maxlength="20" data-acao="montar-tel"><span class="ajuda" id="mt-cliente"></span></div></div>' +
          '<div class="campo"><label for="mt-pag">Pagamento</label><select id="mt-pag">' + [['dinheiro', '💵 Dinheiro'], ['cartao', '💳 Cartão'], ['pix', '📱 Pix']].map(function (f) { return '<option value="' + f[0] + '">' + f[1] + '</option>'; }).join('') + '</select></div>' +
          '<label class="chk"><input type="checkbox" id="mt-pago" checked> Recebido agora (entra no caixa)</label>';
      } else {
        h += '<div class="campo"><label for="mt-garcom">Garçom</label><input id="mt-garcom" maxlength="40" value="' + esc(st.garcom || '') + '"></div>' +
          '<div class="campo"><label for="mt-obs">Observação para a cozinha (opcional)</label><input id="mt-obs" maxlength="200"></div>';
      }
      h += '<div class="erros-lista" id="erros-montar" role="alert"></div><div class="rodape-janela"><button class="btn btn-ouro" type="button" data-acao="montar-enviar"' + (m.itens.length ? '' : ' disabled') + '>' +
        (m.tipo === 'mesa' ? 'Enviar para a cozinha' : 'Registrar venda') + ' · ' + N.reais(totalMontador()) + '</button></div>';
    }
    var j = document.querySelector('#janela-raiz .janela');
    if (j && j.dataset.montador) { var r = j.scrollTop; j.innerHTML = h; j.scrollTop = m.escolhendo ? 0 : r; } else { abrirJanela(h); document.querySelector('#janela-raiz .janela').dataset.montador = '1'; }
  }
  function adicionarAoMontador(item) {
    item.chave = N.chaveItem(item);
    var igual = montar.itens.filter(function (i) { return i.chave === item.chave; })[0];
    if (igual) igual.quantidade = Math.min(50, igual.quantidade + 1); else montar.itens.push(item);
  }

  // ================================================================ caixa — do CONIS

  function telaCaixa() {
    var cx = st.caixa, h = '<h2>💰 Caixa</h2>';
    if (!cx.aberto) {
      h += '<form id="form-abrir-caixa" class="caixa"><h3 style="margin-top:0">Caixa fechado</h3><p style="color:var(--texto-2);font-size:14px;margin-top:0">Abra o caixa no começo do expediente com o dinheiro de troco que está na gaveta. As vendas recebidas a partir daí entram na conta do caixa.</p>' +
        '<div class="campo"><label for="cx-inicial">Dinheiro na gaveta para troco (R$)</label><input id="cx-inicial" type="number" step="0.01" min="0" required value="0"></div>' +
        '<button class="btn btn-ouro" type="submit">Abrir caixa</button></form>';
    } else {
      h += '<div class="cartoes-resumo">' +
        '<div class="cartao-num"><span>Aberto desde</span><strong>' + esc(N.horaCurta(cx.aberto_em)) + '</strong></div>' +
        '<div class="cartao-num"><span>Recebido no caixa</span><strong>' + N.reais(cx.vendas) + '</strong></div>' +
        '<div class="cartao-num"><span>Dinheiro na gaveta</span><strong>' + N.reais(cx.dinheiro_esperado) + '</strong></div>' +
        '<div class="cartao-num"><span>A receber</span><strong>' + N.reais(cx.a_receber) + '</strong></div></div>';
      h += '<div class="barra-acoes"><button class="btn btn-ouro" type="button" data-acao="venda-balcao">+ Venda no balcão</button></div>';
      h += '<div class="caixa"><h3 style="margin-top:0">Recebido por forma</h3>' + (Object.keys(cx.por_forma).length ? Object.keys(cx.por_forma).map(function (f) {
        return '<div class="barra-acoes" style="margin:0 0 4px"><span style="flex:1">' + esc(NOMES_PAG[f] || f) + '</span><b>' + N.reais(cx.por_forma[f]) + '</b></div>';
      }).join('') : '<p style="margin:0">Nada recebido ainda.</p>') +
        '<p style="font-size:13px;color:var(--texto-2);margin:8px 0 0">Gaveta = troco inicial ' + N.reais(cx.valor_inicial) + ' + dinheiro recebido + suprimentos ' + N.reais(cx.suprimentos) + ' − sangrias ' + N.reais(cx.sangrias) + '.</p></div>';
      var pend = st.pedidos.filter(function (p) { return p.pagamento_status === 'PENDENTE' && p.status !== 'CANCELADO'; });
      h += '<h3>A receber (' + pend.length + ')</h3>' + (pend.length ? '<div class="lista-pedidos">' + pend.map(linhaPedido).join('') + '</div>' : '<div class="vazio">Nenhum pedido esperando pagamento.</div>');
      h += '<form id="form-mov-caixa" class="caixa"><h3 style="margin-top:0">Sangria ou suprimento</h3><div class="linha-2"><div class="campo"><label for="mv-tipo">Tipo</label><select id="mv-tipo"><option value="sangria">Sangria (tirar dinheiro)</option><option value="suprimento">Suprimento (colocar dinheiro)</option></select></div>' +
        '<div class="campo"><label for="mv-valor">Valor (R$)</label><input id="mv-valor" type="number" step="0.01" min="0.01" required></div></div>' +
        '<div class="campo"><label for="mv-motivo">Motivo</label><input id="mv-motivo" required minlength="3" maxlength="120"></div><button class="btn btn-linha btn-peq" type="submit">Registrar</button>' +
        (cx.movimentos.length ? '<ul style="margin:10px 0 0;padding-left:18px;font-size:14px">' + cx.movimentos.map(function (m) { return '<li>' + esc(N.horaCurta(m.em)) + ' · ' + (m.tipo === 'sangria' ? '−' : '+') + ' ' + N.reais(m.valor) + ' · ' + esc(m.motivo) + '</li>'; }).join('') + '</ul>' : '') + '</form>';
      h += '<form id="form-fechar-caixa" class="caixa"><h3 style="margin-top:0">Fechar caixa</h3><p style="font-size:14px;color:var(--texto-2);margin-top:0">Conte o dinheiro da gaveta e digite abaixo. O sistema mostra se sobrou ou faltou.</p>' +
        '<div class="campo"><label for="cx-contado">Dinheiro contado na gaveta (R$)</label><input id="cx-contado" type="number" step="0.01" min="0" required></div>' +
        (cx.pedidos_a_receber ? '<div class="aviso-caixa">' + cx.pedidos_a_receber + ' pedido(s) deste caixa ainda sem pagamento marcado.</div>' : '') +
        '<button class="btn btn-perigo" type="submit">Fechar caixa</button></form>';
    }
    if (cx.fechamentos && cx.fechamentos.length) {
      h += '<div class="caixa rolagem-x"><h3 style="margin-top:0">Últimos fechamentos</h3><table class="tabela"><thead><tr><th>Fechado em</th><th>Recebido</th><th>Gaveta esperada</th><th>Contado</th><th>Diferença</th></tr></thead><tbody>' +
        cx.fechamentos.map(function (f) {
          return '<tr><td>' + esc(N.dataHora(f.fechado_em)) + '</td><td>' + N.reais(f.vendas) + '</td><td>' + N.reais(f.dinheiro_esperado) + '</td><td>' + N.reais(f.dinheiro_contado) + '</td>' +
            '<td style="color:' + (f.diferenca < 0 ? 'var(--erro)' : f.diferenca > 0 ? 'var(--aviso)' : 'var(--ok)') + '">' + (f.diferenca > 0 ? '+' : '') + N.reais(f.diferenca) + '</td></tr>';
        }).join('') + '</tbody></table></div>';
    }
    return h;
  }

  // ================================================================ mesas e garçom — do CONIS

  function telaMesas() {
    var h = '<h2>🍽️ Mesas</h2><p style="color:var(--texto-2);font-size:14px;margin-top:0">Toque na mesa para lançar pedido ou ver a conta. O pedido vai direto para a cozinha. A conta só fecha quando tudo da mesa ficou pronto. Pedidos feitos pelo QR Code da mesa também aparecem aqui.</p>';
    if (!st.mesas.length) return h + '<div class="aviso-caixa">Nenhuma mesa cadastrada. Defina a quantidade em Loja.</div>';
    h += '<div class="mesas-grade">' + st.mesas.map(function (m) {
      return '<button type="button" class="mesa-cartao' + (m.ocupada ? ' ocupada' : '') + '" data-acao="abrir-mesa" data-mesa="' + m.numero + '"><b>Mesa ' + m.numero + '</b>' +
        (m.ocupada ? '<span>' + N.reais(m.total) + '</span><small>desde ' + esc(N.horaCurta(m.desde)) + (m.pronta_para_fechar ? ' · pronta para fechar' : ' · na cozinha') + '</small>' : '<small>Livre</small>') + '</button>';
    }).join('') + '</div>';
    return h;
  }
  function mesaAtual(n) { return st.mesas.filter(function (m) { return String(m.numero) === String(n); })[0]; }
  function abrirMesa(n) {
    var m = mesaAtual(n);
    if (!m) return;
    var h = '<div class="janela-cab"><h2 id="janela-titulo">Mesa ' + esc(n) + '</h2><button class="fechar" type="button" data-acao="fechar" aria-label="Fechar">×</button></div>';
    if (!m.ocupada) h += '<div class="vazio">Mesa livre.</div>';
    else {
      h += m.pedidos.map(function (p) {
        return '<div class="resumo-bloco"><b>#' + esc(p.numero) + '</b> <span class="status st-' + p.status + '">' + N.STATUS_NOMES[p.status] + '</span>' + (p.garcom ? ' · ' + esc(p.garcom) : '') +
          '<ul style="margin:6px 0;padding-left:18px">' + p.itens.map(function (i) { return '<li>' + i.quantidade + '× ' + esc(i.nome) + ' — ' + N.reais(i.total) + '</li>'; }).join('') + '</ul></div>';
      }).join('');
      h += '<div class="totais"><div class="total"><span>Total da mesa</span><span>' + N.reais(m.total) + '</span></div></div>';
      if (window.AterrissePix && st.cardPub && st.cardPub.loja.pix_chave) h += '<button class="btn btn-linha btn-peq" type="button" data-acao="pix-mesa" data-mesa="' + esc(n) + '">📱 ' + (st.pixMesa === String(n) ? 'Esconder' : 'Mostrar') + ' QR do Pix</button>' +
        (st.pixMesa === String(n) ? window.AterrissePix.bloco(st.cardPub.loja, m.total, 'MESA' + n, 'Mostre ao cliente na mesa.') : '');
      h += m.pronta_para_fechar ? '<div style="margin-top:10px;font-weight:800">Fechar a conta, recebido em:</div><div class="barra-acoes" style="margin-top:6px">' + [['dinheiro', '💵 Dinheiro'], ['cartao', '💳 Cartão'], ['pix', '📱 Pix']].map(function (f) {
        return '<button class="btn btn-ouro btn-peq" type="button" data-acao="fechar-mesa" data-mesa="' + esc(n) + '" data-forma="' + f[0] + '">' + f[1] + '</button>';
      }).join('') + '</div>' : '<div class="aviso-caixa">Ainda tem pedido desta mesa na cozinha. A conta fecha quando tudo ficar pronto.</div>';
      h += '<div class="barra-acoes"><button class="btn btn-linha btn-peq" type="button" data-acao="imprimir-mesa" data-mesa="' + esc(n) + '">🖨️ Imprimir conta</button></div>';
    }
    h += '<div class="rodape-janela"><button class="btn btn-ouro" type="button" data-acao="lancar-mesa" data-mesa="' + esc(n) + '">+ Lançar pedido</button></div>';
    abrirJanela(h);
  }

  // ================================================================ clientes — do CONIS (só a equipe vê)

  function telaClientes() {
    var b = (st.buscaCliente || '').trim().toLowerCase(), bd = N.soDigitos(b);
    var lista = st.clientes.filter(function (c) { return !b || String(c.nome).toLowerCase().indexOf(b) >= 0 || (bd && String(c.telefone).indexOf(bd) >= 0); });
    var h = '<h2>Clientes</h2><p style="color:var(--texto-2);font-size:14px;margin-top:0">Montado sozinho a partir dos pedidos com telefone. Só a equipe vê. O cliente no cardápio não consegue procurar ninguém.</p>' +
      '<div class="barra-acoes"><input class="entrada" type="search" id="busca-cliente" placeholder="Nome ou telefone" value="' + esc(st.buscaCliente || '') + '" aria-label="Buscar cliente"></div>';
    if (!lista.length) return h + '<div class="vazio">' + (st.clientes.length ? 'Ninguém encontrado.' : 'Nenhum cliente ainda.') + '</div>';
    return h + '<div class="caixa rolagem-x"><table class="tabela"><thead><tr><th>Cliente</th><th>Bairro</th><th>Pedidos</th><th>Total</th><th>Último</th><th></th></tr></thead><tbody>' + lista.map(function (c) {
      return '<tr><td><b>' + esc(c.nome) + '</b><br><small>' + esc(c.telefone) + '</small></td><td>' + esc(c.endereco ? c.endereco.bairro : '—') + '</td><td>' + c.pedidos + '</td><td>' + N.reais(c.total) + '</td>' +
        '<td>' + esc(N.dataHora(c.ultimo_em)) + '</td><td><a class="btn btn-linha btn-peq" target="_blank" rel="noopener" href="' + esc(N.linkWhatsApp(N.normalizarTelefone(c.telefone), 'Olá, ' + String(c.nome).split(' ')[0] + '!')) + '">WhatsApp</a></td></tr>';
    }).join('') + '</tbody></table></div>';
  }

  // ================================================================ impressão (comanda e conta) — do CONIS

  function imprimir(html) {
    $('#area-impressao').innerHTML = '<div class="comanda">' + html + '</div>';
    window.print();
  }
  function htmlComanda(p) {
    var l = st.lojaPub || {};
    return '<h1>' + esc(l.nome || '') + '</h1><p><b>Pedido #' + esc(p.numero) + '</b> · ' + esc(N.dataHora(p.criado_em)) + '<br>' + esc(N.MODALIDADE_NOMES[p.modalidade]) + (p.mesa ? ' · Mesa ' + esc(p.mesa) : '') + '</p>' +
      '<p>' + esc(p.nome) + (p.telefone ? ' · ' + esc(p.telefone) : '') + (p.endereco ? '<br>' + esc(p.endereco.rua + ', ' + p.endereco.numero + ' — ' + p.endereco.bairro) + (p.endereco.complemento ? ' · ' + esc(p.endereco.complemento) : '') + (p.endereco.referencia ? '<br>Ref.: ' + esc(p.endereco.referencia) : '') : '') + '</p><hr>' +
      p.itens.map(function (i) {
        var d = (i.adicionais || []).map(function (a) { return a.nome; }).join(', ');
        return '<p><b>' + i.quantidade + '× ' + esc(i.nome) + '</b> ' + N.reais(i.total) + (d ? '<br>' + esc(d) : '') + (i.removidos && i.removidos.length ? '<br>SEM: ' + esc(i.removidos.join(', ')) : '') + (i.observacao ? '<br>OBS.: ' + esc(i.observacao) : '') + '</p>';
      }).join('') + (p.observacoes ? '<p>OBS. DO PEDIDO: ' + esc(p.observacoes) + '</p>' : '') + '<hr>' +
      '<p>Subtotal ' + N.reais(p.subtotal) + (p.taxa_entrega ? '<br>Entrega ' + N.reais(p.taxa_entrega) : '') + '<br><b>TOTAL ' + N.reais(p.total) + '</b><br>Pagamento: ' + esc(NOMES_PAG[p.pagamento] || p.pagamento) +
      (p.troco_para ? ' · troco para ' + N.reais(p.troco_para) : '') + (p.pagamento_status === 'CONFIRMADO' ? ' · PAGO' : ' · A RECEBER') + '</p>';
  }

  // ================================================================ eventos

  document.addEventListener('click', async function (ev) {
    var el = ev.target.closest('[data-acao]');
    if (!el) return;
    var a = el.dataset.acao, id = el.dataset.id;
    if (a === 'fundo') { if (ev.target === el) fecharJanela(); return; }
    if (['entregador', 'papel-membro', 'ativo-membro'].indexOf(a) >= 0) return; // tratados no "change"
    if (a === 'fechar') fecharJanela();
    else if (a === 'sair') { if (st.timer) clearInterval(st.timer); await api.sair(); st.papel = null; telaLogin(); }
    else if (a === 'aba') irPara(el.dataset.aba);
    else if (a === 'dia-tem') {
      var nomeOp = el.dataset.nome, temAgora = el.getAttribute('aria-pressed') === 'true';
      el.disabled = true;
      var itTem = st.diaGrupos[Number(el.dataset.k)];
      try {
        for (var ip = 0; ip < itTem.produtos.length; ip++) {
          var gp = (itTem.produtos[ip].grupos || []).filter(function (x) { return x.nome === itTem.nome; })[0];
          var op = gp && gp.opcoes.filter(function (o) { return o.nome === nomeOp; })[0];
          if (op) await api.alterarOpcao(op.id, !temAgora);
        }
        toast(temAgora ? nomeOp + ': não tem hoje.' : nomeOp + ': tem hoje.');
      } catch (e) { alert(e.message || 'Não foi possível salvar.'); }
      await irPara(st.aba);
    }
    else if (a === 'dia-acrescentar') {
      var campo = $('#dia-novo-' + el.dataset.k), nomeNovo = campo ? campo.value.trim() : '';
      if (nomeNovo.length < 2) { alert('Escreva o nome do item.'); if (campo) campo.focus(); return; }
      var itDia = st.diaGrupos[Number(el.dataset.k)];
      if (itDia.opcoes.some(function (o) { return o.nome.toLowerCase() === nomeNovo.toLowerCase(); })) { alert('Esse item já está na lista.'); return; }
      el.disabled = true;
      await mudarDoDia(Number(el.dataset.k), function (g) { g.opcoes.push({ id: idNovo(), nome: nomeNovo, preco: 0, disponivel: true }); }, nomeNovo + ' acrescentado.');
    }
    else if (a === 'filtro') { st.filtro = el.dataset.filtro; render(); }
    else if (a === 'oferecer') {
      var quem = await tentar(function () { return api.oferecerEntrega(id); });
      toast(quem ? 'Entrega oferecida a ' + quem + '.' : 'Nenhum entregador online agora.');
      await carregarAba(st.aba).catch(function () {}); atualizarJanelaPedido();
    }
    else if (a === 'resolver-ocorrencia') {
      await tentar(function () { return api.resolverOcorrencia(id, Number(el.dataset.i)); }, 'Ocorrência resolvida.');
      await carregarAba(st.aba).catch(function () {}); atualizarJanelaPedido();
    }
    else if (a === 'imprimir-comanda') { var pc = acharPedido(id); if (pc) imprimir(htmlComanda(pc)); }
    else if (a === 'venda-balcao') abrirMontador('balcao');
    else if (a === 'abrir-mesa') abrirMesa(el.dataset.mesa);
    else if (a === 'lancar-mesa') abrirMontador('mesa', el.dataset.mesa);
    else if (a === 'pix-mesa') { st.pixMesa = st.pixMesa === el.dataset.mesa ? null : el.dataset.mesa; abrirMesa(el.dataset.mesa); }
    else if (a === 'fechar-mesa') {
      if (!confirm('Fechar a conta da mesa ' + el.dataset.mesa + ' com pagamento em ' + NOMES_PAG[el.dataset.forma] + '?')) return;
      var fm = await tentar(function () { return api.fecharMesa(el.dataset.mesa, el.dataset.forma); });
      toast('Mesa ' + fm.mesa + ' fechada: ' + N.reais(fm.total) + '. Mesa livre.');
      fecharJanela(); irPara('mesas');
    }
    else if (a === 'imprimir-mesa') {
      var mm = mesaAtual(el.dataset.mesa);
      if (mm) imprimir('<h1>' + esc((st.lojaPub || {}).nome || '') + '</h1><p><b>Conta da mesa ' + esc(mm.numero) + '</b> · ' + esc(N.dataHora(new Date().toISOString())) + '</p><hr>' +
        mm.pedidos.map(function (p) { return p.itens.map(function (i) { return '<p>' + i.quantidade + '× ' + esc(i.nome) + ' ' + N.reais(i.total) + '</p>'; }).join(''); }).join('') + '<hr><p><b>TOTAL ' + N.reais(mm.total) + '</b></p>');
    }
    else if (a === 'montar-produto') {
      var mp = N.acharProduto(st.cardPub, id);
      if ((mp.grupos || []).length) { montar.escolhendo = mp.id; montar.marcadas = []; desenharMontador(); }
      else { adicionarAoMontador({ produto_id: mp.id, quantidade: 1, adicionais: [], removidos: [], observacao: '' }); desenharMontador(); }
    }
    else if (a === 'montar-voltar') { montar.escolhendo = null; desenharMontador(); }
    else if (a === 'montar-confirmar') {
      var pe = N.acharProduto(st.cardPub, montar.escolhendo);
      var novoItem = { produto_id: pe.id, quantidade: 1, adicionais: montar.marcadas.slice(), removidos: [], observacao: '' };
      var ers = N.validarEscolha(pe, novoItem);
      if (ers.length) { $('#erros-montar').innerHTML = ers.map(esc).join('<br>'); return; }
      adicionarAoMontador(novoItem); montar.escolhendo = null; desenharMontador();
    }
    else if (a === 'montar-qtd') {
      var it = montar.itens[Number(el.dataset.i)];
      it.quantidade += Number(el.dataset.delta);
      if (it.quantidade < 1) montar.itens.splice(Number(el.dataset.i), 1); else it.quantidade = Math.min(50, it.quantidade);
      desenharMontador();
    }
    else if (a === 'montar-enviar') {
      el.disabled = true;
      try {
        if (montar.tipo === 'mesa') {
          st.garcom = $('#mt-garcom').value.trim();
          var pm = await api.lancarMesa(montar.mesa, montar.itens, st.garcom, $('#mt-obs').value.trim());
          toast('Pedido #' + pm.numero + ' da mesa ' + montar.mesa + ' enviado para a cozinha.');
          fecharJanela(); irPara('mesas');
        } else {
          var pb = await api.venderBalcao({ itens: montar.itens, nome: $('#mt-nome').value.trim(), telefone: $('#mt-tel').value, pagamento: $('#mt-pag').value, pago: $('#mt-pago').checked });
          toast('Venda #' + pb.numero + ' registrada: ' + N.reais(pb.total) + '.');
          fecharJanela(); irPara('caixa');
        }
      } catch (e) { el.disabled = false; $('#erros-montar').textContent = e.message || 'Não foi possível registrar.'; }
    }
    else if (a === 'abrir-pedido') { if (!st.entregadores.length && st.papel !== 'cozinha') { try { st.entregadores = await api.listarEntregadores(); } catch (e) { /* segue */ } } abrirPedido(id); }
    else if (a === 'status') mudarStatus(id, el.dataset.para);
    else if (a === 'pix-pedido') { st.pixAberto = st.pixAberto === id ? null : id; atualizarJanelaPedido(); }
    else if (a === 'confirmar-pagamento') {
      var formaNome = ({ pix: 'Pix', dinheiro: 'dinheiro', cartao: 'cartão' })[el.dataset.forma] || 'a forma do pedido';
      if (!confirm('Confirmar que o pagamento deste pedido foi recebido em ' + formaNome + '?')) return;
      await tentar(function () { return api.confirmarPagamento(id, el.dataset.forma); }, 'Pagamento marcado como recebido.');
      st.pixAberto = null;
      await carregarAba(st.aba); atualizarJanelaPedido();
    }
    else if (a === 'novo-produto') editorProduto(null);
    else if (a === 'editar-produto') editorProduto(st.adm.produtos.filter(function (p) { return p.id === id; })[0]);
    else if (a === 'nova-categoria') editorCategoria(null);
    else if (a === 'editar-categoria') editorCategoria(st.adm.categorias.filter(function (c) { return c.id === id; })[0]);
    else if (a === 'apagar-categoria') {
      if (!confirm('Apagar esta categoria? Só é possível se ela não tiver produtos.')) return;
      try { await api.apagarCategoria(id); } catch (e) { alert(/foreign key|violates|EM_USO/i.test(e.message + e.codigo) ? 'A categoria ainda tem produtos. Mova ou apague os produtos antes.' : e.message); return; }
      fecharJanela(); await irPara('cardapio'); toast('Categoria apagada.');
    }
    else if (a === 'disponivel') {
      var p = st.adm.produtos.filter(function (x) { return x.id === id; })[0];
      await tentar(function () { return api.alterarProduto(id, { disponivel: p.disponivel === false }); }, p.disponivel === false ? 'Disponível de novo.' : 'Marcado como esgotado.');
      await irPara('cardapio');
    }
    else if (a === 'apagar-produto') {
      var pr = st.adm.produtos.filter(function (x) { return x.id === id; })[0];
      if (!confirm('Apagar "' + pr.nome + '"? Pedidos antigos continuam com o nome e o preço da época. Para só esconder, use Editar → desmarcar "Mostrar no cardápio".')) return;
      await tentar(function () { return api.apagarProduto(id); }, 'Produto apagado.');
      await irPara('cardapio');
    }
    else if (a === 'mais-grupo') { lerEditorProduto(); produtoEditando.grupos.push({ id: idNovo(), nome: '', minimo: 0, maximo: 1, opcoes: [{ id: idNovo(), nome: '', preco: 0, disponivel: true }] }); desenharEditorProduto(); }
    else if (a === 'tirar-grupo') { lerEditorProduto(); produtoEditando.grupos.splice(Number(el.dataset.g), 1); desenharEditorProduto(); }
    else if (a === 'mais-opcao') { lerEditorProduto(); produtoEditando.grupos[Number(el.dataset.g)].opcoes.push({ id: idNovo(), nome: '', preco: 0, disponivel: true }); desenharEditorProduto(); }
    else if (a === 'tirar-opcao') { lerEditorProduto(); produtoEditando.grupos[Number(el.dataset.g)].opcoes.splice(Number(el.dataset.o), 1); desenharEditorProduto(); }
    else if (a === 'mais-pag') {
      var nome = $('#novo-pag').value.trim();
      if (nome.length < 2) return;
      var dadosLoja = lerLoja();
      st.adm.loja = Object.assign(st.adm.loja, dadosLoja);
      st.adm.loja.pagamentos.push({ id: 'outro_' + Date.now().toString(36), nome: nome.slice(0, 40), ativo: true });
      render();
    }
    else if (a === 'gerar-qr') desenharQr();
    else if (a === 'imprimir-qr') imprimirQr();
    else if (a === 'post-compartilhar' || a === 'post-baixar') {
      await desenharPost();
      var dp = lerPost();
      if (a === 'post-baixar') { PD.baixar(await PD.arquivo($('#pd-canvas'), nomeArquivoPost())); toast('Imagem baixada.'); return; }
      var r = await PD.compartilhar($('#pd-canvas'), PD.textoWhatsApp(dp.post, dp.op), nomeArquivoPost());
      if (r === 'baixado') toast('Este aparelho não abre o compartilhar: a imagem foi baixada.');
    }
    else if (a === 'post-texto') {
      var dt = lerPost(), txt = PD.textoWhatsApp(dt.post, dt.op);
      try { await navigator.clipboard.writeText(txt); toast('Texto copiado.'); } catch (e) { prompt('Copie o texto:', txt); }
    }
    else if (a === 'salvar-url') {
      var u = $('#qr-url').value.trim();
      if (N.enderecoLocal(u)) { alert('Use um endereço público (https), não um endereço deste computador ou da rede local.'); return; }
      await tentar(function () { return api.salvarLoja({ url_publica: u }); }, 'Endereço salvo.');
      st.adm.loja.url_publica = u;
    }
    else if (a === 'trocar-senha') {
      var real = !!(st.lojaPub && st.lojaPub.modo === 'real');
      var nova = prompt('Nova senha para ' + el.dataset.nome + (real ? ' (8 ou mais, com letras e números; a pessoa cria a definitiva no próximo acesso):' : ' (loja em teste: pode ser ' + SENHA_TESTE + '):'), real ? '' : SENHA_TESTE);
      if (nova === null) return;
      if (erroSenha(nova, real)) { alert(erroSenha(nova, real)); return; }
      await tentar(function () { return api.trocarSenha(id, nova); }, 'Senha trocada. Passe a senha nova para a pessoa.');
    }
    else if (a === 'ativo-entregador') {
      var en = st.entregadores.filter(function (x) { return x.id === id; })[0];
      await tentar(function () { return api.salvarEntregador({ id: en.id, nome: en.nome, telefone: en.telefone, ativo: en.ativo === false }); });
      irPara('equipe');
    }
  });

  document.addEventListener('change', async function (ev) {
    var el = ev.target, a = el.dataset && el.dataset.acao;
    if (a === 'montar-opcao' && montar) {
      if (el.checked) montar.marcadas.push(el.value); else montar.marcadas = montar.marcadas.filter(function (x) { return x !== el.value; });
      return;
    }
    if (a === 'entregador') {
      await tentar(function () { return api.atribuirEntregador(el.dataset.id, el.value || null); }, 'Entregador atualizado.');
      await carregarAba(st.aba).catch(function () {}); atualizarJanelaPedido();
    } else if (a === 'papel-membro') {
      await tentar(function () { return api.alterarEquipe(el.dataset.id, { papel: el.value }); }, 'Papel alterado.');
    } else if (a === 'ativo-membro') {
      await tentar(function () { return api.alterarEquipe(el.dataset.id, { ativo: el.checked }); }, el.checked ? 'Acesso ativado.' : 'Acesso desativado.');
    } else if (el.name === 'lj-logo-tipo') {
      $('#lj-logo-outra').classList.toggle('oculto', el.value !== 'outra');
      if (el.value === 'nova' || el.value === 'whatsapp') mostrarLogo(LOGOS[el.value]);
      else if (el.value === 'nenhuma') mostrarLogo(null);
    } else if (el.id === 'lj-logo-arquivo' && el.files && el.files[0]) {
      try { mostrarLogo(await lerArquivoLogo(el.files[0])); } catch (e) { alert(e.message); el.value = ''; }
    } else if (el.id === 'lj-logo-url') {
      var u = el.value.trim();
      if (u && !/^https:\/\//.test(u)) { alert('O endereço da logo deve começar com https://'); return; }
      if (u) mostrarLogo(u);
    } else if (el.closest && el.closest('#form-horarios')) previaHorarios();
    else if (el.id === 'qr-mesa' || el.id === 'qr-url') desenharQr();
    else if (el.closest && el.closest('#form-post')) desenharPost();
  });

  document.addEventListener('input', function (ev) {
    if (ev.target.id === 'montar-busca' && montar) {
      montar.busca = ev.target.value;
      var pos0 = ev.target.selectionStart;
      desenharMontador();
      var mb = $('#montar-busca'); if (mb) { mb.focus(); mb.setSelectionRange(pos0, pos0); }
      return;
    }
    if (ev.target.id === 'mt-tel') { // cliente conhecido pelo telefone (do CONIS): mostra o nome para a equipe conferir
      var d = N.soDigitos(ev.target.value), aviso = $('#mt-cliente');
      if (d.length >= 10 && aviso) api.clientes().then(function (cl) {
        var c = cl.filter(function (x) { return x.telefone === d || x.telefone.slice(-d.length) === d; })[0];
        aviso.textContent = c ? 'Cliente: ' + c.nome + ' · ' + c.pedidos + ' pedido(s)' : 'Cliente novo';
        if (c && !$('#mt-nome').value) $('#mt-nome').value = c.nome;
      }).catch(function () {});
      return;
    }
    if (ev.target.id === 'busca-cliente') {
      st.buscaCliente = ev.target.value;
      var pos1 = ev.target.selectionStart;
      render();
      var bc = $('#busca-cliente'); if (bc) { bc.focus(); bc.setSelectionRange(pos1, pos1); }
      return;
    }
    if (ev.target.id === 'busca-pedido') {
      st.busca = ev.target.value;
      var pos = ev.target.selectionStart;
      render();
      var b = $('#busca-pedido'); if (b) { b.focus(); b.setSelectionRange(pos, pos); }
    } else if (ev.target.closest && ev.target.closest('#form-post')) {
      clearTimeout(st.timerPost); st.timerPost = setTimeout(desenharPost, 350);
    }
  });

  document.addEventListener('submit', async function (ev) {
    var f = ev.target;
    ev.preventDefault();
    if (f.id === 'form-nova-senha') { salvarNovaSenha(); return; }
    if (f.id === 'form-login') {
      var senha = $('#l-senha').value;
      try {
        if (f.dataset.tipo === 'criar') {
          if (senha !== $('#l-senha2').value) { telaLogin('As senhas não são iguais.'); return; }
          await api.criarConta(null, senha);
        } else await api.entrar(api.modo === 'demo' ? null : $('#l-usuario').value.trim(), senha);
        iniciar();
      } catch (e) { telaLogin(e.message); }
    } else if (f.id === 'form-categoria') {
      var c = { id: f.dataset.id, nome: $('#c-nome').value.trim(), slug: $('#c-slug').value.trim(), descricao: $('#c-desc').value.trim() || null,
        icone: $('#c-icone').value.trim() || null, ordem: Number($('#c-ordem').value) || 0, ativa: $('#c-ativa').checked };
      if (c.nome.length < 2 || !/^[a-z0-9_-]{2,40}$/.test(c.slug)) { alert('Preencha nome e código (letras minúsculas, números, - ou _).'); return; }
      await tentar(function () { return api.salvarCategoria(c); }, 'Categoria salva.');
      fecharJanela(); irPara('cardapio');
    } else if (f.id === 'form-produto') {
      lerEditorProduto();
      var erros = errosProduto(produtoEditando);
      if (erros.length) { $('#erros-produto').innerHTML = erros.map(esc).join('<br>'); return; }
      await tentar(function () { return api.salvarProduto(produtoEditando); }, 'Produto salvo.');
      fecharJanela(); irPara('cardapio');
    } else if (f.id === 'form-horarios') {
      var lista = lerHorarios();
      if (lista.some(function (d) { return d.titulo.length < 2 || N.paraMinutos(d.inicio) === null || N.paraMinutos(d.fim) === null; })) { alert('Preencha nome, início e fim de todos os destaques.'); return; }
      await tentar(function () { return api.salvarDestaques(lista); }, 'Horários salvos. O cardápio público passa a usar os novos horários.');
      irPara('horarios');
    } else if (f.id === 'form-loja') {
      var dados = lerLoja();
      if (!/^[0-9]{12,13}$/.test(dados.whatsapp)) { alert('WhatsApp deve ter 55 + DDD + número (ex.: 5579988476641).'); return; }
      if (!dados.aceita_entrega && !dados.aceita_retirada && !dados.aceita_local) { alert('Deixe pelo menos uma modalidade ligada.'); return; }
      if (!dados.pagamentos.some(function (p) { return p.ativo; })) { alert('Deixe pelo menos uma forma de pagamento ativa.'); return; }
      if (dados.url_publica && !/^https?:\/\//.test(dados.url_publica)) { alert('O endereço público deve começar com https://'); return; }
      if (dados.logo_url && !/^(https:\/\/|assets\/|data:image\/(png|jpeg|webp);base64,)/.test(dados.logo_url)) { alert('Logo inválida.'); return; }
      if ($('input[name="lj-logo-tipo"]:checked') && $('input[name="lj-logo-tipo"]:checked').value === 'outra' && !dados.logo_url) { alert('Envie uma imagem ou cole o endereço da logo.'); return; }
      await tentar(function () { return api.salvarLoja(dados); }, 'Configurações salvas.');
      irPara('loja');
    } else if (f.id === 'form-abrir-caixa') {
      await tentar(function () { return api.abrirCaixa(Number($('#cx-inicial').value), (api.sessao() || {}).email); }, 'Caixa aberto.');
      irPara('caixa');
    } else if (f.id === 'form-mov-caixa') {
      await tentar(function () { return api.movimentoCaixa($('#mv-tipo').value, Number($('#mv-valor').value), $('#mv-motivo').value); }, 'Registrado.');
      irPara('caixa');
    } else if (f.id === 'form-fechar-caixa') {
      if (!confirm('Fechar o caixa agora?')) return;
      var fc = await tentar(function () { return api.fecharCaixa(Number($('#cx-contado').value)); });
      alert('Caixa fechado.\n\nRecebido: ' + N.reais(fc.vendas) + '\nDinheiro esperado na gaveta: ' + N.reais(fc.dinheiro_esperado) + '\nContado: ' + N.reais(fc.dinheiro_contado) +
        '\nDiferença: ' + (fc.diferenca === 0 ? 'nenhuma ✔' : (fc.diferenca > 0 ? 'sobrou ' : 'faltou ') + N.reais(Math.abs(fc.diferenca))));
      irPara('caixa');
    } else if (f.id === 'form-rel') {
      st.relIni = $('#r-ini').value; st.relFim = $('#r-fim').value;
      if (!st.relIni || !st.relFim || st.relFim < st.relIni) { alert('Período inválido.'); return; }
      st.rel = await tentar(function () { return api.relatorio(st.relIni, st.relFim); });
      render();
    } else if (f.id === 'form-membro') {
      var novo = { nome: $('#m-nome').value.trim(), usuario: N.normalizarUsuario($('#m-usuario').value), senha: $('#m-senha').value, papel: $('#m-papel').value };
      if (!/^[a-z0-9._-]{3,30}$/.test(novo.usuario)) { alert('Usuário com 3 a 30 letras ou números, sem acento e sem espaço.'); return; }
      var lojaReal = !!(st.lojaPub && st.lojaPub.modo === 'real');
      if (erroSenha(novo.senha, lojaReal)) { alert(erroSenha(novo.senha, lojaReal)); return; }
      await tentar(function () { return api.criarAcesso(novo); });
      alert('Acesso criado.\n\nUsuário: ' + novo.usuario + '\nSenha: a que você digitou\n\nEntrada: ' + location.href.replace(/painel\.html.*$/, '') + comLoja(novo.papel === 'entregador' ? 'entregador.html' : novo.papel === 'cozinha' ? 'cozinha.html' : 'painel.html'));
      irPara('equipe');
    } else if (f.id === 'form-entregador') {
      var tel = N.soDigitos($('#e-tel').value);
      if (tel && (tel.length < 10 || tel.length > 13)) { alert('Telefone com DDD (10 a 13 números).'); return; }
      await tentar(function () { return api.salvarEntregador({ nome: $('#e-nome').value.trim(), telefone: tel || null }); }, 'Entregador cadastrado.');
      irPara('equipe');
    }
  });

  document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape' && document.querySelector('#janela-raiz .fundo')) fecharJanela(); });

  window.AterrissePainel = { st: st }; // para conferência nos testes
  iniciar();
})();
