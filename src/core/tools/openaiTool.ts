import OpenAI from 'openai';
import { NyxConfig } from '../../config/nyxConfig';

let openaiClient: OpenAI | null = null;
let currentApiKey: string | null = null;

function getClient(apiKey?: string): OpenAI {
  const keyToUse = apiKey || process.env.OPENAI_API_KEY;

  if (!keyToUse) {
    throw new Error(
      'OPENAI_API_KEY not found. Pass it via config or set it in environment/.env file.'
    );
  }

  if (!openaiClient || currentApiKey !== keyToUse) {
    openaiClient = new OpenAI({ apiKey: keyToUse });
    currentApiKey = keyToUse;
  }

  return openaiClient;
}

export async function chatCompletion(
  messages: OpenAI.Chat.ChatCompletionMessageParam[],
  config: Pick<NyxConfig, 'openaiApiKey' | 'openaiModel' | 'temperature'>
): Promise<string | null> {
  try {
    const client = getClient(config.openaiApiKey);
    const model = config.openaiModel || 'gpt-4';
    const temperature = config.temperature ?? 0.2;

    const response = await client.chat.completions.create({
      model: model,
      messages: messages,
      temperature: temperature,
      // max_tokens: config.maxTokens // Add maxTokens if needed
    });

    return response.choices[0]?.message?.content ?? null;
  } catch (error: any) {
    throw new Error(`OpenAI API request failed: ${error.message}`);
  }
}

// TODO: Add more sophisticated error handling, rate limiting, retries if needed.
