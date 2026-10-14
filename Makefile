# Lumo — Sky of Questions: a static site with no build step (README.md).
# make is only needed to preview locally, check the lines, voice them, and build the hosting folder.
-include local.mk
export OPENROUTER_API_KEY OPENROUTER_PROXY

LANGS ?=

# Where `make deploy` uploads dist/ — set it in local.mk (see local.mk.example):
#   DEPLOY = ssh://nemilya-me/home/ilya/site/projects/math    (or the rsync form: nemilya-me:/home/ilya/site/projects/math)
# The ssh:// form is turned into rsync's host:/path. (No '#' inside $(shell …): macOS make 3.81 reads it as a comment.)
DEPLOY ?=
DEPLOY_TARGET = $(shell printf '%s' '$(DEPLOY)' | sed -E 's|^s?sh://([^/]+)(/.*)$$|\1:\2|')
RSYNC = rsync -rlptvz --delete --exclude '.DS_Store'

.PHONY: help serve check voice dist deploy deploy-dry

help:  ## list targets
	@awk -F ':.*## ' '/^[a-z-]+:.*## / { printf "  %-10s %s\n", $$1, $$2 }' $(firstword $(MAKEFILE_LIST))

serve:  ## the portal locally: http://localhost:8000
	node tools/serve.mjs 8000

check:  ## lines: every language and age version present; scripts only use lines that exist
	node tools/lines.mjs check

voice:  ## voice new and changed lines (Gemini TTS via OpenRouter) → web/audio/  (LANGS="en ru")
	node tools/voice.mjs $(LANGS)

dist: check  ## folder for hosting: dist/ and dist.zip (upload to any subfolder)
	node tools/dist.mjs

deploy: dist  ## upload dist/ to the server: DEPLOY = … in local.mk (files gone from dist/ are removed there too)
	@test -n "$(DEPLOY)" || { echo 'No DEPLOY. Add to local.mk:  DEPLOY = ssh://host/path/to/site/projects/math'; exit 1; }
	$(RSYNC) dist/ '$(DEPLOY_TARGET)/'

deploy-dry: dist  ## what deploy would upload and delete — changes nothing
	@test -n "$(DEPLOY)" || { echo 'No DEPLOY. Add to local.mk:  DEPLOY = ssh://host/path/to/site/projects/math'; exit 1; }
	$(RSYNC) --dry-run dist/ '$(DEPLOY_TARGET)/'
