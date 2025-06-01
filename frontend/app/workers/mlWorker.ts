/// <reference lib="webworker" />
import * as tf from '@tensorflow/tfjs';

let model: tf.LayersModel | null = null;
let labels: string[] = [];

class MelSpecLayerSimple extends tf.layers.Layer {
  sampleRate!: number;
  specShape!: number[];
  frameStep!: number;
  frameLength!: number;
  fmin!: number;
  fmax!: number;
  melFilterbank!: tf.Tensor2D;
  magScale!: tf.LayerVariable;

  constructor(config: any) {
    super(config);
    this.sampleRate = config.sampleRate;
    this.specShape = config.specShape;
    this.frameStep = config.frameStep;
    this.frameLength = config.frameLength;
    this.fmin = config.fmin;
    this.fmax = config.fmax;
    this.melFilterbank = tf.tensor2d(config.melFilterbank);
  }

  build(inputShape: tf.Shape) {
    this.magScale = this.addWeight(
      'magnitude_scaling',
      [],
      'float32',
      tf.initializers.constant({ value: 1.23 })
    );
    super.build(inputShape);
  }

  computeOutputShape(inputShape: tf.Shape): tf.Shape {
    return [inputShape[0], this.specShape[0], this.specShape[1], 1];
  }

  call(inputs: tf.Tensor | tf.Tensor[], _kwargs: any): tf.Tensor {
    return tf.tidy(() => {
      const inputTensor = Array.isArray(inputs) ? inputs[0] : inputs;
      const inputList = tf.split(inputTensor, inputTensor.shape[0]);

      const specBatch = inputList.map(input => {
        input = input.squeeze();
        input = tf.sub(input, tf.min(input, -1, true));
        input = tf.div(input, tf.max(input, -1, true).add(1e-6));
        input = tf.sub(input, 0.5);
        input = tf.mul(input, 2.0);

        let spec = tf.signal.stft(
          input as any,
          this.frameLength,
          this.frameStep,
          this.frameLength,
          tf.signal.hannWindow
        );

        spec = tf.cast(spec, 'float32');
        spec = tf.matMul(spec, this.melFilterbank);
        spec = spec.pow(2.0);
        spec = spec.pow(tf.div(1.0, tf.add(1.0, tf.exp(this.magScale.read()))));
        spec = tf.reverse(spec, -1);
        spec = tf.transpose(spec);
        spec = spec.expandDims(-1);

        return spec;
      });

      return tf.stack(specBatch);
    });
  }

  static get className() {
    return 'MelSpecLayerSimple';
  }
}

tf.serialization.registerClass(MelSpecLayerSimple);

self.onmessage = async (event: MessageEvent) => {
  const { type, data } = event.data;

  if (type === 'init') {
    self.postMessage({ type: 'status', message: 'Loading TensorFlow.js...' });
    await tf.ready();

    self.postMessage({ type: 'status', message: 'Loading model...' });
    model = await tf.loadLayersModel('/aviya/model/model.json', {
      // @ts-expect-error: customObjects is supported but not typed
      customObjects: { MelSpecLayerSimple },
    });

    const res = await fetch('/aviya/model/labels.json');
    labels = await res.json();

    self.postMessage({ type: 'status', message: 'Bird model ready.' });
    return;
  }

  if (type === 'predict' && model && data) {
    const inputTensor = tf.tensor(data).reshape([1, 144000]);
    const output = model.predict(inputTensor) as tf.Tensor;
    const probs = await output.data();

    const topPreds = [...probs]
      .map((p, i) => ({ label: labels[i], probability: p }))
      .sort((a, b) => b.probability - a.probability)

    self.postMessage({ type: 'result', result: topPreds });
  }
};
