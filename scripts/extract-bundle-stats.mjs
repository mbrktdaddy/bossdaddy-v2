// Extract module sizes from the bundle analyzer HTML output.
// The analyzer embeds chartData as a base64+gzip JSON blob. Decode it,
// then print top-level chunks and their largest modules.

import { readFileSync, writeFileSync } from 'fs'

const html = readFileSync('.next/analyze/client.html', 'utf8')

// chartData is `window.chartData = [{...}, ...];`  — plain JSON array
const match = html.match(/chartData\s*=\s*(\[[\s\S]*?\]);\s*window\./)
if (!match) {
  console.error('Could not find chartData in HTML')
  process.exit(1)
}

const json = match[1]
const chunks = JSON.parse(json)

writeFileSync('.next/analyze/client-stats.json', JSON.stringify(chunks, null, 2))
console.log(`Wrote .next/analyze/client-stats.json (${json.length} bytes)`)
console.log(`Total chunks: ${chunks.length}`)
console.log('')

// Sort chunks by parsed size descending
chunks.sort((a, b) => b.parsedSize - a.parsedSize)

// Print top 20 chunks
console.log('Top chunks by parsed size:')
console.log('─'.repeat(80))
for (const chunk of chunks.slice(0, 20)) {
  const kb = (chunk.parsedSize / 1024).toFixed(1)
  console.log(`${kb.padStart(7)} KB  ${chunk.label}`)
}

console.log('')
console.log('Top modules across all chunks:')
console.log('─'.repeat(80))

// Collect all leaf modules and sort
function walkModules(group, modules) {
  if (group.groups) {
    for (const sub of group.groups) walkModules(sub, modules)
  } else {
    modules.push(group)
  }
}

const allModules = []
for (const chunk of chunks) {
  walkModules(chunk, allModules)
}
allModules.sort((a, b) => b.parsedSize - a.parsedSize)

for (const mod of allModules.slice(0, 30)) {
  const kb = (mod.parsedSize / 1024).toFixed(1)
  // Truncate long paths
  const label = mod.label.length > 100 ? '...' + mod.label.slice(-97) : mod.label
  console.log(`${kb.padStart(7)} KB  ${label}`)
}
