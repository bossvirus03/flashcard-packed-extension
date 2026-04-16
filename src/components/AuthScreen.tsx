import React, { useState } from "react";

interface AuthScreenProps {
  onLogin: (userData: any) => void;
}

interface AuthMessageResponse {
  success: boolean;
  user?: any;
  error?: string;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onLogin }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await new Promise<AuthMessageResponse>((resolve) => {
        chrome.runtime.sendMessage(
          { action: "authenticate" },
          (messageResponse?: AuthMessageResponse) => {
            if (chrome.runtime.lastError) {
              resolve({
                success: false,
                error:
                  chrome.runtime.lastError.message ||
                  "Extension message failed",
              });
              return;
            }

            if (!messageResponse) {
              resolve({
                success: false,
                error: "Empty response from background script",
              });
              return;
            }

            resolve(messageResponse);
          },
        );
      });

      if (response.success && response.user) {
        onLogin(response.user);
      } else {
        setError(response.error || "Authentication failed");
      }
    } catch (err) {
      setError("Failed to authenticate. Please try again.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-screen">
      <div className="auth-container">
        <div className="auth-brand">Flashcard</div>
        <h1 className="auth-title">Sign in</h1>
        <p className="subtitle">Use Google to sync your cards.</p>

        {error && <div className="error-message">{error}</div>}

        <button
          className="btn btn-primary btn-large"
          onClick={handleGoogleLogin}
          disabled={loading}
        >
          {loading ? "Signing in..." : "Sign in with Gmail"}
        </button>

        <p className="auth-footnote">Fast review. Simple sync.</p>
      </div>
    </div>
  );
};
