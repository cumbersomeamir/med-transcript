'use client';

import { useState, useRef, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Mic, Upload, Square, Play, Pause, Volume2 } from 'lucide-react';
import { addSession } from '@/store/sessionsSlice';

export default function MedicalDialogue() {
  const [currentStep, setCurrentStep] = useState(1);
  const [isRecording, setIsRecording] = useState(false);
  const [audioFile, setAudioFile] = useState(null);
  const [audioUrl, setAudioUrl] = useState('');
  const [transcript, setTranscript] = useState('');
  const [insights, setInsights] = useState({});
  const [isPlaying, setIsPlaying] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const dispatch = useDispatch();
  const sessions = useSelector(state => state.sessions);
  
  const mediaRecorderRef = useRef(null);
  const audioRef = useRef(null);
  const chunksRef = useRef([]);
  const chunkQueueRef = useRef([]);
  const processingRef = useRef(false);
  const recordingDoneRef = useRef(false);
  const fileInputRef = useRef(null);

  // Process queued 10s chunks one by one
  const processChunkQueue = async () => {
    if (processingRef.current || chunkQueueRef.current.length === 0) {
      return;
    }

    processingRef.current = true;
    const chunk = chunkQueueRef.current.shift();

    try {
      const file = new File([chunk], `chunk-${Date.now()}.wav`, {
        type: 'audio/wav'
      });
      const formData = new FormData();
      formData.append('audio', file);

      const diarizeResponse = await fetch('/api/diarize', {
        method: 'POST',
        body: formData
      });

      if (diarizeResponse.ok) {
        const data = await diarizeResponse.json();
        if (data.transcript) {
          setTranscript((prev) => prev + data.transcript + '\n');
        }
      } else {
        console.error('Diarization chunk failed:', diarizeResponse.status);
      }
    } catch (error) {
      console.error('Error processing chunk:', error);
    } finally {
      processingRef.current = false;
      if (chunkQueueRef.current.length > 0) {
        processChunkQueue();
      } else if (recordingDoneRef.current) {
        analyzeTranscript();
      }
    }
  };

  // Analyze final transcript when all chunks processed
  const analyzeTranscript = async () => {
    if (!transcript) return;

    setIsProcessing(true);
    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript })
      });
      if (response.ok) {
        const analysisData = await response.json();
        setInsights(analysisData);
        setCurrentStep(3);
      } else {
        const err = await response.text();
        console.error('Analysis failed:', err);
      }
    } catch (error) {
      console.error('Error analyzing transcript:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  // Recording functions
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      chunksRef.current = [];
      chunkQueueRef.current = [];
      recordingDoneRef.current = false;

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
          chunkQueueRef.current.push(event.data);
          processChunkQueue();
        }
      };

      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/wav' });
        const file = new File([blob], 'recording.wav', { type: 'audio/wav' });
        setAudioFile(file);
        setAudioUrl(URL.createObjectURL(blob));
        setIsProcessing(true);
        recordingDoneRef.current = true;
        console.log('Recording completed, finalizing...');
        processChunkQueue();
      };

      mediaRecorderRef.current.start(10000); // emit chunks every 10 seconds
      setIsRecording(true);
      setCurrentStep(2);
    } catch (error) {
      console.error('Error starting recording:', error);
      alert('Error accessing microphone. Please check permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      setIsRecording(false);
      // Stay in step 2 until user decides to process
    }
  };

  // File upload function
  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file && file.type.startsWith('audio/')) {
      console.log('File selected:', file.name, file.type, file.size);
      setAudioFile(file);
      setAudioUrl(URL.createObjectURL(file));
      setCurrentStep(2);
      // Don't auto-process, let user initiate
      setTimeout(() => {
        processAudio(file);
      }, 1000);
    } else {
      alert('Please select a valid audio file (.mp3 or .wav)');
    }
  };

  // Process audio through API
  const processAudio = async (file = audioFile) => {
    if (!file) {
      console.error('No file provided for processing');
      return;
    }
    let analysisData = null;
    
    console.log('Starting audio processing for:', file.name);
    setIsProcessing(true);
    
    try {
      // Step 1: Upload file to get AWS URL
      console.log('Step 1: Uploading file...');
      const formData = new FormData();
      formData.append('audio', file);
      
      const uploadResponse = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      
      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.text();
        console.error('Upload failed:', uploadResponse.status, errorData);
        throw new Error(`Upload failed: ${uploadResponse.status}`);
      }
      
      const uploadData = await uploadResponse.json();
      console.log('Upload successful:', uploadData);
      const awsUrl = uploadData.awsUrl;
      
      // Step 2: Send to diarization API
      console.log('Step 2: Processing diarization for URL:', awsUrl);
      const diarizeResponse = await fetch('/api/diarize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: awsUrl }),
      });
      
      if (!diarizeResponse.ok) {
        const errorData = await diarizeResponse.text();
        console.error('Diarization failed:', diarizeResponse.status, errorData);
        throw new Error(`Diarization failed: ${diarizeResponse.status}`);
      }
      
      const diarizeData = await diarizeResponse.json();
      console.log('Diarization successful:', diarizeData);
      setTranscript(diarizeData.transcript || 'No transcript received');
      
      // Step 3: Send to GPT for analysis
      console.log('Step 3: Analyzing transcript...');
      const analysisResponse = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          transcript: diarizeData.transcript 
        }),
      });
      
      if (!analysisResponse.ok) {
        const errorData = await analysisResponse.text();
        console.error('Analysis failed:', analysisResponse.status, errorData);
        // Continue anyway with just transcript
        analysisData = {
          summary: 'Analysis failed, but transcript is available above.',
          keyPoints: ['Transcript processed successfully'],
          followUp: ['Please review the transcript manually'],
          medicalTerms: []
        };
        setInsights(analysisData);
      } else {
        analysisData = await analysisResponse.json();
        console.log('Analysis successful:', analysisData);
        setInsights(analysisData);
      }
      
      dispatch(addSession({
        transcript: diarizeData.transcript,
        insights: analysisData
      }));
      setCurrentStep(3);
      console.log('All processing completed successfully');
    } catch (error) {
      console.error('Error processing audio:', error);
      alert(`Error processing audio: ${error.message}. Check console for details.`);
      setCurrentStep(1); // Reset to initial state
    } finally {
      setIsProcessing(false);
    }
  };

  // Audio playback controls
  const togglePlayback = () => {
    if (!audioRef.current) return;
    
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  // Reset function
  const resetApp = () => {
    setCurrentStep(1);
    setIsRecording(false);
    setAudioFile(null);
    setAudioUrl('');
    setTranscript('');
    setInsights({});
    setIsPlaying(false);
    setIsProcessing(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Test API function
  const testAPIs = async () => {
    console.log('Testing APIs...');
    try {
      const response = await fetch('/api/test');
      const data = await response.json();
      console.log('API Test Result:', data);
      alert(`API Test Result:\n${JSON.stringify(data, null, 2)}`);
    } catch (error) {
      console.error('API Test failed:', error);
      alert(`API Test failed: ${error.message}`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                <Volume2 className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-xl font-semibold text-gray-900">MedicalDialogue</h1>
            </div>
            <div className="text-sm text-gray-500 flex items-center space-x-4">
              AI-Powered Medical Conversation Analysis
              <button
                onClick={() => setShowHistory(true)}
                className="px-3 py-1 bg-gray-100 text-gray-700 rounded-md text-xs hover:bg-gray-200 transition-colors"
              >
                History
              </button>
              <button
                onClick={testAPIs}
                className="px-3 py-1 bg-blue-100 text-blue-600 rounded-md text-xs hover:bg-blue-200 transition-colors"
              >
                Test APIs
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Panel - Recording/Processing */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            {currentStep === 1 && (
              <>
                <h2 className="text-2xl font-semibold text-gray-900 mb-2">
                  Record Medical Dialogue
                </h2>
                <p className="text-gray-600 mb-8">
                  Click the microphone button to start recording
                </p>

                {/* Progress Steps */}
                <div className="flex items-center justify-between mb-12">
                  <div className="flex flex-col items-center">
                    <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mb-2">
                      <span className="text-blue-600 font-semibold">1</span>
                    </div>
                    <span className="text-sm text-gray-600">Recording Audio</span>
                  </div>
                  <div className="flex-1 h-px bg-gray-200 mx-4"></div>
                  <div className="flex flex-col items-center">
                    <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-2">
                      <span className="text-gray-400 font-semibold">2</span>
                    </div>
                    <span className="text-sm text-gray-400">Analyzing Speakers</span>
                  </div>
                  <div className="flex-1 h-px bg-gray-200 mx-4"></div>
                  <div className="flex flex-col items-center">
                    <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-2">
                      <span className="text-gray-400 font-semibold">3</span>
                    </div>
                    <span className="text-sm text-gray-400">Generating Insights</span>
                  </div>
                </div>

                {/* Recording Button */}
                <div className="flex flex-col items-center">
                  <button
                    onClick={startRecording}
                    className="w-24 h-24 bg-blue-500 hover:bg-blue-600 rounded-full flex items-center justify-center transition-colors duration-200 mb-8"
                  >
                    <Mic className="w-10 h-10 text-white" />
                  </button>
                  
                  <div className="text-center">
                    <p className="text-gray-600 mb-4">Or upload an audio file</p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="audio/*"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      Upload Audio File
                    </button>
                  </div>
                </div>
              </>
            )}

            {currentStep === 2 && (
              <>
                <h2 className="text-2xl font-semibold text-gray-900 mb-2">
                  {isProcessing ? 'Processing Audio...' : 'Recording in Progress'}
                </h2>
                <p className="text-gray-600 mb-8">
                  {isProcessing ? 'Analyzing the conversation and generating insights' : 'Capturing audio from doctor-patient conversation'}
                </p>

                {/* Progress Steps */}
                <div className="flex items-center justify-between mb-12">
                  <div className="flex flex-col items-center">
                    <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mb-2">
                      <svg className="w-6 h-6 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <span className="text-sm text-gray-600">Recording Audio</span>
                  </div>
                  <div className="flex-1 h-px bg-gray-200 mx-4"></div>
                  <div className="flex flex-col items-center">
                    <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mb-2">
                      <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                    <span className="text-sm text-gray-600">Analyzing Speakers</span>
                    <span className="text-xs text-gray-400">2 speakers identified</span>
                  </div>
                  <div className="flex-1 h-px bg-gray-200 mx-4"></div>
                  <div className="flex flex-col items-center">
                    <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-2">
                      <span className="text-gray-400 font-semibold">3</span>
                    </div>
                    <span className="text-sm text-gray-400">Generating Insights</span>
                  </div>
                </div>

                {/* Stop Recording Button or Processing Indicator */}
                <div className="flex flex-col items-center">
                  {isRecording ? (
                    <button
                      onClick={stopRecording}
                      className="w-24 h-24 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center transition-colors duration-200 mb-4"
                    >
                      <Square className="w-8 h-8 text-white" />
                    </button>
                  ) : audioFile && !isProcessing ? (
                    <button
                      onClick={() => processAudio(audioFile)}
                      className="w-24 h-24 bg-green-500 hover:bg-green-600 rounded-full flex items-center justify-center transition-colors duration-200 mb-4"
                    >
                      <Play className="w-8 h-8 text-white ml-1" />
                    </button>
                  ) : (
                    <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                      <div className="w-8 h-8 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  )}
                  
                  {/* Status Text */}
                  <div className="text-center">
                    {isRecording ? (
                      <p className="text-red-600 font-medium">Recording... Click to stop</p>
                    ) : audioFile && !isProcessing ? (
                      <div>
                        <p className="text-green-600 font-medium mb-2">Recording ready!</p>
                        <p className="text-sm text-gray-500">Click the play button to process</p>
                      </div>
                    ) : isProcessing ? (
                      <p className="text-blue-600 font-medium">Processing audio...</p>
                    ) : (
                      <p className="text-gray-500">Preparing...</p>
                    )}
                  </div>
                  
                  {/* Audio Waveform Visualization */}
                  <div className="w-full max-w-md h-16 bg-gray-50 rounded-lg flex items-center justify-center mt-4">
                    <div className="flex items-end space-x-1">
                      {[...Array(20)].map((_, i) => (
                        <div
                          key={i}
                          className={`w-2 rounded-sm ${isRecording ? 'bg-red-400 animate-pulse' : audioFile ? 'bg-blue-400' : 'bg-gray-300'}`}
                          style={{
                            height: `${Math.random() * 40 + 10}px`,
                            animationDelay: `${i * 100}ms`
                          }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </>
            )}

            {currentStep === 3 && (
              <>
                <h2 className="text-2xl font-semibold text-gray-900 mb-2">
                  Record Medical Dialogue
                </h2>
                <p className="text-gray-600 mb-8">
                  Click the microphone button to start recording
                </p>

                {/* Progress Steps - All Complete */}
                <div className="flex items-center justify-between mb-12">
                  <div className="flex flex-col items-center">
                    <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mb-2">
                      <svg className="w-6 h-6 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <span className="text-sm text-gray-600">Recording Audio</span>
                  </div>
                  <div className="flex-1 h-px bg-green-200 mx-4"></div>
                  <div className="flex flex-col items-center">
                    <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mb-2">
                      <svg className="w-6 h-6 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <span className="text-sm text-gray-600">Analyzing Speakers</span>
                    <span className="text-xs text-gray-400">2 speakers identified</span>
                  </div>
                  <div className="flex-1 h-px bg-green-200 mx-4"></div>
                  <div className="flex flex-col items-center">
                    <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mb-2">
                      <svg className="w-6 h-6 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <span className="text-sm text-gray-600">Generating Insights</span>
                  </div>
                </div>

                {/* New Recording Button */}
                <div className="flex flex-col items-center">
                  <button
                    onClick={resetApp}
                    className="w-24 h-24 bg-blue-500 hover:bg-blue-600 rounded-full flex items-center justify-center transition-colors duration-200 mb-4"
                  >
                    <Mic className="w-10 h-10 text-white" />
                  </button>

                  {/* Audio Playback Controls */}
                  {audioUrl && (
                    <div className="w-full max-w-md">
                      <audio ref={audioRef} src={audioUrl} className="hidden" />
                      <div className="bg-gray-50 rounded-lg p-4">
                        <div className="flex items-center space-x-4">
                          <button
                            onClick={togglePlayback}
                            className="w-10 h-10 bg-blue-500 hover:bg-blue-600 rounded-full flex items-center justify-center"
                          >
                            {isPlaying ? (
                              <Pause className="w-5 h-5 text-white" />
                            ) : (
                              <Play className="w-5 h-5 text-white ml-0.5" />
                            )}
                          </button>
                          <div className="flex-1">
                            <div className="w-full bg-gray-300 rounded-full h-2">
                              <div className="bg-blue-500 h-2 rounded-full" style={{ width: '0%' }}></div>
                            </div>
                            <div className="flex justify-between text-xs text-gray-500 mt-1">
                              <span>0:00</span>
                              <span>-:--</span>
                            </div>
                          </div>
                          <Volume2 className="w-5 h-5 text-gray-400" />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Conversation Transcript */}
                {transcript && (
                  <div className="mt-8">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Conversation Transcript</h3>
                    <div className="bg-gray-50 rounded-lg p-4 max-h-64 overflow-y-auto">
                      {transcript.split('\n\n').map((segment, index) => {
                        const [speaker, ...textParts] = segment.split(': ');
                        const text = textParts.join(': ');
                        const isDoctor = speaker.includes('0') || speaker.toLowerCase().includes('doctor');
                        
                        return (
                          <div key={index} className="mb-4 last:mb-0">
                            <div className="flex items-start space-x-3">
                              <div className="text-xs text-gray-500 font-medium mt-1 min-w-0">
                                0:{String(index * 7).padStart(2, '0')}
                              </div>
                              <div className="flex-1">
                                <div className={`text-sm font-medium mb-1 ${
                                  isDoctor ? 'text-blue-600' : 'text-green-600'
                                }`}>
                                  {isDoctor ? 'Doctor' : 'Patient'}
                                </div>
                                <div className="text-sm text-gray-700">{text}</div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Right Panel - Insights */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-2xl font-semibold text-gray-900 mb-2">
              Conversation Insights
            </h2>
            <p className="text-gray-600 mb-6">
              {currentStep === 3 ? 'AI-generated analysis of the doctor-patient dialogue' : 'Record a conversation to generate AI insights'}
            </p>

            {currentStep === 3 && insights.summary ? (
              <>
                {/* Insight Tabs */}
                <div className="border-b border-gray-200 mb-6">
                  <nav className="-mb-px flex space-x-8">
                    <button className="py-2 px-1 border-b-2 border-blue-500 font-medium text-sm text-blue-600">
                      Summary
                    </button>
                    <button className="py-2 px-1 border-b-2 border-transparent font-medium text-sm text-gray-500 hover:text-gray-700">
                      Key Points
                    </button>
                    <button className="py-2 px-1 border-b-2 border-transparent font-medium text-sm text-gray-500 hover:text-gray-700">
                      Follow-up
                    </button>
                    <button className="py-2 px-1 border-b-2 border-transparent font-medium text-sm text-gray-500 hover:text-gray-700">
                      Medical Terms
                    </button>
                  </nav>
                </div>

                {/* Insight Content */}
                <div className="space-y-4">
                  <div className="prose max-w-none">
                    <p className="text-gray-700 leading-relaxed">
                      {insights.summary || "The patient described experiencing recurring migraines characterized by throbbing pain on the right side of the head, accompanied by nausea, photosensitivity, and visual aura (flashing spots). The doctor identified these symptoms as consistent with migraine headaches and mentioned they would discuss treatment options and preventive measures."}
                    </p>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-64 text-gray-400">
                <div className="text-center">
                  <Volume2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Insights will appear here after analyzing the conversation</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      {showHistory && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg w-11/12 max-w-lg p-6 overflow-y-auto max-h-[80vh]">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Past Sessions</h2>
              <button onClick={() => setShowHistory(false)} className="text-gray-500 hover:text-gray-700">Close</button>
            </div>
            {sessions.length === 0 ? (
              <p className="text-sm text-gray-500">No sessions recorded yet.</p>
            ) : (
              <ul className="space-y-4">
                {sessions.map((s) => (
                  <li key={s.id} className="border rounded p-2">
                    <div className="text-xs text-gray-400 mb-1">{new Date(s.id).toLocaleString()}</div>
                    <div className="text-sm font-medium mb-1">{s.insights?.summary || 'No summary'}</div>
                    <pre className="whitespace-pre-wrap text-xs text-gray-700 max-h-32 overflow-y-auto">{s.transcript}</pre>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}