import OpenAI from 'openai';
import { z } from 'zod';
import zodToJsonSchema from 'zod-to-json-schema';
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
  config: Pick<NyxConfig, 'openaiApiKey' | 'openaiModel' | 'temperature'>,
  options?: { responseType?: 'text' }
): Promise<string | null>;
export async function chatCompletion<T extends z.ZodTypeAny>(
  messages: OpenAI.Chat.ChatCompletionMessageParam[],
  config: Pick<NyxConfig, 'openaiApiKey' | 'openaiModel' | 'temperature'>,
  options: { responseType: 'json'; schema: T }
): Promise<z.infer<T> | null>;
export async function chatCompletion<T extends z.ZodTypeAny>(
  messages: OpenAI.Chat.ChatCompletionMessageParam[],
  config: Pick<NyxConfig, 'openaiApiKey' | 'openaiModel' | 'temperature'>,
  options?: { responseType?: 'text' | 'json'; schema?: T }
): Promise<string | z.infer<T> | null> {
  const responseType = options?.responseType ?? 'text';
  const schema = options?.schema;

  try {
    const client = getClient(config.openaiApiKey);
    const model =
      config.openaiModel ||
      (responseType === 'json' ? 'gpt-4-turbo-preview' : 'gpt-4');

    const temperature = config.temperature ?? 0.2;

    if (responseType === 'json') {
      if (!schema) {
        throw new Error(
          "A Zod schema must be provided when responseType is 'json'."
        );
      }

      const jsonSchema = zodToJsonSchema(schema, 'responseSchema');
      const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
        {
          type: 'function',
          function: {
            name: 'format_response',
            description:
              'Formats the response according to the provided JSON schema.',
            parameters: jsonSchema.definitions?.responseSchema,
          },
        },
      ];

      const response = await client.chat.completions.create({
        model: model,
        messages: messages,
        temperature: temperature,
        tools: tools,
        tool_choice: {
          type: 'function',
          function: { name: 'format_response' },
        },
      });

      const toolCall = response.choices[0]?.message?.tool_calls?.[0];
      const jsonString = toolCall?.function?.arguments;

      if (!jsonString) {
        return null;
      }

      try {
        const parsedJson = JSON.parse(jsonString);
        const validationResult = schema.safeParse(parsedJson);

        if (validationResult.success) {
          return validationResult.data;
        }

        return null;
      } catch {
        return null;
      }
    } else {
      const response = await client.chat.completions.create({
        model: model,
        messages: messages,
        temperature: temperature,
      });

      return response.choices[0]?.message?.content ?? null;
    }
  } catch (error: any) {
    if (error instanceof Error) {
      throw new Error(`OpenAI API request failed: ${error.message}`);
    }

    throw new Error(`OpenAI API request failed with unknown error: ${error}`);
  }
}
