import {useState, useRef} from 'react';
import {CONFIG} from '../utils/rtcConfig';

interface OrderState {
  selectedItems?: any[];
  awaitingResponse?: boolean;
  userResponses?: string[];
  lastSelectedItems?: any[];
}

export const useOrderHandling = (callLlamaAPI: Function, addMessage: Function) => {
  const [orderState, setOrderState] = useState<OrderState>({});

  const containsOrderKeywords = (message: string): boolean => {
    const orderKeywords = [
      'order for me', 'order selected food', 'order selected', 'place order',
      'i want to order', 'order these', 'order this', 'place my order',
      'order food', 'make order', 'place an order',
    ];
    const messageLower = message.toLowerCase();
    return orderKeywords.some(keyword => messageLower.includes(keyword));
  };

  const isOrderResponseMessage = (message: string): boolean => {
    const responseKeywords = [
      'no allergies', 'allergic to', 'i have allergy', 'dietary restriction',
      'vegetarian', 'vegan', 'gluten free', 'no customization', 'extra',
      'no onions', 'spicy', 'mild', 'sauce on side', 'well done', 'medium rare',
      'no dairy', 'nut allergy', 'shellfish allergy', 'proceed with order',
      'place the order', 'ready to order', 'no allergic', 'no special requests',
      'everything is fine', 'proceed', 'continue',
    ];
    const messageLower = message.toLowerCase();
    return responseKeywords.some(keyword => messageLower.includes(keyword));
  };

  const isNoAllergiesResponse = (message: string): boolean => {
    const noAllergiesKeywords = [
      'no allergies', 'no allergy', 'no allergic', 'no dietary restriction',
      'no special requests', 'no customization', 'proceed with order',
      'place the order', 'ready to order', 'everything is fine',
      'looks good', 'proceed', 'continue',
    ];
    const messageLower = message.toLowerCase();
    return noAllergiesKeywords.some(keyword => messageLower.includes(keyword));
  };

  const generateCookingInstructions = async (
    selectedItems: any[],
    userPreferences: string,
  ): Promise<string> => {
    // Implementation stays the same...
  };

  const handleOrderRequest = async (selectedItems?: any[], userMessage?: string) => {
    // Implementation stays the same...
  };

  return {
    orderState,
    setOrderState,
    containsOrderKeywords,
    isOrderResponseMessage,
    isNoAllergiesResponse,
    generateCookingInstructions,
    handleOrderRequest,
  };
};