import { useState, useCallback, useRef } from "react";
import { Capacitor } from "@capacitor/core";
import { SpeechRecognition } from "@capacitor-community/speech-recognition";

export function useSpeechRecognition() {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);

  const startListening = useCallback(async () => {
    // =========================
    // 🌐 WEB (DESKTOP)
    // =========================
    if (Capacitor.getPlatform() === "web") {
      const WebSpeechRecognition =
        (window as any).SpeechRecognition ||
        (window as any).webkitSpeechRecognition;

      if (!WebSpeechRecognition) {
        setError("Speech recognition is not supported in this browser.");
        return;
      }

      if (recognitionRef.current && isListening) {
        recognitionRef.current.stop();
        return;
      }

      // Pre-check for microphone access / OS-level blocks
      try {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          // Stop tracks immediately, we just needed to verify permission/hardware
          stream.getTracks().forEach(track => track.stop());
        }
      } catch (mediaErr: any) {
        if (mediaErr.name === 'NotFoundError' || mediaErr.name === 'DevicesNotFoundError') {
          setError("No microphone detected on this device.");
          return;
        }
        if (mediaErr.name === 'NotAllowedError' || mediaErr.name === 'SecurityError') {
          setError("Microphone blocked. Check Windows Settings -> Privacy -> Microphone.");
          return;
        }
        setError(`Microphone access error: ${mediaErr.message}`);
        return;
      }

      setError(null);

      const recognition = new WebSpeechRecognition();
      recognitionRef.current = recognition;

      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = "en-US";

      recognition.onstart = () => setIsListening(true);

      recognition.onend = () => {
        setIsListening(false);
        recognitionRef.current = null;
      };

      recognition.onerror = (event: any) => {
        console.error("Web Speech Error:", event);
        setError(event.error);
      };

      recognition.onresult = (event: any) => {
        const text = event.results[0][0].transcript;
        setTranscript(text);
      };

      recognition.start();
      return;
    }

    // =========================
    // 📱 MOBILE (CAPACITOR)
    // =========================
    try {
      // Toggle stop
      if (isListening) {
        await SpeechRecognition.stop();
        setIsListening(false);
        return;
      }

      setError(null);

      // ✅ Permissions
      const permissions = await SpeechRecognition.checkPermissions();
      if (permissions.speechRecognition !== "granted") {
        const req = await SpeechRecognition.requestPermissions();
        if (req.speechRecognition !== "granted") {
          setError("Microphone permission denied.");
          return;
        }
      }

      // ✅ Clean old listeners BEFORE adding new
      (SpeechRecognition as any).removeAllListeners();

      // ✅ Start recognition
      await SpeechRecognition.start({
        language: "en-US",
        maxResults: 1,
        prompt: "Speak to add to your diary",
        partialResults: false, // change to true if you want live typing
        popup: true,
      });

      setIsListening(true);

      // ✅ FINAL RESULT (THIS WAS YOUR BUG)
      (SpeechRecognition as any).addListener("results", (data: any) => {
        console.log("Final Result:", data);

        if (data?.matches?.length > 0) {
          setTranscript(data.matches[0]);
        }

        setIsListening(false);
      });

      // 🔁 OPTIONAL: LIVE TYPING (enable if partialResults: true)
      /*
      (SpeechRecognition as any).addListener("partialResults", (data: any) => {
        if (data?.matches?.length > 0) {
          setTranscript(data.matches[0]);
        }
      });
      */

    } catch (err: any) {
      console.error("Speech Recognition Error:", err);
      setError(err?.message || "Speech recognition failed");
      setIsListening(false);
    }
  }, [isListening]);

  return {
    isListening,
    transcript,
    error,
    startListening,
    setTranscript,
  };
}