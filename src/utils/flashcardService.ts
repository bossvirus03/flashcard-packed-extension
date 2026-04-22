
import { getAuthToken } from "./auth";

export const API_BASE = "https://flashcard-extension.onrender.com";
// export const API_BASE = "http://localhost:3000";
const PRACTICE_CARDS_URL = `${API_BASE}/flashcards/practice`;
const REVIEW_CARDS_URL = `${API_BASE}/reviews/cards`;
const RESET_PRACTICE_URL = `${API_BASE}/reviews/reset`;
const STATS_URL = `${API_BASE}/flashcards/stats`;

export interface Flashcard {
  id: string;
  front: string;
  back: string;
  gotItCount?: number;
}

export async function fetchPracticeCards(limit = 20): Promise<Flashcard[]> {
  const token = await getAuthToken();
  const res = await fetch(
    `${PRACTICE_CARDS_URL}?limit=${limit}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  if (!res.ok) throw new Error("Failed to fetch practice cards");
  return res.json();
}

export async function fetchReviewCards(limit = 20): Promise<Flashcard[]> {
  const token = await getAuthToken();
  const res = await fetch(
    `${REVIEW_CARDS_URL}?limit=${limit}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  if (!res.ok) throw new Error("Failed to fetch review cards");
  return res.json();
}

export async function resetPractice() {
  const token = await getAuthToken();
  const res = await fetch(
    RESET_PRACTICE_URL,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  if (!res.ok) throw new Error("Failed to reset practice");
}

export async function fetchStats() {
  const token = await getAuthToken();
  const res = await fetch(
    STATS_URL,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) throw new Error("Failed to fetch stats");
  return res.json();
}

export const submitReview = async (
  flashcardId: string,
  isGotIt: boolean,
  lessonId?: string
) => {
  const token = await getAuthToken();
  const res = await fetch(`${API_BASE}/reviews`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ flashcardId, isGotIt, ...(lessonId && { lessonId }) }),
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.message || "Submit review failed");
  }

  return res.json();
};