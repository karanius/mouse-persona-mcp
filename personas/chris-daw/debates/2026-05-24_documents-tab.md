# Interview: What Should the Documents Tab Show?

**Date:** 2026-05-24
**Participants:** Chris Daw (RCIC) + Claude

## Key Decision: Cross-Client Document Dashboard

Cases = per client. Documents = across ALL clients. "How many police clearances are outstanding across my practice?"

## Layout
1. Summary bar: total, missing, expiring (30 days), pending review
2. Filterable table: document, client, type, status, expiry, updated
3. Activity feed: uploads, status changes, expiry alerts

## Status Lifecycle
Not Requested → Requested → Received → Verified → Expired

## Chris's War Story
Police clearance expired during IRCC processing. Nobody noticed for 6 weeks. Procedural fairness letter. Almost lost the case. Expiry tracking is the killer feature.

## The Hook
Sidebar badge number = missing + expiring + pending review. If zero, skip. If not, open first.

## 15+ Document Types
Passport, language test (IELTS/TEF), ECA, police clearance, photos, proof of funds, employment letters, birth cert, marriage cert, medical exam, LMIA app, job offer, relationship proof, sponsor income, acceptance letter.
