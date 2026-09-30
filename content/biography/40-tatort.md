---
title: "Respeak, the Tatort game"
subtitle: "2023 · 18,000 concurrent players"
order: 40
location: "Berlin"
kind: "work"
accent: "#ff6b6b"
side: "auto"
setPiece: ["lattice", "threadBoard"]
setPieceVariant: "embeddings"
---

## Tatort

In 2023 I moved back to Berlin and joined **Respeak**. My first big project was
the SWR *Tatort* game, a chat-based game that had to be ready for 100,000
concurrent players. Getting it there was my job: moving it to Azure, choosing and
deploying the sentence-embedding models on Azure ML, refactoring the Flask
backend to cut redundant SQL queries and add caching, and setting up load
balancing. It had 18,000 concurrent players at launch. We were a team of five.
