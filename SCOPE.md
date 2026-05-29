# LegalVerify — Scope of Verification

## Summary

LegalVerify verifies **citation existence** — it checks whether a cited case, statute, or regulation actually exists in published legal sources.

LegalVerify does **not** verify **proposition accuracy** — whether the cited source actually says what the AI (or attorney) claims it says.

## What "Verified" Means

When LegalVerify reports a citation as `verified`, it means:

1. The citation text matches a known published source in one or more of:
   - CourtListener database (US federal + state opinions)
   - Harvard Caselaw Access Project (US case law through June 2018)
   - Google Scholar (US, AU, CA, UK — as web-scraped fallback)
   - A user-provided local corpus
2. The source was locatable at the time of verification
3. The citation has a retrievable URL or document identifier

It does **not** mean:

- The cited source says what the AI claimed it says
- The citation is accurately characterized
- The proposition attributed to the source is correct
- The source is still "good law" (though good-law checking is in development)

## What "Hallucinated" Means

When LegalVerify reports a citation as `hallucinated`, it means:

1. The citation text was parsed from the document
2. The citation falls within one or more source coverage areas
3. **None** of the applicable sources could find a matching published source

A `hallucinated` citation should be treated as likely fabricated.

## What "Unverifiable" Means

When LegalVerify reports a citation as `unverifiable`, it means:

1. The citation text was parsed from the document
2. The citation falls **outside** the coverage of all configured sources
3. No determination about existence or hallucination can be made

A citation marked `unverifiable` is **not** necessarily hallucinated — it may be a real citation in an uncovered jurisdiction or source. The user should verify it manually.

## Coverage Map

The coverage map is a machine-readable declaration of which sources, jurisdictions, date ranges, and citation types LegalVerify can check. It is displayed by running `legalverify coverage` and is included in every verification report.

Citations that fall outside the coverage map are marked `unverifiable`. They are **never** marked `verified`.

## Proposition Accuracy Gap

**No production tool today can verify proposition accuracy.** This is an active research area with no reliable solutions. Key challenges include:

- Legal reasoning is highly context-dependent
- Same citation can support different propositions
- Judicial interpretation evolves over time
- AI-generated proposition summaries are often subtly wrong

**Attorneys remain independently responsible** for reading cited authorities and verifying that the propositions attributed to them are accurate.

## Regulatory Compliance

### NY Part 161 (effective June 1, 2026)

New York Rules of the Chief Administrative Judge Part 161 require:

- Disclosure of AI use in court filings
- Citation verification
- Attorney certification of accuracy

LegalVerify satisfies the **citation verification workflow** requirement. It does **not** satisfy the **proposition accuracy** or **attorney certification** requirements.

### Other Jurisdictions

LegalVerify's compliance engine is jurisdiction-extensible via pluggable `ComplianceRuleSet` modules. Additional jurisdictions can be added without core changes.

## Liability

LegalVerify is provided under the Apache 2.0 license with **no warranties**, express or implied. Verification results are informational only and do not constitute legal advice. Users should consult qualified attorneys for legal determinations.

## See Also

- [COVERAGE.md](COVERAGE.md) — Detailed source coverage declarations
- [README.md](README.md) — Quick start and usage
- `legalverify coverage` — Display coverage map in CLI
