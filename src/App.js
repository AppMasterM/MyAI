import React, { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";

const BACKEND_URL = "https://myai-backend.app2010master.workers.dev";

const STORAGE_KEYS = {
  conversations: "myai_conversations",
  currentChat: "myai_current_chat",
  oldMessages: "myai_messages",
  theme: "myai_theme",
  authToken: "myai_auth_token",
  authUser: "myai_auth_user",
};

const CLOUD_MAX_CONVERSATIONS = 50;
const CLOUD_MAX_MESSAGES = 200;

const MAX_FILES = 5;
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_TEXT_FILE_SIZE = 2 * 1024 * 1024;
const MAX_TEXT_CONTENT_CHARS = 100000;
const MAX_IMAGE_DATA_URL_LENGTH = 1400000;

const MAX_PDF_PAGES = 50;
const MAX_PDF_TEXT_CHARS = 100000;
const MAX_ZIP_FILES = 100;
const MAX_ZIP_TEXT_FILE_SIZE = 2 * 1024 * 1024;
const MAX_ZIP_TEXT_CHARS = 100000;

const TEXT_EXTENSIONS = [
  "txt",
  "md",
  "markdown",
  "json",
  "js",
  "jsx",
  "ts",
  "tsx",
  "css",
  "html",
  "htm",
  "xml",
  "svg",
  "py",
  "java",
  "kt",
  "kts",
  "c",
  "cpp",
  "h",
  "hpp",
  "cs",
  "go",
  "rs",
  "php",
  "rb",
  "swift",
  "sql",
  "sh",
  "bash",
  "yaml",
  "yml",
  "toml",
  "ini",
  "env",
  "log",
];

function getAuthToken() {
  try {
    return localStorage.getItem(STORAGE_KEYS.authToken) || "";
  } catch (error) {
    console.error("Unable to read auth token:", error);
    return "";
  }
}

function saveAuthSession(token, user) {
  try {
    if (token) {
      localStorage.setItem(STORAGE_KEYS.authToken, token);
    } else {
      localStorage.removeItem(STORAGE_KEYS.authToken);
    }

    if (user) {
      localStorage.setItem(STORAGE_KEYS.authUser, JSON.stringify(user));
    } else {
      localStorage.removeItem(STORAGE_KEYS.authUser);
    }
  } catch (error) {
    console.error("Unable to save auth session:", error);
  }
}

function loadSavedAuthUser() {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.authUser);
    return saved ? JSON.parse(saved) : null;
  } catch (error) {
    console.error("Unable to load saved auth user:", error);
    return null;
  }
}

function clearAuthSession() {
  saveAuthSession("", null);
}

function getServerPayload(result) {
  if (!result || typeof result !== "object") {
    return null;
  }

  return result.data && typeof result.data === "object" ? result.data : result;
}

function getAuthTokenFromResponse(result) {
  const payload = getServerPayload(result);

  const candidates = [
    payload?.token,
    payload?.accessToken,
    payload?.sessionToken,
    result?.token,
    result?.accessToken,
    result?.sessionToken,
  ];

  return (
    candidates.find((value) => typeof value === "string" && value.trim()) || ""
  );
}

function getUserFromResponse(result) {
  const payload = getServerPayload(result);

  const candidates = [
    payload?.user,
    result?.user,
    payload?.account,
    result?.account,
  ];

  const user = candidates.find(
    (value) => value && typeof value === "object" && !Array.isArray(value)
  );

  if (!user) {
    return null;
  }

  return {
    ...user,
    id: user.id ?? user.userId ?? null,
    name: user.name || user.username || user.email || "MyAI User",
    email: user.email || "",
  };
}

function getConversationArray(result) {
  const payload = getServerPayload(result);

  const candidates = [
    payload?.conversations,
    result?.conversations,
    payload?.items,
    result?.items,
    Array.isArray(payload) ? payload : null,
    Array.isArray(result) ? result : null,
  ];

  return candidates.find(Array.isArray) || [];
}

function getMessagesArray(result) {
  const payload = getServerPayload(result);

  const candidates = [
    payload?.messages,
    result?.messages,
    payload?.conversation?.messages,
    result?.conversation?.messages,
  ];

  return candidates.find(Array.isArray) || [];
}

function getCloudConversationId(conversation) {
  const value =
    conversation?.cloudId ??
    conversation?.conversationId ??
    conversation?.serverId ??
    conversation?.id;

  return value === undefined || value === null ? "" : String(value);
}

function normalizeCloudConversation(conversation) {
  const normalized = normalizeConversation({
    id:
      conversation?.localId || `cloud-${getCloudConversationId(conversation)}`,
    title: conversation?.title || conversation?.name || "New Chat",
    createdAt:
      conversation?.createdAt ||
      conversation?.created_at ||
      conversation?.created ||
      Date.now(),
    updatedAt:
      conversation?.updatedAt ||
      conversation?.updated_at ||
      conversation?.updated ||
      conversation?.createdAt ||
      Date.now(),
    messages: conversation?.messages || [],
  });

  normalized.cloudId = getCloudConversationId(conversation);

  return normalized;
}

function normalizeMessage(message) {
  if (!message || typeof message !== "object") {
    return null;
  }

  const role =
    message.role === "assistant" || message.role === "system"
      ? message.role
      : "user";

  const content =
    typeof message.content === "string"
      ? message.content
      : message.text != null
      ? String(message.text)
      : "";

  return {
    ...message,
    id:
      message.id ||
      message.messageId ||
      `message-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    role,
    content,
    createdAt: message.createdAt || message.created_at || Date.now(),
  };
}

function normalizeConversation(conversation) {
  const messages = Array.isArray(conversation?.messages)
    ? conversation.messages.map(normalizeMessage).filter(Boolean)
    : [];

  return {
    id:
      conversation?.id ||
      `chat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: conversation?.title || "New Chat",
    createdAt:
      conversation?.createdAt || conversation?.created_at || Date.now(),
    updatedAt:
      conversation?.updatedAt || conversation?.updated_at || Date.now(),
    messages,
    cloudId: conversation?.cloudId ? String(conversation.cloudId) : "",
  };
}

function stripPreviewData(conversations) {
  return conversations.map((conversation) => ({
    ...conversation,
    messages: (conversation.messages || []).map((message) => ({
      ...message,
      attachments: Array.isArray(message.attachments)
        ? message.attachments.map((attachment) => ({
            ...attachment,
            preview: undefined,
            dataUrl: undefined,
            data: undefined,
          }))
        : message.attachments,
    })),
  }));
}

function loadStoredConversations() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.conversations);

    if (raw) {
      const parsed = JSON.parse(raw);

      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed
          .map(normalizeConversation)
          .sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0));
      }
    }
  } catch (error) {
    console.error("Unable to load stored conversations:", error);
  }

  try {
    const oldMessagesRaw = localStorage.getItem(STORAGE_KEYS.oldMessages);

    if (oldMessagesRaw) {
      const oldMessages = JSON.parse(oldMessagesRaw);

      if (Array.isArray(oldMessages) && oldMessages.length) {
        return [
          normalizeConversation({
            id: `chat-${Date.now()}`,
            title: "New Chat",
            createdAt: Date.now(),
            updatedAt: Date.now(),
            messages: oldMessages,
          }),
        ];
      }
    }
  } catch (error) {
    console.error("Unable to migrate old messages:", error);
  }

  return [
    normalizeConversation({
      id: `chat-${Date.now()}`,
      title: "New Chat",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: [],
    }),
  ];
}

function loadCurrentChatId(conversations) {
  try {
    const storedId = localStorage.getItem(STORAGE_KEYS.currentChat);

    if (
      storedId &&
      conversations.some((conversation) => conversation.id === storedId)
    ) {
      return storedId;
    }
  } catch (error) {
    console.error("Unable to load current chat:", error);
  }

  return conversations[0]?.id || "";
}

function loadStoredTheme() {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.theme);

    if (stored === "light" || stored === "dark") {
      return stored;
    }
  } catch (error) {
    console.error("Unable to load theme:", error);
  }

  return "dark";
}

function getFileExtension(name = "") {
  const cleanName = name.split("?")[0].split("#")[0];
  const parts = cleanName.split(".");

  if (parts.length < 2) {
    return "";
  }

  return parts.pop().toLowerCase();
}

