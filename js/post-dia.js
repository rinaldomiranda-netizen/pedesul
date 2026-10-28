/* Post do dia para o Status (Stories) do WhatsApp.
   Monta a arte 1080x1920 a partir do PRÓPRIO cardápio cadastrado (opções disponíveis do dia + preços),
   com a logo e o nome da loja, e chama o compartilhar do celular (lá a pessoa escolhe WhatsApp → Meu status).
   montar() e textoWhatsApp() não dependem do navegador (testáveis no Node); o resto desenha no <canvas>. */
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica();
  else raiz.AterrissePostDia = fabrica();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var LARG = 1080, ALT = 1920;
  var DIAS = ['DOMINGO', 'SEGUNDA', 'TERÇA', 'QUARTA', 'QUINTA', 'SEXTA', 'SÁBADO'];
  var TEMAS = {
    madeira: { nome: 'Madeira', fundo: ['#3a2416', '#24150c'], tabua: 'rgba(0,0,0,.28)', veio: 'rgba(255,214,160,.05)', destaque: '#ff9a1f', texto: '#ffffff', titulo: '#ffffff', caixa: '#ff9a1f', caixaTexto: '#2a1607', suave: '#f6dcc0' },
    noite: { nome: 'Noite', fundo: ['#101a2c', '#070b14'], tabua: 'rgba(255,255,255,.02)', veio: 'rgba(120,170,255,.05)', destaque: '#ffb72b', texto: '#ffffff', titulo: '#ffffff', caixa: '#ffb72b', caixaTexto: '#1a1204', suave: '#cfe0ff' },
    laranja: { nome: 'Laranja', fundo: ['#ff8a1a', '#e2560c'], tabua: 'rgba(0,0,0,.06)', veio: 'rgba(255,255,255,.07)', destaque: '#3a1a05', texto: '#ffffff', titulo: '#ffffff', caixa: '#2a1607', caixaTexto: '#ffffff', suave: '#fff1dc' }
  };
  var F_TITULO = '"Anton", Impact, "Arial Narrow", "sans-serif-condensed", sans-serif';
  var F_ITEM = '"Oswald", "Arial Narrow", "sans-serif-condensed", Impact, sans-serif';
  var F_LETRA = '"Pacifico", "Brush Script MT", "Segoe Script", "Dancing Script", cursive';

  function diaDaSemana(data, fuso) {
    try {
      var n = new Intl.DateTimeFormat('en-US', { timeZone: fuso || 'America/Maceio', weekday: 'short' }).format(data || new Date());
      return DIAS[['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(n)] || DIAS[(data || new Date()).getDay()];
    } catch (e) { return DIAS[(data || new Date()).getDay()]; }
  }

  function preco(v) {
    var n = Math.round(Number(v || 0) * 100) / 100;
    return 'R$ ' + (n % 1 ? n.toFixed(2).replace('.', ',') : String(n));
  }

  // Conteúdo do post a partir do cardápio público ({ loja, categorias, produtos }).
  // Produto com grupos de opções (ex.: quentinha) → cada grupo vira um bloco com as opções DISPONÍVEIS;
  // os produtos viram a caixa de preços. Categoria sem grupos → um bloco com os produtos e preços.
  function montar(cardapio, categoriaId) {
    var cats = (cardapio.categorias || []).filter(function (c) { return c.ativa !== false; });
    var cat = cats.filter(function (c) { return c.id === categoriaId; })[0] || cats[0];
    var prods = (cardapio.produtos || []).filter(function (p) { return cat && p.categoria_id === cat.id && p.ativo !== false && p.disponivel !== false; })
      .sort(function (a, b) { return (a.ordem || 0) - (b.ordem || 0); });
    var blocos = [], porNome = {}, precos = [];
    // grupo "do dia" = escolha obrigatória ou opções sem custo (adicionais pagos, como bacon, não entram)
    var doDia = function (g) { return Number(g.minimo) >= 1 || (g.opcoes || []).every(function (o) { return !Number(o.preco); }); };
    var gruposDoDia = function (p) { return (p.grupos || []).filter(doDia); };
    // só monta por grupos quando TODOS os produtos são do tipo "monte o seu" (ex.: quentinhas)
    var comGrupos = prods.length && prods.every(function (p) { return gruposDoDia(p).length; }) ? prods : [];
    comGrupos.forEach(function (p) {
      gruposDoDia(p).forEach(function (g) {
        var chave = String(g.nome || '').trim().toLowerCase();
        if (!chave) return;
        var b = porNome[chave];
        if (!b) { b = porNome[chave] = { titulo: String(g.nome).trim(), itens: [] }; blocos.push(b); }
        (g.opcoes || []).forEach(function (o) {
          var nome = String(o.nome || '').trim();
          if (nome && o.disponivel !== false && b.itens.indexOf(nome) < 0) b.itens.push(nome);
        });
      });
      precos.push({ nome: p.nome, valor: preco(p.preco) });
    });
    blocos = blocos.filter(function (b) { return b.itens.length; });
    if (!comGrupos.length && prods.length) blocos.push({ titulo: cat.nome, itens: prods.map(function (p) { return p.nome + '  ' + preco(p.preco); }) });
    return { categoria: cat ? { id: cat.id, nome: cat.nome } : null, blocos: blocos, precos: precos, vazio: !blocos.length && !precos.length };
  }

  function telefoneVisivel(numero) {
    var d = String(numero || '').replace(/\D/g, '');
    if (d.length >= 12 && d.slice(0, 2) === '55') d = d.slice(2);
    if (d.length === 11) return '(' + d.slice(0, 2) + ') ' + d.slice(2, 7) + '-' + d.slice(7);
    if (d.length === 10) return '(' + d.slice(0, 2) + ') ' + d.slice(2, 6) + '-' + d.slice(6);
    return String(numero || '');
  }

  // Texto que vai junto da imagem (legenda) e serve também para mandar em grupos/listas.
  function textoWhatsApp(post, op) {
    var l = ['*' + (op.titulo || 'Cardápio do Dia') + (op.dia ? ' — ' + op.dia : '') + '* 🍽️', ''];
    post.blocos.forEach(function (b) { l.push('*' + b.titulo + ':* ' + b.itens.join(', ')); });
    if (post.precos.length) { l.push(''); post.precos.forEach(function (p) { l.push('• ' + p.nome + ': ' + p.valor); }); }
    l.push('');
    if (op.chamada) l.push(op.chamada);
    if (op.link) l.push('👉 ' + op.link);
    if (op.whatsapp) l.push('📲 WhatsApp: ' + telefoneVisivel(op.whatsapp));
    return l.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  // ------------------------------------------------------------ desenho (navegador)

  function carregarImagem(url) {
    return new Promise(function (ok) {
      if (!url) return ok(null);
      var img = new Image();
      if (!/^data:/.test(url)) img.crossOrigin = 'anonymous';
      img.onload = function () { ok(img); };
      img.onerror = function () { ok(null); };
      img.src = url;
    });
  }

  function fontesProntas() {
    if (typeof document === 'undefined' || !document.fonts || !document.fonts.load) return Promise.resolve();
    var pedidos = ['120px Anton', '60px Oswald', '600 60px Oswald', '80px Pacifico'].map(function (f) { return document.fonts.load(f).catch(function () {}); });
    return Promise.race([Promise.all(pedidos), new Promise(function (ok) { setTimeout(ok, 2500); })]);
  }

  // Ruído determinístico (a arte sai igual toda vez com os mesmos dados).
  function sorteio(semente) { var s = semente; return function () { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }

  function fundo(ctx, t) {
    var g = ctx.createLinearGradient(0, 0, 0, ALT);
    g.addColorStop(0, t.fundo[0]); g.addColorStop(1, t.fundo[1]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, LARG, ALT);
    var r = sorteio(42), y = 0;
    while (y < ALT) { // tábuas com veios
      var h = 150 + Math.floor(r() * 90);
      ctx.fillStyle = t.tabua; ctx.fillRect(0, y + h - 5, LARG, 5);
      for (var k = 0; k < 9; k++) {
        ctx.strokeStyle = t.veio; ctx.lineWidth = 1 + r() * 3;
        var yy = y + 12 + r() * (h - 24);
        ctx.beginPath(); ctx.moveTo(0, yy);
        for (var x = 0; x <= LARG; x += 60) ctx.lineTo(x, yy + Math.sin(x / (90 + r() * 80) + k) * (3 + r() * 5));
        ctx.stroke();
      }
      y += h;
    }
    var v = ctx.createRadialGradient(LARG / 2, ALT / 2, ALT * 0.25, LARG / 2, ALT / 2, ALT * 0.75);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.45)');
    ctx.fillStyle = v; ctx.fillRect(0, 0, LARG, ALT);
  }

  function caixaRedonda(ctx, x, y, w, h, raio) {
    ctx.beginPath(); ctx.moveTo(x + raio, y);
    ctx.arcTo(x + w, y, x + w, y + h, raio); ctx.arcTo(x + w, y + h, x, y + h, raio);
    ctx.arcTo(x, y + h, x, y, raio); ctx.arcTo(x, y, x + w, y, raio); ctx.closePath();
  }

  // Escreve diminuindo a fonte até caber na largura.
  function caber(ctx, texto, larg, tam, molde) {
    var t = tam;
    do { ctx.font = molde.replace('{t}', t); t -= 2; } while (ctx.measureText(texto).width > larg && t > 14);
    return t + 2;
  }

  function sombra(ctx, liga) {
    ctx.shadowColor = liga ? 'rgba(0,0,0,.55)' : 'transparent';
    ctx.shadowBlur = liga ? 14 : 0; ctx.shadowOffsetY = liga ? 4 : 0;
  }

  // Distribui os blocos em 2 colunas equilibrando a altura (ordem mantida dentro de cada coluna).
  function colunas(blocos) {
    if (blocos.length <= 1) return [blocos, []];
    var peso = function (b) { return b.itens.length + 1.6; };
    var total = blocos.reduce(function (s, b) { return s + peso(b); }, 0), acum = 0, corte = blocos.length;
    for (var i = 0; i < blocos.length; i++) {
      if (acum + peso(blocos[i]) / 2 > total / 2 && i > 0) { corte = i; break; }
      acum += peso(blocos[i]);
    }
    return [blocos.slice(0, corte), blocos.slice(corte)];
  }

  async function desenhar(canvas, post, op) {
    var t = TEMAS[op.tema] || TEMAS.madeira;
    canvas.width = LARG; canvas.height = ALT;
    var ctx = canvas.getContext('2d');
    var res = await Promise.all([fontesProntas(), carregarImagem(op.logo)]);
    var logo = res[1];
    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
    fundo(ctx, t);

    // topo: logo + nome da loja (abaixo da faixa que o WhatsApp põe por cima no Status)
    var yTopo = 190, tamLogo = 190;
    if (logo) {
      ctx.save(); sombra(ctx, true);
      ctx.beginPath(); ctx.arc(LARG / 2, yTopo + tamLogo / 2, tamLogo / 2 + 10, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill();
      ctx.restore(); ctx.save();
      ctx.beginPath(); ctx.arc(LARG / 2, yTopo + tamLogo / 2, tamLogo / 2, 0, Math.PI * 2); ctx.clip();
      var esc = Math.max(tamLogo / logo.width, tamLogo / logo.height);
      ctx.drawImage(logo, LARG / 2 - logo.width * esc / 2, yTopo + tamLogo / 2 - logo.height * esc / 2, logo.width * esc, logo.height * esc);
      ctx.restore();
    }
    var y = logo ? yTopo + tamLogo + 78 : yTopo + 40;
    ctx.textAlign = 'center'; ctx.fillStyle = t.suave; sombra(ctx, true);
    caber(ctx, op.loja || '', 900, 58, '{t}px ' + F_LETRA);
    ctx.fillText(op.loja || '', LARG / 2, y);

    // título: primeira palavra grande + resto em letra cursiva
    var partes = String(op.titulo || 'Cardápio do Dia').trim().split(/\s+/);
    var grande = partes.shift().toUpperCase(), resto = partes.join(' ');
    y += 240; // espaço para o acento (CARDÁPIO) não encostar no nome da loja
    ctx.fillStyle = t.titulo;
    caber(ctx, grande, 960, 210, '{t}px ' + F_TITULO);
    ctx.fillText(grande, LARG / 2, y);
    if (resto) {
      y += 105; ctx.fillStyle = t.destaque;
      caber(ctx, resto, 900, 112, '{t}px ' + F_LETRA);
      ctx.fillText(resto, LARG / 2 + 60, y);
    }
    // etiqueta do dia
    if (op.dia) {
      y += 60;
      ctx.font = '600 44px ' + F_ITEM;
      var wd = ctx.measureText(op.dia).width + 56;
      sombra(ctx, false); ctx.fillStyle = t.caixa; caixaRedonda(ctx, LARG / 2 - wd / 2, y, wd, 70, 14); ctx.fill();
      ctx.fillStyle = t.caixaTexto; ctx.fillText(op.dia, LARG / 2, y + 52);
      y += 70;
    }

    // blocos do cardápio em 2 colunas, com fonte ajustada ao espaço
    var temRodape = post.precos.length || op.whatsapp || op.link;
    var topoBlocos = y + 60, fimBlocos = temRodape ? 1440 : 1660;
    var cols = colunas(post.blocos);
    var linhas = Math.max.apply(null, cols.map(function (c) { return c.reduce(function (s, b) { return s + b.itens.length + 1.7; }, 0); }).concat([1]));
    var tam = Math.max(30, Math.min(58, Math.floor((fimBlocos - topoBlocos) / linhas / 1.18)));
    var larguraCol = cols[1].length ? 470 : 900;
    ctx.textAlign = 'left'; sombra(ctx, true);
    cols.forEach(function (col, ci) {
      var x = cols[1].length ? (ci === 0 ? 70 : 560) : 90, yy = topoBlocos;
      col.forEach(function (b) {
        ctx.fillStyle = t.destaque; ctx.font = '600 ' + Math.round(tam * 0.78) + 'px ' + F_ITEM;
        var tit = b.titulo.toUpperCase() + ':';
        ctx.fillText(tit, x, yy + tam * 0.8);
        var wt = ctx.measureText(tit).width;
        sombra(ctx, false); ctx.fillRect(x + wt + 12, yy + tam * 0.8 - tam * 0.22, Math.max(0, larguraCol - wt - 24), 3); sombra(ctx, true);
        yy += tam * 1.25;
        ctx.fillStyle = t.texto;
        b.itens.forEach(function (it) {
          var txt = it.toUpperCase();
          caber(ctx, txt, larguraCol - 10, tam, '500 {t}px ' + F_ITEM);
          ctx.fillText(txt, x + 6, yy + tam * 0.85); yy += tam * 1.12;
        });
        yy += tam * 0.45;
      });
    });

    // rodapé: preços + peça agora + propaganda do delivery
    if (temRodape) {
      var yR = 1470;
      sombra(ctx, true);
      if (post.precos.length) {
        var lin = Math.min(post.precos.length, 4), hP = 52 + lin * 62;
        ctx.fillStyle = t.caixa; caixaRedonda(ctx, 60, yR, 470, hP, 22); ctx.fill(); sombra(ctx, false);
        ctx.fillStyle = t.caixaTexto;
        post.precos.slice(0, 4).forEach(function (p, i) {
          var yl = yR + 26 + 48 + i * 62;
          ctx.textAlign = 'right'; ctx.font = '52px ' + F_TITULO; var wv = ctx.measureText(p.valor).width;
          ctx.fillText(p.valor, 500, yl);
          ctx.textAlign = 'left'; caber(ctx, p.nome.toUpperCase(), 470 - 80 - wv, 46, '600 {t}px ' + F_ITEM);
          ctx.fillText(p.nome.toUpperCase(), 90, yl);
        });
      }
      if (op.whatsapp) {
        var xw = post.precos.length ? 560 : 60, ww = post.precos.length ? 460 : 960;
        sombra(ctx, true); ctx.fillStyle = '#ffffff'; caixaRedonda(ctx, xw, yR, ww, 150, 22); ctx.fill(); sombra(ctx, false);
        ctx.textAlign = 'center'; ctx.fillStyle = '#1b1b1b'; ctx.font = '600 36px ' + F_ITEM;
        ctx.fillText('PEÇA AGORA:', xw + ww / 2, yR + 56);
        ctx.fillStyle = '#128c3e'; caber(ctx, telefoneVisivel(op.whatsapp), ww - 40, 58, '{t}px ' + F_TITULO);
        ctx.fillText(telefoneVisivel(op.whatsapp), xw + ww / 2, yR + 122);
      }
      // faixa de propaganda do delivery
      var yF = 1700;
      sombra(ctx, true); ctx.fillStyle = 'rgba(0,0,0,.55)'; caixaRedonda(ctx, 40, yF, 1000, op.link ? 150 : 96, 26); ctx.fill(); sombra(ctx, false);
      ctx.textAlign = 'center'; ctx.fillStyle = '#ffffff';
      caber(ctx, op.chamada || '', 940, 46, '600 {t}px ' + F_ITEM);
      ctx.fillText(op.chamada || '', LARG / 2, yF + 62);
      if (op.link) {
        var curto = String(op.link).replace(/^https?:\/\//, '').replace(/\/$/, '');
        ctx.fillStyle = t === TEMAS.laranja ? '#ffd9a8' : t.destaque;
        caber(ctx, curto, 940, 40, '500 {t}px ' + F_ITEM);
        ctx.fillText(curto, LARG / 2, yF + 120);
      }
    }
    sombra(ctx, false);
    return canvas;
  }

  function arquivo(canvas, nome) {
    return new Promise(function (ok, falha) {
      canvas.toBlob(function (b) { b ? ok(new File([b], nome, { type: 'image/png' })) : falha(new Error('Não foi possível gerar a imagem.')); }, 'image/png');
    });
  }

  // Abre o "compartilhar" do aparelho com a imagem + legenda. Sem suporte: devolve false (aí baixa a imagem).
  async function compartilhar(canvas, legenda, nome) {
    var f = await arquivo(canvas, nome);
    if (typeof navigator !== 'undefined' && navigator.canShare && navigator.canShare({ files: [f] })) {
      try { await navigator.share({ files: [f], text: legenda }); return 'ok'; }
      catch (e) { if (e && e.name === 'AbortError') return 'cancelado'; }
    }
    baixar(f);
    return 'baixado';
  }

  function baixar(f) {
    var url = URL.createObjectURL(f), a = document.createElement('a');
    a.href = url; a.download = f.name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }

  return { TEMAS: TEMAS, montar: montar, textoWhatsApp: textoWhatsApp, diaDaSemana: diaDaSemana, telefoneVisivel: telefoneVisivel,
    desenhar: desenhar, arquivo: arquivo, compartilhar: compartilhar, baixar: baixar };
});
