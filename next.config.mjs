/** @type {import('next').NextConfig} */
const nextConfig = {
  // Vercel 서버리스 번들에 전생 기록 엑셀 파일을 포함시킨다
  outputFileTracingIncludes: {
    "/api/past-life": ["./data/**/*"],
  },
};

export default nextConfig;
