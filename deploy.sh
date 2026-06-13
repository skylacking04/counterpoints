#!/bin/bash
set -e

PROJECT=wandern-project-startup
REGION=us-central1
SERVICE=counterpoints-app
GCS_BUCKET=wandern-project-startup.firebasestorage.app

# Grant Cloud Run SA access to secrets (first-time setup)
SA="${PROJECT}@appspot.gserviceaccount.com"
for SECRET in xai-api-key yt-api-key gemini-key jina-api-key tavily-key tavily-key-2 tavily-key-3 groq-key yt-cookies proxy-url; do
  gcloud secrets add-iam-policy-binding $SECRET \
    --project=$PROJECT \
    --member="serviceAccount:$SA" \
    --role="roles/secretmanager.secretAccessor" \
    --quiet 2>/dev/null || true
done

# yt-cookies is optional — only mount it (as a file) if the secret exists, so deploys work without it.
SECRETS="GOOGLE_AI_API_KEY=gemini-key:latest,YOUTUBE_API_KEY=yt-api-key:latest,XAI_API_KEY=xai-api-key:latest,JINA_API_KEY=jina-api-key:latest,TAVILY_API_KEY=tavily-key:latest,TAVILY_API_KEY_2=tavily-key-2:latest,TAVILY_API_KEY_3=tavily-key-3:latest,GROQ_API_KEY=groq-key:latest"
ENVVARS="GCLOUD_PROJECT=$PROJECT,GCS_BUCKET=$GCS_BUCKET"
if gcloud secrets describe yt-cookies --project $PROJECT >/dev/null 2>&1; then
  SECRETS="$SECRETS,/secrets/yt-cookies.txt=yt-cookies:latest"
  ENVVARS="$ENVVARS,YTDLP_COOKIES=/secrets/yt-cookies.txt"
  echo "→ yt-cookies secret found: YouTube authentication enabled"
else
  echo "→ yt-cookies secret not found: YouTube server-pull will be bot-blocked (live/non-YouTube still work)"
fi

# proxy-url is optional — residential proxy for yt-dlp to defeat YouTube's datacenter-IP block.
if gcloud secrets describe proxy-url --project $PROJECT >/dev/null 2>&1; then
  SECRETS="$SECRETS,PROXY_URL=proxy-url:latest"
  echo "→ proxy-url secret found: residential proxy enabled for yt-dlp"
else
  echo "→ proxy-url secret not found: yt-dlp runs direct (datacenter IP, may be blocked)"
fi

# Grant Vertex AI access (uses service account ADC — no API key needed)
gcloud projects add-iam-policy-binding $PROJECT \
  --member="serviceAccount:$SA" \
  --role="roles/aiplatform.user" \
  --condition=None \
  --quiet 2>/dev/null || true

# Grant Cloud Run SA Firestore access (for knowledge base)
CR_SA="$(gcloud run services describe $SERVICE --region $REGION --project $PROJECT --format 'value(spec.template.spec.serviceAccountName)' 2>/dev/null || echo '')"
if [ -z "$CR_SA" ]; then
  CR_SA="${PROJECT}@appspot.gserviceaccount.com"
fi
gcloud projects add-iam-policy-binding $PROJECT \
  --member="serviceAccount:$CR_SA" \
  --role="roles/datastore.user" \
  --quiet 2>/dev/null || true

# Grant Cloud Run SA write access to the audio/transcript bucket
gcloud storage buckets add-iam-policy-binding "gs://$GCS_BUCKET" \
  --member="serviceAccount:$SA" \
  --role="roles/storage.objectAdmin" \
  --quiet 2>/dev/null || true

gcloud run deploy $SERVICE \
  --source . \
  --region $REGION \
  --port 3000 \
  --memory 1Gi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 5 \
  --timeout 3600 \
  --allow-unauthenticated \
  --set-env-vars="$ENVVARS" \
  --set-secrets="$SECRETS" \
  --project $PROJECT

URL=$(gcloud run services describe $SERVICE --region $REGION --project $PROJECT --format 'value(status.url)' 2>/dev/null)
echo ""
echo "Live at: $URL"
