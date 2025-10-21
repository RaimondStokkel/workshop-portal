'use client';

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { WorkshopModule } from "@/types/workshop";

const defaultPrompt = `Plan a lightning talk that teaches a new developer how to debug an API integration.`;

type ImageStyle = "vivid" | "natural";
type ImageQuality = "standard" | "hd";
type ImageResult = {
  type: "base64" | "url";
  value: string;
};

// Markdown rendering is customized inline when invoking ReactMarkdown.

export function WorkshopView() {
  const [modules, setModules] = useState<WorkshopModule[]>([]);
  const [selectedModule, setSelectedModule] = useState<string>("");
  const [moduleContent, setModuleContent] = useState<string>("Loading...");
  const [isModuleLoading, setIsModuleLoading] = useState(false);
  const [moduleError, setModuleError] = useState<string | null>(null);

  const [systemPrompt, setSystemPrompt] = useState<string>(
    "You are an encouraging prompt coach who gives actionable advice.",
  );
  const [prompt, setPrompt] = useState<string>(defaultPrompt);
  const [temperature, setTemperature] = useState<number>(0.7);
  const [topP, setTopP] = useState<number>(0.9);
  const [reasoningEnabled, setReasoningEnabled] = useState<boolean>(false);
  const [reasoningEffort, setReasoningEffort] = useState<"low" | "medium" | "high">("medium");
  const [maxOutputTokens, setMaxOutputTokens] = useState<number>(3000);
  const [chatResult, setChatResult] = useState<string>("");
  const [chatUsage, setChatUsage] = useState<string>("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  const [imagePrompt, setImagePrompt] = useState<string>(
    "A whimsical blueprint-style illustration of collaborative prompting.",
  );
  const [imageSize, setImageSize] = useState<string>("1024x1024");
  const [imageStyle, setImageStyle] = useState<ImageStyle>("vivid");
  const [imageQuality, setImageQuality] = useState<ImageQuality>("standard");
  const [imageResult, setImageResult] = useState<ImageResult | null>(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);

  const [imageWidth, imageHeight] = useMemo(() => {
    const [width, height] = imageSize
      .split("x")
      .map((value) => Number.parseInt(value, 10));
    return [width || 768, height || 768] as const;
  }, [imageSize]);

  useEffect(() => {
    async function loadModules() {
      try {
        const response = await fetch("/api/workshop");
        if (!response.ok) {
          throw new Error("Failed to load modules");
        }
        const data = await response.json();
        setModules(data.modules ?? []);
        if (data.modules?.[0]?.slug) {
          setSelectedModule(data.modules[0].slug);
        }
      } catch (error) {
        console.error(error);
        setModuleError("Unable to load workshop modules. Please refresh.");
      }
    }

    loadModules();
  }, []);

  useEffect(() => {
    if (!selectedModule) {
      return;
    }

    async function loadModuleContent() {
      setIsModuleLoading(true);
      setModuleError(null);
      try {
        const response = await fetch(`/api/workshop/${selectedModule}`);
        if (!response.ok) {
          throw new Error("Module not found");
        }
        const data = await response.json();
        setModuleContent(data.content ?? "");
      } catch (error) {
        console.error(error);
        setModuleError("Unable to load this module.");
      } finally {
        setIsModuleLoading(false);
      }
    }

    loadModuleContent();
  }, [selectedModule]);

  const selectedMetadata = useMemo(
    () => modules.find((module) => module.slug === selectedModule),
    [modules, selectedModule],
  );

  async function handleChatSubmit() {
    setChatLoading(true);
    setChatError(null);
    setChatResult("");
    setChatUsage("");

    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemPrompt,
          prompt,
          temperature,
          topP,
          reasoning: {
            enabled: reasoningEnabled,
            effort: reasoningEffort,
            maxOutputTokens,
          },
        }),
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}));
        throw new Error(errorPayload?.details ?? "Chat request failed");
      }

      const data = await response.json();
      setChatResult(data.message ?? "");
      if (data.usage) {
        const usageParts = Object.entries(data.usage)
          .map(([key, value]) => `${key}: ${value}`)
          .join(" · ");
        setChatUsage(usageParts);
      }
    } catch (error) {
      console.error(error);
      setChatError((error as Error).message);
    } finally {
      setChatLoading(false);
    }
  }

  async function handleImageSubmit() {
    setImageLoading(true);
    setImageError(null);
    setImageResult(null);

    try {
      const response = await fetch("/api/ai/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: imagePrompt,
          size: imageSize,
          style: imageStyle,
          quality: imageQuality,
          responseFormat: "b64_json",
        }),
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}));
        throw new Error(errorPayload?.details ?? "Image request failed");
      }

      const data = await response.json();
      if (data.imageBase64) {
        setImageResult({
          type: "base64",
          value: `data:image/png;base64,${data.imageBase64}`,
        });
      } else if (data.imageUrl) {
        setImageResult({ type: "url", value: data.imageUrl });
      } else {
        throw new Error("Image response did not include data");
      }
    } catch (error) {
      console.error(error);
      setImageError((error as Error).message);
    } finally {
      setImageLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-white/10 bg-slate-900/80">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-5">
          <div>
            <h1 className="text-2xl font-semibold">Prompt Party Workshop</h1>
            <p className="text-sm text-slate-300">
              Experiment with prompts, settings, and creative outputs side-by-side.
            </p>
          </div>
          <div className="hidden text-right text-xs sm:block text-slate-400">
            Powered by your Azure AI Foundry deployment
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[1300px] flex-col gap-6 px-4 py-6 lg:flex-row lg:gap-8">
        <aside className="flex w-full flex-col gap-4 rounded-xl border border-white/10 bg-slate-900/60 p-4 lg:w-[24rem]">
          <h2 className="text-lg font-medium">Workshop Modules</h2>
          {moduleError ? (
            <p className="rounded bg-red-500/20 p-3 text-sm text-red-200">
              {moduleError}
            </p>
          ) : null}
          <nav className="flex flex-col gap-2">
            {modules.map((module) => (
              <button
                key={module.slug}
                type="button"
                onClick={() => setSelectedModule(module.slug)}
                className={`rounded-lg border px-3 py-2 text-left text-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime-400 ${selectedModule === module.slug ? "border-lime-400 bg-lime-400/10 text-lime-200" : "border-white/10 bg-slate-900/50 hover:border-lime-300/60"}`}
              >
                <div className="font-semibold">{module.title}</div>
                <div className="text-xs text-slate-300">
                  {module.summary || "Ready to explore!"}
                </div>
              </button>
            ))}
          </nav>
        </aside>

        <section className="flex w-full flex-1 flex-col gap-4">
          <div className="rounded-xl border border-white/10 bg-slate-900/60 p-5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-medium">
                {selectedMetadata?.title ?? "Pick a module"}
              </h2>
              <span className="text-xs uppercase tracking-[0.2em] text-lime-300">
                Read & Experiment
              </span>
            </div>
            <div className="mt-4 max-h-[32rem] overflow-y-auto pr-2 text-sm leading-relaxed">
              {isModuleLoading ? (
                <p className="animate-pulse text-slate-300">Loading module...</p>
              ) : moduleError ? (
                <p className="text-red-200">{moduleError}</p>
              ) : (
                <div className="space-y-4">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      h1: ({ children }) => (
                        <h1 className="text-2xl font-semibold text-lime-200">{children}</h1>
                      ),
                      h2: ({ children }) => (
                        <h2 className="mt-6 text-xl font-semibold text-lime-100">{children}</h2>
                      ),
                      h3: ({ children }) => (
                        <h3 className="mt-5 text-lg font-semibold text-lime-100">{children}</h3>
                      ),
                      p: ({ children }) => (
                        <p className="text-base leading-relaxed text-slate-100">{children}</p>
                      ),
                      ul: ({ children }) => (
                        <ul className="ml-5 list-disc space-y-2 text-base text-slate-100 marker:text-lime-300">
                          {children}
                        </ul>
                      ),
                      ol: ({ children }) => (
                        <ol className="ml-5 list-decimal space-y-2 text-base text-slate-100 marker:text-lime-300">
                          {children}
                        </ol>
                      ),
                      li: ({ children }) => (
                        <li className="pl-1 text-base leading-relaxed text-slate-100">{children}</li>
                      ),
                      strong: ({ children }) => (
                        <strong className="text-slate-50">{children}</strong>
                      ),
                      em: ({ children }) => (
                        <em className="text-slate-200">{children}</em>
                      ),
                      code: ({ children }) => (
                        <code className="rounded bg-slate-950/70 px-1.5 py-0.5 font-mono text-sm text-lime-200">
                          {children}
                        </code>
                      ),
                      pre: ({ children }) => (
                        <pre className="overflow-x-auto rounded-lg border border-lime-400/40 bg-slate-950/80 p-3 text-sm text-slate-100">
                          {children}
                        </pre>
                      ),
                      blockquote: ({ children }) => (
                        <blockquote className="border-l-4 border-lime-400/60 bg-slate-900/70 px-4 py-2 text-base italic text-slate-100">
                          {children}
                        </blockquote>
                      ),
                      table: ({ children }) => (
                        <div className="overflow-x-auto">
                          <table className="w-full border-collapse text-left text-sm text-slate-100">
                            {children}
                          </table>
                        </div>
                      ),
                      thead: ({ children }) => (
                        <thead className="bg-slate-900/70 text-slate-200">{children}</thead>
                      ),
                      th: ({ children }) => (
                        <th className="border border-white/10 px-3 py-2 text-xs uppercase tracking-wide">
                          {children}
                        </th>
                      ),
                      td: ({ children }) => (
                        <td className="border border-white/10 px-3 py-2 text-sm text-slate-100">
                          {children}
                        </td>
                      ),
                      a: ({ children, href }) => (
                        <a href={href} className="text-lime-300 underline-offset-2 hover:underline">
                          {children}
                        </a>
                      ),
                    }}
                  >
                    {moduleContent}
                  </ReactMarkdown>
                </div>
              )}
            </div>
          </div>

          <div className="grid gap-4">
            <div className="rounded-xl border border-white/10 bg-slate-900/60 p-5">
              <h3 className="text-lg font-medium text-lime-200">Text Playground</h3>
              <div className="mt-4 flex flex-col gap-3 text-sm">
                <label className="flex flex-col gap-1">
                  <span className="text-xs uppercase tracking-wide text-slate-300">
                    System Prompt
                  </span>
                  <textarea
                    value={systemPrompt}
                    onChange={(event) => setSystemPrompt(event.target.value)}
                    className="min-h-[70px] rounded-md border border-white/10 bg-slate-950/60 p-2 text-slate-100 focus:border-lime-400 focus:outline-none"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs uppercase tracking-wide text-slate-300">
                    Prompt
                  </span>
                  <textarea
                    value={prompt}
                    onChange={(event) => setPrompt(event.target.value)}
                    className="min-h-[120px] rounded-md border border-white/10 bg-slate-950/60 p-2 text-slate-100 focus:border-lime-400 focus:outline-none"
                  />
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex flex-col gap-1">
                    <span className="text-xs uppercase tracking-wide text-slate-300">
                      Temperature ({temperature.toFixed(2)})
                    </span>
                    <input
                      type="range"
                      min="0"
                      max="2"
                      step="0.1"
                      value={temperature}
                      onChange={(event) => setTemperature(Number(event.target.value))}
                      className={`accent-lime-400 ${reasoningEnabled ? "opacity-50" : ""}`}
                      disabled={reasoningEnabled}
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-xs uppercase tracking-wide text-slate-300">
                      Top-p ({topP.toFixed(2)})
                    </span>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={topP}
                      onChange={(event) => setTopP(Number(event.target.value))}
                      className={`accent-lime-400 ${reasoningEnabled ? "opacity-50" : ""}`}
                      disabled={reasoningEnabled}
                    />
                  </label>
                </div>
                <div className="flex flex-wrap items-center gap-3 rounded-md border border-white/10 bg-slate-950/60 p-3">
                  <label className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-200">
                    <input
                      type="checkbox"
                      checked={reasoningEnabled}
                      onChange={(event) => setReasoningEnabled(event.target.checked)}
                      className="size-4 rounded border-white/20 bg-slate-900 text-lime-400 focus:outline-none focus:ring-2 focus:ring-lime-400"
                    />
                    Reasoning
                  </label>
                  {reasoningEnabled ? (
                    <>
                      <select
                        value={reasoningEffort}
                        onChange={(event) =>
                          setReasoningEffort(event.target.value as typeof reasoningEffort)
                        }
                        className="rounded-md border border-white/10 bg-slate-900 px-2 py-1 text-xs text-slate-100 focus:border-lime-400 focus:outline-none"
                      >
                        <option value="low">Low effort</option>
                        <option value="medium">Medium effort</option>
                        <option value="high">High effort</option>
                      </select>
                      <div className="flex items-center gap-1 text-xs text-slate-300">
                        <span>Max tokens</span>
                        <input
                          type="number"
                          min={100}
                          max={4000}
                          step={100}
                          value={maxOutputTokens}
                          onChange={(event) => setMaxOutputTokens(Number(event.target.value))}
                          className="w-20 rounded-md border border-white/10 bg-slate-900 px-2 py-1 text-right text-slate-100 focus:border-lime-400 focus:outline-none"
                        />
                      </div>
                    </>
                  ) : null}
                {reasoningEnabled ? (
                  <p className="text-xs text-slate-300">
                    Temperature and top-p are fixed for reasoning models.
                  </p>
                ) : null}
                </div>
                <button
                  type="button"
                  onClick={handleChatSubmit}
                  disabled={chatLoading}
                  className="mt-2 inline-flex items-center justify-center rounded-md bg-lime-400 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-lime-300 disabled:cursor-not-allowed disabled:bg-lime-600/40"
                >
                  {chatLoading ? "Generating..." : "Generate Text"}
                </button>
                {chatError ? (
                  <p className="text-sm text-red-200">{chatError}</p>
                ) : null}
                {chatUsage ? (
                  <p className="text-xs text-slate-300">{chatUsage}</p>
                ) : null}
                {chatResult ? (
                  <div className="mt-3 rounded-md border border-lime-400/30 bg-slate-950/60 p-3 text-sm text-slate-100 whitespace-pre-wrap">
                    {chatResult}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-slate-900/60 p-5">
              <h3 className="text-lg font-medium text-lime-200">Image Playground</h3>
              <div className="mt-4 flex flex-col gap-3 text-sm">
                <label className="flex flex-col gap-1">
                  <span className="text-xs uppercase tracking-wide text-slate-300">
                    Image Prompt
                  </span>
                  <textarea
                    value={imagePrompt}
                    onChange={(event) => setImagePrompt(event.target.value)}
                    className="min-h-[120px] rounded-md border border-white/10 bg-slate-950/60 p-2 text-slate-100 focus:border-lime-400 focus:outline-none"
                  />
                </label>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <label className="flex flex-col gap-1">
                    <span className="text-xs uppercase tracking-wide text-slate-300">
                      Size
                    </span>
                    <select
                      value={imageSize}
                      onChange={(event) => setImageSize(event.target.value)}
                      className="rounded-md border border-white/10 bg-slate-900 px-3 py-2 text-slate-100 focus:border-lime-400 focus:outline-none"
                    >
                      <option value="1024x1024">1024 x 1024</option>
                      <option value="1792x1024">1792 x 1024</option>
                      <option value="1024x1792">1024 x 1792</option>
                    </select>
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-xs uppercase tracking-wide text-slate-300">
                      Style
                    </span>
                    <select
                      value={imageStyle}
                      onChange={(event) => setImageStyle(event.target.value as ImageStyle)}
                      className="rounded-md border border-white/10 bg-slate-900 px-3 py-2 text-slate-100 focus:border-lime-400 focus:outline-none"
                    >
                      <option value="vivid">Vivid</option>
                      <option value="natural">Natural</option>
                    </select>
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-xs uppercase tracking-wide text-slate-300">
                      Quality
                    </span>
                    <select
                      value={imageQuality}
                      onChange={(event) => setImageQuality(event.target.value as ImageQuality)}
                      className="rounded-md border border-white/10 bg-slate-900 px-3 py-2 text-slate-100 focus:border-lime-400 focus:outline-none"
                    >
                      <option value="standard">Standard</option>
                      <option value="hd">HD</option>
                    </select>
                  </label>
                </div>
                <button
                  type="button"
                  onClick={handleImageSubmit}
                  disabled={imageLoading}
                  className="mt-2 inline-flex items-center justify-center rounded-md bg-lime-400 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-lime-300 disabled:cursor-not-allowed disabled:bg-lime-600/40"
                >
                  {imageLoading ? "Painting..." : "Generate Image"}
                </button>
                {imageError ? (
                  <p className="text-sm text-red-200">{imageError}</p>
                ) : null}
                {imageResult ? (
                  <figure className="mt-3 space-y-2 text-center">
                    <Image
                      src={imageResult.value}
                      alt="Generated artwork"
                      width={imageWidth}
                      height={imageHeight}
                      className="mx-auto h-auto w-full max-w-sm rounded-lg border border-lime-400/40 shadow-lg"
                      unoptimized
                    />
                    <figcaption className="text-xs text-slate-300">
                      {imageResult.type === "base64"
                        ? "Right-click to save your masterpiece."
                        : "Image hosted temporarily by Azure AI Foundry."}
                    </figcaption>
                  </figure>
                ) : null}
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
