import React, { useState, useEffect } from "react";
import { PracticeScreen } from "./PracticeScreen";
import {
  fetchReviewCards,
  fetchStats,
  resetPractice,
  submitReview as submitReviewApi,
  Flashcard,
  API_BASE,
} from "../utils/flashcardService";
import { getAuthToken } from "../utils/auth";

interface FlashcardStats {
  total: number;
  learned: number;
  toReview: number;
}

type DashboardTab = "review" | "practice" | "create";

export const DashboardScreen: React.FC<{ user: any; onLogout: () => void }> = ({
  user,
  onLogout,
}) => {
  const [activeTab, setActiveTab] = useState<DashboardTab>("review");
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [stats, setStats] = useState<FlashcardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAnswer, setShowAnswer] = useState(false);     // Giữ để lật thẻ
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewMessage, setReviewMessage] = useState("");

  const currentCard = flashcards[0];

  useEffect(() => {
    void loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setShowAnswer(false);
    setReviewMessage("");

    try {
      const cards = await fetchReviewCards(20);
      setFlashcards(cards);

      const currentStats = await fetchStats();
      setStats(currentStats);
    } catch (error) {
      console.error("Failed to load data:", error);
      setReviewMessage("Không thể tải dữ liệu. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  };

  const handleReview = async (isGotIt: boolean) => {
    if (!currentCard) return;

    setSubmittingReview(true);
    setReviewMessage("");

    try {
      await submitReviewApi(currentCard.id, isGotIt);

      // Chuyển sang thẻ tiếp theo
      setFlashcards((prev) => prev.slice(1));
      setShowAnswer(false);                    // Reset trạng thái lật thẻ

      if (isGotIt && currentCard.gotItCount + 1 >= 7) {
        setReviewMessage("🎉 Thẻ này đã thuộc! Đã chuyển sang thẻ tiếp theo.");
      } else {
        setReviewMessage(isGotIt ? "Got It! 👍" : "Study Again");
      }

      // Cập nhật stats
      const currentStats = await fetchStats();
      setStats(currentStats);
    } catch (error) {
      console.error(error);
      setReviewMessage("Có lỗi khi lưu tiến độ. Vui lòng thử lại.");
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleResetPractice = async () => {
    if (!window.confirm("Reset toàn bộ tiến độ luyện tập?")) return;

    try {
      await resetPractice();
      await loadData();
    } catch (e) {
      alert("Reset thất bại!");
    }
  };

  return (
    <div className="dashboard">
      <div className="header">
        <h2>Flashcard Pro</h2>
        <div className="user-menu">
          <div className="avatar" title={user?.name || user?.email}>
            {user?.picture ? (
              <img src={user.picture} alt="avatar" />
            ) : (
              <span>{(user?.name || user?.email || "U").charAt(0)}</span>
            )}
          </div>
          <button className="btn-logout" onClick={onLogout}>
            Đăng xuất
          </button>
        </div>
      </div>

      {stats && (
        <div className="stats-strip">
          <div className="stat-pill">
            <span>Cần ôn</span>
            <span className="stat-value">{stats.toReview}</span>
          </div>
          <div className="stat-pill">
            <span>Đã thuộc</span>
            <span className="stat-value">{stats.learned}</span>
          </div>
          <div className="stat-pill">
            <span>Tổng thẻ</span>
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
          className={`tab ${activeTab === "practice" ? "active" : ""}`}
          onClick={() => setActiveTab("practice")}
        >
          ✍ Practice
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
              <p>Đang tải...</p>
            ) : currentCard ? (
              <div className="study-card-wrap">
                <div className="study-progress">
                  <span>
                    {flashcards.length} thẻ cần ôn ({currentCard.gotItCount}/7)
                  </span>
                  <button
                    className="btn btn-danger"
                    onClick={handleResetPractice}
                  >
                    Reset
                  </button>
                </div>

                {/* Thẻ có thể lật */}
                <button
                  className="study-card-button"
                  onClick={() => setShowAnswer(!showAnswer)}
                >
                  <div className="study-text">
                    {showAnswer ? currentCard.back : currentCard.front}
                  </div>
                  <div className="study-hint">
                    {showAnswer ? "Nhấn để xem câu hỏi" : "Nhấn để xem đáp án"}
                  </div>
                </button>

                {/* 2 nút luôn hiển thị, dù chưa lật */}
                <div className="grade-panel always-visible">
                  <p className="grade-title">Bạn nhớ thẻ này thế nào?</p>
                  <div className="grade-buttons">
                    <button
                      className="btn grade grade-bad"
                      disabled={submittingReview}
                      onClick={() => handleReview(false)}
                    >
                      Study Again
                    </button>

                    <button
                      className="btn grade grade-good"
                      disabled={submittingReview}
                      onClick={() => handleReview(true)}
                    >
                      Got It
                      <br />
                      <small>({currentCard.gotItCount + 1}/7)</small>
                    </button>
                  </div>
                </div>

                {reviewMessage && (
                  <p className="review-message">{reviewMessage}</p>
                )}
              </div>
            ) : (
              <div className="no-cards">
                <p>🎉 Hiện không có thẻ nào cần ôn!</p>
                <p>Bạn đã học rất tốt.</p>
                <button className="btn btn-primary" onClick={loadData}>
                  Tải lại
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === "practice" && <PracticeScreen />}
        {activeTab === "create" && <CreateCardForm onSuccess={loadData} />}
      </div>
    </div>
  );
};

// Giữ nguyên phần CreateCardForm
const CreateCardForm: React.FC<{ onSuccess: () => void }> = ({ onSuccess }) => {
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const token = await getAuthToken();
      await fetch(`${API_BASE}/flashcards`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ front, back }),
      });

      setFront("");
      setBack("");
      onSuccess();
    } catch (error) {
      alert("Tạo thẻ thất bại!");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="create-form">
      <div className="form-group">
        <label>Câu hỏi / Mặt trước</label>
        <textarea
          value={front}
          onChange={(e) => setFront(e.target.value)}
          placeholder="Nhập mặt trước..."
          required
        />
      </div>
      <div className="form-group">
        <label>Đáp án / Mặt sau</label>
        <textarea
          value={back}
          onChange={(e) => setBack(e.target.value)}
          placeholder="Nhập mặt sau..."
          required
        />
      </div>
      <button type="submit" className="btn btn-primary" disabled={loading}>
        {loading ? "Đang tạo..." : "Tạo thẻ mới"}
      </button>
    </form>
  );
};