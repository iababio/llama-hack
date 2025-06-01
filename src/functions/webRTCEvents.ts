import {OpenAIMessage} from './webRTCTypes';
import {
  containsExternalQueryKeywords,
  fetchExternalQueryResponse,
  formatExternalQueryResponse,
} from './index';

export const handleOpenAIEvent = async (
  event: {data: string},
  addMessage: (
    text: string,
    isUser: boolean,
    type?: 'text' | 'audio' | 'external_query',
    externalData?: {
      data: any;
      queryType: 'weather' | 'restaurant' | 'shop' | 'general';
    },
    isMarkdown?: boolean,
  ) => void,
) => {
  try {
    const message = JSON.parse(event.data) as OpenAIMessage;
    const {type} = message;

    console.log('OpenAI Event:', type);

    switch (type) {
      case 'session.created':
        console.log('Session created successfully');
        break;

      case 'session.updated':
        console.log('Session updated successfully');
        break;

      case 'input_audio_buffer.speech_started':
        console.log('Speech started');
        break;

      case 'input_audio_buffer.speech_stopped':
        console.log('Speech stopped');
        break;

      case 'conversation.item.created':
        console.log('Conversation item created:', message.item);
        break;

      case 'response.created':
        console.log('Response created');
        break;

      case 'response.output_item.added':
        console.log('Response output item added');
        break;

      case 'response.content_part.added':
        console.log('Response content part added:', message.part);
        break;

      case 'response.content_part.done':
        if (message.part && message.part.text) {
          await handleAIResponse(message.part.text, addMessage);
        }
        break;

      case 'response.audio_transcript.done':
        if (message.transcript) {
          await handleAIResponse(message.transcript, addMessage);
        }
        break;

      case 'response.text.done':
        if (message.text) {
          await handleAIResponse(message.text, addMessage);
        }
        break;

      case 'response.done':
        console.log('Response completed');
        break;

      case 'error':
        console.error('OpenAI Error:', message.error);
        addMessage(
          '❌ AI Error: ' + (message.error?.message || 'Unknown error'),
          false,
          'text',
        );
        break;

      default:
        console.log('Unhandled event type:', type);
    }
  } catch (error) {
    console.error('Error parsing OpenAI event:', error);
  }
};

// Helper function to handle AI responses and check for external queries
const handleAIResponse = async (
  responseText: string,
  addMessage: (
    text: string,
    isUser: boolean,
    type?: 'text' | 'audio' | 'external_query',
    externalData?: {
      data: any;
      queryType: 'weather' | 'restaurant' | 'shop' | 'general';
    },
    isMarkdown?: boolean,
  ) => void,
) => {
  // First, add the AI response to the chat with markdown support
  addMessage(responseText, false, 'text', undefined, true);

  // Then check if the response contains external query keywords
  if (containsExternalQueryKeywords(responseText)) {
    try {
      // Show loading message
      addMessage('🔍 Let me get more detailed information...', false, 'text');

      // Fetch external query response
      const apiResponse = await fetchExternalQueryResponse(responseText);
      const formattedResponse = formatExternalQueryResponse(apiResponse, responseText);

      // Add the formatted response with structured data and markdown
      addMessage(
        formattedResponse.text,
        false,
        'external_query',
        {
          data: formattedResponse.data,
          queryType: formattedResponse.queryType,
        },
        true // Enable markdown for external query responses
      );
    } catch (error) {
      console.error('Error fetching external query from AI response:', error);
      addMessage(
        "❌ Sorry, I couldn't retrieve additional information right now.",
        false,
        'text',
      );
    }
  }
};
