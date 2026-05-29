import type { VerifiableCitation, CitationType } from '../schema.js'

interface CitationPattern {
  type: CitationType
  jurisdiction?: string
  regex: RegExp
  example: string
  description: string
}

const PATTERNS: CitationPattern[] = [
  // US Federal
  { type: 'case', jurisdiction: 'US', regex: /(\d+)\s+U\.\s?S\.\s+(\d+)/g, example: '410 U.S. 113', description: 'US Reports' },
  { type: 'case', jurisdiction: 'US', regex: /(\d+)\s+F\.\s?(Supp\.\s?)?(\d+d?)\s+(\d+)/g, example: '987 F.3d 123', description: 'Federal Reporter' },
  { type: 'case', jurisdiction: 'US', regex: /(\d+)\s+F\.\s?Supp\.\s+(\d+)/g, example: '456 F. Supp. 3d 789', description: 'Federal Supplement' },
  { type: 'case', jurisdiction: 'US', regex: /(\d+)\s+S\.\s?Ct\.\s+(\d+)/g, example: '567 S. Ct. 890', description: 'Supreme Court Reporter' },
  { type: 'case', jurisdiction: 'US', regex: /(\d+)\s+L\.\s?Ed\.\s+(\d+)/g, example: '123 L. Ed. 2d 456', description: 'Lawyers Edition' },
  // US Statutes & Rules
  { type: 'statute', jurisdiction: 'US', regex: /(\d+)\s+U\.\s?S\.\s?C\.\s+§\s*(\d+[a-zA-Z]?)/g, example: '15 U.S.C. § 1', description: 'US Code' },
  { type: 'statute', jurisdiction: 'US', regex: /Fed\.\s?R\.\s?(Civ|Crim|App|Evid)\.\s+P\.\s+(\d+[a-zA-Z]?)/g, example: 'Fed. R. Civ. P. 12(b)(6)', description: 'Federal Rules' },
  { type: 'statute', jurisdiction: 'US', regex: /Pub\.\s?L\.\s+No\.\s+(\d+-\d+)/g, example: 'Pub. L. No. 117-328', description: 'Public Law' },
  // UK
  { type: 'case', jurisdiction: 'UK', regex: /\[(\d{4})\]\s+UK(?:SC|HL|PC)\s+(\d+)/g, example: '[2024] UKSC 1', description: 'UK Supreme Court' },
  { type: 'case', jurisdiction: 'UK', regex: /\[(\d{4})\]\s+EWCA\s+(Civ|Crim)\s+(\d+)/g, example: '[2023] EWCA Civ 1234', description: 'England and Wales Court of Appeal' },
  { type: 'case', jurisdiction: 'UK', regex: /\[(\d{4})\]\s+EWHC\s+(\d+)\s+\((KB|Ch|QB|Admin|Fam)\)/g, example: '[2024] EWHC 567 (KB)', description: 'England and Wales High Court' },
  { type: 'statute', jurisdiction: 'UK', regex: /([A-Z][a-zA-Z\s]+)\s+Act\s+(\d{4})/g, example: 'Senior Courts Act 1981', description: 'UK Act of Parliament' },
  // EU
  { type: 'case', jurisdiction: 'EU', regex: /ECLI:([A-Z]{2}):(\w+):(\d{4}):(\d+)/g, example: 'ECLI:EU:C:2024:123', description: 'ECLI Identifier' },
  { type: 'case', jurisdiction: 'EU', regex: /Case\s+C-(\d+)\/(\d+)/g, example: 'Case C-468/93', description: 'European Court of Justice' },
  // Australia
  { type: 'case', jurisdiction: 'AU', regex: /\((\d{4})\)\s+(\d+)\s+CLR\s+(\d+)/g, example: '(2023) 97 CLR 456', description: 'Commonwealth Law Reports' },
  { type: 'case', jurisdiction: 'AU', regex: /\((\d{4})\)\s+(\d+)\s+ALJR\s+(\d+)/g, example: '(2024) 98 ALJR 123', description: 'Australian Law Journal Reports' },
  { type: 'case', jurisdiction: 'AU', regex: /\[(\d{4})\]\s+FCAFC\s+(\d+)/g, example: '[2024] FCAFC 78', description: 'Federal Court of Australia Full Court' },
  // Canada
  { type: 'case', jurisdiction: 'CA', regex: /\[(\d{4})\]\s+(\d+)\s+S\.\s?C\.\s?R\.\s+(\d+)/g, example: '[2004] 3 S.C.R. 123', description: 'Supreme Court Reports' },
  { type: 'case', jurisdiction: 'CA', regex: /(\d+)\s+D\.\s?L\.\s?R\.\s+\((\d+[a-z]+)\)\s+(\d+)/g, example: '45 D.L.R. (4th) 678', description: 'Dominion Law Reports' },
  // Generic / fallback
  { type: 'case', regex: /([A-Z][a-zA-Z\.\s]+v\.\s*[A-Z][a-zA-Z\.\s,]+),\s+(\d+\s+[A-Z\.\s]+\d+)/g, example: 'Smith v. Jones, 410 U.S. 113', description: 'Generic case citation' },
]

