import React, { useState, useEffect } from "react";

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

type PhoneticMap = Record<string, string>;

function detectLanguage(text: string): string {
  // Basic Vietnamese detection by accented characters.
  const hasVietnamese =
    /[\u0102\u0103\u00c2\u00c3\u00ca\u00ca\u00d4\u00f4\u01a0\u01a1\u01af\u01b0\u0110\u0111\u1ea0-\u1ef9]/i.test(
      text,
    );
  return hasVietnamese ? "vi-VN" : "en-US";
}

function pickBestVoice(lang: string): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) {
    return null;
  }

  const sameLang = voices.filter((v) =>
    v.lang.toLowerCase().startsWith(lang.split("-")[0].toLowerCase()),
  );
  const pool = sameLang.length ? sameLang : voices;

  const preferredPatterns = [
    /Google/i,
    /Microsoft/i,
    /Samantha|Alex|Daniel|Serena/i,
    /Premium|Enhanced|Neural/i,
  ];

  for (const pattern of preferredPatterns) {
    const match = pool.find((v) => pattern.test(v.name));
    if (match) {
      return match;
    }
  }

  return pool[0] ?? null;
}

async function getAuthToken(): Promise<string> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get("authToken", (data) => {
      if (chrome.runtime.lastError) {
        reject(
          new Error(
            chrome.runtime.lastError.message || "Failed to get auth token",
          ),
        );
        return;
      }

      const token = data.authToken as string | undefined;

      if (!token) {
        reject(new Error("Missing auth token"));
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
  const [activeTab, setActiveTab] = useState("review");
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [stats, setStats] = useState<FlashcardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAnswer, setShowAnswer] = useState(false);
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewMessage, setReviewMessage] = useState("");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [phonetics, setPhonetics] = useState<PhoneticMap>({});
  const [loadingPhonetic, setLoadingPhonetic] = useState(false);

  useEffect(() => {
    void loadData();

    // Ensure browser voice list is populated (many browsers load it lazily).
    window.speechSynthesis.getVoices();
    const onVoicesChanged = () => {
      window.speechSynthesis.getVoices();
    };
    window.speechSynthesis.addEventListener("voiceschanged", onVoicesChanged);

    return () => {
      window.speechSynthesis.cancel();
      window.speechSynthesis.removeEventListener(
        "voiceschanged",
        onVoicesChanged,
      );
    };
  }, []);

  useEffect(() => {
    // Stop speaking when switching card side.
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, [showAnswer]);

  useEffect(() => {
    const card = flashcards[0];
    if (!card || showAnswer) {
      return;
    }

    if (phonetics[card.id]) {
      return;
    }

    void fetchPhonetic(card.id, card.front);
  }, [flashcards, showAnswer]);

  const loadData = async (mode: "due" | "all" = "due") => {
    setLoading(true);
    setShowAnswer(false);
    setReviewMessage("");
    window.speechSynthesis.cancel();
    setIsSpeaking(false);

    try {
      const token = await getAuthToken();

      const cardsUrl =
        mode === "all"
          ? "https://flashcard-extension.onrender.com/flashcards"
          : "https://flashcard-extension.onrender.com/flashcards/due?limit=20";

      const cardsResponse = await fetch(cardsUrl, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const cards = (await cardsResponse.json()) as Flashcard[];
      setFlashcards(cards);

      if (mode === "all" && cards.length > 0) {
        setReviewMessage(`Loaded ${cards.length} cards for relearning.`);
      }

      // Fetch stats
      const statsResponse = await fetch(
        "https://flashcard-extension.onrender.com/flashcards/stats",
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );
      const statsData = await statsResponse.json();
      setStats(statsData);
    } catch (error) {
      console.error("Failed to load data:", error);
      setReviewMessage("Failed to load due cards. Please try again.");
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
    setReviewMessage("");

    try {
      const token = await getAuthToken();

      const response = await fetch(
        "https://flashcard-extension.onrender.com/reviews",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            flashcardId: currentCard.id,
            quality,
          }),
        },
      );

      if (!response.ok) {
        throw new Error(`Review failed (${response.status})`);
      }

      setFlashcards((prev) => prev.slice(1));
      setShowAnswer(false);
      setReviewMessage("Saved review. Great job!");
      window.speechSynthesis.cancel();
      setIsSpeaking(false);

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
      console.error("Failed to submit review:", error);
      setReviewMessage("Failed to submit review. Please try again.");
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleSpeak = () => {
    const card = flashcards[0];
    if (!card) {
      return;
    }

    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    const text = showAnswer ? card.back : card.front;
    if (!text || !text.trim()) {
      return;
    }

    const lang = detectLanguage(text);
    const voice = pickBestVoice(lang);

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = voice?.lang || lang;
    if (voice) {
      utterance.voice = voice;
    }
    // Slightly slower for clearer pronunciation in study mode.
    utterance.rate = 0.9;
    utterance.pitch = 1;
    utterance.volume = 1;
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
    setIsSpeaking(true);
  };

  const extractLookupWord = (text: string) => {
    const cleaned = text
      .trim()
      .replace(/[?.,!;:()[\]{}"“”]/g, " ")
      .split(/\s+/)
      .find((w) => /^[a-zA-Z'-]+$/.test(w));

    return cleaned ? cleaned.toLowerCase() : "";
  };

  const fetchPhonetic = async (cardId: string, question: string) => {
    const lang = detectLanguage(question);
    if (lang !== "en-US") {
      setPhonetics((prev) => ({
        ...prev,
        [cardId]: "IPA chưa hỗ trợ tốt cho ngôn ngữ này",
      }));
      return;
    }

    const lookupWord = extractLookupWord(question);
    if (!lookupWord) {
      return;
    }

    setLoadingPhonetic(true);

    try {
      const response = await fetch(
        `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(lookupWord)}`,
      );

      if (!response.ok) {
        throw new Error(`Phonetic API failed (${response.status})`);
      }

      const data = (await response.json()) as Array<{
        phonetic?: string;
        phonetics?: Array<{ text?: string }>;
      }>;

      const fromMain = data?.[0]?.phonetic;
      const fromList = data?.[0]?.phonetics?.find((p) => p.text)?.text;
      const phonetic = fromMain || fromList;

      if (phonetic) {
        setPhonetics((prev) => ({ ...prev, [cardId]: phonetic }));
      }
    } catch (error) {
      console.error("Failed to fetch phonetic:", error);
      setPhonetics((prev) => ({
        ...prev,
        [cardId]: "Không lấy được phiên âm",
      }));
    } finally {
      setLoadingPhonetic(false);
    }
  };

  const currentCard = flashcards[0];

  return (
    <div className="dashboard">
      <div className="header">
        <h2>Flashcard Pro</h2>
        <div className="user-menu">
          <div className="avatar" title={user?.name || user?.email || "User"}>
            {user?.picture ? (
              <img
                className="avatar-img"
                src={user.picture}
                alt="User avatar"
              />
            ) : (
              <span className="avatar-fallback">
                {String(user?.name || user?.email || "U")
                  .charAt(0)
                  .toUpperCase()}
              </span>
            )}
          </div>

          <button
            className="btn-logout btn-logout-icon"
            onClick={onLogout}
            title="Logout"
          >
            <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
              <path
                d="M15 3h-4a2 2 0 0 0-2 2v3h2V5h4v14h-4v-3H9v3a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zm-3.6 6.4-1.4 1.4 2.2 2.2H4v2h8.2L10 17.2l1.4 1.4L16 14l-4.6-4.6z"
                fill="currentColor"
              />
            </svg>
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
          className={`tab ${activeTab === "review" ? "active" : ""}`}
          onClick={() => setActiveTab("review")}
        >
          📖 Review
        </button>
        <button
          className={`tab ${activeTab === "create" ? "active" : ""}`}
          onClick={() => setActiveTab("create")}
        >
          ➕ New Card
        </button>
      </div>

      <div className="content">
        {activeTab === "review" && (
          <div className="review-section">
            {loading ? (
              <p>Loading cards...</p>
            ) : currentCard ? (
              <div className="study-card-wrap">
                <div className="study-progress">
                  <span>{flashcards.length} card(s) due now</span>
                  <div className="review-actions">
                    <button
                      className="btn btn-refresh"
                      onClick={() => void loadData("due")}
                    >
                      Due
                    </button>
                    <button
                      className="btn btn-refresh"
                      onClick={() => void loadData("all")}
                    >
                      Relearn
                    </button>
                  </div>
                </div>

                <div className="study-card">
                  <div className="study-head">
                    <div className="study-label">
                      {showAnswer ? "Answer" : "Question"}
                    </div>
                    <button
                      type="button"
                      className={`audio-btn ${isSpeaking ? "active" : ""}`}
                      onClick={handleSpeak}
                      aria-label={
                        isSpeaking ? "Stop pronunciation" : "Play pronunciation"
                      }
                    >
                      {isSpeaking ? "Stop" : "🔊"}
                    </button>
                    {!showAnswer && (
                      <button
                        type="button"
                        className="phonetic-btn"
                        onClick={() =>
                          void fetchPhonetic(currentCard.id, currentCard.front)
                        }
                        disabled={loadingPhonetic}
                        aria-label="Fetch phonetic"
                      >
                        {loadingPhonetic ? "..." : "IPA"}
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    className="study-card-button"
                    onClick={() => setShowAnswer((prev) => !prev)}
                  >
                    <div className="study-text">
                      {showAnswer ? currentCard.back : currentCard.front}
                    </div>
                    {!showAnswer && phonetics[currentCard.id] && (
                      <div className="study-phonetic">
                        {phonetics[currentCard.id]}
                      </div>
                    )}
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

                {reviewMessage && (
                  <p className="review-message">{reviewMessage}</p>
                )}
              </div>
            ) : (
              <div>
                <p className="no-cards">No cards due for review! 🎉</p>
                <div className="review-actions review-actions-center">
                  <button
                    className="btn btn-refresh"
                    onClick={() => void loadData("due")}
                  >
                    Check Again
                  </button>
                  <button
                    className="btn btn-refresh"
                    onClick={() => void loadData("all")}
                  >
                    Học Lại Tất Cả
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "create" && <CreateCardForm onClose={loadData} />}
      </div>
    </div>
  );
};

const CreateCardForm: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const token = await getAuthToken();

      await fetch("https://flashcard-extension.onrender.com/flashcards", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ front, back }),
      });

      setFront("");
      setBack("");
      onClose();
    } catch (error) {
      console.error("Failed to create card:", error);
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
        {loading ? "Creating..." : "Create Card"}
      </button>
    </form>
  );
};
