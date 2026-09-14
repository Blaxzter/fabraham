---
title: "Respeak — the Tatort game"
subtitle: "2023 · 18,000 concurrent players"
order: 40
location: "Berlin"
accent: "#ff6b6b"
side: "auto"
setPiece: ["lattice", "threadBoard"]
setPieceVariant: "embeddings"
---

## Tatort, at scale

Back in Berlin at **Respeak**: a chat-based game tied to the TV series *Tatort*,
written **before ChatGPT** and contracted to hold **100k concurrent** players. I
owned the scaling work — an **Azure migration**, **sentence-embedding models on
Azure ML**, a Flask refactor that cut redundant SQL and added caching, and load
balancing in front of it. It went live at **18,000 concurrent**, built by a team
of five.
