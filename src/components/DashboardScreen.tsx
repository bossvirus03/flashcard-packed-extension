import React, { useState, useEffect } from 'react';

interface DashboardScreenProps {
  user: any;
  onLogout: () => void;
}

interface Flashcard {
  id: string;
  front: string;
  back: string;
  repetitions: number;
  easeFactor: number;
}

interface FlashcardStats {
  dueToday: number;
  learned: number;
  toLearn: number;
  total: number;
}

async function getAuthToken(): Promise<string> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get('authToken', (data) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message || 'Failed to get auth token'));
        return;
      }

      const token = data.authToken as string | undefined;

      if (!token) {
        reject(new Error('Missing auth token'));
        return;
      }

      resolve(token);
    });
  });
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({
  user,
  onLogout,
}) => {
  const [activeTab, setActiveTab] = useState('review');
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [stats, setStats] = useState<FlashcardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAnswer, setShowAnswer] = useState(false);
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewMessage, setReviewMessage] = useState('');

  useEffect(() => {
    void loadData();
  }, []);

  const loadData = async (mode: 'due' | 'all' = 'due') => {
    setLoading(true);
    setShowAnswer(false);
    setReviewMessage('');

    try {
      const token = await getAuthToken();

      const cardsUrl =
        mode === 'all'
          ? 'https://flashcard-extension.onrender.com/flashcards'
          : 'https://flashcard-extension.onrender.com/flashcards/due?limit=20';

      const cardsResponse = await fetch(
        cardsUrl,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      const cards = (await cardsResponse.json()) as Flashcard[];
      setFlashcards(cards);

      if (mode === 'all' && cards.length > 0) {
        setReviewMessage(`Loaded ${cards.length} cards for relearning.`);
      }

      // Fetch stats
      const statsResponse = await fetch(
        'https://flashcard-extension.onrender.com/flashcards/stats',
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      const statsData = await statsResponse.json();
      setStats(statsData);
    } catch (error) {
      console.error('Failed to load data:', error);
      setReviewMessage('Failed to load due cards. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const submitReview = async (quality: number) => {
    const currentCard = flashcards[0];

    if (!currentCard) {
      return;
    }

    setSubmittingReview(true);
    setReviewMessage('');

    try {
      const token = await getAuthToken();

      const response = await fetch('https://flashcard-extension.onrender.com/reviews', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          flashcardId: currentCard.id,
          quality,
        }),
      });

      if (!response.ok) {
        throw new Error(`Review failed (${response.status})`);
      }

      setFlashcards((prev) => prev.slice(1));
      setShowAnswer(false);
      setReviewMessage('Saved review. Great job!');

      setStats((prev) => {
        if (!prev) {
          return prev;
        }

        return {
          ...prev,
          dueToday: Math.max(0, prev.dueToday - 1),
        };
      });
    } catch (error) {
      console.error('Failed to submit review:', error);
      setReviewMessage('Failed to submit review. Please try again.');
    } finally {
      setSubmittingReview(false);
    }
  };

  const currentCard = flashcards[0];

  return (
    <div className="dashboard">
      <div className="header">
        <h2>Flashcard Pro</h2>
        <div className="user-menu">
          <span>{user?.name || user?.email}</span>
          <button className="btn-logout" onClick={onLogout}>
            Logout
          </button>
        </div>
      </div>

      {stats && (
        <div className="stats-strip">
          <div className="stat-pill">
            <span className="stat-key">Due</span>
            <span className="stat-value">{stats.dueToday}</span>
          </div>
          <div className="stat-pill">
            <span className="stat-key">Learned</span>
            <span className="stat-value">{stats.learned}</span>
          </div>
          <div className="stat-pill">
            <span className="stat-key">To Learn</span>
            <span className="stat-value">{stats.toLearn}</span>
          </div>
          <div className="stat-pill">
            <span className="stat-key">Total</span>
            <span className="stat-value">{stats.total}</span>
          </div>
        </div>
      )}

      <div className="tabs">
        <button
          className={`tab ${activeTab === 'review' ? 'active' : ''}`}
          onClick={() => setActiveTab('review')}
        >
          📖 Review
        </button>
        <button
          className={`tab ${activeTab === 'create' ? 'active' : ''}`}
          onClick={() => setActiveTab('create')}
        >
          ➕ New Card
        </button>
      </div>

      <div className="content">
        {activeTab === 'review' && (
          <div className="review-section">
            {loading ? (
              <p>Loading cards...</p>
            ) : currentCard ? (
              <div className="study-card-wrap">
                <div className="study-progress">
                  <span>{flashcards.length} card(s) due now</span>
                  <div className="review-actions">
                    <button className="btn btn-refresh" onClick={() => void loadData('due')}>
                      Due
                    </button>
                    <button className="btn btn-refresh" onClick={() => void loadData('all')}>
                      Relearn
                    </button>
                  </div>
                </div>

                <div className="study-card">
                  <button
                    type="button"
                    className="study-card-button"
                    onClick={() => setShowAnswer((prev) => !prev)}
                  >
                    <div className="study-label">{showAnswer ? 'Answer' : 'Question'}</div>
                    <div className="study-text">{showAnswer ? currentCard.back : currentCard.front}</div>
                    <div className="study-hint">Tap card to flip</div>
                  </button>

                  <div className="study-divider" />
                  <div className="card-stats">
                    <span>Reps: {currentCard.repetitions}</span>
                    <span>EF: {currentCard.easeFactor.toFixed(2)}</span>
                  </div>
                </div>

                {showAnswer && (
                  <div className="grade-panel">
                    <p className="grade-title">How well did you remember?</p>
                    <div className="grade-buttons">
                      <button
                        className="btn grade grade-bad"
                        disabled={submittingReview}
                        onClick={() => void submitReview(1)}
                      >
                        Forgot (1)
                      </button>
                      <button
                        className="btn grade grade-hard"
                        disabled={submittingReview}
                        onClick={() => void submitReview(3)}
                      >
                        Hard (3)
                      </button>
                      <button
                        className="btn grade grade-good"
                        disabled={submittingReview}
                        onClick={() => void submitReview(4)}
                      >
                        Good (4)
                      </button>
                      <button
                        className="btn grade grade-easy"
                        disabled={submittingReview}
                        onClick={() => void submitReview(5)}
                      >
                        Easy (5)
                      </button>
                    </div>
                  </div>
                )}

                {reviewMessage && <p className="review-message">{reviewMessage}</p>}
              </div>
            ) : (
              <div>
                <p className="no-cards">No cards due for review! 🎉</p>
                <div className="review-actions review-actions-center">
                  <button className="btn btn-refresh" onClick={() => void loadData('due')}>
                    Check Again
                  </button>
                  <button className="btn btn-refresh" onClick={() => void loadData('all')}>
                    Học Lại Tất Cả
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'create' && <CreateCardForm onClose={loadData} />}
      </div>
    </div>
  );
};

const CreateCardForm: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const token = await getAuthToken();

      await fetch('https://flashcard-extension.onrender.com/flashcards', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ front, back }),
      });

      setFront('');
      setBack('');
      onClose();
    } catch (error) {
      console.error('Failed to create card:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="create-form">
      <div className="form-group">
        <label>Question</label>
        <textarea
          value={front}
          onChange={(e) => setFront(e.target.value)}
          placeholder="Enter the question..."
          required
        />
      </div>

      <div className="form-group">
        <label>Answer</label>
        <textarea
          value={back}
          onChange={(e) => setBack(e.target.value)}
          placeholder="Enter the answer..."
          required
        />
      </div>

      <button type="submit" className="btn btn-primary" disabled={loading}>
        {loading ? 'Creating...' : 'Create Card'}
      </button>
    </form>
  );
};
