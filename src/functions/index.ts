// Export all WebRTC functions from this index file
export * from './webRTCConnection';
export * from './webRTCEvents';
export * from './webRTCMessages';
export * from './webRTCTypes';
export {
  containsExternalQueryKeywords,
  containsAILookupIndicator,
  extractQueryFromAIResponse,
  fetchExternalQueryResponse,
  formatExternalQueryResponse,
  fetchLocationSpecificQuery,
} from './externalQueries';
export {
  connectWebSocket,
  disconnectWebSocket,
  handleOpenAIEvent,
  requestAudioPermission,
  getOpenAIWebSocketSecretKey,
  sendSDPToServer,
} from './webRTCConnection';
