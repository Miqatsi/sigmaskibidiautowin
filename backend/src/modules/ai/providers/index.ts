import { AIProvider } from '../ai.schema';
import { MockAIProvider } from './mock.provider';

/**
 * Factory function for AI provider.
 * Swap implementation here when integrating real LLM (OpenAI, Anthropic, Gemini).
 *
 * The ManufacturingContext passed to analyze() contains:
 * - intent: detected question category
 * - question: original user question
 * - data: real database context (suppliers, lots, QC, production, inventory)
 *
 * A real LLM provider would serialize this context into a prompt.
 */
export function getAIProvider(): AIProvider {
  const provider = process.env.AI_PROVIDER || 'mock';

  switch (provider) {
    case 'mock':
      return new MockAIProvider();
    // Future: case 'openai': return new OpenAIProvider();
    // Future: case 'anthropic': return new AnthropicProvider();
    // Future: case 'gemini': return new GeminiProvider();
    default:
      return new MockAIProvider();
  }
}
