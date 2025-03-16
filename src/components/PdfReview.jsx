"use client";

import { useState, useEffect, useRef } from "react";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker?url";
import { UploadCloud, Send, BookOpen, Loader } from "lucide-react";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

export default function PdfReview() {
  const [file, setFile] = useState(null);
  const [pdfDocument, setPdfDocument] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [pageContents, setPageContents] = useState({});
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [messages, setMessages] = useState([]);
  const [userMessage, setUserMessage] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [pdfText, setFullPdfText] = useState("");
  const [streamingResponse, setStreamingResponse] = useState("");
  const [scale, setScale] = useState(1.5);
  const chatContainerRef = useRef(null);
  const canvasRef = useRef(null);
  const canvasContainerRef = useRef(null);
  const fileInputRef = useRef(null);
  const abortControllerRef = useRef(null);
  const part1 = "sk-proj-SQqJrkQINgcigJa47WlIPaZdPA_mE84HF-";
  const part2 =
    "DI1G0I9oPjAG3r49nHfBgd19uOGykT6qsl87jnCgT3BlbkFJctvFcfDj1OCJQgjAU_";
  const part3 = "9sphyRpjdOrgkrmFHsR6SLw3PmNkyW-5Ma-ibSpmyniQ2uIrCYq5t80A";
  const apiKey = `${part1}${part2}${part3}`;

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop =
        chatContainerRef.current.scrollHeight;
    }
  }, [messages, streamingResponse]);

  useEffect(() => {
    if (pdfDocument) {
      renderPage(currentPage);
    }
  }, [pdfDocument, currentPage, scale]);

  // Add resize listener to adjust PDF scale on window resize
  useEffect(() => {
    const handleResize = () => {
      if (pdfDocument && canvasContainerRef.current) {
        calculateScale();
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [pdfDocument]);

  // Clean up abort controller on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const calculateScale = () => {
    if (!pdfDocument || !canvasContainerRef.current) return;

    // Get container width
    const containerWidth = canvasContainerRef.current.clientWidth;
    // Use a responsive scale based on device width
    let newScale = 1.5; // Default scale for desktop

    if (containerWidth < 480) {
      // Mobile devices
      newScale = 1.6;
    } else if (containerWidth < 768) {
      // Tablets
      newScale = 1.5;
    }

    if (newScale !== scale) {
      setScale(newScale);
    }
  };

  const handleFileUpload = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event) => {
    if (!event.target.files.length) return;

    const uploadedFile = event.target.files[0];
    setFile(uploadedFile);
    setMessages([]);
    setIsUploading(true);
    setUploadProgress(10);

    try {
      const { text, pdf, contents } = await extractTextFromPDF(uploadedFile);
      setUploadProgress(50);
      setFullPdfText(text);
      setPdfDocument(pdf);
      setPageContents(contents);
      setTotalPages(pdf.numPages);
      setUploadProgress(100);
      setTimeout(() => {
        setIsUploading(false);
        // Calculate appropriate scale after PDF is loaded
        calculateScale();
      }, 500);

      setMessages([
        {
          role: "system",
          content:
            "PDF uploaded successfully. You can now ask questions about the document.",
        },
      ]);
    } catch (error) {
      console.error("Error processing file:", error);
      setIsUploading(false);
      setMessages([
        { role: "system", content: "Error: Unable to process the file." },
      ]);
    }
  };

  const extractTextFromPDF = async (file) => {
    const fileReader = new FileReader();
    return new Promise((resolve, reject) => {
      fileReader.onload = async () => {
        try {
          const typedArray = new Uint8Array(fileReader.result);
          const pdf = await pdfjsLib.getDocument({ data: typedArray }).promise;
          let fullText = "";
          const contents = {};

          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items
              .map((item) => item.str)
              .join(" ");
            fullText += `Page ${i}: ${pageText}\n\n`;
            contents[i] = pageText;
          }

          resolve({ text: fullText, pdf, contents });
        } catch (error) {
          reject(error);
        }
      };
      fileReader.readAsArrayBuffer(file);
    });
  };

  const renderPage = async (pageNumber) => {
    if (!pdfDocument || !canvasRef.current) return;

    try {
      const page = await pdfDocument.getPage(pageNumber);
      const canvas = canvasRef.current;
      const context = canvas.getContext("2d");

      // Use the current scale value which is responsive to device width
      const viewport = page.getViewport({ scale });

      canvas.width = viewport.width;
      canvas.height = viewport.height;

      await page.render({ canvasContext: context, viewport }).promise;
    } catch (error) {
      console.error("Error rendering page:", error);
    }
  };

  const handleZoomIn = () => {
    setScale((prev) => Math.min(prev + 0.2, 3.0));
  };

  const handleZoomOut = () => {
    setScale((prev) => Math.max(prev - 0.2, 0.5));
  };

  const analyzeContentForCitations = (text) => {
    // Advanced content-based page reference detection
    const pages = [];
    const significantPhrases = extractSignificantPhrases(text);

    // For each page, calculate similarity score with the response
    Object.entries(pageContents).forEach(([pageNum, content]) => {
      const pageNumber = parseInt(pageNum, 10);
      let matchScore = 0;

      // Look for significant phrases from the response in this page
      significantPhrases.forEach((phrase) => {
        if (content.includes(phrase)) {
          // Longer matches get higher scores
          matchScore += phrase.length / 4;
        }
      });

      // Add page if it has a reasonable match score
      if (matchScore > 5) {
        pages.push(pageNumber);
      }
    });

    // Sort pages by number
    return pages.sort((a, b) => a - b);
  };

  const extractSignificantPhrases = (text) => {
    // Extract meaningful multi-word phrases (3+ words)
    const phrases = [];

    // First, split the text into sentences
    const sentences = text.replace(/([.?!])\s+/g, "$1|").split("|");

    sentences.forEach((sentence) => {
      // Split into words
      const words = sentence.trim().split(/\s+/);

      // Extract 3-word phrases
      if (words.length >= 3) {
        for (let i = 0; i < words.length - 2; i++) {
          const phrase = words.slice(i, i + 3).join(" ");
          // Only consider phrases with meaningful words
          if (phrase.length > 12 && !/^[a-z\s]+$/i.test(phrase)) {
            phrases.push(phrase);
          }
        }
      }
    });

    return phrases;
  };

  const sendMessageToAI = async () => {
    if (!userMessage.trim() || !pdfText) return;

    const newMessages = [...messages, { role: "user", content: userMessage }];
    setMessages(newMessages);
    setUserMessage("");
    setIsChatLoading(true);
    setStreamingResponse("");

    // Create new AbortController for this request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [
              {
                role: "system",
                content:
                  "You are an AI assistant for reviewing PDFs. Please structure your response with clear paragraphs separated by double newlines (\n\n). Focus on answering the question with accurate information from the document.",
              },
              { role: "user", content: `PDF Text:\n${pdfText}` },
              ...newMessages.map((msg) => ({
                role: msg.role,
                content: msg.content,
              })),
            ],
            stream: true,
          }),
          signal: abortControllerRef.current.signal,
        }
      );

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let completeResponse = "";

      // Process the stream
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ") && line !== "data: [DONE]") {
            try {
              const data = JSON.parse(line.substring(6));
              const content = data.choices[0]?.delta?.content || "";
              if (content) {
                completeResponse += content;
                setStreamingResponse(completeResponse);
              }
            } catch (e) {
              console.error("Error parsing stream chunk:", e);
            }
          }
        }
      }

      // Process the complete response
      const paragraphs = completeResponse.split("\n\n");

      // Analyze response for page references based on content
      const referencedPages = analyzeContentForCitations(completeResponse);

      // Add the complete message to the messages array
      setMessages([
        ...newMessages,
        {
          role: "assistant",
          content: paragraphs.join("\n\n"),
          citations: referencedPages,
        },
      ]);
      setStreamingResponse("");
    } catch (error) {
      // Don't show error if it was an abort
      if (error.name !== "AbortError") {
        console.error("Error sending message:", error);
        setMessages([
          ...newMessages,
          {
            role: "assistant",
            content: ["Error: Unable to respond. Please try again."],
            citations: [],
          },
        ]);
      }
    } finally {
      setIsChatLoading(false);
    }
  };

  const navigateToPage = (pageNumber) => {
    if (pageNumber > 0 && pageNumber <= totalPages) {
      setCurrentPage(pageNumber);
    }
  };

  return (
    <div className="p-4 md:p-12 flex flex-col min-h-[calc(100vh-100px)]">
      <h1 className="text-xl md:text-2xl text-center font-bold text-gray-800">
        AI-Powered PDF Assistant
      </h1>
      <p className="text-gray-600 mb-4 text-center">
        Upload a PDF and ask AI questions about its content.
      </p>

      {/* File Upload Section */}
      <div className="max-w-4xl mb-8 md:mb-12 mx-auto w-full">
        <label className="w-full flex flex-col items-center justify-center p-6 md:p-12 border-2 border-dashed border-green-400 rounded-2xl bg-gray-50 hover:bg-gray-100 transition-all duration-300 cursor-pointer">
          <UploadCloud className="w-8 md:w-12 h-8 md:h-12 text-green-300 mb-4 md:mb-6" />
          {isUploading ? (
            <div className="flex flex-col items-center">
              <div className="flex items-center mb-2">
                <Loader className="animate-spin w-4 md:w-6 h-4 md:h-6 mr-2 text-green-400" />
                <span>Processing PDF... {uploadProgress}%</span>
              </div>
              <div className="w-64 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-400 transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>
            </div>
          ) : (
            <span className="text-base md:text-lg px-4 md:px-6 lg:px-32 text-center font-semibold break-words w-full text-gray-800">
              {file ? file.name : "Upload PDF File"}
            </span>
          )}
          <input
            type="file"
            accept=".pdf"
            className="hidden"
            ref={fileInputRef}
            onChange={handleFileChange}
            disabled={isUploading}
          />
        </label>
      </div>

      {/* PDF Viewer */}
      {pdfDocument && (
        <div className="flex flex-col lg:flex-row flex-1 gap-4 md:gap-6 mt-4">
          {/* Chat Interface */}
          <div className="w-full lg:w-1/2 flex flex-col">
            <div
              ref={chatContainerRef}
              className="flex-1 overflow-y-auto border p-3 mb-2 max-h-[50vh] lg:max-h-[70vh]"
            >
              {messages.map((msg, index) => (
                <div
                  key={index}
                  className={`p-2 my-1 rounded ${
                    msg.role === "user" ? "bg-blue-100 self-end" : "bg-gray-100"
                  }`}
                >
                  <strong>{msg.role === "user" ? "You" : "AI"}:</strong>{" "}
                  {msg.role === "assistant" ? (
                    <div>
                      {/* Ensure content is always treated as a string */}
                      {msg.content.split("\n\n").map((paragraph, i) => (
                        <p key={i} className="mb-2">
                          {paragraph}
                        </p>
                      ))}

                      {/* Citation buttons */}
                      {msg.citations && msg.citations.length > 0 && (
                        <div className="mt-3 pt-2 border-t">
                          <strong className="text-sm text-gray-600">
                            Source Pages:
                          </strong>
                          <div className="flex flex-wrap gap-2 mt-1">
                            {msg.citations.map((pageNum) => (
                              <button
                                key={pageNum}
                                onClick={() => navigateToPage(pageNum)}
                                className="flex items-center px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded text-sm border border-blue-200"
                              >
                                <BookOpen className="w-3 h-3 mr-1" />
                                Page {pageNum}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p>{msg.content}</p>
                  )}
                </div>
              ))}

              {/* Streaming response */}
              {streamingResponse && (
                <div className="p-2 my-1 rounded bg-gray-100">
                  <strong>AI:</strong>{" "}
                  <div className="streaming-text">
                    {streamingResponse.split("\n\n").map((paragraph, i) => (
                      <p key={i} className="mb-2">
                        {paragraph}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {/* Loading indicator */}
              {isChatLoading && !streamingResponse && (
                <div className="p-2 my-1 rounded bg-gray-100 flex items-center">
                  <Loader className="animate-spin w-4 h-4 mr-2 text-blue-500" />
                  <span className="text-gray-600">AI is thinking...</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 relative">
              <input
                type="text"
                value={userMessage}
                onChange={(e) => setUserMessage(e.target.value)}
                className="flex-1 p-2 border rounded"
                placeholder="Ask something about the PDF..."
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessageToAI();
                  }
                }}
                disabled={isChatLoading}
              />
              <button
                onClick={sendMessageToAI}
                disabled={isChatLoading}
                className={`px-2 lg:px-4 py-2 text-xs lg:text-md rounded flex items-center transition-colors ${
                  isChatLoading
                    ? "bg-gray-400 text-white"
                    : "bg-green-500 text-white hover:bg-green-600"
                }`}
              >
                {isChatLoading ? (
                  <>
                    <Loader className="animate-spin w-4 h-4 mr-2" />
                    Sending
                  </>
                ) : (
                  <>
                    Send <Send size={20} className="ml-2" />
                  </>
                )}
              </button>
            </div>
          </div>

          {/* PDF Viewer */}
          <div
            className="w-full lg:w-1/2 flex flex-col items-center"
            ref={canvasContainerRef}
          >
            <div className="w-full relative overflow-auto max-h-[50vh] lg:max-h-[70vh] bg-gray-100 border">
              <canvas
                ref={canvasRef}
                className="mx-auto shadow-md touch-manipulation"
                style={{
                  display: "block",
                  maxWidth: "100%",
                }}
              />
            </div>

            {/* Zoom controls */}
            <div className="flex justify-between items-center mt-2 w-full px-2 lg:px-10">
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleZoomOut}
                  className="px-2 py-1 bg-gray-200 rounded hover:bg-gray-300"
                  aria-label="Zoom out"
                >
                  -
                </button>
                <span className="text-sm">{Math.round(scale * 100)}%</span>
                <button
                  onClick={handleZoomIn}
                  className="px-2 py-1 bg-gray-200 rounded hover:bg-gray-300"
                  aria-label="Zoom in"
                >
                  +
                </button>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() =>
                    setCurrentPage((prev) => Math.max(1, prev - 1))
                  }
                  className="px-4 py-1 bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-50"
                  disabled={currentPage <= 1}
                >
                  Prev
                </button>
                {/* <span className="text-sm">
                  Page {currentPage} of {totalPages}
                </span> */}
                <button
                  onClick={() =>
                    setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                  }
                  className="px-4 py-1 bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-50"
                  disabled={currentPage >= totalPages}
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
