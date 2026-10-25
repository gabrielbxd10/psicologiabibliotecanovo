/* Rastreamento da página de vendas (mesmos IDs da versão anterior do site).
 * - Guarda as UTMs/IDs de clique do anúncio por 7 dias e leva tudo para o checkout da Hotmart (com xcod/sck).
 * - UTMify: script de UTMs + pixel da conta.
 * - Meta Pixel: PageView, ViewContent, InitiateCheckout e eventos de engajamento (rolagem, tempo, seções, cliques).
 * Para desligar num teste local: abra a página com window.__NO_TRACK = true ou pelo arquivo (file://). */
(function () {
	'use strict';
	var PIXEL_META = '973045345819425';
	var PIXEL_UTMIFY = '6ac5b7d973e2bd007d1d6544';
	var PRODUTO = {id: 'E108015035W', nome: 'Biblioteca de Psicología Completa', preco: 14.9, moeda: 'USD'};
	var SEM_RASTREIO = !!window.__NO_TRACK || location.protocol === 'file:';

	var PARAMS = ['utm_source', 'utm_campaign', 'utm_medium', 'utm_content', 'utm_term', 'utm_id', 'src', 'sck', 'xcod', 'fbclid', 'gclid', 'gbraid', 'wbraid', 'ttclid', 'tbclid', 'click_id', 'CampaignID', 'adSETID', 'CreativeID', 'pixel_id', 'cid'];
	var CHAVE = 'biblioteca_attribution_v1';
	var SETE_DIAS = 7 * 24 * 60 * 60 * 1000;
	var agora = Date.now();

	// ---------- atribuição: UTMs da URL atual, ou as guardadas da última visita vinda de anúncio ----------
	var guardados = {};
	try {
		var salvo = JSON.parse(localStorage.getItem(CHAVE) || 'null');
		if (salvo && salvo.expires > agora) guardados = salvo.params || {};
	} catch (e) {}
	var url = new URLSearchParams(location.search);
	if (PARAMS.some(function (p) { return url.get(p); })) {
		guardados = {};
		PARAMS.forEach(function (p) { var v = url.get(p); if (v) guardados[p] = v; });
		try { localStorage.setItem(CHAVE, JSON.stringify({expires: agora + SETE_DIAS, params: guardados})); } catch (e) {}
	}

	var id = function (prefixo) { return prefixo + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8); };

	window.BibliotecaTracking = {
		// URL do checkout com UTMs + xcod/sck (formato da Hotmart/UTMify: partes unidas por "hQwK21wXxR")
		checkoutUrl: function (base) {
			var destino = new URL(base);
			var p = new URLSearchParams(guardados);
			PARAMS.forEach(function (k) { var v = url.get(k); if (v) p.set(k, v); });
			if (window.utmParams && typeof window.utmParams.forEach === 'function') {
				window.utmParams.forEach(function (v, k) { if (PARAMS.indexOf(k) > -1 && v) p.set(k, v); });
			}
			PARAMS.forEach(function (k) { var v = p.get(k); if (v) destino.searchParams.set(k, v); });
			if (!destino.searchParams.get('sck')) {
				var partes = ['utm_source', 'utm_campaign', 'utm_medium', 'utm_content', 'utm_term'].map(function (k) { return p.get(k) || ''; });
				if (partes.some(Boolean)) {
					var sck = partes.join('hQwK21wXxR').slice(0, 255);
					destino.searchParams.set('sck', sck);
					if (!destino.searchParams.get('xcod')) destino.searchParams.set('xcod', sck);
				}
			}
			return destino.toString();
		},
		initiateCheckout: function () {
			if (typeof window.fbq !== 'function') return;
			window.fbq('track', 'InitiateCheckout', {
				value: PRODUTO.preco, currency: PRODUTO.moeda, content_ids: [PRODUTO.id], content_type: 'product', num_items: 1,
				content_name: PRODUTO.nome, contents: [{id: PRODUTO.id, quantity: 1, item_price: PRODUTO.preco}]
			}, {eventID: id('ic')});
		}
	};

	if (SEM_RASTREIO) return;

	var addScript = function (src, attrs) {
		var s = document.createElement('script');
		s.src = src; s.async = true; s.defer = true;
		(attrs || []).forEach(function (a) { s.setAttribute(a[0], a[1]); });
		(document.head || document.documentElement).appendChild(s);
	};

	// ---------- UTMify ----------
	addScript('https://cdn.utmify.com.br/scripts/utms/latest.js', [['data-utmify-prevent-subids', '']]);
	window.pixelId = PIXEL_UTMIFY;
	addScript('https://cdn.utmify.com.br/scripts/pixel/pixel.js');

	// ---------- Meta Pixel ----------
	!function (f, b, e, v, n, t, s) {
		if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
		if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0'; n.queue = [];
		t = b.createElement(e); t.async = !0; t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
	}(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
	var conteudo = {content_ids: [PRODUTO.id], content_type: 'product', content_name: PRODUTO.nome, value: PRODUTO.preco, currency: PRODUTO.moeda};
	window.fbq('init', PIXEL_META);
	window.fbq('track', 'PageView', {}, {eventID: id('pv')});
	window.fbq('track', 'ViewContent', conteudo, {eventID: id('vc')});

	// ---------- eventos de engajamento (custom), cada um no máximo 1x quando "unico" ----------
	var enviados = {};
	var evento = function (nome, dados, unico) {
		if (unico) { if (enviados[nome]) return; enviados[nome] = 1; }
		try { window.fbq('trackCustom', nome, dados || {}); } catch (e) {}
	};
	window.trackCustom = evento;

	document.addEventListener('DOMContentLoaded', function () {
		// rolagem
		addEventListener('scroll', function () {
			var total = document.documentElement.scrollHeight - innerHeight;
			if (total <= 0) return;
			var pct = scrollY / total * 100;
			[25, 50, 75, 90].forEach(function (m) { if (pct >= m) evento('Scroll' + m, {percent: m}, true); });
		}, {passive: true});

		// tempo na página (só conta com a aba visível)
		var seg = 0;
		setInterval(function () {
			if (document.visibilityState !== 'visible') return;
			seg++;
			if ([15, 30, 60, 120, 180].indexOf(seg) > -1) evento('Tiempo' + seg + 's', {seconds: seg}, true);
		}, 1000);

		// seções vistas (seções desta página)
		var secoes = {'#dores': 'VerDolores', '#amostra': 'VerMuestras', '#modules': 'VerModulos', '#metodo': 'VerMetodo', '#bonos': 'VerBonos', '#testimonios': 'VerTestimonios', '#oferta': 'VerOferta', '#garantia': 'VerGarantia', '#faq': 'VerFAQ', '.final': 'VerCierre'};
		if ('IntersectionObserver' in window) {
			var obs = new IntersectionObserver(function (es) {
				es.forEach(function (e) { if (e.isIntersecting) { evento(e.target.__ev, conteudo, true); obs.unobserve(e.target); } });
			}, {threshold: 0, rootMargin: '-35% 0px -35% 0px'});
			Object.keys(secoes).forEach(function (sel) { var el = document.querySelector(sel); if (el) { el.__ev = secoes[sel]; obs.observe(el); } });
		}

		// cliques
		document.addEventListener('click', function (e) {
			var alvo = e.target;
			var botao = alvo.closest('a.btn');
			if (botao && (botao.getAttribute('href') || '').charAt(0) === '#') {
				var sec = botao.closest('section,header');
				evento('ClicBoton', {texto: botao.textContent.trim().slice(0, 60), destino: botao.getAttribute('href'), seccion: sec ? sec.id || sec.className : ''});
			}
			var pag = alvo.closest('.page');
			if (pag) evento('AmpliarMuestra', {muestra: (pag.querySelector('img') || {}).alt || ''});
			if (alvo.closest('.testi')) evento('AmpliarTestimonio', {});
			if (alvo.closest('.car-btn')) evento('UsarFlechasCarrusel', {}, true);
			var faq = alvo.closest('.faq summary');
			if (faq) evento('AbrirPregunta', {pregunta: faq.textContent.trim()});
		}, true);

		// deslizar carrosséis
		document.querySelectorAll('#trackA,#trackB,#track2').forEach(function (el) {
			var ja = false;
			el.addEventListener('scroll', function () {
				if (ja) return; ja = true;
				evento(el.id === 'track2' ? 'DeslizarTestimonios' : 'DeslizarMuestras', {});
			}, {passive: true});
		});
	});
})();
