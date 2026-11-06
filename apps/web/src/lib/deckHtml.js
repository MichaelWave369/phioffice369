import { isSlideImage } from './deckSlides.js';
import { escapePhiWriteHtml as escapeHtml } from './phiwritePrint.js';

export function buildDeckHtml({ title, slides, trustLabel }) {
  const pages = slides.map((slide, index) => {
    const layout = ['cover', 'image-left', 'image-right'].includes(slide.layout) ? slide.layout : 'content';
    const shape = ['circle', 'square', 'line'].includes(slide.shape) ? slide.shape : '';
    const bullets = slide.bullets.filter((bullet) => bullet.trim()).map((bullet) => `<li>${escapeHtml(bullet)}</li>`).join('');
    const media = isSlideImage(slide.image) ? `<img src="${slide.image.src}" alt="${escapeHtml(slide.image.alt)}">` : '';
    return `<section class="slide ${layout}"><div><p class="caption">Slide ${index + 1}</p><h2>${escapeHtml(slide.title)}</h2>${bullets ? `<ul>${bullets}</ul>` : ''}</div>${media}${shape ? `<span class="shape ${shape}" aria-hidden="true"></span>` : ''}</section>`;
  }).join('\n');
  return `<!doctype html>
<html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'">
<title>${escapeHtml(title)} | PhiDeck</title>
<style>
body{margin:0;background:#101827;color:#f3f5ef;font:clamp(16px,2vw,24px)/1.5 system-ui,sans-serif}
main{max-width:1100px;margin:auto;padding:2rem}
h1,h2{line-height:1.15;overflow-wrap:anywhere}
.slide{position:relative;box-sizing:border-box;display:grid;align-content:center;min-height:40vw;gap:1.5rem;padding:2rem;margin:1.5rem 0;background:#1b2a3b;border:1px solid #40566c;border-radius:1rem;overflow-wrap:anywhere}
.slide.cover{text-align:center;justify-items:center}.cover ul{text-align:left}
.slide.image-left,.slide.image-right{grid-template-columns:repeat(2,minmax(0,1fr));align-items:center}
.image-left img{grid-column:1;grid-row:1}.image-left div{grid-column:2}
img{max-width:100%;max-height:45vh;object-fit:contain}.caption{color:#f8cb74;font-size:.75em}
.shape{display:block;width:2rem;height:2rem;background:#77dfbd}.circle{border-radius:50%}.line{height:.35rem;width:4rem}
@media(max-width:600px){main{padding:1rem}.slide.image-left,.slide.image-right{display:block}}
@media print{body{background:white;color:#141821}main{max-width:none;padding:0}.slide{background:white;border:1px solid #555;break-inside:avoid;break-after:page}.slide:last-child{break-after:auto}.caption{color:#334155}}
</style><main><p>PHI369 Labs · PhiDeck · ${escapeHtml(trustLabel)}</p><h1>${escapeHtml(title)}</h1>${pages}</main></html>`;
}
