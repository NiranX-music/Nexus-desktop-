import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import rehypeKatex from 'rehype-katex'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import 'katex/dist/katex.min.css'
import { RiCheckLine, RiFileCopyLine } from 'react-icons/ri'

interface MarkdownMathProps {
  content: string
  className?: string
}

const looksLikeLatexLine = (value: string) =>
  /\\(?:frac|sqrt|sum|prod|int|iint|iiint|oint|lim|alpha|beta|gamma|delta|theta|lambda|mu|pi|sigma|omega|phi|psi|nabla|partial|sin|cos|tan|cot|sec|csc|log|ln|exp|leq|geq|neq|approx|times|div|cdot|pm|mp|rightarrow|leftarrow|Rightarrow|Leftarrow|Leftrightarrow|leftrightarrow|infty|forall|exists|in|notin|subset|subseteq|cup|cap|to|circ)|(?:\^|_)\{|\\(?:begin|end)\{(?:equation|align|gather|pmatrix|bmatrix|vmatrix|matrix)\}/.test(
    value
  )

export const normalizeMathMarkdown = (content = ''): string => {
  if (!content) return ''

  // 1. Replace bracketed math delimiters with standard markdown math delimiters
  let text = content
    .replace(/\\\[([\s\S]*?)\\\]/g, (_match, math) => `\n$$\n${String(math).trim()}\n$$\n`)
    .replace(/\\\(([\s\S]*?)\\\)/g, (_match, math) => `$${String(math).trim()}$`)

  // 2. Handle block environments like \begin{equation}...\end{equation}
  text = text.replace(
    /\\begin\{(equation|align|gather|pmatrix|bmatrix|vmatrix|matrix)\*?\}[\s\S]*?\\end\{\1\*?\}/g,
    (match) => `\n$$\n${match.trim()}\n$$\n`
  )

  // 3. Scan line by line for bare LaTeX lines that missed dollar signs
  return text
    .split('\n')
    .map((line) => {
      const trimmed = line.trim()
      if (
        !trimmed ||
        trimmed.includes('$') ||
        trimmed.startsWith('|') ||
        trimmed.startsWith('```') ||
        trimmed.startsWith('#') ||
        trimmed.startsWith('>') ||
        trimmed.startsWith('- ') ||
        trimmed.startsWith('* ')
      ) {
        return line
      }

      if (looksLikeLatexLine(trimmed)) {
        return `$$\n${trimmed}\n$$`
      }
      return line
    })
    .join('\n')
}

const CodeBlock = ({ children, className }: { children: any; className?: string }) => {
  const [copied, setCopied] = useState(false)
  const language = className ? className.replace(/language-/, '') : ''
  const codeText = String(children || '').replace(/\n$/, '')

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(codeText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }

  // Inline code snippet
  if (!className && !String(children).includes('\n')) {
    return (
      <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-xs text-emerald-300">
        {children}
      </code>
    )
  }

  return (
    <div className="group relative my-3 overflow-hidden rounded-xl border border-white/15 bg-black/85 shadow-lg">
      <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] font-mono text-zinc-400">
        <span className="uppercase text-emerald-400 font-bold tracking-wider">
          {language || 'code'}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 rounded px-2 py-0.5 text-zinc-300 hover:bg-white/10 hover:text-white transition"
          title="Copy code"
        >
          {copied ? (
            <>
              <RiCheckLine className="text-emerald-400" />
              <span className="text-emerald-400">Copied</span>
            </>
          ) : (
            <>
              <RiFileCopyLine />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 text-xs font-mono leading-relaxed text-zinc-100 scrollbar-small">
        <code>{children}</code>
      </pre>
    </div>
  )
}

export default function MarkdownMath({ content, className = '' }: MarkdownMathProps) {
  const normalized = normalizeMathMarkdown(content)

  return (
    <div className={`nexus-math-markdown text-sm leading-relaxed text-zinc-100 space-y-2 ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer noopener"
              className="text-emerald-400 hover:text-emerald-300 underline underline-offset-2 transition"
            >
              {children}
            </a>
          ),
          code: ({ className: codeClassName, children }) => (
            <CodeBlock className={codeClassName}>{children}</CodeBlock>
          ),
          table: ({ children }) => (
            <div className="my-3 overflow-x-auto rounded-xl border border-white/15 bg-black/60 scrollbar-small">
              <table className="w-full text-left text-xs border-collapse">{children}</table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="border-b border-white/15 bg-white/[0.06] text-emerald-300 font-bold">
              {children}
            </thead>
          ),
          th: ({ children }) => <th className="p-2.5 font-mono uppercase tracking-wider">{children}</th>,
          td: ({ children }) => (
            <td className="p-2.5 border-t border-white/5 font-mono text-zinc-200">{children}</td>
          ),
          blockquote: ({ children }) => (
            <blockquote className="my-2 border-l-2 border-emerald-400/80 bg-emerald-500/5 py-1.5 pl-3.5 pr-2 text-zinc-300 italic rounded-r">
              {children}
            </blockquote>
          ),
          ul: ({ children }) => <ul className="list-disc pl-5 space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-5 space-y-1">{children}</ol>,
          img: ({ src, alt }) => (
            <div className="my-3 overflow-hidden rounded-xl border border-emerald-500/30 bg-black/70 p-1">
              <img
                src={src}
                alt={alt || 'Nexus AI Output'}
                className="max-h-[500px] w-auto rounded-lg object-contain transition hover:scale-[1.01]"
                loading="lazy"
              />
              {alt && <div className="p-2 text-center text-xs text-zinc-400 font-mono">{alt}</div>}
            </div>
          )
        }}
      >
        {normalized}
      </ReactMarkdown>
    </div>
  )
}
