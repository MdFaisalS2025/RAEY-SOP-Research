# Corpus manifest

Every source document that feeds into a reported result in
`PREREGISTRATION.md` / `FEASIBILITY.md`, with retrieval provenance and a
SHA-256 hash of the exact file used. Source PDFs/XML are **not bundled**
in this artifact (redistribution/size discipline already followed
throughout this project — see `FEASIBILITY.md`'s retrieval sections);
re-download from the URL given and verify against the hash before
re-running anything.

This project's broader retrieval history explored roughly 40 publishers
beyond what is listed here (see `FEASIBILITY.md`'s narrative sections for
the full account of what was tried and why most were rejected — failed
parsing, dev-only, or superseded by a cleaner pair). This manifest lists
only the documents that feed a result actually reported in the frozen
governance documents, to keep the reproducibility package tractable.

**Provenance confidence**: entries marked ✅ have an exact download URL
confirmed within this project's own session logs. Entries marked ⚠️ were
retrieved in an earlier phase of this project whose exact literal
download URL was not preserved in a form this artifact could verify
directly — the publisher domain, edition label, and retrieval date are
recorded as logged in `FEASIBILITY.md`, and the document is
re-locatable from the publisher's own archive using that label. This
distinction is stated plainly rather than presenting a reconstructed
URL as confirmed when it was not independently re-verified.

---

## Confirmatory corpus (main study, §43/§44)

| File | Publisher / edition | Retrieval | SHA-256 | Size |
|---|---|---|---|---|
| `tn_2017.pdf` | Tennessee EMS, "Rev 11.7.2017" | ⚠️ `tn.gov`, retrieved in an earlier session phase — see `FEASIBILITY.md` §24 | `3903aa892c64613cd9d4fa7757659aec45293698f42ffbfa7b08b2b79eaabf8e` | 3,547,834 B |
| `tn_2018.pdf` | Tennessee EMS, "Rev 7.7.18" | ⚠️ `tn.gov`, retrieved in an earlier session phase — see `FEASIBILITY.md` §24 | `c42b950053ffc4a6a743e169aa0b6e0e60479fc2c075f672e1d1cf1ab77a4630` | 10,672,905 B |
| `pa_2021_als.pdf` | Pennsylvania Statewide ALS Protocols, "2021 FINAL 9-1-21" | ⚠️ `pa.gov`, retrieved in an earlier session phase — see `FEASIBILITY.md` §28 | `732d667bfc9e3acbf0ae5b3a12039a42c8ddc506bdc92c654a6e67ed5715b097` | 2,772,559 B |
| `pa_2023_als.pdf` | Pennsylvania Statewide ALS Protocols, "2023v1-2" | ✅ `https://www.pa.gov/content/dam/copapwp-pagov/en/health/documents/topics/documents/ems/2023v1-2%20PA%20ALS%20Protocols.pdf` | `b7c9f67fc3457b5cc4108c6347d15aabd5fcefb6262b58407974f89dde5ee744` | 3,031,930 B |
| `ct_v20221.pdf` | Connecticut Statewide EMS Protocols v2022.1 | ⚠️ `portal.ct.gov`, retrieved in an earlier session phase — see `FEASIBILITY.md` §42 | `b09e75cd9cc89c412ff512fae1e5a6b7f1a82d5f47f3b5bbd5f87e55602488b6` | 11,069,823 B |
| `ct_v20231.pdf` | Connecticut Statewide EMS Protocols v2023.1 | ✅ `https://portal.ct.gov/dph/-/media/departments-and-agencies/dph/dph/ems/pdf/statewide_protocols/2023/v20231_ctemsstatewideprotocols_finaldec2023rev.pdf` | `983c1a1c142123ef3fc6b1089911ef99bf0be90b9e688a01ccb7863224df979f` | 12,165,025 B |
| `ct_v20241.pdf` | Connecticut Statewide EMS Protocols v2024.1 | ✅ `https://portal.ct.gov/-/media/departments-and-agencies/dph/dph/ems/pdf/statewide_protocols/2024/v20241_ctemsstatewideprotocolsfinalmarch2024.pdf` | `56ec25de99a28b771a6aa83fd359f0ce40762008f0e4776a705c5ee0eda40081` | 12,127,731 B |

**Pairs formed from the above** (§43): Tennessee 2017→2018 (minor),
Pennsylvania 2021→2023 (minor), Connecticut v2022.1→v2023.1 (minor),
Connecticut v2023.1→v2024.1 (minor). Revision-magnitude classification
method: `PREREGISTRATION.md` §3.3 (publisher's own front-matter language,
not measured change).

## H3′ follow-up fresh pair (§ H3′ pre-commitment entries)

| File | Publisher / edition | Retrieval | SHA-256 | Size |
|---|---|---|---|---|
| `tn_2022_23.pdf` | Tennessee EMS, "2022-23" | ✅ `https://www.tn.gov/content/dam/tn/health/events/TN%20State%20Protocal%20Guidelines%2022-23.pdf` | `0d9be651431afdbae5a89c8b8f129309209894041982ed1fd51be7263e16fdf5` | 3,263,094 B |
| `tn_sept2024.pdf` | Tennessee EMS, "Sept2024" / "2024-2025" | ✅ `https://www.tn.gov/content/dam/tn/health/events/TN%20State%20Protocol%20Guidelines%20%20Sept24.pdf` | `80583d0fc0fe541c164cb296410e9e5aa57cded8386da196f7f0fe49a85f193c` | 2,636,769 B |

Selected as the fresh, previously-unretrieved Tennessee pair after
confirming Connecticut and Pennsylvania had no untouched editions
available (both confirmed exhausted — see the H3′ pre-commitment entry
in `PREREGISTRATION.md`).

## Candidate corpus (§79, exploratory — NOT yet used in any confirmatory claim)

Retrieved during a corpus-expansion search (FEASIBILITY.md §78-79).
Both new pairs are structurally promising (Tennessee 94.6% trivially
alignable, Connecticut 88.6%) but have NOT cleared the checks §79.2/§79.3
list as required before promotion to confirmatory status — listed here
for provenance/reproducibility only.

| File | Publisher / edition | Retrieval | SHA-256 | Size |
|---|---|---|---|---|
| `tn_20250911.pdf` | Tennessee EMS, "2024-2025, 09.11.2025" | ✅ `https://www.tn.gov/content/dam/tn/health/events/TN%20State%20Guidelines%202024-2025%2009.11.2025.pdf` | `05d1fd871daa557d3630c50ed67284a45d6ee324074523af20efe4a36cc6a8c5` | 3,563,269 B |
| `ct_v20251.pdf` | Connecticut Statewide EMS Protocols v2025.1 | ✅ `https://portal.ct.gov/dph/-/media/departments-and-agencies/dph/dph/ems/pdf/statewide_protocols/2025/v20251_ctemsstatewideprotocolsfinal.pdf` | `a84b9b305124618d1ea1ac1e9d401063d57ba62fdffd75b3b1cc85b34007099b` | 16,723,878 B |
| `ct_v20252.pdf` | Connecticut Statewide EMS Protocols v2025.2 | ✅ `https://portal.ct.gov/dph/-/media/departments-and-agencies/dph/dph/ems/pdf/statewide_protocols/2025/v2025-2_ctemsstatewideprotocolsfinalver1.pdf` | `06bb46ac6fd6a425da4a52165c9b950c75908b47e20c1b3a9c72a471852af10e` | 16,698,858 B |
| `ri_2026_02.pdf` | Rhode Island Statewide EMS, v2026.02 (rejected — boundary omission, §78) | ✅ `https://health.ri.gov/sites/g/files/xkgbur1006/files/2026-02/StatewideEmergencyMedicalServices.pdf` | `b59cce67fb7057a27060e3b8aedeff0f7389571139c30abce65e79e3d996daae` | 6,275,955 B |
| `vt_2025_new.pdf` | Vermont Statewide EMS Protocols, 2025 (rejected — boundary omission, §78) | ✅ `https://www.healthvermont.gov/sites/default/files/document/eprip-2025-EMS-Protocols_0.pdf` | `33aa4e7abd3d5e3663b2485d5513950f8374304dca469ac3acb48ee7b9e15051` | 16,770,370 B |

| `ne_2024_new.pdf` | Nebraska EMS Model Protocols, "completely revised" 2024 edition (Last Revised 5/2026) — genuine major-revision language, does NOT parse cleanly, §80.1 | ✅ `https://dhhs.ne.gov/OEHS%20Program%20Documents/EMS%20Model%20Protocols.pdf` | `8d36ea3d4a1088202504198a82ac1eac09acccf32a4f00483054b9181f5ac839` | 7,831,906 B |
| `ne_2020_prior.pdf` | Nebraska EMS Protocols, 2020 edition (pre-revision, for comparison) | ✅ `http://govdocs.nebraska.gov/epubs/H8355/H004-2020.pdf` | `0b3b38673369d6aa40fd39349e43e7985ff287caa33c2163aa4c9021f8a703a3` | 6,033,775 B |

## Dev corpus (§2, exploratory only — never used in any confirmatory claim)

| File | Publisher / edition | Retrieval | SHA-256 | Size |
|---|---|---|---|---|
| `nasemso_v2_2017.pdf` | NASEMSO National Model EMS Clinical Guidelines v2.0 (Oct 2017) | ⚠️ Baylor College of Medicine mirror / Wayback CDX — see `FEASIBILITY.md` §2 | `92feef2d28e6b2ee487af388c6234c4d48751ad87ca9f6a3bc0c0d616be13578` | 4,481,159 B |
| `nasemso_v22_2019.pdf` | NASEMSO v2.2 (Jan 2019) | ⚠️ same as above | `7af1455911bd71a540c606fd5e194e717660029eda20882d93dbb2da2e467b09` | 3,401,734 B |
| `nasemso_v3_2022.pdf` | NASEMSO v3.0 (Mar 2022) | ⚠️ Wayback (`Content-Length: 5,040,475` confirmed at registration — see `PREREGISTRATION.md` header) | `71a0b4bb665743cdb09968ea053c193bca80824ca5b01c605674ac46b8343eb6` | 5,040,475 B |

## Second-domain corpus (§63, US Code Title 18)

| File | Release point | Retrieval | SHA-256 | Size |
|---|---|---|---|---|
| `uscode/117-81/usc18.xml` | Title 18, current through Public Law 117-81 (2021) | ✅ `https://uscode.house.gov/download/releasepoints/us/pl/117/81/xml_usc18@117-81.zip` | `9c24c851547792ed97f9b8b09ae07a27e9e0a8ffc9638e7ff8a771d0ac7ebdc7` | 11,778,916 B (extracted XML) |
| `uscode/118-158/usc18.xml` | Title 18, current through Public Law 118-158 (2024) | ✅ `https://uscode.house.gov/download/releasepoints/us/pl/118/158/xml_usc18@118-158.zip` | `f63f604bed0c6c7042b24d0fe79b9152e922d1054287c8c4df7cfd01f12e6f04` | 12,031,542 B (extracted XML) |

Both release points independently confirmed (via `uscode.house.gov`'s own
release-point listing) to have actually amended Title 18 before either
was downloaded — see the HC1–HC3 pre-commitment entry in
`PREREGISTRATION.md`. Official GPO/OLRC USLM XML, public domain (US
government work).

## Boundary-annotation task (§ Workstream A, in progress)

Uses `tn_2017.pdf`, `tn_2018.pdf`, `tn_2022_23.pdf`, and
`tn_sept2024.pdf` (already listed above) — no additional documents.

---

## Reproducing from this manifest

1. Download each file from its listed URL (⚠️ entries: locate via the
   publisher's own current archive using the edition label given).
2. Verify: `sha256sum <file>` and compare against the hash above. A
   mismatch means the publisher has since replaced the file at that URL
   (state governments do this) — the result computed against the
   original bytes is what `code/app/research/cross_edition/*.py` and the
   frozen `d3068ee` pipeline actually saw, not necessarily whatever
   currently lives at the URL.
3. Place files at the paths each script's `SP` constant expects. In the
   live working tree (not this artifact) `SP` resolves to
   `<repo root>/corpus/protocols` (protocol PDFs) and
   `<repo root>/corpus/uscode` (US Code release-point XML) — a stable,
   git-ignored, repo-local directory (see `.gitignore`), chosen
   2026-08-22 after the corpus was found living in a session-scoped
   temp path (`AppData\Local\Temp\claude\...\scratchpad\protocols`) one
   cleanup away from unreproducible. Adjust each script's `SP` constant
   if placing the corpus elsewhere.
