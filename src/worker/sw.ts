/// <reference lib="webworker" />

// src/worker/sw.ts - the entry of sw.js: the offline shell (src/worker/shell.ts) and the card a
// push leaves on the screen (src/worker/push.ts). `vite.config.ts` compiles the three files into
// this one name beside the document; nothing else runs them.

import { root } from "./address";
import {
  askPages,
  openedCard,
  pageOpened,
  readNotice,
  said,
  visit,
  type Words,
} from "./push";
import { dropRetired, precache, respond } from "./shell";

declare const self: ServiceWorkerGlobalScope & typeof globalThis;

self.addEventListener("install", (event) => {
  event.waitUntil(
    precache()
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(dropRetired().then(() => self.clients.claim()));
});

self.addEventListener("fetch", (event) => {
  const answer = respond(event.request);
  if (answer) event.respondWith(answer);
});

self.addEventListener("push", (event) => {
  const words = said(event.data);
  // A card with no title and no body has nothing to show.
  if (!words.title && !words.body) return;
  event.waitUntil(openedCard(words));
});

// A card the reader closed stands for no notification, so the number comes down with it.
self.addEventListener("notificationclose", (event) => {
  event.waitUntil(readNotice(event.notification));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data as Words | undefined)?.url ?? root;
  // The click carries the tag, so the number comes off here.
  event.waitUntil(readNotice(event.notification).then(() => visit(target)));
});

self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(askPages());
});

// The page sends this when it opens (src/stores/pushStore.ts): the cards go, and the number goes
// with them, whatever the tally holds.
self.addEventListener("message", (event) => {
  if ((event.data as { type?: string } | null)?.type !== "push:seen") return;
  event.waitUntil(pageOpened());
});