export function normalizeCitation(raw: string): string {
  let s = raw.trim()
  s = s.replace(/[.,;:]+$/, '')
  s = s.replace(/\s+/g, ' ')
  s = s.replace(/[\*_#]+/g, '')
  return s
}

export function extractCitations(text: string): Array<{
  citation: VerifiableCitation
  context: string
  charStart: number
  charEnd: number
}> {
  const results: Array<{ citation: VerifiableCitation; context: string; charStart: number; charEnd: number }> = []
  const usedRanges: Array<[number, number]> = []

  for (const pattern of PATTERNS) {
    const regex = new RegExp(pattern.regex.source, pattern.regex.flags)
    let match: RegExpExecArray | null
    while ((match = regex.exec(text)) !== null) {
      const start = match.index
      const end = start + match[0].length

      const overlaps = usedRanges.some(([uStart, uEnd]) => start < uEnd && end > uStart)
      if (overlaps) continue

      usedRanges.push([start, end])
      const contextStart = Math.max(0, start - 200)
      const contextEnd = Math.min(text.length, end + 200)

      const normalized = normalizeCitation(match[0])
      if (!normalized) continue

      results.push({
        citation: {
          raw_text: match[0],
          normalized_text: normalized,
          type: pattern.type,
          jurisdiction: pattern.jurisdiction,
          components: extractComponents(pattern, match),
          context: text.slice(contextStart, contextEnd),
        },
        context: text.slice(contextStart, contextEnd),
        charStart: start,
        charEnd: end,
      })
    }
  }

  return results
}

function extractComponents(pattern: CitationPattern, match: RegExpExecArray): Record<string, string> | undefined {
  const groups: Record<string, string> = {}
  if (pattern.type === 'case' && pattern.jurisdiction === 'US') {
    if (match.length >= 3) {
      groups['volume'] = match[1]
      groups['reporter'] = match[2]
      groups['page'] = match[match.length - 1]
    }
  }
  if (pattern.jurisdiction === 'UK') {
    if (match.length >= 3) {
      groups['year'] = match[1]
      groups['number'] = match[match.length - 1]
    }
  }
  return Object.keys(groups).length > 0 ? groups : undefined
}

export function getSupportedFormats(): Array<{ type: string; jurisdiction?: string; example: string; description: string }> {
  return PATTERNS.map(p => ({
    type: p.type,
    jurisdiction: p.jurisdiction,
    example: p.example,
    description: p.description,
  }))
}

export function hasCitationPatterns(text: string): boolean {
  return PATTERNS.some(p => {
    const regex = new RegExp(p.regex.source, p.regex.flags)
    return regex.test(text)
  })
}
