# AuraStack Fraud Demo Pack

This folder contains demo-ready fraud material for **Insurance** and **Banking**.

## What is included

- `fraud-cases-demo.json`
  - Mixed genuine/fraud cases for demo walkthroughs.
  - Includes signal fields that drive fraud scoring.
- `sample-documents.json`
  - Mock claim, invoice, KYC, statement, and alert documents.
  - Mapped by `caseCode`.

## Live API endpoints

Run from `apps/api` server (port `8000` by default):

- `GET /fraud/system/taxonomy`
- `GET /fraud/system/demo-cases`
- `GET /fraud/system/demo-cases/:caseId`
- `POST /fraud/system/detect`
- `POST /fraud/system/demo-run`

## Demo script (quick)

1. Show taxonomy and fraud patterns.
2. Open one insurance fraud case and one banking fraud case.
3. Run `POST /fraud/system/demo-run` to show aggregate flagged/blocked counts.
4. Open `sample-documents.json` and explain evidence-to-signal mapping.

