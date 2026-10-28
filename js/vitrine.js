/* Pede Sul — vitrine: todas as lojas liberadas que escolheram aparecer na plataforma.
   Lojas "individuais" (com endereço e marca próprios) e do plano Salão (só dentro da loja) não aparecem aqui.
   No topo, a faixa de propagandas que passa sozinha: lojas, promoções, destaques e patrocinadores (a RMD cadastra).
   Com o banco: lojas e propagandas vêm do servidor. Modo demonstração: deste navegador. */
(function () {
  'use strict';
  var N = window.AterrisseNucleo, P = window.PedeSulPlataforma, B = window.AterrisseBackend;
  var cfg = window.ATERRISSE_CONFIG || {};
  var esc = N.escaparHtml;
  var api = B.criar(Object.assign({}, cfg, { LOJA: 'vitrine' }));
  var COM_BANCO = api.modo === 'supabase';
  function $(s) { return document.querySelector(s); }
  var st = { lojas: [], filtro: '', busca: '', anuncios: [], atual: 0, timer: null, parado: false };
  // Tema da época: liga sozinho perto de cada festa (js/temas.js). ?tema=natal mostra antes da hora; ?tema=nenhum desliga.
  var T = window.PedeSulTemas;
  var pedido = (/[?&]tema=([a-z]+)/.exec(location.search) || [])[1];
  var TEMA = !T ? null : (pedido ? (pedido === 'nenhum' ? null : T.porId(pedido)) : T.temaDoDia(new Date()));

  function normalizar(t) { return String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }

  async function carregar() {
    if (COM_BANCO) {
      try {
        st.lojas = (await api.lojasDaVitrine()).map(function (l) { return { pl: l, loja: l, produtos: l.produtos || '' }; });
      } catch (e) { st.erro = e.message; st.lojas = []; }
      try { st.anuncios = await api.anuncios(); } catch (e) { st.anuncios = []; }
    } else {
      st.lojas = await Promise.all(P.daVitrine().map(async function (pl) {
        var c = null;
        try { c = await new B.BackendDemo(undefined, undefined, { loja: pl.slug, vitrine: !!cfg.VITRINE }).cardapio(); } catch (e) { /* loja sem dados: mostra só o nome */ }
        return { pl: pl, loja: c && c.loja, produtos: c ? c.produtos.map(function (p) { return p.nome; }).join(' ') : '' };
      }));
      st.anuncios = P.anunciosNoAr();
    }
    if (TEMA) st.anuncios = [{ id: 'tema-' + TEMA.id, tipo: 'destaque', titulo: TEMA.saudacao[0], texto: TEMA.saudacao[1],
      cor: TEMA.cores[0], cor2: TEMA.cores[1], emoji: TEMA.emoji, epoca: TEMA.nome }].concat(st.anuncios || []);
    renderAnuncios();
    render();
  }

  // ---------------------------------------------------------------- faixa de propagandas

  var SELO = { loja: 'Loja Pede Sul', promocao: 'Promoção', destaque: 'Destaque', patrocinador: 'Patrocinado' };
  var ARTE = { loja: '🍽️', promocao: '🔥', destaque: '🎉', patrocinador: '📣' };
  // a mesma cor, mais escura: o fundo da propaganda vira um degradê que se mexe
  function escurecer(hex, f) {
    var n = parseInt(hex.slice(1), 16), r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    return 'rgb(' + Math.round(r * f) + ',' + Math.round(g * f) + ',' + Math.round(b * f) + ')';
  }
  function linkDe(a) {
    if (a.loja) return { href: 'loja.html?loja=' + encodeURIComponent(a.loja), fora: false };
    if (a.link && /^https:\/\//.test(a.link)) return { href: a.link, fora: true };
    return null;
  }
  function renderAnuncios() {
    var sec = $('#v-anuncios'), lista = st.anuncios || [];
    if (!lista.length) { sec.hidden = true; return; }
    sec.hidden = false;
    $('#v-an-trilho').innerHTML = lista.map(function (a, i) {
      var cor = /^#[0-9a-fA-F]{6}$/.test(a.cor || '') ? a.cor : '#f2552c';
      var img = a.imagem_url && /^(https:\/\/|assets\/|data:image\/(png|jpeg|webp);base64,)/.test(a.imagem_url) ? a.imagem_url : null;
      var l = linkDe(a);
      var dentro = '<i class="v-an-bolha b1" aria-hidden="true"></i><i class="v-an-bolha b2" aria-hidden="true"></i>' +
        (img ? '' : '<span class="v-an-arte" aria-hidden="true">' + (a.emoji || ARTE[a.tipo] || '✨') + '</span>') +
        '<span class="v-an-conteudo"><span class="v-an-selo' + (a.tipo === 'patrocinador' ? ' patro' : '') + '">' + esc(a.epoca || SELO[a.tipo] || '') + (a.tipo === 'patrocinador' && a.anunciante ? ' · ' + esc(a.anunciante) : '') + '</span>' +
        '<strong>' + esc(a.titulo) + '</strong>' + (a.texto ? '<span class="v-an-texto">' + esc(a.texto) + '</span>' : '') +
        (l ? '<span class="v-an-acao">' + (l.fora ? 'Saiba mais ›' : 'Ver a loja ›') + '</span>' : '') + '</span>';
      var estilo = 'background-color:' + esc(cor) + (img ? ';background-image:linear-gradient(90deg,rgba(0,0,0,.62),rgba(0,0,0,.08)),url(&quot;' + esc(img) + '&quot;)'
        : (a.cor2 ? ';background-image:linear-gradient(120deg,' + esc(cor) + ' 0%,' + esc(a.cor2) + ' 50%,' + esc(cor) + ' 100%)'
          : ';background-image:linear-gradient(120deg,' + esc(cor) + ' 0%,' + escurecer(cor, 0.62) + ' 45%,' + esc(cor) + ' 70%,' + escurecer(cor, 0.8) + ' 100%)'));
      var attrs = ' class="v-an' + (img ? ' com-imagem' : '') + (i === st.atual ? ' ativa' : '') + '" role="group" aria-roledescription="propaganda" aria-label="' + (i + 1) + ' de ' + lista.length + '" data-i="' + i + '" style="' + estilo + '"';
      return l ? '<a' + attrs + ' href="' + esc(l.href) + '"' + (l.fora ? ' target="_blank" rel="noopener sponsored"' : '') + '>' + dentro + '</a>' : '<div' + attrs + '>' + dentro + '</div>';
    }).join('');
    $('#v-an-pontos').innerHTML = lista.length > 1 ? lista.map(function (a, i) {
      return '<button type="button" data-ir="' + i + '" aria-label="Propaganda ' + (i + 1) + '"' + (i === st.atual ? ' aria-current="true"' : '') + '></button>';
    }).join('') : '';
    iniciarGiro();
  }
  function irPara(i, suave) {
    var t = $('#v-an-trilho'), n = st.anuncios.length;
    if (!n) return;
    st.atual = (i + n) % n;
    var alvo = t.children[st.atual];
    if (alvo) t.scrollTo({ left: alvo.offsetLeft - t.offsetLeft, behavior: suave === false ? 'auto' : 'smooth' });
    marcarPonto();
  }
  function marcarPonto() {
    Array.prototype.forEach.call(document.querySelectorAll('#v-an-pontos button'), function (b, k) {
      if (k === st.atual) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current');
    });
    // a propaganda da vez entra com animação (o texto sobe e a ilustração aparece)
    Array.prototype.forEach.call(document.querySelectorAll('#v-an-trilho .v-an'), function (el, k) {
      if (k === st.atual) el.classList.add('ativa'); else el.classList.remove('ativa');
    });
    // a barrinha do ponto da vez enche em 5 s (recomeça a cada troca)
    var p = document.querySelector('#v-an-pontos button[aria-current]');
    if (p) { p.classList.remove('enchendo'); void p.offsetWidth; if (!semMovimento) p.classList.add('enchendo'); }
  }
  var semMovimento = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function iniciarGiro() {
    if (st.timer) clearInterval(st.timer);
    if (st.anuncios.length < 2 || semMovimento) return;  // quem pediu menos movimento no aparelho passa com o dedo
    st.timer = setInterval(function () { if (!st.parado && !document.hidden) irPara(st.atual + 1); }, 5000);
  }
  var trilho = $('#v-an-trilho');
  // passou com o dedo: acompanha o ponto e dá um tempo antes de voltar a girar
  var tRolar = null;
  trilho.addEventListener('scroll', function () {
    clearTimeout(tRolar);
    tRolar = setTimeout(function () {
      var w = trilho.clientWidth || 1;
      st.atual = Math.round(trilho.scrollLeft / w);
      marcarPonto();
    }, 120);
  }, { passive: true });
  ['pointerenter', 'focusin', 'touchstart'].forEach(function (ev) { trilho.addEventListener(ev, function () { st.parado = true; }, { passive: true }); });
  ['pointerleave', 'focusout', 'touchend'].forEach(function (ev) { trilho.addEventListener(ev, function () { setTimeout(function () { st.parado = false; }, 4000); }, { passive: true }); });

  // ---------------------------------------------------------------- lojas

  function render() {
    var h = '';
    if (cfg.MODO === 'demo' && !cfg.VITRINE) h += '<div class="faixa faixa-demo" role="note">⚠️ MODO DEMONSTRAÇÃO — as lojas e os pedidos ficam só neste aparelho.</div>';
    if (st.erro) h += '<div class="faixa faixa-fechado" role="alert">' + esc(st.erro) + '</div>';
    $('#faixas').innerHTML = h;
    var segs = [];
    st.lojas.forEach(function (x) { var s = x.pl.segmento; if (s && segs.indexOf(s) < 0) segs.push(s); });
    $('#v-chips').innerHTML = ['Tudo'].concat(segs).map(function (s) {
      var on = (s === 'Tudo' && !st.filtro) || s === st.filtro;
      return '<button type="button" class="chip' + (on ? ' agora' : '') + '" data-seg="' + esc(s === 'Tudo' ? '' : s) + '" aria-pressed="' + on + '">' + esc(s) + '</button>';
    }).join('');
    var termo = normalizar(st.busca.trim());
    var lista = st.lojas.filter(function (x) {
      if (st.filtro && x.pl.segmento !== st.filtro) return false;
      return !termo || normalizar(x.pl.nome + ' ' + x.pl.segmento + ' ' + x.produtos).indexOf(termo) >= 0;
    });
    if (!lista.length) { $('#v-lojas').innerHTML = '<div class="vazio">' + (st.lojas.length ? 'Nenhuma loja encontrada.' : 'Nenhuma loja na vitrine ainda.') + '</div>'; return; }
    $('#v-lojas').innerHTML = lista.map(function (x) {
      var l = x.loja || {}, pl = x.pl;
      var cor = /^#[0-9a-fA-F]{6}$/.test(l.cor || pl.cor || '') ? (l.cor || pl.cor) : '#f2552c';
      var info = [];
      if (l.aceita_entrega !== false && l.previsao_entrega_min) info.push(l.previsao_entrega_min + ' min');
      if (l.aceita_entrega !== false) info.push(Number(l.taxa_entrega) > 0 ? 'entrega ' + N.reais(l.taxa_entrega) : 'entrega grátis');
      else if (l.aceita_retirada !== false) info.push('só retirada');
      var aberta = l.aberto !== false;
      var logo = l.logo_url && /^(https:\/\/|assets\/|data:image\/(png|jpeg|webp);base64,)/.test(l.logo_url)
        ? '<img src="' + esc(l.logo_url) + '" alt="">' : '<span aria-hidden="true">' + esc(pl.icone || '🍽️') + '</span>';
      return '<a class="v-loja' + (aberta ? '' : ' fechada') + '" href="loja.html?loja=' + encodeURIComponent(pl.slug) + '">' +
        '<span class="v-logo" style="background:' + esc(cor) + '">' + logo + '</span>' +
        '<span class="v-info"><b>' + esc(l.nome || pl.nome) + '</b><small>' + esc(pl.segmento || '') + (info.length ? ' · ' + esc(info.join(' · ')) : '') + '</small>' +
        '<small class="' + (aberta ? 'v-aberta' : 'v-fechada') + '">' + (aberta ? 'Aberta agora' : 'Fechada no momento') + '</small></span>' +
        '<span class="v-seta" aria-hidden="true">›</span></a>';
    }).join('');
  }

  document.addEventListener('click', function (ev) {
    var ir = ev.target.closest('[data-ir]');
    if (ir) { st.parado = true; irPara(Number(ir.dataset.ir)); setTimeout(function () { st.parado = false; }, 6000); return; }
    var b = ev.target.closest('[data-seg]');
    if (!b) return;
    st.filtro = b.dataset.seg; render();
  });
  var t = null;
  $('#v-busca').addEventListener('input', function (ev) { clearTimeout(t); t = setTimeout(function () { st.busca = ev.target.value; render(); }, 150); });

  // vídeo da vitrine: abre por cima e para de tocar ao fechar
  var janela = $('#v-video-janela');
  if (janela && janela.showModal) {
    var video = janela.querySelector('video');
    $('#v-ver-video').addEventListener('click', function () { janela.showModal(); try { video.play(); } catch (e) { /* o navegador pode pedir toque */ } });
    function fechar() { video.pause(); janela.close(); }
    $('#v-video-fechar').addEventListener('click', fechar);
    janela.addEventListener('click', function (ev) { if (ev.target === janela) fechar(); });
    janela.addEventListener('close', function () { video.pause(); });
  } else if ($('#v-ver-video')) $('#v-ver-video').hidden = true;

  // ---------------------------------------------------------------- tema da época (cores + enfeites com movimento)
  var ENFEITES = {
    confete: { tipo: 'cair', itens: ['', '', '', ''], formas: true, qtd: 22 },
    neve: { tipo: 'cair', itens: ['❄', '•', '❅', '•'], qtd: 20, devagar: true },
    coracoes: { tipo: 'subir', itens: ['❤', '💗', '🌸'], qtd: 12 },
    estrelas: { tipo: 'piscar', itens: ['✨', '⭐', '✦'], qtd: 14 },
    baloes: { tipo: 'subir', itens: ['🎈', '🎈', '🎉'], qtd: 10 },
    ovos: { tipo: 'cair', itens: ['🍫', '🥚', '🐰'], qtd: 10, devagar: true },
    faiscas: { tipo: 'piscar', itens: ['🏷️', '✨', '%'], qtd: 12 },
    fogos: { tipo: 'fogos', qtd: 6 },
    bandeirinhas: { tipo: 'bandeirinhas' }
  };
  function aplicarTema() {
    if (!TEMA) return;
    var raizEl = document.documentElement, c = TEMA.cores;
    document.body.classList.add('com-tema', 'tema-' + TEMA.id);
    raizEl.style.setProperty('--tema1', c[0]); raizEl.style.setProperty('--tema2', c[1]); raizEl.style.setProperty('--tema3', c[2]);
    var chip = $('#v-tema-chip');
    if (chip) { chip.textContent = TEMA.emoji + ' Clima de ' + TEMA.nome + ' na Zona Sul'; chip.hidden = false; }
    var caixa = $('#v-enfeites'), e = ENFEITES[TEMA.enfeite];
    if (!caixa || !e || semMovimento) return;
    var cores = [c[2], '#ffffff', c[1], '#f2552c', '#0e7c86'], h = '';
    if (e.tipo === 'bandeirinhas') {
      for (var b = 0; b < 16; b++) h += '<i class="bandeira" style="background:' + cores[b % cores.length] + ';animation-delay:' + (b * 0.12).toFixed(2) + 's"></i>';
      caixa.innerHTML = '<div class="varal">' + h + '</div><div class="varal dois">' + h + '</div>';
      return;
    }
    // posições e tempos fixos (não sorteados), para a página ficar igual em todo aparelho
    for (var i = 0; i < e.qtd; i++) {
      var x = (i * 37 + 11) % 100, atraso = ((i * 7) % 10) * 0.6, dur = (e.devagar ? 9 : 6) + (i % 5);
      if (e.tipo === 'fogos') {
        h += '<i class="fogo" style="left:' + (8 + (i * 29) % 84) + '%;top:' + (8 + (i * 17) % 50) + '%;animation-delay:' + (i * 0.7).toFixed(1) + 's;color:' + cores[i % cores.length] + '"></i>';
      } else if (e.formas) {
        h += '<i class="particula cair confete" style="left:' + x + '%;background:' + cores[i % cores.length] + ';animation-delay:-' + atraso + 's;animation-duration:' + dur + 's"></i>';
      } else {
        h += '<i class="particula ' + e.tipo + '" style="left:' + x + '%;' + (e.tipo === 'piscar' ? 'top:' + ((i * 23) % 80) + '%;' : '') +
          'animation-delay:-' + atraso + 's;animation-duration:' + dur + 's;font-size:' + (14 + (i % 4) * 6) + 'px">' + e.itens[i % e.itens.length] + '</i>';
      }
    }
    caixa.innerHTML = h;
  }
  aplicarTema();

  window.PedeSulVitrine = { st: st, tema: TEMA }; // para conferência nos testes
  carregar();
})();
