import ReactMarkdown from 'react-markdown'
import rehypeKatex from 'rehype-katex'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import 'katex/dist/katex.min.css'

interface MarkdownMathProps {
  content: string
  className?: string
}

const looksLikeLatexLine = (value: string) =>
  /\\(?:frac|sqrt|sum|prod|int|lim|alpha|beta|gamma|delta|theta|lambda|mu|pi|sigma|omega|sin|cos|tan|log|ln|leq|geq|neq|times|div|cdot|approx|rightarrow|leftarrow|infty)|(?:\^|_)\{/.test(
    value
  )

export const normalizeMathMarkdown = (content = '') =>
  content
    .replace(/\\\[([\s\S]*?)\\\]/g, (_match, math) => `\n$$\n${String(math).trim()}\n$$\n`)
    .replace(/\\\(([\s\S]*?)\\\)/g, (_match, math) => `$${String(math).trim()}$`)
    .split('\n')
    .map((line) => {
      const trimmed = line.trim()
      if (!trimmed || trimmed.includes('$') || trimmed.startsWith('|') || trimmed.startsWith('```')) {
        return line
      }
      return looksLikeLatexLine(trimmed) ? `$$${trimmed}$$` : line
    })
    .join('\n')

export default function MarkdownMath({ content, className = '' }: MarkdownMathProps) {
  return (
    <div className={`nexus-math-markdown ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noreferrer noopener">
              {children}
            </a>
          ),
          code: ({ children }) => <code>{children}</code>,
          pre: ({ children }) => <pre>{children}</pre>
        }}
      >
        {normalizeMathMarkdown(content)}
      </ReactMarkdown>
    </div>
  )
}
