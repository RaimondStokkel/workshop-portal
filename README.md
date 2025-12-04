## Prompt Party Workshop

A hands-on playground for experimenting with prompt engineering, built with Next.js 15 and Tailwind. The app pairs a Markdown-based curriculum with a live chat and image generation surface backed by your Azure AI Foundry deployment.

### Features

- Workshop reader that streams fun Markdown lessons from `content/workshop`.
- Prompt playground with controls for system prompt, temperature, top-p, and reasoning mode.
- Image generation panel that supports multiple output sizes.
- Secure server-side routes that call Azure OpenAI via API key or managed identity.

### Local Setup

1. Install dependencies:

	```bash
	npm install
	```

2. Copy `.env.example` to `.env.local` and fill in your Azure AI Foundry values:

	```ini
	AZURE_OPENAI_ENDPOINT="https://<your-endpoint>.openai.azure.com"
	AZURE_OPENAI_API_VERSION="2024-08-01-preview"
	AZURE_OPENAI_CHAT_DEPLOYMENT="<chat-deployment-name>"
	AZURE_OPENAI_IMAGE_DEPLOYMENT="<image-deployment-name>"
	AZURE_OPENAI_REASONING_DEPLOYMENT="<optional-reasoning-deployment-name>"
	AZURE_OPENAI_REASONING_API_VERSION="2025-01-01-preview"
	AZURE_OPENAI_REASONING_ENDPOINT="https://<optional-reasoning-endpoint>.openai.azure.com"
	AZURE_OPENAI_REASONING_API_KEY="<optional-reasoning-api-key>"
	AZURE_OPENAI_REASONING_INCLUDE_REASONING_PARAM="false"
	AZURE_OPENAI_API_KEY="<optional-api-key-if-not-using-managed-identity>"
	AZURE_OPENAI_USE_MANAGED_IDENTITY="false"
	WORKSHOP_PORTAL_PASSWORD="<required-portal-password>"
	```

	`AZURE_OPENAI_REASONING_*` variables are only required if you enable the reasoning toggle and connect it to a reasoning-capable deployment (for example `o4-mini`). Leave them unset to reuse the default endpoint and credentials. Set `AZURE_OPENAI_REASONING_INCLUDE_REASONING_PARAM` to `true` only for deployments that accept the `reasoning` payload field; keep it `false` for models like `o4-mini` that already reason implicitly. `WORKSHOP_PORTAL_PASSWORD` is mandatory: without it the portal responds with a lockout screen.

3. Start the dev server:

	```bash
	npm run dev
	```

	Visit [http://localhost:3000](http://localhost:3000) and begin experimenting.

### Deploying to Azure App Service

1. Ensure you are logged into Azure CLI and have selected the right subscription.
2. Provision an App Service (Linux, Node 20+) and set the environment variables from `.env.example` in the App Service configuration, including `WORKSHOP_PORTAL_PASSWORD`.
3. Deploy with Azure Developer CLI or Azure CLI. A quick option with zip deployment:

	```bash
	npm run build
	az webapp up --name <app-name> --resource-group <rg-name> --runtime "NODE|20-lts" --plan <app-service-plan>
	```

	Afterwards, configure `AZURE_OPENAI_USE_MANAGED_IDENTITY=true` if you assign a managed identity with access to the Azure OpenAI resource.

### Customizing the Workshop

- Add or edit Markdown lessons inside `content/workshop`. Filenames determine ordering.
- Update `src/components/WorkshopView.tsx` if you want to tweak the playground layout or add new controls.
- Extend API routes under `src/app/api/ai` for additional tooling (for example, evaluation endpoints).

Enjoy hosting your own prompt party!
