import {useState} from 'react';
import {CONFIG} from '../utils/rtcConfig';

export const useLlamaAPI = () => {
  const [isLoadingLlama, setIsLoadingLlama] = useState(false);

  const callLlamaAPI = async (userMessage: string, images?: string[]): Promise<string> => {
    try {
      setIsLoadingLlama(true);

      let messageContent: any;
      if (images && images.length > 0) {
        messageContent = [
          { type: 'text', text: userMessage },
          ...images.map(base64Image => ({
            type: 'image_url',
            image_url: { url: `data:image/jpeg;base64,${base64Image}` },
          })),
        ];
      } else {
        messageContent = userMessage;
      }

      const response = await fetch(CONFIG.LLAMA_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${CONFIG.LLAMA_API_KEY}`,
        },
        body: JSON.stringify({
          model: CONFIG.LLAMA_MODEL,
          messages: [
            {
              role: 'system',
              content: 'You are a helpful AI assistant. Provide clear, concise, and accurate responses.',
            },
            {
              role: 'user',
              content: messageContent,
            },
          ],
          max_tokens: 1000,
          temperature: 0.7,
          stream: false,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Llama API Error:', response.status, errorText);

        if (response.status === 401) {
          throw new Error('Authentication failed. Please check your API key.');
        } else if (response.status === 429) {
          throw new Error('Rate limit exceeded. Please try again later.');
        } else if (response.status === 500) {
          throw new Error('Server error. Please try again later.');
        } else {
          throw new Error(`API request failed with status ${response.status}`);
        }
      }

      const data = await response.json();
      console.log('Llama API Response:', data);

      if (data.completion_message?.content?.text) {
        return data.completion_message.content.text.trim();
      } else if (data.choices && data.choices.length > 0 && data.choices[0].message) {
        return data.choices[0].message.content.trim();
      } else {
        console.error('Unexpected API response format:', data);
        throw new Error('Invalid response format from Llama API');
      }
    } catch (error) {
      console.error('Error calling Llama API:', error);

      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('Network error. Please check your internet connection.');
      } else {
        throw error;
      }
    } finally {
      setIsLoadingLlama(false);
    }
  };

  return {
    isLoadingLlama,
    callLlamaAPI,
  };
};