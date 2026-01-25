import { ParsedSection, ParsedTable, documentParserService } from './documentParser';

export interface MappingSuggestion {
  sectionId: string;
  suggestedStandardCode: string;
  suggestedSpecCode: string;
  confidence: number;
  matchedPatterns: string[];
  alternativeSuggestions: Array<{
    standardCode: string;
    specCode: string;
    confidence: number;
  }>;
}

// Standard keywords and their associated standards
const STANDARD_KEYWORDS: Record<string, { keywords: string[]; specKeywords?: Record<string, string[]> }> = {
  '1': {
    keywords: ['institutional', 'accredit', 'program objective', 'regionally accredited', 'degree granting'],
    specKeywords: {
      'a': ['regionally accredited', 'accrediting body'],
      'b': ['degree-granting', 'degree granting', 'unit'],
      'c': ['primary objective', 'human services']
    }
  },
  '2': {
    keywords: ['philosophical', 'philosophy', 'mission', 'goals', 'values'],
    specKeywords: {
      'a': ['philosophical statement', 'philosophy'],
      'b': ['program goals', 'measurable'],
      'c': ['program mission', 'institution mission']
    }
  },
  '3': {
    keywords: ['community assessment', 'community needs', 'labor market', 'employment', 'demand'],
    specKeywords: {
      'a': ['assessment process', 'community assessment'],
      'b': ['needs assessment', 'community needs'],
      'c': ['labor market', 'employment']
    }
  },
  '4': {
    keywords: ['program evaluation', 'assessment', 'outcomes', 'continuous improvement'],
    specKeywords: {
      'a': ['evaluation plan', 'program outcomes'],
      'b': ['curriculum review', 'continuous improvement'],
      'c': ['stakeholder feedback', 'advisory']
    }
  },
  '5': {
    keywords: ['admission', 'retention', 'dismissal', 'policies', 'procedures', 'students'],
    specKeywords: {
      'a': ['admission criteria', 'admission requirements'],
      'b': ['retention', 'academic standing'],
      'c': ['dismissal', 'termination']
    }
  },
  '6': {
    keywords: ['faculty', 'credentials', 'qualifications', 'degree', 'experience'],
    specKeywords: {
      'a': ['master', 'doctorate', 'terminal degree'],
      'b': ['professional experience', 'field experience'],
      'c': ['teaching experience', 'instruction']
    }
  },
  '7': {
    keywords: ['personnel', 'responsibilities', 'evaluation', 'job description', 'faculty roles'],
    specKeywords: {
      'a': ['job descriptions', 'responsibilities'],
      'b': ['faculty evaluation', 'performance review'],
      'c': ['professional development', 'training']
    }
  },
  '8': {
    keywords: ['cultural competence', 'diversity', 'multicultural', 'inclusion'],
    specKeywords: {
      'a': ['cultural competence', 'curriculum'],
      'b': ['diversity training', 'cultural awareness'],
      'c': ['diverse populations', 'underrepresented']
    }
  },
  '9': {
    keywords: ['program support', 'resources', 'budget', 'facilities', 'library'],
    specKeywords: {
      'a': ['budget', 'financial resources'],
      'b': ['facilities', 'physical resources'],
      'c': ['library', 'learning resources'],
      'd': ['technology', 'computing']
    }
  },
  '10': {
    keywords: ['transfer', 'credits', 'prior learning', 'articulation'],
    specKeywords: {
      'a': ['transfer credits', 'articulation'],
      'b': ['prior learning', 'credit for experience']
    }
  },
  '11': {
    keywords: ['history', 'historical', 'human services history', 'evolution'],
    specKeywords: {
      'a': ['historical roots', 'history of profession'],
      'b': ['legislative history', 'policy history']
    }
  },
  '12': {
    keywords: ['human systems', 'development', 'family', 'group dynamics', 'organizational'],
    specKeywords: {
      'a': ['human development', 'lifespan'],
      'b': ['family dynamics', 'family systems'],
      'c': ['group dynamics', 'small group'],
      'd': ['organizational', 'community systems']
    }
  },
  '13': {
    keywords: ['delivery systems', 'service delivery', 'agencies', 'organizations'],
    specKeywords: {
      'a': ['range of services', 'service delivery'],
      'b': ['agency structure', 'organization'],
      'c': ['funding sources', 'resources']
    }
  },
  '14': {
    keywords: ['information literacy', 'research', 'data', 'inquiry'],
    specKeywords: {
      'a': ['research methods', 'inquiry'],
      'b': ['information literacy', 'resources'],
      'c': ['data analysis', 'interpretation']
    }
  },
  '15': {
    keywords: ['planning', 'evaluation', 'program planning', 'needs assessment'],
    specKeywords: {
      'a': ['needs assessment', 'client needs'],
      'b': ['treatment planning', 'service planning'],
      'c': ['program evaluation', 'outcome measurement']
    }
  },
  '16': {
    keywords: ['intervention', 'strategies', 'skills', 'techniques', 'counseling'],
    specKeywords: {
      'a': ['interviewing', 'intake'],
      'b': ['counseling strategies', 'helping skills'],
      'c': ['case management', 'coordination'],
      'd': ['crisis intervention', 'emergency']
    }
  },
  '17': {
    keywords: ['communication', 'interpersonal', 'listening', 'verbal', 'nonverbal'],
    specKeywords: {
      'a': ['verbal communication', 'oral'],
      'b': ['written communication', 'documentation'],
      'c': ['interpersonal skills', 'relationships']
    }
  },
  '18': {
    keywords: ['administrative', 'management', 'supervision', 'leadership'],
    specKeywords: {
      'a': ['supervision', 'staff'],
      'b': ['budgeting', 'financial management'],
      'c': ['program management', 'administration']
    }
  },
  '19': {
    keywords: ['values', 'attitudes', 'ethics', 'client-related'],
    specKeywords: {
      'a': ['ethical standards', 'professional ethics'],
      'b': ['client dignity', 'respect'],
      'c': ['confidentiality', 'privacy']
    }
  },
  '20': {
    keywords: ['self-development', 'self-awareness', 'professional development', 'growth'],
    specKeywords: {
      'a': ['self-awareness', 'personal values'],
      'b': ['professional growth', 'continuing education'],
      'c': ['supervision', 'feedback']
    }
  },
  '21': {
    keywords: ['field experience', 'practicum', 'internship', 'field placement'],
    specKeywords: {
      'a': ['field hours', 'practicum hours'],
      'b': ['supervision', 'field supervisor'],
      'c': ['learning objectives', 'competencies'],
      'd': ['site selection', 'placement sites'],
      'e': ['evaluation', 'assessment']
    }
  }
};

