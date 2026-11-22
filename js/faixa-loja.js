/* Pede Sul — faixa de propaganda e tema da época DENTRO da loja (pedido do Rinaldo, 22/11/2026, para a Êta Brownie
   e todas as lojas do motor).
   - A faixa passa sozinha (a cada 5 s; com o dedo também), com:
     1) a saudação da festa da época, com o nome da loja;
     2) o nome da loja com a logo;
     3) os produtos em promoção ("🔥 Promoção: de R$ X." no começo da descrição);
     4) os produtos marcados como destaque;
     5) as propagandas de parceiros que a dona cadastra no painel (aba Loja → Faixa de propaganda).
     As promoções e os destaques são montados sozinhos pelo cardápio.
   - Tema da época: perto de cada festa a loja muda sozinha de cores e ganha enfeites com movimento (js/temas.js).
     Com a região BA entram também a Lavagem do Bonfim, a Festa de Iemanjá e o Dois de Julho.
     Para ver antes da hora: loja.html?loja=etabrownie&tema=natal (ou carnaval, saojoao, maes, pais, bonfim, iemanja...).
     ?tema=nenhum desliga. */
(function () {
  'use strict';
  var N = window.AterrisseNucleo, T = window.PedeSulTemas;
  var esc = N.escaparHtml;
  function $(s) { return document.querySelector(s); }
  var semMovimento = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var IMG_OK = /^(https:\/\/|assets\/|data:image\/(png|jpeg|webp);base64,)/;
  var st = { lista: [], atual: 0, timer: null, parado: false, tema: null, montada: false };

  function lerPromo(desc) {
    var m = /^\s*🔥?\s*Promo[çc][ãa]o:\s*de R\$\s*([0-9.,]+?)\.?\s+/i.exec(String(desc || '') + ' ');
    return m ? m[1] : null;
  }
  function nomeCurto(nome) { return String(nome || '').replace(/^Brownie recheado\s*-\s*/i, 'Brownie ').trim(); }
  function escurecer(hex, f) {
    var n = parseInt(hex.slice(1), 16), r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    return 'rgb(' + Math.round(r * f) + ',' + Math.round(g * f) + ',' + Math.round(b * f) + ')';
  }
  function corOk(c, padrao) { return /^#[0-9a-fA-F]{6}$/.test(c || '') ? c : padrao; }

  function temaEscolhido(regiao) {
    if (!T) return null;
    var pedido = (/[?&]tema=([a-z]+)/.exec(location.search) || [])[1];
    if (pedido) return pedido === 'nenhum' ? null : T.porId(pedido);
    return T.temaDoDia(new Date(), regiao);
  }

  // ------------------------------------------------------------ monta a lista da faixa
  function montarLista(c, faixa, tema) {
    var l = c.loja || {}, nome = l.nome || 'Loja', cor = corOk(l.cor, '#f2552c'), lista = [];
    var logo = l.logo_url && IMG_OK.test(l.logo_url) ? l.logo_url : null;
    if (tema) {
      var f = T.fraseDaLoja(tema, nome, faixa.regiao);
      lista.push({ tipo: 'tema', selo: tema.emoji + ' ' + tema.nome, titulo: f[0], texto: f[1], cor: tema.cores[0], cor2: tema.cores[1], emoji: tema.emoji, acao: 'Ver cardápio ›', ancora: '#cardapio' });
    }
    lista.push({ tipo: 'loja', selo: l.aberto === false ? 'Fechado agora' : 'Aberto para pedidos', titulo: nome,
      texto: l.horario_funcionamento || 'Peça pelo nosso delivery, sem fila e sem ligação.', cor: cor, logo: logo, emoji: '🛵', acao: 'Fazer meu pedido ›', ancora: '#cardapio' });
    var ativas = (c.categorias || []).map(function (k) { return k.id; });
    var vendaveis = (c.produtos || []).filter(function (p) { return p.ativo !== false && p.disponivel !== false && ativas.indexOf(p.categoria_id) >= 0; });
    if (faixa.faixa_auto !== false) {
      var promos = vendaveis.filter(function (p) { return lerPromo(p.descricao); }).slice(0, 5);
      promos.forEach(function (p) {
        lista.push({ tipo: 'promocao', selo: '🔥 Promoção', titulo: nomeCurto(p.nome), texto: 'De R$ ' + lerPromo(p.descricao) + ' por ' + N.reais(p.preco),
          cor: '#c2213a', imagem: p.imagem_url && IMG_OK.test(p.imagem_url) ? p.imagem_url : null, emoji: p.icone || '🔥', produto: p.id, acao: 'Pedir agora ›' });
      });
      vendaveis.filter(function (p) { return p.destaque && promos.indexOf(p) < 0; }).slice(0, 4).forEach(function (p) {
        lista.push({ tipo: 'destaque', selo: '⭐ Destaque', titulo: nomeCurto(p.nome), texto: N.reais(p.preco) + (p.descricao ? ' · ' + String(p.descricao).slice(0, 70) + (String(p.descricao).length > 70 ? '…' : '') : ''),
          cor: cor, imagem: p.imagem_url && IMG_OK.test(p.imagem_url) ? p.imagem_url : null, emoji: p.icone || '⭐', produto: p.id, acao: 'Pedir agora ›' });
      });
    }
    (faixa.anuncios || []).forEach(function (a) {
      if (a.ativo === false) return;
      var hoje = new Date().toISOString().slice(0, 10);
      if ((a.inicio && a.inicio > hoje) || (a.fim && a.fim < hoje)) return;
      lista.push({ tipo: 'parceiro', selo: 'Parceiro' + (a.anunciante ? ' · ' + a.anunciante : ''), titulo: a.titulo, texto: a.texto, cor: corOk(a.cor, '#5b3a8f'),
        imagem: a.imagem_url && IMG_OK.test(a.imagem_url) ? a.imagem_url : null, emoji: '📣', link: a.link && /^https:\/\//.test(a.link) ? a.link : null, acao: 'Saiba mais ›' });
    });
    return lista;
  }

  // ------------------------------------------------------------ desenha a faixa
  function render() {
    var sec = $('#loja-faixa'), lista = st.lista;
    if (!sec) return;
    if (!lista.length) { sec.hidden = true; return; }
    sec.hidden = false;
    $('#lf-trilho').innerHTML = lista.map(function (a, i) {
      var cor = a.cor, img = a.imagem;
      var arte = img ? '' : '<span class="v-an-arte' + (a.logo ? ' com-logo' : '') + '" aria-hidden="true">' + (a.logo ? '<img src="' + esc(a.logo) + '" alt="">' : esc(a.emoji || '✨')) + '</span>';
      var dentro = '<i class="v-an-bolha b1" aria-hidden="true"></i><i class="v-an-bolha b2" aria-hidden="true"></i>' + arte +
        '<span class="v-an-conteudo"><span class="v-an-selo' + (a.tipo === 'parceiro' ? ' patro' : a.tipo === 'promocao' ? ' promo' : '') + '">' + esc(a.selo) + '</span>' +
        '<strong>' + esc(a.titulo) + '</strong>' + (a.texto ? '<span class="v-an-texto">' + esc(a.texto) + '</span>' : '') +
        (a.acao ? '<span class="v-an-acao">' + esc(a.acao) + '</span>' : '') + '</span>';
      var estilo = 'background-color:' + esc(cor) + (img ? ';background-image:linear-gradient(90deg,rgba(0,0,0,.72),rgba(0,0,0,.18) 70%),url(&quot;' + esc(img) + '&quot;)'
        : (a.cor2 ? ';background-image:linear-gradient(120deg,' + esc(cor) + ' 0%,' + esc(a.cor2) + ' 50%,' + esc(cor) + ' 100%)'
          : ';background-image:linear-gradient(120deg,' + esc(cor) + ' 0%,' + escurecer(cor, 0.55) + ' 45%,' + esc(cor) + ' 70%,' + escurecer(cor, 0.75) + ' 100%)'));
      var base = ' class="v-an lf-' + a.tipo + (img ? ' com-imagem' : '') + (i === st.atual ? ' ativa' : '') + '" role="group" aria-roledescription="propaganda" aria-label="' + (i + 1) + ' de ' + lista.length + ': ' + esc(a.titulo) + '" data-i="' + i + '" style="' + estilo + '"';
      if (a.produto) return '<button type="button"' + base + ' data-acao="abrir-produto" data-id="' + esc(a.produto) + '">' + dentro + '</button>';
      if (a.link) return '<a' + base + ' href="' + esc(a.link) + '" target="_blank" rel="noopener sponsored">' + dentro + '</a>';
      if (a.ancora) return '<a' + base + ' href="' + esc(a.ancora) + '">' + dentro + '</a>';
      return '<div' + base + '>' + dentro + '</div>';
    }).join('');
    $('#lf-pontos').innerHTML = lista.length > 1 ? lista.map(function (a, i) {
      return '<button type="button" data-lf-ir="' + i + '" aria-label="Propaganda ' + (i + 1) + '"' + (i === st.atual ? ' aria-current="true"' : '') + '></button>';
    }).join('') : '';
    marcar();
    girar();
  }
  function irPara(i) {
    var t = $('#lf-trilho'), n = st.lista.length;
    if (!t || !n) return;
    st.atual = (i + n) % n;
    var alvo = t.children[st.atual];
    if (alvo) t.scrollTo({ left: alvo.offsetLeft - t.offsetLeft, behavior: 'smooth' });
    marcar();
  }
  function marcar() {
    Array.prototype.forEach.call(document.querySelectorAll('#lf-pontos button'), function (b, k) {
      if (k === st.atual) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current');
    });
    Array.prototype.forEach.call(document.querySelectorAll('#lf-trilho .v-an'), function (el, k) { el.classList.toggle('ativa', k === st.atual); });
    var p = document.querySelector('#lf-pontos button[aria-current]');
    if (p) { p.classList.remove('enchendo'); void p.offsetWidth; if (!semMovimento) p.classList.add('enchendo'); }
  }
  function girar() {
    if (st.timer) clearInterval(st.timer);
    if (st.lista.length < 2 || semMovimento) return;
    st.timer = setInterval(function () { if (!st.parado && !document.hidden) irPara(st.atual + 1); }, 5000);
  }
  function ligarEventos() {
    var trilho = $('#lf-trilho');
    if (!trilho) return;
    var tRolar = null;
    trilho.addEventListener('scroll', function () {
      clearTimeout(tRolar);
      tRolar = setTimeout(function () { st.atual = Math.round(trilho.scrollLeft / (trilho.clientWidth || 1)); marcar(); }, 120);
    }, { passive: true });
    ['pointerenter', 'focusin', 'touchstart'].forEach(function (ev) { trilho.addEventListener(ev, function () { st.parado = true; }, { passive: true }); });
    ['pointerleave', 'focusout', 'touchend'].forEach(function (ev) { trilho.addEventListener(ev, function () { setTimeout(function () { st.parado = false; }, 4000); }, { passive: true }); });
    $('#lf-pontos').addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-lf-ir]'); if (b) irPara(Number(b.dataset.lfIr));
    });
  }

  // ------------------------------------------------------------ tema da época (cores + enfeites com movimento)
  var ENFEITES = {
    confete: { tipo: 'cair', formas: true, qtd: 22 },
    fitas: { tipo: 'cair', formas: true, fita: true, qtd: 18 },
    neve: { tipo: 'cair', itens: ['❄', '•', '❅', '•'], qtd: 20, devagar: true },
    flores: { tipo: 'cair', itens: ['🌼', '🤍', '🌊', '✨'], qtd: 14, devagar: true },
    coracoes: { tipo: 'subir', itens: ['❤', '💗', '🌸'], qtd: 12 },
    estrelas: { tipo: 'piscar', itens: ['✨', '⭐', '✦'], qtd: 14 },
    baloes: { tipo: 'subir', itens: ['🎈', '🎈', '🎉'], qtd: 10 },
    ovos: { tipo: 'cair', itens: ['🍫', '🥚', '🐰'], qtd: 10, devagar: true },
    faiscas: { tipo: 'piscar', itens: ['🏷️', '✨', '%'], qtd: 12 },
    fogos: { tipo: 'fogos', qtd: 6 },
    bandeirinhas: { tipo: 'bandeirinhas' }
  };
  function enfeitesHtml(tema) {
    var e = ENFEITES[tema.enfeite], c = tema.cores;
    if (!e) return '';
    var cores = [c[2], '#ffffff', c[1], '#f2552c', '#0e7c86', '#ffd23f'], h = '';
    if (e.tipo === 'bandeirinhas') {
      for (var b = 0; b < 16; b++) h += '<i class="bandeira" style="background:' + cores[b % cores.length] + ';animation-delay:' + (b * 0.12).toFixed(2) + 's"></i>';
      return '<div class="varal">' + h + '</div><div class="varal dois">' + h + '</div>';
    }
    for (var i = 0; i < e.qtd; i++) {  // posições fixas: a página fica igual em todo aparelho
      var x = (i * 37 + 11) % 100, atraso = ((i * 7) % 10) * 0.6, dur = (e.devagar ? 9 : 6) + (i % 5);
      if (e.tipo === 'fogos') h += '<i class="fogo" style="left:' + (8 + (i * 29) % 84) + '%;top:' + (8 + (i * 17) % 50) + '%;animation-delay:' + (i * 0.7).toFixed(1) + 's;color:' + cores[i % cores.length] + '"></i>';
      else if (e.formas) h += '<i class="particula cair confete' + (e.fita ? ' fita' : '') + '" style="left:' + x + '%;background:' + cores[i % cores.length] + ';animation-delay:-' + atraso + 's;animation-duration:' + dur + 's"></i>';
      else h += '<i class="particula ' + e.tipo + '" style="left:' + x + '%;' + (e.tipo === 'piscar' ? 'top:' + ((i * 23) % 80) + '%;' : '') +
        'animation-delay:-' + atraso + 's;animation-duration:' + dur + 's;font-size:' + (14 + (i % 4) * 6) + 'px">' + e.itens[i % e.itens.length] + '</i>';
    }
    return h;
  }
  function aplicarTema(tema, nomeLoja) {
    if (!tema) return;
    var r = document.documentElement, c = tema.cores;
    document.body.classList.add('com-tema', 'tema-' + tema.id);
    r.style.setProperty('--tema1', c[0]); r.style.setProperty('--tema2', c[1]); r.style.setProperty('--tema3', c[2]);
    var heroi = document.querySelector('.heroi');
    if (!heroi) return;
    var chip = document.createElement('p');
    chip.className = 'v-tema-chip lf-tema-chip';
    chip.textContent = tema.emoji + ' Clima de ' + tema.nome + ' na ' + nomeLoja;
    var h1 = $('#titulo-heroi');
    if (h1 && h1.parentNode) h1.parentNode.insertBefore(chip, h1);
    if (semMovimento) return;
    var caixa = document.createElement('div');
    caixa.className = 'v-enfeites lf-enfeites'; caixa.setAttribute('aria-hidden', 'true');
    caixa.innerHTML = enfeitesHtml(tema);
    heroi.insertBefore(caixa, heroi.firstChild);
  }

  // Chamado pelo cardápio (js/publico.js) quando ele carrega pela primeira vez.
  async function montar(cardapio, api) {
    if (st.montada || !cardapio || !cardapio.loja) return;
    st.montada = true;
    var faixa = { anuncios: [], regiao: cardapio.loja.regiao || null, faixa_auto: true };
    try { if (api && api.faixaLoja) faixa = Object.assign(faixa, await api.faixaLoja()); } catch (e) { /* sem faixa salva: só promoções e destaques */ }
    st.tema = temaEscolhido(faixa.regiao);
    aplicarTema(st.tema, cardapio.loja.nome || 'loja');
    st.lista = montarLista(cardapio, faixa, st.tema);
    ligarEventos();
    render();
  }

  window.PedeSulFaixaLoja = { montar: montar, st: st, lerPromo: lerPromo, montarLista: montarLista };
})();
