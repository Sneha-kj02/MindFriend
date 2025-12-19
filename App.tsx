import React, { useState, useEffect, useRef } from 'react';
import { GenerateContentResponse } from "@google/genai";
import { Message, AnalysisData, LoadingState } from './types';
import { getChatSession, analyzeConversation, resetChatSession } from './services/geminiService';
import MessageBubble from './components/MessageBubble';
import TypingIndicator from './components/TypingIndicator';
import AnalysisPanel from './components/AnalysisPanel';

const App: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loadingState, setLoadingState] = useState<LoadingState>(LoadingState.IDLE);
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [isListening, setIsListening] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);
  const baseTextRef = useRef('');

  // Auto-scroll to bottom of chat
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loadingState]);

  // Initial greeting
  useEffect(() => {
    const initialGreeting: Message = {
      id: 'init-1',
      role: 'model',
      text: "Hello lovely! ✨ I'm your MindfulMate. I'm here to listen to you with an open heart 💜. How are you feeling today?",
      timestamp: Date.now(),
    };
    setMessages([initialGreeting]);
    // Ensure fresh session on mount
    resetChatSession();
  }, []);

  // Initialize Speech Recognition
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const { webkitSpeechRecognition, SpeechRecognition } = window as any;
      const SpeechRecognitionConstructor = SpeechRecognition || webkitSpeechRecognition;

      if (SpeechRecognitionConstructor) {
        const recognition = new SpeechRecognitionConstructor();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onstart = () => {
          setIsListening(true);
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognition.onresult = (event: any) => {
           let transcript = '';
           for (let i = 0; i < event.results.length; ++i) {
             transcript += event.results[i][0].transcript;
           }
           
           // Combine with the text that was there before we started listening
           const separator = baseTextRef.current && !baseTextRef.current.endsWith(' ') ? ' ' : '';
           setInputText(baseTextRef.current + separator + transcript);
        };

        recognitionRef.current = recognition;
      }
    }
  }, []);

  // Handle Textarea Auto-resize
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [inputText]);

  const handleSendMessage = async () => {
    if (!inputText.trim() || loadingState !== LoadingState.IDLE) return;
    
    // Stop listening if sending
    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
    }

    const userText = inputText.trim();
    setInputText('');
    
    // Reset height
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    const newMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: userText,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, newMessage]);
    setLoadingState(LoadingState.SENDING);

    try {
      const chat = getChatSession();
      const resultStream = await chat.sendMessageStream({ message: userText });
      
      let fullResponseText = '';
      const responseId = (Date.now() + 1).toString();

      // Placeholder for streaming response
      setMessages((prev) => [
        ...prev,
        { id: responseId, role: 'model', text: '', timestamp: Date.now() }
      ]);

      for await (const chunk of resultStream) {
         const c = chunk as GenerateContentResponse;
         const textChunk = c.text || '';
         fullResponseText += textChunk;
         
         setMessages((prev) => 
           prev.map((msg) => 
             msg.id === responseId ? { ...msg, text: fullResponseText } : msg
           )
         );
      }

    } catch (error) {
      console.error("Error sending message:", error);
      setMessages((prev) => [
        ...prev,
        { 
          id: Date.now().toString(), 
          role: 'model', 
          text: "Oh no! 🥀 I'm having trouble connecting right now. Please try again in a moment.", 
          timestamp: Date.now(),
          isError: true
        }
      ]);
    } finally {
      setLoadingState(LoadingState.IDLE);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const toggleVoiceInput = () => {
    if (!recognitionRef.current) {
      alert("Voice input is not supported in this browser.");
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
    } else {
      baseTextRef.current = inputText; // Save current text
      recognitionRef.current.start();
    }
  };

  const handleAnalyze = async () => {
    if (messages.length < 3) return; // Need some context
    
    setShowAnalysis(true);
    setLoadingState(LoadingState.ANALYZING);
    
    try {
      // Filter out empty or error messages
      const validHistory = messages.filter(m => !m.isError && m.text.trim() !== '');
      const data = await analyzeConversation(validHistory);
      setAnalysisData(data);
    } catch (error) {
      console.error("Analysis Error", error);
    } finally {
      setLoadingState(LoadingState.IDLE);
    }
  };

  return (
    <div className="flex flex-col h-screen relative overflow-hidden font-sans text-slate-800">
      
      {/* Header */}
      <header className="glass-panel sticky top-0 z-10 border-b border-royal-100 px-4 py-3 flex justify-between items-center shadow-sm">
        <div className="flex items-center space-x-2">
           <div className="w-9 h-9 bg-gradient-to-br from-royal-500 to-royal-700 rounded-xl flex items-center justify-center text-white shadow-lg shadow-royal-200 transform hover:scale-105 transition-transform">
             <span className="text-lg">🔮</span>
           </div>
           <div>
             <h1 className="font-bold text-lg text-royal-900 tracking-tight leading-none">MindfulMate</h1>
             <p className="text-[10px] text-royal-400 font-medium">Your Daily Companion ✨</p>
           </div>
        </div>
        
        <button
          onClick={handleAnalyze}
          disabled={messages.length < 3 || loadingState === LoadingState.ANALYZING}
          className={`
            px-4 py-2 rounded-full text-sm font-bold transition-all duration-300 flex items-center space-x-2 shadow-sm
            ${messages.length < 3 
              ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
              : 'bg-gold-300 text-royal-900 hover:bg-gold-400 hover:shadow-gold-200 hover:shadow-md active:scale-95'
            }
          `}
        >
          <span className="text-lg">💎</span>
          <span className="hidden sm:inline">Daily Insight</span>
        </button>
      </header>

      {/* Chat Area */}
      <main className="flex-1 overflow-y-auto px-4 py-6 scrollbar-hide sm:px-6 md:px-20 lg:px-40 xl:px-60">
        <div className="flex flex-col space-y-6 pb-4">

           {messages.map((msg) => (
             <MessageBubble key={msg.id} message={msg} />
           ))}
           
           {loadingState === LoadingState.SENDING && messages.length > 0 && messages[messages.length - 1].role === 'user' && (
             <div className="flex justify-start animate-fade-in-up">
               <TypingIndicator />
             </div>
           )}
           
           <div ref={messagesEndRef} />
        </div>
      </main>

      {/* Input Area */}
      <footer className="glass-panel p-4 border-t border-royal-100">
        <div className="max-w-4xl mx-auto flex items-end space-x-2 bg-white p-2 rounded-3xl border border-royal-200 focus-within:border-gold-400 focus-within:ring-2 focus-within:ring-gold-100 transition-all shadow-sm">
          
          <button
            onClick={toggleVoiceInput}
            className={`
              p-3 rounded-full flex-shrink-0 transition-all duration-200
              ${isListening 
                ? 'bg-red-500 text-white animate-pulse shadow-lg shadow-red-200' 
                : 'bg-slate-100 text-slate-400 hover:bg-royal-100 hover:text-royal-500'
              }
            `}
            title={isListening ? "Stop listening" : "Start voice input"}
          >
            {isListening ? (
               <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                 <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" />
               </svg>
            ) : (
               <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                 <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
               </svg>
            )}
          </button>

          <textarea
            ref={textareaRef}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isListening ? "Listening..." : "Tell me your story... 🌙"}
            className="flex-1 bg-transparent border-none focus:ring-0 resize-none max-h-32 min-h-[44px] py-2.5 px-3 text-slate-700 placeholder-royal-300"
            rows={1}
          />
          <button
            onClick={handleSendMessage}
            disabled={!inputText.trim() || loadingState !== LoadingState.IDLE}
            className={`
              p-3 rounded-full flex-shrink-0 transition-all duration-200
              ${!inputText.trim() || loadingState !== LoadingState.IDLE
                ? 'bg-slate-100 text-slate-300' 
                : 'bg-gradient-to-r from-royal-600 to-royal-500 text-white shadow-lg shadow-royal-200 hover:shadow-royal-300 active:scale-95 transform'
              }
            `}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 rotate-90" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
            </svg>
          </button>
        </div>
        <div className="text-center mt-3">
            <p className="text-[10px] text-royal-400/70 font-medium">✨ Powered by AI. Treat advice with care. 🌈</p>
        </div>
      </footer>

      {/* Analysis Modal */}
      {showAnalysis && (
        <AnalysisPanel 
          data={analysisData} 
          isLoading={loadingState === LoadingState.ANALYZING} 
          onClose={() => setShowAnalysis(false)} 
        />
      )}

    </div>
  );
};

export default App;