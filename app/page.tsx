"use client";

import { useState } from "react";

export default function Home() {
  const [name, setName] = useState("");
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || loading) return;

    setLoading(true);
    setError("");
    setResult("");

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
      setResult(data.story);
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
        이름을 입력하면 AI가 그 사람의 전생 이야기를 들려드립니다.
        <br />
        당신은 전생에 누구였을까요?
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
          {loading ? "보는 중..." : "전생 보기"}
        </button>
      </form>

      {loading && <p className="loading">✨ 시간의 강을 거슬러 올라가는 중...</p>}
      {error && <p className="error">{error}</p>}
      {result && <div className="result">{result}</div>}
    </main>
  );
}
