import type { TextItem } from 'pdfjs-dist/types/src/display/api'
import type { TextContent } from 'pdfjs-dist/types/src/display/text_layer'
import type { HighlightOptions, Match } from '../types'

function getTextItems(textContent: TextContent) {
  return textContent.items.map(val => (val as TextItem).str)
}

function searchQuery(textItems: string[], query: string, options: HighlightOptions) {
  const textJoined = textItems.join(' ')
  const regexFlags = ['g']
  if (options.ignoreCase)
    regexFlags.push('i')

  let fquery = query.trim()
  if (options.completeWords)
    fquery = `\\b${fquery}\\b`

  const regex = new RegExp(fquery, regexFlags.join(''))

  const matches = []
  let match

  // eslint-disable-next-line no-cond-assign
  while ((match = regex.exec(textJoined)) !== null)
    matches.push([match.index, match[0].length, match[0]])

  return matches
}

function convertMatches(matches: (number | string)[][], textItems: string[]): Match[] {
  let index = 0
  let tindex = 0
  const end = textItems.length - 1

  const convertedMatches = []

  // iterate over all matches
  for (let m = 0; m < matches.length; m++) {
    let mindex = matches[m][0] as number

    while (index !== end && mindex >= tindex + textItems[index].length) {
      tindex += textItems[index].length + 1
      index++
    }

    const divStart = {
      idx: index,
      offset: mindex - tindex,
    }

    mindex += matches[m][1] as number

    while (index !== end && mindex > tindex + textItems[index].length) {
      tindex += textItems[index].length + 1
      index++
    }

    const divEnd = {
      idx: index,
      offset: mindex - tindex,
    }
    convertedMatches.push({
      start: divStart,
      end: divEnd,
      str: matches[m][2] as string,
      oindex: matches[m][0] as number,
    })
  }
  return convertedMatches
}

function highlightMatches(matches: Match[], textContent: TextContent, textDivs: HTMLElement[]) {
  function appendHighlightDiv(idx: number, startOffset = -1, endOffset = -1) {
    const textItem = textContent.items[idx] as TextItem
    const nodes = []

    let content = ''
    let prevContent = ''
    let nextContent = ''

    let div = textDivs[idx]

    if (!div)
      return // don't process if div is undefinied

    if (div.nodeType === Node.TEXT_NODE) {
      const span = document.createElement('span')
      div.before(span)
      span.append(div)
      textDivs[idx] = span
      div = span
    }

    if (startOffset >= 0 && endOffset >= 0)
      content = textItem.str.substring(startOffset, endOffset)
    else if (startOffset < 0 && endOffset < 0)
      content = textItem.str
    else if (startOffset >= 0)
      content = textItem.str.substring(startOffset)
    else if (endOffset >= 0)
      content = textItem.str.substring(0, endOffset)

    const node = document.createTextNode(content)
    const span = document.createElement('span')
    span.className = 'highlight appended'
    span.append(node)

    nodes.push(span)

    if (startOffset > 0) {
      prevContent = textItem.str.substring(0, startOffset)
      const node = document.createTextNode(prevContent)
      nodes.unshift(node)
    }
    if (endOffset > 0) {
      nextContent = textItem.str.substring(endOffset)
      const node = document.createTextNode(nextContent)
      nodes.push(node)
    }

    div.replaceChildren(...nodes)
  }

  for (const match of matches) {
    if (match.start.idx === match.end.idx) {
      appendHighlightDiv(match.start.idx, match.start.offset, match.end.offset)
    }
    else {
      for (let si = match.start.idx, ei = match.end.idx; si <= ei; si++) {
        if (si === match.start.idx)
          appendHighlightDiv(si, match.start.offset)
        else if (si === match.end.idx)
          appendHighlightDiv(si, -1, match.end.offset)
        else
          appendHighlightDiv(si)
      }
    }
  }
}

function resetDivs(textContent: TextContent, textDivs: HTMLElement[]) {
  const textItems = getTextItems(textContent)
  for (let idx = 0; idx < textDivs.length; idx++) {
    const div = textDivs[idx]

    if (div && div.nodeType !== Node.TEXT_NODE) {
      const textNode = document.createTextNode(textItems[idx])
      div.replaceChildren(textNode)
    }
  }
}

function findMatches(query: string, textContent: TextContent, options: HighlightOptions) {
  const textItems = getTextItems(textContent)
  const matches = searchQuery(textItems, query, options)
  return convertMatches(matches, textItems)
}

export { findMatches, highlightMatches, resetDivs }

