/* Mini Delivery Aterrisse — bloco do Pix: QR Code + "Pix copia e cola" com o valor do pedido.
   A chave é a do restaurante (Painel → Loja → Pix). O site NÃO confirma pagamento sozinho:
   quem confere o recebimento é a equipe ou o entregador ("Recebi o pagamento"). */
(function () {
  'use strict';
  var N = window.AterrisseNucleo;
  var esc = N.escaparHtml;

  function codigo(loja, valor, numero) {
    if (!loja || !loja.pix_chave) return null;
    return N.pixCopiaECola({ chave: loja.pix_chave, nome: loja.pix_nome || loja.nome, cidade: loja.pix_cidade || 'BRASIL', valor: valor, txid: 'PEDIDO' + (numero || '') });
  }

  function svgQr(texto) {
    if (!window.qrcode) return '';
    var qr = window.qrcode(0, 'M');
    qr.addData(texto);
    qr.make();
    return qr.createSvgTag({ cellSize: 5, margin: 2, scalable: true });
  }

  // HTML do bloco. Vazio se a loja não tem chave Pix configurada.
  function bloco(loja, valor, numero, texto) {
    var c = codigo(loja, valor, numero);
    if (!c) return '';
    var vitrine = window.ATERRISSE_CONFIG && window.ATERRISSE_CONFIG.VITRINE;
    return '<div class="pix-bloco"><div class="pix-titulo">Pagar com Pix · ' + N.reais(valor) + '</div>' +
      (vitrine ? '<p class="pix-texto" style="color:#b3261e;font-weight:800">DEMONSTRAÇÃO — não pague: este QR é só para mostrar como funciona.</p>' : '') +
      (texto ? '<p class="pix-texto">' + esc(texto) + '</p>' : '') +
      '<div class="pix-qr" role="img" aria-label="QR Code do Pix de ' + N.reais(valor) + '">' + svgQr(c) + '</div>' +
      '<div class="pix-recebedor">' + esc(loja.pix_nome || loja.nome) + '</div>' +
      '<label class="pix-rotulo" for="pix-codigo-' + esc(numero) + '">Pix copia e cola</label>' +
      '<textarea class="pix-codigo" id="pix-codigo-' + esc(numero) + '" readonly rows="3">' + esc(c) + '</textarea>' +
      '<button class="btn btn-ouro btn-bloco" type="button" data-pix-copiar="pix-codigo-' + esc(numero) + '">📋 Copiar código Pix</button></div>';
  }

  document.addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-pix-copiar]');
    if (!b) return;
    var campo = document.getElementById(b.getAttribute('data-pix-copiar'));
    var ok = function () { b.textContent = '✔ Código copiado — cole no app do banco'; setTimeout(function () { b.textContent = '📋 Copiar código Pix'; }, 3000); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(campo.value).then(ok, function () { campo.select(); document.execCommand('copy'); ok(); });
    else { campo.select(); document.execCommand('copy'); ok(); }
  });

  window.AterrissePix = { bloco: bloco, codigo: codigo };
})();
