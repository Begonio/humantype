import { google } from 'googleapis'
import { OAuth2Client } from 'google-auth-library'
import type { docs_v1 } from 'googleapis'

export function createDocsClient(auth: OAuth2Client) {
  return google.docs({ version: 'v1', auth })
}

/**
 * Create a new Google Doc and return its ID and URL.
 */
export async function createDocument(
  auth: OAuth2Client,
  title = 'HumanType Output'
): Promise<{ docId: string; docUrl: string }> {
  const docs = createDocsClient(auth)
  const response = await docs.documents.create({
    requestBody: { title },
  })
  const docId = response.data.documentId!
  const docUrl = `https://docs.google.com/document/d/${docId}/edit`
  return { docId, docUrl }
}

/**
 * Get the end index of the document body (i.e., where new content should be inserted).
 * For a fresh doc this is 1 (content starts at index 1).
 * For an existing doc, this is the index just before the trailing newline.
 */
export async function getBodyEndIndex(
  auth: OAuth2Client,
  docId: string
): Promise<number> {
  const docs = createDocsClient(auth)
  const response = await docs.documents.get({ documentId: docId })
  const body = response.data.body
  if (!body || !body.content || body.content.length === 0) return 1

  const lastElement = body.content[body.content.length - 1]
  const endIndex = lastElement.endIndex ?? 1
  // The last index is the trailing paragraph marker — insert before it
  return Math.max(1, endIndex - 1)
}

/**
 * Insert text at a specific index in the document.
 */
export async function insertText(
  docs: docs_v1.Docs,
  docId: string,
  text: string,
  index: number
): Promise<void> {
  const requests: docs_v1.Schema$Request[] = [
    {
      insertText: {
        location: { index },
        text,
      },
    },
  ]
  await docs.documents.batchUpdate({
    documentId: docId,
    requestBody: { requests },
  })
}

/**
 * Delete a single character at the given index (for backspace simulation).
 * startIndex is the character to delete (0-based in content terms, but Docs uses 1-based).
 */
export async function deleteChar(
  docs: docs_v1.Docs,
  docId: string,
  index: number
): Promise<void> {
  const requests: docs_v1.Schema$Request[] = [
    {
      deleteContentRange: {
        range: {
          startIndex: index - 1,
          endIndex: index,
        },
      },
    },
  ]
  await docs.documents.batchUpdate({
    documentId: docId,
    requestBody: { requests },
  })
}

/**
 * Flush a buffer of text into the document at the current cursor index.
 * Returns the new cursor position.
 */
export async function flushBuffer(
  docs: docs_v1.Docs,
  docId: string,
  buffer: string,
  cursorIndex: number
): Promise<number> {
  if (!buffer) return cursorIndex
  await insertText(docs, docId, buffer, cursorIndex)
  return cursorIndex + buffer.length
}
