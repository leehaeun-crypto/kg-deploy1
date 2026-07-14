"use client";

import { useState } from "react";

interface PastLifeRecord {
  being: string;
  era: string;
  death: string;
  achievement: string;
  memory: string;
}

interface PastLifeResult {
  name: string;
  record: PastLifeRecord;
  story: string | null;
}

const FIELD_LABELS: { key: keyof PastLifeRecord; icon: string; label: string }[] = [
  { key: "being", icon: "🧬", label: "전생의 직업 또는 존재" },
  { key: "era", icon: "⏳", label: "시대" },
  { key: "death", icon: "🕯️", label: "사인" },
  { key: "achievement", icon: "🏆", label: "전생의 업적" },
  { key: "memory", icon: "💭", label: "사람들은 나를 이렇게 기억한다" },
];

export default function Home() {
  const [name, setName] = useState("");
  const [result, setResult] = useState<PastLifeResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || loading) return;

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const res = await fetch("/api/past-life", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "전생을 불러오지 못했습니다.");
      }
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main>
      <h1 className="title">🔮 나의 전생 알아보기</h1>
      <p className="subtitle">
        이름을 입력하면 시간의 강 너머, 당신의 전생 기록을 열람해 드립니다.
        <br />
        당신은 전생에 누구였을까요… 아니, 무엇이었을까요?
      </p>

      <form className="form" onSubmit={handleSubmit}>
        <input
          className="input"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="이름을 입력하세요"
          maxLength={20}
        />
        <button className="button" type="submit" disabled={loading || !name.trim()}>
          {loading ? "열람 중..." : "전생 보기"}
        </button>
      </form>

      {loading && <p className="loading">✨ 시간의 강을 거슬러 전생 기록부를 펼치는 중...</p>}
      {error && <p className="error">{error}</p>}

      {result && (
        <div className="record">
          <h2 className="record-title">📜 {result.name}님의 전생 기록부</h2>
          <dl className="record-list">
            {FIELD_LABELS.map(({ key, icon, label }) => (
              <div className="record-row" key={key}>
                <dt className="record-label">
                  {icon} {label}
                </dt>
                <dd className="record-value">{result.record[key]}</dd>
              </div>
            ))}
          </dl>
          {result.story && (
            <p className="story">
              <span className="story-label">🔮 전생 감정사의 한마디</span>
              {result.story}
            </p>
          )}
        </div>
      )}
    </main>
  );
}
