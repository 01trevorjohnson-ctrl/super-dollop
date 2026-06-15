const Anthropic = require('@anthropic-ai/sdk');
module.exports = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
