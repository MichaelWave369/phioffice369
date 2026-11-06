import { isSlideImage } from '../lib/deckSlides.js';

export default function DeckSlide({ slide, index }) {
  const bullets = slide.bullets.filter((bullet) => bullet.trim());
  return (
    <article className={`deck-canvas layout-${slide.layout ?? 'content'}`}>
      <div className="deck-canvas-copy">
        <p className="eyebrow">Slide {index + 1}</p>
        <h3>{slide.title || 'Untitled slide'}</h3>
        {bullets.length > 0 && <ul>{bullets.map((bullet, line) => <li key={line}>{bullet}</li>)}</ul>}
      </div>
      {isSlideImage(slide.image) && <img src={slide.image.src} alt={slide.image.alt} />}
      {slide.shape && slide.shape !== 'none' && <span className={`deck-shape shape-${slide.shape}`} aria-hidden="true" />}
    </article>
  );
}
