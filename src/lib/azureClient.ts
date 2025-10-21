import { DefaultAzureCredential } from "@azure/identity";

const cognitiveScope = "https://cognitiveservices.azure.com/.default";
let credential: DefaultAzureCredential | null = null;

async function getManagedIdentityToken() {
  if (!credential) {
    credential = new DefaultAzureCredential();
  }

  const token = await credential.getToken(cognitiveScope, {
    abortSignal: AbortSignal.timeout(8000),
  });

  if (!token?.token) {
    throw new Error("Managed identity did not return an access token.");
  }

  return token.token;
}

export async function buildAzureOpenAIHeaders() {
  const useManagedIdentity =
    process.env.AZURE_OPENAI_USE_MANAGED_IDENTITY?.toLowerCase() === "true";
  const apiKey = process.env.AZURE_OPENAI_API_KEY;

  if (apiKey && !useManagedIdentity) {
    return {
      "api-key": apiKey,
    } as Record<string, string>;
  }

  try {
    const bearerToken = await getManagedIdentityToken();
    return {
      Authorization: `Bearer ${bearerToken}`,
    } as Record<string, string>;
  } catch (error) {
    if (apiKey) {
      console.warn(
        "Managed identity failed; falling back to API key.",
        (error as Error).message,
      );
      return {
        "api-key": apiKey,
      };
    }

    throw new Error(
      "No Azure OpenAI authentication method available. Provide AZURE_OPENAI_API_KEY or enable managed identity.",
    );
  }
}
