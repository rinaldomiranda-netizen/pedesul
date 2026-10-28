/* Página de vendas da RMD: planos, promoção de lançamento com contador de vagas e inscrição.
   Fala direto com o servidor (sempre o Supabase, mesmo se o site estiver em modo demonstração):
   rmd_delivery_vagas() = quantas vagas restam; rmd_delivery_inscrever() = marca a vaga pela ordem. */
(function () {
  'use strict';
  var N = window.AterrisseNucleo, R = window.RmdPlanos, cfg = window.ATERRISSE_CONFIG || {};
  var esc = N.escaparHtml;
  function $(s) { return document.querySelector(s); }
  var restam = null;

  async function rpc(nome, args) {
    var resp = await fetch(cfg.SUPABASE_URL + '/rest/v1/rpc/' + nome, {
      method: 'POST', headers: { apikey: cfg.SUPABASE_CHAVE_PUBLICA, 'Content-Type': 'application/json' }, body: JSON.stringify(args || {})
    });
    var j = await resp.json().catch(function () { return null; });
    if (!resp.ok) throw new Error((j && (j.hint || j.message)) || 'Não foi possível falar com o servidor.');
    return j;
  }

  function planoNome(id) { return R.PLANOS.filter(function (p) { return p.id === id; })[0].nome; }

  function desenharPromo() {
    var P = R.PROMOCAO, cheio = R.PLANOS.filter(function (p) { return p.id === P.plano; })[0];
    document.querySelectorAll('[data-promo]').forEach(function (e) {
      e.textContent = { vagas: P.vagas, cheio: N.reais(cheio.preco), preco: N.reais(P.preco), meses: P.mesesMetade, inicio: N.reais(P.precoInicio) }[e.dataset.promo];
    });
    var bol = '';
    for (var i = 0; i < P.vagas; i++) bol += '<span class="' + (restam !== null && i < P.vagas - restam ? 'usada' : '') + '"></span>';
    $('#bolinhas').innerHTML = bol;
    $('#texto-vagas').innerHTML = restam === null ? 'Consultando vagas…'
      : restam > 0 ? '<b>Restam ' + restam + ' de ' + P.vagas + ' vagas</b> com a promoção.'
      : '<b>As ' + P.vagas + ' vagas da promoção já foram preenchidas.</b> Ainda dá para contratar pelos preços normais.';
    $('#promo').classList.toggle('esgotada', restam === 0);
    $('#ajuda-plano').textContent = restam ? 'Com vaga na promoção, você leva o Completo pelo preço do Essencial, seja qual for o plano escolhido aqui.' : '';
  }

  function desenharPlanos() {
    var P = R.PROMOCAO;
    $('#planos').innerHTML = R.PLANOS.map(function (pl) {
      var promo = pl.id === P.plano && restam !== 0;
      return '<div class="caixa v-plano' + (promo ? ' v-plano-promo' : '') + '">' +
        (promo ? '<span class="selo-agora">PROMOÇÃO 5 PRIMEIROS</span>' : pl.destaque ? '<span class="selo-agora">MAIS INDICADO</span>' : '') +
        '<h3>' + esc(pl.nome) + '</h3><div class="v-para">' + esc(pl.para) + '</div>' +
        (promo ? '<div class="v-valor"><s>' + N.reais(pl.preco) + '</s> ' + N.reais(P.preco) + '<small>/mês</small></div><div class="v-para">' + N.reais(P.precoInicio) + '/mês nos ' + P.mesesMetade + ' primeiros meses</div>'
          : '<div class="v-valor">' + N.reais(pl.preco) + '<small>/mês</small></div><div class="v-para">ou ' + N.reais(pl.anual) + ' por ano</div>') +
        '<ul>' + pl.itens.map(function (i) { return '<li>' + esc(i) + '</li>'; }).join('') + '</ul>' +
        // plano Salão: a inscrição online ainda não tem esse plano; o contato é pelo WhatsApp da RMD
        (pl.interno ? '<a class="btn btn-linha btn-bloco" target="_blank" rel="noopener" href="' + esc(N.linkWhatsApp(R.WHATSAPP_RMD, 'Olá! Quero saber do plano ' + pl.nome + ' do Pede Sul (só a parte interna da loja).')) + '">Quero o plano ' + esc(pl.nome) + ' (WhatsApp)</a>' : '') + '</div>';
    }).join('');
    $('#nota-implantacao').innerHTML = '<b>Implantação (opcional, uma vez):</b> ' + N.reais(R.IMPLANTACAO) + ' — cadastro do cardápio, logo, QR Codes e treinamento da equipe. Sem comissão por pedido.';
    $('#i-plano').innerHTML = R.PLANOS.filter(function (pl) { return !pl.interno; }).map(function (pl) { return '<option value="' + pl.id + '"' + (pl.id === P.plano ? ' selected' : '') + '>' + esc(pl.nome) + ' (' + N.reais(pl.preco) + '/mês)</option>'; }).join('');
  }

  async function atualizarVagas() {
    try { restam = (await rpc('rmd_delivery_vagas')).restam; }
    catch (e) { restam = null; $('#texto-vagas').textContent = 'Não foi possível consultar as vagas agora. Chame no WhatsApp.'; return; }
    desenharPromo(); desenharPlanos();
  }

  function linkWhats(texto) { return N.linkWhatsApp(R.WHATSAPP_RMD, texto); }

  $('#form-inscricao').addEventListener('submit', async function (ev) {
    ev.preventDefault();
    var d = { p_restaurante: $('#i-restaurante').value.trim(), p_responsavel: $('#i-nome').value.trim(), p_whatsapp: $('#i-whats').value.trim(),
      p_cidade: $('#i-cidade').value.trim(), p_plano: $('#i-plano').value };
    var erro = d.p_restaurante.length < 2 ? 'Informe o nome do restaurante.' : d.p_responsavel.length < 2 ? 'Informe o seu nome.'
      : !/^(55)?\d{10,11}$/.test(d.p_whatsapp.replace(/\D/g, '')) ? 'Informe o WhatsApp com DDD.' : '';
    if (erro) { $('#msg-form').innerHTML = '<div class="erro-caixa">' + esc(erro) + '</div>'; return; }
    $('#msg-form').innerHTML = ''; $('#btn-inscrever').disabled = true; $('#btn-inscrever').textContent = 'Enviando…';
    try {
      var r = await rpc('rmd_delivery_inscrever', d);
      restam = r.restam; desenharPromo(); desenharPlanos();
      var P = R.PROMOCAO;
      var msg = 'Olá! Sou ' + d.p_responsavel + ', do ' + d.p_restaurante + (d.p_cidade ? ' (' + d.p_cidade + ')' : '') + '. Fiz a inscrição nº ' + r.numero +
        (r.promocao ? ' e garanti a promoção de lançamento do delivery.' : ' no delivery da RMD (plano ' + planoNome(d.p_plano) + ').');
      $('#resultado').innerHTML = (r.promocao
        ? '<h2>🎉 Vaga garantida!</h2><p>Você é o restaurante <b>nº ' + r.numero + '</b>. Fica com o plano <b>Completo</b> por <b>' + N.reais(P.preco) + '/mês</b>, e nos ' + P.mesesMetade + ' primeiros meses <b>' + N.reais(P.precoInicio) + '/mês</b>.</p>'
        : '<h2>Inscrição recebida</h2><p>Você é o restaurante <b>nº ' + r.numero + '</b>. As vagas da promoção já tinham acabado, mas a RMD vai falar com você sobre o plano ' + esc(planoNome(d.p_plano)) + '.</p>') +
        (r.repetida ? '<p class="v-nota">Este WhatsApp já estava inscrito; mostramos a inscrição que já existia.</p>' : '') +
        '<p>Para agilizar, mande uma mensagem para a RMD:</p><a class="btn btn-ouro btn-bloco" href="' + esc(linkWhats(msg)) + '" target="_blank" rel="noopener">Chamar a RMD no WhatsApp</a>';
      $('#form-inscricao').classList.add('oculto'); $('#resultado').classList.remove('oculto');
      $('#resultado').scrollIntoView({ block: 'start' });
    } catch (e) {
      $('#msg-form').innerHTML = '<div class="erro-caixa">' + esc(e.message) + '</div>';
    } finally { $('#btn-inscrever').disabled = false; $('#btn-inscrever').textContent = 'Garantir minha vaga'; }
  });

  $('#link-whats').href = linkWhats('Olá! Quero saber do delivery próprio da RMD para o meu restaurante.');
  desenharPromo(); desenharPlanos(); atualizarVagas();
  setInterval(atualizarVagas, 60000); // contador anda sozinho enquanto a página está aberta
})();
