export const SCOPE_NOTICE = `
LEGAL VERIFY — SCOPE NOTICE
═══════════════════════════════════════════════════════

LegalVerify v0.2 verifies citation existence — it checks whether a
cited case, statute, or regulation actually exists in published legal
sources. It does NOT verify proposition accuracy (whether the cited
source actually says what the AI claims it says).

Proposition accuracy verification is an active research problem and is
not yet available in any production tool. Attorneys remain independently
responsible for reviewing cited authorities for proposition accuracy.

This tool satisfies the citation existence verification workflow
requirement of NY Part 161 and similar regulations. It does not replace
independent legal research using Westlaw, Lexis, or other authoritative
citators.

Coverage limitations by source and jurisdiction are documented at:
  github.com/tensflare/verify/COVERAGE.md

Full scope documentation:
  github.com/tensflare/verify/SCOPE.md

═══════════════════════════════════════════════════════
`

export const SCOPE_SHORT = 'LegalVerify v0.2 verifies citation existence (does this source exist?). It does not verify proposition accuracy (does this source say what was claimed?). Attorneys remain responsible for independent proposition review.'

export function formatScopeNotice(): string {
  return SCOPE_NOTICE.trim()
}
