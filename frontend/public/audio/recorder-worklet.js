class RecorderWorkletProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
  }

  process(inputs) {
    const input = inputs[0];
    if (input && input[0]) {
      const channelData = input[0]; // Use the first (mono) channel
      const copy = new Float32Array(channelData); // Copy to transfer
      this.port.postMessage(copy, [copy.buffer]);
    }
    return true; // Keep processor alive
  }
}

registerProcessor('recorder-worklet', RecorderWorkletProcessor);