// Content type patterns
const CONTENT_TYPE_PATTERNS = {
  syllabus: [
    /course\s*(description|objectives|outcomes)/i,
    /grading\s*(scale|policy)/i,
    /required\s*(text|reading)/i,
    /class\s*schedule/i,
    /instructor\s*information/i
  ],
  cv: [
    /education/i,
    /professional\s*experience/i,
    /publications/i,
    /curriculum\s*vitae/i,
    /employment\s*history/i
  ],
  evaluation_form: [
    /evaluation/i,
    /rating\s*scale/i,
    /meets\s*expectations/i,
    /below\s*expectations/i,
    /exceeds\s*expectations/i
  ],
  matrix: [
    /curriculum\s*matrix/i,
    /course\s*mapping/i,
    /[ITKS]\s*[,/]\s*[LMH]/i
  ]
};

export class SectionMapperService {
  /**
   * Auto-map sections to standards based on content analysis
   */
  async autoMap(
    sections: ParsedSection[],
    programLevel: 'associate' | 'bachelors' | 'masters'
  ): Promise<MappingSuggestion[]> {
    const suggestions: MappingSuggestion[] = [];

    for (const section of sections) {
      const suggestion = this.mapSection(section, programLevel);
      if (suggestion) {
        suggestions.push(suggestion);
      }
    }

    return suggestions;
  }

