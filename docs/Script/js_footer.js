
import { getTechNews } from '../js_news.js';

/**
 * Render dynamic tech news cards for the footer carousel
 * @param {string} containerId - The id of the container to render news into
 */
export function renderFooterNews(containerId = 'footer-news-dynamic') {
	getTechNews().then(newsArr => {
		const container = document.getElementById(containerId);
		if (!container || !newsArr || !newsArr.length) return;
		// Show up to 4 news items
		container.innerHTML = newsArr.slice(0, 4).map((item, idx) => `
			<div class="col-md-3 col-sm-6">
				<a href="/docs/news.html?news=${idx}" class="tech-card text-decoration-none text-dark">
					<img src="${item.image || ''}" alt="${item.title}" class="img-fluid tech-img">
					<p class="tech-title">${item.title}</p>
					<p class="tech-desc small">${item.summary ? item.summary.substring(0, 80) + (item.summary.length > 80 ? '...' : '') : ''}</p>
				</a>
			</div>
		`).join('');
	});
}
