/* Pede Sul — área do desenvolvedor RMD (a parte da RMD na plataforma).
   Cria lojas, libera ou suspende, escolhe se a loja aparece na vitrine do Pede Sul ou funciona como sistema individual
   (marca e endereço próprios), liga os recursos do plano de cada uma, cria o primeiro acesso do dono e cuida das
   propagandas da faixa da vitrine.
   NÃO mostra vendas, valores, pedidos nem dados de clientes: são de cada loja (o banco também não entrega isso à RMD).
   Com o banco: entrada com a conta de desenvolvedor (usuário ou e-mail + senha).
   Modo demonstração: a senha do desenvolvedor é criada neste navegador e tudo fica só neste aparelho. */
(function () {
  'use strict';
  var N = window.AterrisseNucleo, P = window.PedeSulPlataforma, B = window.AterrisseBackend;
  var esc = N.escaparHtml;
  function $(s) { return document.querySelector(s); }

  var api = B.criar(Object.assign({}, window.ATERRISSE_CONFIG || {}, { LOJA: 'rmd', VITRINE: false }));
  var COM_BANCO = api.modo === 'supabase';
  var SENHA_TESTE = (window.ATERRISSE_CONFIG && window.ATERRISSE_CONFIG.SENHA_TESTE) || '123456';
  var PLANOS = window.RmdPlanos.PLANOS, PROMO = window.RmdPlanos.PROMOCAO;
  var MERCADO = [
    ['iFood (Plano Básico, a loja entrega)', '12% de comissão + 3,2% do pagamento online por pedido + R$ 110/mês acima de R$ 1.800 de venda', 'https://blog-parceiros.ifood.com.br/taxas-ifood/'],
    ['iFood (Plano Entrega, o iFood entrega)', '23% de comissão + 3,2% do pagamento online por pedido + R$ 150/mês acima de R$ 1.800', 'https://brendi.com.br/blog/planos-ifood-taxas-2026/'],
    ['Anota AI', 'R$ 99,99 a R$ 299,99/mês conforme o número de pedidos', 'https://anota.ai/blog/faq-anota-ai/'],
    ['Cardápio Web', 'R$ 169,99 (mesas) · R$ 209,99 (delivery) · R$ 269,99 (completo)/mês', 'https://ajuda.cardapioweb.com/boas-vindas/planos-funcionalidades-e-modulos-adicionais'],
    ['Goomer', 'grátis até 30 pedidos · R$ 99,90 + R$ 70 do delivery · R$ 184,90 · R$ 299,90/mês', 'https://goomer.com.br/planos'],
    ['Saipos', 'a partir de R$ 240,79/mês (gestão completa, fiscal, estoque)', 'https://saipos.com/sistema/delivery']
  ];
  var CHAVE_SENHA = 'pedesul_dev_senha', CHAVE_SESSAO = 'pedesul_dev_sessao';
  var st = { editando: null, lojas: [], anuncios: [], equipe: {}, anuncioEditando: null, aba: 'lojas' };

  // ---------------------------------------------------------------- de onde vêm os dados

  var fonte = COM_BANCO ? {
    lojas: function () { return api.rmdLojas(); },
    salvar: function (slug, c) { return api.rmdSalvarLoja(slug, c); },
    criar: function (d) { return api.rmdCriarLoja(d); },
    anuncios: function () { return api.rmdAnuncios(); },
    salvarAnuncio: function (x) { return api.rmdSalvarAnuncio(x); },
    apagarAnuncio: function (id) { return api.rmdApagarAnuncio(id); }
  } : {
    lojas: async function () { return P.listar(); },
    salvar: async function (slug, c) { return P.salvar(slug, c); },
    criar: async function (d) { return P.criar(d).slug; },
    anuncios: async function () { return P.anuncios(); },
    salvarAnuncio: async function (x) { return P.salvarAnuncio(x); },
    apagarAnuncio: async function (id) { return P.apagarAnuncio(id); }
  };

  function toast(msg) {
    var t = document.createElement('div');
    t.className = 'aviso-toast'; t.setAttribute('role', 'status'); t.textContent = msg;
    document.body.appendChild(t); setTimeout(function () { t.remove(); }, 2800);
  }
  function lerL(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function gravarL(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* sem armazenamento */ } }
  function logadoDemo() { try { return sessionStorage.getItem(CHAVE_SESSAO) === '1'; } catch (e) { return false; } }
  function marcarLogado(sim) { try { if (sim) sessionStorage.setItem(CHAVE_SESSAO, '1'); else sessionStorage.removeItem(CHAVE_SESSAO); } catch (e) { /* idem */ } }
  async function hash(senha) {
    if (typeof crypto === 'undefined' || !crypto.subtle) throw new Error('Abra por http://localhost ou https para usar a senha.');
    var buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('pedesul-dev:' + senha));
    return Array.prototype.map.call(new Uint8Array(buf), function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
  }

  // ---------------------------------------------------------------- entrada

  function telaLogin(msg) {
    $('#btn-sair').classList.add('oculto');
    var h = '<div class="login caixa"><h2>Área do desenvolvedor RMD</h2>' + (msg ? '<div class="erro-caixa">' + esc(msg) + '</div>' : '');
    if (COM_BANCO) {
      h += '<form id="form-login" data-tipo="banco"><div class="campo"><label for="l-usuario">Usuário ou e-mail do desenvolvedor</label><input id="l-usuario" autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false" required maxlength="120"></div>' +
        '<div class="campo"><label for="l-senha">Senha</label><input id="l-senha" type="password" required autocomplete="current-password"></div>' +
        '<button class="btn btn-ouro btn-bloco" type="submit">Entrar</button></form></div>';
    } else {
      var criar = !lerL(CHAVE_SENHA);
      h += '<div class="aviso-caixa">Modo demonstração: a senha e as lojas ficam só neste navegador.</div>' +
        '<form id="form-login" data-tipo="' + (criar ? 'criar' : 'entrar') + '">' +
        '<div class="campo"><label for="l-senha">' + (criar ? 'Crie a senha do desenvolvedor (mín. 6)' : 'Senha do desenvolvedor') + '</label><input id="l-senha" type="password" required minlength="6" autocomplete="' + (criar ? 'new-password' : 'current-password') + '"></div>' +
        (criar ? '<div class="campo"><label for="l-senha2">Repita a senha</label><input id="l-senha2" type="password" required minlength="6" autocomplete="new-password"></div>' : '') +
        '<button class="btn btn-ouro btn-bloco" type="submit">' + (criar ? 'Criar senha e entrar' : 'Entrar') + '</button></form></div>';
    }
    $('#conteudo').innerHTML = h;
    var f = $('#conteudo input'); if (f) f.focus();
  }

  async function iniciar() {
    if (COM_BANCO) {
      if (!api.sessao()) return telaLogin();
      var sou = false;
      try { sou = await api.souRmd(); } catch (e) { if (e.codigo === 'REDE') return telaLogin(e.message); }
      if (!sou) { await api.sair(); return telaLogin('Esta conta não é de desenvolvedor da RMD.'); }
    } else if (!logadoDemo()) return telaLogin();
    $('#btn-sair').classList.remove('oculto');
    await recarregar();
  }

  async function recarregar() {
    try { st.lojas = await fonte.lojas(); st.anuncios = await fonte.anuncios(); st.erro = null; }
    catch (e) { st.erro = e.message; if (e.codigo === 'SEM_PERMISSAO') return telaLogin(e.message); }
    render();
  }

  // ---------------------------------------------------------------- telas

  function planoDe(l) {
    var rec = l.recursos || {};
    var r = PLANOS.filter(function (pl) { return Object.keys(pl.recursos).every(function (k) { return (rec[k] !== false) === pl.recursos[k]; }); })[0];
    return r ? r.nome : 'Personalizado';
  }
  function linksDa(l) {
    var base = location.href.replace(/rmd\.html.*$/, '');
    var q = '?loja=' + encodeURIComponent(l.slug);
    return [['📱 Cardápio', 'loja.html'], ['🖥️ Painel', 'painel.html'], ['👨‍🍳 Cozinha', 'cozinha.html'], ['🛵 Entregador', 'entregador.html']].map(function (x) {
      return '<a class="btn btn-linha btn-peq" href="' + esc(base + x[1] + q) + '" target="_blank" rel="noopener">' + x[0] + '</a>';
    }).join('');
  }

  function render() {
    var lojas = st.lojas;
    var naVitrine = lojas.filter(function (l) { return l.vitrine; }).length;
    var h = '<div class="aviso-caixa">Área técnica da plataforma: lojas, liberação, vitrine, recursos e propagandas. Vendas, pedidos e clientes são de cada loja e não aparecem aqui.</div>';
    if (st.erro) h += '<div class="erro-caixa" role="alert">' + esc(st.erro) + '</div>';
    h += '<div class="cartoes-resumo"><div class="cartao-num"><span>Lojas</span><strong>' + lojas.length + '</strong></div>' +
      '<div class="cartao-num"><span>Na vitrine Pede Sul</span><strong>' + naVitrine + '</strong></div>' +
      '<div class="cartao-num"><span>Sistema individual</span><strong>' + (lojas.length - naVitrine) + '</strong></div>' +
      '<div class="cartao-num"><span>Suspensas</span><strong style="color:' + (lojas.some(function (l) { return !l.liberada; }) ? 'var(--erro)' : 'var(--ok)') + '">' + lojas.filter(function (l) { return !l.liberada; }).length + '</strong></div></div>';
    h += '<div class="barra-acoes"><a class="btn btn-linha btn-peq" href="index.html" target="_blank" rel="noopener">🏖️ Abrir a vitrine</a><a class="btn btn-linha btn-peq" href="vendas.html" target="_blank" rel="noopener">💼 Página de vendas</a></div>';
    h += '<nav class="chips" aria-label="Partes da área do desenvolvedor">' + [['lojas', '🏪 Lojas'], ['anuncios', '📣 Propagandas'], ['epocas', '🎉 Épocas'], ['planos', '💲 Planos e preços']].map(function (a) {
      return '<button type="button" class="chip' + (st.aba === a[0] ? ' agora' : '') + '" data-acao="aba" data-aba="' + a[0] + '" aria-pressed="' + (st.aba === a[0]) + '">' + a[1] + '</button>';
    }).join('') + '</nav>';
    if (st.aba === 'lojas') h += telaLojas(lojas);
    else if (st.aba === 'anuncios') h += telaAnuncios();
    else if (st.aba === 'epocas') h += telaEpocas();
    else h += htmlPlanos() + '<div class="caixa"><h3 style="margin-top:0">Promoção de lançamento</h3><p style="font-size:14px;margin:0">Os ' + PROMO.vagas + ' primeiros levam o plano Completo pelo preço do Essencial (' + N.reais(PROMO.preco) + '/mês), e nos ' + PROMO.mesesMetade +
      ' primeiros meses ' + N.reais(PROMO.precoInicio) + '/mês. As inscrições da página de vendas vão para a lista da RMD no servidor e aparecem na área do desenvolvedor do Aterrisse.</p></div>';
    $('#conteudo').innerHTML = h;
  }

  function telaLojas(lojas) {
    var h = '<h2>Lojas</h2>' + lojas.map(function (l) {
      if (st.editando === l.slug) return formLoja(l);
      return '<div class="caixa dev-loja"><div class="dev-loja-cab"><span class="dev-logo" style="background:' + esc(l.cor || '#f2552c') + '">' + esc(l.icone || '🍽️') + '</span>' +
        '<div style="min-width:0;flex:1"><h3 style="margin:0">' + esc(l.nome) + '</h3><small style="color:var(--texto-2)">' + esc(l.segmento || '') + ' · código <b>' + esc(l.slug) + '</b></small><br>' +
        '<span class="status ' + (l.liberada ? 'st-PRONTO' : 'st-CANCELADO') + '">' + (l.liberada ? 'Liberada' : 'Suspensa') + '</span> ' +
        '<span class="status st-ACEITO">' + (l.vitrine ? 'Na vitrine Pede Sul' : 'Sistema individual') + '</span> ' +
        '<span class="status st-RECEBIDO">Plano ' + esc(planoDe(l)) + '</span>' +
        (COM_BANCO ? ' <span class="status ' + (l.tem_admin ? 'st-PRONTO' : 'st-CANCELADO') + '">' + (l.tem_admin ? 'Dono com acesso' : 'Sem acesso do dono') + '</span>' : '') + '</div>' +
        '<button class="btn btn-linha btn-peq" type="button" data-acao="editar" data-slug="' + esc(l.slug) + '">Editar</button></div>' +
        (l.liberada ? '' : (l.motivo ? '<p style="font-size:13px;color:var(--erro);margin:6px 0 0">Motivo: ' + esc(l.motivo) + '</p>' : '')) +
        '<div class="barra-acoes" style="margin:10px 0 0">' + linksDa(l) + '</div>' + (COM_BANCO ? htmlAcessos(l) : '') + '</div>';
    }).join('');

    h += '<form id="form-nova" class="caixa"><h3 style="margin-top:0">+ Nova loja</h3><p style="font-size:13px;color:var(--texto-2);margin-top:0">A loja nasce liberada, com o cardápio vazio. ' +
      (COM_BANCO ? 'Depois crie o acesso do dono (usuário e senha) e passe para ele.' : 'O dono cadastra o cardápio no painel dela.') + '</p>' +
      '<div class="linha-2"><div class="campo"><label for="n-nome">Nome da loja *</label><input id="n-nome" required minlength="2" maxlength="80"></div>' +
      '<div class="campo"><label for="n-seg">Tipo de comida</label><input id="n-seg" maxlength="60" placeholder="Ex.: Açaí, Pizza, Marmita"></div></div>' +
      '<div class="linha-2"><div class="campo"><label for="n-icone">Ícone (emoji)</label><input id="n-icone" maxlength="8" value="🍽️"></div>' +
      '<div class="campo"><label for="n-cor">Cor</label><input id="n-cor" type="color" value="#f2552c"></div></div>' +
      '<div class="campo"><label for="n-plano">Plano</label><select id="n-plano">' + PLANOS.map(function (pl) { return '<option value="' + pl.id + '"' + (pl.destaque ? ' selected' : '') + '>' + esc(pl.nome) + ' · ' + N.reais(pl.preco) + '/mês</option>'; }).join('') + '</select>' +
      '<span class="ajuda">Plano Salão: só a parte interna (balcão, cozinha, mesas); fica fora da vitrine.</span></div>' +
      '<div class="opcoes-radio"><label class="opcao"><input type="radio" name="n-modo" value="vitrine" checked> Aparece na vitrine do Pede Sul</label>' +
      '<label class="opcao"><input type="radio" name="n-modo" value="individual"> Sistema individual (marca e endereço próprios, fora da vitrine)</label></div>' +
      '<button class="btn btn-ouro" type="submit" style="margin-top:10px">Criar loja</button></form>';
    return h;
  }

  // Acessos da loja (só com o banco): a RMD vê quem tem acesso, cria o do dono e troca senha esquecida. Sem vendas.
  function htmlAcessos(l) {
    var eq = st.equipe[l.slug];
    var h = '<details class="dev-acessos" data-slug="' + esc(l.slug) + '"' + (eq ? ' open' : '') + '><summary>👤 Acessos da loja (' + (l.equipe || 0) + ')</summary>';
    if (!eq) return h + '<p style="font-size:13px">Carregando…</p></details>';
    h += eq.length ? '<ul style="padding-left:18px;font-size:14px">' + eq.map(function (m) {
      return '<li>' + esc(m.nome) + ' · <b>' + esc(m.usuario || '') + '</b> · ' + esc(m.papel) + (m.ativo ? '' : ' (desativado)') +
        ' <button class="btn btn-linha btn-peq" type="button" data-acao="senha-membro" data-slug="' + esc(l.slug) + '" data-id="' + esc(m.user_id) + '" data-nome="' + esc(m.nome) + '">Nova senha</button></li>';
    }).join('') + '</ul>' : '<p style="font-size:13px">Ninguém com acesso ainda.</p>';
    h += '<form class="form-acesso barra-acoes" data-slug="' + esc(l.slug) + '" style="flex-wrap:wrap">' +
      '<input class="entrada" name="nome" required minlength="2" maxlength="80" placeholder="Nome" aria-label="Nome">' +
      '<input class="entrada" name="usuario" required minlength="3" maxlength="30" placeholder="Usuário (ex.: dono)" aria-label="Usuário" autocapitalize="none" spellcheck="false">' +
      '<input class="entrada" name="senha" required minlength="4" maxlength="72" placeholder="Senha" aria-label="Senha" autocomplete="new-password" value="' + (l.modo === 'real' ? '' : SENHA_TESTE) + '">' +
      '<select name="papel" aria-label="Papel"><option value="admin">Dono (administrador)</option><option value="atendente">Atendente</option><option value="caixa">Caixa</option><option value="garcom">Garçom</option><option value="cozinha">Cozinha</option><option value="entregador">Entregador</option></select>' +
      '<button class="btn btn-ouro btn-peq" type="submit">Criar acesso</button></form></details>';
    return h;
  }

  function formLoja(l) {
    var rec = l.recursos || {};
    return '<form class="caixa dev-loja" id="form-loja" data-slug="' + esc(l.slug) + '"><h3 style="margin-top:0">Editar · ' + esc(l.nome) + ' <small style="color:var(--texto-2)">(' + esc(l.slug) + ')</small></h3>' +
      '<div class="linha-2"><div class="campo"><label for="e-nome">Nome</label><input id="e-nome" required minlength="2" maxlength="80" value="' + esc(l.nome) + '"></div>' +
      '<div class="campo"><label for="e-seg">Tipo de comida</label><input id="e-seg" maxlength="60" value="' + esc(l.segmento || '') + '"></div></div>' +
      '<div class="linha-2"><div class="campo"><label for="e-icone">Ícone</label><input id="e-icone" maxlength="8" value="' + esc(l.icone || '') + '"></div>' +
      '<div class="campo"><label for="e-cor">Cor</label><input id="e-cor" type="color" value="' + esc(/^#[0-9a-fA-F]{6}$/.test(l.cor || '') ? l.cor : '#f2552c') + '"></div></div>' +
      '<h4>Onde a loja aparece</h4><div class="opcoes-radio">' +
      '<label class="opcao"><input type="radio" name="e-modo" value="vitrine"' + (l.vitrine ? ' checked' : '') + '> Na vitrine do Pede Sul, junto com as outras lojas</label>' +
      '<label class="opcao"><input type="radio" name="e-modo" value="individual"' + (!l.vitrine ? ' checked' : '') + '> Sistema individual: só pelo link e QR Code da própria loja</label></div>' +
      '<h4>Liberação</h4><div class="opcoes-radio">' +
      '<label class="opcao"><input type="radio" name="e-lib" value="1"' + (l.liberada ? ' checked' : '') + '> Liberada (cardápio e pedidos funcionando)</label>' +
      '<label class="opcao"><input type="radio" name="e-lib" value="0"' + (!l.liberada ? ' checked' : '') + '> Suspensa (cardápio mostra “temporariamente indisponível” e sai da vitrine)</label></div>' +
      '<div class="campo" style="margin-top:8px"><label for="e-motivo">Motivo da suspensão (interno)</label><input id="e-motivo" maxlength="200" value="' + esc(l.motivo || '') + '"></div>' +
      (COM_BANCO ? '<h4>Pedidos</h4><div class="opcoes-radio"><label class="opcao"><input type="radio" name="e-pmodo" value="demo"' + (l.modo !== 'real' ? ' checked' : '') + '> Demonstração (pedidos chegam marcados TESTE)</label>' +
        '<label class="opcao"><input type="radio" name="e-pmodo" value="real"' + (l.modo === 'real' ? ' checked' : '') + '> Real (loja vendendo de verdade)</label></div>' : '') +
      '<h4>Recursos</h4><div class="barra-acoes" style="margin:0 0 6px">' + PLANOS.map(function (pl) {
        return '<button class="btn btn-linha btn-peq" type="button" data-acao="plano" data-plano="' + pl.id + '">Plano ' + esc(pl.nome) + '</button>';
      }).join('') + '</div><input type="hidden" id="e-plano" value="' + esc(l.plano || '') + '"><div style="display:flex;flex-wrap:wrap;gap:4px 16px">' + P.RECURSOS.map(function (r) {
        return '<label class="chk"><input type="checkbox" name="rec" value="' + r[0] + '"' + (rec[r[0]] !== false ? ' checked' : '') + '> ' + esc(r[1]) + '</label>';
      }).join('') + '</div><p style="font-size:12px;color:var(--texto-2)">Recurso desligado some do painel e do cardápio da loja, e o sistema recusa se alguém tentar usar.</p>' +
      '<div class="barra-acoes"><button class="btn btn-ouro" type="submit">Salvar</button><button class="btn btn-linha" type="button" data-acao="cancelar">Cancelar</button></div></form>';
  }

  // ---------------------------------------------------------------- épocas (tema da vitrine que liga sozinho perto de cada festa)
  function dataCurta(d) { return ('0' + d.getDate()).slice(-2) + '/' + ('0' + (d.getMonth() + 1)).slice(-2) + '/' + d.getFullYear(); }
  function telaEpocas() {
    var T = window.PedeSulTemas;
    if (!T) return '<div class="vazio">Calendário das épocas indisponível.</div>';
    var agora = T.temaDoDia(new Date()), base = location.href.replace(/rmd\.html.*$/, '');
    var h = '<h2>Épocas do ano</h2><p style="font-size:14px;color:var(--texto-2)">Perto de cada festa a vitrine muda sozinha: cores, enfeites com movimento e uma propaganda de saudação no começo da faixa. ' +
      'Não precisa ligar nada. Carnaval e Páscoa mudam de data todo ano e são calculados sozinhos.</p>';
    h += '<div class="caixa"><b>Agora:</b> ' + (agora ? esc(agora.emoji + ' ' + agora.nome) + ' (até ' + dataCurta(agora.fim) + ')' : 'sem tema (vitrine com as cores normais do Pede Sul)') + '</div>';
    h += T.proximos(new Date(), 12).map(function (t) {
      return '<div class="caixa dev-loja"><div class="dev-loja-cab"><span class="dev-logo" style="background:linear-gradient(135deg,' + esc(t.cores[0]) + ',' + esc(t.cores[1]) + ')">' + esc(t.emoji) + '</span>' +
        '<div style="flex:1;min-width:0"><h3 style="margin:0">' + esc(t.nome) + '</h3><small style="color:var(--texto-2)">' + dataCurta(t.inicio) + ' a ' + dataCurta(t.fim) + '</small><br>' +
        '<span class="status ' + (t.ativo ? 'st-PRONTO' : 'st-RECEBIDO') + '">' + (t.ativo ? 'No ar agora' : 'Liga sozinho em ' + dataCurta(t.inicio)) + '</span></div>' +
        '<a class="btn btn-linha btn-peq" href="' + esc(base + 'index.html?tema=' + t.id) + '" target="_blank" rel="noopener">Ver como fica</a></div></div>';
    }).join('');
    return h;
  }

  // ---------------------------------------------------------------- propagandas (faixa que passa no topo da vitrine)

  var TIPOS = { destaque: 'Destaque da plataforma', loja: 'Loja do Pede Sul', promocao: 'Promoção de uma loja', patrocinador: 'Patrocinador (empresa de fora)' };
  function telaAnuncios() {
    var hoje = new Date().toISOString().slice(0, 10);
    var h = '<h2>Propagandas da vitrine</h2><p style="font-size:14px;color:var(--texto-2)">Passam sozinhas no topo da vitrine, uma a cada 5 segundos, na ordem abaixo. Patrocinador aparece com a marca “Patrocinado”.</p>';
    h += st.anuncios.length ? st.anuncios.map(function (a) {
      var noAr = a.ativo !== false && (!a.inicio || a.inicio <= hoje) && (!a.fim || a.fim >= hoje);
      if (st.anuncioEditando === a.id) return formAnuncio(a);
      return '<div class="caixa dev-loja"><div class="dev-loja-cab"><span class="dev-logo" style="background:' + esc(a.cor || '#f2552c') + '">📣</span><div style="flex:1;min-width:0"><h3 style="margin:0">' + esc(a.titulo) + '</h3>' +
        '<small style="color:var(--texto-2)">' + esc(TIPOS[a.tipo] || a.tipo) + (a.loja ? ' · loja ' + esc(a.loja) : '') + (a.anunciante ? ' · ' + esc(a.anunciante) : '') + ' · ordem ' + esc(a.ordem || 0) +
        (a.inicio || a.fim ? ' · ' + esc((a.inicio || '…') + ' até ' + (a.fim || '…')) : '') + '</small><br><span class="status ' + (noAr ? 'st-PRONTO' : 'st-CANCELADO') + '">' + (noAr ? 'No ar' : 'Fora do ar') + '</span></div>' +
        '<button class="btn btn-linha btn-peq" type="button" data-acao="editar-anuncio" data-id="' + esc(a.id) + '">Editar</button></div></div>';
    }).join('') : '<div class="vazio">Nenhuma propaganda.</div>';
    h += st.anuncioEditando === 'novo' ? formAnuncio({ tipo: 'promocao', ativo: true, ordem: st.anuncios.length + 1 }) :
      '<button class="btn btn-ouro" type="button" data-acao="editar-anuncio" data-id="novo">+ Nova propaganda</button>';
    return h;
  }
  function formAnuncio(a) {
    return '<form class="caixa" id="form-anuncio" data-id="' + esc(a.id || '') + '"><h3 style="margin-top:0">' + (a.id ? 'Editar propaganda' : 'Nova propaganda') + '</h3>' +
      '<div class="linha-2"><div class="campo"><label for="a-tipo">Tipo</label><select id="a-tipo">' + Object.keys(TIPOS).map(function (k) { return '<option value="' + k + '"' + (a.tipo === k ? ' selected' : '') + '>' + esc(TIPOS[k]) + '</option>'; }).join('') + '</select></div>' +
      '<div class="campo"><label for="a-loja">Loja (o toque abre a loja)</label><select id="a-loja"><option value="">— nenhuma —</option>' + st.lojas.map(function (l) { return '<option value="' + esc(l.slug) + '"' + (a.loja === l.slug ? ' selected' : '') + '>' + esc(l.nome) + '</option>'; }).join('') + '</select></div></div>' +
      '<div class="campo"><label for="a-titulo">Título *</label><input id="a-titulo" required minlength="2" maxlength="60" value="' + esc(a.titulo || '') + '"></div>' +
      '<div class="campo"><label for="a-texto">Texto</label><input id="a-texto" maxlength="140" value="' + esc(a.texto || '') + '"></div>' +
      '<div class="linha-2"><div class="campo"><label for="a-anunciante">Patrocinador (nome)</label><input id="a-anunciante" maxlength="80" value="' + esc(a.anunciante || '') + '"></div>' +
      '<div class="campo"><label for="a-link">Link do patrocinador (https://…)</label><input id="a-link" type="url" maxlength="300" value="' + esc(a.link || '') + '"></div></div>' +
      '<div class="linha-2"><div class="campo"><label for="a-cor">Cor de fundo</label><input id="a-cor" type="color" value="' + esc(/^#[0-9a-fA-F]{6}$/.test(a.cor || '') ? a.cor : '#f2552c') + '"></div>' +
      '<div class="campo"><label for="a-img">Imagem (opcional)</label><input id="a-img" type="file" accept="image/png,image/jpeg,image/webp"><span class="ajuda">' + (a.imagem_url ? 'Já tem imagem. Envie outra para trocar.' : 'Fica atrás do texto, escurecida.') + '</span>' +
      (a.imagem_url ? '<label class="chk"><input type="checkbox" id="a-sem-img"> Tirar a imagem</label>' : '') + '</div></div>' +
      '<div class="linha-2"><div class="campo"><label for="a-inicio">Começa em</label><input id="a-inicio" type="date" value="' + esc(a.inicio || '') + '"></div>' +
      '<div class="campo"><label for="a-fim">Termina em</label><input id="a-fim" type="date" value="' + esc(a.fim || '') + '"></div></div>' +
      '<div class="linha-2"><div class="campo"><label for="a-ordem">Ordem</label><input id="a-ordem" type="number" min="0" max="99" value="' + esc(a.ordem || 0) + '"></div>' +
      '<div class="campo"><label class="chk" style="margin-top:28px"><input type="checkbox" id="a-ativo"' + (a.ativo !== false ? ' checked' : '') + '> No ar</label></div></div>' +
      '<div class="barra-acoes"><button class="btn btn-ouro" type="submit">Salvar</button><button class="btn btn-linha" type="button" data-acao="cancelar-anuncio">Cancelar</button>' +
      (a.id ? '<button class="btn btn-linha" type="button" data-acao="apagar-anuncio" data-id="' + esc(a.id) + '" style="margin-left:auto;color:var(--erro)">Apagar</button>' : '') + '</div></form>';
  }
  // Reduz a imagem enviada (largura máx. 1200 px, JPEG) para caber no banco.
  function lerImagem(arq) {
    return new Promise(function (ok, falha) {
      if (!arq) return ok(null);
      if (!/^image\/(png|jpeg|webp)$/.test(arq.type)) return falha(new Error('Use imagem PNG, JPG ou WEBP.'));
      var r = new FileReader();
      r.onerror = function () { falha(new Error('Não foi possível ler a imagem.')); };
      r.onload = function () {
        var img = new Image();
        img.onerror = function () { falha(new Error('Imagem inválida.')); };
        img.onload = function () {
          var w = Math.min(1200, img.width), h = Math.round(img.height * w / img.width);
          var c = document.createElement('canvas'); c.width = w; c.height = h;
          c.getContext('2d').drawImage(img, 0, 0, w, h);
          var q = 0.82, url = c.toDataURL('image/jpeg', q);
          while (url.length > 550000 && q > 0.4) { q -= 0.1; url = c.toDataURL('image/jpeg', q); }
          if (url.length > 590000) return falha(new Error('Imagem grande demais. Use uma menor.'));
          ok(url);
        };
        img.src = r.result;
      };
      r.readAsDataURL(arq);
    });
  }

  function htmlPlanos() {
    var h = '<div class="caixa"><h3 style="margin-top:0">Planos para oferecer</h3><p style="font-size:13px;color:var(--texto-2)">Sugestão da RMD com base nos preços do mercado. Os valores são seus para decidir. Nenhum plano cobra comissão por pedido.</p><div class="grade">';
    PLANOS.forEach(function (pl) {
      h += '<div class="resumo-bloco" style="margin:0;' + (pl.destaque ? 'border-color:var(--ouro)' : '') + '">' + (pl.destaque ? '<span class="selo-agora">MAIS INDICADO</span>' : '') +
        '<h3 style="margin:6px 0 2px;font-size:20px;color:var(--creme)">' + esc(pl.nome) + '</h3><div style="font-size:13px;color:var(--texto-2)">' + esc(pl.para) + '</div>' +
        '<div class="preco" style="margin:8px 0 2px">' + N.reais(pl.preco) + '<small style="font-size:13px;color:var(--texto-2)"> /mês</small></div>' +
        '<ul style="padding-left:18px;margin:8px 0;font-size:14px">' + pl.itens.map(function (i) { return '<li>' + esc(i) + '</li>'; }).join('') + '</ul></div>';
    });
    return h + '</div><p style="font-size:13px;margin:12px 0 4px"><b>Implantação (opcional, uma vez):</b> ' + N.reais(window.RmdPlanos.IMPLANTACAO) + '.</p>' +
      '<details style="margin-top:8px" open><summary>Comparação com o mercado (pesquisa de 27/10/2026)</summary><ul style="padding-left:18px;font-size:13px">' +
      MERCADO.map(function (m) { return '<li><b>' + esc(m[0]) + ':</b> ' + esc(m[1]) + ' (<a href="' + esc(m[2]) + '" target="_blank" rel="noopener">fonte</a>)</li>'; }).join('') + '</ul></details></div>';
  }

  // ---------------------------------------------------------------- ações

  async function abrirAcessos(slug) {
    if (!COM_BANCO || st.equipe[slug]) return;
    try { st.equipe[slug] = await api.rmdEquipe(slug); } catch (e) { alert(e.message); return; }
    render();
  }

  document.addEventListener('toggle', function (ev) {
    var d = ev.target;
    if (d.classList && d.classList.contains('dev-acessos') && d.open) abrirAcessos(d.dataset.slug);
  }, true);

  document.addEventListener('click', async function (ev) {
    var el = ev.target.closest('[data-acao]');
    if (!el) return;
    var a = el.dataset.acao;
    if (a === 'sair') { if (COM_BANCO) await api.sair(); else marcarLogado(false); telaLogin(); }
    else if (a === 'aba') { st.aba = el.dataset.aba; render(); }
    else if (a === 'editar') { st.editando = el.dataset.slug; render(); var f = $('#form-loja'); if (f) f.scrollIntoView({ block: 'start' }); }
    else if (a === 'cancelar') { st.editando = null; render(); }
    else if (a === 'plano') {
      var pl = PLANOS.filter(function (x) { return x.id === el.dataset.plano; })[0];
      document.querySelectorAll('#form-loja input[name="rec"]').forEach(function (cx) { if (pl.recursos[cx.value] !== undefined) cx.checked = pl.recursos[cx.value]; });
      $('#e-plano').value = pl.id;
      if (pl.interno) { var ind = document.querySelector('#form-loja input[name="e-modo"][value="individual"]'); if (ind) ind.checked = true; }
      toast('Recursos do plano ' + pl.nome + ' marcados. Confira e toque em Salvar.');
    }
    else if (a === 'senha-membro') {
      var nova = prompt('Nova senha para ' + el.dataset.nome + ' (provisória; no teste: ' + SENHA_TESTE + '):', SENHA_TESTE);
      if (nova === null) return;
      try { await api.trocarSenha(el.dataset.id, nova, el.dataset.slug); toast('Senha trocada. Passe a senha nova para a pessoa.'); } catch (e) { alert(e.message); }
    }
    else if (a === 'editar-anuncio') { st.anuncioEditando = el.dataset.id; render(); var fa = $('#form-anuncio'); if (fa) fa.scrollIntoView({ block: 'start' }); }
    else if (a === 'cancelar-anuncio') { st.anuncioEditando = null; render(); }
    else if (a === 'apagar-anuncio') {
      if (!confirm('Apagar esta propaganda?')) return;
      try { await fonte.apagarAnuncio(el.dataset.id); st.anuncioEditando = null; toast('Propaganda apagada.'); await recarregar(); } catch (e) { alert(e.message); }
    }
  });

  document.addEventListener('submit', async function (ev) {
    var f = ev.target;
    ev.preventDefault();
    if (f.id === 'form-login') {
      try {
        if (f.dataset.tipo === 'banco') { await api.entrar($('#l-usuario').value.trim(), $('#l-senha').value); return iniciar(); }
        var senha = $('#l-senha').value;
        if (f.dataset.tipo === 'criar') {
          if (senha.length < 6) return telaLogin('A senha precisa ter pelo menos 6 caracteres.');
          if (senha !== $('#l-senha2').value) return telaLogin('As senhas não são iguais.');
          gravarL(CHAVE_SENHA, await hash(senha));
        } else if ((await hash(senha)) !== lerL(CHAVE_SENHA)) return telaLogin('Senha incorreta.');
        marcarLogado(true); iniciar();
      } catch (e) { telaLogin(e.message); }
    } else if (f.id === 'form-nova') {
      try {
        var plano = PLANOS.filter(function (x) { return x.id === $('#n-plano').value; })[0];
        var nome = $('#n-nome').value.trim();
        var slug = await fonte.criar({ nome: nome, slug: P.slugDe(nome), segmento: $('#n-seg').value, icone: $('#n-icone').value.trim() || '🍽️', cor: $('#n-cor').value,
          vitrine: !plano.interno && f.querySelector('input[name="n-modo"]:checked').value === 'vitrine', plano: plano.id, recursos: Object.assign(P.todosLigados(), plano.recursos) });
        toast('Loja ' + nome + ' criada (código ' + slug + ').');
        await recarregar();
      } catch (e) { alert(e.message); }
    } else if (f.id === 'form-loja') {
      var slugL = f.dataset.slug, antes = st.lojas.filter(function (x) { return x.slug === slugL; })[0];
      var rec = {};
      P.RECURSOS.forEach(function (r) { rec[r[0]] = !!f.querySelector('input[name="rec"][value="' + r[0] + '"]').checked; });
      if (!rec.entrega && !rec.retirada && !rec.local) { alert('Deixe pelo menos uma forma de receber pedido (entrega, retirada ou consumo na loja).'); return; }
      var lib = f.querySelector('input[name="e-lib"]:checked').value === '1';
      if (antes.liberada && !lib && !confirm('Suspender ' + antes.nome + '? O cardápio fica indisponível para os clientes.')) return;
      var achado = PLANOS.filter(function (pl) { return Object.keys(pl.recursos).every(function (k) { return rec[k] === pl.recursos[k]; }); })[0];
      var campos = { nome: $('#e-nome').value.trim(), segmento: $('#e-seg').value.trim(), icone: $('#e-icone').value.trim() || '🍽️', cor: $('#e-cor').value,
        vitrine: f.querySelector('input[name="e-modo"]:checked').value === 'vitrine', liberada: lib, motivo: $('#e-motivo').value.trim(), recursos: rec,
        plano: achado ? achado.id : 'personalizado' };
      var pm = f.querySelector('input[name="e-pmodo"]:checked');
      if (pm) {
        if (pm.value === 'real' && antes.modo !== 'real' && !confirm('Passar ' + antes.nome + ' para vendas REAIS? Os pedidos deixam de ser marcados como TESTE.')) return;
        campos.modo = pm.value;
      }
      try { await fonte.salvar(slugL, campos); st.editando = null; toast('Loja salva.'); await recarregar(); } catch (e) { alert(e.message); }
    } else if (f.classList.contains('form-acesso')) {
      var d = { loja: f.dataset.slug, nome: f.elements.nome.value.trim(), usuario: N.normalizarUsuario(f.elements.usuario.value), senha: f.elements.senha.value, papel: f.elements.papel.value };
      if (!/^[a-z0-9._-]{3,30}$/.test(d.usuario)) { alert('Usuário com 3 a 30 letras ou números, sem acento e sem espaço.'); return; }
      if (d.senha.length < 4) { alert('A senha precisa ter pelo menos 4 caracteres (no teste: ' + SENHA_TESTE + '). Com a loja vendendo de verdade, a pessoa cria a definitiva no primeiro acesso.'); return; }
      try {
        await api.criarAcesso(d);
        alert('Acesso criado.\n\nLoja: ' + d.loja + '\nUsuário: ' + d.usuario + '\nSenha: a que você digitou\n\nEntrada: ' + location.href.replace(/rmd\.html.*$/, '') + (d.papel === 'entregador' ? 'entregador' : d.papel === 'cozinha' ? 'cozinha' : 'painel') + '.html?loja=' + d.loja);
        delete st.equipe[d.loja]; await recarregar(); abrirAcessos(d.loja);
      } catch (e) { alert(e.message); }
    } else if (f.id === 'form-anuncio') {
      var x = { id: f.dataset.id || null, tipo: $('#a-tipo').value, loja: $('#a-loja').value || null, titulo: $('#a-titulo').value.trim(), texto: $('#a-texto').value.trim(),
        anunciante: $('#a-anunciante').value.trim() || null, link: $('#a-link').value.trim() || null, cor: $('#a-cor').value, inicio: $('#a-inicio').value || null,
        fim: $('#a-fim').value || null, ordem: Number($('#a-ordem').value) || 0, ativo: $('#a-ativo').checked };
      var antiga = st.anuncios.filter(function (y) { return y.id === x.id; })[0];
      try {
        var img = await lerImagem($('#a-img').files[0]);
        x.imagem_url = img || ($('#a-sem-img') && $('#a-sem-img').checked ? null : (antiga && antiga.imagem_url) || null);
        if (!COM_BANCO) P.conferirAnuncio(x);
        if (x.tipo === 'patrocinador' && !x.anunciante) throw new Error('Informe o nome do patrocinador.');
        await fonte.salvarAnuncio(x);
        st.anuncioEditando = null; toast('Propaganda salva.'); await recarregar();
      } catch (e) { alert(e.message); }
    }
  });

  iniciar();
})();