function isTextFile(file) {
  if (!file) {
    return false;
  }

  const extension = getFileExtension(file.name);

  if (TEXT_EXTENSIONS.includes(extension)) {
    return true;
  }

  return typeof file.type === "string" && file.type.startsWith("text/");
}

function isImageFile(file) {
  return Boolean(
    file && typeof file.type === "string" && file.type.startsWith("image/")
  );
}

function isPdfFile(file) {
  if (!file) {
    return false;
  }

  return (
    file.type === "application/pdf" || getFileExtension(file.name) === "pdf"
  );
}

function isZipFile(file) {
  if (!file) {
    return false;
  }

  const extension = getFileExtension(file.name);

  return (
    file.type === "application/zip" ||
    file.type === "application/x-zip-compressed" ||
    extension === "zip"
  );
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1
  );

  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${
    units[index]
  }`;
}

function createLocalId(prefix = "id") {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function downloadTextFile(filename, content) {
  try {
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error("File download failed:", error);
    throw new Error("Unable to download the chat on this device.");
  }
}

function formatChatDate(timestamp) {
  if (!timestamp) return "";
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(timestamp));
  } catch {
    return "";
  }
}

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function normalizeLineBreaks(value = "") {
  return String(value).replace(/\r\n/g, "\n");
}

function getAssistantResponse(result) {
  if (!result) {
    return "";
  }

  const payload = getServerPayload(result);

  const candidates = [
    payload?.answer,
    payload?.response,
    payload?.text,
    payload?.content,
    payload?.output,
    payload?.message,
    result?.answer,
    result?.response,
    result?.text,
    result?.content,
    result?.output,
    result?.message,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate;
    }
  }

  if (payload?.result && typeof payload.result === "object") {
    const nested = getAssistantResponse(payload.result);

    if (nested) {
      return nested;
    }
  }

  if (Array.isArray(payload?.choices)) {
    for (const choice of payload.choices) {
      if (typeof choice === "string" && choice.trim()) {
        return choice;
      }

      if (
        choice?.message?.content &&
        typeof choice.message.content === "string"
      ) {
        return choice.message.content;
      }

      if (typeof choice?.text === "string" && choice.text.trim()) {
        return choice.text;
      }
    }
  }

  return "";
}

async function readFileAsText(file) {
  if (!file) {
    throw new Error("No file was selected.");
  }

  if (file.size > MAX_TEXT_FILE_SIZE) {
    throw new Error(
      `${file.name} is too large. Text files must be smaller than ${formatBytes(
        MAX_TEXT_FILE_SIZE
      )}.`
    );
  }

  return file.text();
}

function readBlobAsArrayBuffer(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(reader.result);
    reader.onerror = () =>
      reject(reader.error || new Error("Unable to read the selected file."));

    reader.readAsArrayBuffer(blob);
  });
}

function arrayBufferToBinaryString(buffer) {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let result = "";

  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(
      offset,
      Math.min(offset + chunkSize, bytes.length)
    );

    result += String.fromCharCode(...chunk);
  }

  return result;
}

function decodePdfLiteralString(value) {
  let output = "";

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];

    if (character !== "\\") {
      output += character;
      continue;
    }

    index += 1;

    if (index >= value.length) {
      break;
    }

    const next = value[index];

    const escapeMap = {
      n: "\n",
      r: "\r",
      t: "\t",
      b: "\b",
      f: "\f",
    };

    if (escapeMap[next]) {
      output += escapeMap[next];
      continue;
    }

    if (next === "\\" || next === "(" || next === ")") {
      output += next;
      continue;
    }

    if (/[0-7]/.test(next)) {
      let octal = next;

      while (
        octal.length < 3 &&
        index + 1 < value.length &&
        /[0-7]/.test(value[index + 1])
      ) {
        index += 1;
        octal += value[index];
      }

      output += String.fromCharCode(parseInt(octal, 8));
      continue;
    }

    output += next;
  }

  return output;
}

function extractPdfLiteralStrings(binary) {
  const strings = [];
  const maxStrings = MAX_PDF_PAGES * 200;

  let index = 0;

  while (index < binary.length && strings.length < maxStrings) {
    if (binary[index] !== "(") {
      index += 1;
      continue;
    }

    const start = index + 1;
    let depth = 1;
    let escaped = false;
    let end = start;

    for (; end < binary.length; end += 1) {
      const character = binary[end];

      if (escaped) {
        escaped = false;
        continue;
      }

      if (character === "\\") {
        escaped = true;
        continue;
      }

      if (character === "(") {
        depth += 1;
        continue;
      }

      if (character === ")") {
        depth -= 1;

        if (depth === 0) {
          break;
        }
      }
    }

    if (depth === 0) {
      const raw = binary.slice(start, end);
      const decoded = decodePdfLiteralString(raw);

      if (decoded.trim()) {
        strings.push(decoded);
      }

      index = end + 1;
    } else {
      break;
    }
  }

  return strings;
}

function extractPdfHexStrings(binary) {
  const strings = [];
  const maxStrings = MAX_PDF_PAGES * 100;

  const regex = /<([0-9A-Fa-f\s]{4,})>/g;
  let match;

  while ((match = regex.exec(binary)) !== null && strings.length < maxStrings) {
    const hex = match[1].replace(/\s+/g, "");

    if (hex.length % 2 !== 0) {
      continue;
    }

    const bytes = [];

    for (let index = 0; index < hex.length; index += 2) {
      bytes.push(parseInt(hex.slice(index, index + 2), 16));
    }

    let decoded = "";

    try {
      decoded = new TextDecoder("utf-8").decode(new Uint8Array(bytes));
    } catch {
      decoded = String.fromCharCode(...bytes);
    }

    if (decoded && /[A-Za-z0-9]/.test(decoded) && decoded.trim().length > 1) {
      strings.push(decoded);
    }
  }

  return strings;
}

async function extractPdfText(file) {
  if (!file) {
    throw new Error("No PDF file was selected.");
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new Error(
      `PDF is too large. Maximum size is ${formatBytes(MAX_FILE_SIZE)}.`
    );
  }

  const buffer = await readBlobAsArrayBuffer(file);
  const binary = arrayBufferToBinaryString(buffer);

  if (!binary.startsWith("%PDF-")) {
    throw new Error(`${file.name} does not appear to be a valid PDF file.`);
  }

  const pageMatches = binary.match(/\/Type\s*\/Page\b/g) || [];

  const pageCount = Math.min(pageMatches.length || 1, MAX_PDF_PAGES);

  const literalStrings = extractPdfLiteralStrings(binary);

  const hexStrings = extractPdfHexStrings(binary);

  const combined = [...literalStrings, ...hexStrings]
    .map((value) =>
      normalizeLineBreaks(value)
        .replace(/[^\S\r\n]+/g, " ")
        .trim()
    )
    .filter((value) => value && value.length > 1 && /[A-Za-z0-9]/.test(value));

  const unique = [];
  const seen = new Set();

  for (const value of combined) {
    const key = value.toLowerCase();

    if (!seen.has(key)) {
      seen.add(key);
      unique.push(value);
    }

    if (unique.join("\n").length >= MAX_PDF_TEXT_CHARS) {
      break;
    }
  }

  const text = unique.join("\n").slice(0, MAX_PDF_TEXT_CHARS).trim();

  if (!text) {
    throw new Error(
      `${file.name} appears to be a scanned or image-only PDF. No selectable text could be extracted in the browser.`
    );
  }

  return {
    text,
    pageCount,
  };
}

async function extractZipText(file) {
  if (!file) {
    throw new Error("No ZIP file was selected.");
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new Error(
      `ZIP file is too large. Maximum size is ${formatBytes(MAX_FILE_SIZE)}.`
    );
  }

  if (typeof window === "undefined") {
    throw new Error("ZIP processing is only available in the browser.");
  }

  let JSZip;

  try {
    const module = await import("jszip");
    JSZip = module.default || module;
  } catch (error) {
    console.error("Unable to load JSZip:", error);
    throw new Error("ZIP support could not be loaded. Please try again.");
  }

  const zip = await JSZip.loadAsync(file);
  const names = Object.keys(zip.files);

  if (names.length > MAX_ZIP_FILES) {
    throw new Error(
      `ZIP contains too many files. Maximum supported is ${MAX_ZIP_FILES}.`
    );
  }

  const output = [];
  let totalCharacters = 0;

  for (const name of names) {
    const entry = zip.files[name];

    if (!entry || entry.dir) {
      continue;
    }

    const extension = getFileExtension(name);

    if (!TEXT_EXTENSIONS.includes(extension)) {
      continue;
    }

    if (totalCharacters >= MAX_ZIP_TEXT_CHARS) {
      break;
    }

    try {
      const content = await entry.async("text");

      if (!content) {
        continue;
      }

      const limited = content.slice(0, MAX_ZIP_TEXT_FILE_SIZE);

      output.push(`===== ${name} =====\n${limited}`);

      totalCharacters += limited.length;
    } catch (error) {
      console.warn(`Unable to read ZIP entry ${name}:`, error);
    }
  }

  const text = output.join("\n\n").slice(0, MAX_ZIP_TEXT_CHARS).trim();

  if (!text) {
    throw new Error("No readable text/code files were found inside the ZIP.");
  }

  return {
    text,
    fileCount: names.length,
  };
}

function readDataUrlSize(dataUrl = "") {
  if (!dataUrl.startsWith("data:")) {
    return 0;
  }

  const commaIndex = dataUrl.indexOf(",");

  if (commaIndex === -1) {
    return 0;
  }

  const encoded = dataUrl.slice(commaIndex + 1);

  return Math.floor((encoded.length * 3) / 4);
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () =>
      reject(reader.error || new Error("Unable to create file preview."));

    reader.readAsDataURL(blob);
  });
}

async function createAttachmentFromFile(file) {
  if (!file) {
    throw new Error("Invalid file.");
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new Error(
      `${file.name} is too large. Maximum file size is ${formatBytes(
        MAX_FILE_SIZE
      )}.`
    );
  }

  const extension = getFileExtension(file.name);

  if (isImageFile(file)) {
    const dataUrl = await blobToDataUrl(file);

    if (dataUrl.length > MAX_IMAGE_DATA_URL_LENGTH) {
      throw new Error(
        `${file.name} is too large for image analysis. Please use a smaller image.`
      );
    }

    return {
      id: createLocalId("attachment"),
      name: file.name,
      type: file.type || "image/*",
      size: file.size,
      kind: "image",
      dataUrl,
      preview: dataUrl,
    };
  }

  if (isTextFile(file)) {
    const text = await readFileAsText(file);

    return {
      id: createLocalId("attachment"),
      name: file.name,
      type: file.type || "text/plain",
      size: file.size,
      kind: "text",
      text: text.slice(0, MAX_TEXT_CONTENT_CHARS),
    };
  }

  if (isPdfFile(file)) {
    const pdf = await extractPdfText(file);

    return {
      id: createLocalId("attachment"),
      name: file.name,
      type: "application/pdf",
      size: file.size,
      kind: "pdf",
      text: pdf.text,
      pageCount: pdf.pageCount,
    };
  }

  if (isZipFile(file)) {
    const zip = await extractZipText(file);

    return {
      id: createLocalId("attachment"),
      name: file.name,
      type: file.type || "application/zip",
      size: file.size,
      kind: "zip",
      text: zip.text,
      fileCount: zip.fileCount,
    };
  }

  return {
    id: createLocalId("attachment"),
    name: file.name,
    type: file.type || "application/octet-stream",
    size: file.size,
    kind: "file",
  };
}

function createApiAttachments(attachments = []) {
  return attachments
    .map((attachment) => {
      if (!attachment) {
        return null;
      }

      const result = {
        name: attachment.name,
        type: attachment.type,
        size: attachment.size,
        kind: attachment.kind,
      };

      if (attachment.kind === "image") {
        if (
          typeof attachment.dataUrl === "string" &&
          attachment.dataUrl.length <= MAX_IMAGE_DATA_URL_LENGTH
        ) {
          result.dataUrl = attachment.dataUrl;
        }
      }

      if (
        attachment.kind === "text" ||
        attachment.kind === "pdf" ||
        attachment.kind === "zip"
      ) {
        result.text = String(attachment.text || "").slice(
          0,
          MAX_TEXT_CONTENT_CHARS
        );
      }

      if (attachment.pageCount) {
        result.pageCount = attachment.pageCount;
      }

      if (attachment.fileCount) {
        result.fileCount = attachment.fileCount;
      }

      return result;
    })
    .filter(Boolean);
}

function buildMessagePreview(content, attachments = []) {
  const text = String(content || "").trim();

  if (text) {
    return text.slice(0, 60);
  }

  if (attachments.length === 1) {
    return attachments[0]?.name || "Attachment";
  }

  if (attachments.length > 1) {
    return `${attachments.length} attachments`;
  }

  return "New Chat";
}

function createConversation(title = "New Chat") {
  const now = Date.now();

  return {
    id: createLocalId("chat"),
    title,
    createdAt: now,
    updatedAt: now,
    messages: [],
    cloudId: "",
  };
}

function getInitialTitle(content, attachments = []) {
  const text = String(content || "")
    .replace(/\s+/g, " ")
    .trim();

  if (text) {
    return text.length > 42 ? `${text.slice(0, 42).trim()}...` : text;
  }

  if (attachments.length === 1) {
    return attachments[0]?.name || "New Chat";
  }

  if (attachments.length > 1) {
    return `${attachments.length} files`;
  }

  return "New Chat";
}

function parseMarkdown(text) {
  const source = normalizeLineBreaks(text || "");

  const lines = source.split("\n");
  const html = [];

  let inCodeBlock = false;
  let codeLanguage = "";
  let codeLines = [];

  function flushCode() {
    if (!inCodeBlock) {
      return;
    }

    const code = codeLines.join("\n");

    html.push(
      `<pre class="markdown-code"><code${
        codeLanguage ? ` class="language-${escapeHtml(codeLanguage)}"` : ""
      }>${escapeHtml(code)}</code></pre>`
    );

    inCodeBlock = false;
    codeLanguage = "";
    codeLines = [];
  }

  function inline(value) {
    let result = escapeHtml(value);

    result = result.replace(/`([^`]+)`/g, "<code>$1</code>");

    result = result.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");

    result = result.replace(/__([^_]+)__/g, "<strong>$1</strong>");

    result = result.replace(/(^|[^\*])\*([^*]+)\*(?!\*)/g, "$1<em>$2</em>");

    result = result.replace(/(^|[^_])_([^_]+)_(?!_)/g, "$1<em>$2</em>");

    result = result.replace(
      /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
    );

    result = result.replace(
      /(^|[\s>])(https?:\/\/[^\s<]+)/g,
      '$1<a href="$2" target="_blank" rel="noopener noreferrer">$2</a>'
    );

    return result;
  }

  let listType = null;

  function closeList() {
    if (listType === "ul") {
      html.push("</ul>");
    }

    if (listType === "ol") {
      html.push("</ol>");
    }

    listType = null;
  }

  for (const line of lines) {
    if (line.startsWith("```")) {
      if (inCodeBlock) {
        flushCode();
      } else {
        closeList();
        inCodeBlock = true;
        codeLanguage = line.slice(3).trim().split(/\s+/)[0] || "";
      }

      continue;
    }

    if (inCodeBlock) {
      codeLines.push(line);
      continue;
    }

    if (!line.trim()) {
      closeList();

      if (html.length && html[html.length - 1] !== "<br />") {
        html.push("<br />");
      }

      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.+)$/);

    if (heading) {
      closeList();

      const level = heading[1].length;

      html.push(`<h${level}>${inline(heading[2])}</h${level}>`);

      continue;
    }

    const unordered = line.match(/^\s*[-*+]\s+(.+)$/);

    if (unordered) {
      if (listType !== "ul") {
        closeList();
        html.push("<ul>");
        listType = "ul";
      }

      html.push(`<li>${inline(unordered[1])}</li>`);
      continue;
    }

    const ordered = line.match(/^\s*\d+\.\s+(.+)$/);

    if (ordered) {
      if (listType !== "ol") {
        closeList();
        html.push("<ol>");
        listType = "ol";
      }

      html.push(`<li>${inline(ordered[1])}</li>`);
      continue;
    }

    const quote = line.match(/^\s*>\s?(.*)$/);

    if (quote) {
      closeList();

      html.push(`<blockquote>${inline(quote[1])}</blockquote>`);

      continue;
    }

    closeList();

    html.push(`<p>${inline(line)}</p>`);
  }

  flushCode();
  closeList();

  return html.join("");
}

