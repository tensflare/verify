# LegalVerify — Coverage Map

Sources, jurisdictions, and limitations of citation verification.

## Primary Source: CourtListener

| Property | Value |
|----------|-------|
| **Source** | CourtListener (Free Law Project) |
| **API** | `courtlistener.com/api/rest/v3/opinions/` |
| **Jurisdictions** | US federal + all 50 states (see below) |
| **Date range** | 1754-01-01 — present |
| **Update frequency** | Daily |
| **Confidence** | 95% |
| **Rate limit** | 2 req/s (free), 10 req/s (authenticated) |
| **Coverage type** | Partial |

### Included States

AL, AK, AZ, AR, CA, CO, CT, DE, FL, GA, HI, ID, IL, IN, IA, KS, KY, LA, ME, MD, MA, MI, MN, MS, MO, MT, NE, NV, NH, NJ, NM, NY, NC, ND, OH, OK, OR, PA, RI, SC, SD, TN, TX, UT, VT, VA, WA, WV, WI, WY

### Known Gaps

- Not all state trial courts are covered
- Some state appellate decisions may be missing
- Unpublished opinions are generally not included
- Tribal courts are not covered
- Territorial courts (PR, GU, VI) are not covered

## Secondary Source: Harvard Caselaw Access Project

| Property | Value |
|----------|-------|
| **Source** | Harvard Law School Caselaw Access Project |
| **API** | `api.case.law/v1/cases/` |
| **Jurisdictions** | US federal + all 50 states |
| **Date range** | 1658-01-01 — 2018-06-30 |
| **Update frequency** | Static (project concluded) |
| **Confidence** | 98% |
| **Rate limit** | 5 req/s |
| **Coverage type** | Partial |

### Known Gaps

- No cases after June 2018
- Not all state volumes were completed before project end
- Some OCR quality issues in early (pre-1800) volumes
- Some volumes require authentication for full access

## Fallback Source: Google Scholar

| Property | Value |
|----------|-------|
| **Source** | Google Scholar |
| **Access** | Web scraping (no official API) |
| **Jurisdictions** | US, AU, CA, UK |
| **Date range** | 1754-01-01 — present |
| **Update frequency** | Variable |
| **Confidence** | 70% |
| **Rate limit** | ~0.5 req/s (fallback only) |
| **Coverage type** | Limited |

### Known Gaps

- No official API — web scraping is fragile and may break
- Coverage is uneven across jurisdictions
- No good-law / treatment information
- May be blocked by rate limiting or IP restrictions
- Should be treated as a last-resort fallback only

## Optional Source: Local Corpus

| Property | Value |
|----------|-------|
| **Source** | User-provided document corpus via `@docfide/duct` |
| **Jurisdictions** | User-defined |
| **Coverage type** | User-defined |
| **Confidence** | 85% (depends on corpus quality) |
| **Requirements** | `LEGALVERIFY_CORPUS_PATH` env var or `--corpus` flag |

Configure via:

```
legalverify verify --corpus ./path/to/corpus document.txt
```

## International Coverage (Phase 2)

The following sources are planned for Phase 2:

| Jurisdiction | Source | Status |
|-------------|--------|--------|
| UK | BAILII | Planned |
| Australia | AustLII | Planned |
| Canada | CanLII | Planned |
| European Union | EUR-Lex | Planned |
| Germany | DeGruyter / openJur | Research |
| France | Légifrance | Research |

## How Coverage Works

When a citation falls within a source's jurisdiction and date range, it is:

- **Covered** by that source
- Verified against that source's data
- Reported as `verified` or `hallucinated` based on whether it was found

When a citation falls **outside** all configured source coverage:

- It is reported as `unverifiable`
- It is **never** reported as `verified`
- The user is directed to manual verification

This prevents false positives from citations in uncovered jurisdictions.

## Display

Run `legalverify coverage` to display the coverage map in the CLI.

The coverage map is also included in every verification report as `coverage_summary`.
