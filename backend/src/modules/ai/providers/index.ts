import { AIProvider } from '../ai.schema';
import { MockAIProvider } from './mock.provider';

/**
 * Factory function for AI provider.
 * Swap implementation here when integrating real LLM (OpenAI, Anthropic, etc.)
 */
export function getAIProvider(): AIProvider {
  const provider = process.env.AI_PROVIDER || 'mock';

  switch (provider) {
    case 'mock':
      return new MockAIProvider();
    // Future: case 'openai': return new OpenAIProvider();
    // Future: case 'anthropic': return new AnthropicProvider();
    default:
      return new MockAIProvider();
  }
}
