import { useMemo, useState } from 'react';
import { createSubmission } from '../api/client.js';

const categories = [
  {
    id: 'challenge',
    title: 'Challenge a harmful norm',
    color: '#3B82F6',
    gradient: 'linear-gradient(135deg, #3B82F6 0%, #60A5FA 100%)'
  },
  {
    id: 'promote',
    title: 'Promote a safe practice',
    color: '#A855F7',
    gradient: 'linear-gradient(135deg, #A855F7 0%, #D8B4FE 100%)'
  },
  {
    id: 'share',
    title: 'Share a positive message',
    color: '#22C55E',
    gradient: 'linear-gradient(135deg, #22C55E 0%, #4ADE80 100%)'
  }
];

const MAX_CHAR_COUNT = 80;

function SubmissionPage() {
  const [step, setStep] = useState('choose');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');

  const activeCategory = useMemo(
    () => categories.find((item) => item.id === selectedCategory),
    [selectedCategory]
  );

  const remainingCharacters = MAX_CHAR_COUNT - message.length;
  const isSubmitDisabled = !message.trim() || status === 'loading';

  const handleCategorySelection = (id) => {
    setSelectedCategory(id);
    setMessage('');
    setError('');
    setStep('form');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!activeCategory || isSubmitDisabled) return;

    try {
      setStatus('loading');
      setError('');
      await createSubmission({ category: activeCategory.id, message: message.trim() });
      setStatus('success');
      setMessage('');
      setStep('confirmation');
    } catch (submissionError) {
      setStatus('error');
      setError(submissionError.message || 'Unable to add your message right now.');
    } finally {
      setStatus((prev) => (prev === 'loading' ? 'idle' : prev));
    }
  };

  const handleRestart = () => {
    setStep('choose');
    setSelectedCategory(null);
    setMessage('');
    setError('');
    setStatus('idle');
  };

  return (
    <section className={`wall-stage submit-stage submit-stage--${step}`}>
      <div className="wall-backdrop" />
      <div className="wall-gradient-1" />
      <div className="wall-gradient-2" />

      <div className="submit-form-wrapper">
        <header className="submit-form-header">
          <img 
            src="https://storage.emojot.com/pictures/generalImages/67761761cb917201e680c031-skin13.png" 
            alt="Emojot Logo" 
            className="submit-form-header-logo"
          />
          <span className="submit-form-header-separator">|</span>
          <h1 className="submit-form-title">Through Her Eyes - Live Digital Mural</h1>
        </header>

        <div className="submit-form-content">
          {step === 'choose' && (
            <div className="submit-card submit-card--stack">
              <div className="submit-card__header">
                <p className="submit-eyebrow">I want to add my message to...</p>
              </div>
              <div className="submit-choice-list">
                {categories.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className={`submit-choice${selectedCategory === option.id ? ' is-active' : ''}`}
                    style={{
                      '--choice-color': option.color,
                      '--choice-gradient': option.gradient
                    }}
                    onClick={() => handleCategorySelection(option.id)}
                  >
                    <span className="submit-choice__glow" />
                    <span className="submit-choice__label">{option.title}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 'form' && activeCategory && (
            <form className="submit-card submit-card--form" onSubmit={handleSubmit}>
              <div className="form-toolbar">
                <button type="button" className="link-btn" onClick={() => setStep('choose')}>
                  ← Back
                </button>
                <div
                  className="category-chip"
                  style={{
                    '--chip-color': activeCategory.color,
                    '--chip-gradient': activeCategory.gradient
                  }}
                >
                  {activeCategory.title}
                </div>
              </div>
              <textarea
                value={message}
                rows={4}
                maxLength={MAX_CHAR_COUNT}
                placeholder="Type up to 80 characters"
                onChange={(event) => setMessage(event.target.value.slice(0, MAX_CHAR_COUNT))}
              />
              <div className="input-meta">
                <span>
                  {message.length}/{MAX_CHAR_COUNT}
                </span>
                {error && <span className="error-text">{error}</span>}
              </div>
              <button
                type="submit"
                disabled={isSubmitDisabled}
                className="primary-btn full-width"
                style={{ background: activeCategory.color }}
              >
                {status === 'loading' ? 'Adding...' : 'Add to Mosaic'}
              </button>
            </form>
          )}

          {step === 'confirmation' && (
            <div className="submit-card submit-card--confirmation">
              <div className="confirmation-icon">✓</div>
              <h2>Your message has been added.</h2>
              <p>Look at the wall to see it appear.</p>
              <button className="primary-btn full-width" onClick={handleRestart}>
                Add another message
              </button>
            </div>
          )}
        </div>

        <footer className="submit-form-footer">
          <span className="submit-form-footer-text">Powered By Emojot</span>
          <img 
            src="https://storage.emojot.com/pictures/generalImages/67761761cb917201e680c031-skin4.png" 
            alt="Emojot Logo" 
            className="submit-form-footer-logo"
          />
        </footer>
      </div>
    </section>
  );
}

export default SubmissionPage;
