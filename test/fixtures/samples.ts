/** Sample texts with realistic legal citations for testing */

export const US_FEDERAL_SAMPLE = `The Supreme Court's decision in Roe v. Wade, 410 U.S. 113 (1973) established that the Constitution protects a woman's right to choose. This was reaffirmed in Planned Parenthood v. Casey, 505 U.S. 833 (1992). However, the Court later held in Dobbs v. Jackson Women's Health Organization, 597 U.S. 215 (2022) that the Constitution does not confer a right to abortion.

In reaching this conclusion, the Court relied on the Commerce Clause, U.S. Const. art. I, § 8, cl. 3. See also Gonzales v. Raich, 545 U.S. 1 (2005). The Sherman Act, 15 U.S.C. § 1 prohibits restraint of trade.

The Federal Rules of Civil Procedure, Fed. R. Civ. P. 12(b)(6) govern motions to dismiss. See Bell Atlantic Corp. v. Twombly, 550 U.S. 544 (2007) and Ashcroft v. Iqbal, 556 U.S. 662 (2009).`

export const UK_SAMPLE = `The Supreme Court held in R v. Jogee [2016] UKSC 8 that the doctrine of joint enterprise had been developed incorrectly. This decision was followed by the Court of Appeal in R v. Johnson [2023] EWCA Crim 456.

The High Court considered the matter in Smith v. Jones [2024] EWHC 567 (KB). The applicable statute is the Senior Courts Act 1981.

See also the Human Rights Act 1998, which incorporates the European Convention on Human Rights into UK law.`

export const EU_SAMPLE = `The European Court of Justice held in Case C-468/93 that the freedom to provide services under Article 56 TFEU applies directly. See also ECLI:EU:C:2024:123 for a more recent application.`

export const AU_SAMPLE = `The High Court of Australia held in Plaintiff S157/2002 v Commonwealth (2003) 211 CLR 476. See also (2023) 97 CLR 456 and (2024) 98 ALJR 123.

The Full Federal Court considered this issue in [2024] FCAFC 78.`

export const CA_SAMPLE = `The Supreme Court of Canada held this in [2004] 3 S.C.R. 123. See also 45 D.L.R. (4th) 678.`

export const MIXED_JURISDICTION_SAMPLE = `The US Supreme Court held in Miranda v. Arizona, 384 U.S. 436 (1966) that suspects must be informed of their rights. The UK Supreme Court considered a similar issue in R v. Ibrahim [2008] UKHL 3.

The European Court of Justice applied different standards in Case C-468/93.

The Australian position is stated in (2023) 97 CLR 456 and the Canadian approach is outlined in [2004] 3 S.C.R. 123.

Federal Rules of Civil Procedure, Fed. R. Civ. P. 26 govern discovery.`

export const NO_CITATIONS_SAMPLE = `This is a plain text that contains no legal citations whatsoever. It is purely for testing purposes to ensure that the system returns zero citations when none are present.

There are no case names, statute references, or regulatory citations included in this paragraph.`

export const MALFORMED_CITATIONS_SAMPLE = `This case, 123 U, 456 was cited incorrectly. See also 410 U.S and the case of 597 US.

Some citations are partially formed like Fed. R. Civ. and others have extra characters like *410 U.S. 113**.

The court said in 123 v. 456 that...`

export const LONG_TEXT_SAMPLE = `The Court held that precedent governs. ` + 'See Roe v. Wade, 410 U.S. 113 (1973). This was followed in various cases. '.repeat(500)

export const UNICODE_SAMPLE = `The Court held in a case, 410 U.S. 113 (1973), that the Constitution protects 隐私 (privacy). The plaintiff argued that art. 8 CEDH (Convention européenne des droits de l'homme) applies.🌟

The decision relies on Fed. R. Civ. P. 12(b)(6) and 15 U.S.C. § 1.`

export const DUPLICATE_CITATIONS_SAMPLE = `The Court held in Roe v. Wade, 410 U.S. 113 that... This is significant because Roe v. Wade, 410 U.S. 113 established the constitutional right. See also Roe v. Wade, 410 U.S. 113.

The case of Roe v. Wade, 410 U.S. 113 was cited three times in this document.`

export const VARYING_CONFIDENCE_SAMPLE = `The Court relied on Roe v. Wade, 410 U.S. 113 (1973). The contract dispute was governed by U.C.C. § 2-207. The parties agreed to Fed. R. Civ. P. 12(b)(6) jurisdiction.

Prosser on Torts § 1 discusses the standard. The regulation at 12 C.F.R. § 1026.1 applies.`
