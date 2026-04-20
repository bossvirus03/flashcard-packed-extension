import React, { useState, useEffect, useMemo } from "react";
import { fetchPracticeCards, resetPractice, Flashcard } from "../utils/flashcardService";

const shuffleArray = <T,>(array: T[]): T[] => [...array].sort(() => Math.random() - 0.5);

export const PracticeScreen: React.FC = () => {
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<"mc" | "fb">("mc");
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
  const [typedAnswer, setTypedAnswer] = useState("");
  const [status, setStatus] = useState<"idle" | "correct" | "incorrect">("idle");
  const [showHint, setShowHint] = useState(false);
  const [resetFlag, setResetFlag] = useState(0);

  useEffect(() => {
    const loadPracticeCards = async () => {
      setLoading(true);
      try {
        const practiceCards = await fetchPracticeCards(20);
        setCards(shuffleArray(practiceCards));
        setCurrentIndex(0);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    loadPracticeCards();
  }, [resetFlag]);

  // Reset trạng thái khi đổi câu hoặc mode
  useEffect(() => {
    setStatus("idle");
    setShowHint(false);
    setSelectedChoice(null);
    setTypedAnswer("");
  }, [currentIndex, mode]);

  const fbData = useMemo(() => {
    if (cards.length === 0) return null;
    const words = cards[currentIndex].front.trim().split(/\s+/);
    const idx = Math.floor(Math.random() * words.length);
    const hidden = words[idx].replace(/[.,!?;:]/g, "");
    return {
      before: words.slice(0, idx).join(" "),
      after: words.slice(idx + 1).join(" "),
      hidden,
    };
  }, [cards, currentIndex]);

  const options = useMemo(() => {
    if (cards.length === 0) return [];
    const current = cards[currentIndex];
    const distractors = shuffleArray(
      cards.filter((c) => c.id !== current.id).map((c) => c.back.trim())
    ).slice(0, 3);
    return shuffleArray([current.back.trim(), ...distractors]);
  }, [cards, currentIndex]);

  const handleCheck = () => {
    const correct = mode === "mc" 
      ? cards[currentIndex].back.trim() 
      : fbData!.hidden;

    const userAns = mode === "mc" 
      ? selectedChoice?.trim() 
      : typedAnswer.trim();

    if (userAns?.toLowerCase() === correct.toLowerCase()) {
      setStatus("correct");
    } else {
      setStatus("incorrect");
      setShowHint(true);
    }
  };

  const handleNext = () => {
    setCurrentIndex((i) => i + 1);
  };

  const handleResetPractice = async () => {
    if (window.confirm("Reset bài luyện tập?")) {
      try {
        await resetPractice();
      } catch (e) {
        alert("Reset thất bại!");
      }
      setResetFlag((f) => f + 1);
      setCurrentIndex(0);
    }
  };

  if (loading) return <div className="practice-empty">Đang tải thẻ luyện tập...</div>;

  if (currentIndex >= cards.length) {
    return (
      <div className="practice-empty">
        Hoàn thành bài tập!<br />
        <button className="btn btn-primary" onClick={handleResetPractice} style={{ marginTop: 16 }}>
          Làm lại
        </button>
      </div>
    );
  }

  const current = cards[currentIndex];
  const isAnswered = status !== "idle";

  return (
    <div className="practice-section">
      <button 
        className="btn btn-danger" 
        onClick={handleResetPractice} 
        style={{ float: "right", marginBottom: 10 }}
      >
        Reset
      </button>

      <div className="practice-tabs">
        <button 
          className={`btn ${mode === "mc" ? "btn-primary" : "btn-secondary"}`} 
          onClick={() => { setMode("mc"); setCurrentIndex(0); }}
        >
          Trắc nghiệm
        </button>
        <button 
          className={`btn ${mode === "fb" ? "btn-primary" : "btn-secondary"}`} 
          onClick={() => { setMode("fb"); setCurrentIndex(0); }}
        >
          Điền từ
        </button>
      </div>

      <h3>{mode === "mc" ? "Chọn đáp án đúng" : "Điền từ vào chỗ trống"}</h3>

      <div className={`practice-card ${status}`}>
        {/* Câu hỏi */}
        <div className="practice-question">
          {mode === "mc" ? (
            current.front
          ) : (
            <div>
              <div style={{ fontWeight: "bold", marginBottom: "10px", color: "#555" }}>
                Nghĩa: {current.back}
              </div>
              {fbData?.before} 
              <span 
                style={{
                  borderBottom: `2px solid ${status === "incorrect" ? "red" : "#333"}`,
                  padding: "0 8px",
                  color: status === "incorrect" ? "red" : "inherit",
                }}
              >
                {typedAnswer || "____"}
              </span> 
              {fbData?.after}
            </div>
          )}
        </div>

        {/* Hiển thị đáp án đúng khi sai */}
        {showHint && (
          <div className="hint-box" style={{ color: "#155724", backgroundColor: "#d4edda", padding: "12px", borderRadius: "8px" }}>
            Đáp án đúng: <strong>{mode === "mc" ? current.back : fbData?.hidden}</strong>
          </div>
        )}

        {/* Trả lời */}
        {mode === "mc" ? (
          <div className="practice-choice-grid">
            {options.map((opt, i) => {
              const isSelected = selectedChoice === opt;
              const isCorrectAnswer = opt === current.back.trim();
              const isWrongSelected = status === "incorrect" && isSelected;

              return (
                <button
                  key={i}
                  className={`practice-choice ${isSelected ? "selected" : ""}`}
                  onClick={() => status === "idle" && setSelectedChoice(opt)}
                  disabled={isAnswered}
                  style={{
                    backgroundColor: isCorrectAnswer && isAnswered ? "#d4edda" : 
                                    isWrongSelected ? "#f8d7da" : undefined,
                    color: isCorrectAnswer && isAnswered ? "#155724" : 
                          isWrongSelected ? "#721c24" : undefined,
                    borderColor: isCorrectAnswer && isAnswered ? "#c3e6cb" : 
                                isWrongSelected ? "#f5c6cb" : undefined,
                  }}
                >
                  {opt}
                </button>
              );
            })}
          </div>
        ) : (
          <input
            className={`practice-input ${status}`}
            value={typedAnswer}
            onChange={(e) => {
              setTypedAnswer(e.target.value);
              if (status !== "idle") setStatus("idle"); // Cho phép sửa lại khi sai
            }}
            placeholder="Nhập từ..."
            disabled={status === "correct"}
            style={{
              borderColor: status === "correct" ? "green" : status === "incorrect" ? "red" : "#ccc",
            }}
          />
        )}

        {/* Footer - Luôn có nút "Câu tiếp theo" khi đã trả lời (dù đúng hay sai) */}
        <div className="practice-footer">
          {!isAnswered ? (
            <button className="btn btn-primary btn-large" onClick={handleCheck}>
              Kiểm tra
            </button>
          ) : (
            <button
              className="btn btn-primary btn-large"
              onClick={handleNext}
            >
              Câu tiếp theo →
            </button>
          )}
        </div>
      </div>
    </div>
  );
};