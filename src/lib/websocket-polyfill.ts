// @supabase/supabase-js istanzia sempre un RealtimeClient, che richiede un
// WebSocket globale nativo (disponibile solo da Node 22+). I runtime Node
// di Netlify Functions/Next possono essere più vecchi, causando "Node.js
// detected but native WebSocket not found" anche se non usiamo mai Realtime.
import { WebSocket } from "ws";

if (!globalThis.WebSocket) {
  (globalThis as unknown as { WebSocket: typeof WebSocket }).WebSocket = WebSocket;
}