  /**
   * Map a single section to a standard
   */
  private mapSection(
    section: ParsedSection,
    _programLevel: 'associate' | 'bachelors' | 'masters'
  ): MappingSuggestion | null {
    const content = section.content.toLowerCase();
    const matchedPatterns: string[] = [];
    const standardScores: Map<string, { score: number; spec?: string; patterns: string[] }> = new Map();

    // First check for explicit standard references
    const explicitPatterns = documentParserService.detectStandardPatterns(section.content);
    for (const pattern of explicitPatterns) {
      const key = pattern.standardCode;
      const existing = standardScores.get(key) || { score: 0, patterns: [] };
      standardScores.set(key, {
        score: existing.score + pattern.confidence,
        spec: pattern.specCode || existing.spec,
        patterns: [...existing.patterns, pattern.matchedText]
      });
    }

    // Then check keyword patterns
    for (const [standardCode, config] of Object.entries(STANDARD_KEYWORDS)) {
      let score = 0;
      const patterns: string[] = [];

      // Check main keywords
      for (const keyword of config.keywords) {
        if (content.includes(keyword.toLowerCase())) {
          score += 0.3;
          patterns.push(keyword);
        }
      }

      // Check spec-specific keywords
      let matchedSpec: string | undefined;
      if (config.specKeywords) {
        for (const [specCode, specKeywords] of Object.entries(config.specKeywords)) {
          for (const keyword of specKeywords) {
            if (content.includes(keyword.toLowerCase())) {
              score += 0.2;
              patterns.push(`${specCode}: ${keyword}`);
              matchedSpec = specCode;
            }
          }
        }
      }

      if (score > 0) {
        const existing = standardScores.get(standardCode) || { score: 0, patterns: [] };
        standardScores.set(standardCode, {
          score: existing.score + score,
          spec: matchedSpec || existing.spec,
          patterns: [...existing.patterns, ...patterns]
        });
      }
    }

    // Find the best match
    let bestMatch: { standard: string; score: number; spec?: string; patterns: string[] } | null = null;
    const alternatives: Array<{ standardCode: string; specCode: string; confidence: number }> = [];

    for (const [standard, data] of standardScores.entries()) {
      if (!bestMatch || data.score > bestMatch.score) {
        if (bestMatch) {
          alternatives.push({
            standardCode: bestMatch.standard,
            specCode: bestMatch.spec || 'a',
            confidence: Math.min(0.95, bestMatch.score)
          });
        }
        bestMatch = { standard, ...data };
      } else if (data.score > 0.2) {
        alternatives.push({
          standardCode: standard,
          specCode: data.spec || 'a',
          confidence: Math.min(0.95, data.score)
        });
      }
    }

    if (!bestMatch || bestMatch.score < 0.2) {
      return null;
    }

    return {
      sectionId: section.id,
      suggestedStandardCode: bestMatch.standard,
      suggestedSpecCode: bestMatch.spec || 'a',
      confidence: Math.min(0.95, bestMatch.score),
      matchedPatterns: bestMatch.patterns,
      alternativeSuggestions: alternatives.slice(0, 3)
    };
  }

  /**
   * Map tables to standards
   */
  mapTable(table: ParsedTable): MappingSuggestion | null {
    const allText = [
      ...table.headers,
      ...table.rows.flat()
    ].join(' ').toLowerCase();

    // Check for curriculum matrix
    if (table.tableType === 'curriculum_matrix' || this.isCurriculumMatrix(allText)) {
      return {
        sectionId: table.id,
        suggestedStandardCode: '11',
        suggestedSpecCode: 'matrix',
        confidence: 0.9,
        matchedPatterns: ['curriculum matrix'],
        alternativeSuggestions: []
      };
    }

    // Check for grading scale
    if (table.tableType === 'grading_scale' || this.isGradingScale(allText)) {
      return {
        sectionId: table.id,
        suggestedStandardCode: 'syllabus',
        suggestedSpecCode: 'grading',
        confidence: 0.85,
        matchedPatterns: ['grading scale'],
        alternativeSuggestions: []
      };
    }

    // Check for course schedule
    if (table.tableType === 'schedule' || this.isSchedule(allText)) {
      return {
        sectionId: table.id,
        suggestedStandardCode: 'syllabus',
        suggestedSpecCode: 'schedule',
        confidence: 0.85,
        matchedPatterns: ['course schedule'],
        alternativeSuggestions: []
      };
    }

    return null;
  }

  /**
   * Detect content type (syllabus, CV, evaluation form, etc.)
   */
  detectContentType(text: string): string | null {
    for (const [type, patterns] of Object.entries(CONTENT_TYPE_PATTERNS)) {
      const matchCount = patterns.filter(p => p.test(text)).length;
      if (matchCount >= 2) {
        return type;
      }
    }
    return null;
  }

  /**
   * Check if text represents a curriculum matrix
   */
  private isCurriculumMatrix(text: string): boolean {
    const patterns = [
      /chs\s*\d{3}/i,
      /[ITKS]\s*[,/]?\s*[LMH]/i,
      /course\s*(code|number)/i,
      /standard\s*\d+/i
    ];
    return patterns.filter(p => p.test(text)).length >= 2;
  }

  /**
   * Check if text represents a grading scale
   */
  private isGradingScale(text: string): boolean {
    return /grade/i.test(text) &&
           /[A-F][+-]?/i.test(text) &&
           (/percentage|points|qpa|gpa/i.test(text));
  }

  /**
   * Check if text represents a course schedule
   */
  private isSchedule(text: string): boolean {
    return /(week|date)/i.test(text) &&
           /(topic|theme|subject)/i.test(text) &&
           /(assignment|reading|due)/i.test(text);
  }

  /**
   * Calculate confidence score for a mapping
   */
  calculateConfidence(matchedPatterns: string[], totalKeywords: number): number {
    if (totalKeywords === 0) return 0;
    const baseScore = matchedPatterns.length / totalKeywords;

    // Boost for explicit standard references
    const hasExplicitRef = matchedPatterns.some(p => /standard\s*\d+/i.test(p));
    const boost = hasExplicitRef ? 0.2 : 0;

    return Math.min(0.95, baseScore + boost);
  }
}

export const sectionMapperService = new SectionMapperService();
