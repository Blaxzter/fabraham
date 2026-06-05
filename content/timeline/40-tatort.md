---
title: "Respeak — the Tatort game, at scale"
subtitle: "2023 · 18,000 concurrent players, team of 5"
order: 40
location: "Berlin"
weight: 1
setPiece: ["lattice"]
setPieceVariant: "embeddings"
accent: "#ff6b6b"
cameraPosition: [-0.3, -0.1, 0.7]
cameraRotation: [0.1, -0.18, 0.02]
---

## Respeak — the Tatort game, at scale

Back in Berlin at **Respeak**, a chat-based game tied to the TV crime series
*Tatort* — built **before ChatGPT** and contracted to survive **100,000
concurrent players**. I owned scale: an **Azure migration**, **sentence-embedding
models on Azure ML** to understand player messages, a **Flask backend refactor**
that cut redundant SQL and added request caching, and load balancing across the
fleet.

It launched to **18,000 concurrent players** with a team of five. The GAN lattice
became an embedding space — the same motif, now measuring meaning instead of
generating it.
