export interface ParsedPosting {
  companyName: string;
  position: string;
  location: string | null;
  employmentType: string | null;
  deadline: string | null;
  stages: { name: string; order: number }[];
  confidence: 'high' | 'low';
}

export interface ParseResponse {
  draft: ParsedPosting;
  needsManualInput: boolean;
  notice?: string;
}

export const DEFAULT_STAGES = [
  { name: '서류', order: 0 },
  { name: '면접', order: 1 },
  { name: '최종', order: 2 },
];
