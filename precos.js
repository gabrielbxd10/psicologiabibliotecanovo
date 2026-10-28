/* Preços na moeda de quem acessa, atrelados ao dólar.
 * Cada preço da página tem data-usd="valor em dólar". O /api/geo devolve o país (pelo IP), a moeda e a cotação do dia;
 * aqui cada valor é convertido e mostrado como "MXN 181". O dólar continua sendo a referência (aparece na nota).
 * Teste: abra a página com ?pais=MX (ou CO, AR, PE...). Se a API falhar ou o país usar dólar, nada muda. */
(function () {
	'use strict';
	var url = new URLSearchParams(location.search);
	var teste = url.get('pais');
	var api = '/api/geo' + (teste ? '?pais=' + encodeURIComponent(teste) : '');

	var formatar = function (valor, moeda) {
		// valores grandes (ex.: pesos colombianos) sem centavos; pequenos com 2 casas
		var casas = valor >= 100 ? 0 : 2;
		var numero = new Intl.NumberFormat('es', {minimumFractionDigits: casas, maximumFractionDigits: casas}).format(valor);
		return {moeda: moeda, numero: numero, texto: moeda + ' ' + numero};
	};

	var aplicar = function (geo) {
		if (!geo || !geo.moeda || geo.moeda === 'USD' || !(geo.taxa > 0)) return;
		document.querySelectorAll('[data-usd]').forEach(function (el) {
			var usd = parseFloat(el.getAttribute('data-usd'));
			if (!(usd > 0)) return;
			var v = formatar(usd * geo.taxa, geo.moeda);
			el.title = 'US$ ' + usd.toFixed(2).replace('.', ',');
			if (el.hasAttribute('data-grande')) el.innerHTML = '<small>' + v.moeda + '</small>' + v.numero;
			else el.textContent = v.texto;
		});
		var nota = document.querySelector('.conv');
		var front = document.querySelector('.price[data-usd]');
		if (nota && front) {
			nota.textContent = 'Valor aproximado en ' + geo.moeda + ', según el dólar de hoy (US$ ' +
				parseFloat(front.getAttribute('data-usd')).toFixed(2).replace('.', ',') +
				'). El monto final se confirma en el checkout.';
		}
	};

	var buscar = function () {
		fetch(api, {cache: 'no-store'}).then(function (r) { return r.ok ? r.json() : null; }).then(aplicar).catch(function () {});
	};
	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', buscar);
	else buscar();
})();
