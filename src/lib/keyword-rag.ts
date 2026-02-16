/**
 * 키워드 기반 RAG - 사용자 메시지에서 키워드 감지하고 관련 정보 반환
 */

export interface KeywordMatch {
  keyword: string;
  section: string;
  content: string;
}

// 키워드 → 관련 정보 매핑
// 각 정치인별로 다르게 설정 가능하지만, 일단 공통 키워드로 시작
const KEYWORD_MAP: Record<string, { section: string; keywords: string[] }[]> = {
  // 회사/투자 관련
  hashed: [
    { section: '해시드 연관성', keywords: ['해시드', 'hashed', '해쉬드'] },
  ],
  modhaus: [
    { section: '소속사', keywords: ['모드하우스', 'modhaus', '소속사'] },
  ],
  unopnd: [
    { section: '언오픈드', keywords: ['언오픈드', 'unopnd', '벤처빌더'] },
  ],
  // 인물 관련
  ceo: [
    { section: '대표', keywords: ['김서준', '서준', '이찬기', '정병기', '백광현', '대표'] },
  ],
  // 그룹 관련
  triples: [
    { section: '그룹', keywords: ['트리플에스', 'triples', '트리플s'] },
  ],
  cosmo: [
    { section: 'Web3', keywords: ['코스모', 'cosmo', 'objekt', '오브젝트', 'nft', 'web3'] },
  ],
  // 경력 관련
  career: [
    { section: '경력', keywords: ['보니하니', '버스터즈', '아역', '데뷔'] },
  ],
  kbw: [
    { section: 'KBW', keywords: ['kbw', '코리아블록체인위크', '패널'] },
  ],
};

/**
 * 텍스트에서 매칭되는 키워드 찾기
 */
export function findKeywords(text: string): string[] {
  const lowerText = text.toLowerCase();
  const matched: string[] = [];
  
  for (const [category, mappings] of Object.entries(KEYWORD_MAP)) {
    for (const mapping of mappings) {
      for (const keyword of mapping.keywords) {
        if (lowerText.includes(keyword.toLowerCase())) {
          if (!matched.includes(category)) {
            matched.push(category);
          }
          break;
        }
      }
    }
  }
  
  return matched;
}

/**
 * MD 컨텐츠에서 특정 섹션 추출 (## 헤딩 기준)
 */
export function extractSection(mdContent: string, sectionKeywords: string[]): string {
  const lines = mdContent.split('\n');
  const sections: string[] = [];
  let currentSection = '';
  let currentContent: string[] = [];
  let capturing = false;
  
  for (const line of lines) {
    // 새 섹션 시작 (## 또는 ###)
    if (line.startsWith('## ') || line.startsWith('### ')) {
      // 이전 섹션 저장
      if (capturing && currentContent.length > 0) {
        sections.push(currentContent.join('\n'));
      }
      
      currentSection = line.toLowerCase();
      currentContent = [line];
      
      // 키워드와 매칭되는지 확인
      capturing = sectionKeywords.some(kw => 
        currentSection.includes(kw.toLowerCase())
      );
    } else if (capturing) {
      currentContent.push(line);
    }
  }
  
  // 마지막 섹션
  if (capturing && currentContent.length > 0) {
    sections.push(currentContent.join('\n'));
  }
  
  return sections.join('\n\n');
}

/**
 * 키워드 카테고리에 해당하는 섹션 키워드 반환
 */
export function getSectionKeywords(categories: string[]): string[] {
  const sectionKeywords: string[] = [];
  
  for (const category of categories) {
    const mappings = KEYWORD_MAP[category];
    if (mappings) {
      for (const mapping of mappings) {
        sectionKeywords.push(mapping.section);
      }
    }
  }
  
  return sectionKeywords;
}

/**
 * 사용자 메시지 기반으로 관련 컨텍스트 추출
 */
export function getRelevantContext(
  userMessage: string,
  knowledgeFiles: Record<string, string>
): string {
  const matchedCategories = findKeywords(userMessage);
  
  if (matchedCategories.length === 0) {
    return '';
  }
  
  const sectionKeywords = getSectionKeywords(matchedCategories);
  const relevantSections: string[] = [];
  
  // 모든 knowledge 파일에서 관련 섹션 추출
  for (const [filename, content] of Object.entries(knowledgeFiles)) {
    const extracted = extractSection(content, sectionKeywords);
    if (extracted.trim()) {
      relevantSections.push(`[${filename}에서 추출]\n${extracted}`);
    }
  }
  
  if (relevantSections.length === 0) {
    return '';
  }
  
  return `\n\n---\n## 🔍 이 대화와 관련된 추가 정보 (반드시 참고해서 답변하세요!)\n\n${relevantSections.join('\n\n')}`;
}
