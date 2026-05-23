# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Mutual Fund Screener (MFSelect)** — An Indian Mutual Funds Discovery and Selection Platform.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js (React) |
| Backend | Python FastAPI |
| Database | AWS RDS Postgres |

## Implementation Plan

### Phase 1 — Login Module
- Needs to support only 1 user for now, using a local maintained user name and password.

### Phase 2 — Mutual Fund Details Module
- Use the authoritative free websites and APIs available to download the details of all the Mutual Fund Schemes available within India. 
- The details must include Fund House (e.g.- Aditya Birla Sun Life Mutual Fund), Scheme Type (e.g.- Open Ended or Close Ended), Scheme Category (e.g.- Debt Scheme - Banking and PSU Fund), Scheme Code (e.g.- 119551) Date, NAV (Net Asset Value)

### Phase 3 — Mutual Fund Screener Module
- Calculate Day wise 1 Year, 3 Year, 5 Year Rolling Returns and 1 Year, 3 Year, 5 Year Standard Deviations for each scheme.
- Calculate the Minimum, Maximum and Average of 1 Year, 3 Year, 5 Year Rolling Returns and 1 Year, 3 Year, 5 Year Standard Deviations for each scheme.

### Phase 4 — Mutual Fund Watchlist Module
- Introduce the ability to save any Mutual Fund Schemes to a Watchlist
