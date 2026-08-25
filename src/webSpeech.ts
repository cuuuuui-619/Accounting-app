export type WebSpeechResultEvent = {
  resultIndex?: number;
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
};

export type WebSpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onresult: ((event: WebSpeechResultEvent) => void) | null;
  onerror: ((event: { error?: string; message?: string }) => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type WebSpeechRecognitionConstructor = new () => WebSpeechRecognitionLike;

export type WebSpeechScope = {
  SpeechRecognition?: WebSpeechRecognitionConstructor;
  webkitSpeechRecognition?: WebSpeechRecognitionConstructor;
};

export type WebSpeechController = {
  stop: () => void;
  abort: () => void;
};

type WebSpeechCallbacks = {
  onStart: () => void;
  onResult: (transcript: string) => void;
  onEnd: () => void;
  onError: (message: string) => void;
};

export function startWebSpeechRecognition(scope: WebSpeechScope, callbacks: WebSpeechCallbacks): WebSpeechController | null {
  const Recognition = scope.SpeechRecognition ?? scope.webkitSpeechRecognition;
  if (!Recognition) return null;

  const recognition = new Recognition();
  recognition.lang = "zh-CN";
  recognition.interimResults = true;
  recognition.continuous = false;
  recognition.onstart = callbacks.onStart;
  recognition.onend = callbacks.onEnd;
  recognition.onerror = (event) => callbacks.onError(event.message || event.error || "语音识别暂不可用");
  recognition.onresult = (event) => {
    if (!event || !event.results || event.results.length === 0) return;
    const index = Math.max(0, event.resultIndex ?? event.results.length - 1);
    const transcript = event.results[index]?.[0]?.transcript?.trim();
    if (transcript) callbacks.onResult(transcript);
  };
  recognition.start();

  return {
    stop: () => recognition.stop(),
    abort: () => recognition.abort(),
  };
}
