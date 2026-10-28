// /api/geo — país de quem acessa (header x-vercel-ip-country, que a Vercel preenche pelo IP) + cotação do dólar
// para a moeda desse país. A página usa isso para mostrar os preços em moeda local, atrelados ao dólar.
// Teste: /api/geo?pais=MX simula um país. Se algo falhar, responde USD (a página continua em dólar).

// País → moeda. Países que usam o dólar (EC, SV, PA, PR, US) e os de câmbio muito instável (VE) ficam em USD.
const MOEDA = {
	MX: 'MXN', CO: 'COP', AR: 'ARS', CL: 'CLP', PE: 'PEN', UY: 'UYU', PY: 'PYG', BO: 'BOB',
	GT: 'GTQ', CR: 'CRC', DO: 'DOP', HN: 'HNL', NI: 'NIO', BR: 'BRL', ES: 'EUR', PT: 'EUR',
	CA: 'CAD', GB: 'GBP',
};
const UMA_HORA = 60 * 60 * 1000;
let cotacoes = {em: 0, taxas: null}; // cache por instância da função

const buscarTaxas = async () => {
	if (cotacoes.taxas && Date.now() - cotacoes.em < UMA_HORA) return cotacoes.taxas;
	const r = await fetch('https://open.er-api.com/v6/latest/USD');
	const j = await r.json();
	if (j && j.result === 'success' && j.rates) cotacoes = {em: Date.now(), taxas: j.rates};
	return cotacoes.taxas;
};

module.exports = async (req, res) => {
	const url = new URL(req.url, 'http://localhost');
	const teste = (url.searchParams.get('pais') || '').toUpperCase();
	const pais = /^[A-Z]{2}$/.test(teste) ? teste : String(req.headers['x-vercel-ip-country'] || 'US').toUpperCase();
	let moeda = MOEDA[pais] || 'USD';
	let taxa = 1;
	if (moeda !== 'USD') {
		try {
			const taxas = await buscarTaxas();
			taxa = taxas && taxas[moeda];
		} catch (e) {
			taxa = null;
		}
		if (!taxa) { moeda = 'USD'; taxa = 1; }
	}
	// A resposta depende do país de quem acessa: não pode ficar em cache compartilhado na CDN.
	res.setHeader('Cache-Control', 'private, no-store');
	res.setHeader('Content-Type', 'application/json; charset=utf-8');
	res.end(JSON.stringify({pais, moeda, taxa}));
};
