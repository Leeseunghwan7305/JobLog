/** @type {import('next').NextConfig} */
const nextConfig = {
  // 워크스페이스 타입 패키지를 소스로 가져다 쓰기 위해 트랜스파일
  transpilePackages: ['@joblog/types'],
};

export default nextConfig;
