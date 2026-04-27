'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { Upload, FileText, Loader2, Sparkles, Search, CheckCircle, AlertCircle, ShieldCheck, DatabaseZap, FileStack } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { toast } from '@/hooks/use-toast'

interface Document {
  id: string
  name: string
  size: number
  uploadedAt: Date
  status: 'uploading' | 'processing' | 'ready' | 'error'
}

interface QueryAnalysis {
  type: string
  complexity: number
  entities: string[]
  chunksNeeded: number
  confidence: number
}

interface RetrievedChunk {
  id: string
  content: string
  relevance: number
  source: string
}

interface Answer {
  text: string
  chunks?: RetrievedChunk[]
  verification?: {
    claims: number
    verified: number
    accuracy: number
  }
}

export default function DocumentQAPage() {
  const [documents, setDocuments] = useState<Document[]>([])
  const [question, setQuestion] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [analysis, setAnalysis] = useState<QueryAnalysis | null>(null)
  const [answer, setAnswer] = useState<Answer | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const readyCount = documents.filter(d => d.status === 'ready').length
  const totalChunks = answer?.chunks?.length ?? 0

  useEffect(() => {
    const handleBeforeUnload = () => {
      navigator.sendBeacon('/api/documents/cleanup')
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [])

  const handleFileUpload = async (files: FileList | null) => {
    if (!files) return

    const fileArray = Array.from(files)
    const newDocs: Document[] = fileArray.map(file => ({
      id: Date.now() + Math.random().toString(36).substr(2, 9),
      name: file.name,
      size: file.size,
      uploadedAt: new Date(),
      status: 'uploading'
    }))

    setDocuments(prev => [...prev, ...newDocs])

    for (let i = 0; i < newDocs.length; i++) {
      const doc = newDocs[i]
      const formData = new FormData()
      formData.append('file', fileArray[i])

      try {
        setDocuments(prev =>
          prev.map(d =>
            d.id === doc.id ? { ...d, status: 'processing' } : d
          )
        )

        const response = await fetch('/api/documents/upload', {
          method: 'POST',
          body: formData
        })

        if (response.ok) {
          setDocuments(prev =>
            prev.map(d =>
              d.id === doc.id ? { ...d, status: 'ready' } : d
            )
          )
          toast({
            title: 'Success',
            description: `Document "${fileArray[i].name}" processed successfully`
          })
        } else {
          throw new Error('Upload failed')
        }
      } catch (error) {
        setDocuments(prev =>
          prev.map(d =>
            d.id === doc.id ? { ...d, status: 'error' } : d
          )
        )
        toast({
          title: 'Error',
          description: `Failed to process "${fileArray[i].name}"`,
          variant: 'destructive'
        })
      }
    }
  }

  const handleAskQuestion = async () => {
    if (!question.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a question',
        variant: 'destructive'
      })
      return
    }

    const readyDocs = documents.filter(d => d.status === 'ready')
    if (readyDocs.length === 0) {
      toast({
        title: 'Error',
        description: 'Please upload at least one document first',
        variant: 'destructive'
      })
      return
    }

    setIsLoading(true)
    setAnalysis(null)
    setAnswer(null)

    try {
      // First, analyze the question
      const analyzeResponse = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question })
      })

      if (!analyzeResponse.ok) throw new Error('Analysis failed')

      const analysisData = await analyzeResponse.json()
      setAnalysis(analysisData)

      // Then, generate the answer with adaptive retrieval
      const answerResponse = await fetch('/api/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question,
          documentIds: readyDocs.map(d => d.id),
          analysis: analysisData
        })
      })

      if (!answerResponse.ok) throw new Error('Answer generation failed')

      const answerData = await answerResponse.json()
      setAnswer(answerData)
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to process your question',
        variant: 'destructive'
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleClearAll = async () => {
    try {
      const response = await fetch('/api/documents/cleanup', {
        method: 'POST',
      })

      if (!response.ok) {
        throw new Error('Cleanup failed')
      }

      setDocuments([])
      setAnalysis(null)
      setAnswer(null)
      setQuestion('')

      toast({
        title: 'Success',
        description: 'All uploaded documents were cleared.'
      })
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to clear uploaded documents.',
        variant: 'destructive'
      })
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / 1048576).toFixed(1) + ' MB'
  }

  const getQueryTypeColor = (type: string) => {
    switch (type.toLowerCase()) {
      case 'factual': return 'bg-blue-500 hover:bg-blue-600'
      case 'comparative': return 'bg-purple-500 hover:bg-purple-600'
      case 'analytical': return 'bg-orange-500 hover:bg-orange-600'
      case 'aggregative': return 'bg-green-500 hover:bg-green-600'
      case 'yes/no': return 'bg-cyan-500 hover:bg-cyan-600'
      default: return 'bg-gray-500 hover:bg-gray-600'
    }
  }

  const getComplexityColor = (score: number) => {
    if (score <= 3) return 'text-green-600'
    if (score <= 7) return 'text-yellow-600'
    return 'text-red-600'
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-white/60 bg-white/75 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
              <Image
                src="/logo.svg"
                alt="Context Flow logo"
                width={40}
                height={40}
                className="h-8 w-8 object-contain"
                priority
              />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary/80">
                Retrieval Workspace
              </p>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">Context Flow</h1>
              <p className="text-sm text-muted-foreground">Clean answers grounded in your uploaded documents</p>
            </div>
          </div>
          <div className="hidden items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-2 text-xs text-muted-foreground shadow-sm md:flex">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Session cleanup enabled
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
        <section className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
          <div className="rounded-[28px] border border-white/70 bg-white/85 p-6 shadow-[0_18px_60px_-28px_rgba(15,23,42,0.22)] backdrop-blur">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl space-y-3">
                <p className="text-sm font-medium text-primary">Document intelligence without the noise</p>
                <h2 className="text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                  Ask better questions. Get grounded answers.
                </h2>
                <p className="max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">
                  Upload PDFs, retrieve the most relevant chunks with vector search, and turn dense material into responses that feel clear, human, and actually useful.
                </p>
              </div>
              <div className="grid grid-cols-3 gap-3 sm:min-w-[320px]">
                <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                  <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    <FileStack className="h-4 w-4 text-primary" />
                    Ready docs
                  </div>
                  <div className="mt-3 text-2xl font-semibold text-slate-950">{readyCount}</div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                  <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    <DatabaseZap className="h-4 w-4 text-primary" />
                    Chunks used
                  </div>
                  <div className="mt-3 text-2xl font-semibold text-slate-950">{totalChunks}</div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                  <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    <Sparkles className="h-4 w-4 text-primary" />
                    Mode
                  </div>
                  <div className="mt-3 text-sm font-semibold text-slate-950">RAG</div>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[28px] border border-white/70 bg-slate-950 p-6 text-white shadow-[0_18px_60px_-28px_rgba(15,23,42,0.35)]">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-300">Workflow</p>
            <div className="mt-4 space-y-4 text-sm text-slate-300">
              <p>Upload documents, ask a focused question, and review the exact chunks used to construct the answer.</p>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-xs font-semibold text-white">1</div>
                  <p>Parse and split the file into searchable chunks.</p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-xs font-semibold text-white">2</div>
                  <p>Retrieve the most relevant context with Atlas Vector Search.</p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-xs font-semibold text-white">3</div>
                  <p>Generate a concise explanation instead of dumping raw text.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left Column: Document Upload */}
          <div className="lg:col-span-1 space-y-4">
            <Card className="overflow-hidden rounded-[28px] border-white/70 bg-white/85 shadow-[0_18px_60px_-28px_rgba(15,23,42,0.18)]">
              <CardHeader className="border-b border-slate-100 pb-5">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Upload className="h-5 w-5" />
                  Upload Documents
                </CardTitle>
                <CardDescription className="text-sm leading-6">
                  Add your PDFs here to build a temporary retrieval workspace for this session.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-6">
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="group cursor-pointer rounded-[24px] border border-dashed border-slate-300 bg-gradient-to-br from-slate-50 to-white p-8 text-center transition-all hover:border-primary/50 hover:shadow-sm"
                >
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-500 transition-colors group-hover:bg-primary/10 group-hover:text-primary">
                    <FileText className="h-9 w-9" />
                  </div>
                  <p className="mb-2 text-sm font-medium text-slate-700">
                    Drag and drop files here or click to browse
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Supports PDF documents and creates a searchable session workspace
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".pdf"
                    onChange={(e) => handleFileUpload(e.target.files)}
                    className="hidden"
                  />
                </div>

                {/* Document List */}
                {documents.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <ScrollArea className="h-64 rounded-2xl border border-slate-100 bg-slate-50/70 p-2">
                      <div className="space-y-2 pr-4">
                        {documents.map((doc) => (
                          <div
                            key={doc.id}
                            className="flex items-center gap-3 rounded-2xl border border-white bg-white/90 p-3 shadow-sm"
                          >
                            {doc.status === 'uploading' && (
                              <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                            )}
                            {doc.status === 'processing' && (
                              <Loader2 className="h-4 w-4 animate-spin text-orange-500" />
                            )}
                            {doc.status === 'ready' && (
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            )}
                            {doc.status === 'error' && (
                              <AlertCircle className="h-4 w-4 text-red-500" />
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{doc.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {formatFileSize(doc.size)}
                              </p>
                            </div>
                            <Badge variant="outline" className="text-xs">
                              {doc.status}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                    <div className="flex justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleClearAll}
                        className="rounded-full border-red-200 bg-white text-red-600 hover:bg-red-50 hover:text-red-700"
                      >
                        Clear All
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Query Analysis Preview */}
            {analysis && (
              <Card className="rounded-[28px] border border-primary/15 bg-white/85 shadow-[0_18px_60px_-28px_rgba(15,23,42,0.16)]">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Sparkles className="h-4 w-4" />
                    Smart Analysis
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Query Type:</span>
                    <Badge className={`rounded-full px-3 py-1 ${getQueryTypeColor(analysis.type)}`}>
                      {analysis.type.toUpperCase()}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Complexity:</span>
                    <span className={`font-semibold ${getComplexityColor(analysis.complexity)}`}>
                      {analysis.complexity}/10
                    </span>
                  </div>
                  <div className="space-y-2">
                    <span className="text-sm text-muted-foreground">Entities Detected:</span>
                    <div className="flex flex-wrap gap-1">
                      {analysis.entities.map((entity, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">
                          {entity}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Chunks Retrieving:</span>
                    <span className="font-semibold text-primary">{analysis.chunksNeeded}</span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-sm text-muted-foreground">Confidence:</span>
                    <Progress value={analysis.confidence} className="h-2" />
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Column: Q&A Interface */}
          <div className="lg:col-span-2 space-y-4">
            <Card className="rounded-[28px] border-white/70 bg-white/85 shadow-[0_18px_60px_-28px_rgba(15,23,42,0.18)]">
              <CardHeader className="border-b border-slate-100 pb-5">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Search className="h-5 w-5" />
                  Ask Your Question
                </CardTitle>
                <CardDescription className="text-sm leading-6">
                  Ask naturally. Context Flow will retrieve the most relevant chunks and turn them into a grounded answer.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5 pt-6">
                <Textarea
                  placeholder="Ask a question about your documents. For example: Explain asymmetric-key cryptography in simple terms."
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleAskQuestion()
                    }
                  }}
                  rows={4}
                  className="resize-none rounded-2xl border-slate-200 bg-slate-50/70 px-4 py-3 text-base shadow-inner"
                />
                <Button
                  onClick={handleAskQuestion}
                  disabled={isLoading || readyCount === 0}
                  className="h-12 w-full rounded-2xl bg-slate-950 text-white shadow-lg shadow-slate-950/10 transition hover:bg-slate-800"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Get Answer
                    </>
                  )}
                </Button>

                {isLoading && (
                  <div className="space-y-3">
                    <Alert className="rounded-2xl border-slate-200 bg-slate-50/80">
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      <AlertDescription className="text-sm">
                        {analysis
                          ? `Retrieving ${analysis.chunksNeeded} chunks and generating answer...`
                          : 'Analyzing your question...'
                        }
                      </AlertDescription>
                    </Alert>
                  </div>
                )}

                {/* Answer Display */}
                {answer && !isLoading && (
                  <div className="space-y-4">
                    <Alert className="rounded-2xl border-emerald-200 bg-emerald-50 dark:bg-green-950 dark:border-green-900">
                      <CheckCircle className="h-4 w-4 text-green-600 mr-2" />
                      <AlertDescription className="text-sm text-green-900 dark:text-green-100">
                        Answer generated using document content
                      </AlertDescription>
                    </Alert>

                    <div className="space-y-5 rounded-[24px] border border-slate-100 bg-white p-6 shadow-sm">
                      <h3 className="font-semibold text-lg">Answer</h3>
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        <ReactMarkdown
                          components={{
                            p: ({ children }) => (
                              <p className="text-muted-foreground leading-relaxed">
                                {children}
                              </p>
                            ),
                            ul: ({ children }) => (
                              <ul className="text-muted-foreground list-disc pl-6 space-y-1">
                                {children}
                              </ul>
                            ),
                            ol: ({ children }) => (
                              <ol className="text-muted-foreground list-decimal pl-6 space-y-1">
                                {children}
                              </ol>
                            ),
                            li: ({ children }) => <li>{children}</li>,
                            strong: ({ children }) => (
                              <strong className="font-semibold text-foreground">
                                {children}
                              </strong>
                            ),
                          }}
                        >
                          {answer.text}
                        </ReactMarkdown>
                      </div>

                      {/* Verification Stats */}
                      {answer.verification && (
                        <div className="mt-4 border-t border-slate-100 pt-4">
                          <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
                            <CheckCircle className="h-4 w-4 text-green-500" />
                            Verification Results
                          </h4>
                          <div className="grid grid-cols-3 gap-4">
                            <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-3 text-center">
                              <div className="text-2xl font-bold text-primary">{answer.verification.claims}</div>
                              <div className="text-xs text-muted-foreground">Claims</div>
                            </div>
                            <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-3 text-center">
                              <div className="text-2xl font-bold text-green-600">{answer.verification.verified}</div>
                              <div className="text-xs text-muted-foreground">Verified</div>
                            </div>
                            <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-3 text-center">
                              <div className="text-2xl font-bold text-green-600">{answer.verification.accuracy}%</div>
                              <div className="text-xs text-muted-foreground">Accuracy</div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Retrieved Chunks */}
                      {answer.chunks && answer.chunks.length > 0 && (
                        <div className="border-t border-slate-100 pt-4">
                          <h4 className="font-medium text-sm mb-3">
                            Source Documents ({answer.chunks.length} chunks retrieved)
                          </h4>
                          <ScrollArea className="h-64 rounded-2xl bg-slate-50/70 p-2">
                            <div className="space-y-3 pr-4">
                              {answer.chunks.map((chunk, i) => (
                                <div
                                  key={chunk.id}
                                  className="rounded-2xl border border-white bg-white p-4 shadow-sm"
                                >
                                  <div className="flex items-start justify-between mb-2">
                                    <Badge variant="outline" className="text-xs">
                                      Chunk {i + 1}
                                    </Badge>
                                    <Badge
                                      variant="secondary"
                                      className="text-xs"
                                    >
                                      {(chunk.relevance * 100).toFixed(0)}% relevant
                                    </Badge>
                                  </div>
                                  <p className="text-sm text-muted-foreground line-clamp-3">
                                    {chunk.content}
                                  </p>
                                  <p className="text-xs text-muted-foreground mt-2">
                                    Source: {chunk.source}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </ScrollArea>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Info Card */}
            <Card className="rounded-[28px] border border-primary/15 bg-white/85 shadow-[0_18px_60px_-28px_rgba(15,23,42,0.16)]">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Sparkles className="h-4 w-4" />
                  How It Works
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 text-sm md:grid-cols-2">
                <div className="flex gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                  <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">1</div>
                  <div>
                    <p className="font-medium">Upload Documents</p>
                    <p className="text-muted-foreground">Upload PDF documents that will be processed and indexed for intelligent search</p>
                  </div>
                </div>
                <div className="flex gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                  <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">2</div>
                  <div>
                    <p className="font-medium">Smart Question Analysis</p>
                    <p className="text-muted-foreground">Our system analyzes your question type, complexity, and entities to understand what you need</p>
                  </div>
                </div>
                <div className="flex gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                  <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">3</div>
                  <div>
                    <p className="font-medium">Adaptive Retrieval</p>
                    <p className="text-muted-foreground">Automatically retrieves 2-15 chunks based on your question's needs - not a fixed amount</p>
                  </div>
                </div>
                <div className="flex gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                  <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">4</div>
                  <div>
                    <p className="font-medium">Verified Answers</p>
                    <p className="text-muted-foreground">AI generates accurate, well-cited answers with full verification of all claims</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}
