import { useEffect, useRef, useState } from 'react';
import DeckSlide from './DeckSlide.jsx';

export default function DeckPresentation({ slides, start, onClose }) {
  const [index, setIndex] = useState(start);
  const dialog = useRef(null);
  useEffect(() => {
    const element = dialog.current;
    element.showModal();
    return () => element.close();
  }, []);

  function navigate(event) {
    const target = { ArrowLeft: index - 1, ArrowRight: index + 1, Home: 0, End: slides.length - 1 }[event.key];
    if (!Number.isInteger(target)) return;
    event.preventDefault();
    setIndex(Math.min(slides.length - 1, Math.max(0, target)));
  }

  return (
    <dialog ref={dialog} className="deck-presentation" aria-label="Slide presentation"
      onCancel={(event) => { event.preventDefault(); onClose(); }} onKeyDown={navigate}>
      <DeckSlide slide={slides[index]} index={index} />
      <div className="deck-presentation-controls">
        <button type="button" disabled={index === 0} onClick={() => setIndex(index - 1)}>Previous slide</button>
        <span role="status">{index + 1} of {slides.length}</span>
        <button type="button" disabled={index + 1 === slides.length} onClick={() => setIndex(index + 1)}>Next slide</button>
        <button type="button" autoFocus onClick={onClose}>End presentation</button>
      </div>
    </dialog>
  );
}
