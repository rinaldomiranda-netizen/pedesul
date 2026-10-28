/* Mini Delivery Aterrisse — marcador de prazo (contagem regressiva) usado no painel, na cozinha e na tela do entregador.
   Atualiza sozinho a cada segundo, sem recarregar a página. */
(function () {
  'use strict';
  var N = window.AterrisseNucleo;
  var FINAIS = ['ENTREGUE', 'CONCLUIDO', 'CANCELADO'];
  var avisados = {}, aoAtrasar = null;

  function html(p) {
    if (!p || !p.prazo_em) return '';
    var ate = N.horaCurta(p.prazo_em);
    if (FINAIS.indexOf(p.status) >= 0) {
      if (p.status === 'CANCELADO') return '';
      if (p.no_prazo === true) return '<span class="prazo ok" title="Prazo era ' + ate + '">✔ no prazo</span>';
      if (p.no_prazo === false) return '<span class="prazo atrasado" title="Prazo era ' + ate + '">⚠ saiu atrasado</span>';
      return '';
    }
    var i = N.prazoInfo(p.prazo_em);
    if (i.atrasado) avisados[p.id] = true; // já estava atrasado ao abrir: não toca aviso de novo
    return '<span class="prazo ' + i.classe + '" data-prazo="' + N.escaparHtml(p.prazo_em) + '" data-id="' + N.escaparHtml(p.id) +
      '" data-numero="' + N.escaparHtml(p.numero) + '" title="Prazo: até ' + ate + '" aria-label="Prazo até ' + ate + '">⏱ ' + i.texto + '</span>';
  }

  setInterval(function () {
    var els = document.querySelectorAll('[data-prazo]');
    for (var k = 0; k < els.length; k++) {
      var el = els[k], i = N.prazoInfo(el.getAttribute('data-prazo'));
      el.textContent = '⏱ ' + i.texto;
      el.className = 'prazo ' + i.classe;
      var id = el.getAttribute('data-id');
      if (i.atrasado && id && !avisados[id]) {
        avisados[id] = true;
        if (aoAtrasar) aoAtrasar(id, el.getAttribute('data-numero'));
      }
    }
  }, 1000);

  window.AterrissePrazo = { html: html, aoAtrasar: function (f) { aoAtrasar = f; } };
})();
