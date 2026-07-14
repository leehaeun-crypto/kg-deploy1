# 🔮 전생 알아보기 (kg-deploy1)

이름을 입력하면 OpenAI 모델이 그 사람의 전생 이야기를 써주는 단일 기능 웹 서비스입니다.

## 기술 스택

- Next.js (App Router) + TypeScript
- OpenAI API (기본 모델: `gpt-5.5`, `.env`에서 변경 가능)
- Vercel 배포

## 로컬 실행

1. 의존성 설치

   ```bash
   npm install
   ```

2. `.env` 파일에 OpenAI API 키 입력

   ```
   OPENAI_API_KEY=sk-...
   OPENAI_MODEL=gpt-5.5
   ```

3. 개발 서버 실행

   ```bash
   npm run dev
   ```

   http://localhost:3000 에서 확인

## Vercel 배포

1. 이 저장소를 GitHub에 push
2. [vercel.com](https://vercel.com) → **Add New Project** → `kg-deploy1` 저장소 import
3. **Environment Variables**에 `OPENAI_API_KEY` (그리고 필요시 `OPENAI_MODEL`) 추가
4. Deploy

> ⚠️ `.env` 파일은 `.gitignore`에 포함되어 있어 GitHub에 올라가지 않습니다.
> Vercel에서는 반드시 대시보드의 환경 변수 설정으로 키를 넣어야 합니다.
