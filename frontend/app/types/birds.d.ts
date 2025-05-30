export interface BirdPrediction {
  label: string;
  probability: number;
}

export interface BirdModelWorkerRequest {
  type: 'init' | 'predict';
  data?: Float32Array;
}

export interface BirdModelWorkerResponse {
  type: 'status' | 'result';
  message?: string;
  result?: BirdPrediction[];
}
