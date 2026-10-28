/* Pede Sul — cardápio público de uma loja, sacola e finalização (copiado do Aterrisse).
   Do CONIS veio a busca do endereço pelo CEP. A sacola e o último pedido ficam separados por loja. */
(function () {
  'use strict';
  var N = window.AterrisseNucleo;
  var api = window.AterrisseBackend.criar(window.ATERRISSE_CONFIG);
  var esc = N.escaparHtml;
  var params = new URLSearchParams(location.search);
  var LOJA = (window.ATERRISSE_CONFIG && window.ATERRISSE_CONFIG.LOJA) || 'aterrisse';
  var K_SACOLA = 'pedesul_sacola_' + LOJA, K_FORM = 'pedesul_form_' + LOJA, K_ULTIMO = 'pedesul_ultimo_' + LOJA, K_CLIENTE = 'pedesul_cliente';

  // ?simular_hora=19:30 mostra o cardápio como se fosse esse horário em Maceió (para conferir os destaques).
  var horaSimulada = /^\d{2}:\d{2}$/.test(params.get('simular_hora') || '') ? params.get('simular_hora') : null;
  var mesaDoQr = (params.get('mesa') || '').slice(0, 20).trim();

  var estado = {
    cardapio: null, erroCarga: null, destaque: null, busca: '',
    sacola: lerLocal(K_SACOLA) || [],
    etapa: 'sacola', form: lerSessao(K_FORM) || clienteLembrado(), enviando: false, ultimoEnvio: null,
    ultimo: lerLocal(K_ULTIMO), timerStatus: null
  };
  if (mesaDoQr) { estado.form.modalidade = 'local'; estado.form.mesa = mesaDoQr; }

  // Dados do cliente guardados SÓ neste aparelho (nome, telefone, endereço) para não digitar tudo de novo.
  // Não ficam num cadastro buscável pelo telefone: assim ninguém descobre o endereço de outra pessoa.
  function clienteLembrado() {
    var c = lerLocal(K_CLIENTE);
    if (!c) return {};
    return { nome: c.nome || '', telefone: c.telefone || '', endereco: c.endereco || null, modalidade: c.modalidade || undefined, pagamento: c.pagamento || undefined, lembrar: true, lembrado: true };
  }
  function guardarCliente(f) {
    if (f.lembrar === false) { gravarLocal(K_CLIENTE, null); return; }
    var anterior = lerLocal(K_CLIENTE) || {};
    gravarLocal(K_CLIENTE, { nome: f.nome, telefone: f.telefone, modalidade: f.modalidade, pagamento: f.pagamento,
      endereco: f.modalidade === 'entrega' && f.endereco ? f.endereco : (anterior.endereco || null) });
  }

  function lerLocal(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
  function gravarLocal(k, v) { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* sem armazenamento */ } }
  function lerSessao(k) { try { return JSON.parse(sessionStorage.getItem(k)); } catch (e) { return null; } }
  function gravarSessao(k, v) { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* sem armazenamento */ } }
  function $(s) { return document.querySelector(s); }

  function agora() {
    if (!horaSimulada) return new Date();
    // Maceió fica em UTC−3 o ano todo (sem horário de verão).
    return new Date(N.diaNoFuso(new Date()) + 'T' + horaSimulada + ':00-03:00');
  }

  function toast(msg) {
    var t = document.createElement('div');
    t.className = 'aviso-toast'; t.setAttribute('role', 'status'); t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 2600);
  }

  // ------------------------------------------------------------ carregar

  async function carregar(silencioso) {
    try {
      var c = await api.cardapio();
      if (!c || !c.loja) throw new Error('A loja ainda não foi configurada.');
      estado.cardapio = c; estado.erroCarga = null;
      limparSacolaInvalida();
    } catch (e) {
      if (!silencioso || !estado.cardapio) { estado.erroCarga = e.message || 'Falha de comunicação.'; }
    }
    estado.destaque = estado.cardapio ? N.destaqueAtual(estado.cardapio.destaques, agora()) : null;
    renderTudo();
  }

  function limparSacolaInvalida() {
    var antes = estado.sacola.length;
    estado.sacola = estado.sacola.filter(function (i) { return N.acharProduto(estado.cardapio, i.produto_id); });
    if (estado.sacola.length !== antes) { salvarSacola(); toast('Um item saiu do cardápio e foi retirado da sacola.'); }
  }

  // ------------------------------------------------------------ render geral

  function renderTudo() {
    renderFaixas(); renderTopo(); renderDestaque(); renderCardapio(); renderBarraSacola();
    if ($('#janela-raiz').dataset.aberta === 'sacola') renderSacola();
  }

  function renderFaixas() {
    var h = '';
    if (api.modo === 'demo' && !(window.ATERRISSE_CONFIG && window.ATERRISSE_CONFIG.VITRINE)) h += '<div class="faixa faixa-demo" role="note">⚠️ MODO DEMONSTRAÇÃO — os pedidos ficam só neste aparelho e NÃO chegam ao restaurante.</div>';
    if (horaSimulada) h += '<div class="faixa faixa-aviso">🕒 Hora simulada: ' + esc(horaSimulada) + ' (Maceió). Tire “?simular_hora” do endereço para voltar ao normal.</div>';
    var l = estado.cardapio && estado.cardapio.loja;
    // na demonstração (vitrine) fica só a barra "DEMONSTRAÇÃO" do topo, sem faixas repetidas
    if (api.modo !== 'demo' && !api.vitrine && l && l.modo === 'demo' && l.liberada !== false) h += '<div class="faixa faixa-demo" role="note">🧪 Versão de demonstração — os pedidos chegam ao painel marcados como TESTE. Preços com “Exemplo” são fictícios.</div>';
    if (l && l.liberada === false) h += '<div class="faixa faixa-fechado" role="alert">Cardápio temporariamente indisponível.</div>';
    if (l && !l.aberto) h += '<div class="faixa faixa-fechado" role="alert">O restaurante não está recebendo pedidos agora. Você pode ver o cardápio.</div>';
    if (l && l.aviso && !api.vitrine) h += '<div class="faixa faixa-aviso">' + esc(l.aviso) + '</div>';
    $('#faixas').innerHTML = h;
  }

  function renderTopo() {
    var l = (estado.cardapio && estado.cardapio.loja) || {};
    var nome = l.nome || 'Loja';
    if (l.cor && /^#[0-9a-fA-F]{6}$/.test(l.cor)) document.documentElement.style.setProperty('--ouro', l.cor);
    var volta = $('#voltar-vitrine'); if (volta) volta.classList.toggle('oculto', !l.na_vitrine);
    $('#nome-loja').textContent = nome; $('#rodape-nome').textContent = nome;
    document.title = nome + ' | Cardápio e pedidos';
    $('#status-loja').textContent = estado.cardapio ? (l.aberto ? 'Aberto para pedidos' : 'Fechado no momento') : 'Cardápio online';
    var selo = $('#marca-selo');
    if (l.logo_url && /^(https:\/\/|assets\/|data:image\/(png|jpeg|webp);base64,)/.test(l.logo_url)) selo.innerHTML = '<img src="' + esc(l.logo_url) + '" alt="">';
    else selo.textContent = String(nome).charAt(0).toUpperCase();
    var zap = N.linkWhatsApp(l.whatsapp || N.WHATSAPP_PADRAO, 'Olá! Vim pelo cardápio online do ' + nome + '.');
    $('#btn-zap-topo').href = zap;
    var mods = [];
    if (l.aceita_entrega !== false) mods.push('🛵 Entrega' + (Number(l.taxa_entrega) > 0 ? ' (taxa ' + N.reais(l.taxa_entrega) + ')' : ''));
    if (l.aceita_retirada !== false) mods.push('🏪 Retirada no balcão');
    if (l.aceita_local !== false) mods.push('🍽️ Consumo na loja');
    $('#info-modalidades').textContent = mods.join(' · ');
    $('#rodape-horario').textContent = l.horario_funcionamento || '';
    $('#link-ultimo').classList.toggle('oculto', !estado.ultimo);
    var qtd = estado.sacola.reduce(function (s, i) { return s + i.quantidade; }, 0);
    $('#contador-sacola').textContent = qtd;
  }

  var ICONES_PERIODO = { almoco: '🍛', lanches: '🍔', jantar: '🌽' };

  function renderDestaque() {
    var el = $('#faixa-destaque');
    if (estado.erroCarga && !estado.cardapio) { el.innerHTML = '<span class="icone-grande">⚠️</span><div><strong>Não foi possível carregar</strong><p>Verifique a internet.</p></div>'; return; }
    if (!estado.cardapio) return;
    var d = estado.destaque;
    if (!d) {
      el.innerHTML = '<span class="icone-grande" aria-hidden="true">🍽️</span><div><strong>Cardápio completo</strong><p>Sem destaque neste horário. Todas as categorias abaixo.</p></div>';
      return;
    }
    var nomes = (d.categorias || []).map(function (slug) {
      var c = estado.cardapio.categorias.filter(function (x) { return x.slug === slug; })[0];
      return c ? c.nome : null;
    }).filter(Boolean);
    el.innerHTML = '<span class="icone-grande" aria-hidden="true">' + (ICONES_PERIODO[d.periodo] || '⭐') + '</span>' +
      '<div><strong>Destaque do momento: ' + esc(d.titulo) + '</strong><p>' + esc(d.inicio) + ' às ' + esc(d.fim) +
      (nomes.length ? ' · ' + esc(nomes.join(', ')) : '') + '. As outras categorias continuam abaixo.</p></div>';
  }

  function categoriasOrdenadas() {
    var cats = estado.cardapio.categorias.slice();
    var dest = (estado.destaque && estado.destaque.categorias) || [];
    return cats.sort(function (a, b) {
      var da = dest.indexOf(a.slug), db = dest.indexOf(b.slug);
      if ((da >= 0) !== (db >= 0)) return da >= 0 ? -1 : 1;
      if (da >= 0) return da - db;
      return a.ordem - b.ordem;
    });
  }

  function normalizar(t) { return String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }

  function renderCardapio() {
    var alvo = $('#conteudo');
    if (!estado.cardapio) {
      if (estado.erroCarga) {
        alvo.innerHTML = '<div class="estado erro" role="alert" style="margin-top:20px"><p><b>Falha de comunicação.</b> ' + esc(estado.erroCarga) +
          '</p><button class="btn btn-ouro" type="button" data-acao="recarregar">Tentar de novo</button></div>';
        $('#chips').innerHTML = '';
      }
      return;
    }
    var cats = categoriasOrdenadas();
    var dest = (estado.destaque && estado.destaque.categorias) || [];
    var termo = normalizar(estado.busca.trim());
    $('#chips').innerHTML = cats.map(function (c) {
      var agoraCat = dest.indexOf(c.slug) >= 0;
      return '<a class="chip' + (agoraCat ? ' agora' : '') + '" href="#cat-' + esc(c.slug) + '">' + (agoraCat ? '<span class="ponto-agora" aria-hidden="true"></span>' : '') +
        esc((c.icone ? c.icone + ' ' : '') + c.nome) + (agoraCat ? '<span class="sr"> (destaque agora)</span>' : '') + '</a>';
    }).join('');

    if (estado.cardapio.loja.liberada === false) {
      alvo.innerHTML = '<div class="vazio" style="margin-top:20px"><b>Cardápio temporariamente indisponível.</b><br>Fale com o restaurante pelo WhatsApp.</div>';
      return;
    }
    if (!estado.cardapio.produtos.length) {
      alvo.innerHTML = '<div class="vazio" style="margin-top:20px">O cardápio está vazio no momento. Fale com o restaurante pelo WhatsApp.</div>';
      return;
    }
    var html = '', achou = 0;
    cats.forEach(function (c) {
      var prods = estado.cardapio.produtos.filter(function (p) { return p.categoria_id === c.id; });
      if (termo) prods = prods.filter(function (p) { return normalizar(p.nome + ' ' + (p.descricao || '')).indexOf(termo) >= 0; });
      if (!prods.length && termo) return;
      achou += prods.length;
      var agoraCat = dest.indexOf(c.slug) >= 0;
      html += '<section class="secao' + (agoraCat ? ' em-destaque' : '') + '" id="cat-' + esc(c.slug) + '" aria-labelledby="t-' + esc(c.slug) + '">' +
        '<div class="secao-cab"><h2 id="t-' + esc(c.slug) + '">' + esc((c.icone ? c.icone + ' ' : '') + c.nome) + '</h2>' +
        (agoraCat ? '<span class="selo-agora">DESTAQUE AGORA</span>' : '') +
        (c.descricao ? '<p>' + esc(c.descricao) + '</p>' : '') + '</div>';
      html += prods.length ? '<div class="grade">' + prods.map(cartaoProduto).join('') + '</div>' : '<div class="vazio">Nenhum item nesta categoria agora.</div>';
      html += '</section>';
    });
    if (termo && !achou) html = '<div class="vazio" style="margin-top:20px">Nada encontrado para “' + esc(estado.busca) + '”. <button class="btn btn-linha btn-peq" type="button" data-acao="limpar-busca">Limpar busca</button></div>';
    alvo.innerHTML = html;
  }

  function fotoProduto(p) {
    var img = p.imagem_url && /^(https?:\/\/|assets\/)/.test(p.imagem_url)
      ? '<img src="' + esc(p.imagem_url) + '" alt="" loading="lazy">' + (p.imagem_ilustrativa ? '<span class="ilustr">imagem ilustrativa</span>' : '')
      : '<span aria-hidden="true">' + esc(p.icone || '🍽️') + '</span>';
    return '<div class="produto-foto">' + img + '</div>';
  }

  function cartaoProduto(p) {
    var esgotado = p.disponivel === false;
    var lojaFechada = !estado.cardapio.loja.aberto;
    var tags = '';
    if (p.demonstracao) tags += '<span class="etiqueta etiqueta-demo" title="Produto e preço de exemplo, ainda não confirmados pelo restaurante">Exemplo · preço a confirmar</span>';
    if (esgotado) tags += '<span class="etiqueta etiqueta-esgotado">Esgotado</span>';
    var a_partir = (p.grupos || []).some(function (g) { return g.opcoes.some(function (o) { return Number(o.preco) > 0; }); });
    return '<article class="produto' + (esgotado ? ' esgotado' : '') + '">' + fotoProduto(p) +
      '<div class="produto-corpo"><div>' + tags + '</div><h3>' + esc(p.nome) + '</h3><p>' + esc(p.descricao || '') + '</p>' +
      '<div class="produto-rodape"><span class="preco">' + (a_partir ? '<small style="font-size:12px;color:var(--texto-2)">a partir de </small>' : '') + N.reais(p.preco) + '</span>' +
      '<button class="btn-add" type="button" data-acao="abrir-produto" data-id="' + esc(p.id) + '"' + (esgotado || lojaFechada ? ' disabled' : '') +
      ' aria-label="' + (esgotado ? 'Esgotado: ' : 'Adicionar ') + esc(p.nome) + '">' + (esgotado ? 'Esgotado' : lojaFechada ? 'Fechado' : '+ Adicionar') + '</button></div></div></article>';
  }

  function renderBarraSacola() {
    var t = estado.cardapio ? N.totaisSacola(estado.sacola, estado.cardapio, null) : { itens: 0, subtotal: 0 };
    $('#barra-sacola').classList.toggle('oculto', !t.itens || $('#janela-raiz').dataset.aberta);
    $('#barra-qtd').textContent = t.itens;
    $('#barra-total').textContent = N.reais(t.subtotal);
  }

  function salvarSacola() { gravarLocal(K_SACOLA, estado.sacola); renderTopo(); renderBarraSacola(); }

  // ------------------------------------------------------------ janelas

  var focoAntes = null;
  function abrirJanela(tipo, html) {
    var raiz = $('#janela-raiz');
    if (!raiz.dataset.aberta) focoAntes = document.activeElement;
    raiz.dataset.aberta = tipo;
    raiz.innerHTML = '<div class="fundo" data-acao="fundo"><div class="janela" role="dialog" aria-modal="true" aria-labelledby="janela-titulo">' + html + '</div></div>';
    document.body.style.overflow = 'hidden';
    renderBarraSacola();
    var f = raiz.querySelector('[autofocus]') || raiz.querySelector('.fechar');
    if (f) f.focus();
  }
  function fecharJanela() {
    var raiz = $('#janela-raiz');
    raiz.innerHTML = ''; delete raiz.dataset.aberta;
    document.body.style.overflow = '';
    if (estado.timerStatus) { clearInterval(estado.timerStatus); estado.timerStatus = null; }
    renderBarraSacola();
    if (focoAntes && focoAntes.focus) focoAntes.focus();
  }

  // ------------------------------------------------------------ produto (adicionais, retirar, observação)

  var escolha = null;

  function abrirProduto(id, chaveEditando) {
    var p = N.acharProduto(estado.cardapio, id);
    if (!p) return;
    var item = chaveEditando ? estado.sacola.filter(function (i) { return i.chave === chaveEditando; })[0] : null;
    escolha = {
      produto: p, editando: chaveEditando || null,
      quantidade: item ? item.quantidade : 1,
      adicionais: item ? item.adicionais.slice() : [],
      removidos: item ? item.removidos.slice() : [],
      observacao: item ? item.observacao || '' : ''
    };
    abrirJanela('produto', htmlProduto());
  }

  function htmlProduto() {
    var p = escolha.produto;
    var h = '<div class="janela-cab"><div><h2 id="janela-titulo">' + esc(p.nome) + '</h2><div style="color:var(--texto-2);font-size:14px">' + esc(p.descricao || '') + '</div>' +
      (p.demonstracao ? '<span class="etiqueta etiqueta-demo" style="margin-top:6px">Exemplo · preço a confirmar</span>' : '') +
      '</div><button class="fechar" type="button" data-acao="fechar" aria-label="Fechar">×</button></div>';
    (p.grupos || []).forEach(function (g) {
      var tipo = g.maximo === 1 ? 'radio' : 'checkbox';
      var marcados = g.opcoes.filter(function (o) { return escolha.adicionais.indexOf(o.id) >= 0; }).length;
      var regra = g.minimo === 0 ? (g.maximo === 1 ? 'Opcional · até 1' : 'Opcional · até ' + g.maximo) : (g.minimo === g.maximo ? 'Obrigatório · escolha ' + g.minimo : 'Obrigatório · de ' + g.minimo + ' a ' + g.maximo);
      h += '<fieldset class="grupo-adic" style="border:0;padding:0"><legend><h3>' + esc(g.nome) + '</h3></legend><div class="regra">' + regra + ' · as opções podem variar no dia</div><div class="opcoes-radio">';
      if (tipo === 'radio' && g.minimo === 0) {
        h += '<label class="opcao"><input type="radio" name="g-' + esc(g.id) + '" data-acao="opcao" data-grupo="' + esc(g.id) + '" value=""' + (marcados ? '' : ' checked') + '> Sem ' + esc(g.nome.toLowerCase()) + '</label>';
      }
      g.opcoes.forEach(function (o) {
        var marcado = escolha.adicionais.indexOf(o.id) >= 0;
        var bloqueado = o.disponivel === false || (tipo === 'checkbox' && !marcado && marcados >= g.maximo);
        h += '<label class="opcao' + (bloqueado ? ' desativada' : '') + '"><input type="' + tipo + '" name="g-' + esc(g.id) + '" data-acao="opcao" data-grupo="' + esc(g.id) + '" value="' + esc(o.id) + '"' +
          (marcado ? ' checked' : '') + (bloqueado ? ' disabled' : '') + '> ' + esc(o.nome) + (o.disponivel === false ? ' (acabou)' : '') +
          (Number(o.preco) > 0 ? '<span class="preco-opcao">+ ' + N.reais(o.preco) + '</span>' : '') + '</label>';
      });
      h += '</div></fieldset>';
    });
    if ((p.ingredientes_removiveis || []).length) {
      h += '<fieldset class="grupo-adic" style="border:0;padding:0"><legend><h3>Retirar ingredientes</h3></legend><div class="opcoes-radio">';
      p.ingredientes_removiveis.forEach(function (r) {
        h += '<label class="opcao"><input type="checkbox" data-acao="remover" value="' + esc(r) + '"' + (escolha.removidos.indexOf(r) >= 0 ? ' checked' : '') + '> Sem ' + esc(r.toLowerCase()) + '</label>';
      });
      h += '</div></fieldset>';
    }
    if (p.permite_observacao !== false) {
      h += '<div class="campo"><label for="obs-item">Observação do item (opcional)</label><textarea id="obs-item" maxlength="200" placeholder="Ex.: carne bem passada, molho à parte">' + esc(escolha.observacao) + '</textarea><span class="ajuda">Até 200 caracteres.</span></div>';
    }
    h += '<div class="erros-lista" id="erros-produto" role="alert"></div>';
    h += '<div class="rodape-janela"><div class="qtd" aria-label="Quantidade"><button type="button" data-acao="qtd-produto" data-delta="-1" aria-label="Diminuir">−</button><span id="qtd-produto">' + escolha.quantidade +
      '</span><button type="button" data-acao="qtd-produto" data-delta="1" aria-label="Aumentar">+</button></div>' +
      '<button class="btn btn-ouro" type="button" data-acao="confirmar-produto" id="btn-confirmar-produto">' + textoBotaoProduto() + '</button></div>';
    return h;
  }

  function textoBotaoProduto() {
    var total = N.precoUnitario(escolha.produto, escolha.adicionais) * escolha.quantidade;
    return (escolha.editando ? 'Salvar · ' : 'Adicionar · ') + N.reais(total);
  }

  function atualizarProduto() {
    var obs = $('#obs-item'); if (obs) escolha.observacao = obs.value;
    var rolagem = document.querySelector('.janela').scrollTop;
    abrirJanela('produto', htmlProduto());
    document.querySelector('.janela').scrollTop = rolagem;
  }

  function confirmarProduto() {
    var obs = $('#obs-item'); if (obs) escolha.observacao = obs.value;
    var item = { produto_id: escolha.produto.id, quantidade: escolha.quantidade, adicionais: escolha.adicionais.slice(), removidos: escolha.removidos.slice(), observacao: escolha.observacao.trim() };
    var erros = N.validarEscolha(escolha.produto, item);
    if (erros.length) { $('#erros-produto').innerHTML = erros.map(esc).join('<br>'); return; }
    item.chave = N.chaveItem(item);
    if (escolha.editando) estado.sacola = estado.sacola.filter(function (i) { return i.chave !== escolha.editando; });
    var igual = estado.sacola.filter(function (i) { return i.chave === item.chave; })[0];
    if (igual) igual.quantidade = Math.min(50, igual.quantidade + item.quantidade); else estado.sacola.push(item);
    salvarSacola();
    var editando = escolha.editando;
    escolha = null;
    if (editando) { estado.etapa = 'sacola'; abrirSacola(); } else { fecharJanela(); toast('Adicionado à sacola ✓'); }
  }

  // ------------------------------------------------------------ sacola e checkout

  function abrirSacola() { abrirJanela('sacola', ''); renderSacola(); }

  function descricaoItem(p, i) {
    var partes = N.opcoesEscolhidas(p, i.adicionais).map(function (o) { return o.nome + (o.preco ? ' (+' + N.reais(o.preco) + ')' : ''); });
    var t = partes.join(', ');
    if (i.removidos && i.removidos.length) t += (t ? ' · ' : '') + 'sem ' + i.removidos.join(', ').toLowerCase();
    if (i.observacao) t += (t ? ' · ' : '') + 'obs.: ' + i.observacao;
    return t;
  }

  function passos() {
    var ordem = ['sacola', 'dados', 'revisar'];
    var k = ordem.indexOf(estado.etapa);
    return estado.etapa === 'enviado' ? '' : '<div class="passos" aria-hidden="true">' + ordem.map(function (_, i) { return '<span class="' + (i <= k ? 'ativo' : '') + '"></span>'; }).join('') + '</div>';
  }

  function renderSacola() {
    var janela = document.querySelector('#janela-raiz .janela');
    if (!janela) return;
    var h = '';
    if (estado.etapa === 'sacola') h = htmlSacola();
    else if (estado.etapa === 'dados') h = htmlDados();
    else if (estado.etapa === 'revisar') h = htmlRevisar();
    else h = htmlEnviado();
    janela.innerHTML = passos() + h;
    var f = janela.querySelector('[autofocus]'); if (f) f.focus();
  }

  function cabecalho(titulo, voltar) {
    return '<div class="janela-cab">' + (voltar ? '<button class="btn btn-linha btn-peq" type="button" data-acao="etapa" data-etapa="' + voltar + '">← Voltar</button>' : '') +
      '<h2 id="janela-titulo" style="flex:1">' + titulo + '</h2><button class="fechar" type="button" data-acao="fechar" aria-label="Fechar">×</button></div>';
  }

  function htmlTotais(modalidade) {
    var t = N.totaisSacola(estado.sacola, estado.cardapio, modalidade);
    var taxaTxt = modalidade === 'entrega' ? N.reais(t.taxa_entrega) : (modalidade ? 'sem taxa' : 'calculada se for entrega');
    return '<div class="totais"><div><span>Subtotal</span><span>' + N.reais(t.subtotal) + '</span></div>' +
      '<div><span>Taxa de entrega</span><span>' + taxaTxt + '</span></div>' +
      '<div class="total"><span>Total estimado</span><span>' + N.reais(t.total) + '</span></div></div>';
  }

  function htmlSacola() {
    var h = cabecalho('Sua sacola');
    if (!estado.sacola.length) return h + '<div class="vazio">Sua sacola está vazia.<br><br><button class="btn btn-ouro" type="button" data-acao="fechar">Ver cardápio</button></div>';
    var t = N.totaisSacola(estado.sacola, estado.cardapio, estado.form.modalidade);
    estado.sacola.forEach(function (i) {
      var p = N.acharProduto(estado.cardapio, i.produto_id);
      var prob = t.problemas.filter(function (x) { return x.chave === i.chave; })[0];
      var unit = N.precoUnitario(p, i.adicionais);
      h += '<div class="item-sacola"><div><b>' + esc(p.nome) + '</b>' + (p.demonstracao ? ' <span class="etiqueta etiqueta-demo">Exemplo</span>' : '') +
        '<div class="det">' + esc(descricaoItem(p, i)) + '</div>' + (prob ? '<div class="det" style="color:var(--erro);font-weight:700">' + esc(prob.erros[0]) + '</div>' : '') + '</div>' +
        '<div style="text-align:right;font-weight:800">' + N.reais(unit * i.quantidade) + '<div class="det">' + N.reais(unit) + ' cada</div></div>' +
        '<div class="acoes-item"><div class="qtd"><button type="button" data-acao="qtd-item" data-chave="' + esc(i.chave) + '" data-delta="-1" aria-label="Diminuir ' + esc(p.nome) + '">−</button><span>' + i.quantidade +
        '</span><button type="button" data-acao="qtd-item" data-chave="' + esc(i.chave) + '" data-delta="1" aria-label="Aumentar ' + esc(p.nome) + '">+</button></div>' +
        '<button class="btn btn-linha btn-peq" type="button" data-acao="editar-item" data-chave="' + esc(i.chave) + '">Editar</button>' +
        '<button class="btn btn-perigo btn-peq" type="button" data-acao="remover-item" data-chave="' + esc(i.chave) + '">Remover</button></div></div>';
    });
    h += htmlTotais(estado.form.modalidade);
    var bloqueio = t.problemas.length ? 'Resolva os itens marcados em vermelho.' : (!estado.cardapio.loja.aberto ? 'O restaurante não está recebendo pedidos agora.' : '');
    if (bloqueio) h += '<div class="erros-lista">' + esc(bloqueio) + '</div>';
    h += '<div class="rodape-janela"><button class="btn btn-linha" type="button" data-acao="fechar">Continuar comprando</button>' +
      '<button class="btn btn-ouro" type="button" data-acao="etapa" data-etapa="dados"' + (bloqueio ? ' disabled' : '') + '>Finalizar pedido</button></div>';
    return h;
  }

  function campo(id, rotulo, valor, extra, erro, ajuda) {
    return '<div class="campo' + (erro ? ' invalido' : '') + '"><label for="f-' + id + '">' + rotulo + '</label>' +
      '<input id="f-' + id + '" name="' + id + '" value="' + esc(valor || '') + '" ' + (extra || '') + (erro ? ' aria-invalid="true" aria-describedby="e-' + id + '"' : '') + '>' +
      (ajuda ? '<span class="ajuda">' + ajuda + '</span>' : '') + (erro ? '<span class="msg-erro" id="e-' + id + '">' + esc(erro) + '</span>' : '') + '</div>';
  }

  function htmlDados() {
    var l = estado.cardapio.loja, f = estado.form, e = estado.errosForm || {};
    var mods = [['entrega', '🛵 Entrega em casa', l.aceita_entrega], ['retirada', '🏪 Retirada no balcão', l.aceita_retirada], ['local', '🍽️ Consumo na loja', l.aceita_local]];
    if (!f.modalidade || !mods.some(function (m) { return m[0] === f.modalidade && m[2]; })) f.modalidade = (mods.filter(function (m) { return m[2]; })[0] || [null])[0];
    var h = cabecalho('Seus dados', 'sacola') + '<form id="form-pedido" novalidate>';
    h += campo('nome', 'Nome *', f.nome, 'autocomplete="name" maxlength="80" autofocus', e.nome);
    var telObrig = f.modalidade !== 'local';
    h += campo('telefone', 'Telefone / WhatsApp' + (telObrig ? ' *' : ' (opcional)'), f.telefone, 'type="tel" inputmode="tel" autocomplete="tel" maxlength="20" placeholder="(79) 9 0000-0000"', e.telefone);
    h += '<fieldset class="campo" style="border:0;padding:0"><legend class="rotulo" style="margin-bottom:6px">Como você quer receber? *</legend><div class="opcoes-radio">';
    mods.forEach(function (m) {
      var extra = '';
      if (m[0] === 'entrega' && Number(l.taxa_entrega) > 0) extra = 'taxa ' + N.reais(l.taxa_entrega);
      if (m[0] === 'entrega' && l.previsao_entrega_min) extra += (extra ? ' · ' : '') + 'cerca de ' + l.previsao_entrega_min + ' min';
      if (m[0] === 'retirada' && l.previsao_retirada_min) extra = 'pronto em cerca de ' + l.previsao_retirada_min + ' min';
      if (m[0] === 'local' && l.previsao_local_min) extra = 'pronto em cerca de ' + l.previsao_local_min + ' min';
      h += '<label class="opcao' + (m[2] ? '' : ' desativada') + '"><input type="radio" name="modalidade" value="' + m[0] + '"' + (f.modalidade === m[0] ? ' checked' : '') + (m[2] ? '' : ' disabled') +
        ' data-acao="modalidade"> ' + m[1] + (m[2] ? '' : ' (indisponível)') + (extra ? '<span class="preco-opcao">' + esc(extra) + '</span>' : '') + '</label>';
    });
    h += '</div>' + (e.modalidade ? '<span class="msg-erro">' + esc(e.modalidade) + '</span>' : '') + '</fieldset>';
    if (f.modalidade === 'entrega') {
      var en = f.endereco || {};
      h += '<div class="linha-cep">' + campo('cep', 'CEP (opcional)', en.cep, 'inputmode="numeric" maxlength="9" autocomplete="postal-code" placeholder="49000-000"', e.cep, 'Digite o CEP para preencher a rua e o bairro.') +
        '<button class="btn btn-linha btn-peq" type="button" data-acao="buscar-cep">Buscar CEP</button></div><div id="cep-msg" class="ajuda" aria-live="polite"></div>';
      h += '<div class="linha-3">' + campo('rua', 'Rua *', en.rua, 'autocomplete="address-line1" maxlength="120"', e.rua) +
        campo('numero', 'Número *', en.numero, 'maxlength="20" inputmode="numeric"', e.numero) + '</div>';
      h += campo('bairro', 'Bairro *', en.bairro, 'maxlength="60"', e.bairro);
      h += campo('complemento', 'Complemento (opcional)', en.complemento, 'maxlength="120" placeholder="Apto, bloco, casa…"');
      h += campo('referencia', 'Ponto de referência (opcional)', en.referencia, 'maxlength="120"');
    }
    if (f.modalidade === 'local' && l.mesa_modo !== 'desligado') {
      h += campo('mesa', 'Mesa ou código do atendimento' + (l.mesa_modo === 'obrigatoria' ? ' *' : ' (opcional)'), f.mesa, 'maxlength="20"', e.mesa, mesaDoQr ? 'Preenchido pelo QR Code da mesa.' : '');
    }
    var pags = l.pagamentos || [];
    h += '<div class="campo' + (e.pagamento ? ' invalido' : '') + '"><label for="f-pagamento">Forma de pagamento *</label><select id="f-pagamento" name="pagamento" data-acao="pagamento"><option value="">Escolha…</option>' +
      pags.map(function (p) { return '<option value="' + esc(p.id) + '"' + (f.pagamento === p.id ? ' selected' : '') + '>' + esc(p.nome) + '</option>'; }).join('') +
      '</select><span class="ajuda">O pagamento é feito direto com o restaurante (nada é cobrado por este site).</span>' + (e.pagamento ? '<span class="msg-erro">' + esc(e.pagamento) + '</span>' : '') + '</div>';
    if (f.pagamento === 'dinheiro') h += campo('troco', 'Troco para quanto? (opcional)', f.troco, 'inputmode="decimal" maxlength="10" placeholder="Ex.: 50"', e.troco);
    h += '<label class="chk" style="margin-bottom:6px"><input type="checkbox" name="lembrar"' + (f.lembrar === false ? '' : ' checked') + '> Lembrar meus dados neste aparelho</label>' +
      (f.lembrado ? '<div style="font-size:13px;color:var(--texto-2);margin-bottom:12px">Usamos os dados do seu último pedido neste aparelho. <button class="btn btn-linha btn-peq" type="button" data-acao="esquecer-dados">Esquecer meus dados</button></div>' : '');
    h += '<div class="campo' + (e.observacoes ? ' invalido' : '') + '"><label for="f-observacoes">Observações gerais (opcional)</label><textarea id="f-observacoes" name="observacoes" maxlength="500">' + esc(f.observacoes || '') + '</textarea>' +
      (e.observacoes ? '<span class="msg-erro">' + esc(e.observacoes) + '</span>' : '') + '</div>';
    h += htmlTotais(f.modalidade);
    h += '<div class="rodape-janela"><button class="btn btn-ouro" type="submit">Revisar pedido</button></div></form>';
    return h;
  }

  function lerFormulario() {
    var form = $('#form-pedido');
    if (!form) return;
    var f = estado.form;
    var val = function (n) { var el = form.elements[n]; return el ? el.value : undefined; };
    ['nome', 'telefone', 'mesa', 'pagamento', 'troco', 'observacoes'].forEach(function (k) { var v = val(k); if (v !== undefined) f[k] = v; });
    var m = form.querySelector('input[name="modalidade"]:checked'); if (m) f.modalidade = m.value;
    if (form.elements.lembrar) f.lembrar = form.elements.lembrar.checked;
    if (form.elements.rua) f.endereco = { cep: val('cep'), rua: val('rua'), numero: val('numero'), bairro: val('bairro'), complemento: val('complemento'), referencia: val('referencia') };
    gravarSessao(K_FORM, f);
  }

  function validarFormulario() {
    var f = estado.form, l = estado.cardapio.loja;
    var e = N.validarCheckout(f, l);
    var t = N.totaisSacola(estado.sacola, estado.cardapio, f.modalidade);
    if (f.pagamento === 'dinheiro') { var et = N.validarTroco(f.troco, t.total); if (et) e.troco = et; }
    if (t.subtotal < Number(l.pedido_minimo || 0)) e.pagamento = 'Pedido mínimo de ' + N.reais(l.pedido_minimo) + '.';
    estado.errosForm = e;
    return Object.keys(e).length === 0;
  }

  function htmlRevisar() {
    var f = estado.form, l = estado.cardapio.loja;
    var pag = (l.pagamentos || []).filter(function (p) { return p.id === f.pagamento; })[0];
    var h = cabecalho('Confira antes de enviar', 'dados');
    h += '<div class="resumo-bloco"><h3>Itens</h3>' + estado.sacola.map(function (i) {
      var p = N.acharProduto(estado.cardapio, i.produto_id); var d = descricaoItem(p, i);
      return '<div style="margin-bottom:6px">' + i.quantidade + '× <b>' + esc(p.nome) + '</b> — ' + N.reais(N.precoUnitario(p, i.adicionais) * i.quantidade) + (d ? '<div style="color:var(--texto-2);font-size:13px">' + esc(d) + '</div>' : '') + '</div>';
    }).join('') + '</div>';
    h += '<div class="resumo-bloco"><h3>' + esc(N.MODALIDADE_NOMES[f.modalidade]) + '</h3><div>' + esc(f.nome) + (f.telefone ? ' · ' + esc(f.telefone) : '') + '</div>';
    if (f.modalidade === 'entrega') { var en = f.endereco; h += '<div>' + esc(en.rua + ', ' + en.numero + ' — ' + en.bairro) + (en.complemento ? ' · ' + esc(en.complemento) : '') + (en.referencia ? '<br>Ref.: ' + esc(en.referencia) : '') + '</div>'; }
    if (f.modalidade === 'local' && f.mesa) h += '<div>Mesa/código: ' + esc(f.mesa) + '</div>';
    h += '<div>Pagamento: ' + esc(pag ? pag.nome : f.pagamento) + (f.pagamento === 'dinheiro' && f.troco ? ' · troco para ' + esc(N.reais(Number(String(f.troco).replace(',', '.')))) : '') + '</div>';
    if (f.observacoes) h += '<div>Obs.: ' + esc(f.observacoes) + '</div>';
    h += '</div>' + htmlTotais(f.modalidade);
    if (api.modo === 'demo') h += '<div class="erros-lista" style="background:#3b2a06;color:var(--aviso)">Modo demonstração: o pedido fica só neste aparelho e não chega ao restaurante.</div>';
    else if (estado.cardapio.loja.modo === 'demo') h += '<div class="erros-lista" style="background:#3b2a06;color:var(--aviso)">Versão de demonstração: o pedido chega ao painel do restaurante marcado como TESTE.</div>';
    h += '<p style="font-size:12px;color:var(--texto-2)">O valor final é conferido pelo restaurante no momento do envio.</p>';
    h += '<div class="erros-lista" id="erro-envio" role="alert">' + esc(estado.erroEnvio || '') + '</div>';
    h += '<div class="rodape-janela"><button class="btn btn-ouro" type="button" data-acao="enviar"' + (estado.enviando ? ' disabled' : '') + ' autofocus>' + (estado.enviando ? 'Enviando…' : 'Enviar pedido') + '</button></div>';
    return h;
  }

  async function enviar() {
    if (estado.enviando) return;
    var f = estado.form;
    estado.enviando = true; estado.erroEnvio = ''; renderSacola();
    var dados = {
      nome: f.nome.trim(), telefone: N.soDigitos(f.telefone), modalidade: f.modalidade, pagamento: f.pagamento,
      observacoes: (f.observacoes || '').trim(),
      mesa: f.modalidade === 'local' ? (f.mesa || '').trim() : '',
      endereco: f.modalidade === 'entrega' ? f.endereco : null,
      troco_para: f.pagamento === 'dinheiro' && f.troco ? Number(String(f.troco).replace(/\./g, '').replace(',', '.')) : null,
      chave_envio: f.chave_envio, // o mesmo envio repetido (clique duplo, internet voltando) vira um pedido só
      itens: estado.sacola.map(function (i) { return { produto_id: i.produto_id, quantidade: i.quantidade, adicionais: i.adicionais, removidos: i.removidos, observacao: i.observacao }; })
    };
    try {
      var r = await api.criarPedido(dados);
      estado.ultimoEnvio = { numero: r.numero, acompanhamento: r.acompanhamento, total: r.total, modalidade: f.modalidade, itens: r.itens, status: r.status, criado_em: r.criado_em, demo: api.modo === 'demo', teste: !!r.teste, prazo_em: r.prazo_em || null, pagamento: f.pagamento };
      estado.ultimo = { numero: r.numero, acompanhamento: r.acompanhamento, criado_em: r.criado_em, demo: api.modo === 'demo' };
      gravarLocal(K_ULTIMO, estado.ultimo);
      estado.sacola = []; salvarSacola();
      guardarCliente(estado.form);
      estado.form.observacoes = ''; estado.form.chave_envio = null; estado.form.lembrado = estado.form.lembrar !== false; gravarSessao(K_FORM, estado.form);
      estado.etapa = 'enviado';
      iniciarAcompanhamento();
    } catch (e) {
      estado.erroEnvio = e.message || 'Falha de comunicação. Tente de novo.';
      if (/ESGOTADO|INEXISTENTE|ADICIONAL/.test(e.codigo || '')) carregar(true);
    }
    estado.enviando = false;
    renderSacola(); renderTopo();
  }

  function htmlEnviado() {
    var p = estado.ultimoEnvio;
    if (!p) return cabecalho('Pedido') + '<div class="vazio">Nenhum pedido recente.</div>';
    var l = estado.cardapio.loja;
    var h = cabecalho(p.demo ? 'Pedido de demonstração' : 'Pedido enviado!');
    h += '<div class="sucesso"><div>Número do pedido</div><div class="numero">#' + esc(p.numero) + '</div>';
    h += p.demo ? '<p style="color:var(--aviso)"><b>Modo demonstração:</b> este pedido ficou só neste aparelho. Ele NÃO foi enviado ao restaurante.</p>'
      : p.teste ? '<p>O pedido chegou ao painel do restaurante como <b>pedido de TESTE</b> (versão de demonstração). Guarde o número.</p>'
      : '<p>O restaurante recebeu o seu pedido. Guarde o número.</p>';
    var ordem = p.modalidade === 'entrega' ? ['RECEBIDO', 'ACEITO', 'EM_PREPARACAO', 'PRONTO', 'SAIU_PARA_ENTREGA', 'ENTREGUE'] : ['RECEBIDO', 'ACEITO', 'EM_PREPARACAO', 'PRONTO', 'CONCLUIDO'];
    if (p.status === 'CANCELADO') h += '<p class="erros-lista">Este pedido foi cancelado. Fale com o restaurante pelo WhatsApp.</p>';
    else {
      var k = ordem.indexOf(p.status);
      h += '<ul class="linha-tempo" aria-label="Andamento do pedido">' + ordem.map(function (s, i) { return '<li class="' + (i <= k ? 'feito' : '') + '">' + N.STATUS_NOMES[s] + (i === k ? ' ← agora' : '') + '</li>'; }).join('') + '</ul>';
    }
    if (p.status === 'SAIU_PARA_ENTREGA' && p.entregador) h += '<p class="resumo-bloco">🛵 Seu pedido saiu com <b>' + esc(p.entregador) + '</b>.</p>';
    if (p.prazo_em && ['ENTREGUE', 'CONCLUIDO', 'CANCELADO'].indexOf(p.status) < 0) {
      h += '<p class="resumo-bloco">⏱ Previsão: ' + (p.modalidade === 'entrega' ? 'chega até ' : p.modalidade === 'retirada' ? 'pronto para retirar até ' : 'pronto até ') +
        '<b>' + esc(N.horaCurta(p.prazo_em)) + '</b></p>';
    }
    h += '<p><b>Total: ' + N.reais(p.total) + '</b></p>';
    if (p.pagamento === 'pix' && !p.demo && ['CANCELADO', 'ENTREGUE', 'CONCLUIDO'].indexOf(p.status) < 0 && window.AterrissePix) {
      h += window.AterrissePix.bloco(l, p.total, p.numero, 'Pague agora pelo app do seu banco (QR Code ou copia e cola) ou, se preferir, na ' +
        (p.modalidade === 'entrega' ? 'entrega, com o entregador' : 'hora de retirar/consumir') + '. O restaurante confere o recebimento.');
    }
    if (p.itens && p.itens.length) {
      var texto = N.textoResumoPedido(p, l);
      h += '<a class="btn btn-zap btn-bloco" href="' + esc(N.linkWhatsApp(l.whatsapp, texto)) + '" target="_blank" rel="noopener">Enviar resumo pelo WhatsApp (opcional)</a>';
    } else {
      h += '<a class="btn btn-zap btn-bloco" href="' + esc(N.linkWhatsApp(l.whatsapp, 'Olá! Sobre o meu pedido nº ' + p.numero + '.')) + '" target="_blank" rel="noopener">Falar com o restaurante no WhatsApp</a>';
    }
    h += '<p style="font-size:12px;color:var(--texto-2);margin-top:10px">O andamento atualiza sozinho enquanto esta janela estiver aberta.</p></div>';
    h += '<div class="rodape-janela"><button class="btn btn-linha" type="button" data-acao="fechar">Fechar</button></div>';
    return h;
  }

  async function atualizarStatus() {
    var u = estado.ultimo;
    if (!u) return;
    try {
      var r = await api.acompanhar(u.numero, u.acompanhamento);
      if (!r) return;
      estado.ultimoEnvio = estado.ultimoEnvio && estado.ultimoEnvio.numero === r.numero ? Object.assign(estado.ultimoEnvio, { status: r.status, modalidade: r.modalidade || estado.ultimoEnvio.modalidade, total: r.total !== undefined ? r.total : estado.ultimoEnvio.total, prazo_em: r.prazo_em || estado.ultimoEnvio.prazo_em, entregador: r.entregador || null })
        : { numero: r.numero, acompanhamento: u.acompanhamento, total: r.total, modalidade: r.modalidade, status: r.status, demo: u.demo, prazo_em: r.prazo_em || null, entregador: r.entregador || null };
      if ($('#janela-raiz').dataset.aberta === 'sacola' && estado.etapa === 'enviado') renderSacola();
    } catch (e) { /* tenta de novo no próximo ciclo */ }
  }

  function iniciarAcompanhamento() {
    if (estado.timerStatus) clearInterval(estado.timerStatus);
    estado.timerStatus = setInterval(atualizarStatus, 15000);
  }

  // ------------------------------------------------------------ CEP (do CONIS): consulta pública dos Correios via ViaCEP
  async function buscarCep() {
    var campoCep = $('#f-cep'), msg = $('#cep-msg');
    var cep = N.soDigitos(campoCep && campoCep.value);
    if (cep.length !== 8) { msg.textContent = 'O CEP tem 8 números.'; return; }
    msg.textContent = 'Procurando o CEP…';
    try {
      var r = await fetch('https://viacep.com.br/ws/' + cep + '/json/');
      var j = await r.json();
      if (!r.ok || j.erro) { msg.textContent = 'CEP não encontrado. Preencha a rua e o bairro.'; return; }
      if (j.logradouro) $('#f-rua').value = j.logradouro;
      if (j.bairro) $('#f-bairro').value = j.bairro;
      msg.textContent = 'Endereço encontrado: ' + [j.logradouro, j.bairro, j.localidade + '/' + j.uf].filter(Boolean).join(' · ') + '. Agora o número.';
      lerFormulario();
      var num = $('#f-numero'); if (num) num.focus();
    } catch (e) { msg.textContent = 'Sem conexão para buscar o CEP. Preencha a rua e o bairro.'; }
  }

  // ------------------------------------------------------------ eventos

  document.addEventListener('click', function (ev) {
    var alvo = ev.target.closest('[data-acao]');
    if (!alvo) return;
    var acao = alvo.dataset.acao;
    if (acao === 'fundo') { if (ev.target === alvo) fecharJanela(); return; }
    if (acao === 'opcao' || acao === 'remover' || acao === 'modalidade' || acao === 'pagamento') return; // tratados no "change"
    if (acao === 'abrir-sacola') { estado.etapa = estado.etapa === 'enviado' ? 'sacola' : estado.etapa; if (estado.etapa === 'revisar') estado.etapa = 'dados'; abrirSacola(); }
    else if (acao === 'fechar') { if (estado.etapa === 'enviado') estado.etapa = 'sacola'; fecharJanela(); }
    else if (acao === 'recarregar') { estado.erroCarga = null; $('#conteudo').innerHTML = '<div class="grade" style="margin-top:20px"><div class="esqueleto"></div><div class="esqueleto"></div></div>'; carregar(); }
    else if (acao === 'limpar-busca') { estado.busca = ''; $('#busca').value = ''; renderCardapio(); }
    else if (acao === 'abrir-produto') abrirProduto(alvo.dataset.id);
    else if (acao === 'qtd-produto') { escolha.quantidade = Math.max(1, Math.min(50, escolha.quantidade + Number(alvo.dataset.delta))); $('#qtd-produto').textContent = escolha.quantidade; $('#btn-confirmar-produto').textContent = textoBotaoProduto(); }
    else if (acao === 'confirmar-produto') confirmarProduto();
    else if (acao === 'qtd-item' || acao === 'remover-item') {
      var it = estado.sacola.filter(function (i) { return i.chave === alvo.dataset.chave; })[0];
      if (!it) return;
      if (acao === 'remover-item') estado.sacola = estado.sacola.filter(function (i) { return i !== it; });
      else { it.quantidade += Number(alvo.dataset.delta); if (it.quantidade < 1) estado.sacola = estado.sacola.filter(function (i) { return i !== it; }); it.quantidade = Math.min(50, it.quantidade); }
      salvarSacola(); renderSacola();
    }
    else if (acao === 'editar-item') { var i2 = estado.sacola.filter(function (i) { return i.chave === alvo.dataset.chave; })[0]; if (i2) abrirProduto(i2.produto_id, i2.chave); }
    else if (acao === 'etapa') { lerFormulario(); estado.etapa = alvo.dataset.etapa; estado.errosForm = null; renderSacola(); }
    else if (acao === 'enviar') enviar();
    else if (acao === 'buscar-cep') buscarCep();
    else if (acao === 'esquecer-dados') {
      gravarLocal(K_CLIENTE, null);
      estado.form = { modalidade: estado.form.modalidade, lembrar: false }; gravarSessao(K_FORM, estado.form);
      toast('Seus dados foram apagados deste aparelho.'); renderSacola();
    }
    else if (acao === 'ver-ultimo') {
      estado.etapa = 'enviado';
      if (!estado.ultimoEnvio || estado.ultimoEnvio.numero !== (estado.ultimo && estado.ultimo.numero)) estado.ultimoEnvio = { numero: estado.ultimo.numero, acompanhamento: estado.ultimo.acompanhamento, status: 'RECEBIDO', total: 0, demo: estado.ultimo.demo };
      abrirSacola(); atualizarStatus(); iniciarAcompanhamento();
    }
  });

  document.addEventListener('change', function (ev) {
    var el = ev.target;
    var acao = el.dataset && el.dataset.acao;
    if (acao === 'opcao' && escolha) {
      var g = escolha.produto.grupos.filter(function (x) { return x.id === el.dataset.grupo; })[0];
      var idsGrupo = g.opcoes.map(function (o) { return o.id; });
      if (el.type === 'radio') escolha.adicionais = escolha.adicionais.filter(function (id) { return idsGrupo.indexOf(id) < 0; }).concat(el.value ? [el.value] : []);
      else if (el.checked) escolha.adicionais.push(el.value);
      else escolha.adicionais = escolha.adicionais.filter(function (id) { return id !== el.value; });
      atualizarProduto();
    } else if (acao === 'remover' && escolha) {
      if (el.checked) escolha.removidos.push(el.value); else escolha.removidos = escolha.removidos.filter(function (r) { return r !== el.value; });
    } else if (acao === 'modalidade' || acao === 'pagamento') {
      lerFormulario(); estado.errosForm = null;
      var rolagem = document.querySelector('.janela').scrollTop;
      renderSacola();
      document.querySelector('.janela').scrollTop = rolagem;
    }
  });

  document.addEventListener('submit', function (ev) {
    if (ev.target.id !== 'form-pedido') return;
    ev.preventDefault();
    lerFormulario();
    if (validarFormulario()) {
      estado.etapa = 'revisar'; estado.erroEnvio = '';
      if (!estado.form.chave_envio) { estado.form.chave_envio = 'e' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10); gravarSessao(K_FORM, estado.form); }
    }
    renderSacola();
    var primeiroErro = document.querySelector('.campo.invalido input, .campo.invalido select, .campo.invalido textarea');
    if (primeiroErro) primeiroErro.focus();
  });

  document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape' && $('#janela-raiz').dataset.aberta) fecharJanela(); });

  var tBusca = null;
  $('#busca').addEventListener('input', function (ev) {
    clearTimeout(tBusca);
    tBusca = setTimeout(function () { estado.busca = ev.target.value; renderCardapio(); }, 150);
  });

  // O destaque muda sozinho (sem recarregar a página).
  setInterval(function () {
    if (!estado.cardapio) return;
    var d = N.destaqueAtual(estado.cardapio.destaques, agora());
    if ((d && d.periodo) !== (estado.destaque && estado.destaque.periodo)) { estado.destaque = d; renderDestaque(); renderCardapio(); }
  }, 30000);
  // Disponibilidade (esgotado, loja fechada) atualizada a cada 3 minutos.
  setInterval(function () { carregar(true); }, 180000);

  window.AterrissePublico = { estado: estado, agora: agora }; // para conferência nos testes
  carregar();
})();
