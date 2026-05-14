import { pipeline } from '@huggingface/transformers';

async function run() {
  const corrector = await pipeline('text2text-generation', 'Xenova/grammar-synthesis-small');
  
  const text = "I have a meting tomorw at [TIME] with [PERSON]";
  const result = await corrector(text, { max_new_tokens: 128 });
  
  console.log("Input:", text);
  console.log("Output:", result[0].generated_text);
}

run();
