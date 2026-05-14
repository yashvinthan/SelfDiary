import { pipeline } from '@huggingface/transformers';
import nlp from 'compromise';

// We map placeholders to their original text
const placeholders = {};
let placeholderIndex = 0;

function maskEntities(text) {
  const doc = nlp(text);
  
  // Find all entities using tags
  const people = doc.match('#Person').out('array');
  const places = doc.match('#Place').out('array');
  const dates = doc.match('#Date').out('array');
  const times = doc.match('#Time').out('array');
  
  let maskedText = text;
  
  // Function to replace and store
  const replaceWithPlaceholder = (entities, prefix) => {
    for (const entity of entities) {
      const id = `${prefix}${placeholderIndex++}_`;
      placeholders[id] = entity;
      // Replace only whole words, case-insensitive
      const regex = new RegExp(`\\b${entity}\\b`, 'gi');
      maskedText = maskedText.replace(regex, id);
    }
  };
  
  replaceWithPlaceholder(times, 'TIME');
  replaceWithPlaceholder(dates, 'DATE');
  replaceWithPlaceholder(people, 'PERSON');
  replaceWithPlaceholder(places, 'PLACE');
  
  return maskedText;
}

function unmaskEntities(maskedText) {
  let finalResult = maskedText;
  for (const [id, original] of Object.entries(placeholders)) {
    // Replace all occurrences of the placeholder with the original text
    finalResult = finalResult.replace(new RegExp(id, 'g'), original);
  }
  return finalResult;
}

async function run() {
  console.log("Loading AI Model...");
  const corrector = await pipeline('text2text-generation', 'Xenova/grammar-synthesis-small');
  
  const testCases = [
    "I have a meting tomorw at 2am with john",
    "me and sarah goes to the mall at 5pm",
    "i is very happy to anounce my new job in london on monday",
    "its goin 2 be amazin tomorow",
  ];
  
  for (const test of testCases) {
    console.log(`\nOriginal: ${test}`);
    
    // 1. Mask
    const masked = maskEntities(test);
    console.log(`Masked:   ${masked}`);
    
    // 2. Correct
    const result = await corrector(masked, { max_new_tokens: 128 });
    const aiOutput = result[0].generated_text;
    console.log(`AI Fixed: ${aiOutput}`);
    
    // 3. Unmask
    const final = unmaskEntities(aiOutput);
    console.log(`Final:    ${final}`);
  }
}

run();
