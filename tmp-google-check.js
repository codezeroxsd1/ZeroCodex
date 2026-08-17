const { google } = require('@ai-sdk/google');
const { generateText } = require('ai');
(async () => {
  console.log('KEY_PRESENT', !!process.env.GOOGLE_GENERATIVE_AI_API_KEY);
  try {
    const result = await generateText({
      model: google('gemini-2.5-flash'),
      prompt: 'hola'
    });
    console.log('TEXT', result.text.slice(0,200));
  } catch (e) {
    console.error('MESSAGE', e && e.message);
    console.error('STATUS', e && e.statusCode);
    console.error('CAUSE', e && e.cause && e.cause.message);
    console.error('RAW', JSON.stringify({message:e&&e.message,status:e&&e.statusCode,cause:e&&e.cause&&e.cause.message}, null, 2));
    process.exit(1);
  }
})();
