import assert from "node:assert/strict";
import { test } from "node:test";

import { startWebSpeechRecognition, type WebSpeechRecognitionLike } from "../src/webSpeech.ts";

class FakeRecognition implements WebSpeechRecognitionLike {
  lang = "";
  interimResults = false;
  continuous = true;
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onresult: ((event: { resultIndex?: number; results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null = null;
  onerror: ((event: { error?: string; message?: string }) => void) | null = null;
  started = false;
  stopped = false;

  start() {
    this.started = true;
    this.onstart?.();
  }

  stop() {
    this.stopped = true;
    this.onend?.();
  }

  abort() {
    this.stopped = true;
  }
}

test("starts Chinese browser speech recognition and returns transcripts", () => {
  let instance: FakeRecognition | undefined;
  let transcript = "";
  let started = false;
  let ended = false;
  const scope = {
    webkitSpeechRecognition: class extends FakeRecognition {
      constructor() {
        super();
        instance = this;
      }
    },
  };

  const controller = startWebSpeechRecognition(scope, {
    onStart: () => { started = true; },
    onResult: (value) => { transcript = value; },
    onEnd: () => { ended = true; },
    onError: () => undefined,
  });

  assert.ok(controller);
  assert.ok(instance?.started);
  assert.equal(instance?.lang, "zh-CN");
  assert.equal(instance?.interimResults, true);
  assert.equal(instance?.continuous, false);
  assert.equal(started, true);

  instance?.onresult?.({ resultIndex: 0, results: [[{ transcript: "咖啡二十八元" }]] });
  assert.equal(transcript, "咖啡二十八元");

  controller.stop();
  assert.equal(instance?.stopped, true);
  assert.equal(ended, true);
});

test("returns null when browser speech recognition is unavailable", () => {
  const controller = startWebSpeechRecognition({}, {
    onStart: () => undefined,
    onResult: () => undefined,
    onEnd: () => undefined,
    onError: () => undefined,
  });
  assert.equal(controller, null);
});
