// Vercel 서버리스 함수 엔트리 (plain JS — esbuild가 메타데이터를 건드리지 않음).
// nest build로 tsc 컴파일된 dist를 require해서 NestJS DI 메타데이터를 보존한다.
module.exports = require('../dist/vercel.js').default;