function MessageContent({ content }) {
  const html = useMemo(() => parseMarkdown(content), [content]);

  return (
    <div
      className="message-markdown"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function AttachmentPreview({ attachment }) {
  if (!attachment) {
    return null;
  }

  if (attachment.kind === "image" && attachment.preview) {
    return (
      <div className="attachment-preview">
        <img src={attachment.preview} alt={attachment.name || "Attachment"} />
        <div className="attachment-name">{attachment.name}</div>
      </div>
    );
  }

  return (
    <div className="attachment-card">
      <div className="attachment-icon">
        {attachment.kind === "pdf"
          ? "PDF"
          : attachment.kind === "zip"
          ? "ZIP"
          : attachment.kind === "text"
          ? "TXT"
          : "FILE"}
      </div>

      <div className="attachment-info">
        <div className="attachment-name">{attachment.name}</div>

        <div className="attachment-meta">
          {formatBytes(attachment.size || 0)}
          {attachment.pageCount ? ` • ${attachment.pageCount} pages` : ""}
          {attachment.fileCount ? ` • ${attachment.fileCount} files` : ""}
        </div>
      </div>
    </div>
  );
}

function MessageActions({ message, onCopy, onRegenerate, onFeedback }) {
  if (!message || message.role !== "assistant") {
    return null;
  }

  return (
    <div className="message-actions">
      <button
        type="button"
        className="message-action"
        onClick={() => onCopy(message.content)}
        title="Copy"
      >
        Copy
      </button>

      <button
        type="button"
        className="message-action"
        onClick={() => onRegenerate(message)}
        title="Regenerate"
      >
        Regenerate
      </button>

      <button
        type="button"
        className="message-action"
        onClick={() => onFeedback(message, "positive")}
        title="Good response"
      >
        👍
      </button>

      <button
        type="button"
        className="message-action"
        onClick={() => onFeedback(message, "negative")}
        title="Bad response"
      >
        👎
      </button>
    </div>
  );
}

function MessageBubble({ message, onCopy, onRegenerate, onFeedback }) {
  const isUser = message.role === "user";

  return (
    <div
      className={`message-row ${isUser ? "user-message" : "assistant-message"}`}
    >
      <div className="message-avatar">{isUser ? "You" : "AI"}</div>

      <div className="message-content">
        <div className="message-bubble">
          {Array.isArray(message.attachments) &&
            message.attachments.length > 0 && (
              <div className="message-attachments">
                {message.attachments.map((attachment) => (
                  <AttachmentPreview
                    key={attachment.id || attachment.name}
                    attachment={attachment}
                  />
                ))}
              </div>
            )}

          {message.content ? (
            isUser ? (
              <div className="message-text">{message.content}</div>
            ) : (
              <MessageContent content={message.content} />
            )
          ) : null}
        </div>

        <MessageActions
          message={message}
          onCopy={onCopy}
          onRegenerate={onRegenerate}
          onFeedback={onFeedback}
        />
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="message-row assistant-message">
      <div className="message-avatar">AI</div>

      <div className="message-content">
        <div className="message-bubble typing-bubble">
          <span className="typing-dot" />
          <span className="typing-dot" />
          <span className="typing-dot" />
        </div>
      </div>
    </div>
  );
}

function Modal({ children, onClose, title }) {
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="modal">
        <div className="modal-header">
          <h2>{title}</h2>

          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

function AuthModal({ mode, setMode, onClose, onSubmit, loading, error }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const isRegister = mode === "register";

  function submit(event) {
    event.preventDefault();

    onSubmit({
      name: name.trim(),
      email: email.trim(),
      password,
    });
  }

  return (
    <Modal
      title={isRegister ? "Create MyAI account" : "Sign in to MyAI"}
      onClose={onClose}
    >
      <form className="auth-form" onSubmit={submit}>
        {isRegister && (
          <label>
            <span>Name</span>
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Your name"
              autoComplete="name"
              required
            />
          </label>
        )}

        <label>
          <span>Email</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            required
          />
        </label>

        <label>
          <span>Password</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Password"
            autoComplete={isRegister ? "new-password" : "current-password"}
            minLength={isRegister ? 8 : undefined}
            required
          />
        </label>

        {error && <div className="auth-error">{error}</div>}

        <button type="submit" className="primary-button" disabled={loading}>
          {loading
            ? "Please wait..."
            : isRegister
            ? "Create account"
            : "Sign in"}
        </button>

        <button
          type="button"
          className="auth-switch"
          onClick={() => setMode(isRegister ? "login" : "register")}
        >
          {isRegister
            ? "Already have an account? Sign in"
            : "Need an account? Create one"}
        </button>
      </form>
    </Modal>
  );
}

function App() {
  const [conversations, setConversations] = useState(() =>
    loadStoredConversations()
  );

  const [currentChatId, setCurrentChatId] = useState(() =>
    loadCurrentChatId(conversations)
  );

  const [theme, setTheme] = useState(() => loadStoredTheme());

  const [message, setMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState("login");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authUser, setAuthUser] = useState(() => loadSavedAuthUser());
  const [attachments, setAttachments] = useState([]);
  const [error, setError] = useState("");
  const [cloudLoading, setCloudLoading] = useState(false);
  const [cloudSyncError, setCloudSyncError] = useState("");
  const [chatSearch, setChatSearch] = useState("");
  const [showShortcuts, setShowShortcuts] = useState(false);

  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);
  const mountedRef = useRef(true);
  const syncingRef = useRef(false);

  const currentConversation = useMemo(
    () =>
      conversations.find((conversation) => conversation.id === currentChatId) ||
      conversations[0] ||
      null,
    [conversations, currentChatId]
  );

  const currentMessages = currentConversation?.messages || [];

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;

    try {
      localStorage.setItem(STORAGE_KEYS.theme, theme);
    } catch (error) {
      console.error("Unable to save theme:", error);
    }
  }, [theme]);

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEYS.conversations,
        JSON.stringify(stripPreviewData(conversations))
      );
    } catch (error) {
      console.error("Unable to persist conversations:", error);
    }
  }, [conversations]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.currentChat, currentChatId);
    } catch (error) {
      console.error("Unable to persist current chat:", error);
    }
  }, [currentChatId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [currentMessages.length, isTyping]);

  useEffect(() => {
    function handleGlobalKeyDown(event) {
      const modifier = event.ctrlKey || event.metaKey;
      const tag = event.target?.tagName?.toLowerCase();

      if (modifier && event.key.toLowerCase() === "k") {
        event.preventDefault();
        document.querySelector(".chat-search-input")?.focus();
        return;
      }

      if (modifier && event.key.toLowerCase() === "n") {
        event.preventDefault();
        createNewChat();
        return;
      }

      if (event.key === "Escape") {
        if (isSidebarOpen) setIsSidebarOpen(false);
        if (showShortcuts) setShowShortcuts(false);
        return;
      }

      if (
        modifier &&
        event.key === "/" &&
        tag !== "input" &&
        tag !== "textarea"
      ) {
        event.preventDefault();
        setShowShortcuts(true);
      }
    }

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [isSidebarOpen, showShortcuts]);

  useEffect(() => {
    const token = getAuthToken();

    if (!token) {
      return;
    }

    restoreSession();
  }, []);

  useEffect(() => {
    if (!authUser || syncingRef.current) {
      return;
    }

    syncCloudConversations();
  }, [authUser]);

  async function apiRequest(path, options = {}, requireAuth = false) {
    const headers = {
      ...(options.body && !(options.body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : {}),
      ...(options.headers || {}),
    };

    const token = getAuthToken();

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    if (requireAuth && !token) {
      throw new Error("Please sign in to use cloud synchronization.");
    }

    let response;

    try {
      response = await fetch(`${BACKEND_URL}${path}`, {
        ...options,
        headers,
        mode: "cors",
      });
    } catch (networkError) {
      console.error("MyAI API network error:", networkError);

      throw new Error(
        "Unable to connect to the MyAI server. Please check your internet connection."
      );
    }

    let result = null;

    try {
      result = await response.json();
    } catch {
      throw new Error(
        `Server returned ${response.status} with an invalid response.`
      );
    }

    if (!response.ok || result?.success === false) {
      if (response.status === 401 && requireAuth) {
        clearAuthSession();

        if (mountedRef.current) {
          setAuthUser(null);
        }
      }

      throw new Error(
        result?.error || result?.details || `Server returned ${response.status}`
      );
    }

    return result;
  }

  async function restoreSession() {
    try {
      const result = await apiRequest(
        "/api/auth/me",
        {
          method: "GET",
        },
        true
      );

      const user = getUserFromResponse(result);

      if (user && mountedRef.current) {
        setAuthUser(user);
        saveAuthSession(getAuthToken(), user);
      }
    } catch (sessionError) {
      console.warn("Session restoration failed:", sessionError);

      clearAuthSession();

      if (mountedRef.current) {
        setAuthUser(null);
      }
    }
  }

  async function handleAuthSubmit(values) {
    setAuthLoading(true);
    setAuthError("");

    try {
      const endpoint =
        authMode === "register" ? "/api/auth/register" : "/api/auth/login";

      const body =
        authMode === "register"
          ? {
              name: values.name,
              email: values.email,
              password: values.password,
            }
          : {
              email: values.email,
              password: values.password,
            };

      const result = await apiRequest(endpoint, {
        method: "POST",
        body: JSON.stringify(body),
      });

      const token = getAuthTokenFromResponse(result);
      const user = getUserFromResponse(result);

      if (!token) {
        throw new Error("The server did not return a session token.");
      }

      saveAuthSession(token, user);

      if (mountedRef.current) {
        setAuthUser(user);
        setShowAuth(false);
        setAuthError("");
      }

      await syncCloudConversations();
    } catch (authSubmitError) {
      console.error("Authentication failed:", authSubmitError);

      if (mountedRef.current) {
        setAuthError(authSubmitError.message || "Authentication failed.");
      }
    } finally {
      if (mountedRef.current) {
        setAuthLoading(false);
      }
    }
  }

  async function logout() {
    try {
      const token = getAuthToken();

      if (token) {
        await fetch(`${BACKEND_URL}/api/auth/logout`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          mode: "cors",
        });
      }
    } catch (logoutError) {
      console.warn("Logout request failed:", logoutError);
    } finally {
      clearAuthSession();

      if (mountedRef.current) {
        setAuthUser(null);
        setCloudSyncError("");
      }
    }
  }

  async function syncCloudConversations() {
    const token = getAuthToken();

    if (!token || syncingRef.current) {
      return;
    }

    syncingRef.current = true;

    if (mountedRef.current) {
      setCloudLoading(true);
      setCloudSyncError("");
    }

    try {
      const result = await apiRequest(
        "/api/conversations",
        {
          method: "GET",
        },
        true
      );

      const cloudItems = getConversationArray(result);

      if (!cloudItems.length) {
        await uploadLocalConversations();
        return;
      }

      const normalizedCloud = cloudItems
        .slice(0, CLOUD_MAX_CONVERSATIONS)
        .map(normalizeCloudConversation);

      if (!mountedRef.current) {
        return;
      }

      setConversations((localConversations) => {
        const merged = [...normalizedCloud];

        const cloudIds = new Set(
          normalizedCloud
            .map((conversation) => getCloudConversationId(conversation))
            .filter(Boolean)
        );

        for (const localConversation of localConversations) {
          if (
            localConversation.cloudId &&
            cloudIds.has(localConversation.cloudId)
          ) {
            continue;
          }

          if (
            !localConversation.cloudId &&
            localConversation.messages.length === 0
          ) {
            continue;
          }

          merged.push(localConversation);
        }

        const unique = [];
        const seen = new Set();

        for (const conversation of merged) {
          const key = conversation.cloudId || conversation.id;

          if (seen.has(key)) {
            continue;
          }

          seen.add(key);
          unique.push(conversation);
        }

        return unique
          .sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0))
          .slice(0, CLOUD_MAX_CONVERSATIONS);
      });

      const firstLocal = conversations.find(
        (conversation) => conversation.id === currentChatId
      );

      if (firstLocal?.cloudId || firstLocal?.messages?.length) {
        await uploadLocalConversations();
      }
    } catch (syncError) {
      console.warn("Cloud conversation sync failed:", syncError);

      if (mountedRef.current) {
        setCloudSyncError(syncError.message || "Cloud synchronization failed.");
      }
    } finally {
      syncingRef.current = false;

      if (mountedRef.current) {
        setCloudLoading(false);
      }
    }
  }

  async function uploadLocalConversations() {
    const token = getAuthToken();

    if (!token) {
      return;
    }

    const localList = conversations.slice(0, CLOUD_MAX_CONVERSATIONS);

    for (const conversation of localList) {
      try {
        let cloudId = conversation.cloudId;

        if (!cloudId) {
          const createResult = await apiRequest(
            "/api/conversations",
            {
              method: "POST",
              body: JSON.stringify({
                title: conversation.title || "New Chat",
              }),
            },
            true
          );

          const payload = getServerPayload(createResult);

          cloudId =
            payload?.conversationId ||
            payload?.conversation?.id ||
            payload?.id ||
            "";

          if (cloudId && mountedRef.current) {
            setConversations((previous) =>
              previous.map((item) =>
                item.id === conversation.id
                  ? {
                      ...item,
                      cloudId: String(cloudId),
                    }
                  : item
              )
            );
          }
        }

        if (!cloudId) {
          continue;
        }

        if (conversation.messages && conversation.messages.length) {
          for (const item of conversation.messages.slice(-CLOUD_MAX_MESSAGES)) {
            try {
              await saveMessageToCloud(String(cloudId), item);
            } catch (messageError) {
              console.warn("Unable to upload message:", messageError);
            }
          }
        }

        await updateCloudConversation(String(cloudId), conversation.title);
      } catch (conversationError) {
        console.warn("Unable to upload conversation:", conversationError);
      }
    }
  }

  async function updateCloudConversation(cloudId, title) {
    if (!cloudId) {
      return;
    }

    const result = await apiRequest(
      `/api/conversations/${encodeURIComponent(cloudId)}`,
      {
        method: "PUT",
        body: JSON.stringify({
          title: title || "New Chat",
        }),
      },
      true
    );

    return result;
  }

  async function saveMessageToCloud(cloudId, messageItem) {
    if (!cloudId || !messageItem) {
      return;
    }

    const content =
      typeof messageItem.content === "string" ? messageItem.content : "";

    const body = {
      conversationId: cloudId,
      role: messageItem.role,
      content,
    };

    if (Array.isArray(messageItem.attachments)) {
      body.attachments = createApiAttachments(messageItem.attachments);
    }

    return apiRequest(
      "/api/messages",
      {
        method: "POST",
        body: JSON.stringify(body),
      },
      true
    );
  }

  async function createCloudConversation(title) {
    const result = await apiRequest(
      "/api/conversations",
      {
        method: "POST",
        body: JSON.stringify({
          title: title || "New Chat",
        }),
      },
      true
    );

    const payload = getServerPayload(result);

    return (
      payload?.conversationId || payload?.conversation?.id || payload?.id || ""
    );
  }

  async function ensureCloudConversation(conversation) {
    if (!conversation) {
      return "";
    }

    if (conversation.cloudId) {
      return conversation.cloudId;
    }

    const token = getAuthToken();

    if (!token) {
      return "";
    }

    const cloudId = await createCloudConversation(conversation.title);

    if (!cloudId) {
      return "";
    }

    if (mountedRef.current) {
      setConversations((previous) =>
        previous.map((item) =>
          item.id === conversation.id
            ? {
                ...item,
                cloudId: String(cloudId),
              }
            : item
        )
      );
    }

    return String(cloudId);
  }

  async function saveMessageIfLoggedIn(conversation, messageItem) {
    if (!authUser || !conversation || !messageItem) {
      return;
    }

    try {
      const cloudId = await ensureCloudConversation(conversation);

      if (!cloudId) {
        return;
      }

      await saveMessageToCloud(cloudId, messageItem);
    } catch (saveError) {
      console.warn("Cloud message save failed:", saveError);

      if (mountedRef.current) {
        setCloudSyncError(
          saveError.message || "Unable to save this message to the cloud."
        );
      }
    }
  }

  async function renameCloudConversation(conversation, title) {
    if (!conversation || !authUser) {
      return;
    }

    try {
      const cloudId = await ensureCloudConversation(conversation);

      if (!cloudId) {
        return;
      }

      await updateCloudConversation(cloudId, title);
    } catch (renameError) {
      console.warn("Cloud rename failed:", renameError);
    }
  }

  async function deleteCloudConversation(conversation) {
    if (!conversation || !conversation.cloudId || !authUser) {
      return;
    }

    await apiRequest(
      `/api/conversations/${encodeURIComponent(conversation.cloudId)}`,
      {
        method: "DELETE",
      },
      true
    );
  }

  function updateConversation(conversationId, updater) {
    setConversations((previous) =>
      previous.map((conversation) =>
        conversation.id === conversationId
          ? updater(conversation)
          : conversation
      )
    );
  }

  function createNewChat() {
    const conversation = createConversation();

    setConversations((previous) => [conversation, ...previous]);

    setCurrentChatId(conversation.id);
    setMessage("");
    setAttachments([]);
    setError("");
    setIsSidebarOpen(false);

    setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
  }

  function selectConversation(id) {
    if (!conversations.some((conversation) => conversation.id === id)) {
      return;
    }

    setCurrentChatId(id);
    setMessage("");
    setAttachments([]);
    setError("");
    setIsSidebarOpen(false);
  }

  async function deleteConversation(id) {
    const target = conversations.find((conversation) => conversation.id === id);

    if (!target) {
      return;
    }

    try {
      if (target.cloudId && authUser) {
        await deleteCloudConversation(target);
      }
    } catch (deleteError) {
      console.warn("Cloud conversation deletion failed:", deleteError);
    }

    setConversations((previous) => {
      const remaining = previous.filter(
        (conversation) => conversation.id !== id
      );

      if (!remaining.length) {
        const fresh = createConversation();
        setCurrentChatId(fresh.id);
        return [fresh];
      }

      if (id === currentChatId) {
        setCurrentChatId(remaining[0].id);
      }

      return remaining;
    });
  }

  async function renameConversation(id, title) {
    const cleanTitle = String(title || "").trim() || "New Chat";

    const target = conversations.find((conversation) => conversation.id === id);

    if (!target) {
      return;
    }

    updateConversation(id, (conversation) => ({
      ...conversation,
      title: cleanTitle,
      updatedAt: Date.now(),
    }));

    await renameCloudConversation(
      {
        ...target,
        title: cleanTitle,
      },
      cleanTitle
    );
  }

  async function handleFileSelection(event) {
    const selected = Array.from(event.target.files || []);

    if (!selected.length) {
      return;
    }

    setError("");

    try {
      if (attachments.length + selected.length > MAX_FILES) {
        throw new Error(`You can attach up to ${MAX_FILES} files per message.`);
      }

      const created = [];

      for (const file of selected) {
        created.push(await createAttachmentFromFile(file));
      }

      if (mountedRef.current) {
        setAttachments((previous) => [...previous, ...created]);
      }
    } catch (fileError) {
      console.error("File processing failed:", fileError);

      if (mountedRef.current) {
        setError(fileError.message || "Unable to process the selected file.");
      }
    } finally {
      event.target.value = "";
    }
  }

  function removeAttachment(id) {
    setAttachments((previous) =>
      previous.filter((attachment) => attachment.id !== id)
    );
  }

  function openFilePicker() {
    fileInputRef.current?.click();
  }

  function handleInputKeyDown(event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  }

  function setConversationMessage(conversationId, messages) {
    updateConversation(conversationId, (conversation) => ({
      ...conversation,
      messages,
      updatedAt: Date.now(),
    }));
  }

  async function requestAI(
    chatId,
    userMessage,
    contextMessages,
    requestAttachments = []
  ) {
    const token = getAuthToken();

    if (!token) {
      throw new Error("Please sign in again to use MyAI.");
    }

    const apiAttachments = createApiAttachments(requestAttachments);

    const requestBody = JSON.stringify({
      message: userMessage,
      messages: contextMessages.slice(-20).map((item) => ({
        role: item.role,
        content: item.content,
      })),
      attachments: apiAttachments,
    });

    const requestSize = new Blob([requestBody]).size;

    console.log(
      "MyAI request size:",
      (requestSize / (1024 * 1024)).toFixed(2),
      "MB"
    );

    if (requestSize > 8 * 1024 * 1024) {
      throw new Error(
        "The attachment request is too large. Please choose a smaller file or image."
      );
    }

    let response;

    try {
      response = await fetch(`${BACKEND_URL}/api/chat`, {
        method: "POST",
        mode: "cors",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: requestBody,
      });
    } catch (networkError) {
      console.error("MyAI network request failed:", networkError);

      throw new Error(
        "Failed to connect to MyAI. Check your internet connection and try again."
      );
    }

    let result;

    try {
      result = await response.json();
    } catch (parseError) {
      console.error("MyAI response parsing failed:", parseError);

      throw new Error(
        `Server returned ${response.status} with an invalid response.`
      );
    }

    if (!response.ok || result?.success === false) {
      if (response.status === 401) {
        clearAuthSession();

        if (mountedRef.current) {
          setAuthUser(null);
          setAuthMode("login");
          setAuthError("Your session may have expired. Please sign in again.");
          setShowAuth(true);
        }

        throw new Error("Your session was rejected. Please sign in again.");
      }

      throw new Error(
        result?.error || result?.details || `Server returned ${response.status}`
      );
    }

    const assistantText = getAssistantResponse(result);

    if (!assistantText.trim()) {
      throw new Error("MyAI returned an empty response.");
    }

    const assistantMessage = normalizeMessage({
      id: createLocalId("message"),
      role: "assistant",
      content: assistantText.trim(),
      createdAt: Date.now(),
    });

    if (mountedRef.current) {
      setConversations((previous) =>
        previous.map((chat) =>
          chat.id === chatId
            ? {
                ...chat,
                messages: [...chat.messages, assistantMessage],
                updatedAt: Date.now(),
              }
            : chat
        )
      );
    }

    return assistantMessage;
  }

  async function sendMessage() {
    const text = message.trim();

    if (!text && attachments.length === 0) {
      return;
    }

    if (isTyping) {
      return;
    }

    let conversation = conversations.find((item) => item.id === currentChatId);

    if (!conversation) {
      conversation = createConversation();

      setConversations((previous) => [conversation, ...previous]);

      setCurrentChatId(conversation.id);
    }

    const userMessage = normalizeMessage({
      id: createLocalId("message"),
      role: "user",
      content: text,
      attachments,
      createdAt: Date.now(),
    });

    const existingMessages = conversation.messages || [];

    const updatedMessages = [...existingMessages, userMessage];

    const shouldSetTitle =
      !existingMessages.length || conversation.title === "New Chat";

    const nextTitle = shouldSetTitle
      ? getInitialTitle(text, attachments)
      : conversation.title;

    updateConversation(conversation.id, (item) => ({
      ...item,
      title: nextTitle,
      messages: updatedMessages,
      updatedAt: Date.now(),
    }));

    setMessage("");
    setAttachments([]);
    setError("");
    setIsTyping(true);

    await saveMessageIfLoggedIn(
      {
        ...conversation,
        title: nextTitle,
        messages: updatedMessages,
      },
      userMessage
    );

    try {
      await requestAI(
        conversation.id,
        text,
        updatedMessages,
        userMessage.attachments || []
      );

      const latestConversation = conversations.find(
        (item) => item.id === conversation.id
      );

      if (authUser && latestConversation) {
        const cloudId = await ensureCloudConversation(latestConversation);

        if (cloudId) {
          const currentAfterAI = conversations.find(
            (item) => item.id === conversation.id
          );

          const assistant = currentAfterAI?.messages
            ?.filter((item) => item.role === "assistant")
            ?.at(-1);

          if (assistant) {
            await saveMessageIfLoggedIn(
              {
                ...currentAfterAI,
                cloudId,
              },
              assistant
            );
          }

          await updateCloudConversation(cloudId, nextTitle);
        }
      }
    } catch (requestError) {
      console.error("MyAI request failed:", requestError);

      if (mountedRef.current) {
        setError(
          requestError.message || "Something went wrong while contacting MyAI."
        );
      }
    } finally {
      if (mountedRef.current) {
        setIsTyping(false);

        setTimeout(() => {
          inputRef.current?.focus();
        }, 0);
      }
    }
  }

  async function regenerateMessage(assistantMessage) {
    if (isTyping || !currentConversation) {
      return;
    }

    const index = currentConversation.messages.findIndex(
      (item) => item.id === assistantMessage.id
    );

    if (index === -1) {
      return;
    }

    const beforeAssistant = currentConversation.messages.slice(0, index);

    const lastUser = [...beforeAssistant]
      .reverse()
      .find((item) => item.role === "user");

    if (!lastUser) {
      return;
    }

    setIsTyping(true);
    setError("");

    updateConversation(currentConversation.id, (conversation) => ({
      ...conversation,
      messages: beforeAssistant,
      updatedAt: Date.now(),
    }));

    try {
      await requestAI(
        currentConversation.id,
        lastUser.content,
        beforeAssistant,
        lastUser.attachments || []
      );
    } catch (regenerateError) {
      console.error("Regeneration failed:", regenerateError);

      if (mountedRef.current) {
        setError(
          regenerateError.message || "Unable to regenerate the response."
        );
      }
    } finally {
      if (mountedRef.current) {
        setIsTyping(false);
      }
    }
  }

  async function copyMessage(content) {
    try {
      await navigator.clipboard.writeText(content || "");
    } catch (copyError) {
      console.error("Clipboard copy failed:", copyError);

      setError("Unable to copy the message.");
    }
  }

  function handleFeedback(messageItem, type) {
    console.log("MyAI feedback:", type, messageItem);
  }

  function exportCurrentChat() {
    if (!currentConversation) return;

    const lines = [
      "MyAI — Conversation Export",
      `Title: ${currentConversation.title || "New Chat"}`,
      `Exported: ${formatChatDate(Date.now())}`,
      "",
      ...(currentConversation.messages || []).flatMap((item) => [
        `${item.role === "user" ? "You" : "MyAI"} • ${formatChatDate(
          item.createdAt
        )}`,
        item.content || "[Attachment only]",
        ...(item.attachments || []).map((file) => `[Attachment: ${file.name}]`),
        "",
      ]),
    ];

    try {
      downloadTextFile(
        `${
          (currentConversation.title || "myai-chat")
            .replace(/[^a-z0-9-_]+/gi, "-")
            .replace(/^-+|-+$/g, "")
            .slice(0, 60) || "myai-chat"
        }.txt`,
        lines.join("\n")
      );
      setError("");
    } catch (exportError) {
      setError(exportError.message);
    }
  }

  async function copyCurrentChat() {
    if (!currentConversation) return;

    const text = (currentConversation.messages || [])
      .map(
        (item) =>
          `${item.role === "user" ? "You" : "MyAI"}:\n${item.content || ""}`
      )
      .join("\n\n");

    try {
      await navigator.clipboard.writeText(text);
      setError("");
    } catch (copyError) {
      console.error("Conversation copy failed:", copyError);
      setError("Unable to copy this conversation.");
    }
  }

  function clearCurrentChat() {
    if (!currentConversation || !currentMessages.length) return;

    if (!window.confirm("Clear all messages from this chat?")) return;

    updateConversation(currentConversation.id, (conversation) => ({
      ...conversation,
      title: "New Chat",
      messages: [],
      updatedAt: Date.now(),
    }));
    setMessage("");
    setAttachments([]);
    setError("");
  }

  function useSuggestion(text) {
    setMessage(text);

    setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
  }

  function toggleTheme() {
    setTheme((previous) => (previous === "dark" ? "light" : "dark"));
  }

  function openLogin() {
    setAuthMode("login");
    setAuthError("");
    setShowAuth(true);
  }

  function openRegister() {
    setAuthMode("register");
    setAuthError("");
    setShowAuth(true);
  }

  const suggestions = [
    "Explain something to me",
    "Help me write code",
    "Analyze a file",
    "Give me ideas",
  ];

  const filteredConversations = useMemo(() => {
    const query = chatSearch.trim().toLowerCase();
    if (!query) return conversations;
    return conversations.filter((conversation) => {
      const title = String(conversation.title || "").toLowerCase();
      const content = (conversation.messages || [])
        .map((item) => item.content || "")
        .join(" ")
        .toLowerCase();
      return title.includes(query) || content.includes(query);
    });
  }, [conversations, chatSearch]);

  return (
    <div className={`app ${theme}`}>
      {isSidebarOpen && (
        <div
          className="mobile-overlay"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <aside className={`sidebar ${isSidebarOpen ? "sidebar-open" : ""}`}>
        <div className="sidebar-header">
          <div className="brand">
            <div className="brand-icon">M</div>

            <div>
              <div className="brand-name">MyAI</div>

              <div className="brand-status">
                <span className="status-dot" />
                Online
              </div>
            </div>
          </div>

          <button
            type="button"
            className="mobile-close-button"
            onClick={() => setIsSidebarOpen(false)}
            aria-label="Close sidebar"
          >
            ×
          </button>
        </div>

        <button
          type="button"
          className="new-chat-button"
          onClick={createNewChat}
        >
          <span>+</span>
          New Chat
        </button>

        <div className="sidebar-section">
          <div className="sidebar-section-heading">
            <div className="sidebar-section-title">Chats</div>
            <span className="chat-count">{conversations.length}</span>
          </div>

          <div className="chat-search">
            <span className="chat-search-icon">⌕</span>
            <input
              className="chat-search-input"
              value={chatSearch}
              onChange={(event) => setChatSearch(event.target.value)}
              placeholder="Search chats..."
              aria-label="Search chats"
            />
            {chatSearch && (
              <button
                type="button"
                className="chat-search-clear"
                onClick={() => setChatSearch("")}
                aria-label="Clear chat search"
              >
                ×
              </button>
            )}
          </div>

          <div className="chat-list">
            {filteredConversations.map((conversation) => (
              <div
                key={conversation.id}
                className={`chat-item ${
                  conversation.id === currentChatId ? "active" : ""
                }`}
              >
                <button
                  type="button"
                  className="chat-item-main"
                  onClick={() => selectConversation(conversation.id)}
                >
                  <span className="chat-icon">○</span>

                  <span className="chat-history-text">
                    {conversation.title || "New Chat"}
                  </span>
                </button>

                <div className="chat-item-actions">
                  <button
                    type="button"
                    title="Rename"
                    onClick={(event) => {
                      event.stopPropagation();

                      const nextTitle = window.prompt(
                        "Rename chat",
                        conversation.title
                      );

                      if (nextTitle !== null) {
                        renameConversation(conversation.id, nextTitle);
                      }
                    }}
                  >
                    ✎
                  </button>

                  <button
                    type="button"
                    title="Delete"
                    onClick={(event) => {
                      event.stopPropagation();

                      if (window.confirm("Delete this chat?")) {
                        deleteConversation(conversation.id);
                      }
                    }}
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}

            {!filteredConversations.length && (
              <div className="empty-search">
                <div className="empty-search-icon">⌕</div>
                <div>No chats found</div>
                <button type="button" onClick={() => setChatSearch("")}>
                  Clear search
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="sidebar-spacer" />

        <div className="sidebar-bottom">
          {authUser ? (
            <div className="account-card">
              <div className="avatar">
                {(authUser.name || authUser.email || "U")
                  .charAt(0)
                  .toUpperCase()}
              </div>

              <div className="account-info">
                <div className="account-name">
                  {authUser.name || "MyAI User"}
                </div>

                <div className="account-email">{authUser.email}</div>
              </div>

              <button
                type="button"
                className="account-menu-button"
                onClick={logout}
                title="Logout"
              >
                ↪
              </button>
            </div>
          ) : (
            <div className="auth-buttons">
              <button
                type="button"
                className="sidebar-action"
                onClick={openLogin}
              >
                Sign in
              </button>

              <button
                type="button"
                className="sidebar-action primary-sidebar-action"
                onClick={openRegister}
              >
                Create account
              </button>
            </div>
          )}

          <button
            type="button"
            className="sidebar-action"
            onClick={() => setShowSettings(true)}
          >
            <span>⚙</span>
            Settings
          </button>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <button
            type="button"
            className="mobile-menu-button"
            onClick={() => setIsSidebarOpen(true)}
            aria-label="Open sidebar"
          >
            ☰
          </button>

          <div className="topbar-title">
            <div className="topbar-chat-title">
              {currentConversation?.title || "New Chat"}
            </div>

            <div className="topbar-status">
              <span className="status-dot" />
              MyAI Online
            </div>
          </div>

          <div className="topbar-actions">
            {currentMessages.length > 0 && (
              <>
                <button
                  type="button"
                  className="icon-button desktop-only"
                  onClick={exportCurrentChat}
                  title="Export chat as TXT"
                  aria-label="Export chat"
                >
                  ⇩
                </button>
                <button
                  type="button"
                  className="icon-button desktop-only"
                  onClick={copyCurrentChat}
                  title="Copy conversation"
                  aria-label="Copy conversation"
                >
                  ⧉
                </button>
              </>
            )}

            <button
              type="button"
              className="icon-button"
              onClick={() => setShowShortcuts(true)}
              title="Keyboard shortcuts"
              aria-label="Keyboard shortcuts"
            >
              ?
            </button>

            {cloudLoading && <span className="cloud-status">Syncing...</span>}

            {authUser && !cloudLoading && (
              <span className="cloud-status">☁ Synced</span>
            )}

            <button
              type="button"
              className="icon-button"
              onClick={toggleTheme}
              title="Toggle theme"
            >
              {theme === "dark" ? "☀" : "☾"}
            </button>
          </div>
        </header>

        <div className="content">
          {currentMessages.length === 0 ? (
            <div className="welcome">
              <div className="welcome-logo">M</div>

              <h1>How can I help you today?</h1>

              <p>
                Ask MyAI anything, write code, analyze files, or explore ideas.
              </p>

              <div className="suggestions">
                {suggestions.map((suggestion) => (
                  <button
                    type="button"
                    className="suggestion"
                    key={suggestion}
                    onClick={() => useSuggestion(suggestion)}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="messages">
              {currentMessages.map((item) => (
                <MessageBubble
                  key={item.id}
                  message={item}
                  onCopy={copyMessage}
                  onRegenerate={regenerateMessage}
                  onFeedback={handleFeedback}
                />
              ))}

              {isTyping && <TypingIndicator />}

              <div ref={messagesEndRef} className="messages-end" />
            </div>
          )}

          {error && (
            <div className="error-banner">
              <span>{error}</span>

              <button type="button" onClick={() => setError("")}>
                ×
              </button>
            </div>
          )}

          {cloudSyncError && (
            <div className="cloud-error">
              <span>Cloud sync: {cloudSyncError}</span>

              <button type="button" onClick={() => setCloudSyncError("")}>
                ×
              </button>
            </div>
          )}

          {attachments.length > 0 && (
            <div className="composer-attachments">
              {attachments.map((attachment) => (
                <div className="pending-attachment" key={attachment.id}>
                  <AttachmentPreview attachment={attachment} />

                  <button
                    type="button"
                    className="remove-attachment"
                    onClick={() => removeAttachment(attachment.id)}
                    aria-label={`Remove ${attachment.name}`}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="input-area">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              hidden
              onChange={handleFileSelection}
            />

            <button
              type="button"
              className="composer-button"
              onClick={openFilePicker}
              disabled={isTyping}
              title="Attach files"
            >
              +
            </button>

            <textarea
              ref={inputRef}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              onKeyDown={handleInputKeyDown}
              placeholder="Message MyAI..."
              rows={1}
              disabled={isTyping}
            />

            <button
              type="button"
              className="send-button"
              onClick={sendMessage}
              disabled={
                isTyping || (!message.trim() && attachments.length === 0)
              }
              title="Send message"
            >
              ↑
            </button>
          </div>

          <div className="composer-footer">
            <div className="composer-note">
              MyAI can make mistakes. Check important information.
            </div>
            <div
              className={`composer-count ${
                message.length > 9000 ? "near-limit" : ""
              }`}
            >
              {message.length.toLocaleString()} chars
            </div>
          </div>
        </div>
      </main>

      {showSettings && (
        <Modal title="Settings" onClose={() => setShowSettings(false)}>
          <div className="settings">
            <div className="settings-row">
              <div>
                <div className="settings-title">Appearance</div>

                <div className="settings-description">
                  Choose between dark and light mode.
                </div>
              </div>

              <button
                type="button"
                className="secondary-button"
                onClick={toggleTheme}
              >
                {theme === "dark" ? "Light mode" : "Dark mode"}
              </button>
            </div>

            <div className="settings-row">
              <div>
                <div className="settings-title">Account</div>

                <div className="settings-description">
                  {authUser
                    ? `Signed in as ${
                        authUser.email || authUser.name || "MyAI User"
                      }`
                    : "Sign in to synchronize your conversations across devices."}
                </div>
              </div>

              {authUser ? (
                <button
                  type="button"
                  className="secondary-button"
                  onClick={logout}
                >
                  Logout
                </button>
              ) : (
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => {
                    setShowSettings(false);
                    openLogin();
                  }}
                >
                  Sign in
                </button>
              )}
            </div>

            <div className="settings-row">
              <div>
                <div className="settings-title">Chat tools</div>
                <div className="settings-description">
                  Export, copy, or clear the current conversation.
                </div>
              </div>
              <div className="settings-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={copyCurrentChat}
                  disabled={!currentMessages.length}
                >
                  Copy
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={exportCurrentChat}
                  disabled={!currentMessages.length}
                >
                  Export TXT
                </button>
                <button
                  type="button"
                  className="danger-button"
                  onClick={clearCurrentChat}
                  disabled={!currentMessages.length}
                >
                  Clear
                </button>
              </div>
            </div>

            {authUser && (
              <div className="settings-row">
                <div>
                  <div className="settings-title">Cloud synchronization</div>

                  <div className="settings-description">
                    Synchronize your MyAI conversations with your account.
                  </div>
                </div>

                <button
                  type="button"
                  className="secondary-button"
                  onClick={syncCloudConversations}
                  disabled={cloudLoading}
                >
                  {cloudLoading ? "Syncing..." : "Sync now"}
                </button>
              </div>
            )}
          </div>
        </Modal>
      )}

      {showShortcuts && (
        <Modal
          title="Keyboard shortcuts"
          onClose={() => setShowShortcuts(false)}
        >
          <div className="shortcut-list">
            <div className="shortcut-row">
              <span>Focus chat search</span>
              <kbd>Ctrl / ⌘ + K</kbd>
            </div>
            <div className="shortcut-row">
              <span>New chat</span>
              <kbd>Ctrl / ⌘ + N</kbd>
            </div>
            <div className="shortcut-row">
              <span>Show shortcuts</span>
              <kbd>Ctrl / ⌘ + /</kbd>
            </div>
            <div className="shortcut-row">
              <span>Send message</span>
              <kbd>Enter</kbd>
            </div>
            <div className="shortcut-row">
              <span>New line</span>
              <kbd>Shift + Enter</kbd>
            </div>
            <div className="shortcut-row">
              <span>Close panels</span>
              <kbd>Esc</kbd>
            </div>
          </div>
        </Modal>
      )}

      {showAuth && (
        <AuthModal
          mode={authMode}
          setMode={(mode) => {
            setAuthMode(mode);
            setAuthError("");
          }}
          onClose={() => setShowAuth(false)}
          onSubmit={handleAuthSubmit}
          loading={authLoading}
          error={authError}
        />
      )}
    </div>
  );
}

export default App;
