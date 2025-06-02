import { CONFIG } from "../utils/rtcConfig";

/**
 * Check if the message contains keywords related to location, restaurants, shops, products, or weather
 * @param message - The message to check
 * @returns True if the message contains any of the keywords, false otherwise
 */
export const containsExternalQueryKeywords = (message: string): boolean => {
  const keywords = [
    'location', 'where is', 'how to get to', 'directions to', 'address',
    'restaurant', 'cafe', 'diner', 'eat', 'food', 'dining',
    'shop', 'store', 'mall', 'buy', 'purchase',
    'product', 'item', 'price', 'cost',
    'weather', 'temperature', 'forecast', 'rain', 'sunny', 'cloudy',
    'near me', 'find', 'search for', 'cuisine', 'restaurant type',
    'restaurant name', 'shop name', 'product name', 'weather in',
    'cuisines'
  ];
  
  const messageLower = message.toLowerCase();
  return keywords.some(keyword => messageLower.includes(keyword));
};

/**
 * Determine the query type based on keywords
 * @param message - The message to analyze
 * @returns The query type
 */
export const getQueryType = (message: string): 'weather' | 'restaurant' | 'shop' | 'general' => {
  const messageLower = message.toLowerCase();
  
  if (messageLower.includes('weather') || messageLower.includes('temperature') || 
      messageLower.includes('forecast') || messageLower.includes('rain') || 
      messageLower.includes('sunny') || messageLower.includes('cloudy')) {
    return 'weather';
  }
  
  if (messageLower.includes('restaurant') || messageLower.includes('cafe') || 
      messageLower.includes('diner') || messageLower.includes('eat') || 
      messageLower.includes('food') || messageLower.includes('dining')) {
    return 'restaurant';
  }
  
  if (messageLower.includes('shop') || messageLower.includes('store') || 
      messageLower.includes('mall') || messageLower.includes('buy') || 
      messageLower.includes('purchase') || messageLower.includes('product')) {
    return 'shop';
  }
  
  return 'general';
};

/**
 * Check if AI response indicates it needs to look something up
 * @param message - The AI response to check
 * @returns True if the AI indicates it will check something, false otherwise
 */
export const containsAILookupIndicator = (message: string): boolean => {
  const lookupIndicators = [
    'I will check',
    'let me check',
    'I\'ll look up',
    'let me look up',
    'I will look up',
    'let me find',
    'I\'ll find',
    'I will find',
    'checking',
    'looking up',
    'searching for',
    'get back to you soon',
      'cuisine',
    'restaurant type',
      'restaurant name', 'shop name', 'product name', 'weather in',
    'cuisines'
  ];
  
  const messageLower = message.toLowerCase();
  return lookupIndicators.some(indicator => messageLower.includes(indicator));
};

/**
 * Extract the actual query from AI response
 * @param aiResponse - The AI response containing the lookup indicator
 * @returns The extracted query or the original response
 */
export const extractQueryFromAIResponse = (aiResponse: string): string => {
  // Look for patterns like "I will check {query} and get back to you"
  const patterns = [
    /I will check (.+?) and get back to you/i,
    /let me check (.+?) for you/i,
    /I'll look up (.+?) and/i,
    /let me look up (.+?) and/i,
    /I will look up (.+?) and/i,
    /let me find (.+?) for you/i,
    /I'll find (.+?) for you/i,
    /I will find (.+?) for you/i
  ];

  for (const pattern of patterns) {
    const match = aiResponse.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  // If no specific pattern found, return the original response
  return aiResponse;
};

/**
 * Send a query to the HasData.com API for search results
 * @param query - The user's query text
 * @returns The API response with search results
 */
export const fetchExternalQueryResponse = async (query: string) => {
  try {
    // Build the query parameters
    const queryParams = new URLSearchParams({
      q: query,
      location: 'United States',
      deviceType: 'mobile',
      filter: '1',
      num: '5',
      start: '1'
    });

    const response = await fetch(`https://api.hasdata.com/scrape/google/serp?${queryParams}`, {
      method: 'GET',
      headers: {
        'x-api-key': CONFIG.HASDATA_API_KEY,
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API error: ${response.status} ${response.statusText}\n${errorText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching external query:', error);
    throw error;
  }
};

/**
 * Process the HasData.com API response and return structured data
 * @param apiResponse - The response from the HasData.com API
 * @param query - The original query to determine type
 * @returns Object with formatted response and structured data
 */
export const formatExternalQueryResponse = (apiResponse: any, query: string = '') => {
  if (!apiResponse) {
    return {
      text: "Sorry, I couldn't retrieve that information.",
      data: null,
      queryType: 'general' as const
    };
  }

  const queryType = getQueryType(query);
  let formattedText = '';

  // Add organic search results
  if (apiResponse.organicResults && apiResponse.organicResults.length > 0) {
    formattedText += '🔍 **Search Results:**\n\n';
    
    apiResponse.organicResults.slice(0, 3).forEach((result: any, index: number) => {
      formattedText += `**${index + 1}. ${result.title}**\n`;
      formattedText += `${result.snippet}\n`;
      formattedText += `🔗 ${result.displayedLink}\n\n`;
    });
  }

  // Add product results if available
  if (apiResponse.immersiveProducts && apiResponse.immersiveProducts.length > 0) {
    formattedText += '🛍️ **Featured Products:**\n\n';
    
    apiResponse.immersiveProducts.slice(0, 3).forEach((product: any, index: number) => {
      formattedText += `**${product.title}**\n`;
      formattedText += `💰 ${product.price}`;
      if (product.delivery) {
        formattedText += ` • ${product.delivery}`;
      }
      formattedText += `\n📍 ${product.source}\n\n`;
    });
  }

  // Add related searches
  if (apiResponse.relatedSearches && apiResponse.relatedSearches.length > 0) {
    formattedText += '💡 **Related Searches:**\n';
    apiResponse.relatedSearches.slice(0, 3).forEach((search: any) => {
      formattedText += `• ${search.query}\n`;
    });
  }

  return {
    text: formattedText || "I found some information, but couldn't format it properly.",
    data: apiResponse,
    queryType
  };
};

/**
 * Enhanced function to handle location-specific queries
 * @param query - The user's query text
 * @param userLocation - Optional user location for more targeted results
 * @returns The API response with location-specific search results
 */
export const fetchLocationSpecificQuery = async (query: string, userLocation?: string) => {
  try {
    const location = userLocation || 'United States';
    const queryParams = new URLSearchParams({
      q: query,
      location: location,
      deviceType: 'mobile',
      filter: '1',
      num: '8',
      start: '1'
    });

    const response = await fetch(`https://api.hasdata.com/scrape/google/serp?${queryParams}`, {
      method: 'GET',
      headers: {
        'x-api-key': CONFIG.HASDATA_API_KEY,
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API error: ${response.status} ${response.statusText}\n${errorText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching location-specific query:', error);
    throw error;
  }
};
