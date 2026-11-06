/**
 * 인기 회사 수동 큐레이션 — 국민연금 이름 매칭이 애매한(동명 하청·자회사 다수,
 * 브랜드명≠법인명) 회사만 등록한다. 공개 회사 페이지(SEO)에서 '진짜 그 회사'를
 * 정확히 보여주기 위함. 키는 normalize()된 검색어, name은 bass 검색에 쓸 법인명.
 *
 * ▸ 새 회사 추가법: NPS bass/detail로 대표 사업장 seq를 확인(규모·업종·주소가
 *   실제 회사와 일치하는지 사람이 검증) 후 한 줄 추가. 깔끔히 매칭되는 회사는
 *   등록 불필요(자동 해소됨).
 */
export interface CuratedCompany {
  /** 검증된 대표 사업장 seq. */
  seq: string;
  /** bass 검색에 쓸 법인명(브랜드와 다르면 법인명, 같으면 브랜드 그대로). */
  name: string;
}

export const CURATED: Record<string, CuratedCompany> = {
  토스: { seq: '6711893', name: '비바리퍼블리카' },
  쿠팡: { seq: '6713545', name: '쿠팡 주식회사' },
  야놀자: { seq: '6574923', name: '야놀자' },
  라인: { seq: '6706530', name: '라인플러스' },
  라인플러스: { seq: '6706530', name: '라인플러스' },
  무신사: { seq: '6693275', name: '무신사' },
};
