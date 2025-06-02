import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {CONFIG} from '../../utils/rtcConfig';


interface MenuItem {
  item_name_foreign: string;
  item_name_english: string;
  price_foreign_currency: string;
  price_usd: string;
}

interface MenuData {
  menu_items: MenuItem[];
  currency_detected: string;
  exchange_rate_used: string;
  last_updated: string;
}

interface MenuCardProps {
  data: MenuData;
  onMoreDetails?: (response: string) => void;
  onOrderSelected?: (selectedItems: MenuItem[]) => void; // Add this prop
}

const MenuCard: React.FC<MenuCardProps> = ({data, onMoreDetails, onOrderSelected}) => {
  const [showForeignNames, setShowForeignNames] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  // Call Llama API for dish details
  const callLlamaForDishDetails = async (selectedMenuItems: MenuItem[]): Promise<string> => {
    try {
      setIsLoadingDetails(true);

      // Create a detailed prompt for the selected dishes
      const dishesInfo = selectedMenuItems.map((item, index) => {
        return `${index + 1}. ${item.item_name_english} (Original: ${item.item_name_foreign})
           - Price: ${item.price_foreign_currency} (${item.price_usd} USD)`;
      }).join('\n');

      const prompt = `I have selected the following dishes from a menu and would like to know more about them. Please provide detailed information about each dish in English in a clear, organized format with bullet points, including:

- What the dish typically contains (main ingredients)
- How it's usually prepared or cooked
- What it tastes like (flavor profile)
- Any cultural significance or background
- Dietary considerations (if applicable)

Selected dishes:
${dishesInfo}

Please format your response with clear headers for each dish and use bullet points for easy reading. Make it informative but concise.`;

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
              content: 'You are a knowledgeable food expert and cultural consultant. Provide detailed, accurate, and engaging information about dishes from around the world. Always format your responses with clear headers and bullet points for maximum readability. Focus on ingredients, preparation methods, flavors, and cultural context in an organized manner.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          max_tokens: 1500,
          temperature: 0.7,
          stream: false,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Llama API Error:', response.status, errorText);
        throw new Error(`API request failed with status ${response.status}`);
      }

      const responseData = await response.json();
      console.log('Llama API Response:', responseData);

      // Handle Llama's response format
      let rawResponse = '';
      if (responseData.completion_message?.content?.text) {
        rawResponse = responseData.completion_message.content.text.trim();
      } else if (
        responseData.choices &&
        responseData.choices.length > 0 &&
        responseData.choices[0].message
      ) {
        rawResponse = responseData.choices[0].message.content.trim();
      } else {
        console.error('Unexpected API response format:', responseData);
        throw new Error('Invalid response format from Llama API');
      }

      // Format the response for better readability
      const formattedResponse = formatDishDetailsResponse(rawResponse, selectedMenuItems);
      return formattedResponse;

    } catch (error) {
      console.error('Error calling Llama API for dish details:', error);
      throw error;
    } finally {
      setIsLoadingDetails(false);
    }
  };

  // Format dish details response for better readability
  const formatDishDetailsResponse = (response: string, selectedItems: MenuItem[]): string => {
    // If the response is already well-formatted, return it
    if (response.includes('##') || response.includes('**') || response.includes('•')) {
      return response;
    }

    // Basic formatting if the AI didn't format properly
    let formatted = `## 🍽️ Detailed Information About Your Selected Dishes\n\n`;
    
    // Try to split by dishes if the response covers multiple items
    const dishCount = selectedItems.length;
    
    if (dishCount === 1) {
      // Single dish - format with clear sections
      formatted += `### ${selectedItems[0].item_name_english}\n`;
      formatted += `*${selectedItems[0].item_name_foreign}*\n\n`;
      formatted += formatResponseSections(response);
    } else {
      // Multiple dishes - try to split the response
      const sections = response.split(/\d+\.|(?:^|\n)(?=[A-Z][^.]*:)/m);
      
      selectedItems.forEach((item, index) => {
        formatted += `### ${index + 1}. ${item.item_name_english}\n`;
        formatted += `*${item.item_name_foreign}* - ${item.price_foreign_currency} (${item.price_usd} USD)\n\n`;
        
        // Try to find relevant section for this dish
        const relevantSection = sections[index + 1] || sections[0];
        if (relevantSection) {
          formatted += formatResponseSections(relevantSection.trim());
        }
        
        if (index < selectedItems.length - 1) {
          formatted += '\n---\n\n';
        }
      });
    }

    return formatted;
  };

  // Helper function to format response sections with bullet points
  const formatResponseSections = (text: string): string => {
    let formatted = text;

    // Convert common patterns to bullet points
    formatted = formatted
      // Convert numbered lists to bullet points
      .replace(/(\d+\.|\-|\*)\s*/g, '• ')
      // Add bullet points to sentences that start with common descriptors
      .replace(/\n(Ingredients?:|Contains?:|Made with:|Preparation:|Cooking:|Method:|Taste:|Flavor:|Cultural:|Dietary:|Note:)/gi, '\n\n**$1**\n• ')
      // Add bullet points to lines that describe ingredients or characteristics
      .replace(/\n([A-Z][^.]*(?:include|contain|made|prepare|cook|taste|flavor|cultural|dietary)[^.]*\.)/g, '\n• $1')
      // Clean up multiple bullet points
      .replace(/•\s*•/g, '•')
      // Add spacing around sections
      .replace(/\*\*(.*?)\*\*/g, '\n**$1**\n');

    return formatted.trim();
  };

  // Call Llama API for order customization questions
  const callLlamaForOrderQuestions = async (selectedMenuItems: MenuItem[]): Promise<string> => {
    try {
      setIsLoadingDetails(true);

      // Create a detailed prompt for order customization
      const dishesInfo = selectedMenuItems.map((item, index) => {
        return `${index + 1}. ${item.item_name_english} (${item.item_name_foreign}) - $${item.price_usd}`;
      }).join('\n');

      const prompt = `I'm about to order the following dishes from a restaurant menu:

${dishesInfo}

Before I place this order, I need to ask some important questions to ensure the best dining experience:

1. Do you have any food allergies or dietary restrictions I should be aware of? (e.g., nuts, dairy, gluten, shellfish, vegetarian, vegan, etc.)

2. Would you like to add any customizations or extra toppings to any of these dishes? (e.g., extra cheese, no onions, spice level preferences, sauce on the side, etc.)

3. Any special preparation requests or notes for the kitchen?

Please let me know your preferences so I can help you place the perfect order! If you don't have any allergies or special requests, just let me know and we can proceed with the order as-is.`;

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
              content: 'You are a helpful restaurant assistant helping customers place food orders. Always ask about allergies and customizations before finalizing orders. Be friendly, thorough, and considerate of dietary needs and preferences.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          max_tokens: 800,
          temperature: 0.7,
          stream: false,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Llama API Error:', response.status, errorText);
        throw new Error(`API request failed with status ${response.status}`);
      }

      const responseData = await response.json();
      console.log('Llama API Response for Order:', responseData);

      // Handle Llama's response format
      let rawResponse = '';
      if (responseData.completion_message?.content?.text) {
        rawResponse = responseData.completion_message.content.text.trim();
      } else if (
        responseData.choices &&
        responseData.choices.length > 0 &&
        responseData.choices[0].message
      ) {
        rawResponse = responseData.choices[0].message.content.trim();
      } else {
        console.error('Unexpected API response format:', responseData);
        throw new Error('Invalid response format from Llama API');
      }

      return rawResponse;

    } catch (error) {
      console.error('Error calling Llama API for order questions:', error);
      throw error;
    } finally {
      setIsLoadingDetails(false);
    }
  };

  // Handle More Details button
  const handleMoreDetails = async () => {
    if (selectedItems.size === 0) {
      Alert.alert('No Selection', 'Please select at least one dish to get more details.');
      return;
    }

    const selectedMenuItems = Array.from(selectedItems).map(index => data.menu_items[index]);
    console.log('Getting more details for selected items:', selectedMenuItems);

    try {
      // Call Llama API to get detailed information about the dishes
      const detailsResponse = await callLlamaForDishDetails(selectedMenuItems);
      
      // If there's a callback function, send the response back to the chat
      if (onMoreDetails) {
        onMoreDetails(detailsResponse);
      } else {
        // Fallback: show in an alert (not ideal for long text)
        Alert.alert(
          'Dish Details',
          detailsResponse.length > 200 
            ? detailsResponse.substring(0, 200) + '...\n\n(Full details sent to chat)' 
            : detailsResponse,
          [{text: 'OK'}]
        );
      }
      
    } catch (error) {
      console.error('Error getting dish details:', error);
      Alert.alert(
        'Error',
        'Sorry, I couldn\'t retrieve detailed information about the selected dishes. Please try again.',
        [{text: 'OK'}]
      );
    }
  };

  // Handle Order Selected button
  const handleOrderSelected = async () => {
    if (selectedItems.size === 0) {
      Alert.alert('No Selection', 'Please select at least one dish to order.');
      return;
    }

    const selectedMenuItems = Array.from(selectedItems).map(index => data.menu_items[index]);
    console.log('Processing order for selected items:', selectedMenuItems);

    // Use the callback from App.tsx instead of local API call
    if (onOrderSelected) {
      onOrderSelected(selectedMenuItems);
      // Keep selection after triggering order so user can see what was selected
      // setSelectedItems(new Set()); // Remove this line too
    } else {
      // Fallback if no callback provided
      Alert.alert(
        'Order Request',
        'Order functionality is not available at the moment.',
        [{text: 'OK'}]
      );
    }
  };

  const formatCurrency = (currencyCode: string) => {
    const currencyMap: {[key: string]: string} = {
      JPY: '¥ Japanese Yen',
      USD: '$ US Dollar',
      EUR: '€ Euro',
      GBP: '£ British Pound',
      KRW: '₩ Korean Won',
      CNY: '¥ Chinese Yuan',
    };
    return currencyMap[currencyCode] || currencyCode;
  };

  // Toggle individual item expansion (only when card is expanded)
  const toggleItemExpansion = (index: number) => {
    if (!isExpanded) {return;} // Don't allow individual item expansion when card is collapsed
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedItems(newExpanded);
  };

  // Toggle item selection
  const toggleItemSelection = (index: number) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedItems(newSelected);
  };

  // Toggle entire card expansion
  const toggleCardExpansion = () => {
    setIsExpanded(!isExpanded);
    if (!isExpanded) {
      // When expanding, clear individual item expansions
      setExpandedItems(new Set());
    }
  };

  // Show first 3 items when collapsed, all items when expanded
  const displayedItems = isExpanded ? data.menu_items : data.menu_items.slice(0, 3);
  const hasMoreItems = data.menu_items.length > 3;

  return (
    <View style={styles.container}>
      {/* Header - Clickable to expand/collapse */}
      <TouchableOpacity 
        style={styles.header} 
        onPress={toggleCardExpansion}
        activeOpacity={0.7}>
        <View style={styles.headerTop}>
          <Ionicons name="restaurant" size={20} color="#0081FB" />
          <Text style={styles.title}>Menu Items</Text>
          <Text style={styles.itemCount}>{data.menu_items.length} items</Text>
          {selectedItems.size > 0 && (
            <Text style={styles.selectedCount}>{selectedItems.size} selected</Text>
          )}
          <Ionicons 
            name={isExpanded ? "chevron-up" : "chevron-down"} 
            size={20} 
            color="#0081FB" 
            style={styles.expandIcon}
          />
        </View>
        
        {/* Currency Info */}
        <View style={styles.currencyInfo}>
          <Text style={styles.currencyText}>
            {formatCurrency(data.currency_detected)}
          </Text>
          <Text style={styles.exchangeRate}>{data.exchange_rate_used}</Text>
        </View>

        {/* Show preview of first item when collapsed */}
        {!isExpanded && data.menu_items.length > 0 && (
          <View style={styles.previewItem}>
            <Text style={styles.previewName} numberOfLines={1}>
              {showForeignNames ? data.menu_items[0].item_name_foreign : data.menu_items[0].item_name_english}
            </Text>
            <Text style={styles.previewPrice}>
              {data.menu_items[0].price_foreign_currency} → ${data.menu_items[0].price_usd}
            </Text>
            {hasMoreItems && (
              <Text style={styles.moreItemsText}>
                +{data.menu_items.length - 1} more items...
              </Text>
            )}
          </View>
        )}

        {/* Language Toggle - only show when expanded */}
        {isExpanded && (
          <TouchableOpacity 
            style={styles.languageToggle}
            onPress={(e) => {
              e.stopPropagation(); // Prevent card toggle when clicking language toggle
              setShowForeignNames(!showForeignNames);
            }}>
            <Ionicons 
              name="language" 
              size={16} 
              color="#0081FB" 
              style={styles.toggleIcon}
            />
            <Text style={styles.toggleText}>
              Show {showForeignNames ? 'English' : 'Original'} Names
            </Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>

      {/* Menu Items - only show when expanded */}
      {isExpanded && (
        <ScrollView 
          style={styles.menuList}
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled={true}>
          {displayedItems.map((item, index) => {
            const isItemExpanded = expandedItems.has(index);
            const isSelected = selectedItems.has(index);
            const primaryName = showForeignNames ? item.item_name_foreign : item.item_name_english;
            const secondaryName = showForeignNames ? item.item_name_english : item.item_name_foreign;

            return (
              <View key={index} style={[styles.menuItem, isItemExpanded && styles.menuItemExpanded]}>
                {/* Checkbox */}
                <TouchableOpacity
                  style={styles.checkboxContainer}
                  onPress={() => toggleItemSelection(index)}
                  activeOpacity={0.7}>
                  <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                    {isSelected && (
                      <Ionicons name="checkmark" size={14} color="#fff" />
                    )}
                  </View>
                </TouchableOpacity>

                {/* Menu Item Content */}
                <TouchableOpacity
                  style={styles.menuItemContent}
                  onPress={() => toggleItemExpansion(index)}
                  activeOpacity={0.7}>
                  
                  <View style={styles.itemDetails}>
                    {/* Item Name */}
                    <View style={styles.itemNameContainer}>
                      <Text style={styles.primaryName} numberOfLines={isItemExpanded ? 0 : 2}>
                        {primaryName}
                      </Text>
                      {isItemExpanded && (
                        <Text style={styles.secondaryName}>
                          {secondaryName}
                        </Text>
                      )}
                    </View>

                    {/* Prices */}
                    <View style={styles.pricesContainer}>
                      <Text style={styles.foreignPrice}>
                        {item.price_foreign_currency}
                      </Text>
                      <Text style={styles.usdPrice}>
                        ${item.price_usd}
                      </Text>
                    </View>
                  </View>

                  {/* Individual Item Expand/Collapse Indicator */}
                  <View style={styles.expandIndicator}>
                    <Ionicons 
                      name={isItemExpanded ? "chevron-up" : "chevron-down"} 
                      size={16} 
                      color="#999" 
                    />
                  </View>
                </TouchableOpacity>
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* Footer - Show action buttons when items are selected, otherwise show last updated */}
      {isExpanded && (
        <View style={styles.footer}>
          {selectedItems.size > 0 ? (
            <View style={styles.actionButtons}>
              <TouchableOpacity 
                style={[
                  styles.actionButton, 
                  styles.moreDetailsButton,
                  isLoadingDetails && styles.buttonDisabled
                ]}
                onPress={handleMoreDetails}
                disabled={isLoadingDetails}
                activeOpacity={0.7}>
                {isLoadingDetails ? (
                  <Ionicons name="hourglass-outline" size={16} color="#0081FB" />
                ) : (
                  <Ionicons name="information-circle-outline" size={16} color="#0081FB" />
                )}
                <Text style={styles.moreDetailsButtonText}>
                  {isLoadingDetails ? 'Getting Details...' : 'More Details'}
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.actionButton, styles.orderButton]}
                onPress={handleOrderSelected}
                activeOpacity={0.7}>
                <Ionicons name="cart-outline" size={16} color="#fff" />
                <Text style={styles.orderButtonText}>Order Selected</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.lastUpdatedContainer}>
              <Ionicons name="time-outline" size={14} color="#999" />
              <Text style={styles.lastUpdated}>
                Last updated: {data.last_updated}
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginVertical: 8,
    marginHorizontal: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 8,
    flex: 1,
  },
  itemCount: {
    fontSize: 12,
    color: '#666',
    backgroundColor: '#f0f8ff',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginRight: 8,
  },
  selectedCount: {
    fontSize: 12,
    color: '#fff',
    backgroundColor: '#0081FB',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginRight: 8,
    fontWeight: '600',
  },
  expandIcon: {
    marginLeft: 4,
  },
  currencyInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  currencyText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0081FB',
  },
  exchangeRate: {
    fontSize: 12,
    color: '#666',
    fontFamily: 'monospace',
  },
  previewItem: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  previewName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
  },
  previewPrice: {
    fontSize: 12,
    color: '#0081FB',
    fontWeight: '600',
  },
  moreItemsText: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
    marginTop: 4,
  },
  languageToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginTop: 8,
  },
  toggleIcon: {
    marginRight: 6,
  },
  toggleText: {
    fontSize: 12,
    color: '#0081FB',
    fontWeight: '500',
  },
  menuList: {
    maxHeight: 300, // Limit height for scrolling
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  menuItemExpanded: {
    backgroundColor: '#f8f9fa',
    paddingVertical: 16,
  },
  checkboxContainer: {
    marginRight: 12,
    padding: 4,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#ddd',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: '#0081FB',
    borderColor: '#0081FB',
  },
  menuItemContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  itemDetails: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  itemNameContainer: {
    flex: 1,
    marginRight: 12,
  },
  primaryName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#333',
    lineHeight: 20,
  },
  secondaryName: {
    fontSize: 13,
    color: '#666',
    marginTop: 4,
    fontStyle: 'italic',
    lineHeight: 18,
  },
  pricesContainer: {
    alignItems: 'flex-end',
  },
  foreignPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0081FB',
  },
  usdPrice: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  expandIndicator: {
    marginLeft: 8,
    padding: 4,
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    backgroundColor: '#f8f9fa',
  },
  lastUpdatedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  lastUpdated: {
    fontSize: 12,
    color: '#999',
    marginLeft: 4,
  },
  actionButtons: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 6,
  },
  moreDetailsButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#0081FB',
  },
  moreDetailsButtonText: {
    color: '#0081FB',
    fontWeight: '600',
    fontSize: 14,
  },
  orderButton: {
    backgroundColor: '#0081FB',
  },
  orderButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});

export default MenuCard;